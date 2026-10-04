"""Item-based collaborative filtering with reproducible model persistence and scalable sparse computation."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.preprocessing import normalize

from config import (
    CUSTOMERS_DATA_PATH,
    MODEL_PATH,
    ORDERS_DATA_PATH,
    PROCESSED_DATA_PATH,
    PRODUCTS_DATA_PATH,
    RAW_DATA_PATH,
)
from models.behavior import BehaviorConfig, signal_weights


class SparseUserItemMatrix:
    """Memory-efficient sparse user-item interaction matrix with DataFrame-like indexing."""

    def __init__(self, mat: sp.csr_matrix, user_ids: pd.Index, item_ids: pd.Index) -> None:
        self.mat = mat.tocsr()
        self.index = pd.Index(user_ids.astype(str), dtype="string")
        self.columns = pd.Index(item_ids.astype(str), dtype="string")
        self._user_map = {uid: idx for idx, uid in enumerate(self.index)}
        self._item_map = {iid: idx for idx, iid in enumerate(self.columns)}

    @property
    def shape(self) -> tuple[int, int]:
        return (len(self.index), len(self.columns))

    def __len__(self) -> int:
        return len(self.index)

    def __contains__(self, item: Any) -> bool:
        return str(item) in self._user_map

    def get_purchased_products(self, customer_id: str) -> list[str]:
        """Return a list of ProductIDs that the customer has interacted with."""
        idx = self._user_map.get(str(customer_id))
        if idx is None:
            return []
        row = self.mat[idx]
        return self.columns[row.indices].tolist()

    def get_weights(self, customer_id: str, product_ids: list[str]) -> pd.Series:
        """Extract interaction weights (e.g. quantity) for specified products."""
        idx = self._user_map.get(str(customer_id))
        if idx is None:
            return pd.Series(0.0, index=product_ids, dtype=float)
        row = self.mat[idx].tocsr()
        col_indices = [self._item_map.get(str(pid)) for pid in product_ids]
        vals = [float(row[0, c]) if c is not None else 0.0 for c in col_indices]
        return pd.Series(vals, index=product_ids, dtype=float)

    class _LocIndexer:
        def __init__(self, parent: "SparseUserItemMatrix") -> None:
            self.p = parent

        def __getitem__(self, key: Any) -> Any:
            if isinstance(key, tuple):
                cust, items = key
                if isinstance(items, (list, tuple, pd.Index, set)):
                    return self.p.get_weights(cust, list(items))
                item_idx = self.p._item_map.get(str(items))
                cust_idx = self.p._user_map.get(str(cust))
                if cust_idx is None or item_idx is None:
                    return 0.0
                return float(self.p.mat[cust_idx, item_idx])
            else:
                cust_idx = self.p._user_map.get(str(key))
                if cust_idx is None:
                    return pd.Series(0.0, index=self.p.columns, dtype=float)
                row = self.p.mat[cust_idx].toarray().flatten()
                return pd.Series(row, index=self.p.columns, dtype=float)

    @property
    def loc(self) -> _LocIndexer:
        return self._LocIndexer(self)

    def __gt__(self, other: Any) -> Any:
        class _SumWrapper:
            def __init__(self, nnz: int) -> None:
                self.nnz = nnz

            def sum(self, *args: Any, **kwargs: Any) -> "_SumWrapper":
                return self

            def __int__(self) -> int:
                return self.nnz

        return _SumWrapper(self.mat.nnz)


class ItemSimilarityMatrix:
    """Item cosine similarity matrix computed on-the-fly via normalized sparse representations."""

    def __init__(self, item_user_norm: sp.csr_matrix, item_ids: pd.Index) -> None:
        self.item_user_norm = item_user_norm.tocsr()
        self.index = pd.Index(item_ids.astype(str), dtype="string")
        self.columns = self.index
        self._item_map = {iid: idx for idx, iid in enumerate(self.index)}

    @property
    def shape(self) -> tuple[int, int]:
        return (len(self.index), len(self.columns))

    def __len__(self) -> int:
        return len(self.index)

    def __contains__(self, item: Any) -> bool:
        return str(item) in self._item_map

    def compute_scores(self, purchased: list[str], weights: pd.Series | np.ndarray) -> pd.Series:
        """Compute item scores: sum(w_p * sim(:, p)) across purchased items."""
        if not purchased:
            return pd.Series(0.0, index=self.index, dtype=float)

        valid_indices: list[int] = []
        valid_weights: list[float] = []
        for p in purchased:
            p_str = str(p)
            if p_str in self._item_map:
                valid_indices.append(self._item_map[p_str])
                w = float(weights[p]) if isinstance(weights, pd.Series) else float(weights)
                valid_weights.append(w)

        if not valid_indices:
            return pd.Series(0.0, index=self.index, dtype=float)

        w_arr = np.array(valid_weights, dtype=np.float32)
        q = self.item_user_norm[valid_indices].T.dot(w_arr)
        scores = self.item_user_norm.dot(q)
        return pd.Series(scores, index=self.index, dtype=float)

    class _SimilarityColumnSelector:
        def __init__(self, parent: "ItemSimilarityMatrix", purchased: list[str]) -> None:
            self.parent = parent
            self.purchased = list(purchased)

        def mul(self, weights: Any, axis: int = 1) -> Any:
            class _MulResult:
                def __init__(self, parent: "ItemSimilarityMatrix", purchased: list[str], w: Any) -> None:
                    self.parent = parent
                    self.purchased = purchased
                    self.weights = w

                def sum(self, axis: int = 1) -> pd.Series:
                    return self.parent.compute_scores(self.purchased, self.weights)

            return _MulResult(self.parent, self.purchased, weights)

    class _LocIndexer:
        def __init__(self, parent: "ItemSimilarityMatrix") -> None:
            self.parent = parent

        def __getitem__(self, key: Any) -> Any:
            if isinstance(key, tuple) and len(key) == 2:
                row_key, col_key = key
                if row_key == slice(None) and isinstance(col_key, (list, tuple, pd.Index, set)):
                    return self.parent._SimilarityColumnSelector(self.parent, list(col_key))
            raise NotImplementedError("Only loc[:, purchased] is supported for similarity access.")

    @property
    def loc(self) -> _LocIndexer:
        return self._LocIndexer(self)


INPUT_SCALES = ("linear", "log")


class CollaborativeFiltering:
    """Recommend unseen products from item-item cosine similarity."""

    def __init__(
        self,
        model_path: Path | str = MODEL_PATH,
        half_life_days: float | None = None,
        input_scale: str | None = None,
    ) -> None:
        # ======================================================================
        # Khởi tạo các thuộc tính mô hình
        # ======================================================================
        self.model_path = Path(model_path)
        # None = lấy theo config LÚC FIT (đổi biến môi trường rồi train lại là
        # có hiệu lực). Truyền tường minh khi cần nhiều cấu hình trong một tiến
        # trình — benchmark quét lưới half-life/thang trên validation.
        self.half_life_days = half_life_days
        self.input_scale = input_scale
        if input_scale is not None and input_scale not in INPUT_SCALES:
            raise ValueError(f"input_scale phải thuộc {INPUT_SCALES}, nhận: {input_scale!r}")
        self.df: pd.DataFrame | None = None
        self.user_item_matrix: SparseUserItemMatrix | pd.DataFrame | None = None
        self.profile_matrix: SparseUserItemMatrix | None = None
        self.behavior = BehaviorConfig()
        self.behavior_pairs = 0
        self.item_similarity: ItemSimilarityMatrix | pd.DataFrame | None = None
        self.product_metadata: pd.DataFrame | None = None
        self.customer_metadata: pd.DataFrame | None = None
        self.popular_items: pd.Series | None = None

    def load_dataset(
        self,
        path: Path | str | None = None,
        products_path: Path | str | None = None,
        customers_path: Path | str | None = None,
    ) -> pd.DataFrame:
        # ======================================================================
        # Nạp dữ liệu đơn hàng và metadata sản phẩm / khách hàng từ thư mục data/raw
        # ======================================================================
        data_path = Path(path) if path else (
            ORDERS_DATA_PATH if ORDERS_DATA_PATH.exists()
            else (PROCESSED_DATA_PATH if PROCESSED_DATA_PATH.exists() else RAW_DATA_PATH)
        )
        if not data_path.exists():
            raise FileNotFoundError(f"Data file not found at: {data_path}")

        prod_path = Path(products_path) if products_path else PRODUCTS_DATA_PATH
        if prod_path.exists():
            prod_df = pd.read_csv(prod_path, dtype={"ProductID": "string"})
            if "ProductID" in prod_df.columns:
                self.product_metadata = prod_df.drop_duplicates("ProductID").set_index("ProductID")

        cust_path = Path(customers_path) if customers_path else CUSTOMERS_DATA_PATH
        if cust_path.exists():
            cust_df = pd.read_csv(cust_path, dtype={"CustomerID": "string"})
            if "CustomerID" in cust_df.columns:
                self.customer_metadata = cust_df.drop_duplicates("CustomerID").set_index("CustomerID")

        # Đọc dữ liệu đơn hàng / tương tác giao dịch
        self.df = pd.read_csv(data_path, dtype={"CustomerID": "string", "ProductID": "string"})
        return self.df

    def resolved_half_life(self) -> float:
        """Half-life thực dùng: tham số của model, không có thì theo config."""
        if self.half_life_days is not None:
            return float(self.half_life_days)
        from config import RECENCY_HALF_LIFE_DAYS
        return float(RECENCY_HALF_LIFE_DAYS)

    def resolved_input_scale(self) -> str:
        if self.input_scale is not None:
            return self.input_scale
        from config import CF_INPUT_SCALE
        if CF_INPUT_SCALE not in INPUT_SCALES:
            raise ValueError(f"CF_INPUT_SCALE phải thuộc {INPUT_SCALES}, nhận: {CF_INPUT_SCALE!r}")
        return CF_INPUT_SCALE

    @staticmethod
    def _apply_recency(df: pd.DataFrame, half_life: float) -> pd.DataFrame:
        """Giảm trọng số tương tác theo thời gian: w = Quantity * 0.5^(ngày/half_life).

        Không có cột DaysSince, hoặc half-life <= 0, thì trả nguyên df — hành vi
        cũ. Nhờ vậy tắt tính năng chỉ cần đặt RECENCY_HALF_LIFE_DAYS=0, không
        phải sửa code.

        Ghi vào chính cột Quantity chứ không thêm cột mới: toàn bộ đường dựng
        ma trận, tính độ phổ biến và metadata phía sau đều đọc "Quantity", thêm
        cột thứ hai là mở đường cho hai chỗ dùng hai giá trị khác nhau.
        """
        if half_life <= 0 or "DaysSince" not in df.columns:
            return df

        out = df.copy()
        days = pd.to_numeric(out["DaysSince"], errors="coerce").fillna(0).clip(lower=0)
        out["Quantity"] = out["Quantity"].astype("float32") * (0.5 ** (days / half_life))
        return out

    @staticmethod
    def _create_user_item_matrix(
        df: pd.DataFrame, half_life: float, input_scale: str = "linear",
    ) -> SparseUserItemMatrix:
        # ======================================================================
        # Tạo ma trận User-Item dạng Sparse CSR hiệu năng cao
        # ======================================================================
        df = CollaborativeFiltering._apply_recency(df, half_life)
        pairs = df.assign(Weight=df["Quantity"])[["CustomerID", "ProductID", "Weight"]]
        return CollaborativeFiltering._matrix_from_pairs(pairs, input_scale)

    @staticmethod
    def _create_profile_matrix(
        df: pd.DataFrame, signals: pd.DataFrame, half_life: float, input_scale: str,
    ) -> SparseUserItemMatrix:
        """Ma trận HỒ SƠ = trọng số mua (đã giảm theo thời gian) + tín hiệu hành vi phụ,
        cộng ở thang tuyến tính RỒI mới áp thang (log) — cùng cách với ma trận mua."""
        bought = CollaborativeFiltering._apply_recency(df, half_life)
        pairs = pd.concat([
            bought.assign(Weight=bought["Quantity"])[["CustomerID", "ProductID", "Weight"]],
            signals[["CustomerID", "ProductID", "Weight"]],
        ], ignore_index=True)
        return CollaborativeFiltering._matrix_from_pairs(pairs, input_scale)

    @staticmethod
    def _matrix_from_pairs(pairs: pd.DataFrame, input_scale: str) -> SparseUserItemMatrix:
        """(CustomerID, ProductID, Weight) -> ma trận thưa khách x món, cộng dồn theo cặp."""
        interactions = (
            pairs.assign(CustomerID=pairs["CustomerID"].astype(str), ProductID=pairs["ProductID"].astype(str))
            .groupby(["CustomerID", "ProductID"], as_index=False)["Weight"]
            .sum()
            .sort_values(["CustomerID", "ProductID"], kind="stable")
            .reset_index(drop=True)
        )

        user_ids = pd.Index(np.sort(interactions["CustomerID"].unique()), dtype="string")
        item_ids = pd.Index(np.sort(interactions["ProductID"].unique()), dtype="string")

        user_map = pd.Series(np.arange(len(user_ids)), index=user_ids)
        item_map = pd.Series(np.arange(len(item_ids)), index=item_ids)

        row_indices = user_map.loc[interactions["CustomerID"]].to_numpy()
        col_indices = item_map.loc[interactions["ProductID"]].to_numpy()
        values = interactions["Weight"].to_numpy(dtype=np.float32)
        if input_scale == "log":
            # Thang log (Hu et al., 2008): món mua 10 cái không nặng gấp 10 món
            # mua 1 cái — số lượng lớn làm vector món lệch hẳn về vài khách mua sỉ.
            # Vẫn dương với mọi giá trị > 0, nên cosine và tập món đã mua giữ nguyên.
            values = np.log1p(values).astype(np.float32)

        mat = sp.csr_matrix(
            (values, (row_indices, col_indices)),
            shape=(len(user_ids), len(item_ids)),
            dtype=np.float32,
        )
        return SparseUserItemMatrix(mat, user_ids, item_ids)

    @staticmethod
    def _create_product_metadata(df: pd.DataFrame) -> pd.DataFrame:
        # ======================================================================
        # Trích xuất metadata sản phẩm từ bảng dữ liệu đơn hàng
        # ======================================================================
        metadata_cols = [
            c for c in [
                "ProductName", "Category", "Subcategory", "Brand",
                "ProductType", "ProductDescription", "FeatureTags", "UnitPrice"
            ] if c in df.columns
        ]
        sort_cols = [c for c in ["InvoiceDate", "InvoiceNo"] if c in df.columns]
        prepared = df.sort_values(sort_cols, kind="stable") if sort_cols else df
        return (
            prepared.drop_duplicates("ProductID", keep="last")
            .set_index("ProductID")
            .loc[:, metadata_cols]
        )

    @staticmethod
    def _create_customer_metadata(df: pd.DataFrame) -> pd.DataFrame:
        # ======================================================================
        # Trích xuất metadata khách hàng từ bảng dữ liệu đơn hàng
        # ======================================================================
        metadata_cols = [
            c for c in [
                "CustomerName", "CustomerSegment", "ShoppingNeed",
                "PreferredCategories", "BudgetTier", "PurchasePropensity"
            ] if c in df.columns
        ]
        if not metadata_cols:
            return pd.DataFrame(index=df["CustomerID"].drop_duplicates().astype(str))
        sort_cols = [c for c in ["InvoiceDate", "InvoiceNo"] if c in df.columns]
        prepared = df.sort_values(sort_cols, kind="stable") if sort_cols else df
        return (
            prepared.drop_duplicates("CustomerID", keep="last")
            .set_index("CustomerID")
            .loc[:, metadata_cols]
        )

    def fit(
        self,
        train_df: pd.DataFrame,
        behavior: pd.DataFrame | None = None,
        behavior_cfg: BehaviorConfig | None = None,
    ) -> "CollaborativeFiltering":
        # ======================================================================
        # Huấn luyện mô hình Item-based Collaborative Filtering trên tập dữ liệu
        #
        # behavior (tuỳ chọn): tín hiệu hành vi theo cặp (khách, món) — các cột của
        # serving.customer_product_events (models/behavior.py). Chỉ đi vào ma trận
        # HỒ SƠ; tập "đã mua" vẫn chỉ từ đơn.
        # ======================================================================
        if train_df.empty:
            raise ValueError("Cannot train on an empty dataframe.")

        required_cols = {"CustomerID", "ProductID", "Quantity"}
        missing_cols = required_cols.difference(train_df.columns)
        if missing_cols:
            raise ValueError(f"Dữ liệu train thiếu cột bắt buộc: {', '.join(sorted(missing_cols))}")

        # Làm sạch các dòng thiếu ID hoặc Quantity <= 0
        cleaned = train_df.dropna(subset=["CustomerID", "ProductID", "Quantity"]).copy()
        cleaned = cleaned[cleaned["Quantity"] > 0]
        if cleaned.empty:
            raise ValueError("Không còn bản ghi hợp lệ sau khi lọc Quantity > 0.")

        # Chốt cấu hình ngay lúc fit: bản đã train mang theo đúng half-life/thang
        # nó được dựng, không đổi theo biến môi trường về sau.
        half_life = self.half_life_days = self.resolved_half_life()
        self.input_scale = self.resolved_input_scale()

        # 1. Ma trận MUA (khách x món): tập đã mua, kênh mua lại dự phòng, hồ sơ content-based
        self.user_item_matrix = self._create_user_item_matrix(cleaned, half_life, self.input_scale)
        if self.user_item_matrix.shape[1] < 2:
            raise ValueError("Need at least two products to train collaborative filtering.")

        # 1b. Ma trận HỒ SƠ = mua + hành vi phụ. Tắt hành vi thì chính là ma trận mua,
        #     nên mọi kết quả giữ nguyên như trước khi có tính năng này.
        self.behavior = behavior_cfg or BehaviorConfig()
        signals = signal_weights(behavior, self.behavior, half_life, set(self.user_item_matrix.columns))
        self.behavior_pairs = int(len(signals))
        self.profile_matrix = (
            self._create_profile_matrix(cleaned, signals, half_life, self.input_scale)
            if len(signals) else self.user_item_matrix
        )

        # 2. Chuẩn hóa vector item (trên ma trận HỒ SƠ) để tính cosine similarity
        item_user = self.profile_matrix.mat.T.tocsr()
        item_user_norm = normalize(item_user, norm="l2", axis=1)
        self.item_similarity = ItemSimilarityMatrix(item_user_norm, self.profile_matrix.columns)

        # 3. Trích xuất hoặc cập nhật metadata sản phẩm, khách hàng và danh sách phổ biến
        if self.product_metadata is None:
            self.product_metadata = self._create_product_metadata(cleaned)
        if self.customer_metadata is None:
            self.customer_metadata = self._create_customer_metadata(cleaned)

        # 4. Tính toán độ phổ biến của từng item để làm cold-start fallback.
        #    Dùng CÙNG trọng số đã giảm theo thời gian: nếu không, khách mới vào
        #    vẫn được quảng bá món bán chạy từ năm ngoái.
        #    Độ phổ biến luôn ở thang tuyến tính: nó đo sản lượng, không phải sở thích.
        interactions = self._apply_recency(cleaned, half_life).groupby("ProductID")["Quantity"].sum()
        self.popular_items = interactions.reindex(
            self.user_item_matrix.columns, fill_value=0.0
        ).sort_values(ascending=False)

        self.df = train_df.copy()
        return self

    def train(self) -> "CollaborativeFiltering":
        # ======================================================================
        # Nạp toàn bộ dữ liệu mặc định từ data/raw và tiến hành huấn luyện
        # ======================================================================
        return self.fit(self.load_dataset())

    def _ensure_fitted(self) -> None:
        # ======================================================================
        # Kiểm tra xem mô hình đã được fit / load trước khi gọi dự đoán
        # ======================================================================
        if self.user_item_matrix is None or self.item_similarity is None:
            raise RuntimeError("Model is not fitted. Call fit(), train(), or load_model() first.")

    def get_purchased_products(self, customer_id: str) -> list[str]:
        # ======================================================================
        # Lấy danh sách ProductID mà khách hàng đã từng mua trong quá khứ
        # ======================================================================
        self._ensure_fitted()
        assert self.user_item_matrix is not None
        if isinstance(self.user_item_matrix, SparseUserItemMatrix):
            return self.user_item_matrix.get_purchased_products(customer_id)
        if customer_id not in self.user_item_matrix.index:
            return []
        interactions = self.user_item_matrix.loc[customer_id]
        return interactions.loc[interactions > 0].index.tolist()

    @property
    def profile(self) -> SparseUserItemMatrix:
        """Ma trận hồ sơ; model lưu trước khi có hành vi phụ thì là ma trận mua."""
        pm = getattr(self, "profile_matrix", None)
        return pm if pm is not None else self.user_item_matrix

    def has_product(self, product_id: str) -> bool:
        """Return whether a product exists in the model's training catalog."""
        self._ensure_fitted()
        assert self.item_similarity is not None
        return product_id in self.item_similarity.index

    def recommend(self, customer_id: str, top_k: int = 10) -> list[tuple[str, float]]:
        # ======================================================================
        # Gợi ý top_k sản phẩm chưa từng mua dựa trên Item Cosine Similarity
        # ======================================================================
        if top_k < 1:
            raise ValueError("top_k must be at least 1.")
        self._ensure_fitted()
        assert self.user_item_matrix is not None
        assert self.item_similarity is not None
        assert self.popular_items is not None

        # 1. Lịch sử MUA (để loại) và HỒ SƠ (mua + hành vi phụ, để chấm điểm)
        purchased = self.get_purchased_products(customer_id)
        profile = self.profile
        if isinstance(profile, SparseUserItemMatrix):
            profile_items = profile.get_purchased_products(customer_id)
        else:
            profile_items = purchased

        # Xử lý Cold-Start: không có tín hiệu nào -> Gợi ý sản phẩm phổ biến nhất.
        # Khách chưa mua nhưng đã xem hàng vẫn đi đường CF nhờ hồ sơ hành vi.
        if not profile_items:
            return [
                (item, float(score))
                for item, score in self.popular_items.head(top_k).items()
            ]

        # 2. Tính điểm số (Score) dựa trên trọng số hồ sơ * độ tương đồng sản phẩm
        weights = profile.loc[customer_id, profile_items]
        if isinstance(self.item_similarity, ItemSimilarityMatrix):
            scores = self.item_similarity.compute_scores(profile_items, weights)
        else:
            scores = self.item_similarity.loc[:, profile_items].mul(weights, axis=1).sum(axis=1)

        # 3. Loại bỏ các sản phẩm khách hàng đã từng mua ra khỏi danh sách gợi ý
        scores = scores.drop(labels=purchased, errors="ignore")

        # 4. Sắp xếp giảm dần theo điểm số và lấy Top-K
        ranked = scores.sort_values(ascending=False, kind="stable").head(top_k)
        result = [(item, float(score)) for item, score in ranked.items()]

        # 5. Nếu chưa đủ top_k (do số lượng sản phẩm liên quan ít), bù bằng sản phẩm phổ biến
        if len(result) < top_k:
            excluded = set(purchased) | {item for item, _ in result}
            fallback = self.popular_items.loc[~self.popular_items.index.isin(excluded)].head(top_k - len(result))
            result.extend((item, float(score)) for item, score in fallback.items())

        return result

    def get_order_details(self, invoice_id: str) -> dict[str, object] | None:
        # ======================================================================
        # Lấy thông tin chi tiết đơn hàng từ mã InvoiceNo
        # ======================================================================
        if self.df is None:
            data_path = (
                ORDERS_DATA_PATH if ORDERS_DATA_PATH.exists()
                else (PROCESSED_DATA_PATH if PROCESSED_DATA_PATH.exists() else RAW_DATA_PATH)
            )
            if data_path.exists():
                self.df = pd.read_csv(data_path, dtype={"CustomerID": "string", "ProductID": "string"})

        if self.df is None or self.df.empty:
            return None

        order_df = self.df.loc[self.df["InvoiceNo"] == invoice_id]
        if order_df.empty:
            return None

        customer_id = str(order_df["CustomerID"].iloc[0])
        items = order_df.to_dict(orient="records")
        total_amount = sum(float(row.get("UnitPrice", 0)) * int(row.get("Quantity", 1)) for row in items)

        return {
            "invoice_id": invoice_id,
            "customer_id": customer_id,
            "items": items,
            "total_amount": total_amount,
        }

    def recommend_by_invoice(
        self, invoice_id: str, top_k: int = 10
    ) -> tuple[dict[str, object] | None, list[tuple[str, float]]]:
        # ======================================================================
        # Tra cứu đơn hàng và gợi ý sản phẩm dựa trên mô hình AI
        # ======================================================================
        order_info = self.get_order_details(invoice_id)
        if order_info is None:
            return None, []

        customer_id = str(order_info["customer_id"])
        recommendations = self.recommend(customer_id, top_k=top_k)
        return order_info, recommendations

    def product_details(self, product_id: str) -> dict[str, object]:
        # ======================================================================
        # Lấy thông tin chi tiết của 1 sản phẩm
        # ======================================================================
        if self.product_metadata is None or product_id not in self.product_metadata.index:
            return {}
        return self.product_metadata.loc[product_id].dropna().to_dict()

    def customer_details(self, customer_id: str) -> dict[str, object]:
        # ======================================================================
        # Lấy thông tin chi tiết của 1 khách hàng
        # ======================================================================
        if self.customer_metadata is None or customer_id not in self.customer_metadata.index:
            return {}
        return self.customer_metadata.loc[customer_id].dropna().to_dict()

    def save_model(self) -> Path:
        # ======================================================================
        # Đóng gói và lưu mô hình ra file .joblib
        # ======================================================================
        self._ensure_fitted()
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "format_version": 2,
            "user_item_matrix": self.user_item_matrix,
            "item_similarity": self.item_similarity,
            "product_metadata": self.product_metadata,
            "customer_metadata": self.customer_metadata,
            "popular_items": self.popular_items,
            "half_life_days": self.half_life_days,
            "input_scale": self.input_scale,
            # Hồ sơ trùng ma trận mua thì không lưu hai lần
            "profile_matrix": None if self.profile is self.user_item_matrix else self.profile_matrix,
            "behavior": asdict(self.behavior),
        }
        joblib.dump(payload, self.model_path, compress=3)
        return self.model_path

    def load_model(self) -> "CollaborativeFiltering":
        # ======================================================================
        # Nạp mô hình đã huấn luyện từ file đĩa .joblib
        # ======================================================================
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        payload = joblib.load(self.model_path)
        format_version = payload.get("format_version")
        if format_version not in {1, 2}:
            raise ValueError(f"Unsupported model artifact format: {format_version}")

        self.user_item_matrix = payload["user_item_matrix"]
        self.item_similarity = payload["item_similarity"]
        self.product_metadata = payload.get("product_metadata")
        self.customer_metadata = payload.get("customer_metadata")
        self.popular_items = payload["popular_items"]
        # Bản lưu trước khi có hai trường này được dựng với half-life của config
        # lúc đó và thang tuyến tính.
        self.half_life_days = payload.get("half_life_days", self.half_life_days)
        self.input_scale = payload.get("input_scale", "linear")
        self.profile_matrix = payload.get("profile_matrix")
        self.behavior = BehaviorConfig(**payload.get("behavior", {}))
        return self

    def summary(self) -> dict[str, int]:
        # ======================================================================
        # Trả về các thông số thống kê tổng quan của ma trận dữ liệu đã học
        # ======================================================================
        self._ensure_fitted()
        assert self.user_item_matrix is not None
        return {
            "customers": len(self.user_item_matrix.index),
            "products": len(self.user_item_matrix.columns),
            "interactions": int((self.user_item_matrix > 0).sum().sum()),
            # Ma trận hồ sơ (mua + hành vi phụ): bằng hai số trên khi tắt hành vi
            "profile_customers": len(self.profile.index),
            "profile_products": len(self.profile.columns),
            "behavior_pairs": int(getattr(self, "behavior_pairs", 0)),
        }
