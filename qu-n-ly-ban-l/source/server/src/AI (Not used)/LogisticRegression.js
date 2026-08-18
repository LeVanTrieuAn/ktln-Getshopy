/**
 * LOGISTIC REGRESSION CLASSIFIER
 * ================================
 * @description
 *   Phân loại ý định (Intent) bằng Hồi quy Logistic đa lớp
 *   (Multiclass Logistic Regression / Softmax Regression).
 *
 *   Ưu điểm so với Naive Bayes:
 *   ✅ Trả về XÁC SUẤT (%) thực sự cho từng intent → dùng làm "confidence threshold"
 *   ✅ Học được mối TƯƠNG QUAN GIỮA CÁC TỪ (Naive Bayes giả định từ độc lập)
 *   ✅ Thường cho kết quả tốt hơn trên dữ liệu văn bản thực tế
 *
 *   Thuật toán:
 *   1. Biến câu thành vector BOW (Bag of Words — đếm tần suất từ)
 *   2. Tính logits z_k = W_k · x + b_k  (tích vô hướng trọng số × input)
 *   3. Softmax: P(class_k) = exp(z_k) / Σ exp(z_j)  → trả về phân phối xác suất
 *   4. Training: Gradient Descent minimize Cross-Entropy Loss
 *
 *   Tích hợp vào Ensemble:
 *   LR_prob được dùng trong EnsembleClassifier với trọng số 0.4
 *
 * @author Getshopy AI Team
 */

'use strict';

const fs       = require('fs/promises');
const Tokenizer = require('./Tokenizer');

class LogisticRegression {
  /**
   * @param {Object} [options]
   * @param {number} [options.learningRate=0.1]   - Tốc độ học (step size gradient descent)
   * @param {number} [options.epochs=100]          - Số vòng lặp huấn luyện
   * @param {number} [options.l2Lambda=0.001]      - Hệ số regularization L2 (tránh overfitting)
   */
  constructor({ learningRate = 0.1, epochs = 100, l2Lambda = 0.001 } = {}) {
    this.learningRate = learningRate;
    this.epochs       = epochs;
    this.l2Lambda     = l2Lambda;
    this.tokenizer    = new Tokenizer();

    /**
     * Bộ từ vựng — Map từ token → chỉ số chiều trong vector
     * @type {Map<string, number>}
     */
    this.vocabulary = new Map();

    /**
     * Danh sách tất cả intent classes theo thứ tự
     * @type {string[]}
     */
    this.classes = [];

    /**
     * Ma trận trọng số W: kích thước [numClasses × vocabSize]
     * W[k][j] = trọng số của từ j với class k
     * @type {number[][]}
     */
    this.weights = [];

    /**
     * Vector bias b: kích thước [numClasses]
     * @type {number[]}
     */
    this.biases = [];

    this._trained = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 1: BUILD VOCABULARY (Xây dựng bộ từ vựng)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Xây dựng vocabulary và danh sách classes từ tập training data.
   * Phải gọi trước fit().
   *
   * @param {Array<{text: string, intent: string}>} data
   */
  buildVocabulary(data) {
    const vocabSet  = new Set();
    const classSet  = new Set();

    data.forEach(({ text, intent }) => {
      this.tokenizer.tokenize(text).forEach(t => vocabSet.add(t));
      classSet.add(intent);
    });

    // Gán chỉ số cố định cho từng từ và class
    Array.from(vocabSet).sort().forEach((word, i) => this.vocabulary.set(word, i));
    this.classes = Array.from(classSet).sort();
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 2: VECTOR HÓA (Bag of Words)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Chuyển câu thành dense vector BOW.
   * Mỗi chiều là tần suất xuất hiện (normalized) của từ tương ứng.
   *
   * @param {string} text
   * @returns {number[]} - Dense vector kích thước vocabulary.size
   */
  _vectorize(text) {
    const tokens = this.tokenizer.tokenize(text);
    const vector = new Array(this.vocabulary.size).fill(0);
    tokens.forEach(token => {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) vector[idx]++;
    });
    // Normalize bằng số token để tránh bias câu dài
    const sum = tokens.length || 1;
    return vector.map(v => v / sum);
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 3: SOFTMAX (Chuyển logits thành phân phối xác suất)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Hàm Softmax — chuyển mảng logits thành xác suất tổng = 1.
   * Dùng trick "trừ max" để tránh overflow số học.
   *
   * @param {number[]} logits
   * @returns {number[]}
   */
  _softmax(logits) {
    const maxLogit = Math.max(...logits);
    const exps     = logits.map(z => Math.exp(z - maxLogit));
    const sumExps  = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sumExps);
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 4: TÍNH LOGITS (Forward Pass)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Tính logits cho tất cả classes với một input vector.
   * z_k = W_k · x + b_k
   *
   * @param {number[]} x - Input vector
   * @returns {number[]}  - Logits cho từng class
   */
  _forward(x) {
    return this.classes.map((_, k) => {
      // Tích vô hướng W[k] · x
      let z = this.biases[k];
      for (let j = 0; j < x.length; j++) {
        z += this.weights[k][j] * x[j];
      }
      return z;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC 5: TRAINING (Gradient Descent)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Huấn luyện mô hình bằng Mini-batch Gradient Descent.
   * Minimize Cross-Entropy Loss = -Σ y_k * log(p_k) + L2 Regularization
   *
   * @param {Array<{text: string, intent: string}>} data - Dữ liệu training
   */
  fit(data) {
    if (!data || data.length === 0) return;

    // Build vocabulary nếu chưa có
    if (this.vocabulary.size === 0) this.buildVocabulary(data);

    const V = this.vocabulary.size;
    const K = this.classes.length;

    // Khởi tạo weights ngẫu nhiên nhỏ (Xavier initialization)
    this.weights = Array.from({ length: K }, () =>
      Array.from({ length: V }, () => (Math.random() - 0.5) * 0.1)
    );
    this.biases = new Array(K).fill(0);

    console.log(`[LogisticReg] Bắt đầu train: ${K} classes | ${V} features | ${this.epochs} epochs | ${data.length} samples`);

    // Pre-vectorize tất cả training samples để tránh tính lại mỗi epoch
    const trainVectors = data.map(({ text, intent }) => ({
      x:      this._vectorize(text),
      yIndex: this.classes.indexOf(intent),
    })).filter(d => d.yIndex >= 0);

    // Mini-batch SGD
    for (let epoch = 0; epoch < this.epochs; epoch++) {
      let totalLoss = 0;

      // Shuffle data mỗi epoch
      for (let i = trainVectors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trainVectors[i], trainVectors[j]] = [trainVectors[j], trainVectors[i]];
      }

      trainVectors.forEach(({ x, yIndex }) => {
        const logits = this._forward(x);
        const probs  = this._softmax(logits);

        // Cross-entropy loss (thêm epsilon tránh log(0))
        totalLoss -= Math.log(Math.max(probs[yIndex], 1e-15));

        // Gradient: δL/δz_k = p_k - y_k
        const deltas = probs.map((p, k) => p - (k === yIndex ? 1 : 0));

        // Cập nhật weights và biases
        for (let k = 0; k < K; k++) {
          this.biases[k] -= this.learningRate * deltas[k];
          for (let j = 0; j < V; j++) {
            // L2 Regularization: thêm λ × w vào gradient
            this.weights[k][j] -= this.learningRate * (
              deltas[k] * x[j] + this.l2Lambda * this.weights[k][j]
            );
          }
        }
      });

      if ((epoch + 1) % 20 === 0) {
        const avgLoss = (totalLoss / trainVectors.length).toFixed(4);
        console.log(`[LogisticReg] Epoch ${epoch + 1}/${this.epochs} | Loss: ${avgLoss}`);
      }
    }

    this._trained = true;
    console.log('[LogisticReg] ✅ Training hoàn tất!');
  }

  // ─────────────────────────────────────────────────────────────────
  // DỰ ĐOÁN (Inference)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Dự đoán intent và trả về phân phối xác suất đầy đủ.
   *
   * @param {string} text - Câu đầu vào
   * @returns {{ intent: string, confidence: number, allProbs: Object }}
   *   - intent:     Intent có xác suất cao nhất
   *   - confidence: Xác suất (0-1) của intent đó → dùng làm ngưỡng 60%
   *   - allProbs:   Map toàn bộ xác suất theo từng intent
   */
  predict(text) {
    if (!this._trained) {
      return { intent: null, confidence: 0, allProbs: {} };
    }

    const x      = this._vectorize(text);
    const logits = this._forward(x);
    const probs  = this._softmax(logits);

    let bestIntent = null;
    let maxProb    = -Infinity;

    const allProbs = {};
    this.classes.forEach((cls, k) => {
      allProbs[cls] = probs[k];
      if (probs[k] > maxProb) {
        maxProb    = probs[k];
        bestIntent = cls;
      }
    });

    return {
      intent:     bestIntent,
      confidence: maxProb,
      allProbs,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // SERIALIZATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lưu model ra file JSON.
   * @param {string} filePath
   */
  async saveModel(filePath) {
    const data = {
      vocabulary: Array.from(this.vocabulary.entries()),
      classes:    this.classes,
      weights:    this.weights,
      biases:     this.biases,
      config: {
        learningRate: this.learningRate,
        epochs:       this.epochs,
        l2Lambda:     this.l2Lambda,
      }
    };
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    console.log(`[LogisticReg] Đã lưu model ra: ${filePath}`);
  }

  /**
   * Tải model từ file JSON.
   * @param {string} filePath
   * @returns {boolean} - true nếu tải thành công
   */
  async loadModel(filePath) {
    try {
      const raw  = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);

      this.vocabulary = new Map(data.vocabulary);
      this.classes    = data.classes;
      this.weights    = data.weights;
      this.biases     = data.biases;
      if (data.config) {
        this.learningRate = data.config.learningRate;
        this.epochs       = data.config.epochs;
        this.l2Lambda     = data.config.l2Lambda;
      }
      this._trained = true;
      console.log(`[LogisticReg] ✅ Đã tải model: ${data.classes.length} classes | ${data.vocabulary.length} vocab`);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = LogisticRegression;
