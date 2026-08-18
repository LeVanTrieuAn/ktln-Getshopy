/**
 * COLLABORATIVE FILTERING — Lọc cộng tác (Gợi ý sản phẩm)
 * ==========================================================
 * @description
 *   Dựa trên hành vi của nhiều người dùng để gợi ý sản phẩm.
 *   Thuật toán: Item-based Collaborative Filtering.
 *
 *   Ý tưởng cốt lõi:
 *     "Những khách hàng mua sản phẩm A và B cùng nhau → A và B CÓ LIÊN QUAN"
 *     "Anh/chị vừa xem iPhone 15 → Gợi ý AirPods và ốp lưng vì
 *      70% khách mua iPhone 15 thường mua kèm 2 sản phẩm này"
 *
 *   Cách xây dựng ma trận liên quan:
 *     1. Quét toàn bộ đơn hàng trong Database
 *     2. Với mỗi đơn hàng, tất cả cặp sản phẩm (i, j) trong đơn → co-occurrence++
 *     3. Normalize: relatedness(i, j) = co_count(i,j) / sqrt(count(i) × count(j))
 *        [Jaccard-like normalization để tránh bias sản phẩm bán chạy]
 *
 *   Use-case:
 *     - "Khách mua iPhone thường mua kèm AirPods và ốp lưng"
 *     - Hiển thị "Khách hàng thường mua cùng..." trong product detail
 *     - Thay thế logic gợi ý đơn giản trong GET /b2c/recommendations
 *
 * @author Getshopy AI Team
 */

'use strict';

class CollaborativeFilter {
  constructor() {
    /**
     * Ma trận co-occurrence: coMatrix[idA][idB] = số lần A và B mua cùng nhau
     * @type {Map<string, Map<string, number>>}
     */
    this.coMatrix = new Map();

    /**
     * Số lần mỗi sản phẩm được mua (để normalize)
     * @type {Map<string, number>}
     */
    this.itemCounts = new Map();

    /** Cờ đã build chưa */
    this._built = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // XÂY DỰNG MA TRẬN
  // ─────────────────────────────────────────────────────────────────

  /**
   * Xây dựng ma trận co-occurrence từ lịch sử đơn hàng.
   * Mỗi order là một mảng product IDs.
   *
   * @param {Array<{items: Array<{product_id?: number|string, id?: number|string}>}>} orders
   *   Danh sách đơn hàng từ Database (mảng các order, mỗi order có items)
   */
  buildFromOrders(orders) {
    if (!orders || orders.length === 0) {
      console.warn('[CollabFilter] Không có dữ liệu đơn hàng để build!');
      return;
    }

    this.coMatrix   = new Map();
    this.itemCounts = new Map();

    let processedOrders = 0;

    orders.forEach(order => {
      // Trích xuất product IDs từ đơn hàng (hỗ trợ cả product_id và id)
      const items = Array.isArray(order.items) ? order.items : [];
      const productIds = items
        .map(item => String(item.product_id || item.id || item.productId))
        .filter(id => id && id !== 'undefined');

      if (productIds.length === 0) return;
      processedOrders++;

      // Cập nhật item counts
      productIds.forEach(id => {
        this.itemCounts.set(id, (this.itemCounts.get(id) || 0) + 1);
      });

      // Cập nhật co-occurrence (tất cả cặp trong đơn hàng)
      for (let i = 0; i < productIds.length; i++) {
        for (let j = i + 1; j < productIds.length; j++) {
          const idA = productIds[i];
          const idB = productIds[j];

          // Cập nhật A → B
          if (!this.coMatrix.has(idA)) this.coMatrix.set(idA, new Map());
          this.coMatrix.get(idA).set(idB, (this.coMatrix.get(idA).get(idB) || 0) + 1);

          // Cập nhật B → A (ma trận đối xứng)
          if (!this.coMatrix.has(idB)) this.coMatrix.set(idB, new Map());
          this.coMatrix.get(idB).set(idA, (this.coMatrix.get(idB).get(idA) || 0) + 1);
        }
      }
    });

    this._built = true;
    console.log(`[CollabFilter] ✅ Build xong: ${processedOrders} đơn hàng | ${this.itemCounts.size} sản phẩm | ${this.coMatrix.size} item relations`);
  }

  // ─────────────────────────────────────────────────────────────────
  // GỢI Ý SẢN PHẨM
  // ─────────────────────────────────────────────────────────────────

  /**
   * Tính "relatedness score" giữa 2 sản phẩm.
   * Dùng normalized co-occurrence (tương tự Jaccard Index).
   *
   * @param {string} idA
   * @param {string} idB
   * @returns {number} - Score ∈ [0, 1]
   */
  _relatednessScore(idA, idB) {
    const coCount = this.coMatrix.get(idA)?.get(idB) || 0;
    if (coCount === 0) return 0;

    const countA = this.itemCounts.get(idA) || 1;
    const countB = this.itemCounts.get(idB) || 1;

    // Normalized: tránh bias sản phẩm bán chạy
    return coCount / Math.sqrt(countA * countB);
  }

  /**
   * Gợi ý các sản phẩm thường mua kèm với sản phẩm đã cho.
   *
   * @example
   *   // Khách đang xem iPhone 15 (id=42)
   *   cf.recommend(42, { topN: 3 })
   *   // → [{ productId: '7', score: 0.85 }, { productId: '12', score: 0.72 }]
   *   // "Khách mua iPhone 15 thường mua kèm AirPods (id=7) và ốp lưng (id=12)"
   *
   * @param {string|number}  productId  - ID sản phẩm hiện tại
   * @param {Object}         [opts]
   * @param {number}         [opts.topN=3]     - Số sản phẩm gợi ý
   * @param {number}         [opts.minScore=0] - Ngưỡng score tối thiểu
   * @param {string[]}       [opts.exclude=[]] - IDs cần loại trừ (đã có trong giỏ hàng)
   * @returns {Array<{productId: string, score: number}>}
   */
  recommend(productId, { topN = 3, minScore = 0, exclude = [] } = {}) {
    if (!this._built) return [];

    const targetId  = String(productId);
    const coRow     = this.coMatrix.get(targetId);
    if (!coRow)     return [];

    const excludeSet = new Set(exclude.map(String));
    excludeSet.add(targetId);

    const results = [];
    for (const [relatedId, coCount] of coRow.entries()) {
      if (excludeSet.has(relatedId)) continue;

      const score = this._relatednessScore(targetId, relatedId);
      if (score >= minScore) {
        results.push({ productId: relatedId, score, coCount });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topN);
  }

  /**
   * Gợi ý dựa trên NHIỀU sản phẩm trong giỏ hàng / lịch sử.
   * Tổng hợp gợi ý từ nhiều sản phẩm, tránh duplicate.
   *
   * @param {Array<string|number>} productIds - Danh sách IDs đã mua/xem
   * @param {Object} [opts]
   * @returns {Array<{productId: string, score: number}>}
   */
  recommendFromMultiple(productIds, { topN = 5 } = {}) {
    if (!this._built || !productIds.length) return [];

    const scoreMap  = new Map();
    const excludeSet = new Set(productIds.map(String));

    productIds.forEach(pid => {
      const recs = this.recommend(pid, { topN: 10, exclude: productIds });
      recs.forEach(({ productId, score }) => {
        scoreMap.set(productId, (scoreMap.get(productId) || 0) + score);
      });
    });

    const results = Array.from(scoreMap.entries())
      .filter(([id]) => !excludeSet.has(id))
      .map(([productId, score]) => ({ productId, score }))
      .sort((a, b) => b.score - a.score);

    return results.slice(0, topN);
  }

  /**
   * Tổng kết thống kê ma trận để debug / báo cáo.
   * @returns {Object}
   */
  getStats() {
    const totalRelations = Array.from(this.coMatrix.values())
      .reduce((sum, row) => sum + row.size, 0);

    return {
      totalProducts:   this.itemCounts.size,
      totalRelations:  totalRelations / 2, // chia 2 vì ma trận đối xứng
      avgRelationsPerProduct: this.itemCounts.size > 0
        ? (totalRelations / this.itemCounts.size).toFixed(1)
        : 0,
      isBuilt: this._built,
    };
  }
}

/** Singleton */
let _instance = null;
function getCollaborativeFilter() {
  if (!_instance) _instance = new CollaborativeFilter();
  return _instance;
}

module.exports = CollaborativeFilter;
module.exports.getCollaborativeFilter = getCollaborativeFilter;
