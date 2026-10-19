'use strict';
/**
 * ============================================================
 * PRICE PARSER — Trích ngân sách từ câu tiếng Việt (dùng chung)
 * services/PriceParser.js
 * ============================================================
 *
 * Dùng chung cho ChatbotService và SearchService để hai nơi hiểu ngân sách
 * giống hệt nhau (trước đây mỗi nơi một regex riêng, chatbot chỉ hiểu "dưới").
 *
 * Hiểu được:
 *   "dưới / không quá / không vượt quá / tối đa / <"  -> kind 'max'
 *   "trên / hơn / tối thiểu / ít nhất / >"             -> kind 'min'
 *   "từ X đến Y"                                       -> kind 'range'
 *   "tầm / khoảng X", hoặc chỉ "X triệu" đứng một mình -> kind 'around' (±30%)
 *   "giá rẻ", "cao cấp" (chỉ khi implicit=true)        -> kind 'implicit'
 *
 * Quy ước: 'max' / 'min' / 'range' là ràng buộc CỨNG — không được trả sản phẩm
 * vượt ngưỡng mà không nói rõ cho khách. 'around' là ước chừng.
 *
 * @module PriceParser
 */

const { removeDiacritics } = require('../ai/huggingface');

const fmtVnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';

/** Chuẩn hóa chuỗi: bỏ dấu, hạ chữ thường, hiểu dấu chấm/phẩy trong số. */
function normalizeForPrice(query) {
  let s = removeDiacritics(String(query || '')).toLowerCase();
  // 1.500.000 -> 1500000 (dấu chấm ngăn nghìn)
  s = s.replace(/\d{1,3}(?:\.\d{3})+(?!\d)/g, (m) => m.replace(/\./g, ''));
  // 1,500,000 -> 1500000 (dấu phẩy ngăn nghìn)
  s = s.replace(/\d{1,3}(?:,\d{3})+(?!\d)/g, (m) => m.replace(/,/g, ''));
  // 5,5 -> 5.5 (dấu phẩy thập phân kiểu Việt Nam)
  s = s.replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
  return s;
}

// Đơn vị: phải kết thúc ở ranh giới từ để "5 dien thoai" không bị hiểu 'd' = đồng.
const UNIT = '(trieu|tr|cu|nghin|ngan|k|dong|vnd|d)?(?![a-z])';
const NUM = '(\\d+(?:\\.\\d+)?)';

function parseAmount(numStr, unit) {
  const num = parseFloat(numStr);
  if (Number.isNaN(num)) return null;
  const u = unit || '';
  if (/^(trieu|tr|cu)$/.test(u)) return num * 1_000_000;
  if (/^(nghin|ngan|k)$/.test(u)) return num * 1_000;
  if (/^(dong|vnd|d)$/.test(u)) return num;
  // Không có đơn vị
  if (num <= 100) return num * 1_000_000;   // "dưới 10"  -> 10 triệu
  if (num < 1000) return num * 1_000;       // "dưới 500" -> 500 nghìn
  return num;                               // đã là đồng
}

/**
 * @param {string} query
 * @param {{ implicit?: boolean }} [opts] implicit=true: hiểu cả "giá rẻ"/"cao cấp".
 * @returns {{ min: number|null, max: number|null, kind: string|null }}
 */
function extractPriceFromQuery(query, opts = {}) {
  const implicit = opts.implicit !== false;
  if (!query) return { min: null, max: null, kind: null };
  const s = normalizeForPrice(query);
  let min = null, max = null, kind = null;

  const MAXKW = '(?:(?<![a-z])(?:duoi|under|khong qua|khong vuot qua|khong vuot|toi da|nhieu nhat|re hon|thap hon|nho hon|it hon)|<=?)';
  const MINKW = '(?:(?<![a-z])(?:tren|over|toi thieu|it nhat)|(?<![a-z])(?<!(?:re|thap|nho|it) )hon|>=?)';

  // 1) "dưới / tối đa X"
  const underMatch = s.match(new RegExp(MAXKW + '\\s*' + NUM + '\\s*' + UNIT));
  if (underMatch) { max = parseAmount(underMatch[1], underMatch[2]); kind = 'max'; }

  // 2) "trên / hơn X"
  const overMatch = s.match(new RegExp(MINKW + '\\s*' + NUM + '\\s*' + UNIT));
  if (overMatch) { min = parseAmount(overMatch[1], overMatch[2]); kind = kind ? 'range' : 'min'; }

  // 3) "từ X đến Y" — mỗi số có thể có đơn vị riêng ("từ 500k đến 2 triệu")
  const rangeMatch = s.match(new RegExp(
    '(?<![a-z])(?:tu|from)\\s*' + NUM + '\\s*' + UNIT + '\\s*(?:den|toi|to|-)\\s*' + NUM + '\\s*' + UNIT));
  if (rangeMatch && min == null && max == null) {
    const u1 = rangeMatch[2] || rangeMatch[4] || '';
    const u2 = rangeMatch[4] || rangeMatch[2] || '';
    min = parseAmount(rangeMatch[1], u1);
    max = parseAmount(rangeMatch[3], u2);
    kind = 'range';
  }

  // 4) "tầm / khoảng X" -> ±30%
  const aroundMatch = s.match(new RegExp('(?<![a-z])(?:tam|khoang|around|about)\\s*' + NUM + '\\s*' + UNIT));
  if (aroundMatch && min == null && max == null) {
    const center = parseAmount(aroundMatch[1], aroundMatch[2]);
    if (center) { min = Math.round(center * 0.7); max = Math.round(center * 1.3); kind = 'around'; }
  }

  // 5) Chỉ có "X triệu" đứng một mình -> ước chừng ±30%.
  //    Đơn vị 'k' chỉ nhận khi số >= 50 vì "4K", "2K" thường là độ phân giải.
  if (min == null && max == null) {
    const bare = s.match(new RegExp('(?<![a-z0-9.])' + NUM + '\\s*(trieu|tr|cu|nghin|ngan|k)(?![a-z])'));
    if (bare && !(/^(nghin|ngan|k)$/.test(bare[2]) && parseFloat(bare[1]) < 50)) {
      const center = parseAmount(bare[1], bare[2]);
      if (center) { min = Math.round(center * 0.7); max = Math.round(center * 1.3); kind = 'around'; }
    }
  }

  if (implicit) {
    if (min == null && max == null && /\b(gia re|budget|gia tot)\b/.test(s)) { max = 5_000_000; kind = 'implicit'; }
    if (min == null && max == null && /\b(cao cap|premium|flagship|high.?end)\b/.test(s)) { min = 20_000_000; kind = 'implicit'; }
  }

  if (min != null && max != null && min > max) [min, max] = [max, min];

  if (min != null || max != null) {
    console.log(`[PriceExtract] "${String(query).slice(0, 80)}" → kind=${kind}, min=${min?.toLocaleString()}, max=${max?.toLocaleString()}`);
  }
  return { min, max, kind };
}

/** { min, max } -> điều kiện Prisma `price`. */
function toPriceFilter(price) {
  const f = {};
  if (price && price.max != null) f.lte = price.max;
  if (price && price.min != null) f.gte = price.min;
  return f;
}

/** Mô tả ngân sách bằng tiếng Việt: "dưới 5.000.000đ", "từ A đến B"... */
function describeBudget(price) {
  const { min, max, kind } = price;
  if (kind === 'around') return `tầm ${fmtVnd((min + max) / 2)}`;
  if (min != null && max != null) return `từ ${fmtVnd(min)} đến ${fmtVnd(max)}`;
  if (max != null) return `dưới ${fmtVnd(max)}`;
  if (min != null) return `trên ${fmtVnd(min)}`;
  return '';
}

/**
 * Câu thông báo khi kết quả KHÔNG khớp ngân sách khách nêu — dùng chung cho chatbot và smart-search
 * để hai nơi nói cùng một cách, không để sản phẩm vượt ngân sách xuất hiện mà không báo.
 *
 * status:
 *   'over'        có sản phẩm nhưng ngoài ngân sách (cao hơn trần / thấp hơn sàn)
 *   'none'        không có gì để gợi ý
 *   'other_brand' không có hãng đó trong tầm giá, gợi ý hãng khác CÙNG tầm giá
 * @param {string} what  ví dụ "điện thoại" (loại sản phẩm khách hỏi)
 * @param {number|null} nearest  giá của sản phẩm gần ngân sách nhất (dùng cho status 'over')
 */
function describeShortfall(status, price, what, brandName, nearest = null) {
  const desc = describeBudget(price);
  const item = what || 'sản phẩm';
  if (status === 'other_brand') {
    return `Hiện bên em chưa có ${brandName || item} ${desc}, em gợi ý một số hãng khác trong tầm giá này:`;
  }
  if (status === 'over') {
    const gap = nearest != null
      ? ` Mức giá gần ngân sách nhất hiện có là ${fmtVnd(nearest)}, em gợi ý`
      : ' Em gợi ý';
    return `Hiện bên em chưa có ${item} ${desc}.${gap} các sản phẩm gần ngân sách nhất:`;
  }
  return `Hiện bên em chưa có ${item} ${desc}.`;
}

/** "Điện thoại" -> "điện thoại" (ghép vào giữa câu). */
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * Khi KHÔNG có sản phẩm nào trong ngân sách: lấy các sản phẩm GẦN NGƯỠNG NHẤT
 * ở phía ngoài (cao hơn nếu khách đặt trần, thấp hơn nếu khách đặt sàn).
 * `where` KHÔNG được chứa điều kiện giá; danh mục/hãng do nơi gọi quyết định.
 */
async function findOverBudget(where, price, take = 4) {
  const { prisma } = require('../db'); // nạp muộn: module này test được mà không cần Prisma
  const above = price.max != null;
  const base = {
    ...where,
    is_deleted: false,
    stock: { gt: 0 },
    price: above ? { gt: price.max } : { lt: price.min },
  };
  const dir = above ? 'asc' : 'desc';
  try {
    // Catalog seed có rất nhiều dòng trùng tên: gom theo tên rồi lấy dòng sát ngưỡng nhất của mỗi tên,
    // nếu không cả `take` suất sẽ bị một sản phẩm lặp lại chiếm hết.
    const groups = await prisma.product.groupBy({
      by: ['name'],
      where: base,
      _min: { price: true },
      _max: { price: true },
      orderBy: above ? { _min: { price: 'asc' } } : { _max: { price: 'desc' } },
      take,
    });
    const rows = await Promise.all(groups.map(g => prisma.product.findFirst({
      where: { ...base, name: g.name },
      orderBy: { price: dir },
    })));
    const found = rows.filter(Boolean);
    if (found.length > 0) return found;
  } catch (err) {
    console.warn('[findOverBudget] groupBy thất bại, dùng truy vấn thường:', err.message);
  }
  return prisma.product.findMany({ where: base, orderBy: [{ price: dir }], take });
}

/**
 * Gỡ các cụm giá khỏi câu (đã bỏ dấu, chữ thường) để "5 triệu" không bị dùng làm từ khóa tìm tên sản phẩm.
 * KHÔNG gỡ số trần như "iphone 15", "ram 16gb" hay "4K" (độ phân giải): chỉ gỡ số đi kèm từ
 * khóa giá (dưới, tối đa, từ, tầm...) hoặc đi kèm đơn vị tiền.
 */
function stripPricePhrases(query) {
  const KW = '(?:(?<![a-z])(?:duoi|under|khong qua|khong vuot qua|khong vuot|toi da|nhieu nhat|re hon|thap hon|nho hon|it hon|tren|hon|over|toi thieu|it nhat|tu|from|tam|khoang|around|about)|<=?|>=?)';
  const withKw = new RegExp(KW + '\\s*' + NUM + '\\s*' + UNIT + '(?:\\s*(?:den|toi|to|-)\\s*' + NUM + '\\s*' + UNIT + ')?', 'g');
  const bare = new RegExp('(?<![a-z0-9.])' + NUM + '\\s*(trieu|tr|cu|nghin|ngan|k|dong|vnd)(?![a-z])', 'g');
  let s = normalizeForPrice(query).replace(withKw, ' ');
  s = s.replace(bare, (m, n, u) => (/^(nghin|ngan|k)$/.test(u) && parseFloat(n) < 50 ? m : ' '));
  return s.replace(/\s+/g, ' ').trim();
}

module.exports = { extractPriceFromQuery, stripPricePhrases, toPriceFilter, describeBudget, describeShortfall, lowerFirst, findOverBudget, normalizeForPrice, fmtVnd };
