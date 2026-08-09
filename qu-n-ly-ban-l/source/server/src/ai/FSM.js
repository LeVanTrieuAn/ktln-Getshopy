/**
 * FSM — FINITE STATE MACHINE (Máy Trạng Thái Hữu Hạn)
 * ======================================================
 * @description
 *   Quản lý luồng hội thoại CÓ CẤU TRÚC trong khi khách đặt hàng.
 *   FSM đảm bảo luồng chat KHÔNG BỊ LOẠN nếu khách đột ngột đổi ý
 *   hoặc nhắn lung tung giữa chừng.
 *
 *   Sơ đồ trạng thái:
 *   ─────────────────────────────────────────────────────────
 *   [IDLE] ──────────────────────────────────────────────────────────┐
 *     │ (khách nói "tôi muốn đặt hàng / mua / order")               │
 *     ▼                                                               │
 *   [COLLECTING_PRODUCT] ← Hỏi sản phẩm muốn mua                    │
 *     │ (khách nêu tên sản phẩm)                                      │
 *     ▼                                                               │
 *   [COLLECTING_ADDRESS] ← Hỏi địa chỉ giao hàng                    │
 *     │ (khách nhập địa chỉ)                                          │
 *     ▼                                                               │
 *   [COLLECTING_PHONE] ← Hỏi số điện thoại                          │
 *     │ (khách nhập SĐT hợp lệ)                                       │
 *     ▼                                                               │
 *   [CONFIRMING] ← Hiển thị tóm tắt, hỏi xác nhận                   │
 *     │ (khách xác nhận "yes/đồng ý/ok")                              │
 *     ▼                                                               │
 *   [COMPLETED] ── (xóa session, quay về IDLE) ─────────────────────┘
 *
 *   Bất kỳ trạng thái nào:
 *     Khách nói "hủy/cancel/thôi" → → → → → → → → → → → → [IDLE]
 *   ─────────────────────────────────────────────────────────
 *
 *   Tích hợp với pipeline ai.js:
 *   - KIỂM TRA FSM TRƯỚC Ensemble Classifier
 *   - Nếu session đang active → xử lý theo FSM, BỎ QUA phân loại intent
 *   - Nếu không có session active → phân loại intent bình thường
 *
 * @author Getshopy AI Team
 */

'use strict';

const { removeDiacritics } = require('../routes/aiHandlers');

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH TRẠNG THÁI
// ─────────────────────────────────────────────────────────────────────────────
const STATE = {
  IDLE:                'IDLE',
  COLLECTING_PRODUCT:  'COLLECTING_PRODUCT',
  COLLECTING_ADDRESS:  'COLLECTING_ADDRESS',
  COLLECTING_PHONE:    'COLLECTING_PHONE',
  CONFIRMING:          'CONFIRMING',
  COMPLETED:           'COMPLETED',
};

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN MATCHING
// ─────────────────────────────────────────────────────────────────────────────

/** Từ khóa kích hoạt luồng đặt hàng */
const ORDER_TRIGGERS = [
  'dat hang', 'mua hang', 'mua ngay', 'order', 'dat mua',
  'toi muon mua', 'cho toi mua', 'thanh toan', 'checkout',
  'mua luon', 'chot don', 'toi muon dat hang',
];

/** Từ khóa xác nhận */
const CONFIRM_YES = ['yes', 'ok', 'dong y', 'xac nhan', 'chuan', 'dung', 'ung y', 'muon', 'co', 'duoc'];

/** Từ khóa hủy */
const CANCEL_KEYWORDS = ['huy', 'cancel', 'thoi', 'khong mua', 'bo', 'thoat', 'dung lai', 'stop'];

/**
 * Regex kiểm tra số điện thoại Việt Nam hợp lệ.
 * Chấp nhận: 0xxxxxxxxx, +84xxxxxxxxx, 84xxxxxxxxx (10-11 số sau khi chuẩn hóa)
 */
const VN_PHONE_REGEX = /(?:\+84|84|0)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}/;

// ─────────────────────────────────────────────────────────────────────────────
// FSM CLASS
// ─────────────────────────────────────────────────────────────────────────────

class FSM {
  constructor() {
    /**
     * Map session data: sessionId → FSMSession
     * @type {Map<string, FSMSession>}
     *
     * @typedef {Object} FSMSession
     * @property {string} state         - Trạng thái hiện tại
     * @property {string|null} product  - Tên sản phẩm muốn mua
     * @property {string|null} address  - Địa chỉ giao hàng
     * @property {string|null} phone    - Số điện thoại
     * @property {NodeJS.Timeout} timer - TTL timer
     */
    this._sessions = new Map();
    this._TTL_MS   = 15 * 60 * 1000; // 15 phút
  }

  // ─────────────────────────────────────────────────────────────────
  // QUẢN LÝ SESSION
  // ─────────────────────────────────────────────────────────────────

  _getSession(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  _createSession(sessionId) {
    const session = {
      state:   STATE.COLLECTING_PRODUCT,
      product: null,
      address: null,
      phone:   null,
      timer:   null,
    };
    this._resetTimer(sessionId, session);
    this._sessions.set(sessionId, session);
    return session;
  }

  _resetTimer(sessionId, session) {
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      console.log(`[FSM] Session hết hạn: ${sessionId}`);
      this._sessions.delete(sessionId);
    }, this._TTL_MS);
  }

  _destroySession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (session?.timer) clearTimeout(session.timer);
    this._sessions.delete(sessionId);
    console.log(`[FSM] Session kết thúc: ${sessionId}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // KIỂM TRA KÍch HOẠT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Kiểm tra xem message có kích hoạt luồng đặt hàng không.
   * Gọi ở đầu pipeline TRƯỚC intent classification.
   *
   * @param {string} message
   * @returns {boolean}
   */
  isOrderTrigger(message) {
    const normalized = removeDiacritics(message).toLowerCase();
    return ORDER_TRIGGERS.some(kw => normalized.includes(kw));
  }

  /**
   * Kiểm tra session có đang active không.
   * Nếu active → pipeline phải xử lý qua FSM, không chạy NLP classifier.
   *
   * @param {string} sessionId
   * @returns {boolean}
   */
  isActive(sessionId) {
    return this._sessions.has(sessionId);
  }

  // ─────────────────────────────────────────────────────────────────
  // XỬ LÝ TRANSITION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Xử lý input từ khách trong context FSM.
   * Hàm chính — gọi mỗi lần nhận được message từ khách.
   *
   * @param {string} sessionId
   * @param {string} message
   * @returns {FSMResult}
   *
   * @typedef {Object} FSMResult
   * @property {string}      text        - Câu hỏi/xác nhận tiếp theo
   * @property {boolean}     isCompleted - true khi hoàn tất đặt hàng
   * @property {boolean}     isCancelled - true khi khách hủy
   * @property {Object|null} orderData   - Thông tin đơn hàng (chỉ khi isCompleted=true)
   */
  process(sessionId, message) {
    const normalized = removeDiacritics(message).toLowerCase().trim();

    // ── Kiểm tra hủy (bất kỳ trạng thái nào) ───────────────────────
    if (CANCEL_KEYWORDS.some(kw => normalized.includes(kw))) {
      this._destroySession(sessionId);
      return {
        text:        'Dạ anh/chị đã hủy yêu cầu đặt hàng ạ. Nếu muốn thử lại, anh/chị nhắn "tôi muốn đặt hàng" nhé ạ!',
        isCompleted: false,
        isCancelled: true,
        orderData:   null,
      };
    }

    const session = this._getSession(sessionId);
    if (!session) {
      // Không có session → tạo mới
      const newSession = this._createSession(sessionId);
      return {
        text: 'Dạ anh/chị muốn đặt mua sản phẩm nào ạ? Anh/chị cho em biết tên sản phẩm nhé!',
        isCompleted: false,
        isCancelled: false,
        orderData:   null,
      };
    }

    this._resetTimer(sessionId, session);

    // ── Xử lý theo trạng thái hiện tại ─────────────────────────────
    switch (session.state) {

      case STATE.COLLECTING_PRODUCT: {
        // Khách nhập tên sản phẩm
        if (message.trim().length < 2) {
          return {
            text: 'Dạ anh/chị chưa nêu tên sản phẩm ạ. Anh/chị muốn mua sản phẩm gì (ví dụ: iPhone 15, Samsung Galaxy S24...)?',
            isCompleted: false,
            isCancelled: false,
            orderData:   null,
          };
        }
        session.product = message.trim();
        session.state   = STATE.COLLECTING_ADDRESS;
        return {
          text: `Dạ em ghi nhận anh/chị muốn mua **${session.product}** ạ! 📦\nAnh/chị vui lòng cho em **địa chỉ giao hàng** đầy đủ nhé ạ? (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành)`,
          isCompleted: false,
          isCancelled: false,
          orderData:   null,
        };
      }

      case STATE.COLLECTING_ADDRESS: {
        if (message.trim().length < 10) {
          return {
            text: 'Dạ anh/chị vui lòng nhập địa chỉ đầy đủ hơn nhé ạ! Ví dụ: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"',
            isCompleted: false,
            isCancelled: false,
            orderData:   null,
          };
        }
        session.address = message.trim();
        session.state   = STATE.COLLECTING_PHONE;
        return {
          text: `Dạ đã ghi nhận địa chỉ: **${session.address}** ạ! ✅\nCuối cùng, anh/chị cho em **số điện thoại** liên hệ nhé ạ? (Để shipper liên hệ khi giao hàng)`,
          isCompleted: false,
          isCancelled: false,
          orderData:   null,
        };
      }

      case STATE.COLLECTING_PHONE: {
        // Kiểm tra SĐT hợp lệ
        const phoneMatch = message.match(VN_PHONE_REGEX);
        if (!phoneMatch) {
          return {
            text: 'Dạ số điện thoại chưa hợp lệ ạ! Anh/chị kiểm tra lại nhé, số điện thoại Việt Nam gồm 10 số (ví dụ: 0912345678).',
            isCompleted: false,
            isCancelled: false,
            orderData:   null,
          };
        }
        session.phone = phoneMatch[0];
        session.state = STATE.CONFIRMING;

        // Hiển thị tóm tắt để xác nhận
        const summary = [
          '📋 **Thông tin đơn hàng:**',
          `🛍️ Sản phẩm: **${session.product}**`,
          `📍 Địa chỉ: ${session.address}`,
          `📱 SĐT: ${session.phone}`,
          '',
          'Anh/chị xác nhận đặt hàng không ạ? (Nhắn **"đồng ý"** hoặc **"hủy"**)',
        ].join('\n');

        return {
          text: summary,
          isCompleted: false,
          isCancelled: false,
          orderData:   null,
        };
      }

      case STATE.CONFIRMING: {
        const isConfirmed = CONFIRM_YES.some(kw => normalized.includes(kw));
        if (!isConfirmed) {
          return {
            text: 'Dạ anh/chị muốn xác nhận đặt hàng không ạ? Nhắn **"đồng ý"** để đặt hoặc **"hủy"** để thôi nhé ạ!',
            isCompleted: false,
            isCancelled: false,
            orderData:   null,
          };
        }

        // ✅ Xác nhận thành công
        const orderData = {
          product: session.product,
          address: session.address,
          phone:   session.phone,
          createdAt: new Date().toISOString(),
        };

        this._destroySession(sessionId);

        return {
          text: [
            '🎉 **Đặt hàng thành công!**',
            '',
            `✅ Đơn hàng **${orderData.product}** đã được ghi nhận ạ!`,
            `📍 Giao đến: ${orderData.address}`,
            `📱 SĐT: ${orderData.phone}`,
            '',
            'Nhân viên sẽ liên hệ xác nhận đơn trong vòng **30 phút** ạ. Cảm ơn anh/chị đã tin tưởng Getshopy! 💛',
          ].join('\n'),
          isCompleted: true,
          isCancelled: false,
          orderData,
        };
      }

      default: {
        this._destroySession(sessionId);
        return {
          text: 'Dạ có lỗi xảy ra ạ! Anh/chị thử lại từ đầu nhé ạ.',
          isCompleted: false,
          isCancelled: true,
          orderData: null,
        };
      }
    }
  }

  /**
   * Khởi động luồng đặt hàng cho session.
   * Gọi khi phát hiện ORDER_TRIGGER intent.
   *
   * @param {string} sessionId
   * @returns {FSMResult}
   */
  startOrder(sessionId) {
    // Nếu đã có session → thông báo đang đặt hàng
    if (this.isActive(sessionId)) {
      const session = this._getSession(sessionId);
      return {
        text: `Dạ anh/chị đang trong quá trình đặt hàng ạ! Hiện đang ở bước: ${this._getStateName(session.state)}. Anh/chị tiếp tục nhé, hoặc nhắn "hủy" để bắt đầu lại ạ.`,
        isCompleted: false,
        isCancelled: false,
        orderData: null,
      };
    }

    this._createSession(sessionId);
    return {
      text: 'Dạ tuyệt ạ! Em sẽ hỗ trợ anh/chị đặt hàng. Anh/chị muốn mua **sản phẩm nào** ạ? (Ví dụ: iPhone 15 Pro 256GB màu đen)',
      isCompleted: false,
      isCancelled: false,
      orderData: null,
    };
  }

  _getStateName(state) {
    const names = {
      [STATE.COLLECTING_PRODUCT]: 'Chọn sản phẩm',
      [STATE.COLLECTING_ADDRESS]: 'Nhập địa chỉ',
      [STATE.COLLECTING_PHONE]:   'Nhập số điện thoại',
      [STATE.CONFIRMING]:         'Xác nhận đơn hàng',
    };
    return names[state] || state;
  }
}

/** Export STATE constants để dùng trong ai.js */
module.exports = FSM;
module.exports.STATE = STATE;

/** Singleton */
const fsmInstance = new FSM();
module.exports.fsm = fsmInstance;
