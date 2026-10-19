'use strict';
// Chạy: node tests/price-parser.test.js   (từ thư mục ai-bot, không cần DB hay mạng)
const assert = require('assert');
const { extractPriceFromQuery: ex } = require('../src/services/PriceParser');

const M = 1_000_000;
// [câu hỏi, min, max, kind]
const CASES = [
  ['tôi muốn mua điện thoại dưới 5 triệu',   null, 5 * M, 'max'],
  ['dien thoai duoi 5 trieu',                null, 5 * M, 'max'],
  ['điện thoại dưới 5tr',                    null, 5 * M, 'max'],
  ['điện thoại dưới 5.5 triệu',              null, 5.5 * M, 'max'],
  ['điện thoại dưới 5,5 triệu',              null, 5.5 * M, 'max'],
  ['điện thoại dưới 5 củ',                   null, 5 * M, 'max'],
  ['điện thoại không quá 5 triệu',           null, 5 * M, 'max'],
  ['điện thoại không vượt quá 5 triệu',      null, 5 * M, 'max'],
  ['điện thoại tối đa 5 triệu',              null, 5 * M, 'max'],
  ['tai nghe dưới 500k',                     null, 500_000, 'max'],
  ['ốp lưng iphone dưới 200k',               null, 200_000, 'max'],
  ['laptop dưới 15000000',                   null, 15 * M, 'max'],
  ['laptop dưới 15.000.000',                 null, 15 * M, 'max'],
  ['laptop dưới 10',                         null, 10 * M, 'max'],
  ['điện thoại trên 10 triệu',               10 * M, null, 'min'],
  ['điện thoại tối thiểu 10 triệu',          10 * M, null, 'min'],
  ['điện thoại hơn 10 triệu',                10 * M, null, 'min'],
  ['rẻ hơn 3 triệu được không',              null, 3 * M, 'max'],
  ['có cái nào thấp hơn 2 triệu không',      null, 2 * M, 'max'],
  ['điện thoại từ 3 đến 5 triệu',            3 * M, 5 * M, 'range'],
  ['điện thoại từ 3 tới 5 triệu',            3 * M, 5 * M, 'range'],
  ['tai nghe từ 500k đến 2 triệu',           500_000, 2 * M, 'range'],
  ['điện thoại tầm 5 triệu',                 3.5 * M, 6.5 * M, 'around'],
  ['điện thoại khoảng 5 triệu',              3.5 * M, 6.5 * M, 'around'],
  ['mua điện thoại 5 triệu',                 3.5 * M, 6.5 * M, 'around'],
  ['tai nghe 500k',                          350_000, 650_000, 'around'],
  ['điện thoại giá rẻ',                      null, 5 * M, 'implicit'],
  ['laptop cao cấp',                         20 * M, null, 'implicit'],
  // Không phải ngân sách
  ['tivi 4K',                                null, null, null],
  ['màn hình 2K 144Hz',                      null, null, null],
  ['iphone 15 pro max',                      null, null, null],
  ['sạc 65W',                                null, null, null],
  ['xin chào',                               null, null, null],
  ['chính sách đổi trả',                     null, null, null],
];

let fail = 0;
const { stripPricePhrases: strip } = require('../src/services/PriceParser');
// Cụm giá bị gỡ khỏi từ khóa, nhưng số model / độ phân giải thì giữ
const STRIP = [
  ['điện thoại dưới 5 triệu',        'dien thoai'],
  ['laptop gaming từ 10 đến 15 triệu', 'laptop gaming'],
  ['iphone 15 pro max dưới 30 triệu', 'iphone 15 pro max'],
  ['tivi 4K tầm 10 triệu',            'tivi 4k'],
  ['tai nghe 500k',                   'tai nghe'],
  ['ram 16gb giá rẻ',                 'ram 16gb gia re'],
];
for (const [q, expect] of STRIP) {
  const got = strip(q);
  if (got !== expect) { fail++; console.log(`FAIL strip "${q}" -> "${got}" (mong đợi "${expect}")`); }
}
for (const [q, min, max, kind] of CASES) {
  const r = ex(q);
  const ok = r.min === min && r.max === max && r.kind === kind;
  if (!ok) { fail++; console.log(`FAIL  "${q}"\n      mong đợi min=${min} max=${max} kind=${kind}\n      nhận được min=${r.min} max=${r.max} kind=${r.kind}`); }
}
assert.strictEqual(fail, 0, `${fail}/${CASES.length} ca sai`);
console.log(`price-parser: ${CASES.length}/${CASES.length} ca đạt`);
