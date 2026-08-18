/**
 * DECISION TREE — Cây Quyết Định (Tư vấn chọn máy)
 * ===================================================
 * @description
 *   Luồng tư vấn thông minh dạng câu hỏi tuần tự.
 *   AI liên tục đặt câu hỏi để thu thập thông tin, sau đó
 *   rẽ nhánh cho đến khi tìm ra sản phẩm phù hợp nhất.
 *
 *   Ví dụ luồng hội thoại:
 *   ─────────────────────────────────────────────────────────
 *   AI: "Anh/chị đang tìm sản phẩm gì?"
 *   KH: "Điện thoại"
 *   AI: "Ngân sách anh/chị tầm bao nhiêu?"
 *   KH: "10 triệu"
 *   AI: "Anh/chị dùng chủ yếu để làm gì: chơi game, chụp ảnh, hay dùng cơ bản?"
 *   KH: "Chụp ảnh"
 *   AI: → Gợi ý iPhone 15 (camera tốt, tầm 10-12 triệu)
 *   ─────────────────────────────────────────────────────────
 *
 *   Cấu trúc cây:
 *   - Mỗi node là một câu hỏi (question node) hoặc kết quả (leaf node)
 *   - Mỗi cạnh là một câu trả lời → dẫn đến node con
 *   - Leaf node chứa filter criteria để query Database
 *
 *   Session state:
 *   - Mỗi phiên chat lưu vị trí hiện tại trong cây và các câu trả lời đã cho
 *   - Khi phiên hết hoặc khách muốn reset → quay về gốc
 *
 * @author Getshopy AI Team
 */

'use strict';

const { removeDiacritics } = require('../routes/aiHandlers');

// ─────────────────────────────────────────────────────────────────────────────
// ĐỊNH NGHĨA CÂY QUYẾT ĐỊNH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cây quyết định dạng nested object.
 * - type: 'question' | 'leaf'
 * - question: câu hỏi hiển thị cho khách
 * - options: các câu trả lời có thể (key: pattern để match, value: node con)
 * - filters: (chỉ dùng ở leaf) criteria để query DB
 *
 * @type {Object}
 */
const DECISION_TREE = {
  id:       'root',
  type:     'question',
  question: 'Dạ anh/chị đang muốn tìm **loại sản phẩm** gì ạ?\n\n1️⃣ Điện thoại thông minh\n2️⃣ Laptop / Máy tính\n3️⃣ Máy tính bảng (iPad)\n4️⃣ Tai nghe / Phụ kiện',
  options: {
    dien_thoai: {
      keywords: ['dien thoai', 'smartphone', 'phone', 'iphone', 'samsung', '1', 'mot'],
      id:       'phone_budget',
      type:     'question',
      question: 'Dạ ngân sách của anh/chị tầm bao nhiêu ạ?\n\n1️⃣ Dưới 5 triệu\n2️⃣ 5 - 10 triệu\n3️⃣ 10 - 15 triệu\n4️⃣ 15 triệu trở lên',
      options: {
        budget_low: {
          keywords: ['duoi 5', 'di 5', '1 2 3 4', 'thap', 're', 'gia re', '1', 'mot'],
          id:       'phone_low_use',
          type:     'question',
          question: 'Anh/chị dùng điện thoại chủ yếu để làm gì ạ?\n\n1️⃣ Lướt mạng xã hội, nhắn tin cơ bản\n2️⃣ Chụp ảnh selfie / TikTok\n3️⃣ Chơi game nhẹ',
          options: {
            basic: {
              keywords: ['luot', 'mang', 'tin', 'co ban', 'goi dien', '1', 'mot'],
              id:    'leaf_phone_basic_low',
              type:  'leaf',
              label: 'Điện thoại cơ bản < 5 triệu',
              filters: { category: 'Điện thoại thông minh', maxPrice: 5_000_000 },
              message: 'Dạ với ngân sách dưới 5 triệu và nhu cầu cơ bản, em gợi ý các dòng **Xiaomi Redmi, Samsung Galaxy A-series** — pin trâu, dùng mượt cho công việc hàng ngày ạ!',
            },
            selfie: {
              keywords: ['anh', 'selfie', 'tiktok', 'chup', 'quay', '2', 'hai'],
              id:    'leaf_phone_selfie_low',
              type:  'leaf',
              label: 'Điện thoại selfie < 5 triệu',
              filters: { category: 'Điện thoại thông minh', maxPrice: 5_000_000 },
              message: 'Dạ tầm này thì **OPPO A-series** và **Samsung Galaxy A14/A15** là lựa chọn tốt nhất cho camera selfie ạ! AI làm đẹp rất thông minh đó ạ.',
            },
            gaming_light: {
              keywords: ['game', 'choi', '3', 'ba'],
              id:    'leaf_phone_gaming_low',
              type:  'leaf',
              label: 'Gaming phone < 5 triệu',
              filters: { category: 'Điện thoại thông minh', maxPrice: 5_000_000 },
              message: 'Dạ tầm dưới 5 triệu mà chơi game thì **Xiaomi Redmi Note** là lựa chọn tốt nhất — chip Snapdragon ổn, màn 120Hz, pin 5000mAh ạ!',
            },
          },
        },
        budget_mid: {
          keywords: ['5 10', '5-10', 'trung', '5 den 10', '2', 'hai'],
          id:       'phone_mid_use',
          type:     'question',
          question: 'Anh/chị ưu tiên điểm nào nhất ạ?\n\n1️⃣ Camera chụp ảnh đẹp\n2️⃣ Pin trâu, dùng lâu\n3️⃣ Hiệu năng mạnh, chơi game',
          options: {
            camera: {
              keywords: ['camera', 'chup', 'anh', 'dep', '1', 'mot'],
              id:    'leaf_phone_camera_mid',
              type:  'leaf',
              label: 'Camera phone 5-10 triệu',
              filters: { category: 'Điện thoại thông minh', minPrice: 5_000_000, maxPrice: 10_000_000 },
              message: 'Dạ tầm 5-10 triệu mà muốn camera tốt thì **Google Pixel 7a** và **Samsung Galaxy A54** đang là top đầu ạ! Camera AI cực kỳ thông minh đó ạ.',
            },
            battery: {
              keywords: ['pin', 'trau', 'lau', 'ben', '2', 'hai'],
              id:    'leaf_phone_battery_mid',
              type:  'leaf',
              label: 'Pin trâu 5-10 triệu',
              filters: { category: 'Điện thoại thông minh', minPrice: 5_000_000, maxPrice: 10_000_000 },
              message: 'Dạ **Xiaomi Redmi Note 13 Pro** và **Samsung Galaxy A55** là 2 cái pin trâu nhất tầm này ạ! 5000mAh+, sạc nhanh 33W, dùng cả ngày thoải mái ạ.',
            },
            gaming: {
              keywords: ['game', 'hieu nang', 'manh', 'choi', '3', 'ba'],
              id:    'leaf_phone_gaming_mid',
              type:  'leaf',
              label: 'Gaming phone 5-10 triệu',
              filters: { category: 'Điện thoại thông minh', minPrice: 5_000_000, maxPrice: 10_000_000 },
              message: 'Dạ **Poco X6 Pro** và **Realme GT 6T** đang là best-in-class gaming tầm 7-9 triệu ạ! Chip Snapdragon 8s Gen 3, màn 120Hz, tản nhiệt tốt ạ.',
            },
          },
        },
        budget_high: {
          keywords: ['10 15', '10-15', '3', 'ba'],
          id:       'phone_high_brand',
          type:     'question',
          question: 'Anh/chị thích **thương hiệu** nào ạ?\n\n1️⃣ Apple iPhone\n2️⃣ Samsung Galaxy\n3️⃣ Không quan trọng, miễn ngon',
          options: {
            apple: {
              keywords: ['apple', 'iphone', 'ios', '1', 'mot'],
              id:    'leaf_iphone_high',
              type:  'leaf',
              label: 'iPhone 10-15 triệu',
              filters: { category: 'Điện thoại thông minh', minPrice: 10_000_000, maxPrice: 15_000_000, brand: 'apple' },
              message: 'Dạ tầm 10-15 triệu, **iPhone 15** đang là lựa chọn hoàn hảo ạ! USB-C mới, camera 48MP, chip A16 Bionic cực mạnh ạ. Bên em đang có hàng chính hãng VN/A nhé ạ!',
            },
            samsung: {
              keywords: ['samsung', 'galaxy', 'android', '2', 'hai'],
              id:    'leaf_samsung_high',
              type:  'leaf',
              label: 'Samsung 10-15 triệu',
              filters: { category: 'Điện thoại thông minh', minPrice: 10_000_000, maxPrice: 15_000_000, brand: 'samsung' },
              message: 'Dạ **Samsung Galaxy S23 FE** hoặc **Galaxy A55** 5G tầm đó rất ngon ạ! Màn AMOLED đẹp, camera AI thông minh, dùng 4 năm vẫn được update ạ.',
            },
            any: {
              keywords: ['any', 'khong', 'mieng', 'tot', 'ngon', '3', 'ba'],
              id:    'leaf_any_high',
              type:  'leaf',
              label: 'Best value 10-15 triệu',
              filters: { category: 'Điện thoại thông minh', minPrice: 10_000_000, maxPrice: 15_000_000 },
              message: 'Dạ tầm 10-15 triệu thì **iPhone 15** và **Samsung Galaxy S23 FE** đang là best value nhất thị trường ạ! Em gợi ý anh/chị thử trực tiếp tại cửa hàng để chọn cái vừa tay hơn ạ.',
            },
          },
        },
        budget_premium: {
          keywords: ['15 tro len', 'cao cap', 'khong gioi han', 'tuy thich', '4', 'bon', 'pro', 'max', 'ultra'],
          id:    'leaf_premium_phone',
          type:  'leaf',
          label: 'Flagship > 15 triệu',
          filters: { category: 'Điện thoại thông minh', minPrice: 15_000_000 },
          message: 'Dạ tầm flagship thì **iPhone 15 Pro Max** và **Samsung Galaxy S24 Ultra** đang là đỉnh cao hiện tại ạ! Chip A17 Pro / Snapdragon 8 Gen 3, camera zoom 200MP ạ. Anh/chị ưu tiên iOS hay Android để em tư vấn chi tiết hơn nhé ạ?',
        },
      },
    },

    laptop: {
      keywords: ['laptop', 'may tinh', 'macbook', 'notebook', '2', 'hai'],
      id:       'laptop_use',
      type:     'question',
      question: 'Anh/chị mua laptop chủ yếu để làm gì ạ?\n\n1️⃣ Học tập / Văn phòng (Word, Excel, Zoom)\n2️⃣ Lập trình / Đồ họa\n3️⃣ Chơi game',
      options: {
        office: {
          keywords: ['hoc', 'van phong', 'word', 'excel', 'zoom', 'co ban', '1', 'mot'],
          id:    'leaf_laptop_office',
          type:  'leaf',
          label: 'Laptop văn phòng',
          filters: { category: 'Máy tính xách tay', maxPrice: 20_000_000 },
          message: 'Dạ cho học tập/văn phòng thì **MacBook Air M2**, **Dell Inspiron 14**, hoặc **ASUS VivoBook 14** đang rất được ưa chuộng ạ! Nhẹ, pin trâu, màn đẹp ạ. Ngân sách anh/chị tầm bao nhiêu để em lọc thêm nhé ạ?',
        },
        dev: {
          keywords: ['lap trinh', 'code', 'do hoa', 'thiet ke', 'render', '2', 'hai'],
          id:    'leaf_laptop_dev',
          type:  'leaf',
          label: 'Laptop lập trình / đồ họa',
          filters: { category: 'Máy tính xách tay', minPrice: 15_000_000 },
          message: 'Dạ cho lập trình/đồ họa thì **MacBook Pro M3** hoặc **ASUS ProArt Studiobook** là lựa chọn top ạ! RAM 16GB+, màn IPS chính xác màu sắc ạ. Anh/chị cần macOS hay Windows ạ?',
        },
        gaming: {
          keywords: ['game', 'choi game', 'gaming', 'lol', 'pubg', '3', 'ba'],
          id:       'laptop_gaming_budget',
          type:     'question',
          question: 'Ngân sách cho laptop gaming của anh/chị là?\n\n1️⃣ 15 - 20 triệu\n2️⃣ 20 - 30 triệu\n3️⃣ Trên 30 triệu',
          options: {
            gaming_low: {
              keywords: ['15 20', '15-20', '1', 'mot'],
              id:    'leaf_laptop_gaming_low',
              type:  'leaf',
              label: 'Gaming laptop 15-20 triệu',
              filters: { category: 'Máy tính xách tay', minPrice: 15_000_000, maxPrice: 20_000_000 },
              message: 'Dạ tầm 15-20 triệu thì **ASUS TUF Gaming A15** và **Lenovo LOQ** đang là best value nhất ạ! RTX 4060, màn 144Hz, đủ chạy hầu hết game AAA ở setting High ạ!',
            },
            gaming_mid: {
              keywords: ['20 30', '20-30', '2', 'hai'],
              id:    'leaf_laptop_gaming_mid',
              type:  'leaf',
              label: 'Gaming laptop 20-30 triệu',
              filters: { category: 'Máy tính xách tay', minPrice: 20_000_000, maxPrice: 30_000_000 },
              message: 'Dạ tầm 20-30 triệu thì **ASUS ROG Zephyrus G14**, **MSI Katana 15**, **Razer Blade 14** là đỉnh ạ! RTX 4070, màn 165Hz, tản nhiệt vapor chamber ạ.',
            },
            gaming_high: {
              keywords: ['tren 30', '30', '3', 'ba'],
              id:    'leaf_laptop_gaming_high',
              type:  'leaf',
              label: 'Gaming laptop > 30 triệu',
              filters: { category: 'Máy tính xách tay', minPrice: 30_000_000 },
              message: 'Dạ budget khủng thì **ASUS ROG Strix SCAR 18** hoặc **Razer Blade 16** với RTX 4090 là lựa chọn không thể cưỡng lại ạ! Đỉnh cao gaming laptop thế giới hiện tại ạ!',
            },
          },
        },
      },
    },

    tablet: {
      keywords: ['tablet', 'ipad', 'may tinh bang', '3', 'ba'],
      id:    'leaf_tablet',
      type:  'leaf',
      label: 'Máy tính bảng',
      filters: { category: 'Máy tính bảng' },
      message: 'Dạ bên em có đầy đủ các dòng iPad ạ! **iPad mini** (nhỏ gọn), **iPad Air** (cân bằng), **iPad Pro M4** (mạnh nhất) ạ. Anh/chị dùng chủ yếu để học, vẽ, hay xem phim để em gợi ý phù hợp hơn ạ?',
    },

    accessory: {
      keywords: ['tai nghe', 'headphone', 'phu kien', 'loa', 'dong ho', 'smartwatch', '4', 'bon'],
      id:    'leaf_accessory',
      type:  'leaf',
      label: 'Phụ kiện',
      filters: { category: 'Phụ kiện công nghệ' },
      message: 'Dạ bên em có đầy đủ phụ kiện ạ! **Tai nghe** (AirPods, Sony, Samsung), **Đồng hồ thông minh**, **Loa Bluetooth**, **Micro thu âm** ạ. Anh/chị cần loại phụ kiện nào ạ?',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DECISION TREE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

class DecisionTree {
  constructor() {
    this.tree = DECISION_TREE;
    /**
     * Session state: Map sessionId → { nodeId: string, answers: Object }
     * @type {Map<string, {nodeId: string, answers: Object}>}
     */
    this._sessions = new Map();

    /** TTL tự xóa session sau 20 phút */
    this._TTL_MS = 20 * 60 * 1000;
  }

  // ─────────────────────────────────────────────────────────────────
  // QUẢN LÝ SESSION
  // ─────────────────────────────────────────────────────────────────

  /** Lấy session hiện tại của user, hoặc tạo mới nếu chưa có */
  _getSession(sessionId) {
    if (!this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, {
        nodeId:  'root',
        answers: {},
        timer:   null,
      });
    }
    const session = this._sessions.get(sessionId);
    // Reset TTL
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => this._sessions.delete(sessionId), this._TTL_MS);
    return session;
  }

  /** Bắt đầu lại từ đầu */
  resetSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (session?.timer) clearTimeout(session.timer);
    this._sessions.delete(sessionId);
    console.log(`[DecisionTree] Reset session: ${sessionId}`);
  }

  /** Kiểm tra session có đang active không */
  hasActiveSession(sessionId) {
    return this._sessions.has(sessionId);
  }

  // ─────────────────────────────────────────────────────────────────
  // ĐIỀU HƯỚNG CÂY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Tìm node hiện tại trong cây theo nodeId.
   * @param {string} nodeId
   * @param {Object} [tree=this.tree]
   * @returns {Object|null}
   */
  _findNode(nodeId, tree = this.tree) {
    if (tree.id === nodeId) return tree;
    if (tree.options) {
      for (const option of Object.values(tree.options)) {
        const found = this._findNode(nodeId, option);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Match câu trả lời của khách với các option keywords của node hiện tại.
   * @param {string}  answer   - Câu trả lời của khách
   * @param {Object}  node     - Node question hiện tại
   * @returns {Object|null}    - Node con phù hợp, hoặc null
   */
  _matchOption(answer, node) {
    const normalized = removeDiacritics(answer).toLowerCase();
    if (!node.options) return null;

    for (const [, optionNode] of Object.entries(node.options)) {
      const keywords = optionNode.keywords || [];
      if (keywords.some(kw => normalized.includes(kw))) {
        return optionNode;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // BƯỚC KẾ TIẾP TRONG CÂY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Xử lý input của khách trong context Decision Tree và trả về response.
   *
   * @param {string} sessionId  - ID phiên chat
   * @param {string} message    - Câu trả lời của khách
   * @returns {DecisionTreeResult}
   *
   * @typedef {Object} DecisionTreeResult
   * @property {string}       text      - Câu trả lời AI
   * @property {boolean}      isLeaf    - Đã đến kết quả cuối chưa
   * @property {Object|null}  filters   - Criteria để query DB (chỉ khi isLeaf=true)
   * @property {boolean}      isDone    - Luồng đã kết thúc
   */
  step(sessionId, message) {
    const session    = this._getSession(sessionId);
    const currentNode = this._findNode(session.nodeId);

    if (!currentNode) {
      this.resetSession(sessionId);
      return this.start(sessionId);
    }

    // Nếu đang ở leaf — đã xong, reset
    if (currentNode.type === 'leaf') {
      this.resetSession(sessionId);
      return {
        text:    currentNode.message,
        isLeaf:  true,
        filters: currentNode.filters,
        isDone:  true,
        label:   currentNode.label,
      };
    }

    // Tìm option khớp với câu trả lời của khách
    const nextNode = this._matchOption(message, currentNode);

    if (!nextNode) {
      // Không match — hỏi lại
      return {
        text:    `Dạ anh/chị trả lời không khớp ạ, anh/chị chọn một trong các mục bên dưới nhé:\n\n${currentNode.question}`,
        isLeaf:  false,
        filters: null,
        isDone:  false,
      };
    }

    // Cập nhật session → node tiếp theo
    session.nodeId = nextNode.id;
    session.answers[currentNode.id] = message;

    // Nếu node tiếp theo là leaf
    if (nextNode.type === 'leaf') {
      this.resetSession(sessionId);
      console.log(`[DecisionTree] Leaf reached: "${nextNode.label}" | session=${sessionId}`);
      return {
        text:    nextNode.message,
        isLeaf:  true,
        filters: nextNode.filters,
        isDone:  true,
        label:   nextNode.label,
      };
    }

    // Node tiếp theo là question — tiếp tục hỏi
    return {
      text:    nextNode.question,
      isLeaf:  false,
      filters: null,
      isDone:  false,
    };
  }

  /**
   * Bắt đầu luồng Decision Tree cho một session mới.
   * Gọi khi khách trigger intent ASK_RECOMMEND hoặc nói "tư vấn chọn máy".
   *
   * @param {string} sessionId
   * @returns {DecisionTreeResult}
   */
  start(sessionId) {
    this.resetSession(sessionId); // Xóa session cũ nếu có
    const session = this._getSession(sessionId);
    session.nodeId = 'root';

    return {
      text:    this.tree.question,
      isLeaf:  false,
      filters: null,
      isDone:  false,
    };
  }
}

/** Singleton */
const decisionTreeInstance = new DecisionTree();
module.exports = DecisionTree;
module.exports.decisionTree = decisionTreeInstance;
