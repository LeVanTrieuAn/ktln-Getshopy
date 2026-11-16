'use strict';
/**
 * Bộ nhớ đệm trạng thái tài khoản khách (is_active) cho authB2C — 16/11/2026.
 *
 * Vì sao cần: JWT của khách sống 7 ngày và không có trạng thái. Trước ngày này authB2C chỉ
 * kiểm chữ ký, nên khách bị quản trị vô hiệu hoá vẫn dùng token cũ đặt hàng được tới khi
 * token hết hạn. Muốn chặn ngay thì PHẢI hỏi DB mỗi request — bộ đệm này giữ chi phí đó nhỏ.
 *
 * Chi phí đo trên production 16/11/2026 (EXPLAIN ANALYZE, bảng 40.010 khách): tra theo khoá
 * chính 0,05 ms khi trang đã nằm trong bộ nhớ đệm của Postgres (1,2 ms lần đầu). Rẻ, nhưng
 * /api/b2c/track (optionalAuthB2C) bắn theo từng lô sự kiện của mọi khách đang xem trang:
 * không đệm thì mỗi lô chiếm một kết nối trong pool Prisma. Đệm TTL_MS = 30 s theo từng khách
 * nghĩa là tối đa 1 truy vấn / khách / 30 s.
 *
 * Vô hiệu hoá có hiệu lực NGAY: route quản trị gọi invalidate(id) trong cùng tiến trình
 * (compose chạy đúng một container server, một tiến trình node). TTL chỉ là lưới an toàn khi
 * ai đó sửa DB trực tiếp hoặc sau này chạy nhiều bản server — khi đó trễ tối đa 30 s.
 *
 * Không phụ thuộc thư viện nào (load được truyền vào) để kiểm thử bằng `node --test`.
 */

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 5_000;

/**
 * @param {object} opts
 * @param {(id: number) => Promise<{is_active: boolean} | null>} opts.load  đọc DB; null = không có khách
 * @param {number} [opts.ttlMs]
 * @param {number} [opts.maxEntries]  trần số khách giữ trong bộ nhớ (Map giữ thứ tự chèn -> bỏ cái cũ nhất)
 * @param {() => number} [opts.now]
 */
function createCustomerStatusCache({ load, ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES, now = Date.now } = {}) {
  if (typeof load !== 'function') throw new Error('createCustomerStatusCache: thiếu hàm load');
  /** id -> { value: 'active'|'inactive'|'missing', expires } */
  const entries = new Map();
  /** id -> Promise đang chạy: 20 request cùng lúc của một khách chỉ tốn 1 truy vấn. */
  const inflight = new Map();
  // Tăng mỗi lần invalidate: kết quả của truy vấn bắt đầu TRƯỚC lần invalidate không được ghi
  // đè trạng thái mới (vô hiệu hoá xong mà một truy vấn cũ ghi lại "active" là lọt 30 s).
  const generation = new Map();

  function remember(key, value) {
    if (entries.size >= maxEntries && !entries.has(key)) {
      entries.delete(entries.keys().next().value);
    }
    entries.delete(key);
    entries.set(key, { value, expires: now() + ttlMs });
  }

  /**
   * Trả 'active' | 'inactive' | 'missing'. Lỗi DB ném ra cho người gọi quyết định
   * (authB2C trả 503, optionalAuthB2C coi như khách vãng lai).
   */
  async function getStatus(id) {
    const key = String(id);
    const hit = entries.get(key);
    if (hit && hit.expires > now()) return hit.value;
    if (hit) entries.delete(key);

    const running = inflight.get(key);
    if (running) return running.p;
    const gen = generation.get(key) || 0;
    const token = {};
    // load chạy ở microtask sau, tức là SAU inflight.set bên dưới — kể cả khi load ném lỗi
    // ngay lập tức thì finally vẫn dọn được đúng mục của mình.
    const p = Promise.resolve()
      .then(() => load(id))
      .then((row) => {
        const value = !row ? 'missing' : (row.is_active === false ? 'inactive' : 'active');
        if ((generation.get(key) || 0) === gen) remember(key, value);
        return value;
      })
      .finally(() => {
        if (inflight.get(key)?.token === token) inflight.delete(key);
      });
    inflight.set(key, { token, p });
    return p;
  }

  function invalidate(id) {
    const key = String(id);
    entries.delete(key);
    inflight.delete(key);
    generation.set(key, (generation.get(key) || 0) + 1);
  }

  function clear() {
    entries.clear();
    inflight.clear();
    generation.clear();
  }

  return { getStatus, invalidate, clear, size: () => entries.size };
}

module.exports = { createCustomerStatusCache, DEFAULT_TTL_MS, DEFAULT_MAX_ENTRIES };
