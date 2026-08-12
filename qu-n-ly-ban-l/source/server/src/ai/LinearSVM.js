/**
 * LINEAR SVM — Support Vector Machine (Máy vectơ hỗ trợ)
 * =========================================================
 * @description
 *   Phân loại Intent bằng Linear SVM đa lớp (One-vs-Rest).
 *   SVM tìm "đường ranh giới" (hyperplane) xa nhất giữa 2 lớp,
 *   giúp phân biệt rõ ràng các intent gần giống nhau.
 *
 *   Ví dụ điển hình:
 *     - "giá iPhone 15 bao nhiêu"    → ASK_PRICE    (không phải PRICE_COMPLAINT)
 *     - "giá đắt quá không rẻ hơn"  → PRICE_COMPLAINT
 *   Naive Bayes dễ lẫn vì cả 2 đều chứa từ "giá". SVM học ranh giới rõ hơn.
 *
 *   Thuật toán: Stochastic Gradient Descent (SGD) minimize Hinge Loss
 *   Loss = max(0, 1 - y_i × (w · x_i + b))  +  λ||w||²
 *
 *   Chiến lược đa lớp: One-vs-Rest (OvR)
 *   Mỗi class k có 1 bộ weights riêng, phân biệt "class k" vs "tất cả còn lại"
 *   Kết quả cuối: class nào có điểm (margin) cao nhất thì thắng.
 *
 * @author Getshopy AI Team
 */

'use strict';

const fs        = require('fs/promises');
const Tokenizer  = require('./Tokenizer');

class LinearSVM {
  /**
   * @param {Object} [options]
   * @param {number} [options.learningRate=0.01]  - Tốc độ học SGD
   * @param {number} [options.epochs=50]           - Số vòng lặp
   * @param {number} [options.lambda=0.001]        - Hệ số regularization (C^-1)
   */
  constructor({ learningRate = 0.01, epochs = 50, lambda = 0.001 } = {}) {
    this.learningRate = learningRate;
    this.epochs       = epochs;
    this.lambda       = lambda;
    this.tokenizer    = new Tokenizer();

    /** Bộ từ vựng: token → index */
    this.vocabulary = new Map();
    /** Danh sách tất cả classes */
    this.classes    = [];
    /**
     * Trọng số OvR: weights[k] = vector trọng số cho classifier k
     * @type {number[][]}
     */
    this.weights = [];
    /**
     * Bias OvR: biases[k] = bias cho classifier k
     * @type {number[]}
     */
    this.biases = [];

    this._trained = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // TIỀN XỬ LÝ
  // ─────────────────────────────────────────────────────────────────

  /** Xây dựng vocabulary từ tập training data */
  buildVocabulary(data) {
    const vocabSet = new Set();
    const classSet = new Set();
    data.forEach(({ text, intent }) => {
      this.tokenizer.tokenize(text).forEach(t => vocabSet.add(t));
      classSet.add(intent);
    });
    Array.from(vocabSet).sort().forEach((w, i) => this.vocabulary.set(w, i));
    this.classes = Array.from(classSet).sort();
  }

  /**
   * Vector hóa câu thành Bag-of-Words vector.
   * Mỗi chiều = tần suất normalized của từ tương ứng.
   */
  _vectorize(text) {
    const tokens = this.tokenizer.tokenize(text);
    const vector = new Array(this.vocabulary.size).fill(0);
    tokens.forEach(t => {
      const idx = this.vocabulary.get(t);
      if (idx !== undefined) vector[idx]++;
    });
    const norm = tokens.length || 1;
    return vector.map(v => v / norm);
  }

  // ─────────────────────────────────────────────────────────────────
  // TRAINING — SGD minimize Hinge Loss
  // ─────────────────────────────────────────────────────────────────

  /**
   * Huấn luyện tất cả K bộ phân loại OvR.
   *
   * Với mỗi class k:
   *   - y_i = +1 nếu sample i thuộc class k
   *   - y_i = -1 nếu sample i KHÔNG thuộc class k
   *   - Hinge Loss: L = max(0, 1 - y_i × score_i)
   *   - Gradient nếu margin bị vi phạm (y_i × score_i < 1):
   *       ∇w = λ×w - y_i×x_i
   *   - Gradient nếu margin OK:
   *       ∇w = λ×w  (chỉ regularization)
   *
   * @param {Array<{text: string, intent: string}>} data
   */
  fit(data) {
    if (!data || data.length === 0) return;
    if (this.vocabulary.size === 0) this.buildVocabulary(data);

    const V = this.vocabulary.size;
    const K = this.classes.length;

    // Khởi tạo weights nhỏ
    this.weights = Array.from({ length: K }, () =>
      new Array(V).fill(0).map(() => (Math.random() - 0.5) * 0.01)
    );
    this.biases = new Array(K).fill(0);

    // Pre-vectorize
    const vectors = data.map(({ text, intent }) => ({
      x:      this._vectorize(text),
      intent,
    }));

    console.log(`[LinearSVM] Bắt đầu train OvR: ${K} classifiers | ${V} features | ${this.epochs} epochs`);

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      // Shuffle
      for (let i = vectors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vectors[i], vectors[j]] = [vectors[j], vectors[i]];
      }

      let totalHingeLoss = 0;

      // Với mỗi classifier k (OvR)
      for (let k = 0; k < K; k++) {
        const targetClass = this.classes[k];

        vectors.forEach(({ x, intent }) => {
          const y = intent === targetClass ? 1 : -1;

          // Score = w · x + b
          let score = this.biases[k];
          for (let j = 0; j < V; j++) score += this.weights[k][j] * x[j];

          const margin = y * score;
          totalHingeLoss += Math.max(0, 1 - margin);

          if (margin < 1) {
            // Margin bị vi phạm — cập nhật weights
            this.biases[k] += this.learningRate * y;
            for (let j = 0; j < V; j++) {
              this.weights[k][j] += this.learningRate * (y * x[j] - this.lambda * this.weights[k][j]);
            }
          } else {
            // Chỉ regularization
            for (let j = 0; j < V; j++) {
              this.weights[k][j] -= this.learningRate * this.lambda * this.weights[k][j];
            }
          }
        });
      }

      if ((epoch + 1) % 10 === 0) {
        const avgLoss = (totalHingeLoss / (vectors.length * K)).toFixed(4);
        console.log(`[LinearSVM] Epoch ${epoch + 1}/${this.epochs} | Hinge Loss: ${avgLoss}`);
      }
    }

    this._trained = true;
    console.log('[LinearSVM] ✅ Training OvR hoàn tất!');
  }

  // ─────────────────────────────────────────────────────────────────
  // DỰ ĐOÁN
  // ─────────────────────────────────────────────────────────────────

  /**
   * Tính decision scores cho tất cả classifiers, rồi Softmax hóa
   * để có phân phối xác suất (tiện dùng trong Ensemble).
   *
   * @param {string} text
   * @returns {{ intent: string, confidence: number, allProbs: Object }}
   */
  predict(text) {
    if (!this._trained) return { intent: null, confidence: 0, allProbs: {} };

    const x = this._vectorize(text);

    // Tính raw decision scores
    const scores = this.classes.map((_, k) => {
      let score = this.biases[k];
      for (let j = 0; j < x.length; j++) score += this.weights[k][j] * x[j];
      return score;
    });

    // Softmax để chuyển scores → xác suất
    const maxScore = Math.max(...scores);
    const exps     = scores.map(s => Math.exp(s - maxScore));
    const sumExps  = exps.reduce((a, b) => a + b, 0);
    const probs    = exps.map(e => e / sumExps);

    const allProbs = {};
    let bestIntent = null;
    let maxProb    = -Infinity;

    this.classes.forEach((cls, k) => {
      allProbs[cls] = probs[k];
      if (probs[k] > maxProb) {
        maxProb    = probs[k];
        bestIntent = cls;
      }
    });

    return { intent: bestIntent, confidence: maxProb, allProbs };
  }

  // ─────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ─────────────────────────────────────────────────────────────────

  async saveModel(filePath) {
    const data = {
      vocabulary: Array.from(this.vocabulary.entries()),
      classes:    this.classes,
      weights:    this.weights,
      biases:     this.biases,
    };
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    console.log(`[LinearSVM] Đã lưu model ra: ${filePath}`);
  }

  async loadModel(filePath) {
    try {
      const raw  = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.vocabulary = new Map(data.vocabulary);
      this.classes    = data.classes;
      this.weights    = data.weights;
      this.biases     = data.biases;
      this._trained   = true;
      console.log(`[LinearSVM] ✅ Đã tải model: ${data.classes.length} classes`);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = LinearSVM;
