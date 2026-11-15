'use strict';
/**
 * KPI "hôm nay" của dashboard admin: đọc NHÁNH NÓNG, dự phòng bằng KHO (16/11/2026).
 *
 * Vì sao: trước 16/11/2026 thẻ doanh thu / số đơn đọc analytics.sale_orders — view trên
 * warehouse.fact_orders_detail của nhánh lạnh (Debezium -> Kafka -> MinIO -> dbt 5 phút),
 * đo được 5–8 phút từ lúc đặt đơn tới lúc lên thẻ. Nhánh nóng realtime.orders_live
 * (Kafka -> ClickHouse) đã có từ 13/09 với độ trễ ~2 s (results.md §19) nhưng dashboard
 * chưa từng đọc nó. Phương án "A+" (người dùng duyệt 16/11/2026):
 *   - doanh thu hôm nay / hôm qua = SUM(sub_total) trên orders_live FINAL, CÙNG quy tắc
 *     trạng thái với view cũ. Trên toàn lịch sử Σ net_amount (nhánh lạnh) = Σ Order.subTotal,
 *     đo lại 16/11/2026 theo từng ngày: 370 ngày, 0 ngày lệch -> số không đổi, chỉ tươi hơn;
 *   - số đơn = số ĐƠN, không phải số dòng hàng. sale_orders là MỘT DÒNG MỖI OrderItem nên
 *     COUNT(*) cũ đếm dòng: gấp ~2,27 lần số đơn (6 381 029 dòng / 2 816 534 đơn tính doanh
 *     thu, đo 16/11/2026) — kéo theo giá trị đơn trung bình thấp đi chừng ấy lần;
 *   - nhánh nóng không dùng được thì quay về kho, ghi log, và trả `source` để giao diện
 *     hiện nhãn nguồn số.
 *
 * Module không require gói ngoài nào (ClickHouse client, Prisma...) — mọi thứ tiêm vào qua
 * createKpiToday() — để kiểm thử được bằng `node` trần (tests/kpi-today.test.js).
 */

// ─── QUY TẮC TRẠNG THÁI: MỘT CHỖ DUY NHẤT ─────────────────────────────────
// Câu hỏi CÒN MỞ với người dùng (16/11/2026): khoá luận viết doanh thu "chỉ đơn đã thu
// tiền", nhưng view analytics.sale_orders (scripts/etl/compat-sale-orders.sql) map
//     status = if(payment_status = 'PAID', 'CONFIRMED', order_status)
// nên status = 'CONFIRMED' nghĩa là: ĐÃ THU TIỀN, HOẶC đơn đang ở trạng thái CONFIRMED dù
// chưa thu (COD vừa đặt). Đơn COD chuyển SHIPPING mà chưa thu thì lại rơi ra, tới khi
// DELIVERED + PAID mới tính lại. Chưa đổi quy tắc ở đây — chỉ gom về một chỗ:
//   - `hot`       : điều kiện trên cột của realtime.orders_live (status = Order.status);
//   - `warehouse` : điều kiện trên view analytics.sale_orders.
// Hai vế của cùng một quy tắc phải chọn ra đúng cùng một tập đơn (đã đối chiếu, xem trên).
// Đổi quy tắc: đổi REVENUE_RULE. Muốn các BIỂU ĐỒ khác của dashboard (theo giờ, chi nhánh,
// danh mục, xu hướng — vẫn lọc status = 'CONFIRMED' trên view) đổi theo thì phải sửa cả
// mapping trong compat-sale-orders.sql, nếu không thẻ KPI và biểu đồ sẽ lệch nhau.
const REVENUE_RULES = {
  // Đang dùng — y hệt view hiện tại.
  paid_or_confirmed: {
    hot: "(payment_status = 'PAID' OR status = 'CONFIRMED')",
    warehouse: "status = 'CONFIRMED'",
  },
  // Theo câu chữ khoá luận: chỉ đơn đã thu tiền.
  paid_only: {
    hot: "payment_status = 'PAID'",
    warehouse: "payment_status = 'PAID'",
  },
};
const REVENUE_RULE = 'paid_or_confirmed';

// Đơn huỷ theo nghĩa của view: status = 'VOIDED' <=> chưa PAID và order_status = 'VOIDED'.
// Order.status hiện KHÔNG có giá trị VOIDED (chỉ CONFIRMED/SHIPPING/DELIVERED/COMPLETED/
// CANCELLED — đo 16/11/2026) nên tỷ lệ huỷ luôn 0 ở cả hai nhánh; giữ nguyên nghĩa cũ,
// không tự ý đổi sang CANCELLED.
const VOIDED_RULE = {
  hot: "(payment_status != 'PAID' AND status = 'VOIDED')",
  warehouse: "status = 'VOIDED'",
};

// Kết quả kiểm tra sức khoẻ nhánh nóng được dùng lại trong 30 s: WebSocket hỏi KPI mỗi 5 s,
// kiểm tra mỗi lượt là gấp 6 lần số truy vấn mà không thêm thông tin gì.
const PROBE_TTL_MS = 30000;
// Consumer Kafka của ClickHouse cập nhật last_poll_time liên tục kể cả khi topic rảnh (đo
// 16/11/2026: 3 lần xem cách nhau vài phút đều lệch 0 s so với now(), num_messages_read = 0).
// Quá 2 phút không poll = treo.
const POLL_STALE_S = 120;

/** Câu SQL KPI một ngày trên nhánh nóng — một lượt quét trả cả hôm nay lẫn hôm qua. */
function hotTodaySql(date, tz, ruleName = REVENUE_RULE) {
  const r = REVENUE_RULES[ruleName].hot;
  const D = `toDate('${date}')`;
  // Sau FINAL mỗi order_id còn đúng một dòng (bản CDC mới nhất), nên count() = số ĐƠN.
  // Không lọc ngày ở WHERE: khoá sắp xếp là order_id (không cắt được theo ngày), partition
  // theo tháng và TTL 7 ngày nên bảng vốn chỉ có ~7 ngày — điều kiện ngày nằm trong *If().
  // _is_deleted ở WHERE được áp SAU khi FINAL gộp (optimize_move_to_prewhere_if_final =
  // false, mặc định của 24.8 — đã xem trên production).
  return `SELECT
  sumIf(sub_total, d = ${D} AND ${r}) AS revenue_today,
  sumIf(sub_total, d = ${D} - 1 AND ${r}) AS revenue_yesterday,
  countIf(d = ${D} AND ${r}) AS orders_today,
  countIf(d = ${D} AND ${VOIDED_RULE.hot}) AS voided_today,
  countIf(d = ${D}) AS all_orders_today
FROM (
  SELECT toDate(order_date, '${tz}') AS d, sub_total, status, payment_status
  FROM realtime.orders_live FINAL
  WHERE _is_deleted = 0
)`;
}

/** Cùng các chỉ số, đọc kho (nhánh lạnh). Dùng khi lọc chi nhánh, ngày đã qua, hoặc dự phòng. */
function warehouseTodaySql(date, tz, branchId = null, ruleName = REVENUE_RULE) {
  const r = REVENUE_RULES[ruleName].warehouse;
  const D = `toDate('${date}')`;
  const bf = branchId ? `AND branch_id = '${branchId}'` : '';
  // BETWEEN thay cho IN: điều kiện khoảng trên toDate(order_date) chắc chắn cắt được
  // partition toYYYYMM(order_date) của fact (đo 16/11/2026 trên production: read_rows = 22).
  // uniqExact(order_id): view là một dòng mỗi OrderItem — đếm ĐƠN, không đếm dòng.
  return `SELECT
  sumIf(net_amount, d = ${D} AND ${r}) AS revenue_today,
  sumIf(net_amount, d = ${D} - 1 AND ${r}) AS revenue_yesterday,
  uniqExactIf(order_id, d = ${D} AND ${r}) AS orders_today,
  uniqExactIf(order_id, d = ${D} AND ${VOIDED_RULE.warehouse}) AS voided_today,
  uniqExactIf(order_id, d = ${D}) AS all_orders_today
FROM (
  SELECT toDate(order_date, '${tz}') AS d, order_id, net_amount, status, payment_status
  FROM analytics.sale_orders
  WHERE toDate(order_date, '${tz}') BETWEEN ${D} - 1 AND ${D} ${bf}
)`;
}

// Kiểm tra 1 — đủ đối tượng và consumer còn sống. Bảng/view thiếu thì câu KPI lỗi ngay nên
// đằng nào cũng biết; cái câu này bắt thêm được là consumer chết / chưa nhận partition,
// khi orders_live vẫn trả lời bình thường nhưng đứng im.
const PROBE_META_SQL = `SELECT
  (SELECT count() FROM system.tables WHERE database = 'realtime' AND name IN ('kafka_orders', 'mv_orders_live', 'orders_live')) AS objects,
  (SELECT countIf(length(assignments.partition_id) > 0) FROM system.kafka_consumers WHERE database = 'realtime' AND table = 'kafka_orders') AS assigned,
  (SELECT dateDiff('second', max(last_poll_time), now()) FROM system.kafka_consumers WHERE database = 'realtime' AND table = 'kafka_orders') AS poll_age_s`;

// Kiểm tra 2 — nhánh nóng có thiếu đơn nào mà KHO đã có không (hôm qua + hôm nay).
// Cùng một topic Kafka nuôi cả hai nhánh, nhánh nóng luôn tới trước (~2 s so với 5–8 phút),
// nên lúc khoẻ con số này bằng 0. Lớn hơn 0 nghĩa là nhánh nóng đã bỏ sót đơn — MV ghi sai
// mà không báo lỗi (từng xảy ra: đọc nhầm tầng JSON, xem realtime-layer.sql), message hỏng
// bị kafka_skip_broken_messages bỏ qua, hoặc bảng vừa tạo lại chưa nạp bù — lúc đó số của
// kho đáng tin hơn. So TẬP đơn thay vì so số lượng: so số lượng thì đơn mới (chỉ nhánh nóng
// có) che mất đơn bị sót. NOT IN trên mọi phiên bản của orders_live (không FINAL, không lọc
// _is_deleted): chỉ cần biết nhánh nóng đã từng thấy đơn đó.
function probeCountSql(date, tz) {
  const D = `toDate('${date}')`;
  const win = `toDate(order_date, '${tz}') BETWEEN ${D} - 1 AND ${D}`;
  return `SELECT
  (SELECT count() FROM realtime.orders_live FINAL WHERE _is_deleted = 0 AND ${win}) AS hot_orders,
  (SELECT uniqExact(order_id) FROM analytics.sale_orders WHERE ${win}) AS warehouse_orders,
  (SELECT uniqExact(order_id) FROM analytics.sale_orders WHERE ${win} AND order_id NOT IN (SELECT order_id FROM realtime.orders_live)) AS missing_in_hot`;
}

const num = (v) => Number(v) || 0;

/** Chuẩn hoá một dòng kết quả (Int64 của ClickHouse về dạng chuỗi trong JSON). */
function parseRow(row, source, reason) {
  return {
    source,
    reason: reason || null,
    revenue_today: num(row?.revenue_today),
    revenue_yesterday: num(row?.revenue_yesterday),
    orders_today: num(row?.orders_today),
    voided_today: num(row?.voided_today),
    all_orders_today: num(row?.all_orders_today),
  };
}

/** Trường KPI dùng chung cho REST /api/dashboard/kpis và gói WebSocket KPI_UPDATE. */
function toKpiFields(t) {
  const rt = t.revenue_today;
  const ry = t.revenue_yesterday;
  const ot = t.orders_today;
  return {
    revenue_today: rt,
    revenue_vs_yesterday_pct: ry > 0 ? parseFloat(((rt - ry) / ry * 100).toFixed(1)) : 0,
    orders_today: ot,
    avg_order_value: ot > 0 ? Math.round(rt / ot) : 0,
    // Tỷ lệ huỷ theo ĐƠN (trước 16/11/2026: theo dòng hàng, cùng lỗi với số đơn).
    void_rate: t.all_orders_today > 0 ? parseFloat((t.voided_today / t.all_orders_today * 100).toFixed(1)) : 0,
    // 'realtime' = realtime.orders_live; 'warehouse' = analytics.sale_orders (dbt).
    source: t.source,
  };
}

/**
 * @param {object} deps
 * @param {(sql: string) => Promise<object[]>} deps.chHot  truy vấn ClickHouse KHÔNG qua circuit
 *        breaker: nhánh nóng hỏng thì lỗi của nó không được mở mạch cho cả dashboard.
 * @param {(sql: string) => Promise<object[]>} deps.chWarehouse  truy vấn kho mặc định.
 * @param {string} deps.tz         múi giờ nghiệp vụ (BUSINESS_TZ).
 * @param {() => string} deps.today  'YYYY-MM-DD' hôm nay theo giờ nghiệp vụ.
 * @param {{log: Function, warn: Function}} [deps.logger]
 * @param {() => number} [deps.now]
 */
function createKpiToday({ chHot, chWarehouse, tz, today, logger = console, now = Date.now }) {
  let probeState = { date: null, at: 0, ok: false, reason: 'chưa kiểm tra' };
  let probeInflight = null;
  let lastLogged = null;

  async function runProbe(date) {
    let ok = false;
    let reason = '';
    try {
      const [m] = await chHot(PROBE_META_SQL);
      if (num(m?.objects) < 3) {
        reason = `thiếu đối tượng nhánh nóng (${num(m?.objects)}/3: kafka_orders, mv_orders_live, orders_live)`;
      } else if (num(m?.assigned) < 1) {
        reason = 'consumer Kafka của ClickHouse chưa nhận partition';
      } else if (num(m?.poll_age_s) > POLL_STALE_S) {
        reason = `consumer Kafka không poll đã ${num(m?.poll_age_s)} s`;
      } else {
        const [c] = await chHot(probeCountSql(date, tz));
        if (num(c?.missing_in_hot) > 0) {
          reason = `nhánh nóng thiếu ${num(c.missing_in_hot)}/${num(c.warehouse_orders)} đơn mà kho đã có (hôm qua + hôm nay)`;
        } else {
          ok = true;
        }
      }
    } catch (e) {
      reason = `kiểm tra nhánh nóng lỗi: ${e?.message || e}`;
    }
    probeState = { date, at: now(), ok, reason };
    return probeState;
  }

  function probe(date) {
    if (probeState.date === date && now() - probeState.at < PROBE_TTL_MS) return Promise.resolve(probeState);
    // REST và WebSocket có thể hỏi cùng lúc — chỉ một lượt kiểm tra chạy.
    if (!probeInflight) probeInflight = runProbe(date).finally(() => { probeInflight = null; });
    return probeInflight;
  }

  // Chỉ ghi log khi nguồn số (hoặc lý do dự phòng) ĐỔI — WebSocket chạy mỗi 5 s, ghi mỗi
  // lượt thì log ngập. Lọc chi nhánh / xem ngày cũ là đường đi bình thường, không ghi.
  function noteSource(source, reason) {
    const key = `${source}|${reason || ''}`;
    if (key === lastLogged) return;
    lastLogged = key;
    if (source === 'realtime') logger.log('[KPI] Số hôm nay: nhánh nóng realtime.orders_live');
    else logger.warn(`[KPI] Số hôm nay: DỰ PHÒNG bằng kho analytics.sale_orders — ${reason}`);
  }

  /**
   * KPI bán hàng của một ngày. Nhánh nóng chỉ phục vụ "hôm nay, tất cả chi nhánh":
   *   - orders_live không có cột chi nhánh: bảng Order không có (chi nhánh nằm ở
   *     OrderItem.branch_id, mà cột này rỗng ở cả 6 795 760 dòng — đo 16/11/2026), nên
   *     message CDC của Order cũng không có. Lọc chi nhánh -> đọc kho;
   *   - ngày khác hôm nay -> đọc kho (nhánh nóng chỉ giữ 7 ngày, và số ngày cũ không cần tươi).
   * @param {{date: string, branchId?: string|null, warehouseQuery?: Function}} opts
   */
  async function fetchToday({ date, branchId = null, warehouseQuery = null }) {
    const branch = branchId && branchId !== 'ALL' ? branchId : null;
    let reason = null;
    const wantHot = !branch && date === today();
    if (branch) reason = 'lọc chi nhánh — orders_live không có cột chi nhánh';
    else if (!wantHot) reason = 'ngày khác hôm nay';
    else {
      const p = await probe(date);
      if (!p.ok) {
        reason = p.reason;
      } else {
        try {
          const rows = await chHot(hotTodaySql(date, tz));
          noteSource('realtime', null);
          return parseRow(rows[0], 'realtime', null);
        } catch (e) {
          reason = `truy vấn nhánh nóng lỗi: ${e?.message || e}`;
          // Không tin kết quả kiểm tra cũ nữa: lượt sau kiểm tra lại từ đầu.
          probeState = { date, at: now(), ok: false, reason };
        }
      }
    }
    if (wantHot) noteSource('warehouse', reason);
    const rows = await (warehouseQuery || chWarehouse)(warehouseTodaySql(date, tz, branch));
    return parseRow(rows[0], 'warehouse', reason);
  }

  return { fetchToday };
}

module.exports = {
  createKpiToday,
  toKpiFields,
  hotTodaySql,
  warehouseTodaySql,
  probeCountSql,
  PROBE_META_SQL,
  REVENUE_RULES,
  REVENUE_RULE,
  VOIDED_RULE,
  PROBE_TTL_MS,
  POLL_STALE_S,
};
