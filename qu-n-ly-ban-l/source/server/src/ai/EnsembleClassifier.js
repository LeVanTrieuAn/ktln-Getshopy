/**
 * ENSEMBLE CLASSIFIER — Bộ phân loại Kết hợp (Voting)
 * =====================================================
 * @description
 *   Kết hợp điểm từ 3 nguồn để đưa ra quyết định phân loại Intent
 *   chính xác hơn bất kỳ mô hình đơn lẻ nào.
 *
 *   CÔNG THỨC ENSEMBLE:
 *   ────────────────────────────────────────────────────
 *   final_score(intent) = 0.40 × NB_prob(intent)
 *                       + 0.40 × LR_prob(intent)
 *                       + 0.20 × SVM_prob(intent)
 *                       + rule_bonus(intent)
 *
 *   rule_bonus:
 *     +0.15 → nếu rule-based (isPromoQuery, isDeliveryQuery...) khớp intent đó
 *     +0.00 → nếu không khớp rule nào
 *
 *   Ngưỡng tự tin (CONFIDENCE THRESHOLD):
 *     max(final_score) < 0.60 → trả về FALLBACK ("Xin lỗi tôi chưa hiểu ý bạn")
 *     max(final_score) ≥ 0.60 → trả về intent winner
 *   ────────────────────────────────────────────────────
 *
 *   Lý do chọn trọng số:
 *     - NaiveBayes (0.40): đã được train trên toàn bộ trainingData + DB sản phẩm
 *       → rất mạnh nhờ lượng dữ liệu lớn
 *     - LogisticRegression (0.40): tính được xác suất thực, học tương quan từ
 *       → bổ sung cho NB ở các intent gần giống nhau
 *     - LinearSVM (0.20): trọng số thấp hơn vì train SGD ngắn hơn
 *       → nhưng vẫn cung cấp "góc nhìn" ranh giới phân cách khác
 *     - Rule-based bonus (cộng thêm): tăng trọng số khi có rule cứng khớp
 *       → đảm bảo các intent đặc thù (PRICE_COMPLAINT, ASK_PROMO...) không bị miss
 *
 * @author Getshopy AI Team
 */

'use strict';

const {
  isPromoQuery, isDeliveryQuery, isReturnQuery, isPaymentQuery,
  isPriceComplaint, isChangeProductQuery, isTrackOrderQuery, isCancelOrderQuery,
  isContactQuery, removeDiacritics,
} = require('../routes/aiHandlers');

// ─────────────────────────────────────────────────────────────────
// CÁC HÀM RULE-BASED → INTENT (từ aiHandlers.js hiện có)
// ─────────────────────────────────────────────────────────────────

/**
 * Kiểm tra message có khớp một rule-based intent nào không.
 * Trả về tên intent nếu khớp, null nếu không.
 *
 * @param {string} message
 * @returns {string|null}
 */
function detectRuleBasedIntent(message) {
  if (isPriceComplaint(message))     return 'PRICE_COMPLAINT';
  if (isPromoQuery(message))         return 'ASK_PROMO';
  if (isDeliveryQuery(message))      return 'ASK_DELIVERY';
  if (isReturnQuery(message))        return 'ASK_RETURN';
  if (isPaymentQuery(message))       return 'ASK_PAYMENT';
  if (isTrackOrderQuery(message))    return 'TRACK_ORDER';
  if (isCancelOrderQuery(message))   return 'CANCEL_ORDER';
  if (isChangeProductQuery(message)) return 'CHANGE_PRODUCT';
  if (isContactQuery(message))       return 'CONTACT';
  return null;
}

// ─────────────────────────────────────────────────────────────────
// ENSEMBLE CLASSIFIER CLASS
// ─────────────────────────────────────────────────────────────────

class EnsembleClassifier {
  /**
   * @param {Object} models
   * @param {import('./NaiveBayes')}        models.naiveBayes  - Instance NaiveBayes đã load
   * @param {import('./LogisticRegression')} models.logisticReg - Instance LR đã train
   * @param {import('./LinearSVM')}          models.linearSvm  - Instance SVM đã train
   * @param {Object} [weights]
   * @param {number} [weights.nb=0.40]       - Trọng số NaiveBayes
   * @param {number} [weights.lr=0.40]       - Trọng số Logistic Regression
   * @param {number} [weights.svm=0.20]      - Trọng số Linear SVM
   * @param {number} [weights.ruleBonus=0.15] - Điểm thưởng khi rule khớp
   * @param {number} [confidenceThreshold=0.60] - Ngưỡng min để tin tưởng kết quả
   */
  constructor(
    models,
    weights = {},
    confidenceThreshold = 0.60
  ) {
    this.naiveBayes  = models.naiveBayes;
    this.logisticReg = models.logisticReg;
    this.linearSvm   = models.linearSvm;

    // Trọng số (tổng weights phải = 1.0 trước khi cộng ruleBonus)
    this.wNB   = weights.nb        ?? 0.40;
    this.wLR   = weights.lr        ?? 0.40;
    this.wSVM  = weights.svm       ?? 0.20;
    this.wRule = weights.ruleBonus ?? 0.15;

    this.confidenceThreshold = confidenceThreshold;

    console.log(`[Ensemble] Khởi tạo: NB=${this.wNB} | LR=${this.wLR} | SVM=${this.wSVM} | RuleBonus=${this.wRule} | Threshold=${this.confidenceThreshold}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // NORMALIZE NaiveBayes Score → Probability
  // ─────────────────────────────────────────────────────────────────

  /**
   * NaiveBayes trả về log-probability (âm, range [-∞, 0]).
   * Cần chuyển thành xác suất [0, 1] trước khi dùng trong Ensemble.
   *
   * Cách: Softmax trên tất cả log-probs của các intent
   *   P(intent_k) = exp(score_k) / Σ exp(score_j)
   *
   * @param {string} message - Câu cần predict
   * @returns {Object}       - Map intent → probability (tổng ≈ 1)
   */
  _getNBProbs(message) {
    // NaiveBayes chỉ trả về best intent + score, không có allProbs
    // Nên ta tính toàn bộ score bằng cách gọi predict và kiểm tra internal state
    const nb = this.naiveBayes;
    if (!nb || !nb.priorProbabilities) return {};

    const Tokenizer = require('./Tokenizer');
    const tokenizer = new Tokenizer();
    const tokens    = tokenizer.tokenize(message);

    const rawScores = {};

    for (const intentClass in nb.priorProbabilities) {
      let score = Math.log(nb.priorProbabilities[intentClass]);
      tokens.forEach(token => {
        let wordProb = nb.conditionalProbabilities[intentClass]?.[token];
        if (!wordProb) {
          const totalWords = nb.wordCountByClass[intentClass] || 0;
          wordProb = 1 / (totalWords + nb.vocabulary.size);
        }
        score += Math.log(wordProb);
      });
      rawScores[intentClass] = score;
    }

    // Softmax để chuyển log-probs → [0, 1]
    const classes   = Object.keys(rawScores);
    const logProbs  = classes.map(c => rawScores[c]);
    const maxLogP   = Math.max(...logProbs);
    const exps      = logProbs.map(s => Math.exp(s - maxLogP));
    const sumExps   = exps.reduce((a, b) => a + b, 0);

    const probs = {};
    classes.forEach((cls, i) => { probs[cls] = exps[i] / sumExps; });
    return probs;
  }

  // ─────────────────────────────────────────────────────────────────
  // HÀM ENSEMBLE CHÍNH
  // ─────────────────────────────────────────────────────────────────

  /**
   * Kết hợp kết quả từ 3 mô hình và rule-based để đưa ra quyết định cuối.
   *
   * @param {string} message - Câu của khách hàng
   * @returns {EnsembleResult}
   *
   * @typedef {Object} EnsembleResult
   * @property {string}  intent          - Intent dự đoán cuối cùng
   * @property {number}  confidence      - Độ tự tin tổng hợp (0-1)
   * @property {boolean} isFallback      - true nếu dưới ngưỡng (không hiểu)
   * @property {string}  source          - "ensemble" | "rule_override"
   * @property {Object}  breakdown       - Chi tiết điểm từng mô hình (debug)
   */
  predict(message) {
    // ── BƯỚC 1: Kiểm tra Rule-based intent ──────────────────────────
    const ruleIntent = detectRuleBasedIntent(message);

    // ── BƯỚC 2: Lấy probabilities từ 3 mô hình ─────────────────────
    const nbProbs  = this._getNBProbs(message);
    const lrResult = this.logisticReg?._trained
      ? this.logisticReg.predict(message)
      : { allProbs: {} };
    const svmResult = this.linearSvm?._trained
      ? this.linearSvm.predict(message)
      : { allProbs: {} };

    // ── BƯỚC 3: Thu thập tất cả intents có mặt trong bất kỳ model ──
    const allIntents = new Set([
      ...Object.keys(nbProbs),
      ...Object.keys(lrResult.allProbs || {}),
      ...Object.keys(svmResult.allProbs || {}),
    ]);

    // ── BƯỚC 4: Tính final_score cho mỗi intent ────────────────────
    const finalScores = {};

    for (const intent of allIntents) {
      const nbP  = nbProbs[intent]                 ?? 0;
      const lrP  = (lrResult.allProbs  || {})[intent] ?? 0;
      const svmP = (svmResult.allProbs || {})[intent] ?? 0;

      // Điểm thưởng rule-based: +wRule nếu rule khớp ĐÚNG intent này
      const bonus = (ruleIntent === intent) ? this.wRule : 0;

      finalScores[intent] = this.wNB * nbP + this.wLR * lrP + this.wSVM * svmP + bonus;
    }

    // ── BƯỚC 5: Tìm intent có điểm cao nhất ────────────────────────
    let bestIntent = null;
    let maxScore   = -Infinity;

    for (const [intent, score] of Object.entries(finalScores)) {
      if (score > maxScore) {
        maxScore   = score;
        bestIntent = intent;
      }
    }

    // ── BƯỚC 6: Kiểm tra ngưỡng tự tin ─────────────────────────────
    const isFallback = maxScore < this.confidenceThreshold;

    // Nếu rule-based rất mạnh (match CHÍNH XÁC), override dù dưới ngưỡng
    const source = ruleIntent && finalScores[ruleIntent] >= 0.50
      ? 'rule_override'
      : 'ensemble';

    const finalIntent = isFallback && source !== 'rule_override'
      ? 'UNKNOWN'
      : bestIntent;

    // ── BƯỚC 7: Debug breakdown ─────────────────────────────────────
    const breakdown = {
      naiveBayes:       { intent: Object.entries(nbProbs).sort(([,a],[,b]) => b-a)[0]?.[0], prob: Math.max(...Object.values(nbProbs), 0) },
      logisticReg:      { intent: lrResult.intent,  confidence: lrResult.confidence  },
      linearSvm:        { intent: svmResult.intent, confidence: svmResult.confidence },
      ruleBased:        ruleIntent,
      finalScores:      Object.fromEntries(
        Object.entries(finalScores).sort(([,a],[,b]) => b-a).slice(0, 5)
      ),
    };

    console.log(
      `[Ensemble] "${message.slice(0, 50)}" → intent=${finalIntent} | score=${maxScore.toFixed(3)} | isFallback=${isFallback} | src=${source}`,
      ruleIntent ? `| rule=${ruleIntent}` : ''
    );

    return {
      intent:     finalIntent,
      confidence: maxScore,
      isFallback,
      source,
      breakdown,
    };
  }

  /**
   * Tiện ích: Kiểm tra xem có sẵn sàng predict chưa (ít nhất 1 model phải trained).
   * @returns {boolean}
   */
  isReady() {
    return !!(
      this.naiveBayes?.priorProbabilities ||
      this.logisticReg?._trained ||
      this.linearSvm?._trained
    );
  }
}

module.exports = EnsembleClassifier;
