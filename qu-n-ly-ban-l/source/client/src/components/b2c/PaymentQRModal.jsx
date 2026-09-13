import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Typography, Button, Space, Tag, message } from 'antd';
import { api } from '../../services/api';

const { Title, Text } = Typography;

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
 */
export default function PaymentQRModal({ open, orderData, isDark, onPaid, onClose }) {
  const [status, setStatus] = useState('PENDING');
  const [remaining, setRemaining] = useState(orderData?.display_ttl_seconds ?? 300);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

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

  const bg = isDark ? '#18181b' : '#fff';
  const sub = isDark ? '#a1a1aa' : '#71717a';
  const fg = isDark ? '#fff' : '#18181b';
  const line = isDark ? '#3f3f46' : '#e4e4e7';

  const Row = ({ label, value, mono, onCopy }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${line}`, flexWrap: 'wrap' }}>
      <span style={{ color: sub, minWidth: 120, fontSize: 13 }}>{label}</span>
      <strong style={{ color: fg, fontFamily: mono ? 'ui-monospace, monospace' : undefined, flex: 1, wordBreak: 'break-all' }}>
        {value}
      </strong>
      {onCopy && <Button size="small" type="text" onClick={onCopy}>Sao chép</Button>}
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      maskClosable={false}
      centered
      styles={{ content: { background: bg }, header: { background: bg } }}
    >
      {paid ? (
        <div style={{ textAlign: 'center', padding: '28px 8px' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>✓</div>
          <Title level={3} style={{ color: fg, marginTop: 14 }}>Đã nhận được thanh toán</Title>
          <Text style={{ color: sub }}>Đơn {orderId} đã được xác nhận.</Text>
          <div style={{ marginTop: 22 }}>
            <Button type="primary" size="large" onClick={onClose}>Xong</Button>
          </div>
        </div>
      ) : (
        <div>
          <Title level={4} style={{ color: fg, marginTop: 0, textAlign: 'center' }}>
            Quét mã để thanh toán
          </Title>

          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            {timeout ? (
              <Tag color="default">Mã đã quá thời gian hiển thị</Tag>
            ) : (
              <Tag color={remaining <= 60 ? 'red' : 'blue'}>Còn lại {mmss(remaining)}</Tag>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '14px 0' }}>
            {qr?.data_url ? (
              <img
                src={qr.data_url}
                alt="VietQR"
                style={{
                  width: 240, height: 240, objectFit: 'contain',
                  background: '#fff', padding: 10, borderRadius: 12,
                  // Mờ đi khi hết giờ nhưng KHÔNG gỡ bỏ: tiền chuyển muộn vẫn
                  // được hệ thống nhận và đối soát.
                  opacity: timeout ? 0.35 : 1,
                }}
              />
            ) : (
              <div style={{ color: sub, padding: 40 }}>
                Chưa cấu hình tài khoản nhận — vui lòng chuyển khoản theo thông tin bên dưới
              </div>
            )}
          </div>

          {/* Tách khoản — khách phải hiểu vì sao con số này, không chỉ thấy tổng.
              Thiếu nó thì phí ship dễ bị nhìn nhầm thành tổng đơn. */}
          {orderData.pricing && (
            <div style={{ background: isDark ? '#27272a' : '#fafafa', padding: '12px 14px', borderRadius: 12, marginBottom: 10 }}>
              {[
                ['Tiền hàng', orderData.pricing.subTotal],
                ['Phí vận chuyển', orderData.pricing.shippingFee],
                orderData.pricing.voucherDiscount > 0 && ['Mã giảm giá', -orderData.pricing.voucherDiscount],
                orderData.pricing.pointsDiscount > 0 &&
                  [`Điểm thưởng (${orderData.pricing.pointsUsed} điểm)`, -orderData.pricing.pointsDiscount],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}>
                  <span style={{ color: sub }}>{label}</span>
                  <span style={{ color: value < 0 ? '#16a34a' : fg }}>
                    {value < 0 ? '− ' : ''}{fmt(Math.abs(value))} đ
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTop: `1px solid ${line}` }}>
                <strong style={{ color: fg }}>Cần chuyển</strong>
                <strong style={{ color: fg, fontSize: 16 }}>{fmt(orderData.pricing.total)} đ</strong>
              </div>
            </div>
          )}

          <div style={{ background: isDark ? '#27272a' : '#fafafa', padding: '4px 14px 10px', borderRadius: 12 }}>
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

          <div style={{ marginTop: 14, fontSize: 12.5, color: sub, lineHeight: 1.7 }}>
            Giữ nguyên <strong style={{ color: fg }}>nội dung chuyển khoản</strong> để hệ thống tự
            đối soát. Nếu chuyển thủ công mà ghi thiếu nội dung, đơn vẫn được xử lý nhưng phải chờ
            nhân viên xác nhận.
            {timeout && (
              <div style={{ marginTop: 8 }}>
                Hết thời gian hiển thị, nhưng nếu bạn vừa chuyển khoản thì hệ thống vẫn ghi nhận —
                trang này sẽ tự cập nhật.
              </div>
            )}
          </div>

          {/* Không có nút "Thanh toán sau": đơn đang giữ chỗ trong kho, khuyến
              khích trì hoãn nghĩa là giữ hàng mà không ai trả tiền. Khách vẫn
              thoát được bằng nút X ở góc — lúc đó đơn ở trạng thái chưa thanh
              toán và sẽ tự huỷ khi hết hạn. */}
          <Space style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}>
            <Button type="primary" loading onClick={poll}>Đang chờ chuyển khoản…</Button>
          </Space>
        </div>
      )}
    </Modal>
  );
}
