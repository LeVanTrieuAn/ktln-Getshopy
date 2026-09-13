import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, message } from 'antd';
import { api } from '../../services/api';

/**
 * Popup thanh toán VietQR.
 *
 * Ba điểm thiết kế đáng lưu ý:
 *
 * 1. Đồng hồ đếm ngược lấy theo GIỜ SERVER (seconds_remaining trả về từ mỗi
 *    lần polling), không tự đếm ở client. Máy khách sai giờ hoặc tab bị treo
 *    thì đếm ở client sẽ lệch.
 *
 * 2. Server giữ chỗ trong kho LÂU HƠN đồng hồ hiển thị ở đây (8 phút so với
 *    5 phút). Chuẩn EMVCo không có trường hết hạn, nên khách quét ở phút 4:50
 *    mà ngân hàng xử lý xong lúc 5:15 là chuyện thường — khoảng chênh đó hấp
 *    thụ độ trễ. Hết giờ trên màn hình không có nghĩa tiền chuyển sau đó bị mất.
 *
 * 3. Luôn hiện số tài khoản bên cạnh QR. Khách không quét được (máy tính, app
 *    ngân hàng lỗi) thì vẫn chuyển tay được — và mã đối soát dùng bảng chữ
 *    Crockford Base32 bỏ I/L/O/U nên đọc bằng mắt không nhầm 0 với O.
 *
 * Bảng màu đơn sắc (trắng/đen). Không dùng màu antd mặc định vì nút primary
 * xanh và Tag đỏ/xanh sẽ phá tông. Nhấn mạnh bằng ĐỘ TƯƠNG PHẢN thay vì sắc
 * độ: sắp hết giờ thì đảo nền thành đen chữ trắng, không chuyển sang đỏ.
 */
export default function PaymentQRModal({ open, orderData, isDark, onPaid, onClose }) {
  const [status, setStatus] = useState('PENDING');
  const [remaining, setRemaining] = useState(orderData?.display_ttl_seconds ?? 300);
  const pollRef = useRef(null);
  const tickRef = useRef(null);
  // Mốc đầy của thanh tiến trình. Giữ trong ref để lần polling sau server trả
  // về số nhỏ hơn cũng không làm thanh bị "đầy lại".
  const totalRef = useRef(orderData?.display_ttl_seconds ?? 300);

  const qr = orderData?.qr;
  const orderId = orderData?.order_id;

  const fmt = n => (n ?? 0).toLocaleString('vi-VN');
  const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`Đã sao chép ${label}`);
    } catch {
      message.warning('Trình duyệt không cho sao chép, vui lòng chọn và copy thủ công');
    }
  };

  const poll = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.b2c.getPaymentStatus(orderId);
      setStatus(res.payment_status);

      // Đồng bộ đồng hồ theo server sau mỗi lần hỏi.
      // Dùng display_seconds_remaining do SERVER tính — không tự suy ra từ
      // seconds_remaining (thời gian giữ kho), vì hai mốc đó khác nhau và
      // min() của chúng luôn trả về TTL hiển thị, làm đồng hồ reset mỗi 3 giây.
      if (typeof res.display_seconds_remaining === 'number') {
        setRemaining(Math.max(0, res.display_seconds_remaining));
        if (res.display_seconds_remaining > totalRef.current) {
          totalRef.current = res.display_seconds_remaining;
        }
      }

      if (res.payment_status === 'PAID') {
        clearInterval(pollRef.current);
        clearInterval(tickRef.current);
        onPaid?.(res);
      }
    } catch {
      // Mất mạng một nhịp không phải lỗi — lần polling sau tự khớp lại.
    }
  }, [orderId, orderData, onPaid]);

  useEffect(() => {
    if (!open || !orderId) return;

    poll();
    pollRef.current = setInterval(poll, 3000);   // 3s: đủ nhanh để khách thấy ngay, đủ thưa để không dội server
    tickRef.current = setInterval(() => setRemaining(s => Math.max(0, s - 1)), 1000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(tickRef.current);
    };
  }, [open, orderId, poll]);

  if (!orderData) return null;

  const paid = status === 'PAID';
  const timeout = remaining <= 0 && !paid;
  const urgent = !timeout && remaining <= 60;

  // Thang xám: chỉ đen, trắng và các mức xám ở giữa.
  const T = isDark
    ? { bg: '#0b0b0d', fg: '#fafafa', sub: '#8f8f99', line: '#27272a', soft: '#151518', inv: '#fafafa', invFg: '#0b0b0d' }
    : { bg: '#ffffff', fg: '#0a0a0a', sub: '#71717a', line: '#e6e6e9', soft: '#fafafa', inv: '#0a0a0a', invFg: '#ffffff' };

  const pct = totalRef.current > 0 ? Math.max(0, Math.min(1, remaining / totalRef.current)) : 0;

  const Row = ({ label, value, mono, onCopy }) => (
    <div className="pqr-row">
      <span className="pqr-row-label">{label}</span>
      <span className={`pqr-row-value${mono ? ' pqr-mono' : ''}`}>{value}</span>
      {onCopy && <button type="button" className="pqr-copy" onClick={onCopy}>Sao chép</button>}
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      maskClosable={false}
      centered
      className="pqr-modal"
      style={{
        '--pqr-bg': T.bg, '--pqr-fg': T.fg, '--pqr-sub': T.sub,
        '--pqr-line': T.line, '--pqr-soft': T.soft,
        '--pqr-inv': T.inv, '--pqr-inv-fg': T.invFg,
      }}
      styles={{ content: { background: T.bg, padding: 24, borderRadius: 18 }, mask: { backdropFilter: 'blur(2px)' } }}
    >
      <style>{PQR_CSS}</style>

      {paid ? (
        <div className="pqr-done">
          <div className="pqr-check">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
                 stroke="var(--pqr-inv-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5 L9.5 18 L20 6.5" />
            </svg>
          </div>
          <h3 className="pqr-done-title">Đã nhận được thanh toán</h3>
          <p className="pqr-done-sub">
            Đơn <span className="pqr-mono">{orderId}</span> đã được xác nhận.
          </p>
          <button type="button" className="pqr-btn" onClick={onClose}>Xong</button>
        </div>
      ) : (
        <div>
          <header className="pqr-head">
            <h3 className="pqr-title">Quét mã để thanh toán</h3>
            <p className="pqr-sub">
              Mở app ngân hàng, chọn <strong>Quét QR</strong> — số tiền và nội dung đã được điền sẵn
            </p>
          </header>

          {/* Đồng hồ: viên nhộng + thanh tiến trình. Sắp hết giờ thì ĐẢO NỀN
              (đen/trắng) thay vì đổi sang đỏ, giữ đúng tông đơn sắc. */}
          <div className={`pqr-clock${urgent ? ' pqr-urgent' : ''}${timeout ? ' pqr-expired' : ''}`}>
            <div className="pqr-clock-top">
              <span className="pqr-clock-label">
                {timeout ? 'Đã quá thời gian hiển thị' : 'Mã còn hiệu lực trong'}
              </span>
              <span className="pqr-clock-time pqr-mono">{timeout ? '00:00' : mmss(remaining)}</span>
            </div>
            <div className="pqr-bar"><div className="pqr-bar-fill" style={{ width: `${pct * 100}%` }} /></div>
          </div>

          {/* Khung QR có 4 góc ngắm — vừa gợi ý "chỗ này để quét", vừa tạo
              điểm nhấn mà không cần thêm màu. */}
          <div className="pqr-qr-wrap">
            <div className={`pqr-qr${timeout ? ' pqr-qr-dim' : ''}`}>
              <i className="pqr-c pqr-c-tl" /><i className="pqr-c pqr-c-tr" />
              <i className="pqr-c pqr-c-bl" /><i className="pqr-c pqr-c-br" />
              {qr?.data_url ? (
                // Mờ đi khi hết giờ nhưng KHÔNG gỡ bỏ: tiền chuyển muộn vẫn
                // được hệ thống nhận và đối soát.
                <img src={qr.data_url} alt="Mã VietQR" className="pqr-qr-img" />
              ) : (
                <div className="pqr-qr-empty">
                  Chưa cấu hình tài khoản nhận —<br />vui lòng chuyển khoản theo thông tin bên dưới
                </div>
              )}
            </div>
            <div className="pqr-qr-tag">VIETQR · NAPAS 247</div>
          </div>

          {/* Tách khoản — khách phải hiểu vì sao con số này, không chỉ thấy tổng.
              Thiếu nó thì phí ship dễ bị nhìn nhầm thành tổng đơn. */}
          {orderData.pricing && (
            <div className="pqr-box pqr-price">
              {[
                ['Tiền hàng', orderData.pricing.subTotal],
                ['Phí vận chuyển', orderData.pricing.shippingFee],
                orderData.pricing.voucherDiscount > 0 && ['Mã giảm giá', -orderData.pricing.voucherDiscount],
                orderData.pricing.pointsDiscount > 0 &&
                  [`Điểm thưởng (${orderData.pricing.pointsUsed} điểm)`, -orderData.pricing.pointsDiscount],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="pqr-price-row">
                  <span>{label}</span>
                  <span className={value < 0 ? 'pqr-neg' : ''}>
                    {value < 0 ? '− ' : ''}{fmt(Math.abs(value))} đ
                  </span>
                </div>
              ))}
              <div className="pqr-total">
                <span>Cần chuyển</span>
                <strong>{fmt(orderData.pricing.total)} đ</strong>
              </div>
            </div>
          )}

          <div className="pqr-box">
            <Row label="Ngân hàng" value={qr?.bank_name || (qr?.bank_bin ? `BIN ${qr.bank_bin}` : '—')} />
            <Row label="Số tài khoản" value={qr?.account_no || '—'} mono
                 onCopy={qr?.account_no ? () => copy(qr.account_no, 'số tài khoản') : null} />
            <Row label="Chủ tài khoản" value={qr?.account_name || '—'} />
            <Row label="Số tiền" value={`${fmt(qr?.amount ?? orderData.pricing?.total)} đ`} mono
                 onCopy={() => copy(String(qr?.amount ?? orderData.pricing?.total), 'số tiền')} />
            {/* Giữ lại ở đây vì khách chuyển tay cần copy đúng con số này */}
            <Row label="Nội dung CK" value={qr?.content || '—'} mono
                 onCopy={qr?.content ? () => copy(qr.content, 'nội dung') : null} />
          </div>

          {/* Không có nút "Thanh toán sau": đơn đang giữ chỗ trong kho, khuyến
              khích trì hoãn nghĩa là giữ hàng mà không ai trả tiền. Khách vẫn
              thoát được bằng nút X ở góc — lúc đó đơn ở trạng thái chưa thanh
              toán và sẽ tự huỷ khi hết hạn. */}
          <div className="pqr-wait">
            <span className="pqr-pulse" />
            Đang chờ chuyển khoản — trang này tự cập nhật khi ngân hàng báo có
          </div>

          <p className="pqr-note">
            Giữ nguyên <strong>nội dung chuyển khoản</strong> để hệ thống tự đối soát. Nếu chuyển thủ
            công mà ghi thiếu nội dung, đơn vẫn được xử lý nhưng phải chờ nhân viên xác nhận.
            {timeout && ' Hết thời gian hiển thị, nhưng nếu bạn vừa chuyển khoản thì hệ thống vẫn ghi nhận.'}
          </p>
        </div>
      )}
    </Modal>
  );
}

const PQR_CSS = `
.pqr-modal .ant-modal-close { color: var(--pqr-sub); top: 14px; inset-inline-end: 14px; }
.pqr-modal .ant-modal-close:hover { color: var(--pqr-fg); background: var(--pqr-soft); }
.pqr-modal .ant-modal-content { border: 1px solid var(--pqr-line); box-shadow: 0 24px 60px rgba(0,0,0,.28); }

.pqr-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .01em; }

.pqr-head { text-align: center; margin-bottom: 16px; }
.pqr-title { margin: 0; color: var(--pqr-fg); font-size: 19px; font-weight: 650; letter-spacing: -.01em; }
.pqr-sub { margin: 5px 0 0; color: var(--pqr-sub); font-size: 12.5px; line-height: 1.55; }
.pqr-sub strong { color: var(--pqr-fg); font-weight: 600; }

/* ── Đồng hồ ───────────────────────────────────────────────── */
.pqr-clock { border: 1px solid var(--pqr-line); border-radius: 12px; padding: 9px 13px 11px; margin-bottom: 16px; }
.pqr-clock-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.pqr-clock-label { color: var(--pqr-sub); font-size: 12px; }
.pqr-clock-time { color: var(--pqr-fg); font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; }
.pqr-bar { height: 3px; border-radius: 3px; background: var(--pqr-line); overflow: hidden; }
.pqr-bar-fill { height: 100%; background: var(--pqr-fg); border-radius: 3px; transition: width 1s linear; }

.pqr-clock.pqr-urgent { background: var(--pqr-inv); border-color: var(--pqr-inv); }
.pqr-clock.pqr-urgent .pqr-clock-label { color: var(--pqr-inv-fg); opacity: .7; }
.pqr-clock.pqr-urgent .pqr-clock-time { color: var(--pqr-inv-fg); }
.pqr-clock.pqr-urgent .pqr-bar { background: rgba(128,128,128,.45); }
.pqr-clock.pqr-urgent .pqr-bar-fill { background: var(--pqr-inv-fg); }
.pqr-clock.pqr-expired { border-style: dashed; }
.pqr-clock.pqr-expired .pqr-clock-time { color: var(--pqr-sub); }

/* ── Khung QR ──────────────────────────────────────────────── */
.pqr-qr-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 16px; }
.pqr-qr { position: relative; width: 232px; height: 232px; padding: 16px; border-radius: 16px;
          background: #fff; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 14px rgba(0,0,0,.10); }
.pqr-qr-dim { opacity: .32; }
.pqr-qr-img { width: 100%; height: 100%; object-fit: contain; display: block; }
.pqr-qr-empty { color: #52525b; font-size: 12.5px; text-align: center; line-height: 1.6; padding: 0 6px; }
/* Bốn góc ngắm */
.pqr-c { position: absolute; width: 22px; height: 22px; border: 2.5px solid #0a0a0a; }
.pqr-c-tl { top: 7px; left: 7px; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
.pqr-c-tr { top: 7px; right: 7px; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }
.pqr-c-bl { bottom: 7px; left: 7px; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; }
.pqr-c-br { bottom: 7px; right: 7px; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }
.pqr-qr-tag { margin-top: 9px; color: var(--pqr-sub); font-size: 10.5px; font-weight: 600;
              letter-spacing: .09em; text-transform: uppercase; }

/* ── Khối thông tin ────────────────────────────────────────── */
.pqr-box { background: var(--pqr-soft); border: 1px solid var(--pqr-line); border-radius: 12px;
           padding: 4px 13px; margin-bottom: 10px; }
.pqr-price { padding: 11px 13px; }
.pqr-price-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 3.5px 0; color: var(--pqr-fg); }
.pqr-price-row > span:first-child { color: var(--pqr-sub); }
.pqr-neg { color: var(--pqr-sub); }
.pqr-total { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
             padding-top: 9px; margin-top: 7px; border-top: 1px solid var(--pqr-line); color: var(--pqr-fg); }
.pqr-total > span { font-size: 12px; text-transform: uppercase; letter-spacing: .07em; color: var(--pqr-sub); font-weight: 600; }
.pqr-total > strong { font-size: 19px; font-weight: 700; letter-spacing: -.01em; }

.pqr-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--pqr-line); }
.pqr-row:last-child { border-bottom: 0; }
.pqr-row-label { color: var(--pqr-sub); font-size: 12.5px; flex: 0 0 105px; }
.pqr-row-value { color: var(--pqr-fg); font-size: 13.5px; font-weight: 600; flex: 1; word-break: break-all; }
.pqr-copy { flex: 0 0 auto; border: 1px solid var(--pqr-line); background: transparent; color: var(--pqr-sub);
            font-size: 11.5px; padding: 3px 9px; border-radius: 7px; cursor: pointer;
            transition: background .15s, color .15s, border-color .15s; }
.pqr-copy:hover { background: var(--pqr-inv); border-color: var(--pqr-inv); color: var(--pqr-inv-fg); }

/* ── Trạng thái chờ ────────────────────────────────────────── */
.pqr-wait { display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 14px;
            padding: 10px 12px; border: 1px dashed var(--pqr-line); border-radius: 11px;
            color: var(--pqr-sub); font-size: 12.5px; text-align: center; }
.pqr-pulse { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--pqr-fg);
             animation: pqr-pulse 1.4s ease-in-out infinite; }
@keyframes pqr-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .25; transform: scale(.7); } }

.pqr-note { margin: 11px 2px 0; color: var(--pqr-sub); font-size: 11.5px; line-height: 1.65; text-align: center; }
.pqr-note strong { color: var(--pqr-fg); font-weight: 600; }

/* ── Màn hình đã thanh toán ────────────────────────────────── */
.pqr-done { text-align: center; padding: 22px 6px 8px; }
.pqr-check { width: 60px; height: 60px; margin: 0 auto; border-radius: 50%; background: var(--pqr-inv);
             display: flex; align-items: center; justify-content: center; animation: pqr-pop .32s ease-out; }
@keyframes pqr-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.pqr-done-title { margin: 16px 0 5px; color: var(--pqr-fg); font-size: 19px; font-weight: 650; }
.pqr-done-sub { margin: 0; color: var(--pqr-sub); font-size: 13px; }
.pqr-btn { margin-top: 22px; min-width: 132px; padding: 9px 22px; border: 1px solid var(--pqr-inv);
           border-radius: 10px; background: var(--pqr-inv); color: var(--pqr-inv-fg);
           font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
.pqr-btn:hover { opacity: .82; }

@media (max-width: 480px) {
  .pqr-qr { width: 200px; height: 200px; }
  .pqr-row-label { flex-basis: 92px; }
}
`;
