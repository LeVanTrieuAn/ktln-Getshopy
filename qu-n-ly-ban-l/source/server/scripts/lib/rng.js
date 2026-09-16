/**
 * Bộ sinh số giả ngẫu nhiên CÓ HẠT GIỐNG CỐ ĐỊNH, dùng chung cho mọi script seed.
 *
 * VÌ SAO CẦN:
 * `Math.random()` lấy hạt giống từ hệ điều hành, mỗi tiến trình một khác. Với
 * một đồ án cần tái lập kết quả thì đó là lỗi nghiêm trọng:
 *
 *   - Hai máy seed riêng ra hai catalog khác nhau hoàn toàn
 *   - `docker compose down -v` rồi up lại là mất bộ dữ liệu cũ vĩnh viễn
 *   - Số liệu trong báo cáo không ai chạy lại ra được, kể cả chính mình
 *
 * KHÔNG dùng thư viện ngoài: mulberry32 chỉ 5 dòng, và thêm phụ thuộc cho
 * một việc nhỏ thế này là đánh đổi tệ.
 *
 * Nguồn thuật toán:
 *   mulberry32 — Tommy Ettinger, thuật toán miền công cộng.
 *     https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *   xmur3 — hàm băm chuỗi thành hạt giống 32-bit, cùng họ MurmurHash3.
 *     https://stackoverflow.com/a/47593316
 *
 * Mulberry32 đủ tốt cho việc sinh dữ liệu mẫu: chu kỳ 2^32, phân bố đều, qua
 * được gjrand. KHÔNG dùng cho mật mã — chỗ nào cần bí mật thật thì dùng
 * `crypto.randomBytes`.
 */

'use strict';

// Đổi giá trị này là ĐỔI TOÀN BỘ dữ liệu sinh ra. Giữ nguyên để mọi máy ra
// cùng một bộ. Ghi đè bằng biến môi trường SEED_RANDOM_SEED khi cần bộ khác.
const DEFAULT_SEED = 'kltn-getshopy-2026';

/** Băm chuỗi thành hạt giống 32-bit. */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** Hạt giống 32-bit -> hàm trả số thực trong [0, 1). */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tạo một dòng ngẫu nhiên độc lập cho `namespace`.
 *
 * Mỗi script phải có namespace RIÊNG. Nếu dùng chung một dòng, thêm một lời
 * gọi rng() ở script chạy trước sẽ làm lệch toàn bộ dãy số của các script sau
 * — sửa một chỗ mà dữ liệu đổi hết, rất khó lần ra nguyên nhân.
 */
function createRng(namespace) {
  const base = process.env.SEED_RANDOM_SEED || DEFAULT_SEED;
  return mulberry32(xmur3(`${base}:${namespace}`)());
}

/**
 * Mốc thời gian cố định cho dữ liệu seed.
 *
 * `new Date()` lúc seed khiến mỗi lần seed ra một mốc khác — flash sale, đơn
 * hàng mẫu đều lệch, và biểu đồ theo thời gian không so sánh được giữa hai lần chạy.
 */
function seedBaseDate() {
  return new Date(process.env.SEED_BASE_DATE || '2026-01-01T00:00:00Z');
}

/** Xáo trộn Fisher-Yates, KHÔNG làm biến đổi mảng gốc.
 *
 *  Thay cho `arr.sort(() => Math.random() - 0.5)`: cách đó vừa lệch phân bố
 *  (một số hoán vị xuất hiện nhiều hơn hẳn), vừa đưa hàm so sánh không nhất
 *  quán vào sort — theo chuẩn ECMAScript thì kết quả là không xác định. */
function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

module.exports = { createRng, seedBaseDate, shuffle, DEFAULT_SEED };
