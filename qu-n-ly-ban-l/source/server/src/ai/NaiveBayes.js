const fs = require('fs/promises');
const Tokenizer = require('./Tokenizer');

/**
 * THUẬT TOÁN NAIVE BAYES CLASSIFIER (HỌC MÁY TỪ CON SỐ 0)
 * @description Đây là trái tim của hệ thống Trí tuệ Nhân tạo. Thuật toán này dùng Toán học Thống kê Xác suất 
 * (Định lý Bayes ngây thơ) để phân loại Ý định (Intent) của khách hàng.
 * Thuật toán áp dụng Kỹ thuật làm mịn Laplace (Laplace Smoothing) để tránh lỗi chia cho 0.
 * Không sử dụng bất kỳ thư viện Machine Learning nào của bên thứ ba.
 */
class NaiveBayes {
  constructor() {
    this.tokenizer = new Tokenizer();
    // Danh sách các câu mẫu đã gán nhãn
    this.documents = []; 
    // Bộ từ vựng chứa tất cả các từ duy nhất hệ thống đã học
    this.vocabulary = new Set();
    
    // TRỌNG SỐ SAU KHI TRAIN
    // Xác suất Tiên nghiệm (Prior Probability): P(Class)
    this.priorProbabilities = {};
    // Xác suất có Điều kiện (Conditional Probability): P(Word | Class)
    this.conditionalProbabilities = {};
    // Số lượng từ của từng Class
    this.wordCountByClass = {};
  }

  /**
   * BƯỚC 1: HÚT DỮ LIỆU (ADD DOCUMENTS)
   * Đưa dữ liệu thô vào hệ thống trước khi học.
   * @param {string} text - Câu nói của người dùng
   * @param {string} intentClass - Ý định (Nhãn)
   */
  addDocument(text, intentClass) {
    const tokens = this.tokenizer.tokenize(text);
    if (tokens.length === 0) return;

    this.documents.push({ tokens, intentClass });
    tokens.forEach(token => this.vocabulary.add(token));
  }

  /**
   * BƯỚC 2: HUẤN LUYỆN (TRAINING)
   * Thuật toán sẽ đếm và tính toán các Ma trận Xác suất.
   */
  train() {
    const classCounts = {};
    const wordFreqByClass = {};
    const totalDocuments = this.documents.length;
    const vocabSize = this.vocabulary.size;

    // 1. Khởi tạo & Đếm số lượng
    this.documents.forEach(doc => {
      const { tokens, intentClass } = doc;
      
      // Đếm số câu của từng nhóm Ý định
      classCounts[intentClass] = (classCounts[intentClass] || 0) + 1;
      
      // Khởi tạo túi từ (Bag of Words) cho nhóm Ý định này
      if (!wordFreqByClass[intentClass]) {
        wordFreqByClass[intentClass] = {};
        this.wordCountByClass[intentClass] = 0;
      }

      // Đếm tần suất từng từ trong nhóm Ý định này
      tokens.forEach(token => {
        wordFreqByClass[intentClass][token] = (wordFreqByClass[intentClass][token] || 0) + 1;
        this.wordCountByClass[intentClass]++;
      });
    });

    // 2. Tính Xác suất Tiên nghiệm P(Intent)
    for (const intentClass in classCounts) {
      // P(Class) = Số câu của Class đó / Tổng số câu
      this.priorProbabilities[intentClass] = classCounts[intentClass] / totalDocuments;
    }

    // 3. Tính Xác suất có điều kiện P(Word | Intent) với Laplace Smoothing
    for (const intentClass in wordFreqByClass) {
      this.conditionalProbabilities[intentClass] = {};
      const totalWordsInClass = this.wordCountByClass[intentClass];

      this.vocabulary.forEach(word => {
        const wordCount = wordFreqByClass[intentClass][word] || 0;
        // Laplace Smoothing: Cộng thêm 1 vào tử số, và cộng VocabSize vào mẫu số
        // Điều này đảm bảo xác suất không bao giờ bị bằng 0 dù từ đó chưa từng xuất hiện.
        const probability = (wordCount + 1) / (totalWordsInClass + vocabSize);
        this.conditionalProbabilities[intentClass][word] = probability;
      });
    }
    
    console.log(`[AI] Training hoàn tất. Đã học ${vocabSize} từ vựng từ ${totalDocuments} mẫu dữ liệu.`);
  }

  /**
   * BƯỚC 3: DỰ ĐOÁN (INFERENCE / PREDICT)
   * Phân tích một câu chưa từng thấy để đoán xem nó thuộc Ý định nào.
   * @param {string} text - Câu khách hàng nói
   * @returns {Object} { intent, score }
   */
  predict(text) {
    const tokens = this.tokenizer.tokenize(text);
    let bestIntent = null;
    let maxScore = -Infinity; // Khởi tạo điểm cao nhất bằng Âm Vô Cực

    // Duyệt qua tất cả các nhóm Ý định
    for (const intentClass in this.priorProbabilities) {
      // Sử dụng Toán học Logarit (Log) để cộng dồn các xác suất.
      // Nếu nhân các xác suất nhỏ lại với nhau, máy tính sẽ bị tràn số (Underflow).
      let score = Math.log(this.priorProbabilities[intentClass]);

      tokens.forEach(token => {
        let wordProb = this.conditionalProbabilities[intentClass][token];
        // Nếu đây là một từ hoàn toàn mới, chưa bao giờ có trong bộ từ vựng,
        // Ta gán cho nó xác suất Laplace ngầm định.
        if (!wordProb) {
          const totalWords = this.wordCountByClass[intentClass] || 0;
          wordProb = 1 / (totalWords + this.vocabulary.size);
        }
        score += Math.log(wordProb);
      });

      if (score > maxScore) {
        maxScore = score;
        bestIntent = intentClass;
      }
    }

    return { intent: bestIntent, score: maxScore };
  }

  /**
   * LƯU MÔ HÌNH VÀO FILE
   */
  async saveModel(filePath) {
    const modelData = {
      vocabulary: Array.from(this.vocabulary),
      priorProbabilities: this.priorProbabilities,
      conditionalProbabilities: this.conditionalProbabilities,
      wordCountByClass: this.wordCountByClass
    };
    await fs.writeFile(filePath, JSON.stringify(modelData, null, 2), 'utf-8');
  }

  /**
   * TẢI MÔ HÌNH TỪ FILE (Để Server sử dụng ngay lập tức không cần Train lại)
   */
  async loadModel(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const modelData = JSON.parse(fileContent);
      
      this.vocabulary = new Set(modelData.vocabulary);
      this.priorProbabilities = modelData.priorProbabilities;
      this.conditionalProbabilities = modelData.conditionalProbabilities;
      this.wordCountByClass = modelData.wordCountByClass;
      
      return true;
    } catch (e) {
      return false; // Chưa có file Model
    }
  }
}

module.exports = NaiveBayes;
