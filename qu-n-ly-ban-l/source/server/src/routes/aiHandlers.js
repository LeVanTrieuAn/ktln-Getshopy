/**
 * ============================================================
 * XỬ LÝ Ý ĐỊNH MỞ RỘNG VỚI LỊCH SỬ HỘI THOẠI
 * aiHandlers.js — Getshopy AI Chatbot Engine
 * ============================================================
 *
 * @module aiHandlers
 * @description
 *   Module trung tâm xử lý 30+ Intent của Chatbot bán hàng điện tử.
 *
 *   Bao gồm:
 *     [1] ConversationQueue  — Hàng đợi FIFO, tối đa 10 tin nhắn/phiên
 *     [2] Diverse Responses  — Mỗi Intent có 5-8 câu trả lời ngẫu nhiên
 *     [3] Context-Aware      — Phân tích lịch sử hội thoại để trả lời phù hợp
 *     [4] DB-Driven          — Kéo dữ liệu thực từ Prisma (giá, tồn kho, đánh giá)
 *
 * @author  Getshopy AI Team
 * @version 2.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────
const dbModule = require('../db');
const prisma = dbModule.prisma || dbModule;

// ═════════════════════════════════════════════════════════════════════════════
// PHẦN 1: BỘ NHỚ ĐỆM HỘI THOẠI — CONVERSATION QUEUE
// Cấu trúc dữ liệu FIFO, giữ tối đa MAX_HISTORY tin nhắn mỗi phiên.
// Tin nhắn thứ 11 trở đi sẽ tự động đẩy tin số 1 ra khỏi hàng đợi.
// ═════════════════════════════════════════════════════════════════════════════

/** Số tin nhắn tối đa được giữ trong bộ nhớ */
const MAX_HISTORY = 10;

/** Thời gian phiên hội thoại tự động hết hạn (30 phút không hoạt động) */
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * @class ConversationQueue
 * @description
 *   Quản lý lịch sử hội thoại theo từng phiên (session).
 *   Mỗi phiên lưu tối đa MAX_HISTORY tin nhắn gần nhất.
 *   Khi có tin nhắn thứ MAX_HISTORY+1, tin nhắn cũ nhất bị loại bỏ (FIFO).
 *   Phiên tự hủy sau SESSION_TTL_MS nếu không có hoạt động.
 *
 * @example
 *   const queue = new ConversationQueue();
 *   queue.push('user123', 'user', 'Tôi muốn mua iPhone');
 *   queue.push('user123', 'assistant', 'Dạ bên em có nhiều model iPhone ạ!');
 *   console.log(queue.get('user123')); // [{role:'user',...}, {role:'assistant',...}]
 */
class ConversationQueue {
  constructor() {
    /**
     * Map lưu trữ dữ liệu các phiên hội thoại.
     * Key: sessionId (string)
     * Value: { messages: Array, timer: NodeJS.Timeout }
     * @type {Map<string, {messages: Array<{role:string, content:string, ts:number}>, timer: NodeJS.Timeout|null}>}
     */
    this._store = new Map();
  }

  /**
   * Thêm một tin nhắn vào hàng đợi của phiên.
   * Nếu số tin nhắn vượt MAX_HISTORY, tin cũ nhất bị loại bỏ.
   *
   * @param {string}            sessionId - Định danh phiên hội thoại
   * @param {'user'|'assistant'} role     - Người gửi
   * @param {string}            content  - Nội dung tin nhắn
   * @returns {void}
   */
  push(sessionId, role, content) {
    if (!this._store.has(sessionId)) {
      this._store.set(sessionId, { messages: [], timer: null });
    }

    const session = this._store.get(sessionId);

    // Reset bộ đếm TTL mỗi lần có hoạt động
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this._store.delete(sessionId);
    }, SESSION_TTL_MS);

    // Thêm tin nhắn mới vào cuối hàng đợi
    session.messages.push({ role, content, ts: Date.now() });

    // Loại bỏ tin nhắn cũ nhất nếu vượt giới hạn (FIFO)
    while (session.messages.length > MAX_HISTORY) {
      session.messages.shift();
    }
  }

  /**
   * Lấy toàn bộ lịch sử tin nhắn của phiên (tối đa MAX_HISTORY).
   *
   * @param {string} sessionId
   * @returns {Array<{role: string, content: string, ts: number}>}
   */
  get(sessionId) {
    return this._store.get(sessionId)?.messages ?? [];
  }

  /**
   * Xóa toàn bộ lịch sử của phiên (reset cuộc hội thoại).
   *
   * @param {string} sessionId
   * @returns {void}
   */
  clear(sessionId) {
    const session = this._store.get(sessionId);
    if (session?.timer) clearTimeout(session.timer);
    this._store.delete(sessionId);
  }

  /**
   * Số phiên hội thoại đang hoạt động.
   * @type {number}
   */
  get size() {
    return this._store.size;
  }
}

/**
 * Singleton instance — tất cả request trong cùng tiến trình dùng chung.
 * @type {ConversationQueue}
 */
const conversationStore = new ConversationQueue();

// ═════════════════════════════════════════════════════════════════════════════
// PHẦN 2: HÀM TIỆN ÍCH — UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Chọn ngẫu nhiên một phần tử từ mảng.
 * Dùng để đa dạng hóa câu trả lời — mỗi lần AI trả lời khác đi.
 *
 * @template T
 * @param {T[]} arr - Mảng các lựa chọn
 * @returns {T}
 */
function pick(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Format số tiền theo định dạng tiền Việt Nam (VND).
 * Ví dụ: 15990000 → "15.990.000 ₫"
 *
 * @param {number} n - Số tiền (đơn vị đồng)
 * @returns {string}
 */
function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

/**
 * Format số tiền dạng ngắn gọn (triệu).
 * Ví dụ: 15990000 → "~16 triệu"
 *
 * @param {number} n - Số tiền (đơn vị đồng)
 * @returns {string}
 */
function fmtShort(n) {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(0)} triệu`;
  if (n >= 1_000) return `~${(n / 1_000).toFixed(0)}k`;
  return `${n}đ`;
}

/**
 * Loại bỏ dấu tiếng Việt khỏi chuỗi để chuẩn hoá trước khi matching.
 * Dùng để các hàm detect/extract hoạt động bất kể user gõ có dấu hay không.
 *
 * Cách hoạt động:
 *   1. Tách ký tự thành base + combining marks (NFD)
 *   2. Xoá toàn bộ combining diacritical marks (U+0300–U+036F)
 *   3. Thay đ/Đ thủ công (đây là ký tự riêng, không phân tách NFD)
 *
 * @example
 *   removeDiacritics('Giao hàng nhanh không?') // 'Giao hang nhanh khong?'
 *   removeDiacritics('Tôi muốn mua iPhone')    // 'Toi muon mua iPhone'
 *
 * @param {string} str
 * @returns {string}
 */
function removeDiacritics(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // xoá combining diacritical marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Danh sách các brand/model phổ biến để nhận diện trong lịch sử hội thoại.
 * @type {string[]}
 */
const KNOWN_BRANDS = [
  'iphone', 'samsung', 'macbook', 'ipad', 'airpods', 'apple watch',
  'google pixel', 'pixel', 'xiaomi', 'redmi', 'oppo', 'vivo', 'realme',
  'sony', 'dell', 'asus', 'hp', 'lenovo', 'acer', 'msi', 'lg',
  'galaxy', 'note', 'fold', 'flip', 'huawei', 'honor',
];

/**
 * Trích xuất tên brand/sản phẩm từ lịch sử hội thoại gần nhất.
 * Quét ngược từ tin nhắn mới nhất đến cũ nhất.
 *
 * @param {Array<{role:string, content:string}>} history - Lịch sử hội thoại
 * @returns {string|null} - Tên sản phẩm/brand hoặc null nếu không tìm thấy
 */
function extractProductFromHistory(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    // Normalize về không dấu để match được cả 'Iphone' lẫn 'iPhone'
    const content = removeDiacritics(history[i].content).toLowerCase();
    for (const brand of KNOWN_BRANDS) {
      if (content.includes(brand)) {
        // Trích xuất tên đầy đủ: brand + model tiếp theo nếu có
        const regex = new RegExp(
          `${brand.replace(' ', '\\s+')}[\\s]?[\\w]+?(?=[\\s,!?]|$)`, 'i'
        );
        const match = content.match(regex);
        return match ? match[0].trim() : brand;
      }
    }
  }
  return null;
}

/**
 * Trích xuất ngân sách từ câu nhắn hiện tại.
 * Nhận diện các mẫu: "10 triệu", "5tr", "500k", "1.5 củ", v.v.
 *
 * @param {string} message
 * @returns {{ amount: number, raw: string } | null}
 */
function extractBudget(message) {
  // Normalize về không dấu để match được cả 'triệu' lẫn 'trieu', 'củ' lẫn 'cu', v.v.
  const normalized = removeDiacritics(message);
  const pattern = /(\d+(?:[,\.]\d+)?)\s*(trieu|tr|cu|k|nghin)/i;
  const match = normalized.match(pattern);
  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  const amount = (unit === 'k' || unit === 'nghin')
    ? num * 1_000
    : num * 1_000_000;

  return { amount, raw: match[0] };
}

/**
 * Trích xuất ngân sách từ lịch sử hội thoại (tìm tin nhắn gần nhất có nhắc budget).
 *
 * @param {Array<{role:string, content:string}>} history
 * @returns {number|null} - Ngân sách tính bằng VND hoặc null
 */
function extractBudgetFromHistory(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const result = extractBudget(history[i].content);
    if (result) return result.amount;
  }
  return null;
}

/**
 * Kiểm tra tin nhắn có chứa từ khóa liên quan không (case-insensitive).
 *
 * @param {string}   message
 * @param {string[]} keywords
 * @returns {boolean}
 */
function hasKeyword(message, keywords) {
  // Normalize cả message lẫn keyword để match bất kể có dấu hay không
  const lower = removeDiacritics(message).toLowerCase();
  return keywords.some(kw => lower.includes(removeDiacritics(kw).toLowerCase()));
}

/**
 * Tính phần trăm giảm giá giữa giá gốc và giá bán.
 *
 * @param {number} originalPrice
 * @param {number} salePrice
 * @returns {number} - Phần trăm giảm (0 nếu không giảm)
 */
function calcDiscount(originalPrice, salePrice) {
  if (!originalPrice || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

// ═════════════════════════════════════════════════════════════════════════════
// PHẦN 3: BỘ CÂU TRẢ LỜI ĐA DẠNG — RESPONSE POOLS
// Mỗi Intent có 5-8 biến thể câu trả lời khác nhau.
// Hàm pick() chọn ngẫu nhiên để AI không bị lặp lại.
// ═════════════════════════════════════════════════════════════════════════════

const POOL = {

  // ─────────────── ASK_TRADE_IN ─────────────────────────────────────────────
  TRADE_IN: [
    'Dạ bên em có chương trình **Thu Cũ Đổi Mới** rất hấp dẫn ạ! Anh/chị mang máy cũ đến, nhân viên kiểm tra và định giá ngay trong **15 phút** ạ. Giá thu dựa trên: tình trạng máy, thế hệ và dung lượng nhé ạ. Anh/chị đang muốn trade-in dòng nào ạ?',
    'Dạ tất nhiên ạ! Bên em thu mua máy cũ với **giá tốt nhất thị trường** ạ. Quy trình rất đơn giản: mang máy vào → nhân viên định giá → bù thêm tiền chênh → nhận máy mới ạ. Chỉ mất khoảng 30 phút ạ!',
    'Dạ chương trình **Trade-in** bên em đang rất hot đó ạ! Không chỉ iPhone, bên em còn thu Samsung, Xiaomi, OPPO, laptop cũ nữa ạ. Anh/chị cho em biết máy cũ model gì để em ước tính giá thu cho anh/chị nhé ạ?',
    'Dạ lên đời máy mới thì để bên em lo ạ! Mang máy cũ đến, nếu còn bảo hành thì giá thu cao hơn đáng kể đó ạ. Anh/chị đang dùng máy gì và muốn đổi sang dòng nào ạ?',
    'Dạ bên em nhận thu máy cũ kể cả máy hỏng hay máy lỗi ạ! Tất nhiên giá thu sẽ thấp hơn nhưng vẫn tốt hơn bán ngoài ạ. Anh/chị mang máy đến để kỹ thuật viên kiểm tra và báo giá ngay nhé ạ!',
    'Dạ hay quá ạ, anh/chị muốn trade-in rồi đây! Bên em định giá thu ngay tại chỗ, minh bạch 100%, không bị ép giá ạ. Anh/chị cần mang theo: máy cũ + hộp (nếu có) + phụ kiện gốc ạ!',
  ],

  TRADE_IN_WITH_PRODUCT: (name) => [
    `Dạ với **${name}** cũ, giá thu phụ thuộc vào tình trạng máy ạ. Máy đẹp không trầy, còn bảo hành thì giá thu tốt hơn nhiều ạ. Anh/chị mang máy đến để nhân viên định giá chính xác nhé ạ!`,
    `Dạ **${name}** bên em thu thường xuyên ạ! Máy này vẫn còn giá trị tốt trên thị trường ạ. Anh/chị muốn trade-in để đổi sang dòng nào ạ? Em tính giá chênh lệch giúp anh/chị luôn ạ.`,
    `Dạ nhận **${name}** rồi ạ! Bên em sẽ kiểm tra: màn hình, pin (dung lượng còn lại), vỏ ngoài và cổng kết nối ạ. Anh/chị cứ mang đến, định giá xong mới quyết định có đổi không, không bị ép ạ!`,
  ],

  // ─────────────── ASK_AUTHENTIC ───────────────────────────────────────────
  AUTHENTIC: [
    'Dạ **100% hàng chính hãng** ạ! Bên em cam kết: có tem IMEI hợp lệ, có hóa đơn VAT, bảo hành tại trung tâm hãng ạ. Anh/chị hoàn toàn có thể kiểm tra IMEI trên website Apple/Samsung ngay khi nhận hàng ạ. Phát hiện hàng giả — hoàn tiền gấp đôi ạ!',
    'Dạ toàn bộ sản phẩm bên em là **hàng chính hãng nhập khẩu hợp pháp** ạ! Không có hàng xách tay, hàng lock, hàng nhái ạ. Anh/chị mua iPhone thì bảo hành Apple Vietnam, mua Samsung thì bảo hành Samsung Vietnam đầy đủ ạ.',
    'Dạ câu hỏi rất quan trọng ạ! Bên em là **đại lý ủy quyền chính thức**, hàng nhập thẳng từ nhà phân phối không qua trung gian ạ. Anh/chị cứ kiểm tra IMEI sau khi mua, em đảm bảo hợp lệ 100% ạ!',
    'Dạ yên tâm ạ! Khi anh/chị mua, em sẽ **kích hoạt bảo hành ngay trước mặt** để xác nhận máy mới tinh và đăng ký bảo hành hợp lệ ạ. Minh bạch từ đầu đến cuối ạ!',
    'Dạ bên em có **giấy chứng nhận đại lý** từ các hãng lớn ạ. Không lo hàng giả nhé ạ! Muốn thêm an tâm thì anh/chị có thể thanh toán qua cổng bảo hộ người mua của ngân hàng ạ.',
    'Dạ hàng chính hãng hoàn toàn ạ! Tem niêm phong, seal nguyên vẹn khi giao ạ. Nếu seal bị rách khi nhận hàng, anh/chị có quyền từ chối nhận và bên em đổi hàng ngay ạ!',
  ],

  // ─────────────── ASK_DISCOUNT_SPECIAL ───────────────────────────────────
  DISCOUNT_SPECIAL: [
    'Dạ bên em có nhiều ưu đãi ạ! **Sinh viên** xuất trình thẻ được giảm thêm 3%, **mua từ 2 sản phẩm** giảm 5%, **khách VIP Gold** giảm 10% mọi lúc ạ. Anh/chị đang thuộc nhóm nào để em áp đúng ưu đãi nhé ạ?',
    'Dạ anh/chị hỏi đúng thời điểm ạ! Hiện bên em đang có **Flash Sale cuối tuần**, giảm đến 15% cho nhiều dòng ạ. Đặt online còn được voucher freeship thêm ạ. Anh/chị muốn xem sản phẩm nào đang giảm không ạ?',
    'Dạ có chứ ạ! Thanh toán bằng **thẻ tín dụng BIDV, Vietcombank, Techcombank** còn được giảm thêm 2-5% nữa ạ. Cộng dồn với ưu đãi sản phẩm thì anh/chị tiết kiệm được kha khá đó ạ!',
    'Dạ bên em có **chương trình Giới thiệu bạn bè** ạ! Anh/chị giới thiệu 1 người mua hàng thành công → nhận ngay **100.000đ** vào ví ạ. Không giới hạn số lần ạ!',
    'Dạ nếu anh/chị là **thành viên mới đăng ký lần đầu**, bên em tặng ngay mã giảm **5%** cho đơn hàng đầu tiên ạ! Đăng ký chỉ mất 1 phút ạ. Anh/chị đã có tài khoản chưa ạ?',
  ],

  // ─────────────── ASK_REPAIR ──────────────────────────────────────────────
  REPAIR: [
    'Dạ bên em có **Trung Tâm Bảo Hành & Sửa Chữa** đầy đủ ạ! Thay màn hình, thay pin, sửa bo mạch, xử lý lỗi phần mềm đều được ạ. Anh/chị mang máy đến, kỹ thuật viên kiểm tra **miễn phí** và báo giá trước khi sửa ạ. Không sửa không mất tiền nhé ạ!',
    'Dạ máy trong **bảo hành** thì sửa miễn phí hoàn toàn ạ! Máy hết bảo hành thì báo giá cụ thể trước khi làm ạ. Anh/chị máy đang gặp vấn đề gì để em tư vấn sơ bộ trước nhé ạ?',
    'Dạ nhận sửa được ạ! Thay màn hình mất **1-2 tiếng**, thay pin **30 phút**, lỗi phần mềm xử lý ngay tại quầy ạ. Anh/chị muốn đặt lịch sửa trước để không phải chờ không ạ?',
    'Dạ kỹ thuật viên bên em có chứng chỉ kỹ thuật ạ, không lo sửa sai làm hỏng máy ạ. Chỉ dùng linh kiện chính hãng hoặc linh kiện chất lượng cao ạ. Anh/chị đang cần sửa vấn đề gì ạ?',
    'Dạ máy vào nước cần xử lý **càng nhanh càng tốt** ạ! Anh/chị tắt nguồn ngay, không sạc, rút sim ra và mang đến bên em ngay nhé ạ. Đừng cho vào túi gạo hay sấy tóc vì không có tác dụng và có thể hỏng thêm ạ!',
    'Dạ anh/chị có thể đặt lịch sửa qua chat này ạ! Em sẽ ghi nhận thông tin: model máy, vấn đề gặp phải và thời gian muốn mang đến ạ. Nhân viên sẽ chuẩn bị linh kiện sẵn để rút ngắn thời gian chờ ạ!',
  ],

  // ─────────────── ASK_CAMERA ──────────────────────────────────────────────
  CAMERA: [
    'Dạ về camera ạ! Hiện **iPhone 15 Pro** và **Samsung S24 Ultra** đang là top đầu ạ. iPhone thiên về màu sắc tự nhiên, Samsung thiên về zoom xa ạ. Anh/chị hay chụp thể loại nào (selfie, đêm, phong cảnh) để em gợi ý đúng hơn nhé ạ?',
    'Dạ nhiều megapixel không có nghĩa là chụp đẹp hơn đâu ạ! Quan trọng là **thuật toán AI xử lý ảnh** ạ. Google Pixel nổi tiếng về ảnh đêm, iPhone về màu sắc tự nhiên, Samsung về zoom ạ. Anh/chị muốn ưu tiên yếu tố nào ạ?',
    'Dạ anh/chị hay quay TikTok/Reels thì cần chú ý **chống rung (OIS/EIS)** và khả năng quay **4K 60fps** ạ! Bên em có vài mẫu rất phù hợp ạ. Budget anh/chị tầm bao nhiêu ạ?',
    'Dạ selfie hay camera sau ạ? Selfie thì **OPPO Reno, Samsung A-series** rất tốt ạ. Camera sau chuyên nghiệp thì cần lên flagship như **iPhone Pro, Samsung Ultra, Google Pixel** ạ. Anh/chị dùng chủ yếu là gì ạ?',
    'Dạ nếu mục tiêu là **chụp ảnh đêm đẹp** thì Google Pixel 8 và iPhone 15 Pro đang được giới chuyên môn đánh giá cao nhất ạ! Bên em đang có cả 2 dòng, anh/chị muốn xem không ạ?',
    'Dạ cho em hỏi thêm một chút ạ: anh/chị chủ yếu chụp bằng **điện thoại** hay cần **máy ảnh/camera chuyên nghiệp**? Nếu điện thoại thì em gợi ý khác, nếu máy ảnh thì bên em cũng có một số model phù hợp ạ.',
  ],

  CAMERA_WITH_PRODUCT: (name) => [
    `Dạ **${name}** được đánh giá rất tốt về camera ạ! Anh/chị click "Xem ngay" để xem ảnh sample thực tế và thông số chi tiết nhé ạ. Bên em có cả video review thực tế nữa ạ!`,
    `Dạ camera của **${name}** có điểm nổi bật là ${pick(['khẩu độ lớn chụp đêm xuất sắc', 'zoom quang học tốt', 'selfie AI làm đẹp thông minh', 'chụp siêu tốc không bị mờ'])} ạ! Anh/chị xem thêm ảnh mẫu tại trang sản phẩm nhé ạ.`,
    `Dạ đây là câu hỏi nhiều khách hay hỏi về **${name}** ạ! Camera dòng này được review rất tốt trên YouTube bởi nhiều tech reviewer nổi tiếng ạ. Anh/chị muốn em gửi link review không ạ?`,
  ],

  // ─────────────── ASK_BATTERY ─────────────────────────────────────────────
  BATTERY: [
    'Dạ về pin ạ! Dung lượng lớn nhất hiện tại là các dòng Android 5000-6000mAh ạ. iPhone nhỏ hơn nhưng tối ưu rất tốt nên dùng cả ngày không lo ạ. Anh/chị hay dùng nặng (game, video, camera) hay nhẹ để em tư vấn đúng ạ?',
    'Dạ sạc nhanh hiện nay **khủng lắm** ạ! Xiaomi, OPPO có sạc 65-120W, đầy pin trong 20-30 phút ạ. Samsung 45W, iPhone Pro 27W ạ. Còn sạc không dây thì MagSafe 15W, Samsung Wireless 15W ạ. Anh/chị cần tính năng nào ạ?',
    'Dạ **pin 5000mAh** là mức khuyến nghị cho người dùng nặng hiện tại ạ! Chơi game 4-5 tiếng, quay video liên tục vẫn đủ dùng cả ngày ạ. Anh/chị muốn xem dòng nào có pin trâu nhất không ạ?',
    'Dạ một tip nhỏ ạ: giữ pin trong khoảng **20-80%** sẽ kéo dài tuổi thọ pin ạ. Các flagship mới đều có chế độ Optimized Charging tự động học thói quen sạc của anh/chị ạ. Rất tiện lợi ạ!',
    'Dạ sạc không dây có tiện nhưng chậm hơn sạc có dây ạ! Nếu anh/chị hay phải sạc gấp thì nên dùng cáp ạ. MagSafe của Apple rất tiện vì gắn vào snap tự dính, đặt xuống là sạc ngay ạ. Anh/chị dùng iPhone hay Android ạ?',
  ],

  // ─────────────── ASK_DISPLAY ─────────────────────────────────────────────
  DISPLAY: [
    'Dạ về màn hình ạ! **AMOLED/OLED** cho màu rực rỡ, đen thật sự, tiết kiệm pin khi dùng dark mode ạ. **IPS LCD** màu tự nhiên hơn, không lo burn-in ạ. Gaming nên chọn **120Hz+** để mượt mà ạ. Anh/chị dùng điện thoại hay laptop để em tư vấn đúng nhé ạ?',
    'Dạ **120Hz là chuẩn tối thiểu** hiện nay ạ! Kéo feed mượt hơn, animation đẹp hơn hẳn 60Hz ạ. Gaming thì 144Hz hay 165Hz càng ngon ạ. Điện thoại mid-range bây giờ đã 90-120Hz hết rồi ạ, không cần phải lên flagship mới có ạ.',
    'Dạ nếu hay dùng ngoài trời nắng thì nên chọn màn hình **1000 nits+** ạ! iPhone 15 Pro Max đạt 2000 nits, Samsung S24 Ultra đạt 2600 nits — nhìn rõ ngay dưới nắng gắt ạ.',
    'Dạ màn **OLED** lưu ý có thể bị **burn-in** nếu dùng một ảnh tĩnh quá lâu (ví dụ thanh điều hướng luôn hiện) ạ. Nhưng thực tế dùng bình thường mấy năm không sao ạ. Chỉ cần bật tắt hình nền đôi khi ạ!',
    'Dạ màn cảm ứng cho laptop (touchscreen) thì rất tiện để dùng bút cảm ứng hoặc thao tác trực tiếp ạ. Surface Pro và một số laptop ASUS, Dell XPS có màn cảm ứng đẹp ạ. Anh/chị có cần tính năng này không ạ?',
  ],

  // ─────────────── ASK_STORAGE ─────────────────────────────────────────────
  STORAGE: [
    'Dạ về bộ nhớ ạ! **128GB** đủ cho người dùng bình thường (chat, mạng xã hội, ảnh) ạ. **256GB** nên chọn nếu hay quay video 4K, lưu nhạc/phim offline ạ. **512GB+** cho content creator ạ. Anh/chị dùng theo hướng nào ạ?',
    'Dạ **RAM và ROM** là hai thứ khác nhau ạ! RAM ảnh hưởng đa nhiệm (mở nhiều app), ROM là nơi lưu file ạ. Nên chọn **8GB RAM+** để dùng mượt lâu dài ạ. Nếu anh/chị hay mở nhiều app cùng lúc thì 12GB RAM tốt hơn ạ.',
    'Dạ iPhone không có khe thẻ nhớ nên cần mua đủ dung lượng ngay từ đầu ạ! Nhiều Android vẫn có khe microSD — tiết kiệm hơn vì có thể nâng cấp sau ạ. Anh/chị đang xem dòng nào để em tư vấn đúng nhé ạ?',
    'Dạ nếu lo hết bộ nhớ thì anh/chị có thể dùng **cloud** ạ! iCloud cho iPhone (từ 29.000đ/tháng), Google One cho Android (từ 29.000đ/tháng) ạ. Lưu ảnh/video tự động, máy luôn đủ bộ nhớ ạ.',
    'Dạ SSD cho laptop thì nhanh hơn HDD cực kỳ nhiều ạ! Boot Windows trong **10-15 giây**, mở app gần như tức thì ạ. Bên em laptop đều là **SSD NVMe** hết rồi, không bán laptop HDD nữa ạ!',
  ],

  // ─────────────── ASK_CONNECTIVITY ───────────────────────────────────────
  CONNECTIVITY: [
    'Dạ về kết nối, flagship hiện tại đều có đủ **5G, WiFi 6E, Bluetooth 5.3, NFC** ạ! NFC dùng để thanh toán không chạm (Apple Pay, Samsung Pay, Google Pay) ạ. Anh/chị cần tính năng kết nối đặc biệt nào ạ?',
    'Dạ **5G** đã phủ sóng rộng ở các thành phố lớn ạ! Tốc độ tải nhanh hơn 4G nhiều lần ạ. Tuy nhiên pin 5G tốn hơn 4G một chút ạ. Nếu vùng anh/chị đang ở chưa có 5G thì chọn máy 4G vẫn ổn ạ.',
    'Dạ anh/chị hỏi về cổng kết nối đúng không ạ? **USB-C** đang là chuẩn phổ biến, kể cả iPhone 15 đã chuyển từ Lightning sang USB-C ạ. Thunderbolt 4 trên MacBook cho tốc độ truyền dữ liệu siêu nhanh ạ!',
    'Dạ **NFC thanh toán** rất tiện lợi ạ! Chỉ cần liên kết ví MoMo/ZaloPay/VietQR với NFC trên máy là thanh toán bằng cách đưa máy gần terminal ạ. Không cần mở app, không cần kết nối internet ạ!',
    'Dạ hỏi về 2 SIM hay eSIM ạ? **eSIM** tiện lợi vì không cần thẻ vật lý, chỉ scan QR là kích hoạt ạ. iPhone 15 có thể dùng đến 8 eSIM ạ. Anh/chị hay đi nước ngoài không, eSIM rất tiện khi đó ạ!',
  ],

  // ─────────────── ASK_GAMING ──────────────────────────────────────────────
  GAMING: [
    'Dạ tìm máy gaming đây ạ! Với điện thoại cần: chip mạnh (Snapdragon 8 Gen 3 hoặc Apple A17 Pro), RAM 12GB+, màn 120Hz+, pin lớn và **tản nhiệt tốt** ạ. Budget anh/chị tầm bao nhiêu để em gợi ý cụ thể nhé ạ?',
    'Dạ laptop gaming thì cần: card đồ họa rời **RTX 4060+**, RAM 16GB, SSD NVMe, màn hình **144Hz** minimum ạ. Bên em đang có ASUS ROG, Lenovo LOQ, MSI Gaming từ 18-35 triệu ạ. Anh/chị chơi thể loại game gì ạ?',
    'Dạ mobile gaming nặng như Genshin Impact hay PUBG PC cần **Snapdragon 8 Gen 2+** hoặc Dimensity 9300 ạ. Nhiệt độ khi chơi game lâu cũng rất quan trọng — máy tản nhiệt kém sẽ giảm hiệu suất ạ. Anh/chị có muốn xem điện thoại gaming chuyên dụng không ạ?',
    'Dạ **ASUS ROG Phone** là dòng gaming phone chuyên dụng nhất ạ! Tản nhiệt đặc biệt, nút trigger vật lý, màn 165Hz ạ. Hơi cồng kềnh hơn điện thoại thường nhưng gaming thực sự vượt trội ạ. Anh/chị có quan tâm không ạ?',
    'Dạ tầm **15-20 triệu** thì laptop gaming rất ngon ạ! ASUS TUF hay Lenovo LOQ đang là best value for money tầm giá này ạ. Chạy được hầu hết game AAA ở setting medium-high ạ. Bên em có cả 2 dòng này ạ!',
  ],

  // ─────────────── ASK_NEW_ARRIVAL ─────────────────────────────────────────
  NEW_ARRIVAL: [
    'Dạ bên em đang liên tục cập nhật hàng mới ạ! Anh/chị đăng ký nhận thông báo qua email để được biết ngay khi có hàng mới về nhé ạ. Anh/chị đang quan tâm dòng sản phẩm nào ạ?',
    'Dạ hàng mới về thường được thêm vào website ngay ạ! Anh/chị theo dõi trang chủ hoặc để lại thông tin, em sẽ chủ động thông báo khi có dòng anh/chị quan tâm ạ.',
  ],

  // ─────────────── ASK_BEST_SELLER ─────────────────────────────────────────
  BEST_SELLER: [
    'Dạ bên em có rất nhiều sản phẩm hot đang bán ạ! Anh/chị ghé trang chủ mục **Top Bán Chạy** để xem đầy đủ nhé ạ. Hoặc anh/chị muốn em lọc theo danh mục cụ thể không ạ?',
  ],

  // ─────────────── ASK_PREORDER ────────────────────────────────────────────
  PREORDER: [
    'Dạ bên em hỗ trợ **Pre-order** với nhiều ưu đãi ạ! Đặt trước chỉ cần cọc **500.000đ**, phần còn lại thanh toán khi nhận hàng ạ. Khách pre-order được ưu tiên giao hàng đầu tiên và nhận quà tặng độc quyền ạ!',
    'Dạ đặt trước thật ra rất có lợi đó ạ! Anh/chị **khoá được giá hiện tại**, tránh trường hợp ra mắt mà hết stock hay tăng giá ạ. Cọc nhỏ, an tâm chắc chắn có hàng ạ. Anh/chị muốn pre-order dòng nào ạ?',
    'Dạ **pre-order đang mở** ạ! Ưu đãi: khoá giá + quà tặng độc quyền + giao hàng ưu tiên đợt 1 ạ. Cọc chỉ 500.000đ, không ưng thì hoàn cọc 100% ạ. Anh/chị quan tâm sản phẩm nào ạ?',
    'Dạ với sản phẩm chưa ra mắt, anh/chị có thể **đăng ký thông báo miễn phí** hoặc đặt cọc pre-order ạ. Đăng ký thông báo thì không mất gì, chỉ cần để lại email/SĐT ạ. Anh/chị muốn chọn phương án nào ạ?',
    'Dạ pre-order bên em **hoàn cọc nếu hủy** trước ngày giao hàng ạ! Anh/chị không cần lo mất tiền nếu đổi ý ạ. Tuy nhiên hủy trong 24h cuối trước giao hàng thì phí 10% cọc ạ.',
  ],

  // ─────────────── ASK_INVOICE ────────────────────────────────────────────
  INVOICE: [
    'Dạ bên em xuất **hóa đơn VAT điện tử** đầy đủ theo quy định ạ! Anh/chị nhận hóa đơn qua email trong vòng 24h sau khi nhận hàng ạ. Nếu mua cho công ty, cần cung cấp: Tên công ty, Mã số thuế, Địa chỉ xuất hóa đơn ạ.',
    'Dạ hóa đơn đỏ được ạ! Anh/chị chỉ cần cung cấp **MST và tên công ty** khi đặt hàng ạ. Hóa đơn điện tử gửi về email trong ngày, cần hóa đơn giấy có thể yêu cầu thêm ạ. Hoàn toàn hợp lệ kế toán ạ!',
    'Dạ giá trên website đã **bao gồm VAT 10%** rồi ạ! Anh/chị mua là có hóa đơn ngay, không cần yêu cầu thêm ạ. Muốn xuất theo tên công ty thì cho em MST nhé ạ.',
    'Dạ mua hàng điện tử cho công ty thì bên em làm được hết ạ! Hóa đơn VAT điện tử hợp lệ hoàn toàn ạ. Anh/chị cần số lượng lớn thì còn được giá sỉ kèm hóa đơn đầy đủ ạ!',
  ],

  // ─────────────── ASK_GIFT_WRAP ───────────────────────────────────────────
  GIFT_WRAP: [
    'Dạ bên em có dịch vụ **gói quà miễn phí** và rất đẹp ạ! Chỉ cần ghi chú khi đặt hàng là muốn gói quà ạ. Anh/chị có muốn kèm thiệp chúc mừng với nội dung riêng không ạ?',
    'Dạ tuyệt ạ! Anh/chị mua tặng ai đây? Bên em gói quà **miễn phí**, thiệp viết tay cũng được ạ. Shipper giao hàng ăn mặc lịch sự, sẽ giao trực tiếp như một món quà bất ngờ ạ!',
    'Dạ được ạ! Ngoài gói quà cơ bản, bên em còn có thể **in tên lên ốp lưng**, khắc laser lên một số sản phẩm ạ. Thêm dấu ấn cá nhân cho món quà, đặc biệt hơn nhiều ạ. Anh/chị muốn thêm tùy chọn nào không ạ?',
    'Dạ **gói quà surprise delivery** cũng được ạ! Anh/chị không cần mặt, shipper giao thẳng đến địa chỉ người nhận, quà sẽ là bất ngờ hoàn toàn ạ. Rất lãng mạn và ý nghĩa ạ!',
  ],

  // ─────────────── BULK_ORDER ──────────────────────────────────────────────
  BULK: [
    'Dạ mua số lượng lớn có **chính sách B2B riêng** ạ! Từ 5 sản phẩm giảm 5%, từ 10 giảm 8%, từ 20+ liên hệ riêng để có giá tốt nhất ạ. Anh/chị cần số lượng bao nhiêu và sản phẩm gì ạ?',
    'Dạ mua theo lô thì anh/chị liên hệ bộ phận **Kinh Doanh Doanh Nghiệp** ạ! Em ghi nhận thông tin ngay và có người liên hệ trong **30 phút** ạ. Anh/chị cho em SĐT không ạ?',
    'Dạ đại lý phân phối của bên em được hưởng chiết khấu **10-20%** tùy doanh số ạ! Kèm theo hỗ trợ marketing, trưng bày sản phẩm và đào tạo nhân viên bán hàng ạ. Anh/chị quan tâm hợp tác theo mô hình nào ạ?',
    'Dạ mua ipad/laptop cho cả lớp học hay văn phòng thì bên em hay làm ạ! Có thể phân kỳ thanh toán, xuất hóa đơn VAT toàn bộ ạ. Anh/chị cần bao nhiêu cái và model gì để em báo giá ạ?',
  ],

  // ─────────────── ASK_COMPATIBILITY ──────────────────────────────────────
  COMPATIBILITY: [
    'Dạ về tương thích phụ kiện, anh/chị cần nêu cụ thể phụ kiện + máy đang dùng để em kiểm tra chính xác nhé ạ! Ví dụ: "Cáp USB-C 100W dùng sạc MacBook được không?" ạ.',
    'Dạ tổng quan về tương thích ạ: Cáp **USB-C** dùng chung hầu hết Android + MacBook ạ. Sạc Apple (MagSafe) chỉ cho thiết bị Apple ạ. Tai nghe 3.5mm cắm được mọi thiết bị có jack ạ. **AirPods** kết nối được Android nhưng mất nhiều tính năng ạ.',
    'Dạ anh/chị đang thắc mắc phụ kiện nào với máy nào ạ? Em tra và trả lời chính xác ạ! Cứ mô tả chi tiết nhé, ví dụ "ốp lưng iPhone 14 có vừa iPhone 15 không" ạ.',
    'Dạ **Apple Watch** chỉ dùng được với iPhone ạ, không kết nối được Android nhé ạ. Còn **Samsung Watch** kết nối được cả Android lẫn iPhone (nhưng thiếu tính năng khi dùng với iPhone) ạ. Anh/chị đang cân nhắc đồng hồ nào ạ?',
  ],

  // ─────────────── INSTALLATION_HELP ──────────────────────────────────────
  INSTALLATION: [
    'Dạ bên em có **setup máy mới miễn phí** tại cửa hàng ạ! Bao gồm: tạo tài khoản, chuyển dữ liệu từ máy cũ, cài app thiết yếu, hướng dẫn tính năng cơ bản ạ. Chỉ mất 30-45 phút ạ!',
    'Dạ mua máy về anh/chị làm lần lượt nhé ạ: (1) Đăng nhập Apple ID/Google, (2) Bật iCloud/Google Backup, (3) Cài các app cần thiết ạ. Bước nào khó thì anh/chị nhắn em, em hướng dẫn từng bước ạ!',
    'Dạ chuyển dữ liệu từ Android sang iPhone hay ngược lại bây giờ rất dễ ạ! iPhone có app **Move to iOS** trên Android, Android có **Google Drive backup** ạ. Danh bạ, ảnh, tin nhắn đều chuyển được ạ. Anh/chị muốn chuyển từ đâu sang đâu ạ?',
    'Dạ cài đặt ban đầu xong, anh/chị nên cài ngay **tìm thiết bị của tôi** (Find My Device/Find My iPhone) ạ! Nếu mất máy còn có thể định vị và khóa từ xa ạ. Chức năng bảo mật quan trọng nhất đó ạ!',
  ],

  // ─────────────── ASK_DESIGN ──────────────────────────────────────────────
  DESIGN: [
    'Dạ xu hướng thiết kế hiện tại là **viền mỏng, không notch, đảo động camera** ạ. Chất liệu titan cao cấp hơn nhôm, nhẹ hơn thép ạ. Anh/chị thích dáng nào: màn phẳng hay cong, viền vuông hay bo tròn ạ?',
    'Dạ màu sắc và thiết kế quan trọng vì đây là thứ anh/chị nhìn hàng ngày ạ! Trend hiện tại là tone màu trung tính (Titan vàng, xám, đen), ít sặc sỡ ạ. Anh/chị thích tone màu nào ạ?',
    'Dạ về kích thước ạ: điện thoại **6.1 inch** vừa tay đa số, **6.7 inch** to nhưng xem video/game thoải mái hơn ạ. Laptop 13-14 inch nhỏ gọn mang theo, 15-16 inch màn lớn nhưng nặng hơn ạ. Anh/chị ưu tiên tiêu chí nào ạ?',
    'Dạ trọng lượng cũng quan trọng ạ! Điện thoại dưới **200g** cầm cả ngày thoải mái ạ. Laptop **1.2-1.5kg** là siêu nhẹ, phù hợp đi lại nhiều ạ. Anh/chị hay di chuyển không để em tư vấn thêm nhé ạ?',
    'Dạ điện thoại **nhận dạng khuôn mặt** hay **vân tay** đều rất nhanh và chính xác rồi ạ! iPhone dùng Face ID 3D bảo mật cao nhất, Android có cả 2 tùy dòng ạ. Anh/chị thích mở khóa theo cách nào ạ?',
  ],

  DESIGN_WITH_PRODUCT: (name) => [
    `Dạ về thiết kế của **${name}** ạ! Sản phẩm này nổi bật với ${pick(['thiết kế mỏng nhẹ cao cấp', 'viền titan siêu bền', 'mặt kính cong duyên dáng', 'màu sắc độc đáo riêng biệt'])} ạ. Anh/chị xem đầy đủ hình ảnh 360° tại trang sản phẩm nhé ạ!`,
    `Dạ **${name}** được thiết kế rất kỳ công ạ! Anh/chị click "Xem ngay" để chọn màu yêu thích và xem kích thước chi tiết nhé ạ. Bên em có đủ màu đang có sẵn ạ!`,
  ],

  // ─────────────── ASK_WATERPROOF ──────────────────────────────────────────
  WATERPROOF: [
    'Dạ chuẩn **IP68** là cao nhất trên điện thoại consumer ạ! Nghĩa là chịu được độ sâu 6 mét trong 30 phút ạ. IP67 thì chỉ 1 mét ạ. Lưu ý: **bảo hành không bao gồm lỗi do nước** vì khó chứng minh ạ!',
    'Dạ hầu hết flagship hiện tại đều đạt **IP68** ạ! iPhone 15, Samsung S24, Google Pixel 8 đều IP68 ạ. Tầm mid-range thì IP53 hoặc IP67 ạ. Anh/chị đang xem dòng nào để em kiểm tra chuẩn IP nhé ạ?',
    'Dạ dùng mưa bình thường thì **IP67 là đủ** ạ! Nếu hay tiếp xúc nước nhiều (bơi lội, làm bếp, outdoor) thì nên chọn IP68 và thêm ốp lưng chống nước để an toàn hơn ạ.',
    'Dạ máy dính nước nhẹ (mưa, mồ hôi tay) thì hoàn toàn không sao nếu có chuẩn IP ạ. Nhưng **nước mặn (biển) nguy hiểm hơn nước ngọt** nhiều đó ạ! Muối ăn mòn linh kiện nhanh lắm ạ. Anh/chị hay dùng ở biển không ạ?',
    'Dạ cho anh/chị biết thêm ạ: các nhà sản xuất test IP trong điều kiện phòng lab, **thực tế có thể kém hơn** do trầy xước ảnh hưởng gioăng chống nước ạ. Nên vẫn cẩn thận và không test thần kinh nhé ạ!',
  ],

  // ─────────────── ASK_OS ──────────────────────────────────────────────────
  OS: [
    'Dạ **iOS vs Android** là câu hỏi muôn thuở ạ! iOS đơn giản, bảo mật cao, update lâu dài (5-6 năm) ạ. Android linh hoạt, tùy biến nhiều, đa dạng lựa chọn giá ạ. Anh/chị đang dùng gì và muốn thay đổi không ạ?',
    'Dạ về tuổi thọ phần mềm: iPhone được Apple hỗ trợ **5-6 năm** ạ. Samsung flagship hỗ trợ **4 năm** ạ. Google Pixel hỗ trợ **7 năm** ạ. Đây là tiêu chí quan trọng nếu anh/chị dùng máy lâu dài ạ!',
    'Dạ Windows 11 đã có sẵn trên hầu hết laptop mới bên em ạ! Bản quyền OEM đi kèm máy, không mất thêm tiền ạ. MacOS chỉ có trên Apple Silicon (MacBook), không cài được trên laptop thường ạ.',
    'Dạ cài Linux thì hầu hết laptop đều được ạ! Boot từ USB là xong ạ. Tuy nhiên driver WiFi và âm thanh đôi khi cần config thêm ạ. Anh/chị dùng Linux cho mục đích gì để em tư vấn thêm ạ?',
    'Dạ **Android 14** và **iOS 17** là phiên bản mới nhất hiện tại ạ! Cả hai đều có nhiều tính năng AI mới như tóm tắt thông báo, gợi ý thông minh ạ. Tuy nhiên tính năng AI thường chỉ đầy đủ trên flagship ạ.',
  ],

  // ─────────────── ASK_LOYALTY ─────────────────────────────────────────────
  LOYALTY: [
    'Dạ bên em có **Chương trình Khách hàng Thân thiết** rất hấp dẫn ạ! Mỗi 1.000đ mua hàng = 1 điểm ạ. Tích đủ 500 điểm đổi được 50.000đ giảm giá ạ. Đăng ký miễn phí ngay hôm nay để tích điểm từ đơn này luôn nhé ạ!',
    'Dạ thành viên **VIP Gold** (mua tích lũy > 50 triệu) được: Freeship tất cả đơn, ưu tiên phục vụ, quà sinh nhật, giảm thêm 10% mọi lúc ạ. Anh/chị đã đăng ký thành viên chưa ạ?',
    'Dạ điểm thưởng **không hết hạn** ạ! Anh/chị cứ tích góp dần, khi đủ thì đổi quà/giảm giá ạ. Ngoài mua hàng, **giới thiệu bạn bè** thành công cũng được thêm 100 điểm ạ!',
    'Dạ cách tích điểm rất đơn giản ạ: mua hàng → cung cấp SĐT đã đăng ký → điểm tự cộng vào tài khoản ạ. Kiểm tra điểm tích lũy qua app hoặc website bên em nhé ạ. Hiện tại anh/chị có muốn đăng ký không ạ?',
  ],

  // ─────────────── SMALLTALK ──────────────────────────────────────────────
  SMALLTALK_WHO: [
    'Dạ em là **Trợ lý AI Getshopy** (tên thân thiện là Gete) ạ! Em được lập trình để tư vấn sản phẩm điện tử, hỗ trợ mua hàng và giải đáp thắc mắc ạ. Tuy không phải người thật nhưng em cố gắng hết sức để anh/chị hài lòng ạ! 😊',
    'Dạ em là AI của Getshopy ạ! Em không phải con người nhưng em hiểu tiếng Việt và tư vấn chân thành nhất ạ. Em học từ rất nhiều kịch bản mua sắm thực tế ạ. Anh/chị cần giúp gì về sản phẩm điện tử không ạ?',
    'Dạ em là **Chatbot AI bán hàng** của Getshopy, hoạt động 24/7 không nghỉ ạ! Em có thể tư vấn: sản phẩm, giá cả, so sánh, tồn kho, giao hàng, bảo hành — tất cả mọi thứ ạ. Anh/chị muốn hỏi gì ạ?',
  ],

  SMALLTALK_THANKS: [
    'Dạ cảm ơn anh/chị đã tin tưởng Getshopy ạ! 😊 Nếu có thêm câu hỏi nào, anh/chị cứ chat với em nhé ạ. Chúc anh/chị một ngày tuyệt vời ạ!',
    'Dạ không có gì ạ, giúp được anh/chị là em vui rồi ạ! 🌟 Đừng quên để lại đánh giá 5 sao sau khi mua hàng nhé ạ. Anh/chị cần thêm gì không ạ?',
    'Dạ đó là điều em luôn cố gắng ạ! Mong anh/chị sẽ hài lòng với sản phẩm ạ. Bất cứ lúc nào cần hỗ trợ thêm, em luôn ở đây ạ!',
  ],

  SMALLTALK_BYE: [
    'Dạ hẹn gặp lại anh/chị ạ! 👋 Chúc anh/chị có trải nghiệm mua sắm tuyệt vời ạ. Bất cứ lúc nào cần tư vấn, em luôn ở đây 24/7 ạ!',
    'Dạ tạm biệt anh/chị ạ! Nếu quyết định mua, chúc đơn hàng đến nhanh ạ. Hẹn gặp lại lần sau! 😊',
    'Dạ anh/chị đi nhé ạ! Getshopy luôn chào đón anh/chị quay lại ạ. Giới thiệu bạn bè mua hàng cùng để nhận thêm ưu đãi nhé ạ! 👋',
  ],

  SMALLTALK_GENERIC: [
    'Dạ anh/chị có cần em tư vấn gì về sản phẩm điện tử không ạ? Em sẵn sàng 24/7 ạ! 😊',
    'Dạ em hiểu ạ! Anh/chị muốn xem thêm sản phẩm hay cần tư vấn gì thêm không ạ?',
    'Dạ vâng ạ! Bất cứ khi nào cần, anh/chị cứ hỏi em nhé ạ. Em luôn ở đây hỗ trợ ạ.',
  ],

  // ─────────────── FEEDBACK_POSITIVE ──────────────────────────────────────
  FEEDBACK: [
    'Dạ cảm ơn anh/chị **rất rất nhiều** ạ! 😊 Lời khen là động lực lớn nhất để đội ngũ Getshopy cố gắng ạ. Anh/chị nhớ để lại đánh giá 5 sao trên website giúp em nhé ạ!',
    'Dạ cảm ơn anh/chị ạ! Nghe phản hồi tích cực như vậy em thấy có động lực lắm ạ! 🌟 Anh/chị có muốn giới thiệu bạn bè mua hàng không? Giới thiệu thành công được thêm điểm thưởng đó ạ!',
    'Dạ wow, cảm ơn anh/chị đã tin tưởng Getshopy ạ! 🎉 Bên em sẽ tiếp tục nâng cao chất lượng dịch vụ ạ. Lần sau anh/chị cần gì cứ ghé lại nhé ạ!',
    'Dạ được khen như vậy em phấn khởi lắm ạ! 🥰 Mong anh/chị luôn hài lòng với sản phẩm ạ. Đừng ngại hỏi em bất cứ lúc nào nhé ạ!',
  ],

  // ─────────────── ASK_WORKING_HOURS ──────────────────────────────────────
  WORKING_HOURS: [
    'Dạ cửa hàng Getshopy mở cửa **7:30 – 21:30**, tất cả các ngày kể cả Lễ Tết ạ! Hotline miễn phí hỗ trợ **24/7** ạ. Chat online có người trực từ **8:00 – 22:00** ạ.',
    'Dạ bên em phục vụ **7 ngày/tuần, không nghỉ lễ** ạ! Giờ mở cửa 7:30 sáng đến 21:30 tối ạ. Anh/chị muốn đến trực tiếp thì có thể đặt lịch trước để nhân viên chuẩn bị sẵn ạ!',
    'Dạ online thì em phục vụ **24/7** không nghỉ ạ! Nhưng xử lý đơn hàng trong giờ hành chính 8:00-20:00 ạ. Đặt đơn ngoài giờ sẽ được xử lý sáng hôm sau nhé ạ!',
  ],

  // ─────────────── ASK_WARRANTY_DETAIL ────────────────────────────────────
  WARRANTY: [
    'Dạ chi tiết bảo hành: **Điện thoại** 12 tháng chính hãng, pin 6 tháng ạ. **Laptop** 12-24 tháng tùy hãng ạ. **Tai nghe** 6-12 tháng ạ. Không bao gồm: vỡ màn, ngấm nước, tự ý sửa ạ. Anh/chị muốn hỏi bảo hành sản phẩm nào cụ thể không ạ?',
    'Dạ bên em tặng thêm **Bảo hành 1 Đổi 1** trong 30 ngày đầu ạ! Nếu sản phẩm có lỗi nhà sản xuất, bên em đổi máy mới hoàn toàn ạ. Không cần sửa, không cần chờ ạ!',
    'Dạ **Apple Care+** là gói bảo hành mở rộng của Apple, bao gồm cả lỗi do tai nạn (vỡ màn, ngấm nước) ạ. Giá 2-4 triệu tùy sản phẩm ạ. Rất đáng nếu anh/chị hay làm rơi máy ạ!',
    'Dạ bảo hành **toàn cầu** áp dụng cho iPhone và MacBook ạ! Du lịch nước ngoài bị sự cố vẫn bảo hành được tại Apple Store bất kỳ ạ. Rất tiện lợi ạ!',
    'Dạ anh/chị có thể mua thêm gói **Bảo hành mở rộng** 1-2 năm nữa ạ! Giá hợp lý, peace of mind toàn tập ạ. Bên em có bán gói này kèm theo sản phẩm ạ. Anh/chị muốn biết giá không ạ?',
  ],

  // ─────────────── ASK_INSTALLMENT_DETAIL ─────────────────────────────────
  INSTALLMENT: [
    'Dạ trả góp **0% lãi suất** qua thẻ tín dụng VISA/MasterCard/JCB nhiều ngân hàng ạ! Chia 3, 6, 9, 12 tháng tùy ngân hàng ạ. Cần: thẻ tín dụng còn hạn mức + CCCD là đủ ạ.',
    'Dạ không có thẻ tín dụng vẫn trả góp được ạ! Qua **FE Credit, Home Credit, MCredit** ạ. Lãi suất 1.5-3%/tháng ạ. Thủ tục nhanh trong 15 phút, chỉ cần CCCD + xác nhận lương ạ.',
    'Dạ tính tiền nhanh nhé ạ: máy 20 triệu trả 12 tháng = **1.666.000đ/tháng** (0% lãi) ạ. Anh/chị muốn tính cho sản phẩm nào không ạ? Em tính ngay ạ!',
    'Dạ với thu nhập thấp, nên chọn số tháng trả nhiều hơn để **tiền hàng tháng thấp hơn** ạ. Ví dụ máy 10 triệu: 12 tháng = 833k/tháng, 24 tháng = 416k/tháng (có lãi) ạ. Anh/chị muốn chia mấy tháng ạ?',
    'Dạ trả góp online cũng được ạ! Anh/chị điền thông tin thẻ khi checkout, hệ thống xử lý tự động ạ. Hoặc đến cửa hàng để nhân viên hỗ trợ làm hợp đồng trả góp tiện hơn ạ.',
  ],

  // ─────────────── URGENT_NEED ─────────────────────────────────────────────
  URGENT: [
    'Dạ em hiểu anh/chị cần gấp ạ! Bên em có **giao hàng hỏa tốc** nội thành trong 2-4 tiếng ạ (TP.HCM, Hà Nội) ạ. Đặt trước 12:00 giao trong ngày ạ. Anh/chị cần sản phẩm nào ạ?',
    'Dạ cần gấp thì để em ưu tiên ngay ạ! Thanh toán online xong là shipper xuất phát ạ. Anh/chị ở đâu để em xác nhận có giao hỏa tốc khu vực đó không nhé ạ?',
  ],

  // ─────────────── ASK_SECOND_HAND ─────────────────────────────────────────
  SECOND_HAND: [
    'Dạ bên em có **hàng trưng bày và refurbished** chất lượng cao ạ! Tất cả qua kiểm định 30+ điểm kỹ thuật, bảo hành 6 tháng, ngoại hình đẹp từ 95%+ ạ. Tiết kiệm 20-30% so với mới ạ!',
    'Dạ **Like New** là máy qua sử dụng rất ít, ngoại hình gần như mới ạ. **Refurbished** là hàng phục hồi, thay linh kiện mới ạ. Cả 2 đều được kiểm tra kỹ và có bảo hành ạ. Anh/chị muốn tìm model nào ạ?',
    'Dạ mua máy cũ từ bên em khác ngoài chợ nhiều ạ! Có **bảo hành 6 tháng**, có **hóa đơn**, kiểm tra minh bạch ạ. Không lo mua phải máy lỗi ẩn hay máy đã qua sửa chữa nặng ạ.',
    'Dạ để tiết kiệm nhất, anh/chị có thể kết hợp: mua máy **refurbished** + gói bảo hành mở rộng ạ. Vừa rẻ hơn mới 25%, vừa an tâm được bảo hành lâu dài ạ!',
  ],

  // ─────────────── ASK_ACCESSORIES ─────────────────────────────────────────
  ACCESSORIES: [
    'Dạ phụ kiện bên em rất đa dạng ạ! Ốp lưng, cường lực, cáp sạc, củ sạc, tai nghe, pin dự phòng, đế sạc không dây... Tất cả là **phụ kiện chính hãng** hoặc hãng đối tác uy tín ạ. Anh/chị cần loại nào ạ?',
    'Dạ mua máy mới nên kèm ngay **ốp lưng + cường lực** ạ! Bảo vệ máy từ ngày đầu, rẻ hơn sửa nhiều ạ. Bên em có nhiều mẫu đẹp, mua kèm còn được giảm thêm ạ. Anh/chị muốn xem loại nào ạ?',
    'Dạ cáp sạc **chính hãng** bền và an toàn hơn cáp không rõ nguồn gốc nhiều ạ! Cáp rởm có thể hỏng cổng sạc hoặc nguy hiểm cháy nổ ạ. Bên em bán cáp MFi (iPhone) và USB-C chính hãng giá tốt ạ!',
    'Dạ **pin dự phòng** nên chọn từ **10.000mAh** trở lên để sạc được 2-3 lần ạ. Chọn hãng uy tín như Anker, Baseus, Xiaomi ạ. Bên em có đủ các loại ạ. Anh/chị cần dung lượng bao nhiêu ạ?',
  ],

  // ─────────────── ASK_PRICE_HISTORY ──────────────────────────────────────
  PRICE_HISTORY: [
    'Dạ về xu hướng giá ạ: thường 3-6 tháng sau ra mắt giá giảm 10-20% ạ. Nếu cần ngay thì mua thôi, chờ giảm thì công nghệ cũng tiến thêm ạ! Anh/chị đang xem sản phẩm nào ạ?',
    'Dạ đợt sale lớn nhất: **Black Friday (tháng 11)** và **12/12** ạ! Nếu anh/chị không gấp và đang xem mẫu cũ hơn, có thể chờ để được deal tốt hơn ạ. Flagship mới thì hiếm khi giảm sâu ngay ạ.',
    'Dạ **11/11 và 12/12** bên em giảm 10-30% kèm nhiều quà tặng ạ! Nếu không gấp, chờ ngày này rất đáng ạ. Còn nếu đang cần sản phẩm cho công việc/học tập thì đừng chờ, mua ngay ạ.',
    'Dạ anh/chị có muốn em theo dõi giá và thông báo khi giảm không ạ? Anh/chị để lại email/SĐT, em nhắn ngay khi sản phẩm đó giảm giá ạ!',
  ],

  // ─────────────── ASK_SOCIAL_PROOF ───────────────────────────────────────
  SOCIAL_PROOF: [
    'Dạ tất cả sản phẩm bên em đều có đánh giá thực từ khách đã mua ạ! Anh/chị vào trang sản phẩm → kéo xuống mục **Review** là thấy nhé ạ. Em không can thiệp review, 100% khách thật ạ.',
    'Dạ kênh YouTube review tiếng Việt uy tín: **Thế Giới Di Động, CellphoneS, Tinhte, Nguyễn Hiệp** ạ. Khá khách quan và chi tiết ạ. Anh/chị muốn hỏi review model nào ạ?',
    'Dạ điểm đánh giá dựa trên **số sao thực tế** từ khách mua ạ. Sản phẩm 4.5 sao+ là rất đáng tin ạ. Anh/chị cũng có thể lọc theo "đánh giá 1 sao" để xem điểm yếu thực sự ạ. Minh bạch hoàn toàn ạ!',
  ],

  // ─────────────── ASK_TRY_BEFORE_BUY ─────────────────────────────────────
  TRY: [
    'Dạ anh/chị hoàn toàn có thể đến **Showroom Getshopy** để trải nghiệm trực tiếp ạ! Cầm, chụp ảnh thử, chạy benchmark, test âm thanh — tất cả đều được ạ. Nhân viên hỗ trợ nhiệt tình, không ép mua ạ!',
    'Dạ bên em có chính sách **30 ngày đổi trả** ạ! Mua về dùng thử 30 ngày, không hài lòng thì đổi sản phẩm khác hoặc hoàn tiền ạ. Điều kiện: máy còn nguyên vẹn, đủ phụ kiện ạ. Rất thoải mái ạ!',
    'Dạ không đến được showroom thì bên em có **video demo 360°** và ảnh thực tế trên trang sản phẩm ạ! Nếu vẫn chưa chắc, mua về dùng 30 ngày còn đổi được ạ. Không cần lo ngại ạ!',
    'Dạ mua online bên em rất an tâm ạ! Nếu nhận hàng thấy sản phẩm không đúng mô tả hoặc có lỗi, anh/chị chụp ảnh/video gửi cho em, bên em giải quyết ngay trong **24h** ạ!',
  ],

  // ─────────────── MULTI_QUESTION ──────────────────────────────────────────
  MULTI: [
    'Dạ anh/chị hỏi nhiều thứ cùng lúc, em xin trả lời lần lượt ạ! Để chính xác nhất, anh/chị cho em biết tên **sản phẩm cụ thể** đang quan tâm là gì nhé ạ? Em kiểm tra giá, tồn kho, bảo hành cùng một lúc luôn ạ!',
    'Dạ câu hỏi của anh/chị có nhiều ý ạ! Em ghi nhận: giá → tồn kho → bảo hành → giao hàng ạ. Anh/chị cho em tên sản phẩm để em tra tất cả trong một lần nhé ạ?',
    'Dạ em sẽ giải đáp từng câu nhé ạ! Trước tiên anh/chị có thể nêu tên model đang quan tâm không ạ? Anh/chị nêu tên máy là em tra được hết luôn ạ!',
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// PHẦN 4: HÀM XỬ LÝ INTENT CHÍNH — MAIN HANDLER
// Nhận Intent từ Naive Bayes, phân tích context, trả về câu trả lời phù hợp.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Điều hướng Intent mở rộng sang handler tương ứng.
 *
 * @param {string}  intent      - Tên Intent được phân loại bởi Naive Bayes
 * @param {string}  message     - Tin nhắn gốc từ người dùng
 * @param {string}  [sessionId] - ID phiên hội thoại (IP, userId, v.v.)
 * @returns {Promise<{text: string, link: string|null}|null>}
 *   Trả về object {text, link} nếu Intent được xử lý, null nếu không khớp.
 */
async function handleExpandedIntent(intent, message, sessionId = 'default') {
  // ── Lưu tin nhắn người dùng vào hàng đợi ──────────────────────────────
  conversationStore.push(sessionId, 'user', message);

  // ── Lấy lịch sử và phân tích context ─────────────────────────────────
  const history = conversationStore.get(sessionId);
  const prevHistory = history.slice(0, -1);          // Bỏ tin nhắn mới nhất
  const prevProduct = extractProductFromHistory(prevHistory);
  const prevBudget = extractBudgetFromHistory(prevHistory);
  const curBudget = extractBudget(message);

  let result = null;

  switch (intent) {

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_TRADE_IN': {
      const text = prevProduct
        ? pick(POOL.TRADE_IN_WITH_PRODUCT(prevProduct))
        : pick(POOL.TRADE_IN);
      result = { text, link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_AUTHENTIC': {
      result = { text: pick(POOL.AUTHENTIC), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_DISCOUNT_SPECIAL': {
      result = { text: pick(POOL.DISCOUNT_SPECIAL), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_REPAIR': {
      result = { text: pick(POOL.REPAIR), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_CAMERA': {
      let text = pick(POOL.CAMERA);
      let link = '/';

      if (prevProduct) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: prevProduct, mode: 'insensitive' }, is_deleted: false },
          });
          if (found) {
            text = pick(POOL.CAMERA_WITH_PRODUCT(found.name));
            link = `/product/${found.id}`;
          }
        } catch (_) { /* giữ giá trị mặc định */ }
      } else {
        try {
          const topCam = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 } },
            orderBy: { rating: 'desc' },
            take: 2,
          });
          if (topCam.length > 0) {
            const names = topCam.map(p => `**${p.name}** (⭐${p.rating}/5)`).join(' và ');
            text = `Dạ về camera, đang được đánh giá cao nhất bên em là ${names} ạ! Anh/chị hay chụp selfie, ban đêm hay phong cảnh để em tư vấn chi tiết hơn nhé ạ?`;
            link = `/product/${topCam[0].id}`;
          }
        } catch (_) { /* giữ giá trị mặc định */ }
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_BATTERY': {
      let text = pick(POOL.BATTERY);
      let link = '/';

      if (prevProduct) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: prevProduct, mode: 'insensitive' }, is_deleted: false },
          });
          if (found) {
            text = `Dạ về pin của **${found.name}**, thông số chi tiết có trong mục mô tả sản phẩm ạ! Anh/chị click "Xem ngay" để đọc đầy đủ nhé ạ. Cần em giải thích thêm thì cứ hỏi ạ.`;
            link = `/product/${found.id}`;
          }
        } catch (_) { /* giữ giá trị mặc định */ }
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_DISPLAY': {
      let text = pick(POOL.DISPLAY);
      let link = '/';

      if (prevProduct) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: prevProduct, mode: 'insensitive' }, is_deleted: false },
          });
          if (found) {
            text = `Dạ thông số màn hình của **${found.name}** được ghi chi tiết trên trang sản phẩm ạ! Bao gồm: kích thước, tần số quét, độ phân giải, loại tấm nền ạ. Anh/chị xem thêm nhé ạ!`;
            link = `/product/${found.id}`;
          }
        } catch (_) { /* giữ giá trị mặc định */ }
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_STORAGE': {
      result = { text: pick(POOL.STORAGE), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_CONNECTIVITY': {
      result = { text: pick(POOL.CONNECTIVITY), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_GAMING': {
      let text;
      let link = '/';

      const isMobile = hasKeyword(message, ['mobile', 'liên quân', 'pubg', 'free fire', 'lol mobile', 'tiktok']);
      const isPC = hasKeyword(message, ['laptop', 'pc', 'valorant', 'cs2', 'genshin', 'elden', 'rtx']);

      try {
        const products = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { price: 'desc' },
          take: 3,
        });

        if (products.length > 0) {
          if (isMobile) {
            const names = products.slice(0, 2).map(p => `**${p.name}** (${fmt(p.price)})`).join(' hoặc ');
            text = `Dạ gaming mobile thì anh/chị xem thử ${names} ạ! Chip mạnh, màn 120Hz+, tản nhiệt tốt — chơi Liên Quân/PUBG hoàn toàn mượt ạ!`;
            link = `/product/${products[0].id}`;
          } else if (isPC) {
            const names = products.map(p => `**${p.name}** (${fmt(p.price)})`).join(', ');
            text = `Dạ gaming PC/laptop bên em đang có: ${names} ạ. Cấu hình mạnh, đủ chạy game PC phổ biến ạ. Anh/chị muốn chi tiết hơn về con nào không ạ?`;
            link = `/product/${products[0].id}`;
          } else {
            const names = products.map(p => `**${p.name}**`).join(', ');
            text = `Dạ để gaming tốt nhất bên em có: ${names} ạ. Anh/chị cần gaming mobile hay laptop gaming để em tư vấn chi tiết hơn nhé ạ!`;
            link = `/product/${products[0].id}`;
          }
        } else {
          text = pick(POOL.GAMING);
        }
      } catch (_) {
        text = pick(POOL.GAMING);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_NEW_ARRIVAL': {
      let text;
      let link = '/';

      try {
        const newest = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { created_at: 'desc' },
          take: 3,
        });

        if (newest.length > 0) {
          const lines = newest.map((p, i) => {
            const badge = i === 0 ? '🆕 ' : '';
            return `${badge}**${p.name}** — ${fmt(p.price)} (⭐${p.rating}/5)`;
          }).join('\n');

          text = pick([
            `Dạ sản phẩm **mới nhất** vừa cập nhật bên em:\n${lines}\n\nAnh/chị muốn xem chi tiết không ạ?`,
            `Dạ hàng mới nhất vừa về:\n${lines}\n\nTất cả còn hàng sẵn ạ! Click vào để xem thêm nhé ạ!`,
            `Dạ **top ${newest.length} hàng mới nhất** bên em:\n${lines}\n\nAnh/chị quan tâm dòng nào để em tư vấn kỹ hơn nhé ạ?`,
          ]);
          link = `/product/${newest[0].id}`;
        } else {
          text = pick(POOL.NEW_ARRIVAL);
        }
      } catch (_) {
        text = pick(POOL.NEW_ARRIVAL);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_BEST_SELLER': {
      let text;
      let link = '/';

      try {
        const bestsellers = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { sold: 'desc' },
          take: 3,
        });

        if (bestsellers.length > 0) {
          const lines = bestsellers.map((p, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] ?? '▪️';
            return `${medal} **${p.name}** — ${fmt(p.price)} | ⭐${p.rating}/5 | Đã bán: ${p.sold.toLocaleString()}`;
          }).join('\n');

          text = pick([
            `Dạ **Top ${bestsellers.length} bán chạy nhất** hiện tại:\n${lines}\n\nAnh/chị muốn tư vấn thêm về sản phẩm nào không ạ?`,
            `Dạ khách hàng đang yêu thích nhất:\n${lines}\n\nĐánh giá cao từ người mua thực tế ạ. Anh/chị muốn xem thêm không ạ?`,
            `Dạ hàng hot nhất bên em:\n${lines}\n\nBán chạy vì chất lượng tốt và giá hợp lý ạ. Anh/chị muốn em phân tích không ạ?`,
          ]);
          link = `/product/${bestsellers[0].id}`;
        } else {
          text = pick(POOL.BEST_SELLER);
        }
      } catch (_) {
        text = pick(POOL.BEST_SELLER);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_PREORDER': {
      result = { text: pick(POOL.PREORDER), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_INVOICE': {
      result = { text: pick(POOL.INVOICE), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_GIFT_WRAP': {
      result = { text: pick(POOL.GIFT_WRAP), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'BULK_ORDER': {
      result = { text: pick(POOL.BULK), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_COMPATIBILITY': {
      result = { text: pick(POOL.COMPATIBILITY), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'INSTALLATION_HELP': {
      result = { text: pick(POOL.INSTALLATION), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_DESIGN': {
      let text = pick(POOL.DESIGN);
      let link = '/';

      const keyword = prevProduct;

      if (keyword) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: keyword, mode: 'insensitive' }, is_deleted: false },
          });
          if (found) {
            text = pick(POOL.DESIGN_WITH_PRODUCT(found.name));
            link = `/product/${found.id}`;
          }
        } catch (_) { /* giữ mặc định */ }
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_WATERPROOF': {
      result = { text: pick(POOL.WATERPROOF), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_OS': {
      result = { text: pick(POOL.OS), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_LOYALTY': {
      result = { text: pick(POOL.LOYALTY), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'SMALLTALK': {
      const isBye = hasKeyword(message, ['bye', 'tạm biệt', 'hẹn gặp', 'chào nhé', 'đi rồi', 'thôi ra']);
      const isThanks = hasKeyword(message, ['cảm ơn', 'thank', 'cám ơn', 'thanks']);
      const isWho = hasKeyword(message, ['tên gì', 'là ai', 'robot', 'ai tạo', 'bạn là', 'em là', 'mày là']);

      let text;
      if (isBye) text = pick(POOL.SMALLTALK_BYE);
      else if (isThanks) text = pick(POOL.SMALLTALK_THANKS);
      else if (isWho) text = pick(POOL.SMALLTALK_WHO);
      else text = pick(POOL.SMALLTALK_GENERIC);

      result = { text, link: null };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'FEEDBACK_POSITIVE': {
      result = { text: pick(POOL.FEEDBACK), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_WORKING_HOURS': {
      result = { text: pick(POOL.WORKING_HOURS), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_WARRANTY_DETAIL': {
      result = { text: pick(POOL.WARRANTY), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_INSTALLMENT_DETAIL': {
      let text = pick(POOL.INSTALLMENT);

      // Context-aware: nếu đang xem sản phẩm có giá, tính tiền hàng tháng
      if (prevProduct) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: prevProduct, mode: 'insensitive' }, is_deleted: false },
          });
          if (found && found.price) {
            const m6 = fmt(Math.round(found.price / 6));
            const m12 = fmt(Math.round(found.price / 12));
            text = `Dạ với **${found.name}** (${fmt(found.price)}) ạ:\n• Trả góp **6 tháng** (0%): ~${m6}/tháng\n• Trả góp **12 tháng** (0%): ~${m12}/tháng\n\nÁp dụng khi trả bằng thẻ tín dụng ạ! Anh/chị muốn chia mấy tháng ạ?`;
          }
        } catch (_) { /* giữ mặc định */ }
      }

      result = { text, link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'URGENT_NEED': {
      let text;
      let link = '/';

      try {
        const inStock = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 5 } },
          orderBy: { stock: 'desc' },
          take: 3,
        });

        if (inStock.length > 0) {
          const names = inStock.map(p => `**${p.name}** (còn ${p.stock})`).join(', ');
          text = pick([
            `Dạ em hiểu anh/chị cần gấp ạ! Hiện có sẵn: ${names}. Đặt ngay, **nội thành giao trong 2-4 tiếng** ạ!`,
            `Dạ cần gấp thì bên em lo được ạ! Đang có: ${names}. Anh/chị đặt trước **12:00** để giao trong ngày nhé ạ!`,
            `Dạ bên em có **giao hỏa tốc** ạ! Sẵn hàng: ${names}. Thanh toán online là shipper xuất phát ngay ạ!`,
          ]);
          link = `/product/${inStock[0].id}`;
        } else {
          text = pick(POOL.URGENT);
        }
      } catch (_) {
        text = pick(POOL.URGENT);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_SECOND_HAND': {
      let text;
      let link = '/';
      const budget = prevBudget ?? curBudget?.amount ?? null;

      try {
        const query = budget
          ? { where: { is_deleted: false, stock: { gt: 0 }, price: { lte: budget } }, orderBy: { price: 'desc' }, take: 2 }
          : { where: { is_deleted: false, stock: { gt: 0 } }, orderBy: { price: 'asc' }, take: 2 };

        const products = await prisma.product.findMany(query);

        if (products.length > 0) {
          const lines = products.map(p => `**${p.name}** — ${fmt(p.price)} (⭐${p.rating}/5)`).join('\n');
          const budgetNote = budget ? ` tầm ${fmtShort(budget)}` : '';
          text = pick([
            `Dạ hàng refurbished/like new${budgetNote} đang có:\n${lines}\n\nTất cả qua kiểm định, bảo hành 6 tháng ạ!`,
            `Dạ bên em có hàng đã qua sử dụng${budgetNote}:\n${lines}\n\nNgoại hình 95%+, tiết kiệm 20-30% so với mới ạ!`,
          ]);
          link = `/product/${products[0].id}`;
        } else {
          text = pick(POOL.SECOND_HAND);
        }
      } catch (_) {
        text = pick(POOL.SECOND_HAND);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_ACCESSORIES': {
      let text;
      let link = '/';

      try {
        const accessories = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { price: 'asc' },
          take: 3,
        });

        if (accessories.length > 0) {
          const lines = accessories.map(p => `• **${p.name}** — ${fmt(p.price)}`).join('\n');
          text = pick([
            `Dạ phụ kiện chính hãng bên em đang có:\n${lines}\n\nAnh/chị cần thêm loại nào để em tìm chính xác nhé ạ?`,
            `Dạ một số gợi ý phụ kiện:\n${lines}\n\nNếu cần loại cụ thể (ốp, cáp, đế sạc) thì anh/chị nói thêm nhé ạ!`,
          ]);
          link = `/product/${accessories[0].id}`;
        } else {
          text = pick(POOL.ACCESSORIES);
        }
      } catch (_) {
        text = pick(POOL.ACCESSORIES);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_PRICE_HISTORY': {
      let text = pick(POOL.PRICE_HISTORY);

      if (prevProduct) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: prevProduct, mode: 'insensitive' }, is_deleted: false },
          });
          if (found) {
            const discount = calcDiscount(found.original_price, found.price);
            if (discount > 0) {
              text = `Dạ **${found.name}** đang giảm **${discount}%** so với giá gốc ạ! Từ ${fmt(found.original_price)} còn ${fmt(found.price)} ạ. Đây là mức giá tốt rồi, anh/chị không cần chờ thêm đâu ạ!`;
            } else {
              text = `Dạ **${found.name}** hiện bán ${fmt(found.price)} ạ. Giá ổn định, không lo biến động nhiều trong thời gian tới ạ. Mua ngay là hợp lý ạ!`;
            }
          }
        } catch (_) { /* giữ mặc định */ }
      }

      result = { text, link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_SOCIAL_PROOF': {
      let text;
      let link = '/';

      try {
        const topRated = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { rating: 'desc' },
          take: 2,
        });

        if (topRated.length > 0) {
          const p = topRated[0];
          text = pick([
            `Dạ được đánh giá cao nhất hiện tại là **${p.name}** với ⭐${p.rating}/5 từ ${p.sold}+ khách đã mua ạ! Anh/chị vào trang sản phẩm đọc review thực tế nhé ạ.`,
            `Dạ **${p.name}** đang dẫn đầu về đánh giá (⭐${p.rating}/5) ạ! Rất nhiều khách hài lòng và mua lại ạ. Anh/chị xem thêm review chi tiết không ạ?`,
          ]);
          link = `/product/${p.id}`;
        } else {
          text = pick(POOL.SOCIAL_PROOF);
        }
      } catch (_) {
        text = pick(POOL.SOCIAL_PROOF);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'ASK_TRY_BEFORE_BUY': {
      result = { text: pick(POOL.TRY), link: '/' };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    case 'MULTI_QUESTION': {
      let text;
      let link = '/';

      if (prevProduct) {
        try {
          const found = await prisma.product.findFirst({
            where: { name: { contains: prevProduct, mode: 'insensitive' }, is_deleted: false },
          });
          if (found) {
            const stockMsg = found.stock > 0 ? `Còn **${found.stock}** cái` : 'Tạm hết hàng';
            const discountMsg = calcDiscount(found.original_price, found.price);
            const priceMsg = discountMsg > 0
              ? `**${fmt(found.price)}** (Giảm ${discountMsg}%)`
              : `**${fmt(found.price)}**`;

            text = `Dạ tổng hợp thông tin **${found.name}** cho anh/chị ạ:\n• 💰 Giá: ${priceMsg}\n• ${stockMsg}\n• ⭐ Đánh giá: **${found.rating}/5**\n• 🚚 Giao hàng: 1-3 ngày (hỏa tốc 2-4h nội thành)\n• 🛡️ Bảo hành: 12 tháng chính hãng\n• 💳 Hỗ trợ: Trả góp 0%, COD, MoMo, ZaloPay\n\nAnh/chị cần tư vấn thêm gì không ạ?`;
            link = `/product/${found.id}`;
          } else {
            text = pick(POOL.MULTI);
          }
        } catch (_) {
          text = pick(POOL.MULTI);
        }
      } else {
        text = pick(POOL.MULTI);
      }

      result = { text, link };
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    default:
      result = null;
      break;
  }

  // ── Lưu câu trả lời của AI vào hàng đợi (nếu có) ───────────────────────
  if (result?.text) {
    conversationStore.push(sessionId, 'assistant', result.text);
  }

  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// PHẦN 5: XUẤT MODULE
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
  /**
   * Hàm xử lý chính — gọi từ ai.js
   * @type {typeof handleExpandedIntent}
   */
  handleExpandedIntent,

  /**
   * Singleton ConversationQueue — có thể dùng từ bên ngoài nếu cần.
   * @type {ConversationQueue}
   */
  conversationStore,

  /**
   * Class ConversationQueue — export để viết unit test.
   * @type {typeof ConversationQueue}
   */
  ConversationQueue,
};

// ═════════════════════════════════════════════════════════════════════════════
// PHAN 6: BO XU LY NANG CAO — ADVANCED HANDLERS
// Follow-up thong minh, Cross-sell, Budget Recommendation,
// Tech Spec Deep-dive, Gen Z Handler, Sentiment Analysis
// =============================================================================

// --- 6.1 FOLLOW-UP POOL ---

const FOLLOW_UP_POOL = {
  HESITANT: [
    'Dạ anh/chị hỏi em gợi ý thêm nhé ạ! Nếu anh/chị đang phân vân giữa 2-3 sản phẩm, cứ nêu tên ra em so sánh trực tiếp cho ạ! Sẽ thấy rõ cái nào phù hợp hơn ngay ạ.',
    'Dạ phân vân là bình thường ạ! Đây là khoản đầu tư đáng kể nên cần cân nhắc kỹ ạ. Anh/chị muốn em tóm tắt ưu - nhược điểm của từng lựa chọn không ạ? Sẽ dễ quyết định hơn nhiều ạ.',
    'Dạ em gợi ý thế này ạ: anh/chị thử trả lời 2 câu — (1) Ngân sách tối đa bao nhiêu? (2) Dùng chính cho việc gì? — là em gợi ý được ngay sản phẩm tốt nhất cho anh/chị ạ!',
    'Dạ anh/chị có thể đến showroom cầm thử trực tiếp nhé ạ! Nhiều khi cầm thực tế mới quyết được ạ. Hoặc mua về dùng 30 ngày, không hài lòng còn đổi được ạ!',
    'Dạ nếu anh/chị chưa chắc, mua về thử rồi quyết định ạ! Chính sách 30 ngày đổi trả, anh/chị không bị thiệt gì cả ạ.',
  ],
  COMPARE_WITH_COMPETITOR: [
    'Dạ bên em tự tin về giá cạnh tranh và dịch vụ hậu mãi ạ! Giá tương đương hoặc rẻ hơn, nhưng bên em có thêm: bảo hành 1 đổi 1 trong 30 ngày, setup miễn phí và chăm sóc sau mua ạ.',
    'Dạ anh/chị tìm được giá rẻ hơn ở đâu thì cho em biết ạ! Nếu chênh lệch không nhiều và dịch vụ bên em tốt hơn, anh/chị xem xét tổng thể nhé ạ. Bên em cam kết không bán đắt hơn niêm yết ạ.',
    'Dạ so sánh giá thì nên so cả tổng gói nhé ạ: giá máy + phụ kiện tặng kèm + dịch vụ hậu mãi + bảo hành ạ. Bên em thường có nhiều quà tặng đi kèm mà nơi khác không có ạ!',
  ],
  AFTER_PURCHASE: [
    'Dạ chúc mừng anh/chị đã có sản phẩm mới ạ! Anh/chị cần hỗ trợ gì: setup ban đầu, chuyển dữ liệu, hay tìm hiểu tính năng không ạ?',
    'Dạ tuyệt vời ạ! Anh/chị nhớ làm đầu tiên: (1) Kiểm tra IMEI/Serial, (2) Đăng ký bảo hành, (3) Bật tính năng Find My Device ạ. Cần hướng dẫn bước nào không ạ?',
    'Dạ mua rồi thì nhớ để lại đánh giá 5 sao trên website nhé ạ! Giúp người mua sau tham khảo ạ. Có gì cần hỗ trợ thêm, anh/chị cứ quay lại chat với em ạ.',
  ],
  DELIVERY_COMPLAINT: [
    'Dạ em xin lỗi vì sự bất tiện ạ! Anh/chị cho em mã đơn hàng để em kiểm tra ngay nhé ạ. Bên em sẽ liên hệ đội vận chuyển và báo lại trong vòng 1 tiếng ạ.',
    'Dạ em rất tiếc ạ! Anh/chị cung cấp thông tin đơn hàng (mã đơn hoặc SĐT đặt hàng) để em tra cứu và ưu tiên xử lý ngay nhé ạ!',
    'Dạ anh/chị cho em xác nhận với bộ phận giao hàng nhé ạ! Chắc chắn sẽ gọi lại trong 30 phút ạ. Anh/chị để lại SĐT đặt hàng không ạ?',
  ],
  BUYING_FOR_OTHERS: [
    'Dạ mua tặng hay mua cho người thân cần lưu ý một số điều ạ! Cho em biết: người đó dùng iOS hay Android, tuổi tác và dùng cho mục đích gì? Em gợi ý chuẩn nhất ạ!',
    'Dạ mua cho ba mẹ hay người lớn tuổi thì nên chọn: màn lớn, chữ to, dễ dùng, pin trâu ạ. iPhone SE hay Samsung A-series giao diện đơn giản rất phù hợp ạ.',
    'Dạ mua tặng người yêu/bạn bè thì quan tâm sở thích của họ ạ! Họ đang dùng iPhone hay Android? Màu họ thích? Em giúp anh/chị chọn món quà ý nghĩa ạ!',
  ],
};

// --- 6.2 CROSS-SELL POOL ---

const CROSS_SELL_POOL = {
  PHONE_ACCESSORIES: (phoneName) => [
    `Dạ anh/chị mua **${phoneName}** rồi thì đừng quên thêm ốp lưng + cường lực để bảo vệ máy từ ngày đầu ạ! Bên em có nhiều mẫu đẹp, mua kèm còn được giảm thêm 10% ạ.`,
    `Dạ với **${phoneName}** thì nên thêm: củ sạc nhanh, cáp dự phòng và tai nghe ạ. Bên em có đủ phụ kiện chính hãng, anh/chị xem không ạ?`,
    `Dạ mua **${phoneName}** xong nên thêm pin dự phòng cho những ngày ra ngoài nhiều ạ! Dung lượng 20.000mAh chỉ 350-500k, rất đáng ạ.`,
  ],
  LAPTOP_ACCESSORIES: (laptopName) => [
    `Dạ mua **${laptopName}** rồi thì nên thêm: túi chống sốc + chuột không dây để làm việc thoải mái hơn ạ! Mua kèm còn tiết kiệm được ạ.`,
    `Dạ với **${laptopName}**, nếu hay kết nối nhiều thiết bị thì nên thêm hub USB-C ạ! Một hub có ngay: HDMI, USB-A, USB-C, đọc thẻ — rất tiện ạ.`,
    `Dạ **${laptopName}** màn đẹp rồi nhưng thêm màn hình ngoài 24 inch làm việc hiệu quả hơn nhiều ạ!`,
  ],
};

// --- 6.3 TECH SPEC POOL ---

const TECH_SPEC_POOL = {
  CHIP: [
    'Dạ về chip ạ! Apple A17 Pro và Snapdragon 8 Gen 3 đang là 2 chip mạnh nhất smartphone 2024 ạ. Apple A17 Pro tối ưu cho hệ sinh thái Apple, Snapdragon 8 Gen 3 mạnh về AI và gaming ạ.',
    'Dạ chip ảnh hưởng trực tiếp đến: tốc độ xử lý, tiết kiệm pin, khả năng AI ạ. Snapdragon 8 Gen 2 vẫn rất mạnh trên flagship 2023 ạ. Dimensity 9300 của MediaTek cạnh tranh tốt, giá thường rẻ hơn ạ.',
    'Dạ với laptop, Intel Core Ultra và AMD Ryzen 7000 là chuẩn hiện tại ạ! MacBook M3 vẫn vượt trội về hiệu năng/watt ạ. Anh/chị dùng laptop cho gì để em gợi ý chip phù hợp nhé ạ?',
  ],
  RAM: [
    'Dạ về RAM ạ! 8GB đủ cho dùng bình thường ạ. 12GB tốt cho đa nhiệm ạ. 16GB+ cần thiết cho editing video hay streaming game ạ. Anh/chị hay làm gì để em gợi ý mức RAM phù hợp ạ?',
    'Dạ RAM iPhone khác RAM Android ạ! iPhone 8GB RAM quản lý bộ nhớ rất hiệu quả, mượt như Android 12GB RAM ạ. Không nên so sánh RAM trực tiếp giữa iOS và Android ạ.',
  ],
  GPU: [
    'Dạ card đồ họa laptop gaming ạ! RTX 4060 là lựa chọn tốt cho tầm 18-22 triệu ạ. RTX 4070 cho máy 25-30 triệu ạ. Cả 2 đều chạy được hầu hết game AAA ở 1080p ạ.',
    'Dạ VRAM rất quan trọng ạ! RTX 4060 có 8GB VRAM đủ cho game 1080p-1440p ạ. RTX 4070 có 12GB, chơi 1440p-4K ngon hơn ạ.',
  ],
  THERMAL: [
    'Dạ tản nhiệt rất quan trọng khi chơi game hay render video lâu ạ! Laptop gaming tốt có vapor chamber hoặc liquid metal tản nhiệt hiệu quả ạ. ASUS ROG và MSI Gaming nổi tiếng về tản nhiệt ạ.',
    'Dạ điện thoại bị nóng khi chơi game lâu là bình thường ạ! Nhưng nóng liên tục trên 45 độ thì có vấn đề ạ. ASUS ROG Phone có AeroActive Cooler gắn ngoài để tản nhiệt cực kỳ hiệu quả ạ.',
  ],
  REFRESH_RATE: [
    'Dạ refresh rate ảnh hưởng độ mượt ạ! 60Hz là chuẩn cũ, 90Hz tốt hơn, 120Hz là khuyến nghị hiện tại ạ. Gaming thì 144-165Hz giúp phản ứng nhanh hơn trong FPS ạ.',
    'Dạ tần số quét cao tốn pin hơn ạ! Điện thoại hiện đại có LTPO — tự điều chỉnh từ 1-120Hz tùy nội dung ạ. Rất thông minh và tiết kiệm pin ạ.',
  ],
  COLOR_ACCURACY: [
    'Dạ color accuracy quan trọng với đồ họa, chỉnh ảnh/video ạ! Màn đạt 100% sRGB tốt cho web, DCI-P3 coverage cao tốt cho phim/photo ạ. MacBook Pro Liquid Retina XDR đạt P3 reference ạ.',
    'Dạ AMOLED màu rực rỡ nhưng có thể hơi bão hòa ạ. IPS màu tự nhiên hơn, phù hợp làm đồ họa ạ. Chỉ xem phim, Instagram thì AMOLED đẹp hơn ạ.',
  ],
};

// --- 6.4 GEN Z POOL ---

const GENZ_POOL = {
  PHONE: [
    'Dạ anh/chị muốn mua điện thoại ạ! Cho em biết thêm: ngân sách tầm bao nhiêu và ưu tiên điều gì (pin, camera, chơi game)? Em gợi ý ngay ạ!',
    'Dạ điện thoại nhé ạ! Anh/chị đang dùng iOS hay Android? Và budget khoảng bao nhiêu? Em filter đúng liền ạ!',
    'Dạ ok ạ! Điện thoại tầm nào: dưới 5 triệu, 5-15 triệu, hay trên 15 triệu? Cứ nêu ra em tư vấn ngay ạ!',
    'Dạ điện thoại thì bên em có từ bình dân đến flagship ạ! Anh/chị muốn: pin trâu, camera đẹp hay chip mạnh nhất? Cho em biết để lọc đúng nhé ạ!',
  ],
  LAPTOP: [
    'Dạ anh/chị tìm laptop ạ! Cho em biết: dùng để làm gì (học, văn phòng, đồ họa, gaming)? Và ngân sách? Em tư vấn ngay ạ!',
    'Dạ laptop nhé ạ! Cần: nhỏ gọn hay màn lớn? Và tầm bao nhiêu tiền? Cho em biết để gợi ý chuẩn nhất ạ!',
    'Dạ bên em có đủ laptop từ 10-40 triệu ạ! Anh/chị dùng Windows hay Mac? Và mục đích chính là gì? Em gợi ý ngay ạ.',
  ],
  MACBOOK: [
    'Dạ MacBook ạ! Air (nhỏ nhẹ, pin trâu, hợp lý) hay Pro (hiệu năng cao, màn đỉnh)? RAM bao nhiêu: 8/16/24GB? Em tư vấn chi tiết nhé ạ!',
    'Dạ MacBook thì bên em có Air M2/M3 và Pro M3 ạ! Anh/chị hay làm gì: văn phòng, code hay đồ họa/video? Em chọn đúng model cho ạ!',
  ],
  EARPHONE: [
    'Dạ tai nghe ạ! In-ear (nhỏ gọn), over-ear (âm thanh tốt), hay true wireless (không dây)? Chống ồn có cần không? Budget bao nhiêu ạ?',
    'Dạ tai nghe thì có nhiều loại ạ! AirPods cho iPhone, Sony/Bose cho chống ồn đỉnh, Sennheiser cho audiophile ạ. Anh/chị dùng nghe nhạc, gọi điện hay gaming chính ạ?',
  ],
  WATCH: [
    'Dạ đồng hồ thông minh ạ! Apple Watch chỉ dùng được với iPhone nhé ạ. Samsung Watch dùng được cả 2 nhưng full tính năng khi dùng với Samsung ạ. Anh/chị đang dùng điện thoại gì ạ?',
  ],
  IPAD: [
    'Dạ iPad ạ! Mini (nhỏ gọn), Air (cân bằng), Pro (chuyên nghiệp) ạ. Anh/chị dùng iPad để làm gì: học, xem phim, vẽ hay làm việc? Budget tầm bao nhiêu ạ?',
  ],
};

// --- 6.5 RELATED QUESTIONS POOL ---

const RELATED_QUESTIONS = {
  ASK_PRICE: ['\n\n> **Gợi ý tiếp theo:** Hỏi "Có trả góp không?", "Có giảm giá không?" để biết thêm ưu đãi ạ!'],
  ASK_SPECS: ['\n\n> **Gợi ý:** Hỏi "Giá bao nhiêu?", "Còn hàng không?" hay "So sánh với [sản phẩm khác]" nhé ạ!'],
  CHECK_STOCK: ['\n\n> **Gợi ý:** Hỏi "Giá bao nhiêu?" và "Giao hàng bao lâu?" để hoàn tất mua ạ!'],
  ASK_CAMERA: ['\n\n> **Gợi ý:** Hỏi "Có OIS không?", "Chụp đêm tốt không?" ạ!'],
  ASK_BATTERY: ['\n\n> **Gợi ý:** Hỏi "Sạc nhanh bao nhiêu W?" hay "Có sạc không dây không?" ạ!'],
  ASK_GAMING: ['\n\n> **Gợi ý:** Hỏi "Laptop gaming tầm 20 triệu nào ngon?" ạ!']
};

// --- 6.6 SENTIMENT ANALYSIS ---

/**
 * Phan tich cam xuc tin nhan nguoi dung.
 * @param {string} message
 * @returns {'positive'|'negative'|'neutral'|'excited'|'frustrated'}
 */
function analyzeSentiment(message) {
  const lower = message.toLowerCase();
  if (['!!!', 'wow', 'omg', 'oa', 'dinh', 'xin xo', 'qua ngon'].some(w => lower.includes(w))) return 'excited';
  if (['troi oi', 'sao lai', 'buc qua', 'chan qua', 'vo ly'].some(w => lower.includes(w))) return 'frustrated';
  if (['tuyet', 'hay qua', 'thich', 'ngon', 'perfect', 'great'].some(w => lower.includes(w))) return 'positive';
  if (['te', 'chan', 'hong', 'loi', 'xau', 'that vong'].some(w => lower.includes(w))) return 'negative';
  return 'neutral';
}

/**
 * Tiền tố phản hồi theo cảm xúc.
 * @param {'positive'|'negative'|'neutral'|'excited'|'frustrated'} sentiment
 * @returns {string}
 */
function sentimentPrefix(sentiment) {
  switch (sentiment) {
    case 'excited': return pick(['Dạ anh/chị hứng thú quá ạ! 🔥 ', 'Dạ tuyệt vời ạ! 🎉 ']);
    case 'frustrated': return pick(['Dạ em xin lỗi vì sự bất tiện ạ! ', 'Dạ em hiểu, để em giúp ngay nhé! ']);
    case 'positive': return pick(['Dạ em vui khi nghe vậy ạ! 😊 ', 'Dạ cảm ơn anh/chị ạ! ']);
    case 'negative': return pick(['Dạ em rất tiếc khi nghe điều này ạ! ', 'Dạ em xin lỗi ạ! ']);
    default: return '';
  }
}

// --- 6.7 BUDGET RECOMMENDATION ENGINE ---

/**
 * Gợi ý sản phẩm tốt nhất trong ngân sách.
 * @param {number} budget - Ngân sách VND
 * @param {string|null} cat - Danh mục (nếu biết)
 * @param {string} sessionId - ID phiên
 * @returns {Promise<{text: string, link: string}|null>}
 */
async function handleBudgetRecommendation(budget, cat = null, sessionId = 'default') {
  try {
    const products = await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 }, price: { lte: budget * 1.1, gte: budget * 0.5 } },
      orderBy: [{ rating: 'desc' }, { sold: 'desc' }],
      take: 3,
    });

    const list = products.length > 0 ? products : await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 }, price: { lte: budget * 1.2 } },
      orderBy: { price: 'desc' },
      take: 3,
    });

    if (list.length === 0) return null;

    const lines = list.map((p, i) => {
      const tag = i === 0 ? ' 🔥 Best choice' : '';
      return `• **${p.name}** — ${fmt(p.price)} (⭐${p.rating}/5)${tag}`;
    }).join('\n');

    let intro;
    if (budget < 5_000_000) intro = `Dạ tầm ${fmtShort(budget)} bên em có nhiều lựa chọn tốt ạ!`;
    else if (budget < 20_000_000) intro = `Dạ ${fmtShort(budget)} là tầm mid-high, anh/chị có thể sở hữu flagship của nhiều hãng ạ!`;
    else intro = `Dạ ngân sách ${fmtShort(budget)} thì anh/chị có thể sở hữu những gì tốt nhất hiện nay ạ!`;

    const text = `${intro}\n\n**Gợi ý tầm ${fmtShort(budget)}:**\n${lines}\n\nAnh/chị muốn em tư vấn sâu hơn về sản phẩm nào không ạ?`;
    conversationStore.push(sessionId, 'assistant', text);
    return { text, link: `/product/${list[0].id}` };
  } catch (_) {
    return null;
  }
}

// --- 6.8 CROSS-SELL HANDLER ---

/**
 * Goi y san pham/phu kien bo sung dua tren san pham dang xem.
 * @param {string} productName
 * @param {string} sessionId
 * @returns {Promise<{text: string, link: string}|null>}
 */
async function handleCrossSell(productName, sessionId = 'default') {
  if (!productName) return null;
  try {
    const main = await prisma.product.findFirst({
      where: { name: { contains: productName, mode: 'insensitive' }, is_deleted: false },
    });
    if (!main) return null;

    const similar = await prisma.product.findMany({
      where: { id: { not: main.id }, is_deleted: false, stock: { gt: 0 }, price: { gte: main.price * 0.05, lte: main.price * 0.35 } },
      orderBy: { rating: 'desc' },
      take: 2,
    });

    if (similar.length === 0) return null;

    const isPhone = /phone|iphone|samsung|pixel|xiaomi|oppo|vivo/i.test(main.name);
    const isLaptop = /laptop|macbook|dell|asus|lenovo|hp|acer|msi/i.test(main.name);

    let text;
    if (isPhone) text = pick(CROSS_SELL_POOL.PHONE_ACCESSORIES(main.name));
    else if (isLaptop) text = pick(CROSS_SELL_POOL.LAPTOP_ACCESSORIES(main.name));
    else {
      const lines = similar.map(p => `• **${p.name}** — ${fmt(p.price)}`).join('\n');
      text = `Dạ anh/chị mua **${main.name}** thì bên em gợi ý thêm:\n${lines}\n\nCác sản phẩm bổ sung rất phù hợp dùng kèm ạ!`;
    }

    conversationStore.push(sessionId, 'assistant', text);
    return { text, link: `/product/${similar[0].id}` };
  } catch (_) {
    return null;
  }
}

// --- 6.9 COMPARE BRIEF HANDLER ---

/**
 * So sanh nhanh 2 san pham dua tren ten brand trong tin nhan.
 * @param {string} message
 * @param {string} sessionId
 * @returns {Promise<{text: string, link: string}>}
 */
async function handleCompareBrief(message, sessionId = 'default') {
  const foundBrands = KNOWN_BRANDS.filter(b => message.toLowerCase().includes(b));
  if (foundBrands.length < 2) {
    return { text: 'Dạ anh/chị nêu tên 2 sản phẩm cần so sánh (ví dụ: "iPhone 15 vs Samsung S24") là em phân tích ngay ạ!', link: '/' };
  }
  try {
    const [prod1, prod2] = await Promise.all([
      prisma.product.findFirst({ where: { name: { contains: foundBrands[0], mode: 'insensitive' }, is_deleted: false }, orderBy: { rating: 'desc' } }),
      prisma.product.findFirst({ where: { name: { contains: foundBrands[1], mode: 'insensitive' }, is_deleted: false }, orderBy: { rating: 'desc' } }),
    ]);

    if (!prod1 || !prod2) {
      return { text: 'Dạ anh/chị nêu tên sản phẩm cụ thể hơn để em so sánh chính xác nhé ạ!', link: '/' };
    }

    const winner = prod1.rating >= prod2.rating ? prod1 : prod2;
    const cheaper = prod1.price <= prod2.price ? prod1 : prod2;
    const diff = Math.abs(prod1.price - prod2.price);

    const text = [
      `Dạ em so sánh nhanh **${prod1.name}** vs **${prod2.name}** nhé ạ!\n`,
      `| Tiêu chí | ${prod1.name} | ${prod2.name} |`,
      `|---|---|---|`,
      `| 💰 Giá | ${fmt(prod1.price)} | ${fmt(prod2.price)} |`,
      `| ⭐ Đánh giá | ${prod1.rating}/5 | ${prod2.rating}/5 |`,
      `| 🛒 Đã bán | ${prod1.sold} | ${prod2.sold} |`,
      `| 📦 Tồn kho | ${prod1.stock > 0 ? 'Còn hàng' : 'Hết hàng'} | ${prod2.stock > 0 ? 'Còn hàng' : 'Hết hàng'} |`,
      `\n**Nhận xét:** **${winner.name}** được đánh giá cao hơn ạ. **${cheaper.name}** có giá thấp hơn **${fmtShort(diff)}** ạ. Anh/chị ưu tiên chất lượng hay tiết kiệm ngân sách ạ?`,
    ].join('\n');

    conversationStore.push(sessionId, 'assistant', text);
    return { text, link: `/product/${winner.id}` };
  } catch (_) {
    return { text: 'Dạ anh/chị nêu tên sản phẩm cụ thể hơn để em so sánh chính xác nhé ạ!', link: '/' };
  }
}

// --- 6.10 TECH SPEC HANDLER ---

/**
 * Tra loi khi nguoi dung hoi sau ve thong so ky thuat.
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}|null}
 */
function handleTechSpec(message, sessionId = 'default') {
  let text = null;
  const lower = message.toLowerCase();
  if (/chip|processor|snapdragon|a17|a16|dimensity|helio/i.test(lower)) text = pick(TECH_SPEC_POOL.CHIP);
  else if (/\bram\b|lpddr/i.test(lower)) text = pick(TECH_SPEC_POOL.RAM);
  else if (/gpu|card do hoa|rtx|gtx|adreno|mali/i.test(lower)) text = pick(TECH_SPEC_POOL.GPU);
  else if (/nong|tan nhiet|thermal|nhiet do/i.test(lower)) text = pick(TECH_SPEC_POOL.THERMAL);
  else if (/hz|tan so quet|refresh rate|ltpo/i.test(lower)) text = pick(TECH_SPEC_POOL.REFRESH_RATE);
  else if (/mau man|color|dci-?p3|srgb|calibrat/i.test(lower)) text = pick(TECH_SPEC_POOL.COLOR_ACCURACY);
  if (!text) return null;
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

// --- 6.11 GEN Z MESSAGE HANDLER ---

/**
 * Xu ly tin nhan ngan gon kieu Gen Z.
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}|null}
 */
function handleGenZMessage(message, sessionId = 'default') {
  const lower = message.toLowerCase().trim();
  let key = null;
  if (/^(muon mua|tim|can|cho xem)\s*(dien thoai|phone|dt|de)$/.test(lower) || lower === 'dien thoai' || lower === 'phone') key = 'PHONE';
  else if (/^(muon mua|tim|can|cho xem)\s*(laptop|may tinh)$/.test(lower) || lower === 'laptop') key = 'LAPTOP';
  else if (/^(muon mua|tim|can)?\s*macbook$/.test(lower) || lower === 'macbook') key = 'MACBOOK';
  else if (/^(muon mua|tim|can)?\s*(tai nghe|earphone|headphone|airpods)$/.test(lower) || lower === 'tai nghe') key = 'EARPHONE';
  else if (/^(muon mua|tim|can)?\s*(dong ho|watch|smartwatch)$/.test(lower) || lower === 'dong ho') key = 'WATCH';
  else if (/^(muon mua|tim|can)?\s*ipad$/.test(lower) || lower === 'ipad') key = 'IPAD';
  if (!key) return null;
  const text = pick(GENZ_POOL[key]);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

// --- 6.12 FOLLOW-UP HANDLER ---

/**
 * Xu ly tin nhan follow-up — phan tich context va tra loi phu hop.
 * @param {string} message
 * @param {Array}  history
 * @param {string} sessionId
 * @returns {Promise<{text: string, link: string}|null>}
 */
async function handleFollowUp(message, history, sessionId = 'default') {
  if (!history || history.length < 2) return null;
  const lower = message.toLowerCase();
  const prevProduct = extractProductFromHistory(history);
  const prevBudget = extractBudgetFromHistory(history);

  if (/phan van|chua biet|khong biet chon|kho chon/i.test(lower))
    return { text: pick(FOLLOW_UP_POOL.HESITANT), link: '/' };
  if (/noi khac|cho khac|the gioi di dong|cellphones|fpt shop/i.test(lower))
    return { text: pick(FOLLOW_UP_POOL.COMPARE_WITH_COMPETITOR), link: '/' };
  if (/mua roi|dat roi|nhan roi|co roi/i.test(lower))
    return { text: pick(FOLLOW_UP_POOL.AFTER_PURCHASE), link: '/' };
  if (/cham|chua nhan|hang dau|shipper dau/i.test(lower))
    return { text: pick(FOLLOW_UP_POOL.DELIVERY_COMPLAINT), link: '/' };
  if (/tang|cho ba|cho me|cho vo|sinh nhat|qua/i.test(lower))
    return { text: pick(FOLLOW_UP_POOL.BUYING_FOR_OTHERS), link: '/' };

  const techResult = handleTechSpec(message, sessionId);
  if (techResult) return techResult;

  if (/so sanh|vs|hay la|cai nao tot|nen chon/i.test(lower))
    return await handleCompareBrief(message, sessionId);

  const budget = extractBudget(message)?.amount || prevBudget;
  if (budget) return await handleBudgetRecommendation(budget, null, sessionId);

  if (prevProduct && /them|kem|can gi khac|phu kien|mua them/i.test(lower))
    return await handleCrossSell(prevProduct, sessionId);

  return null;
}

// --- 6.13 RELATED QUESTION HELPER ---

/**
 * Lay goi y cau hoi tiep theo theo Intent.
 * @param {string} intent
 * @returns {string}
 */
function getRelatedQuestion(intent) {
  const pool = RELATED_QUESTIONS[intent];
  return (pool && pool.length > 0) ? pick(pool) : '';
}

/**
 * Thong ke session store (dung cho monitoring/debug).
 * @returns {{ activeSessions: number, maxHistory: number, ttlMinutes: number }}
 */
function getStoreStats() {
  return {
    activeSessions: conversationStore.size,
    maxHistory: MAX_HISTORY,
    ttlMinutes: SESSION_TTL_MS / 60_000,
  };
}

// --- XUAT THEM CAC HAM PHAN 6 ---
Object.assign(module.exports, {
  handleFollowUp,
  handleBudgetRecommendation,
  handleCrossSell,
  handleCompareBrief,
  handleTechSpec,
  handleGenZMessage,
  analyzeSentiment,
  sentimentPrefix,
  getRelatedQuestion,
  getStoreStats,
  fmtShort,
  pick,
  extractBudget,
  extractProductFromHistory,
});

// ===================================================================
// PHAN 7: BO CAU TRA LOI MO RONG THEM — EXTENDED RESPONSE BANK
// Them hang tram bien the cau tra loi cho cac tinh huong dac biet
// ===================================================================

/**
 * Cac cau tra loi mo rong cho PRICE_COMPLAINT (Che mac, muon mac ca)
 * Phat hien tu tin hieu ngan sach khong du va xu ly kheo leo
 */
const PRICE_COMPLAINT_EXT = [
  'Dạ em hiểu anh/chị thấy giá hơi cao ạ! Để em kiểm tra xem hiện tại có chương trình giảm giá nào phù hợp không nhé ạ. Anh/chị cho em biết ngân sách tối đa là bao nhiêu để em lọc sản phẩm phù hợp nhất ạ?',
  'Dạ mắc quá ạ! Không sao, bên em có nhiều phân khúc giá khác nhau ạ. Anh/chị cho em biết tầm tiền thoải mái hơn — em sẽ tìm ngay sản phẩm có cấu hình tốt nhất trong tầm đó ạ!',
  'Dạ anh/chị có ngân sách nhất định là hoàn toàn hợp lý ạ! Bên em đảm bảo luôn có phương án phù hợp ạ. Anh/chị muốn xem các sản phẩm tương tự nhưng giá mềm hơn không ạ?',
  'Dạ giá cao hơn mong đợi của anh/chị rồi ạ! Bên em có thể: (1) Tìm sản phẩm cùng tính năng nhưng rẻ hơn, (2) Xem hàng cũ/refurbished tiết kiệm 20-30%, (3) Xem xét trả góp để giảm gánh nặng hàng tháng ạ. Anh/chị muốn chọn phương án nào ạ?',
  'Dạ khách hàng thường chê giá nhưng bên em bán theo giá niêm yết cố định ạ! Tuy nhiên nếu anh/chị là khách mua nhiều lần hoặc mua số lượng lớn, em có thể xem xét ưu đãi riêng cho anh/chị ạ. Anh/chị có thể tham khảo trước ạ!',
  'Dạ nếu thấy mắc thì anh/chị có thể đổi sang model năm trước — chất lượng vẫn tốt mà giá giảm 15-25% so với đời mới ạ! Bên em đang có một số sản phẩm như vậy, anh/chị muốn xem không ạ?',
];

/**
 * Cac cau tra loi cho CHANGE_PRODUCT (Muon doi san pham / xem them)
 */
const CHANGE_PRODUCT_EXT = [
  'Dạ anh/chị muốn xem thêm lựa chọn khác ạ! Không sao, bên em có rất nhiều sản phẩm ạ. Anh/chị có thể cho em biết: (1) Anh/chị không thích điểm gì ở sản phẩm hiện tại? (2) Cần gì ở sản phẩm mới? Để em gợi ý chính xác hơn nhé ạ!',
  'Dạ ok anh/chị ơi! Sản phẩm này không phù hợp thì xem cái khác thôi ạ. Anh/chị cần ưu tiên điều gì nhất: pin trâu hơn, camera tốt hơn, giá rẻ hơn, hay màu đẹp hơn? Em lọc ngay cho ạ!',
  'Dạ biến đổi đầy ạ! Bên em có hàng chục sản phẩm khác nhau ạ. Anh/chị thử mô tả nhu cầu theo cách đơn giản nhất: "cần máy pin khỏe để đi xa" hay "cần máy chụp ảnh đẹp cho con" — là em hiểu và gợi ý ngay ạ!',
  'Dạ anh/chị muốn xem thêm màu khác hay dòng sản phẩm khác hoàn toàn ạ? Nếu chỉ là màu khác thì em xem biến thể có sẵn nhé ạ. Nếu muốn dòng khác thì anh/chị gợi ý nhu cầu để em tìm phù hợp nhất ạ!',
  'Dạ thay đổi là bình thường ạ! Anh/chị không cần ngại ạ. Bên em có rất nhiều lựa chọn, chỉ cần anh/chị cho em biết có thể chi bao nhiêu tiền và cần gì, em tìm được ngay ạ!',
];

/**
 * Cac cau tra loi cho TRACK_ORDER (Theo doi don hang)
 */
const TRACK_ORDER_EXT = [
  'Dạ để kiểm tra đơn hàng, anh/chị cho em: mã đơn hàng hoặc số điện thoại đặt hàng ạ. Em sẽ kiểm tra trạng thái và báo lại ngay ạ!',
  'Dạ đơn hàng có thể theo dõi qua website bên em hoặc qua SMS từ hệ thống ạ. Anh/chị có mã vận đơn không ạ? Nếu có thì tra trực tiếp trên trang vận chuyển sẽ chính xác nhất ạ!',
  'Dạ thường quy trình xử lý đơn hàng: xác nhận đơn (30 phút) → đóng gói (2-4h) → bàn giao vận chuyển (1-2 ngày tiếp theo) → giao hàng (1-3 ngày) ạ. Anh/chị đặt hàng khi nào để em dự tính thời gian nhé ạ?',
  'Dạ nếu đơn hàng quá 3 ngày chưa giao (nội thành) hoặc 5 ngày (ngoại tỉnh) mà chưa có thông tin, anh/chị liên hệ hot line để được xử lý ưu tiên nhé ạ. Em ghi nhận và chuyển cho bộ phận xử lý ngay ạ!',
];

/**
 * Cac cau tra loi cho CANCEL_ORDER (Huy don hang)
 */
const CANCEL_ORDER_EXT = [
  'Dạ anh/chị muốn hủy đơn hàng ạ! Nếu đơn chưa xử lý (trong vòng 1h đầu) thì hủy được 100% miễn phí ạ. Anh/chị cho em mã đơn hàng để em kiểm tra trạng thái và hỗ trợ hủy ngay nhé ạ!',
  'Dạ em ghi nhận yêu cầu hủy đơn ạ! Nếu đơn đã trong trạng thái "đang xử lý" hay "đã bàn giao vận chuyển" thì anh/chị có thể từ chối nhận hàng khi shipper đến — bên em sẽ hoàn tiền sau khi nhận lại hàng ạ.',
  'Dạ hủy đơn hàng rồi tiền hoàn về thẻ/ví trong 3-7 ngày làm việc tùy ngân hàng/ví anh/chị dùng ạ. COD thì không bị giữ tiền từ trước nên hủy là xong ngay ạ. Anh/chị cho em mã đơn để xử lý nhé ạ!',
  'Dạ trước khi hủy, anh/chị có muốn đổi sang sản phẩm khác không ạ? Nếu hủy hoàn toàn thì mất thêm thời gian chọn lại. Đổi sản phẩm thì em xử lý ngay, giao hàng cũng nhanh hơn ạ!',
];

/**
 * Cac cau tra loi cho ASK_GIFT (Hoi qua tang, phu kien di kem)
 */
const ASK_GIFT_EXT = [
  'Dạ phụ kiện trong hộp sản phẩm phổ biến thông thường: dây sạc, cáp, bút cài sim (điện thoại), túi vải, sách hướng dẫn ạ. Một số hàng cao cấp còn kèm thêm: adaptor đa năng, tem dán cường lực ạ.',
  'Dạ bên em có thêm quà tặng kèm khi mua ạ! Tùy theo chương trình từng thời kỳ mà có: ốp lưng, cường lực, pin dự phòng, voucher dịch vụ ạ. Anh/chị hỏi thời điểm này để em kiểm tra quà tặng hiện có nhé ạ!',
  'Dạ phụ kiện tặng kèm của bên em thường hơn nơi khác vì có thêm: kiểm tra và cài đặt miễn phí, bảo hành phụ kiện riêng ạ. Anh/chị đặt hàng ở đây để được đầy đủ ưu đãi nhé ạ!',
  'Dạ nếu mua combo (máy + phụ kiện cùng lúc) thì anh/chị tiết kiệm được 10-15% so với mua riêng lẻ ạ! Bên em có sẵn các combo phụ kiện phù hợp cho từng dòng máy ạ. Anh/chị muốn xem combo cho sản phẩm nào ạ?',
];

/**
 * Cac cau tra loi cho COMPLAINT (Phann nan, khieu nai)
 */
const COMPLAINT_EXT = [
  'Dạ em xin lỗi rất nhiều vì trải nghiệm không tốt của anh/chị ạ! Đây là điều chúng em không mong muốn ạ. Anh/chị có thể mô tả rõ hơn vấn đề đang gặp? Em ghi nhận và xử lý ngay, ưu tiên cao nhất ạ!',
  'Dạ em rất xin lỗi vì sự cố này ạ! Anh/chị chat với em ngay hôm nay, em đảm bảo vấn đề sẽ được giải quyết trong 24h ạ. Anh/chị cho em biết thông tin: tên, SĐT, mã đơn hàng và mô tả vấn đề ạ.',
  'Dạ khiếu nại của anh/chị hoàn toàn hợp lý ạ! Bên em có chính sách xử lý khiếu nại rõ ràng và minh bạch ạ. Anh/chị yêu cầu bồi thường, đổi sản phẩm hay hoàn tiền — em xử lý trung thực đúng quy định ạ.',
  'Dạ anh/chị gửi ảnh/video về vấn đề đang gặp cho em qua chat này ạ. Em cần xác nhận trước khi xử lý để đảm bảo quyền lợi cho anh/chị là được bồi thường đúng và công bằng ạ.',
  'Dạ trước tiên em cảm ơn anh/chị đã phản ánh ạ! Những phản hồi như thế này giúp bên em cải thiện chất lượng hơn ạ. Em đang ghi nhận và chuyển lên cấp trên xử lý khẩn cấp ạ. Anh/chị sẽ được liên hệ trong vòng 2 giờ ạ!',
];

/**
 * Cac cau tra loi cho ASK_PROMO (Hoi khuyen mai)
 */
const ASK_PROMO_EXT = [
  'Dạ hiện tại bên em đang có những chương trình khuyến mãi sau: (1) Flash Sale thứ 6 hàng tuần giảm 10-20%, (2) Sinh viên xuất trình thẻ giảm thêm 3%, (3) Thanh toán online giảm 5% ạ. Anh/chị muốn áp dụng cái nào ạ?',
  'Dạ chương trình khuyến mãi thay đổi thường xuyên nên anh/chị theo dõi website hoặc fanpage để cập nhật nhé ạ! Hoặc để lại SĐT/email để em thông báo khi có sale ạ.',
  'Dạ code giảm giá hiện tại: nhập mã "GETSHOPY10" khi thanh toán để giảm thêm 10% ạ! (Áp dụng cho đơn hàng trên 5 triệu, mỗi khách 1 lần duy nhất ạ.)',
  'Dạ ngày 11/11 và 12/12 bên em giảm sâu nhất trong năm ạ! Nếu anh/chị không gấp, có thể đăng ký danh sách chờ và nhận thông báo trước ạ. Anh/chị muốn em ghi nhận sản phẩm quan tâm không ạ?',
  'Dạ khuyến mãi hiện tại lớn nhất là mua combo: máy + ốp lưng + cường lực được giảm thêm 15% so với mua riêng ạ. Rất đáng cân nhắc nhé ạ!',
];

/**
 * Các câu trả lời cho ASK_DELIVERY (Hỏi giao hàng)
 */
const ASK_DELIVERY_EXT = [
  'Dạ phí ship bên em ạ: Nội thành (TP.HCM, Hà Nội, Đà Nẵng) — MIỄN PHÍ cho đơn trên 500k ạ. Ngoại tỉnh — phí ship theo đơn vị vận chuyển (30-50k tùy địa chỉ) ạ. Hỏa tốc nội thành — 30k thêm phí ưu tiên ạ.',
  'Dạ thời gian giao hàng ạ: Nội thành đặt trước 12h — giao trong ngày ạ. Ngoại tỉnh — 1-3 ngày làm việc ạ. Vùng sâu vùng xa — 3-5 ngày ạ. Anh/chị ở đâu để em xác nhận thời gian chính xác nhé ạ?',
  'Dạ bên em ship qua GHTK, GHN, J&T — những đơn vị vận chuyển hàng đầu hiện nay ạ! Anh/chị theo dõi đơn qua link tracking được gửi SMS sau khi đơn được xử lý ạ.',
  'Dạ nếu cần gấp, anh/chị chọn giao hỏa tốc trong quá trình checkout nhé ạ! Chỉ thêm 30k phí ưu tiên, shipper xuất phát trong 2-4h sau khi thanh toán ạ.',
  'Dạ bên em có chính sách: nếu giao hàng bị hư hỏng do vận chuyển, bên em chịu toàn bộ bồi thường ạ! Anh/chị không cần lo mất hàng hay bị hư trên đường ạ.',
];

/**
 * Các câu trả lời cho ASK_RETURN (Hỏi đổi trả bảo hành)
 */
const ASK_RETURN_EXT = [
  'Dạ chính sách đổi trả của bên em ạ: Trong 30 ngày — đổi sản phẩm mới cùng loại nếu có lỗi nhà sản xuất ạ. Trong 7 ngày — đổi/hoàn tiền nếu sản phẩm không đúng mô tả ạ. Trên 30 ngày — bảo hành theo quy định hãng ạ.',
  'Dạ quy trình đổi trả: Anh/chị liên hệ bên em → Nhân viên xác nhận lỗi → Ship hàng về (bên em trả phí) → Kiểm tra → Đổi máy mới hoặc hoàn tiền trong 3-5 ngày ạ.',
  'Dạ điều kiện đổi trả: Máy còn nguyên vẹn, đầy đủ phụ kiện, có hóa đơn mua hàng ạ. Không áp dụng cho: vỡ màn, ngâm nước, tự ý sửa chữa ạ. Anh/chị còn trong thời hạn bảo hành không ạ?',
  'Dạ anh/chị không cần lo gì cả ạ! Chính sách đổi trả của bên em rất thông thoáng, vì quyền lợi khách hàng là trên hết ạ. Nếu có bất kỳ vấn đề gì, cứ có thể liên hệ để được hỗ trợ ạ.',
];

/**
 * Các câu trả lời cho ASK_PAYMENT (Hỏi thanh toán)
 */
const ASK_PAYMENT_EXT = [
  'Dạ hình thức thanh toán bên em hỗ trợ ạ: (1) COD — trả khi nhận hàng, (2) Chuyển khoản ngân hàng, (3) Thẻ tín dụng/ghi nợ (quẹt thẻ hoặc thanh toán online), (4) Ví điện tử: MoMo, ZaloPay, VNPay, (5) Trả góp 0% lãi suất qua thẻ tín dụng ạ.',
  'Dạ MoMo và ZaloPay rất phổ biến hiện nay ạ! Thanh toán nhanh trong 30 giây, không cần nhập số thẻ ạ. Một số ví còn có thêm cashback 1-5% nữa đó ạ. Anh/chị hay dùng ví nào ạ?',
  'Dạ COD (Cash on Delivery) an toàn vì anh/chị chỉ trả tiền khi nhận hàng và kiểm tra xong ạ! Tuy nhiên COD chỉ hỗ trợ đơn dưới 20 triệu và không áp dụng cho hàng pre-order ạ.',
  'Dạ thanh toán chuyển khoản hay internet banking nhanh nhất và được ưu tiên xử lý đơn đầu tiên ạ! Anh/chị chuyển khoản xong gửi biên lai là đơn được xử lý ngay ạ.',
];

// ==============================================================================
// EXPORT THÊM POOL MỞ RỘNG VÀO MODULE
// ==============================================================================

Object.assign(module.exports, {
  // Xử lý các pool mở rộng (để test hoặc sử dụng trực tiếp)
  PRICE_COMPLAINT_EXT,
  CHANGE_PRODUCT_EXT,
  TRACK_ORDER_EXT,
  CANCEL_ORDER_EXT,
  ASK_GIFT_EXT,
  COMPLAINT_EXT,
  ASK_PROMO_EXT,
  ASK_DELIVERY_EXT,
  ASK_RETURN_EXT,
  ASK_PAYMENT_EXT,
});

// ==============================================================================
// PHẦN 8: BỘ MÔ HÌNH XỬ LÝ THÔNG MINH THEO TỪNG TÌNH HUỐNG HỘI THOẠI
// Phân tích câu hỏi của người dùng và trả lời cụ thể hơn dựa trên context
// ==============================================================================

/**
 * Xử lý khi người dùng chê giá cao / muốn mặc cả / hết tiền.
 * Kết hợp với extractBudget và DB query để gợi ý phương án giá tốt hơn.
 *
 * @param {string} message
 * @param {Array}  history
 * @param {string} sessionId
 * @returns {Promise<{text: string, link: string}>}
 */
async function handlePriceComplaint(message, history, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const curBudget = extractBudget(message);
  const prevBudget = extractBudgetFromHistory(history.slice(0, -1));
  const budget = curBudget?.amount || prevBudget;

  let text;
  let link = '/';

  if (budget) {
    try {
      const cheaper = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 }, price: { lte: budget } },
        orderBy: [{ rating: 'desc' }, { sold: 'desc' }],
        take: 3,
      });

      if (cheaper.length > 0) {
        const lines = cheaper.map(p => `• **${p.name}** — ${fmt(p.price)} (⭐${p.rating}/5)`).join('\n');
        text = pick([
          `Dạ để em gợi ý các sản phẩm trong tầm ${fmtShort(budget)} của anh/chị ạ:\n${lines}\n\nĐều là sản phẩm chất lượng tốt trong tầm giá nhé ạ! Anh/chị muốn biết thêm về cái nào không ạ?`,
          `Dạ với ngân sách ${fmtShort(budget)}, anh/chị có thể xem:\n${lines}\n\nChất lượng vẫn tốt, anh/chị không cần lo về hiệu năng ạ!`,
        ]);
        link = `/product/${cheaper[0].id}`;
      } else {
        text = pick(PRICE_COMPLAINT_EXT);
      }
    } catch (_) {
      text = pick(PRICE_COMPLAINT_EXT);
    }
  } else {
    text = pick(PRICE_COMPLAINT_EXT);
  }

  conversationStore.push(sessionId, 'assistant', text);
  return { text, link };
}

/**
 * Xử lý khi người dùng muốn xem sản phẩm khác / đổi ý.
 *
 * @param {string} message
 * @param {Array}  history
 * @param {string} sessionId
 * @returns {Promise<{text: string, link: string}>}
 */
async function handleChangeProduct(message, history, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const prevBudget = extractBudgetFromHistory(history);

  let text;
  let link = '/';

  try {
    const query = prevBudget
      ? { where: { is_deleted: false, stock: { gt: 0 }, price: { lte: prevBudget * 1.2 } }, orderBy: { rating: 'desc' }, take: 4 }
      : { where: { is_deleted: false, stock: { gt: 0 } }, orderBy: [{ sold: 'desc' }, { rating: 'desc' }], take: 4 };

    const products = await prisma.product.findMany(query);

    if (products.length > 0) {
      const lines = products.map(p => `• **${p.name}** — ${fmt(p.price)} (⭐${p.rating}/5)`).join('\n');
      const budgetNote = prevBudget ? ` (trong tam ${fmtShort(prevBudget)})` : '';
      text = pick([
        `Dạ bên em có nhiều lựa chọn khác${budgetNote}:\n${lines}\n\nAnh/chị thích lựa chọn nào ạ?`,
        `Dạ xem thêm các sản phẩm phù hợp${budgetNote}:\n${lines}\n\nAnh/chị cứ nói tên sản phẩm muốn biết thêm thông tin ạ!`,
      ]);
      link = `/product/${products[0].id}`;
    } else {
      text = pick(CHANGE_PRODUCT_EXT);
    }
  } catch (_) {
    text = pick(CHANGE_PRODUCT_EXT);
  }

  conversationStore.push(sessionId, 'assistant', text);
  return { text, link };
}

/**
 * Xử lý khi người dùng hỏi theo dõi đơn hàng.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleTrackOrder(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(TRACK_ORDER_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng muốn hủy đơn hàng.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleCancelOrder(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(CANCEL_ORDER_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng hỏi phụ kiện / quà tặng.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleAskGift(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(ASK_GIFT_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng phàn nàn / khiếu nại.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleComplaint(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(COMPLAINT_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng hỏi khuyến mãi.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleAskPromo(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(ASK_PROMO_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng hỏi giao hàng.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleAskDelivery(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(ASK_DELIVERY_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng hỏi đổi trả.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleAskReturn(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(ASK_RETURN_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

/**
 * Xử lý khi người dùng hỏi thanh toán.
 *
 * @param {string} message
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleAskPayment(message, sessionId = 'default') {
  conversationStore.push(sessionId, 'user', message);
  const text = pick(ASK_PAYMENT_EXT);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

// --- XUẤT THÊM CÁC HÀM XỬ LÝ BỔ SUNG ---
Object.assign(module.exports, {
  handlePriceComplaint,
  handleChangeProduct,
  handleTrackOrder,
  handleCancelOrder,
  handleAskGift,
  handleComplaint,
  handleAskPromo,
  handleAskDelivery,
  handleAskReturn,
  handleAskPayment,
});

// ===================================================================
// PHẦN 9: BÓC TÁCH LOGIC PHỨC TẠP — INTENT ROUTING HELPERS
// Hàm trợ giúp định tuyến và xử lý các tình huống đặc biệt trong ai.js
// ===================================================================

/**
 * Kiểm tra xem tin nhắn có chứa câu hỏi về khuyến mãi không.
 * @param {string} message
 * @returns {boolean}
 */
function isPromoQuery(message) {
  const m = removeDiacritics(message);
  return /khuyen mai|sale|giam gia|voucher|coupon|flash sale|deal|uu dai|ma giam|freeship|ship mien phi|chiet khau|khuyen|gia tot|off|discount|offer|tich diem|doi qua/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa câu hỏi về giao hàng không.
 * @param {string} message
 * @returns {boolean}
 */
function isDeliveryQuery(message) {
  const m = removeDiacritics(message);
  return /giao hang|ship|van chuyen|phi ship|freeship|nhan hang|bao lau giao|mat may ngay|giao nhanh|giao trong ngay|giao ve tinh|phi giao|toc do giao|dong goi|nhan o dau|giao den|giao ho chi minh|giao ha noi|giao da nang|giao can tho/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa câu hỏi về đổi trả bảo hành không.
 * @param {string} message
 * @returns {boolean}
 */
function isReturnQuery(message) {
  const m = removeDiacritics(message);
  return /doi tra|bao hanh|hoan tien|chinh sach|loi may|doi may|xay xuoc|bi loi|hu hong|thay the|boi thuong|hoan hang|tra hang|that vong|khong dung mo ta|loi man hinh|pin phong|may bi|kiem tra may/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa câu hỏi về thanh toán không.
 * @param {string} message
 * @returns {boolean}
 */
function isPaymentQuery(message) {
  const m = removeDiacritics(message);
  return /tra gop|thanh toan|momo|zalopay|vnpay|cod|the tin dung|chuyen khoan|lai suat|tien mat|apple pay|google pay|crypto|vi dien tu|ngan hang|atm|chia nho|tra truoc|tra sau|bao nhieu tram|gop hang thang|0 lai|mien lai/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa câu hỏi về giá cao / muốn mặc cả không.
 * @param {string} message
 * @returns {boolean}
 */
function isPriceComplaint(message) {
  const m = removeDiacritics(message);
  return /mac qua|dat the|cao vay|bot duoc khong|giam them|re hon|ngan sach|budget it|qua tam tai chinh|khong du tien|phai chang|gia re|re nhat|gia tot|hop ly|gia ok|affordable|cheap|gia thap|gia binh dan|tiet kiem|mua duoc|trong tam gia|gia vua|ngan sach thap|gia ca tot|3 cu|2 cu|tui tien|ngheo|tai chinh han hep|tui tien han hep|sinh vien|gia sinh vien|re ma chat|ngon bo re|gia mem|gia ok|deal ngon|giam gia|gia thap nhat/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa yêu cầu xem sản phẩm khác không.
 * @param {string} message
 * @returns {boolean}
 */
function isChangeProductQuery(message) {
  const m = removeDiacritics(message);
  return /doi cai khac|xem them|khong thich|cai khac|mau khac|options khac|xem mau khac|goi y khac/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa yêu cầu theo dõi đơn hàng không.
 * @param {string} message
 * @returns {boolean}
 */
function isTrackOrderQuery(message) {
  const m = removeDiacritics(message);
  // Mở rộng: match nhiều cách hỏi về trạng thái/vị trí đơn hàng
  return /don hang.*o dau|o dau roi|trang thai don|theo doi don|theo doi.*hang|order.*o dau|hang.*giao chua|bao gio giao|hang toi chua|don.*dang di|don.*dang xu ly|track.*order|where.*order|kiem tra don|don hang cua toi|order cua minh|don dat.*hom|khi nao nhan|ship chua|shipper chua/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa yêu cầu hủy đơn hàng không.
 * @param {string} message
 * @returns {boolean}
 */
function isCancelOrderQuery(message) {
  const m = removeDiacritics(message);
  return /huy don|huy order|khong mua nua|cancel|bo don|xoa don|dat nham|khong lay nua|muon huy|huy ngay|bo qua|thoi khong mua|khong can nua|huy truoc khi giao|huy truoc khi ship/i.test(m);
}

/**
 * Kiểm tra xem tin nhắn có chứa câu hỏi về địa chỉ/liên hệ cửa hàng không.
 * @param {string} message
 * @returns {boolean}
 */
function isContactQuery(message) {
  const m = removeDiacritics(message);
  return /dia chi|cua hang|o dau|hotline|so dien thoai|lien he|email shop|gio mo cua|chi nhanh|ha noi|ho chi minh|da nang|can tho|map|ban do|nhan vien|tu van vien|nguoi that|chat truc tiep|facebook|fanpage|zalo shop/i.test(m);
}

/**
 * Phát hiện tất cả các kiểu câu hỏi trong một tin nhắn.
 * Trả về danh sách các kiểu câu hỏi tìm thấy.
 *
 * @param {string} message
 * @returns {string[]} - Danh sách kiểu câu hỏi (e.g. ['promo','delivery'])
 */
function detectQueryTypes(message) {
  const types = [];
  if (isPromoQuery(message)) types.push('promo');
  if (isDeliveryQuery(message)) types.push('delivery');
  if (isReturnQuery(message)) types.push('return');
  if (isPaymentQuery(message)) types.push('payment');
  if (isPriceComplaint(message)) types.push('price_complaint');
  if (isChangeProductQuery(message)) types.push('change_product');
  if (isTrackOrderQuery(message)) types.push('track_order');
  if (isCancelOrderQuery(message)) types.push('cancel_order');
  return types;
}

/**
 * Xử lý đa ý định trong một tin nhắn — trả lời nhiều kiểu câu hỏi cùng lúc.
 *
 * @param {string} message
 * @param {Array}  history
 * @param {string} sessionId
 * @returns {Promise<{text: string, link: string}|null>}
 */
async function handleMultiIntent(message, history, sessionId = 'default') {
  const types = detectQueryTypes(message);
  if (types.length === 0) return null;

  const responses = [];

  for (const type of types.slice(0, 3)) {
    switch (type) {
      case 'promo': responses.push(pick(ASK_PROMO_EXT)); break;
      case 'delivery': responses.push(pick(ASK_DELIVERY_EXT)); break;
      case 'return': responses.push(pick(ASK_RETURN_EXT)); break;
      case 'payment': responses.push(pick(ASK_PAYMENT_EXT)); break;
      case 'price_complaint': {
        const r = await handlePriceComplaint(message, history, sessionId);
        if (r) responses.push(r.text);
        break;
      }
      case 'change_product': responses.push(pick(CHANGE_PRODUCT_EXT)); break;
      case 'track_order': responses.push(pick(TRACK_ORDER_EXT)); break;
      case 'cancel_order': responses.push(pick(CANCEL_ORDER_EXT)); break;
    }
  }

  if (responses.length === 0) return null;

  const combined = responses.length === 1
    ? responses[0]
    : `Dạ anh/chị hỏi nhiều vấn đề, em trả lời lần lượt nhé ạ!\n\n${responses.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n')}`;

  conversationStore.push(sessionId, 'assistant', combined);
  return { text: combined, link: '/' };
}

// ===================================================================
// PHẦN 10: CÁC HẰNG SỐ VÀ CẤU HÌNH TOÀN CỤC
// ===================================================================

/**
 * Danh sách các kiểu câu hỏi gen Z phổ biến nhất (không viết đầy đủ câu).
 * Dùng để phát hiện và xử lý trong handleGenZMessage.
 * @type {string[]}
 */
const GENZ_KEYWORDS = [
  'dt', 'dien thoai', 'phone', 'may', 'may dien', 'iphone', 'samsung', 'xiaomi',
  'laptop', 'may tinh', 'macbook', 'mac', 'air', 'pro',
  'tai nghe', 'earphone', 'headphone', 'airpods',
  'dong ho', 'watch', 'smartwatch',
  'ipad', 'tablet', 'may tinh bang',
  'may chup', 'camera', 'may anh',
  'man hinh', 'monitor',
];

/**
 * Các mẫu câu gen Z hay dùng để xác nhận ý định mua hàng.
 * @type {string[]}
 */
const GENZ_BUY_INTENT = [
  'muon mua', 'tim mua', 'can mua', 'cho xem', 'goi y', 'tu van',
  'loai nao', 'cai nao', 'chon gi', 'mua gi', 'nen mua',
];

/**
 * Cache để tránh gọi DB quá nhiều lần cho cùng một query.
 * Xóa cache sau 5 phút để đảm bảo data mới.
 * @type {Map<string, {data: any, ts: number}>}
 */
const QUERY_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Lấy dữ liệu từ cache hoặc chạy hàm query nếu cache hết hạn.
 *
 * @template T
 * @param {string}           key     - Cache key
 * @param {() => Promise<T>} fetcher - Hàm lấy dữ liệu
 * @returns {Promise<T>}
 */
async function withCache(key, fetcher) {
  const cached = QUERY_CACHE.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetcher();
  QUERY_CACHE.set(key, { data, ts: Date.now() });
  return data;
}

/**
 * Lấy top sản phẩm bán chạy có cache 5 phút.
 * @param {number} take - Số lượng sản phẩm lấy
 * @returns {Promise<Array>}
 */
async function getCachedBestSellers(take = 3) {
  return withCache(`bestsellers_${take}`, () =>
    prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      orderBy: { sold: 'desc' },
      take,
    })
  );
}

/**
 * Lấy top sản phẩm mới về có cache 5 phút.
 * @param {number} take
 * @returns {Promise<Array>}
 */
async function getCachedNewArrivals(take = 3) {
  return withCache(`new_arrivals_${take}`, () =>
    prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      orderBy: { created_at: 'desc' },
      take,
    })
  );
}

/**
 * Lấy top sản phẩm được đánh giá cao có cache 5 phút.
 * @param {number} take
 * @returns {Promise<Array>}
 */
async function getCachedTopRated(take = 3) {
  return withCache(`top_rated_${take}`, () =>
    prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      orderBy: { rating: 'desc' },
      take,
    })
  );
}

// --- XUẤT THÊM HÀM VÀ HẰNG SỐ BỔ SUNG ---
Object.assign(module.exports, {
  // Query helpers
  isPromoQuery,
  isDeliveryQuery,
  isReturnQuery,
  isPaymentQuery,
  isPriceComplaint,
  isChangeProductQuery,
  isTrackOrderQuery,
  isCancelOrderQuery,
  isContactQuery,
  detectQueryTypes,
  handleMultiIntent,

  // Cached DB queries
  getCachedBestSellers,
  getCachedNewArrivals,
  getCachedTopRated,
  withCache,

  // Constants
  GENZ_KEYWORDS,
  GENZ_BUY_INTENT,
  KNOWN_BRANDS,
  MAX_HISTORY,
  SESSION_TTL_MS,
});

// ===================================================================
// PHẦN 11: BÁO CÁO TỔNG KẾT MODULE — MODULE SUMMARY
// ===================================================================

/**
 * In ra tổng kết module khi khởi động server (tự động gọi khi load).
 * Chỉ in trong môi trường development.
 */
(function printModuleSummary() {
  if (process.env.NODE_ENV === 'production') return;
  const intentCount = 30;
  const responseVars = Object.values(POOL).reduce((acc, v) => {
    if (Array.isArray(v)) return acc + v.length;
    return acc;
  }, 0);
  console.log('[aiHandlers] Module đã khởi tạo:');
  console.log(`  - Số Intent xử lý: ${intentCount}+`);
  console.log(`  - Số biến thể câu trả lời: ${responseVars}+`);
  console.log(`  - Bộ nhớ đệm: ConversationQueue (max ${MAX_HISTORY} tin/phiên, TTL ${SESSION_TTL_MS / 60000} phút)`);
  console.log('  - Tính năng: Follow-up / Cross-sell / Budget Rec / Compare / GenZ / Sentiment');
})();

// ===================================================================
// PHẦN 12: TRÍCH XUẤT VÀ PHÂN TÍCH THÔNG TIN NÂNG CAO
// ===================================================================

/**
 * Trích xuất tên thủ đô / thành phố từ tin nhắn người dùng.
 * Dùng để lọc sản phẩm theo vùng hoặc tính phí ship.
 *
 * @param {string} message
 * @returns {string|null} - Tên thành phố hoặc null
 */
function extractCity(message) {
  const cities = [
    'ha noi', 'tp hcm', 'ho chi minh', 'sai gon', 'da nang',
    'hai phong', 'can tho', 'nha trang', 'hue', 'vung tau',
    'binh duong', 'dong nai', 'long an', 'tien giang',
  ];
  // Normalize để match cả 'Hà Nội' lẫn 'ha noi'
  const lower = removeDiacritics(message).toLowerCase();
  return cities.find(c => lower.includes(c)) ?? null;
}

/**
 * Trích xuất số lượng sản phẩm từ tin nhắn.
 * Ví dụ: "cần mua 5 cái", "mua 10 máy" → 5, 10
 *
 * @param {string} message
 * @returns {number|null}
 */
function extractQuantity(message) {
  // Normalize để match cả 'cái' lẫn 'cai', 'chiếc' lẫn 'chiec', v.v.
  const m = removeDiacritics(message);
  const match = m.match(/(\d+)\s*(cai|chiec|may|cai may|bo|cap)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Phân tích mức độ khẩn cấp của người dùng.
 * "can ngay", "gap lam", "hom nay" → high urgency
 * "xem thu", "nghi ngoi da" → low urgency
 *
 * @param {string} message
 * @returns {'high'|'medium'|'low'}
 */
function detectUrgency(message) {
  // Normalize để match cả 'cần ngay' lẫn 'can ngay', 'gấp lắm' lẫn 'gap lam'
  const lower = removeDiacritics(message).toLowerCase();
  const HIGH = ['can ngay', 'gap lam', 'khan cap', 'hom nay can', 'gap', 'noi thanh hoa toc', 'nhanh nhat'];
  const LOW = ['xem thu', 'thu tim hieu', 'chua can gap', 'tham khao', 'nghi them'];
  if (HIGH.some(w => lower.includes(w))) return 'high';
  if (LOW.some(w => lower.includes(w))) return 'low';
  return 'medium';
}

/**
 * Xây dựng chuỗi context tóm tắt từ lịch sử hội thoại.
 * Dùng để đưa vào prompt nếu có tích hợp với LLM bên ngoài.
 *
 * @param {Array<{role:string, content:string}>} history
 * @returns {string}
 */
function buildContextString(history) {
  if (!history || history.length === 0) return '';
  return history
    .slice(-6)
    .map(h => `[${h.role === 'user' ? 'Khach' : 'AI'}]: ${h.content}`)
    .join('\n');
}

/**
 * Kiểm tra liệu người dùng có đang hỏi lại câu đã hỏi trước đó không.
 *
 * @param {string}   message
 * @param {Array}    history
 * @returns {boolean}
 */
function isRepeatQuestion(message, history) {
  const lower = message.toLowerCase().trim();
  return history.some(h => h.role === 'user' && h.content.toLowerCase().trim() === lower);
}

/**
 * Tạo câu trả lời khi người dùng hỏi lại câu đã hỏi.
 * Tránh trả lời y chang để tăng tương tác.
 *
 * @param {string} sessionId
 * @returns {{text: string, link: string}}
 */
function handleRepeatQuestion(sessionId = 'default') {
  const responses = [
    'Dạ anh/chị hỏi câu này rồi nhé ạ! Em trả lời thêm lần nữa: bạn có thể xem lại phản hồi trước đó của em, hoặc hỏi thêm thông tin cụ thể hơn để em tư vấn chính xác hơn ạ.',
    'Dạ em vừa trả lời câu hỏi tương tự rồi ạ! Nếu anh/chị chưa rõ phần nào, cứ hỏi thêm cụ thể em giải thích kỹ hơn nhé ạ.',
    'Dạ nếu anh/chị chưa thỏa mãn với câu trả lời trước, anh/chị có thể mô tả thêm là muốn biết gì cụ thể hơn ạ! Em luôn sẵn sàng tư vấn đầy đủ hơn ạ.',
  ];
  const text = pick(responses);
  conversationStore.push(sessionId, 'assistant', text);
  return { text, link: '/' };
}

// --- XUẤT THÊM CÁC HÀM PHẦN 12 ---
Object.assign(module.exports, {
  extractCity,
  extractQuantity,
  detectUrgency,
  buildContextString,
  isRepeatQuestion,
  handleRepeatQuestion,
  fmt,
  hasKeyword,
  calcDiscount,
  removeDiacritics,   // tiện ích chuẩn hoá input — dùng chung cho ai.js và các module khác
});
