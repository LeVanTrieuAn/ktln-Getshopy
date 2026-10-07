/**
 * Suy HÃNG và DANH MỤC từ TÊN sản phẩm.
 *
 * VÌ SAO CẦN: seed-categories.js và seed-brands.js gán lại danh mục/hãng bằng
 * cách CHỌN NGẪU NHIÊN trong danh sách hợp lệ, không hề nhìn vào tên. Hai script
 * đó chạy TRƯỚC fill-600k.js, nên lúc chạy chỉ có bộ sản phẩm demo từ db.json —
 * và thứ duy nhất chúng làm được là xáo trộn bộ đó:
 *
 *   "iPhone 15 Pro Max"  -> hãng Anker, danh mục "hub laptop"
 *   "MacBook Air M3"     -> hãng LG
 *   "AirPods Pro"        -> hãng TP-Link, danh mục "bàn phím laptop"
 *
 * Content-based học theo hãng và danh mục, nên gắn sai là gợi ý sai. Và đúng
 * mấy món này lại là những món khách mua nhiều nhất trong dữ liệu.
 *
 * Quy tắc khớp theo đầu tên. Không khớp thì trả null và script tự chọn như cũ —
 * chỉ can thiệp khi chắc chắn.
 */
'use strict';

const NAME_RULES = [
  { re: /^iPhone\b/i,      brand: 'br-apple', category: 'cat-phone' },
  { re: /^iPad\b/i,        brand: 'br-apple', category: 'cat-tablet' },
  { re: /^MacBook\b/i,     brand: 'br-apple', category: 'cat-laptop' },
  { re: /^AirPods\b/i,     brand: 'br-apple', category: 'cat-av-bt-earphone' },
  { re: /^Apple Watch\b/i, brand: 'br-apple', category: 'cat-watch' },
];

/** Trả { brand, category } nếu tên khớp một quy tắc, ngược lại null. */
function ruleFor(name) {
  if (!name) return null;
  const r = NAME_RULES.find(x => x.re.test(String(name).trim()));
  return r ? { brand: r.brand, category: r.category } : null;
}

module.exports = { ruleFor, NAME_RULES };
