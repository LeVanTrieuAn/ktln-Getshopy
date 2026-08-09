/**
 * COSINE SIMILARITY — Tìm sản phẩm tương tự
 * ===========================================
 * @description
 *   Tìm sản phẩm "na ná" nhau trong catalog bằng cách đo góc giữa
 *   2 vector đặc trưng (feature vectors) của sản phẩm.
 *
 *   Công thức:
 *   ─────────────────────────────────────────────────────────────
 *   cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
 *
 *   Giá trị:
 *     = 1.0  → 2 sản phẩm GIỐNG NHAU HOÀN TOÀN (góc = 0°)
 *     = 0.0  → 2 sản phẩm KHÔNG LIÊN QUAN (góc = 90°)
 *     = -1.0 → 2 sản phẩm HOÀN TOÀN KHÁC (góc = 180°)
 *   ─────────────────────────────────────────────────────────────
 *
 *   Vector đặc trưng của mỗi sản phẩm được xây dựng từ:
 *     - TF-IDF của tên sản phẩm (mô tả ngắn)
 *     - TF-IDF của description
 *
 *   Use-case chính:
 *     Khách hỏi: "Bạn có mẫu nào na ná giống iPhone 15 nhưng rẻ hơn không?"
 *     → Tìm sản phẩm có vector gần nhất với iPhone 15, nhưng giá thấp hơn
 *
 * @author Getshopy AI Team
 */

'use strict';

const natural    = require('natural');
const Tokenizer  = require('./Tokenizer');

class CosineSimilarity {
  constructor() {
    this.tokenizer = new Tokenizer();
    /**
     * Cache product vectors: productId → vector (number[])
     * @type {Map<string|number, number[]>}
     */
    this._vectors  = new Map();
    /**
     * Cache product metadata: productId → { name, price, id }
     * @type {Map<string|number, Object>}
     */
    this._products = new Map();

    /** Bộ từ vựng dùng để build vector */
    this._vocabulary = new Map();
  }

  // ─────────────────────────────────────────────────────────────────
  // XÂY DỰNG CHỈ MỤC (INDEX)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Build vector index từ danh sách sản phẩm.
   * Gọi 1 lần khi server khởi động với toàn bộ products trong DB.
   *
   * @param {Array<{id: number|string, name: string, description?: string, price: number}>} products
   */
  buildIndex(products) {
    if (!products || products.length === 0) {
      console.warn('[CosineSim] Không có sản phẩm để build index!');
      return;
    }

    // Bước 1: Xây dựng vocabulary từ tất cả sản phẩm
    const vocabSet = new Set();
    products.forEach(p => {
      const text = this._productToText(p);
      this.tokenizer.tokenize(text).forEach(t => vocabSet.add(t));
    });

    Array.from(vocabSet).sort().forEach((word, i) => this._vocabulary.set(word, i));

    // Bước 2: Build TF-IDF vectorizer
    const tfidf = new natural.TfIdf();
    products.forEach(p => {
      const tokens = this.tokenizer.tokenize(this._productToText(p));
      tfidf.addDocument(tokens.join(' '));
    });

    // Bước 3: Build dense vector cho từng sản phẩm
    products.forEach((p, docIndex) => {
      const vector = new Array(this._vocabulary.size).fill(0);
      tfidf.listTerms(docIndex).forEach(item => {
        const idx = this._vocabulary.get(item.term);
        if (idx !== undefined) vector[idx] = item.tfidf;
      });

      this._vectors.set(String(p.id), vector);
      this._products.set(String(p.id), {
        id:    p.id,
        name:  p.name,
        price: p.price,
      });
    });

    console.log(`[CosineSim] Đã build index: ${products.length} sản phẩm | ${this._vocabulary.size} features`);
  }

  /**
   * Chuyển thông tin sản phẩm thành chuỗi văn bản để vector hóa.
   * @param {{name: string, description?: string}} product
   * @returns {string}
   */
  _productToText(product) {
    return [product.name, product.description || ''].join(' ').toLowerCase();
  }

  // ─────────────────────────────────────────────────────────────────
  // TÍNH COSINE SIMILARITY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Tính cosine similarity giữa 2 vector.
   * @param {number[]} vecA
   * @param {number[]} vecB
   * @returns {number} - Giá trị trong khoảng [0, 1]
   */
  _cosine(vecA, vecB) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dot   += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ─────────────────────────────────────────────────────────────────
  // TÌM SẢN PHẨM TƯƠNG TỰ
  // ─────────────────────────────────────────────────────────────────

  /**
   * Tìm N sản phẩm tương tự nhất với sản phẩm có ID cho trước.
   * Có thể lọc thêm theo giá.
   *
   * @example
   *   // Khách hỏi: "Có mẫu nào na ná iPhone 15 nhưng rẻ hơn không?"
   *   cosine.findSimilar(iphone15Id, { topN: 3, maxPrice: iphone15Price - 1 })
   *
   * @param {string|number} productId  - ID sản phẩm gốc (để so sánh)
   * @param {Object}        [opts]
   * @param {number}        [opts.topN=3]     - Số sản phẩm tương tự muốn lấy
   * @param {number|null}   [opts.maxPrice]   - Chỉ lấy sản phẩm có giá ≤ maxPrice
   * @param {number|null}   [opts.minPrice]   - Chỉ lấy sản phẩm có giá ≥ minPrice
   * @param {number}        [opts.minSimilarity=0.1] - Ngưỡng similarity tối thiểu
   * @returns {Array<{id, name, price, similarity}>}
   */
  findSimilar(productId, { topN = 3, maxPrice = null, minPrice = null, minSimilarity = 0.1 } = {}) {
    const vecA = this._vectors.get(String(productId));
    if (!vecA) {
      console.warn(`[CosineSim] Không tìm thấy vector cho product id=${productId}`);
      return [];
    }

    const results = [];

    for (const [id, vecB] of this._vectors.entries()) {
      if (id === String(productId)) continue; // Bỏ qua bản thân

      const meta = this._products.get(id);
      if (!meta) continue;

      // Lọc theo giá
      if (maxPrice !== null && meta.price > maxPrice) continue;
      if (minPrice !== null && meta.price < minPrice) continue;

      const sim = this._cosine(vecA, vecB);
      if (sim >= minSimilarity) {
        results.push({ ...meta, similarity: sim });
      }
    }

    // Sắp xếp theo similarity giảm dần
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topN);
  }

  /**
   * Tìm sản phẩm tương tự từ TỪ KHÓA (thay vì product ID).
   * Dùng khi khách mô tả sản phẩm mà không biết ID cụ thể.
   *
   * @example
   *   // Khách hỏi: "Có laptop nào giống MacBook Air nhưng rẻ hơn không?"
   *   cosine.findSimilarByText('MacBook Air nhẹ pin trâu', { topN: 3 })
   *
   * @param {string} queryText - Mô tả/từ khóa cần tìm
   * @param {Object} [opts]
   * @returns {Array<{id, name, price, similarity}>}
   */
  findSimilarByText(queryText, { topN = 3, maxPrice = null, minPrice = null } = {}) {
    if (this._vocabulary.size === 0) return [];

    // Build query vector từ từ khóa
    const tokens  = this.tokenizer.tokenize(queryText);
    const queryVec = new Array(this._vocabulary.size).fill(0);

    tokens.forEach(token => {
      const idx = this._vocabulary.get(token);
      if (idx !== undefined) queryVec[idx] += 1;
    });

    // Normalize
    const norm = Math.sqrt(queryVec.reduce((a, v) => a + v * v, 0)) || 1;
    const normVec = queryVec.map(v => v / norm);

    const results = [];
    for (const [id, vecB] of this._vectors.entries()) {
      const meta = this._products.get(id);
      if (!meta) continue;
      if (maxPrice !== null && meta.price > maxPrice) continue;
      if (minPrice !== null && meta.price < minPrice) continue;

      const sim = this._cosine(normVec, vecB);
      if (sim > 0.05) results.push({ ...meta, similarity: sim });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topN);
  }

  /**
   * Kiểm tra index đã được build chưa.
   * @returns {boolean}
   */
  isIndexed() {
    return this._vectors.size > 0;
  }
}

/** Singleton */
let _instance = null;
function getCosineSimilarity() {
  if (!_instance) _instance = new CosineSimilarity();
  return _instance;
}

module.exports = CosineSimilarity;
module.exports.getCosineSimilarity = getCosineSimilarity;
