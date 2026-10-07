"""Đối chứng mạnh cho Item-CF trong benchmark — KHÔNG dùng ở production.

EASE^R (Steck, 2019)
    P = (XᵀX + λI)⁻¹,  B = I − P · diag(1/diag(P))  (đường chéo B = 0),  điểm = X·B
iALS (Hu, Koren & Volinsky, 2008)
    min Σ_ui c_ui (p_ui − x_uᵀ y_i)² + λ (Σ‖x_u‖² + Σ‖y_i‖²),
    p_ui = 1[r_ui > 0],  c_ui = 1 + α·r_ui;  giải luân phiên bằng nghiệm đóng.

Cả hai dựng trên CHÍNH ma trận user–item của CF (đã giảm theo thời gian, cùng thang),
nên chênh lệch đo được chỉ đến từ mô hình, không từ dữ liệu vào. Siêu tham số chọn
trên validation như CF — so với đối chứng không tinh chỉnh là so lệch (Dacrema et
al., 2019).

Vì sao không đưa lên production: EASE phải nghịch đảo ma trận món × món DÀY (bộ nhớ
O(n²), thời gian O(n³) theo số món), còn iALS thêm siêu tham số và train lặp. Với
73 món trong catalog CF hiện tại thì cả hai đều rẻ, nên dùng được làm thước đo.

Tài liệu:
  Steck, H. (2019). Embarrassingly shallow autoencoders for sparse data. WWW '19.
  Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for implicit
    feedback datasets. ICDM '08.
  Dacrema, M. F., Cremonesi, P., & Jannach, D. (2019). Are we really making much
    progress? A worrying analysis of recent neural recommendation approaches. RecSys '19.
"""

from __future__ import annotations

import numpy as np

from models.cf_recommendation import CollaborativeFiltering


class _MatrixScorer:
    """Gợi ý món CHƯA mua theo một ma trận điểm khách × món; hoà thì theo độ phổ biến."""

    def __init__(self, cf: CollaborativeFiltering) -> None:
        uim = cf.user_item_matrix
        self.items = [str(c) for c in uim.columns]
        self.umap = uim._user_map
        self.X = uim.mat.toarray().astype(np.float64)
        pos = {p: i for i, p in enumerate(self.items)}
        self.popular = [str(p) for p in cf.popular_items.index]
        self.pop_rank = np.full(len(self.items), len(self.items), dtype=np.int64)
        for rank, p in enumerate(self.popular):
            if p in pos:
                self.pop_rank[pos[p]] = rank
        self.S = np.zeros_like(self.X)

    def recommend(self, customer_id: str, n: int) -> list[str]:
        idx = self.umap.get(str(customer_id))
        if idx is None:
            return self.popular[:n]
        s = self.S[idx].copy()
        bought = self.X[idx] > 0
        s[bought] = -np.inf
        order = np.lexsort((self.pop_rank, -s))
        out = [self.items[i] for i in order if np.isfinite(s[i])][:n]
        if len(out) < n:
            seen = set(out) | {self.items[i] for i in np.flatnonzero(bought)}
            out += [p for p in self.popular if p not in seen][: n - len(out)]
        return out


class EASE(_MatrixScorer):
    def __init__(self, cf: CollaborativeFiltering, lam: float) -> None:
        super().__init__(cf)
        G = self.X.T @ self.X + lam * np.eye(self.X.shape[1])
        P = np.linalg.inv(G)
        B = -P / np.diag(P)[None, :]
        np.fill_diagonal(B, 0.0)
        self.S = self.X @ B


class IALS(_MatrixScorer):
    def __init__(self, cf: CollaborativeFiltering, factors: int, alpha: float, reg: float,
                 iterations: int = 15, seed: int = 20260929) -> None:
        super().__init__(cf)
        X = self.X
        Pm = (X > 0).astype(np.float64)
        C = 1.0 + alpha * X
        n_u, n_i = X.shape
        rng = np.random.default_rng(seed)
        U = rng.normal(0.0, 0.01, (n_u, factors))
        V = rng.normal(0.0, 0.01, (n_i, factors))
        for _ in range(iterations):
            U = self._solve(V, C, Pm, reg)
            V = self._solve(U, C.T, Pm.T, reg)
        self.S = U @ V.T

    @staticmethod
    def _solve(Y: np.ndarray, C: np.ndarray, Pm: np.ndarray, reg: float) -> np.ndarray:
        """Nghiệm đóng cho MỌI hàng một lượt: (YᵀY + Yᵀ(Cᵤ − I)Y + λI) xᵤ = Yᵀ Cᵤ pᵤ.

        Chỉ ô có tương tác (c_ui ≠ 1) đóng góp vào Yᵀ(Cᵤ − I)Y — đúng mẹo tính của Hu et
        al. (2008) — nên cộng ngoại tích y_i y_iᵀ theo các ô đó thay vì duyệt cả ma trận
        dày. Cùng nghiệm; bản dày tốn khách × món × f² phép tính mỗi lượt.
        """
        f = Y.shape[1]
        rows, cols = np.nonzero(C != 1.0)
        w = C[rows, cols] - 1.0
        A = np.broadcast_to(Y.T @ Y + reg * np.eye(f), (C.shape[0], f, f)).copy()
        np.add.at(A, rows, Y[cols, :, None] * Y[cols, None, :] * w[:, None, None])
        b = (C * Pm) @ Y
        return np.linalg.solve(A, b[..., None])[..., 0]
