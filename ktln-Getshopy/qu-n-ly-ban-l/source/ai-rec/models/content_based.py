"""Content-based scoring trên đặc trưng catalog: danh mục gốc, hãng, tầm giá.

Mô hình
───────
Mỗi sản phẩm i là một vector one-hot x_i trên ba nhóm đặc trưng
G = {ParentCategory, Brand, PriceBand} — đúng ba điều onboarding hỏi khách.

Hồ sơ của khách u, với từng nhóm g, là một phân phối trên các giá trị của g:

    p_u^g(v) = ( H_u(v) + c · O_u(v) ) / Σ_v' ( H_u(v') + c · O_u(v') )

  H_u(v) : tổng trọng số mua (đã giảm theo thời gian, lấy từ ma trận CF) của các
           món khách đã mua có giá trị v ở nhóm g
  O_u(v) : 1 nếu khách chọn "thích" v ở onboarding, ngược lại 0
  c      : ONBOARDING_PSEUDO_COUNT — một lựa chọn onboarding nặng bằng c lần mua

Điểm nội dung của món i:

    cb(u, i) = Σ_g w_g · p_u^g(value_g(i)) / Σ_g w_g            ∈ [0, 1]

tức tích vô hướng giữa hồ sơ khách và vector one-hot của món — cách dựng hồ sơ
cổ điển của content-based (Pazzani & Billsus, 2007; Lops et al., 2011).

Hệ quả cần biết: mọi món cùng (nhóm, hãng, tầm giá) có CÙNG điểm. Vì vậy chỉ cần
vài đại diện mỗi ô làm ứng viên (build_candidates), và thứ tự giữa các món trong
một ô do độ phổ biến quyết định chứ không phải do nội dung.

"Không quan tâm" KHÔNG trừ điểm mà LỌC CỨNG (blocked_mask): trừ điểm thì một món
bị ghét vẫn có thể lọt top nếu các kênh khác đẩy đủ cao.

Tài liệu:
  Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems.
    In The Adaptive Web (LNCS 4321), 325–341.
  Lops, P., de Gemmis, M., & Semeraro, G. (2011). Content-based recommender
    systems: State of the art and trends. In Recommender Systems Handbook, 73–105.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import scipy.sparse as sp

FEATURE_GROUPS: tuple[str, ...] = ("ParentCategory", "Brand", "PriceBand")

# Tên chiều trong serving.customer_preference_signals -> nhóm đặc trưng
SIGNAL_DIMENSION_TO_GROUP = {
    "category": "ParentCategory",
    "brand": "Brand",
    "price_band": "PriceBand",
}

# Onboarding chỉ hỏi "không quan tâm" cho danh mục và hãng
BLOCKABLE_GROUPS: tuple[str, ...] = ("ParentCategory", "Brand")

CELL = ["ParentCategory", "Brand", "PriceBand"]


def build_candidates(catalog: pd.DataFrame, units: pd.Series, per_cell: int) -> pd.DataFrame:
    """Chọn đại diện mỗi ô (nhóm × hãng × tầm giá) + mọi món đã bán.

    PHẢI cùng thứ tự với dbt serving.product_features: số lượng bán giảm dần,
    CatalogSold giảm dần, ProductID tăng dần. Production đọc bảng dbt (doanh số
    tới hiện tại); benchmark gọi hàm này với doanh số CHỈ trong cửa sổ train, để
    tập ứng viên không biết trước món nào sẽ bán chạy ở giai đoạn test.

    catalog: ProductID, ParentCategory, Brand, PriceBand, CatalogSold
    units  : Series ProductID -> số lượng bán
    """
    df = catalog.copy()
    df["ProductID"] = df["ProductID"].astype(str)
    df["UnitsSold"] = df["ProductID"].map(units.astype(float)).fillna(0.0)
    df["_pid"] = pd.to_numeric(df["ProductID"], errors="coerce")
    df = df.sort_values(
        CELL + ["UnitsSold", "CatalogSold", "_pid"],
        ascending=[True, True, True, False, False, True],
        kind="stable",
    )
    df["CellRank"] = df.groupby(CELL, sort=False).cumcount() + 1
    out = df[(df["CellRank"] <= per_cell) | (df["UnitsSold"] > 0)]
    return out.drop(columns="_pid").reset_index(drop=True)


class ContentBasedModel:
    """Hồ sơ khách theo đặc trưng nội dung + bộ lọc "không quan tâm"."""

    def __init__(
        self,
        group_weights: dict[str, float] | None = None,
        onboarding_pseudo_count: float = 1.0,
    ) -> None:
        self.group_weights = {g: 1.0 for g in FEATURE_GROUPS}
        if group_weights:
            self.group_weights.update(group_weights)
        self.onboarding_pseudo_count = float(onboarding_pseudo_count)

        self.item_ids: pd.Index = pd.Index([], dtype="string")
        self.item_values: dict[str, np.ndarray] = {}
        self.catalog_sold: np.ndarray = np.zeros(0, dtype=np.float32)
        self.X: sp.csr_matrix = sp.csr_matrix((0, 0), dtype=np.float32)
        self.feature_keys: list[tuple[str, str]] = []
        self._group_slices: dict[str, slice] = {}
        self._user_pos: dict[str, int] = {}
        self._profiles: np.ndarray = np.zeros((0, 0), dtype=np.float32)
        self._blocked: dict[str, dict[str, set[str]]] = {}
        self.onboarded_customers: set[str] = set()

    # ── Huấn luyện ───────────────────────────────────────────────────────

    def fit(
        self,
        features: pd.DataFrame,
        interactions: pd.DataFrame | None = None,
        signals: pd.DataFrame | None = None,
    ) -> "ContentBasedModel":
        """features    : ProductID + FEATURE_GROUPS (+ CatalogSold nếu có)
        interactions: CustomerID, ProductID, Weight — trọng số đã giảm theo thời gian
        signals     : CustomerID, Dimension, Value, Polarity (1 thích / -1 không quan tâm)
        """
        missing = [c for c in ("ProductID", *FEATURE_GROUPS) if c not in features.columns]
        if missing:
            raise ValueError(f"Thiếu cột đặc trưng: {missing}")

        # Thứ tự món cố định theo ProductID: cùng dữ liệu vào thì cùng chỉ số,
        # không phụ thuộc thứ tự ClickHouse trả về.
        feats = (
            features.assign(ProductID=features["ProductID"].astype(str))
            .drop_duplicates("ProductID")
            .sort_values("ProductID", kind="stable")
            .reset_index(drop=True)
        )
        self.item_ids = pd.Index(feats["ProductID"], dtype="string")
        item_pos = {pid: i for i, pid in enumerate(self.item_ids)}
        n_items = len(self.item_ids)
        self.catalog_sold = (
            pd.to_numeric(feats["CatalogSold"], errors="coerce").fillna(0).to_numpy(np.float32)
            if "CatalogSold" in feats.columns else np.zeros(n_items, dtype=np.float32)
        )

        # One-hot: mỗi món đúng 1 giá trị ở mỗi nhóm
        rows, cols, offset = [], [], 0
        self.feature_keys, self._group_slices, self.item_values = [], {}, {}
        for g in FEATURE_GROUPS:
            vals = feats[g].astype(str).to_numpy()
            vocab = np.unique(vals)
            rows.append(np.arange(n_items))
            cols.append(np.searchsorted(vocab, vals) + offset)
            self.item_values[g] = vals
            self.feature_keys.extend((g, str(v)) for v in vocab)
            self._group_slices[g] = slice(offset, offset + len(vocab))
            offset += len(vocab)
        feature_pos = {k: i for i, k in enumerate(self.feature_keys)}
        self.X = sp.csr_matrix(
            (np.ones(n_items * len(FEATURE_GROUPS), dtype=np.float32),
             (np.concatenate(rows) if rows else [], np.concatenate(cols) if cols else [])),
            shape=(n_items, offset),
        )

        # Lịch sử mua: chỉ giữ món có đặc trưng (món ngừng bán thì không có)
        inter = pd.DataFrame(columns=["CustomerID", "ProductID", "Weight"])
        if interactions is not None and not interactions.empty:
            inter = interactions.assign(
                CustomerID=interactions["CustomerID"].astype(str),
                ProductID=interactions["ProductID"].astype(str),
            )
            inter = inter[inter["ProductID"].isin(item_pos) & (inter["Weight"] > 0)]

        sig = pd.DataFrame(columns=["CustomerID", "Dimension", "Value", "Polarity"])
        if signals is not None and not signals.empty:
            sig = signals.assign(
                CustomerID=signals["CustomerID"].astype(str),
                Value=signals["Value"].astype(str),
                Polarity=pd.to_numeric(signals["Polarity"], errors="coerce"),
            )
            sig = sig[sig["Dimension"].isin(SIGNAL_DIMENSION_TO_GROUP)]

        users = sorted(set(inter["CustomerID"]) | set(sig["CustomerID"]))
        self._user_pos = {u: i for i, u in enumerate(users)}
        n_users = len(users)

        mass = np.zeros((n_users, offset), dtype=np.float32)
        if len(inter):
            R = sp.csr_matrix(
                (inter["Weight"].to_numpy(np.float32),
                 (inter["CustomerID"].map(self._user_pos).to_numpy(),
                  inter["ProductID"].map(item_pos).to_numpy())),
                shape=(n_users, n_items),
            )
            mass += (R @ self.X).toarray()

        self._blocked = {}
        self.onboarded_customers = set(sig["CustomerID"])
        for row in sig.itertuples(index=False):
            group = SIGNAL_DIMENSION_TO_GROUP[row.Dimension]
            if row.Polarity > 0:
                f = feature_pos.get((group, row.Value))
                # Giá trị khách thích nhưng không món ứng viên nào mang (vd. hãng
                # chỉ còn hàng ngừng bán) thì không có cột để cộng — bỏ qua.
                if f is not None:
                    mass[self._user_pos[row.CustomerID], f] += self.onboarding_pseudo_count
            elif row.Polarity < 0 and group in BLOCKABLE_GROUPS:
                self._blocked.setdefault(row.CustomerID, {}).setdefault(group, set()).add(row.Value)

        # Chuẩn hoá từng nhóm thành phân phối, rồi nhân trọng số nhóm
        total_w = sum(self.group_weights.values()) or 1.0
        self._profiles = np.zeros_like(mass)
        for g, sl in self._group_slices.items():
            block = mass[:, sl]
            s = block.sum(axis=1, keepdims=True)
            np.divide(block, s, out=self._profiles[:, sl], where=s > 0)
            self._profiles[:, sl] *= self.group_weights[g] / total_w
        return self

    # ── Suy luận ─────────────────────────────────────────────────────────

    def has_profile(self, customer_id: str) -> bool:
        pos = self._user_pos.get(str(customer_id))
        return pos is not None and bool(self._profiles[pos].any())

    def score(self, customer_id: str) -> np.ndarray:
        """Điểm nội dung của mọi món ứng viên, theo thứ tự item_ids. Khách lạ -> 0."""
        pos = self._user_pos.get(str(customer_id))
        if pos is None:
            return np.zeros(len(self.item_ids), dtype=np.float32)
        return np.asarray(self.X @ self._profiles[pos], dtype=np.float32).ravel()

    def blocked_mask(self, customer_id: str) -> np.ndarray:
        """True ở món thuộc danh mục/hãng khách đã chọn "không quan tâm"."""
        mask = np.zeros(len(self.item_ids), dtype=bool)
        for group, values in self._blocked.get(str(customer_id), {}).items():
            mask |= np.isin(self.item_values[group], list(values))
        return mask

    def summary(self) -> dict[str, int]:
        return {
            "candidates": len(self.item_ids),
            "features": len(self.feature_keys),
            "profiles": len(self._user_pos),
            "onboarded_customers": len(self.onboarded_customers),
        }
