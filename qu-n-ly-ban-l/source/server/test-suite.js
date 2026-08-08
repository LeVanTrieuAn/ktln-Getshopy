/**
 * ============================================================
 * GETSHOPY AI CHATBOT — COMPREHENSIVE TEST SUITE
 * ============================================================
 * 600+ test cases phân theo nhóm intent, chạy tuần tự.
 * Validation dựa theo keywords có trong response.
 * Output: PASS/FAIL per case + summary per group.
 * ============================================================
 */
'use strict';

const http = require('http');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
async function chat(message) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ message });
    const req = http.request(
      { hostname: 'localhost', port: 8080, path: '/api/b2c/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { resolve({ text: '', error: body.substring(0, 100) }); }
        });
      }
    );
    req.on('error', e => resolve({ text: '', error: e.message }));
    req.setTimeout(12000, () => { req.destroy(); resolve({ text: '', error: 'TIMEOUT' }); });
    req.write(data);
    req.end();
  });
}

// Validation helpers
const v = {
  /** Response không phải fallback mặc định */
  notFallback: (t) => !/chưa hiểu ý bạn lắm|chưa hiểu ý của bạn/i.test(t) && t.length > 20,
  /** Response chứa chào hỏi */
  greeting: (t) => /chào|getshopy|xin chào|hỗ trợ|tư vấn/i.test(t),
  /** Response có giá tiền VND */
  hasCurrency: (t) => /₫|VND|đ\b|triệu|nghìn|giá/i.test(t),
  /** Response về giao hàng */
  hasDelivery: (t) => /giao|ship|vận chuyển|nội thành|tỉnh thành|freeship/i.test(t),
  /** Response về khuyến mãi */
  hasPromo: (t) => /khuyến mãi|sale|giảm|ưu đãi|flash sale|voucher|deal/i.test(t),
  /** Response về đổi trả/bảo hành */
  hasReturn: (t) => /đổi|trả|bảo hành|hoàn tiền|lỗi|sửa/i.test(t),
  /** Response về thanh toán */
  hasPayment: (t) => /thanh toán|trả góp|MoMo|ZaloPay|VNPay|COD|tiền mặt|chuyển khoản/i.test(t),
  /** Response về theo dõi đơn */
  hasOrder: (t) => /đơn hàng|theo dõi|trạng thái|hotline|liên hệ|profile/i.test(t),
  /** Response về so sánh hoặc có 2 sản phẩm */
  hasCompare: (t) => /so sánh|vs|vs\.|và.*\*\*|Giá:|⭐|cái nào|khuyên/i.test(t),
  /** Response về hỗ trợ, liên hệ */
  hasContact: (t) => /địa chỉ|cửa hàng|chi nhánh|hotline|TP\.HCM|Hà Nội/i.test(t),
  /** Response về tai nghe, đồng hồ, phụ kiện */
  hasAccessory: (t) => /tai nghe|đồng hồ|smartwatch|micro|loa|phụ kiện|headphone/i.test(t),
  /** Response về laptop */
  hasLaptop: (t) => /laptop|máy tính xách tay|MacBook|Dell|Asus|HP|Lenovo/i.test(t),
  /** Response về điện thoại */
  hasPhone: (t) => /điện thoại|iPhone|Samsung|Xiaomi|Oppo|smartphone/i.test(t),
  /** Response về giá rẻ, hợp lý, affordable */
  hasPriceRelief: (t) => /giá tốt|hợp lý|phải chăng|rẻ|tiết kiệm|phổ thông|tầm giá/i.test(t),
  /** Response about product recommendation */
  hasRecommend: (t) => /gợi ý|đề xuất|khuyên|phù hợp|nên mua|tư vấn/i.test(t),
  /** Response text không rỗng */
  notEmpty: (t) => t && t.trim().length > 10,
  /** Response mention hủy đơn */
  hasCancel: (t) => /hủy|cancel|hoàn hàng|đang xử lý/i.test(t),
  /** Combo: notFallback + notEmpty */
  ok: (t) => v.notEmpty(t) && v.notFallback(t),
};

// ─────────────────────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────────────────────
const TESTS = [

  // ════════════════════════════════════════════════════════════
  // GROUP 1: GREETING (25 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'GREETING', m: 'xin chào',                   ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'hello',                       ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'hi shop',                     ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'chào bạn',                    ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'alo shop',                    ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'chào buổi sáng',              ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'chào buổi tối',               ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'shop ơi',                     ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'em ơi',                       ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'có ai không',                 ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'hey',                         ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'cho hỏi',                     ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'Hi shop',                     ok: t => v.greeting(t) },
  { g: 'GREETING', m: 'Helo shop',                   ok: t => v.ok(t) },       // typo — should not crash
  { g: 'GREETING', m: 'Shop ơi cho hỏi chút',        ok: t => v.ok(t) },
  { g: 'GREETING', m: 'Chào shop, hôm nay shop có gì hot?', ok: t => v.ok(t) },
  { g: 'GREETING', m: 'Hi bạn',                      ok: t => v.ok(t) },
  { g: 'GREETING', m: 'Xin chào, em cần tư vấn',     ok: t => v.ok(t) },
  { g: 'GREETING', m: 'Chào nhé shop',                ok: t => v.ok(t) },
  { g: 'GREETING', m: 'Alo, shop có bán không',       ok: t => v.ok(t) },
  { g: 'GREETING', m: '😊 chào shop',                 ok: t => v.ok(t) },
  { g: 'GREETING', m: 'shop còn mở cửa không',        ok: t => v.ok(t) },
  { g: 'GREETING', m: 'cho hỏi thăm chút',            ok: t => v.ok(t) },
  { g: 'GREETING', m: 'good morning',                 ok: t => v.ok(t) },
  { g: 'GREETING', m: 'bắt đầu nào',                  ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 2: HELP (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'HELP', m: 'bạn có thể làm gì',               ok: t => v.ok(t) },
  { g: 'HELP', m: 'shop hỗ trợ những gì',             ok: t => v.ok(t) },
  { g: 'HELP', m: 'tôi cần tư vấn',                  ok: t => v.ok(t) },
  { g: 'HELP', m: 'giúp tôi chọn sản phẩm',          ok: t => v.ok(t) },
  { g: 'HELP', m: 'hướng dẫn tôi mua hàng',          ok: t => v.ok(t) },
  { g: 'HELP', m: 'bạn biết gì về điện tử',          ok: t => v.ok(t) },
  { g: 'HELP', m: 'AI là gì vậy',                    ok: t => v.ok(t) },
  { g: 'HELP', m: 'bạn là ai',                       ok: t => v.ok(t) },
  { g: 'HELP', m: 'em tên gì vậy',                   ok: t => v.ok(t) },
  { g: 'HELP', m: 'tư vấn giúp mình với',            ok: t => v.ok(t) },
  { g: 'HELP', m: 'mình không biết mua gì',           ok: t => v.ok(t) },
  { g: 'HELP', m: 'cần tư vấn thiết bị công nghệ',   ok: t => v.ok(t) },
  { g: 'HELP', m: 'help me',                         ok: t => v.ok(t) },
  { g: 'HELP', m: 'what can you do',                 ok: t => v.ok(t) },
  { g: 'HELP', m: 'hỗ trợ khách hàng',               ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 3: SEARCH_PRODUCT — Điện thoại (40 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'PHONE_SEARCH', m: 'điện thoại',               ok: t => v.hasPhone(t) || v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'tôi muốn mua điện thoại',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'cho xem điện thoại',        ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại oppo',           ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại samsung',        ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'iphone',                    ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'iphone 15',                 ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'iphone 15 pro max',         ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'samsung galaxy s24',        ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'xiaomi 14',                 ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'Oppo Reno 11',              ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại chụp ảnh đẹp',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại pin trâu',       ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại gaming',         ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại cho học sinh',   ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại tặng ba mẹ',     ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại tặng người yêu', ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại mỏng nhẹ đẹp',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'mua smartphone',            ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'cần mua 1 cái điện thoại mới', ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'có bán iPhone không',       ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'galaxy a55',                ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'redmi note 13',             ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'vivo v29',                  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'realme 12 pro',             ok: t => v.ok(t) },
  // Gen Z slang
  { g: 'PHONE_SEARCH', m: 'dế nào xịn xò nhất shop',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại ngon bổ rẻ',    ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'mình cần cục điện thoại mới', ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'phone nào hot nhất hiện tại',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'con nào đang best seller',  ok: t => v.ok(t) },
  // Budget + phone
  { g: 'PHONE_SEARCH', m: 'điện thoại tầm 5 triệu',   ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại tầm 10 triệu',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại tầm 15 triệu',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại dưới 3 triệu',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại khoảng 20 triệu', ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'điện thoại trong khoảng 7-12 triệu', ok: t => v.ok(t) },
  // English mixed
  { g: 'PHONE_SEARCH', m: 'show me phones',            ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'I want to buy a phone',     ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'mình muốn mua phone mới',  ok: t => v.ok(t) },
  { g: 'PHONE_SEARCH', m: 'cho mình xem Samsung phone', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 4: SEARCH_PRODUCT — Laptop (30 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'LAPTOP_SEARCH', m: 'laptop',                   ok: t => v.hasLaptop(t) || v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'macbook',                  ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'macbook air m3',           ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'macbook pro 14 inch',      ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop dell',              ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop asus',              ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop hp',                ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop lenovo',            ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop gaming',            ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop gaming asus rog',   ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop học sinh',          ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop làm việc văn phòng', ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop đồ họa',            ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop nhẹ mỏng đẹp',     ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop tầm 15 triệu',      ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop tầm 20 triệu',      ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop dưới 10 triệu',     ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop ram 16gb',          ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop ssd 512gb',         ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'cần mua laptop đi học',    ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'mua laptop lần đầu nên mua gì', ok: t => v.ok(t) },
  // Gen Z
  { g: 'LAPTOP_SEARCH', m: 'máy tính xịn cho mình',   ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'cần con laptop ngon bổ rẻ', ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop nào chiến game tốt', ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'muốn mua laptop mỏng nhẹ dùng cho design', ok: t => v.ok(t) },
  // English
  { g: 'LAPTOP_SEARCH', m: 'show me laptops',         ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'I need a laptop for work', ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'laptop for video editing', ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'gaming laptop under 20 million', ok: t => v.ok(t) },
  { g: 'LAPTOP_SEARCH', m: 'best laptop for students', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 5: SEARCH_PRODUCT — Tablet (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'TABLET_SEARCH', m: 'máy tính bảng',            ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'ipad',                     ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'ipad pro',                 ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'ipad air m2',              ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'samsung galaxy tab',       ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'tablet học online',        ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'tablet vẽ kỹ thuật số',   ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'tablet giá rẻ',            ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'có bán ipad không',        ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'cho xem tablet android',  ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'tablet tầm 10 triệu',      ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'máy tính bảng cho con học', ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'cần mua tablet để xem phim', ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'show me tablets',          ok: t => v.ok(t) },
  { g: 'TABLET_SEARCH', m: 'tablet nào ngon tầm 8 triệu', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 6: ACCESSORIES (25 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ACCESSORIES', m: 'tai nghe',                   ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe không dây',         ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe có dây',            ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'airpods',                    ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'airpods pro',                ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe sony',              ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe jbl',               ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe chống ồn',          ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe gaming',            ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'đồng hồ thông minh',         ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'smartwatch',                 ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'apple watch',                ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'samsung galaxy watch',       ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'đồng hồ theo dõi sức khỏe', ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'micro thu âm',               ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'loa bluetooth',              ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'loa jbl',                    ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'phụ kiện điện thoại',        ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'ốp lưng iphone 15',          ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'cáp sạc type c',             ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'sạc nhanh 65w',              ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'pin dự phòng anker',         ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'bàn phím bluetooth',         ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'chuột không dây',            ok: t => v.ok(t) },
  { g: 'ACCESSORIES', m: 'tai nghe true wireless giá rẻ', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 7: ASK_PRICE (30 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_PRICE', m: 'iphone 15 giá bao nhiêu',     ok: t => v.hasCurrency(t) || v.ok(t) },
  { g: 'ASK_PRICE', m: 'macbook air m3 bao nhiêu tiền', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'samsung s24 giá mấy',          ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'airpods pro bao nhiêu',        ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'apple watch series 9 giá',     ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'laptop dell xps 13 giá',       ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'ipad pro 12.9 giá bao nhiêu', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'tai nghe sony wh-1000xm5 giá', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'galaxy s24 ultra bao nhiêu tiền', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'giá iphone 15 pro',            ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'iphone 15 có giá không',       ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'how much is iphone 15',        ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'price of macbook',             ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'điện thoại oppo find x7 giá mấy', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'xiaomi 14 ultra giá',          ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'laptop asus rog zephyrus giá',  ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'giá samsung galaxy tab s9',    ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'con samsung s24 plus bao nhiêu', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'iPhone 14 có còn bán không giá sao', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'táo pro max 15 bao nhiêu',    ok: t => v.ok(t) },  // slang: táo = Apple
  { g: 'ASK_PRICE', m: 'giá máy tính msi gaming',      ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'loa jbl charge 5 giá',         ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'bose quietcomfort 45 bao nhiêu tiền', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'fitbit sense 2 giá',           ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'garmin forerunner 255 bao nhiêu', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'oppo watch 3 giá bao nhiêu',   ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'realme buds air 5 pro giá',    ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'giá cả điện thoại tầm trung',  ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'điện thoại cao cấp nhất giá bao nhiêu', ok: t => v.ok(t) },
  { g: 'ASK_PRICE', m: 'laptop chạy ai giá bao nhiêu', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 8: COMPARE_SPECS (30 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'COMPARE', m: 'MacBook Air M3 và MacBook Pro 14 cái nào tốt hơn', ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'iPhone 15 hay Samsung S24 nên mua cái nào',        ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'iPad Pro và iPad Air cái nào đáng mua hơn',        ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'AirPods Pro vs Sony WH-1000XM5 tai nghe nào hay hơn', ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'laptop Dell vs Asus cái nào bền hơn',              ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Xiaomi 14 so với Samsung S24',                     ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Apple Watch S9 hay Galaxy Watch 6 tốt hơn',       ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'iPhone 15 Pro Max vs Galaxy S24 Ultra',            ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'so sánh Oppo Reno 11 và Vivo V29',                ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Laptop HP vs Lenovo dòng nào ngon hơn',           ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'iPad hay Samsung Tab xài thoải mái hơn',          ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'JBL Charge 5 với Bose SoundLink cái nào nghe hay', ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'con Samsung A55 hay Oppo A98 đáng mua hơn',       ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'iPhone 15 hay iPhone 14 nên mua cái nào',         ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'mua MacBook Air hay Dell XPS 13 cho sinh viên',   ok: t => v.ok(t) },
  // English
  { g: 'COMPARE', m: 'iPhone 15 vs Samsung S24 which is better',        ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'compare MacBook Air and MacBook Pro',             ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'AirPods or Samsung buds',                         ok: t => v.ok(t) },
  // Edge
  { g: 'COMPARE', m: 'táo 15 hay con Samsung mới ngon hơn',            ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'máy Lenovo hay Asus chạy game mượt hơn',         ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'tai nghe ANC nào tốt nhất: Sony, Bose hay JBL',  ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Pin của iPhone 15 với Samsung S24 cái nào trâu hơn', ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'camera iPhone 15 hay Pixel 8 chụp đẹp hơn',      ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Oppo find x7 so với xiaomi 14',                   ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'asus vivobook hay asus zenbook tốt hơn',          ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'ipad air m2 hay ipad pro m4 đáng mua hơn',       ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Galaxy A55 vs Redmi Note 13 Pro cái nào chụp ảnh xịn hơn', ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'Realme 12 Pro vs Vivo V29e nên chọn cái nào',    ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'so sánh loa Bose và JBL',                         ok: t => v.ok(t) },
  { g: 'COMPARE', m: 'MacBook Air M2 hay M3 đáng mua hơn',             ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 9: ASK_RECOMMEND / BUDGET (35 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'RECOMMEND', m: 'nên mua điện thoại gì tầm 10 triệu',           ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tư vấn laptop sinh viên tầm 15 triệu',         ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tầm 5 triệu mua được điện thoại nào ngon',     ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'ngân sách 20 triệu nên mua gì',                ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'mua điện thoại tặng ba mẹ tầm 8 triệu',       ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'điện thoại chụp ảnh đẹp nhất hiện nay',       ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'laptop nào phù hợp cho kế toán',               ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'đang dùng iPhone 12 nên lên đời gì',           ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'điện thoại pin khỏe nhất bây giờ',             ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'laptop mỏng nhẹ dùng lâu nhất',               ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tablet nào tốt nhất để vẽ digital art',        ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tai nghe không dây nào chống ồn tốt nhất',     ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'cần mua 1 bộ laptop + tai nghe + chuột tầm 20 triệu', ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'điện thoại nào hot nhất tháng này',            ok: t => v.ok(t) },
  // English
  { g: 'RECOMMEND', m: 'what phone should I buy',                       ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'recommend a good laptop under 15 million',     ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'best smartphone 2024',                          ok: t => v.ok(t) },
  // Gen Z
  { g: 'RECOMMEND', m: 'anh ơi cho em xin gợi ý điện thoại xịn xò',  ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'có con nào rẻ mà ngon không shop',             ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tư vấn cho mình con máy chiến game chịu được', ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'đang phân vân giữa samsung và oppo em ơi',    ok: t => v.ok(t) },
  // Complex
  { g: 'RECOMMEND', m: 'cần laptop RAM 16GB SSD 512GB tầm 15-20 triệu để làm thiết kế đồ họa', ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'mình là sinh viên kinh tế, cần laptop làm Word Excel và Powerpoint', ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tôi muốn mua tai nghe chạy bộ chống nước',    ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'smartwatch nào đo nhịp tim chính xác nhất',   ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'điện thoại nào chụp ảnh ban đêm đẹp nhất',   ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'muốn mua điện thoại đổi từ android sang iphone', ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'laptop nào chạy autocad và solidworks được',  ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'cần laptop để học lập trình python ai ml',    ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'mua gì cho bạn thân sinh nhật tầm 2-3 triệu', ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'điện thoại nào bền nhất không sợ va đập',     ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'tôi cần smartphone chụp video 4K ổn định',    ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'laptop nào có màn hình đẹp tầm 15-16 inch',  ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'đang dùng samsung cũ muốn lên đời flagship',  ok: t => v.ok(t) },
  { g: 'RECOMMEND', m: 'gợi ý điện thoại cho người già không rành công nghệ', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 10: PRICE_COMPLAINT / AFFORDABLE (25 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'PRICE_COMPLAINT', m: 'Giá cả phải chăng nhất',                 ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'mắc quá shop ơi',                       ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'bớt thêm chút được không',              ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'có hàng giá rẻ hơn không',              ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'ngân sách tôi chỉ có 5 triệu thôi',    ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'tài chính mình hơi eo, có rẻ hơn không', ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'đắt quá em ơi',                         ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'giá hợp lý nhất là bao nhiêu',          ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'budget ít xem gợi ý',                   ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'giá tốt nhất bên shop',                 ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'sản phẩm rẻ nhất shop',                 ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'tiết kiệm nhất mà vẫn tốt',            ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'không đủ tiền mua iPhone thì mua gì',  ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'giá sinh viên có không shop',            ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'quá tầm tài chính rồi có cái nào rẻ hơn', ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'giảm thêm 10% được không',              ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'nơi khác bán rẻ hơn shop',              ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'affordable phone options',               ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'budget laptop for poor student',         ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'mua được cái nào không quá đắt',        ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'giá vừa phải thôi không cần xịn',       ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'rẻ mà chất xem gì được',               ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'mình chỉ có 3 củ thôi',                ok: t => v.ok(t) },   // 3 củ = 3 triệu slang
  { g: 'PRICE_COMPLAINT', m: 'túi tiền hạn hẹp xem gợi ý nào',       ok: t => v.ok(t) },
  { g: 'PRICE_COMPLAINT', m: 'có deal gì ngon không hôm nay',         ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 11: ASK_PROMO (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_PROMO', m: 'có khuyến mãi không',                         ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'shop đang có sale không',                      ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'đang có chương trình giảm giá không',         ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'flash sale hôm nay',                           ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'có voucher không shop',                        ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'mã giảm giá có không',                         ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'deal hôm nay',                                 ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'coupon cho đơn đầu tiên',                      ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'ưu đãi thành viên',                            ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'tháng này có sale không',                      ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'giảm giá iphone không',                        ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'có offer đặc biệt không',                      ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'any promotions',                               ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'discount code',                                ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'flash sale nào ngon nhất tuần này',           ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'có deal 11.11 không shop',                    ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'sale cuối năm bắt đầu chưa',                  ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'ship miễn phí điều kiện gì',                  ok: t => v.hasDelivery(t) || v.ok(t) },
  { g: 'ASK_PROMO', m: 'có freeship không',                            ok: t => v.ok(t) },
  { g: 'ASK_PROMO', m: 'có chương trình tích điểm đổi quà không',     ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 12: ASK_DELIVERY (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_DELIVERY', m: 'giao hàng mất bao lâu',                    ok: t => v.hasDelivery(t) },
  { g: 'ASK_DELIVERY', m: 'phí ship bao nhiêu',                        ok: t => v.hasDelivery(t) || v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'ship về tỉnh được không',                   ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'giao hàng toàn quốc không',                ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'ship ra Hà Nội mất mấy ngày',              ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'giao nhanh 2h không',                       ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'đặt hôm nay nhận ngay không',              ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'vận chuyển thế nào',                        ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'freeship điều kiện gì',                     ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'giao hàng về Đà Nẵng mất mấy ngày',       ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'có giao hàng vào cuối tuần không',         ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'đóng gói có cẩn thận không',               ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'shipping fee',                              ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'how long does delivery take',               ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'ship tới nơi mình ở Cần Thơ được không',  ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'có dịch vụ giao nhanh không',              ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'cần gấp hôm nay giao được không',          ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'đơn hàng đang đi đến đâu rồi',            ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'nhận hàng ở đâu nếu không ở nhà',         ok: t => v.ok(t) },
  { g: 'ASK_DELIVERY', m: 'có giao hàng miễn phí không',              ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 13: ASK_RETURN / WARRANTY (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_RETURN', m: 'chính sách đổi trả thế nào',                 ok: t => v.hasReturn(t) },
  { g: 'ASK_RETURN', m: 'mua về dùng bị lỗi thì sao',                 ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'bảo hành bao lâu',                           ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'đổi hàng trong mấy ngày',                    ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'sản phẩm lỗi hoàn tiền không',               ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'máy bị hỏng thay thế không',                 ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'iPhone bị lỗi màn hình xử lý sao',           ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'warranty policy',                             ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'return policy',                               ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: '7 ngày đổi trả không lý do',                 ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'máy mới mua 2 ngày bị lỗi rồi',             ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'bảo hành tại nhà không',                     ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'chính sách bảo hành 1 năm chưa',             ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'máy nóng bất thường có được đổi không',      ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'hàng mở hộp ra bị xước có đổi không',       ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'đổi màu sản phẩm được không',               ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'mua sai size có trả không',                  ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'pin phồng thì xử lý sao',                   ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'màn hình bị dead pixel có đổi không',        ok: t => v.ok(t) },
  { g: 'ASK_RETURN', m: 'lỗi phần mềm có được bảo hành không',       ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 14: ASK_PAYMENT (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_PAYMENT', m: 'có trả góp không',                           ok: t => v.hasPayment(t) },
  { g: 'ASK_PAYMENT', m: 'thanh toán bằng MoMo được không',           ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'ZaloPay nhận không',                         ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'VNPay có hỗ trợ không',                     ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'trả góp 0% lãi suất không',                 ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'thanh toán COD được không',                  ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'trả bằng thẻ tín dụng được không',          ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'chuyển khoản ngân hàng được không',          ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'có payment bằng crypto không',               ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'trả góp 12 tháng lãi suất bao nhiêu',       ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'installment plan available',                  ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'do you accept credit card',                  ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'trả trước bao nhiêu %',                      ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'mua trả góp iphone 15 cần gì',              ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'có thanh toán Apple Pay không',              ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'thanh toán online hay offline',              ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'có ví điện tử nào nhận không',              ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'mình muốn chia nhỏ thanh toán được không',  ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'lãi suất trả góp 24 tháng',                  ok: t => v.ok(t) },
  { g: 'ASK_PAYMENT', m: 'có nhận tiền mặt không',                    ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 15: TRACK_ORDER / CANCEL_ORDER (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ORDER', m: 'đơn hàng của tôi đang ở đâu',                     ok: t => v.hasOrder(t) },
  { g: 'ORDER', m: 'theo dõi đơn hàng',                                ok: t => v.ok(t) },
  { g: 'ORDER', m: 'kiểm tra trạng thái đơn',                         ok: t => v.ok(t) },
  { g: 'ORDER', m: 'đơn mình đặt hôm qua chưa giao',                  ok: t => v.ok(t) },
  { g: 'ORDER', m: 'order của mình đang xử lý chưa',                  ok: t => v.ok(t) },
  { g: 'ORDER', m: 'bao giờ hàng tới',                                 ok: t => v.ok(t) },
  { g: 'ORDER', m: 'where is my order',                                ok: t => v.ok(t) },
  { g: 'ORDER', m: 'track order',                                      ok: t => v.ok(t) },
  { g: 'ORDER', m: 'hủy đơn hàng',                                     ok: t => v.hasCancel(t) },
  { g: 'ORDER', m: 'tôi muốn hủy đơn',                                ok: t => v.ok(t) },
  { g: 'ORDER', m: 'không muốn mua nữa hủy được không',               ok: t => v.ok(t) },
  { g: 'ORDER', m: 'cancel đơn hàng số 123456',                        ok: t => v.ok(t) },
  { g: 'ORDER', m: 'đặt nhầm muốn hủy',                               ok: t => v.ok(t) },
  { g: 'ORDER', m: 'hủy order trước khi ship được không',              ok: t => v.ok(t) },
  { g: 'ORDER', m: 'mình đặt 2 lần trùng nhau hủy 1 cái',            ok: t => v.ok(t) },
  { g: 'ORDER', m: 'trả hàng khi nhận được chưa',                     ok: t => v.ok(t) },
  { g: 'ORDER', m: 'đơn hàng bị delay xử lý sao',                     ok: t => v.ok(t) },
  { g: 'ORDER', m: 'giao nhầm hàng phải làm gì',                      ok: t => v.ok(t) },
  { g: 'ORDER', m: 'cancel order',                                     ok: t => v.ok(t) },
  { g: 'ORDER', m: 'đơn hàng hôm qua giao rồi vẫn chưa nhận được',   ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 16: ASK_SPECS (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_SPECS', m: 'iPhone 15 Pro Max có RAM bao nhiêu',          ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'MacBook Air M3 cấu hình thế nào',             ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'Samsung S24 Ultra chip gì',                    ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'iPad Pro M4 pin mấy mAh',                      ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'laptop dell XPS 13 màn hình mấy inch',        ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'Xiaomi 14 Ultra camera mấy MP',               ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'specs iPhone 15',                              ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'MacBook M3 cần RAM bao nhiêu',                ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'Samsung S24 có 5G không',                      ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'laptop nào màn hình 4K OLED',                  ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'Galaxy S24 Ultra bộ nhớ trong mấy GB',        ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'iphone 15 pro max nặng bao nhiêu gram',       ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'tablet nào có bút cảm ứng',                    ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'điện thoại nào sạc nhanh nhất bây giờ',      ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'MacBook Pro 14 màn hình mấy Hz',               ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'tai nghe ANC có hoạt động ổn không',          ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'Apple Watch S9 đo SpO2 không',                 ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'loa Bose S1 Pro công suất bao nhiêu',          ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'Oppo Reno 11 sạc bao lâu đầy',               ok: t => v.ok(t) },
  { g: 'ASK_SPECS', m: 'điện thoại nào màn hình sáng nhất ngoài trời', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 17: COMPLAINT (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'COMPLAINT', m: 'máy mua hôm qua bị lỗi rồi',                  ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'sản phẩm không đúng mô tả',                   ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'dịch vụ tệ quá',                              ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'giao hàng chậm quá tôi đợi mãi',             ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'hàng giao bị xước vỡ',                        ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'tôi rất không hài lòng',                      ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'nhân viên thái độ không tốt',                  ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'máy bị nóng sau khi mua về',                  ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'pin tụt nhanh bất thường',                    ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'màn hình bị lỗi điểm ảnh chết',              ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'cáp sạc đi kèm bị đứt sau 1 tuần',           ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'wifi hay bị mất kết nối',                     ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'tôi muốn phản hồi về chất lượng sản phẩm',  ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'I want to complain about my order',           ok: t => v.ok(t) },
  { g: 'COMPLAINT', m: 'my phone stopped working after 1 week',      ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 18: CONTACT / LOCATION (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'CONTACT', m: 'địa chỉ cửa hàng',                              ok: t => v.hasContact(t) },
  { g: 'CONTACT', m: 'shop ở đâu',                                     ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'hotline shop',                                    ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'số điện thoại shop',                             ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'có chi nhánh ở Hà Nội không',                   ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'giờ mở cửa',                                     ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'cửa hàng gần tôi nhất',                         ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'liên hệ chăm sóc khách hàng',                   ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'có mua trực tiếp được không',                    ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'contact information',                             ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'store location',                                  ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'email shop',                                      ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'fanpage facebook shop',                           ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'chat với người thật được không',                 ok: t => v.ok(t) },
  { g: 'CONTACT', m: 'kết nối với tư vấn viên',                       ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 19: CHECK_STOCK (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'STOCK', m: 'iPhone 15 Pro còn hàng không',                    ok: t => v.ok(t) },
  { g: 'STOCK', m: 'Samsung S24 còn không',                            ok: t => v.ok(t) },
  { g: 'STOCK', m: 'MacBook Air M3 có sẵn không',                     ok: t => v.ok(t) },
  { g: 'STOCK', m: 'AirPods Pro còn màu đen không',                   ok: t => v.ok(t) },
  { g: 'STOCK', m: 'hết hàng rồi à',                                  ok: t => v.ok(t) },
  { g: 'STOCK', m: 'bao giờ có hàng lại',                              ok: t => v.ok(t) },
  { g: 'STOCK', m: 'còn bán không shop',                               ok: t => v.ok(t) },
  { g: 'STOCK', m: 'tồn kho còn bao nhiêu chiếc',                     ok: t => v.ok(t) },
  { g: 'STOCK', m: 'product availability',                              ok: t => v.ok(t) },
  { g: 'STOCK', m: 'in stock',                                         ok: t => v.ok(t) },
  { g: 'STOCK', m: 'cần mua gấp còn không',                           ok: t => v.ok(t) },
  { g: 'STOCK', m: 'Galaxy S24 Ultra màu titanium còn không',          ok: t => v.ok(t) },
  { g: 'STOCK', m: 'laptop gaming còn hàng không',                     ok: t => v.ok(t) },
  { g: 'STOCK', m: 'đặt trước được không',                             ok: t => v.ok(t) },
  { g: 'STOCK', m: 'preorder iPhone 16 được chưa',                    ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 20: EDGE CASES — Gen Z, typos, mixed, special (40 cases)
  // ════════════════════════════════════════════════════════════
  // Gen Z language
  { g: 'EDGE', m: 'e cần con dế xịn xò để flex',                     ok: t => v.ok(t) },
  { g: 'EDGE', m: 'shop có con máy nào cháy không',                   ok: t => v.ok(t) },
  { g: 'EDGE', m: 'cần mua đồ điện tử gấp huhu',                     ok: t => v.ok(t) },
  { g: 'EDGE', m: 'ngân sách 2 triệu thì mua được gì nhỉ',           ok: t => v.ok(t) },
  { g: 'EDGE', m: 'con táo mới nhất giá bao nhiêu vậy',              ok: t => v.ok(t) },   // táo = Apple
  { g: 'EDGE', m: 'con ốc sên xanh là gì',                            ok: t => v.notEmpty(t) },  // nonsense
  { g: 'EDGE', m: 'điện thoại xịn mà giá phải chăng cơ',            ok: t => v.ok(t) },
  { g: 'EDGE', m: 'có deal cực phẩm nào không shop',                  ok: t => v.ok(t) },
  { g: 'EDGE', m: 'mình nghèo mà muốn có đồ xịn thì làm sao',       ok: t => v.ok(t) },
  { g: 'EDGE', m: 'cho hỏi thật: nên mua samsung hay iphone',        ok: t => v.ok(t) },
  // Mixed Vietnamese/English
  { g: 'EDGE', m: 'tôi muốn buy a new phone trong tầm 10 triệu',    ok: t => v.ok(t) },
  { g: 'EDGE', m: 'cần laptop for work, budget around 20M',          ok: t => v.ok(t) },
  { g: 'EDGE', m: 'show me điện thoại Samsung cheapest',             ok: t => v.ok(t) },
  { g: 'EDGE', m: 'MacBook hay Windows laptop nên mua',              ok: t => v.ok(t) },
  // Typos / no diacritics
  { g: 'EDGE', m: 'dien thoai oppo gia bao nhieu',                   ok: t => v.ok(t) },
  { g: 'EDGE', m: 'muon mua laptop gia re',                          ok: t => v.ok(t) },
  { g: 'EDGE', m: 'tai nghe khong day',                              ok: t => v.ok(t) },
  { g: 'EDGE', m: 'chao shop',                                        ok: t => v.ok(t) },
  { g: 'EDGE', m: 'dong ho thong minh',                              ok: t => v.ok(t) },
  { g: 'EDGE', m: 'bao hanh bao lau',                                ok: t => v.ok(t) },
  // Very long message
  { g: 'EDGE', m: 'Xin chào shop, mình đang tìm hiểu mua laptop để phục vụ cho việc học và làm thêm ở nhà, mình học ngành thiết kế đồ họa năm 2, ngân sách khoảng 18-22 triệu, cần máy ram 16gb trở lên, màn hình đẹp, pin tốt, mỏng nhẹ thì shop tư vấn gì cho mình', ok: t => v.ok(t) },
  // Single word queries
  { g: 'EDGE', m: 'iPhone',                                           ok: t => v.ok(t) },
  { g: 'EDGE', m: 'Samsung',                                          ok: t => v.ok(t) },
  { g: 'EDGE', m: 'laptop',                                           ok: t => v.ok(t) },
  { g: 'EDGE', m: 'giá',                                              ok: t => v.ok(t) },
  { g: 'EDGE', m: 'mua',                                              ok: t => v.ok(t) },
  // Emoji-only or emoji with text
  { g: 'EDGE', m: '😊',                                               ok: t => v.notEmpty(t) },
  { g: 'EDGE', m: '👋 chào shop',                                     ok: t => v.ok(t) },
  { g: 'EDGE', m: '💸 cần mua điện thoại rẻ',                        ok: t => v.ok(t) },
  // Numbers/codes
  { g: 'EDGE', m: '0987654321',                                        ok: t => v.notEmpty(t) },
  // Sarcastic/philosophical
  { g: 'EDGE', m: 'tôi cần điện thoại hay tôi cần hạnh phúc',        ok: t => v.notEmpty(t) },
  { g: 'EDGE', m: 'tiền nhiều thì mua gì',                            ok: t => v.ok(t) },
  // Repetitive
  { g: 'EDGE', m: 'điện thoại điện thoại điện thoại',                 ok: t => v.ok(t) },
  // Vietnamese specific slang
  { g: 'EDGE', m: 'xe máy có bán không',                              ok: t => v.notEmpty(t) },   // out of scope
  { g: 'EDGE', m: 'tủ lạnh samsung có không',                         ok: t => v.notEmpty(t) },   // out of scope
  { g: 'EDGE', m: 'shop bán gì vậy',                                  ok: t => v.ok(t) },
  { g: 'EDGE', m: 'menu sản phẩm',                                     ok: t => v.ok(t) },
  { g: 'EDGE', m: '??',                                                ok: t => v.notEmpty(t) },
  { g: 'EDGE', m: 'ok',                                                ok: t => v.notEmpty(t) },
  { g: 'EDGE', m: 'không biết mua gì',                                ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 21: CONTEXT / FOLLOW-UP scenarios (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'CONTEXT', m: 'có màu trắng không',                             ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'cái đó pin sao rồi',                             ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'bảo hành được không',                            ok: t => v.ok(t) },
  { g: 'CONTEXT', m: 'giao nhanh không',                               ok: t => v.ok(t) },
  { g: 'CONTEXT', m: 'có màu khác không',                              ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'cái đó camera tốt không',                        ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'mua ngay được không',                             ok: t => v.ok(t) },
  { g: 'CONTEXT', m: 'cái nào rẻ hơn',                                 ok: t => v.ok(t) },
  { g: 'CONTEXT', m: 'thêm vào giỏ hàng',                              ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'có khác không',                                   ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'đặt cái này',                                     ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'vừa hỏi xong rồi quên rồi',                     ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'xem tiếp',                                        ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'còn loại nào khác không',                        ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'thêm 1 cái nữa',                                 ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'oke mình lấy cái đó',                            ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'cái trên hay cái dưới tốt hơn',                 ok: t => v.ok(t) },
  { g: 'CONTEXT', m: 'không thích màu đó xem màu khác',               ok: t => v.ok(t) },
  { g: 'CONTEXT', m: 'cho mình nghĩ thêm',                             ok: t => v.notEmpty(t) },
  { g: 'CONTEXT', m: 'ok mình mua',                                    ok: t => v.notEmpty(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 22: SMALLTALK / CHIT-CHAT (20 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'SMALLTALK', m: 'cảm ơn nhé',                                  ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'thanks shop',                                  ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'cảm ơn em nhiều lắm',                         ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'bye bye shop',                                 ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'hẹn gặp lại',                                 ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'ok được rồi',                                  ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'bạn là AI không',                              ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'em tên là gì',                                 ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'ai tạo ra bạn vậy',                           ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'thank you very much',                          ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'thôi không cần nữa',                          ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'mình nghĩ lại rồi',                            ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'appreciated nhé',                              ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'tuyệt vời quá',                                ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'bạn giỏi lắm',                                 ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'shop tư vấn nhiệt tình ghê',                  ok: t => v.ok(t) },
  { g: 'SMALLTALK', m: 'oke mình sẽ cân nhắc',                        ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'sẽ liên hệ lại sau nhé',                     ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'thôi bye nhé shop',                            ok: t => v.notEmpty(t) },
  { g: 'SMALLTALK', m: 'ok vậy, cảm ơn bạn',                         ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 23: FEEDBACK_POSITIVE — khen ngợi (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'FEEDBACK_POSITIVE', m: 'shop uy tín lắm',                      ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'hàng nhận đúng mô tả',                 ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'giao hàng nhanh và cẩn thận',          ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'nhân viên tư vấn rất nhiệt tình',      ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'mua lần nào cũng hài lòng',            ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'sẽ recommend cho bạn bè',              ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: '5 sao cho shop luôn',                   ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'hàng xịn hơn mong đợi',               ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'dịch vụ xuất sắc',                     ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'shop tốt lắm mình rất hài lòng',       ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'chất lượng vượt kỳ vọng',              ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'trust shop này 100%',                   ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'sẽ mua ủng hộ shop lần nữa',          ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'đóng gói cẩn thận quá',                ok: t => v.ok(t) },
  { g: 'FEEDBACK_POSITIVE', m: 'rất hài lòng với trải nghiệm mua hàng', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 24: ASK_BEST_SELLER — sản phẩm bán chạy (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_BEST_SELLER', m: 'điện thoại bán chạy nhất shop là gì',   ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'top sản phẩm bán chạy',                  ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'cái gì đang hot nhất hiện tại',         ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'mọi người hay mua gì',                   ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'best seller của shop là gì',             ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'laptop nào bán chạy nhất',               ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'điện thoại phổ biến nhất năm nay',       ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'sản phẩm trending là gì',               ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'review tốt nhất shop có gì',             ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'tai nghe bán chạy nhất',                 ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'khách hàng ưa chuộng sản phẩm nào',     ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'top 3 sản phẩm hot nhất',                ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'sản phẩm nào nhiều người mua nhất',      ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'cái gì đáng mua nhất bây giờ',          ok: t => v.ok(t) },
  { g: 'ASK_BEST_SELLER', m: 'tư vấn sản phẩm hot cho mình',           ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 25: ASK_NEW_ARRIVAL — hàng mới (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_NEW_ARRIVAL', m: 'có hàng mới về không',                   ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'iphone mới nhất là model nào',           ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'samsung mới nhất ra model gì',           ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'có điện thoại mới về tuần này không',    ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'mới ra mắt cái nào vậy',                ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'có hàng pre order không',                ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'laptop mới nhất là gì',                  ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'bao giờ có iphone 17',                   ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'điện thoại nào mới ra mắt',              ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'có collection mới không',                 ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'sản phẩm nào mới nhất 2025',             ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'đặt trước được không',                   ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'pre order iphone mới được không',        ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'khi nào có hàng mới về',                 ok: t => v.ok(t) },
  { g: 'ASK_NEW_ARRIVAL', m: 'đăng ký nhận thông báo hàng mới được không', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 26: URGENT_NEED — cần gấp (15 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'URGENT_NEED', m: 'cần mua điện thoại gấp',                     ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'giao hỏa tốc được không',                    ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'ship nội thành trong 2h được không',         ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'tôi cần ngay hôm nay',                      ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'khẩn cấp cần laptop ngay',                   ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'mai tặng sinh nhật cần giao ngày hôm nay',  ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'đặt sáng có giao trưa không',                ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'nếu đặt bây giờ bao giờ có hàng',           ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'giao express được không',                    ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'cần hàng trong ngày hôm nay',               ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'đặt online lấy tại cửa hàng ngay được không', ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'mai đi công tác cần máy tính ngay',         ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: '1 tiếng nữa có thể nhận hàng không',        ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'hàng có sẵn giao ngay không',               ok: t => v.ok(t) },
  { g: 'URGENT_NEED', m: 'cần gấp lắm ship được ngay không',          ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 27: BULK_ORDER — mua sỉ / doanh nghiệp (12 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'BULK_ORDER', m: 'mua 10 laptop cho công ty có giảm giá không', ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'giá sỉ bao nhiêu',                            ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'mua số lượng lớn chiết khấu thế nào',        ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'trở thành đại lý của shop được không',        ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'đặt hàng cho doanh nghiệp',                   ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'mua cho cơ quan có ưu đãi gì',               ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'giá B2B bao nhiêu',                           ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'mua 50 ipad cho trường học',                  ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'đặt theo lô có giảm không',                   ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'hợp tác phân phối được không',                ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'giá sỉ cho trường học',                       ok: t => v.ok(t) },
  { g: 'BULK_ORDER', m: 'corporate pricing có không',                   ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 28: ASK_INVOICE — hóa đơn VAT (12 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_INVOICE', m: 'có xuất hóa đơn VAT không',                  ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'mua cho công ty cần hóa đơn đỏ',             ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'xuất hóa đơn theo tên công ty được không',   ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'giá đã bao gồm VAT chưa',                    ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'hóa đơn điện tử có không',                   ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'thuế VAT là bao nhiêu phần trăm',            ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'cần hóa đơn tài chính',                      ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'có phiếu bảo hành không',                    ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'mua về cần giấy tờ gì',                      ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'xuất hóa đơn GTGT được không',               ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'hóa đơn điện tử gửi qua email được không',   ok: t => v.ok(t) },
  { g: 'ASK_INVOICE', m: 'biên lai mua hàng có không',                  ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 29: ASK_GIFT_WRAP — gói quà (12 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_GIFT_WRAP', m: 'mua tặng bạn gái có gói quà không',        ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'có dịch vụ gói quà không',                 ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'hộp quà có đẹp không',                     ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'thiệp chúc mừng đính kèm được không',      ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'mua tặng sinh nhật đóng gói thế nào',      ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'gói quà có tính thêm tiền không',          ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'wrap quà tặng được không',                 ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'có thể viết thiệp riêng không',            ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'mua tặng ngày 8/3 có gói quà không',       ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'giao kèm hoa được không',                  ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'surprise delivery có không',               ok: t => v.ok(t) },
  { g: 'ASK_GIFT_WRAP', m: 'hộp quà tết có bán không',                 ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 30: ASK_LOYALTY — tích điểm thành viên (12 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_LOYALTY', m: 'có tích điểm không',                         ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'điểm thưởng đổi được gì',                    ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'thành viên VIP có ưu đãi gì',                ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'cách tích điểm như thế nào',                 ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'đăng ký thành viên ở đâu',                   ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'điểm có hết hạn không',                      ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'hạng gold là gì',                            ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'loyalty program của shop',                    ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'mua bao nhiêu lên hạng vip',                 ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'có quà tặng sinh nhật thành viên không',     ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'cashback khi mua hàng không',                ok: t => v.ok(t) },
  { g: 'ASK_LOYALTY', m: 'điểm quy đổi thành tiền được không',         ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 31: ASK_SECOND_HAND — hàng cũ (12 cases)
  // ════════════════════════════════════════════════════════════
  { g: 'ASK_SECOND_HAND', m: 'có bán điện thoại refurbished không',    ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'iphone cũ giá bao nhiêu',               ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'macbook cũ có bán không',                ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'hàng like new là gì',                    ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'máy refurb có bảo hành không',          ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'hàng trưng bày có bán không',            ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'điện thoại second hand chất lượng không', ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'certified refurbished là gì',            ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'laptop cũ 99% có không',                ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'mua máy tân trang được đảm bảo không',  ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'ipad cũ giá rẻ có không',               ok: t => v.ok(t) },
  { g: 'ASK_SECOND_HAND', m: 'hàng tân trang so với hàng mới khác gì', ok: t => v.ok(t) },

  // ════════════════════════════════════════════════════════════
  // GROUP 32: EXTRA EDGE CASES (40 cases) — phức tạp hơn
  // ════════════════════════════════════════════════════════════
  // --- Tiếng Việt không dấu ---
  { g: 'EXTRA_EDGE', m: 'dien thoai iphone 15 gia bao nhieu',          ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'laptop dell gia re nhat',                      ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'co hang tai nghe bose khong',                 ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'giao hang bao lau',                            ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'bao hanh bao lau',                            ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'tra gop khong lai suat duoc khong',           ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'co khuyen mai khong',                         ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'sua dien thoai duoc khong',                   ok: t => v.ok(t) },

  // --- Hỗn hợp Anh - Việt ---
  { g: 'EXTRA_EDGE', m: 'iphone 15 Pro Max có sale không',             ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'AirPods Pro gen 2 giá bao nhiêu',             ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'MacBook Air M3 có màu midnight không',        ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'Galaxy S24 Ultra specs thế nào',              ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'Surface Pro 9 có bán không',                  ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'Apple Watch Series 9 còn hàng không',         ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'Pixel 8 Pro có ship không',                   ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'nothing phone (2) giá bao nhiêu',             ok: t => v.ok(t) },

  // --- Emoji + cảm xúc ---
  { g: 'EXTRA_EDGE', m: '😍 muốn mua iPhone quá',                      ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: '🤔 chưa biết mua gì',                         ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: '💰 ngân sách 15 triệu nên mua gì',            ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: '📱 cần điện thoại chụp ảnh đẹp',              ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: '🎮 laptop gaming tầm 25 triệu',               ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: '❓ có ai tư vấn giúp mình không',             ok: t => v.ok(t) },

  // --- Câu lẫn lộn / không rõ intent ---
  { g: 'EXTRA_EDGE', m: 'vừa mua vừa hỏi được không',                  ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'mua máy tính hay điện thoại nào ngon hơn',    ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'pin khỏe camera tốt màn đẹp giá rẻ',         ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'muốn mua nhưng chưa chắc mua cái gì',        ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'cho mình hỏi nhanh',                          ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'tư vấn dùm mình với shop ơi',                 ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'budget 20 triệu nên đầu tư vào gì',          ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'mua đồ cho con cái cần gì',                   ok: t => v.ok(t) },

  // --- Sự kiện / mùa ---
  { g: 'EXTRA_EDGE', m: 'tết năm nay có sale không',                   ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: '11.11 có flash sale không',                   ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'black friday giảm giá nhiều không',            ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'cuối năm có sale lớn không',                  ok: t => v.ok(t) },
  { g: 'EXTRA_EDGE', m: 'valentine mua quà gì cho bạn gái dùng máy android', ok: t => v.ok(t) },

  // --- Ngoài phạm vi (out-of-scope) ---
  { g: 'EXTRA_EDGE', m: 'bán máy tính để bàn không',                   ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'có bán camera Sony A7IV không',               ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'bán TV OLED không',                           ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'router wifi có không',                        ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'bán điều hòa panasonic không',                ok: t => v.notEmpty(t) },

  // --- Câu rất ngắn / không rõ ---
  { g: 'EXTRA_EDGE', m: 'cho xem',                                     ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'tư vấn',                                      ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'mua',                                         ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'giá',                                         ok: t => v.notEmpty(t) },
  { g: 'EXTRA_EDGE', m: 'thêm',                                        ok: t => v.notEmpty(t) },
];

// ─────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────
async function runAll() {
  const groupStats = {};
  const failures = [];
  let pass = 0, fail = 0;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  GETSHOPY AI CHATBOT — TEST SUITE (${TESTS.length} cases)`);
  console.log(`${'═'.repeat(70)}\n`);

  for (let i = 0; i < TESTS.length; i++) {
    const tc = TESTS[i];
    if (!groupStats[tc.g]) groupStats[tc.g] = { pass: 0, fail: 0 };

    const res = await chat(tc.m);
    const text = res.text || '';
    const isOk = tc.ok(text);

    if (isOk) {
      pass++;
      groupStats[tc.g].pass++;
      process.stdout.write('.');
    } else {
      fail++;
      groupStats[tc.g].fail++;
      failures.push({ group: tc.g, msg: tc.m, got: text.substring(0, 80).replace(/\n/g, ' ') });
      process.stdout.write('F');
    }

    if ((i + 1) % 50 === 0) process.stdout.write(` ${i+1}/${TESTS.length}\n`);
  }

  // ── Summary
  console.log(`\n\n${'─'.repeat(70)}`);
  console.log(`TOTAL: ${pass} PASS / ${fail} FAIL / ${TESTS.length} tests`);
  console.log(`PASS RATE: ${((pass/TESTS.length)*100).toFixed(1)}%`);
  console.log(`${'─'.repeat(70)}`);

  // Group breakdown
  console.log('\n📊 BY GROUP:');
  for (const [g, s] of Object.entries(groupStats)) {
    const rate = (s.pass / (s.pass + s.fail) * 100).toFixed(0);
    const bar = '█'.repeat(Math.floor(rate/5)) + '░'.repeat(20 - Math.floor(rate/5));
    console.log(`  ${g.padEnd(18)} [${bar}] ${rate}% (${s.pass}/${s.pass+s.fail})`);
  }

  // Failures
  if (failures.length > 0) {
    console.log(`\n❌ FAILURES (${failures.length}):`);
    for (const f of failures) {
      console.log(`\n  [${f.group}] Input: "${f.msg}"`);
      console.log(`           Got  : "${f.got || '(empty)'}"`);
    }
  } else {
    console.log('\n✅ ALL TESTS PASSED!');
  }

  console.log('\n');
  return { pass, fail, total: TESTS.length, failures, groupStats };
}

runAll().catch(console.error);
