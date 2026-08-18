/**
 * TF-IDF VECTORIZER (Term Frequency - Inverse Document Frequency)
 * ================================================================
 * @description
 *   Thuật toán xác định từ nào QUAN TRỌNG nhất trong câu hỏi của khách hàng.
 *   Thay vì coi mọi từ đều ngang nhau (như Naive Bayes), TF-IDF biết rằng:
 *
 *   - "MacBook Pro M3" là từ khóa ĐỊNH DANH → trọng số cao
 *   - "giá", "bao nhiêu", "có không" là từ THÔNG DỤNG → trọng số thấp
 *
 *   Công thức:
 *     TF(t, d)  = Số lần từ t xuất hiện trong câu d / Tổng số từ trong câu d
 *     IDF(t)    = log(Tổng số câu / Số câu chứa từ t)   [Laplace +1 tránh chia 0]
 *     TF-IDF(t) = TF(t, d) × IDF(t)
 *
 *   Ứng dụng trong hệ thống:
 *     1. Cung cấp vector đặc trưng cho LogisticRegression & LinearSVM
 *     2. Cung cấp vector sản phẩm cho CosineSimilarity
 *     3. Trích xuất từ khóa quan trọng nhất trước khi query database
 *
 * @uses  natural.TfIdf (thư viện natural đã cài sẵn)
 * @author  Getshopy AI Team
 */

'use strict';

const natural  = require('natural');
const Tokenizer = require('./Tokenizer');

class TFIDFVectorizer {
  constructor() {
    this.tfidf     = new natural.TfIdf();
    this.tokenizer = new Tokenizer();
    /**
     * Bộ từ vựng toàn cục — tập hợp tất cả token xuất hiện sau khi fit()
     * @type {string[]}
     */
    this.vocabulary = [];
    /**
     * Map từ token → chỉ số trong vocabulary (để build dense vector)
     * @type {Map<string, number>}
     */
    this.vocabIndex = new Map();
    /** Cờ đã fit hay chưa */
    this._fitted = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 1: FIT (Học từ tập dữ liệu huấn luyện)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Nạp toàn bộ mẫu câu vào TF-IDF corpus để tính IDF.
   * Phải gọi fit() trước khi dùng transform() hoặc extractKeywords().
   *
   * @param {string[]} documents - Mảng câu mẫu (ví dụ: tất cả trainingData)
   */
  fit(documents) {
    if (!documents || documents.length === 0) {
      console.warn('[TF-IDF] Không có dữ liệu để fit!');
      return;
    }

    const vocabSet = new Set();

    documents.forEach(doc => {
      const tokens = this.tokenizer.tokenize(doc);
      const docStr = tokens.join(' ');
      // Thêm document vào corpus của natural.TfIdf
      this.tfidf.addDocument(docStr);
      tokens.forEach(t => vocabSet.add(t));
    });

    this.vocabulary = Array.from(vocabSet).sort();
    this.vocabulary.forEach((word, idx) => this.vocabIndex.set(word, idx));
    this._fitted = true;

    console.log(`[TF-IDF] Đã fit xong. Vocabulary size: ${this.vocabulary.length} | Corpus: ${documents.length} câu`);
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 2: TRANSFORM (Biến câu thành vector TF-IDF)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Chuyển một câu thành dense vector TF-IDF (kích thước = vocabulary.length).
   * Mỗi chiều trong vector = trọng số TF-IDF của từ tương ứng.
   *
   * @param {string} text - Câu cần vector hóa
   * @returns {number[]} - Dense vector TF-IDF
   */
  transform(text) {
    if (!this._fitted) {
      console.warn('[TF-IDF] Chưa fit! Hãy gọi fit() trước.');
      return new Array(this.vocabulary.length).fill(0);
    }

    const tokens = this.tokenizer.tokenize(text);
    const docStr = tokens.join(' ');

    // Thêm tạm thời vào tfidf để tính điểm (không làm ảnh hưởng corpus gốc)
    this.tfidf.addDocument(docStr);
    const docIndex = this.tfidf.documents.length - 1;

    // Build dense vector
    const vector = new Array(this.vocabulary.length).fill(0);
    this.tfidf.listTerms(docIndex).forEach(item => {
      const idx = this.vocabIndex.get(item.term);
      if (idx !== undefined) {
        vector[idx] = item.tfidf;
      }
    });

    // Xóa document tạm thời khỏi corpus
    this.tfidf.documents.splice(docIndex, 1);

    return vector;
  }

  // ─────────────────────────────────────────────────────────────────
  // TIỆN ÍCH: Trích xuất N từ khóa quan trọng nhất
  // ─────────────────────────────────────────────────────────────────

  /**
   * Trích xuất N từ có trọng số TF-IDF cao nhất từ một câu.
   * Dùng để lọc từ khóa thực thể trước khi query database
   * (thay thế cách filter thủ công intentVerbs hiện có).
   *
   * @example
   *   vectorizer.extractKeywords('cho hỏi giá MacBook Pro M3 bao nhiêu', 3)
   *   // → ['macbook', 'pro', 'm3']  (bỏ qua 'cho', 'hỏi', 'giá', 'bao nhiêu')
   *
   * @param {string} text  - Câu đầu vào
   * @param {number} topN  - Số từ quan trọng muốn lấy (mặc định 5)
   * @returns {string[]}   - Danh sách từ khóa quan trọng nhất
   */
  extractKeywords(text, topN = 5) {
    if (!this._fitted) {
      // Fallback: trả về tất cả token nếu chưa fit
      return this.tokenizer.tokenize(text).slice(0, topN);
    }

    const tokens = this.tokenizer.tokenize(text);
    if (tokens.length === 0) return [];

    const docStr = tokens.join(' ');
    this.tfidf.addDocument(docStr);
    const docIndex = this.tfidf.documents.length - 1;

    const terms = this.tfidf.listTerms(docIndex)
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, topN)
      .map(t => t.term);

    this.tfidf.documents.splice(docIndex, 1);
    return terms;
  }

  /**
   * Lấy điểm TF-IDF của một từ cụ thể trong một câu.
   * Tiện ích kiểm tra tại sao từ đó được coi là quan trọng/không quan trọng.
   *
   * @param {string} text - Câu đầu vào
   * @param {string} term - Từ cần kiểm tra
   * @returns {number}    - Điểm TF-IDF (0 nếu không tìm thấy)
   */
  getScore(text, term) {
    const tokens = this.tokenizer.tokenize(text);
    const docStr = tokens.join(' ');
    this.tfidf.addDocument(docStr);
    const docIndex = this.tfidf.documents.length - 1;

    let score = 0;
    this.tfidf.tfidfs(term, (i, measure) => {
      if (i === docIndex) score = measure;
    });

    this.tfidf.documents.splice(docIndex, 1);
    return score;
  }

  // ─────────────────────────────────────────────────────────────────
  // SERIALIZATION: Lưu / Tải vocabulary để không cần fit lại
  // ─────────────────────────────────────────────────────────────────

  /**
   * Trả về dữ liệu cần lưu (vocabulary + corpus dưới dạng JSON-serializable).
   * @returns {Object}
   */
  serialize() {
    return {
      vocabulary: this.vocabulary,
      // Lưu corpus dưới dạng chuỗi để tái tạo TfIdf sau khi load
      corpus: this.tfidf.documents.map(d => Object.keys(d).join(' ')),
    };
  }

  /**
   * Khôi phục vectorizer từ dữ liệu đã serialize.
   * @param {Object} data
   */
  deserialize(data) {
    this.vocabulary = data.vocabulary || [];
    this.vocabIndex = new Map();
    this.vocabulary.forEach((word, idx) => this.vocabIndex.set(word, idx));

    this.tfidf = new natural.TfIdf();
    (data.corpus || []).forEach(docStr => this.tfidf.addDocument(docStr));
    this._fitted = true;
  }
}

/** Singleton — dùng chung toàn server, tránh fit nhiều lần */
let _instance = null;

/**
 * Lấy singleton TFIDFVectorizer (tạo mới nếu chưa có).
 * @returns {TFIDFVectorizer}
 */
function getVectorizer() {
  if (!_instance) _instance = new TFIDFVectorizer();
  return _instance;
}

module.exports = TFIDFVectorizer;
module.exports.getVectorizer = getVectorizer;
