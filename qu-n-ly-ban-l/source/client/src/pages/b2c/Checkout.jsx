import { useState, useEffect } from 'react';
import { Row, Col, Typography, Form, Input, Button, Divider, message, Select, Space, Checkbox, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25,41],
    iconAnchor: [12,41]
});
L.Marker.prototype.options.icon = DefaultIcon;
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';
import { useTracking } from '../../hooks/useTracking';

const { Title, Text } = Typography;

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);
  return null;
};

export default function Checkout() {
  const { cart, clearCart, removeItemsFromCart, toggleSelectAll } = useCart();
  const { isDark, b2cUser, openAuthModal } = useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { trackPurchase } = useTracking();

  // Yêu cầu đăng nhập khi vào trang thanh toán
  useEffect(() => {
    if (!b2cUser && !localStorage.getItem('b2c_token')) {
      message.warning('Vui lòng đăng nhập để thực hiện mua hàng');
      if (typeof openAuthModal === 'function') {
        openAuthModal();
      }
    }
  }, [b2cUser, openAuthModal]);

  useEffect(() => {
    if (b2cUser) {
      form.setFieldsValue({
        full_name: form.getFieldValue('full_name') || b2cUser.full_name,
        phone: form.getFieldValue('phone') || b2cUser.phone,
        email: form.getFieldValue('email') || b2cUser.email,
      });
    }
  }, [b2cUser, form]);

  // Nếu trong giỏ có sản phẩm nhưng chưa tick chọn cái nào, tự động chọn tất cả để hiển thị
  useEffect(() => {
    if (cart.length > 0 && !cart.some(item => item.selected)) {
      if (typeof toggleSelectAll === 'function') {
        toggleSelectAll(true);
      }
    }
  }, [cart, toggleSelectAll]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState(null);
  
  // Map State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapPosition, setMapPosition] = useState([10.762622, 106.660172]); // Default HCMC

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setMapPosition([e.latlng.lat, e.latlng.lng]);
        form.setFieldsValue({
          address: `Toạ độ: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
        });
      },
    });
    return mapPosition === null ? null : <Marker position={mapPosition}></Marker>;
  };
  
  // Checkout logic states: Ưu tiên các sản phẩm được chọn; nếu không có tick nào thì lấy tất cả sản phẩm trong giỏ hàng
  const selectedCartItems = cart.filter(item => item.selected);
  const checkoutItems = selectedCartItems.length > 0 ? selectedCartItems : cart;
  const subTotal = checkoutItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  
  const [province, setProvince] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('COD');

  // Address Book Integration
  const [savedAddresses] = useState(() => JSON.parse(localStorage.getItem('b2c_addresses') || '[]'));
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // Loyalty Points Integration
  const [points] = useState(() => parseInt(localStorage.getItem('b2c_points') || '0'));
  const [usePoints, setUsePoints] = useState(false);
  const maxPointsToUse = Math.min(points, Math.floor(subTotal / 1000));
  const pointsDiscount = usePoints ? maxPointsToUse * 1000 : 0;

  // Simple mock shipping fee logic
  const shippingFee = province ? (province === 'HCM' || province === 'HN' ? 20000 : 40000) : 0;
  const finalTotal = subTotal + shippingFee - discount - pointsDiscount;

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return message.error('Vui lòng nhập mã giảm giá');
    try {
      setLoading(true);
      const res = await api.b2c.applyVoucher(voucherCode, subTotal);
      setAppliedVoucher(res.voucher);
      setDiscount(res.discount);
      message.success(`Áp dụng thành công mã ${res.voucher.code}`);
    } catch (err) {
      message.error(err.message || 'Mã không hợp lệ');
      setAppliedVoucher(null);
      setDiscount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAddress = (id) => {
    setSelectedAddressId(id);
    const addr = savedAddresses.find(a => a.id === id);
    if (addr) {
      form.setFieldsValue({
        full_name: addr.name,
        phone: addr.phone,
        address: `${addr.street}, ${addr.ward}, ${addr.district}`
      });
      const provStr = (addr.province || '').toLowerCase();
      if (provStr.includes('hồ chí minh') || provStr.includes('hcm')) setProvince('HCM');
      else if (provStr.includes('hà nội') || provStr.includes('hn')) setProvince('HN');
      else if (provStr.includes('đà nẵng') || provStr.includes('dn')) setProvince('DN');
      else setProvince('OTHER');
    }
  };

  async function onFinish(values) {
    if (!b2cUser && !localStorage.getItem('b2c_token')) {
      message.warning('Vui lòng đăng nhập để thực hiện mua hàng');
      if (typeof openAuthModal === 'function') {
        openAuthModal();
      }
      return;
    }
    if (checkoutItems.length === 0) {
      return message.error('Không có sản phẩm nào được chọn để thanh toán!');
    }
    if (!province) {
      return message.error('Vui lòng chọn Tỉnh/Thành phố giao hàng');
    }
    setLoading(true);
    try {
      const orderPayload = {
        items: checkoutItems,
        customer_info: { ...values, province, email: b2cUser?.email || values.email },
        payment_method: paymentMethod,
        subTotal,
        shippingFee,
        discount: discount + pointsDiscount,
        total: finalTotal,
        voucher: appliedVoucher?.code || null,
        pointsUsed: usePoints ? maxPointsToUse : 0
      };
      const res = await api.b2c.checkout(orderPayload);
      
      // Update points
      let newPoints = points;
      if (usePoints) newPoints -= maxPointsToUse;
      const pointsEarned = Math.floor(finalTotal / 100000);
      newPoints += pointsEarned;
      localStorage.setItem('b2c_points', newPoints.toString());

      // Remove checked-out items
      if (typeof removeItemsFromCart === 'function') {
        removeItemsFromCart(checkoutItems);
      } else {
        clearCart();
      }

      // Track purchase events
      trackPurchase(checkoutItems.map(item => ({
        id: item.id,
        category_id: item.category_id,
        brand_id: item.brand_id,
        price: item.price,
        quantity: item.quantity,
      })));
      setOrderData({
        id: res.order?.id || `ORD${Date.now()}`,
        items: [...checkoutItems],
        customer_info: { ...values, province, email: b2cUser?.email || values.email },
        subTotal,
        shippingFee,
        discount: discount + pointsDiscount,
        total: finalTotal,
        method: paymentMethod
      });
      setSuccess(true);
    } catch (err) {
      message.error(err.message || 'Thanh toán thất bại');
    } finally {
      setLoading(false);
    }
  }

  if (success && orderData) {
    const isBankTransfer = orderData.method === 'BANK_TRANSFER' || orderData.method === 'VNPAY';
    const qrUrl = isBankTransfer 
      ? `https://img.vietqr.io/image/MB-0123456789-print.png?amount=${orderData.total}&addInfo=Thanh toan don hang ${orderData.id}&accountName=GETSHOPY STORE` 
      : null;

    return (
      <div 
        style={{ 
          padding: '48px 36px', 
          borderRadius: 24, 
          maxWidth: 680, 
          margin: '90px auto', 
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          boxShadow: '0 8px 32px -4px rgba(0,0,0,0.08)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: 20,
            background: isDark ? '#27272a' : '#f4f4f5',
            color: isDark ? '#e4e4e7' : '#18181b',
            border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 16
          }}>
            ĐƠN HÀNG ĐÃ ĐƯỢC XÁC NHẬN
          </div>
          <Title level={2} style={{ color: isDark ? '#fff' : '#18181b', margin: '0 0 10px', fontWeight: 800 }}>
            Đặt Hàng Thành Công
          </Title>
          <p style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 15, margin: 0 }}>
            Cảm ơn bạn đã mua sắm tại GetShopy. Mã đơn hàng của bạn: <strong style={{ color: isDark ? '#ffffff' : '#18181b' }}>{orderData.id}</strong>
          </p>
        </div>

        {/* Danh sách sản phẩm đã mua */}
        {orderData.items && orderData.items.length > 0 && (
          <div style={{
            textAlign: 'left',
            background: isDark ? '#202024' : '#fafafa',
            border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 24
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#fff' : '#18181b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Sản phẩm trong đơn ({orderData.items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orderData.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <img
                    src={item.selectedVariant?.image || item.image || (item.images && item.images[0]) || '/images/commerce/prod_mouse.jpg'}
                    alt={item.name}
                    style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10, background: '#fff', border: '1px solid #eee', padding: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#fff' : '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>
                      {item.selectedVariant ? `${item.selectedVariant.color || ''} ${item.selectedVariant.storage || ''} • ` : ''}Số lượng: {item.quantity}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#fff' : '#18181b' }}>
                    {(Number((item.price || 0) * (item.quantity || 1)) || 0).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))}
            </div>

            <Divider style={{ borderColor: isDark ? '#27272a' : '#e4e4e7', margin: '14px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: isDark ? '#fff' : '#18181b' }}>
              <span>Tổng thanh toán:</span>
              <span style={{ fontSize: 18 }}>{(Number(orderData.total) || 0).toLocaleString('vi-VN')} đ</span>
            </div>
          </div>
        )}

        {isBankTransfer && (
          <div style={{ background: isDark ? '#202024' : '#fafafa', padding: 24, borderRadius: 16, marginBottom: 28, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, textAlign: 'center' }}>
            <Title level={4} style={{ color: isDark ? '#fff' : '#18181b', marginTop: 0, fontWeight: 700 }}>Chuyển khoản qua VietQR</Title>
            <div style={{ background: '#fff', display: 'inline-block', padding: 14, borderRadius: 14, marginBottom: 16, border: '1px solid #e4e4e7' }}>
              <img src={qrUrl} alt="VietQR" style={{ width: 220, height: 220, objectFit: 'contain' }} />
            </div>
            <div style={{ textAlign: 'left', background: isDark ? '#18181b' : '#ffffff', padding: 16, borderRadius: 12, fontSize: 14, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
              <div style={{ marginBottom: 8 }}><span style={{ color: isDark ? '#a1a1aa' : '#71717a', display: 'inline-block', width: 130 }}>Ngân hàng:</span> <strong>MBBank</strong></div>
              <div style={{ marginBottom: 8 }}><span style={{ color: isDark ? '#a1a1aa' : '#71717a', display: 'inline-block', width: 130 }}>Chủ tài khoản:</span> <strong>GETSHOPY STORE</strong></div>
              <div style={{ marginBottom: 8 }}><span style={{ color: isDark ? '#a1a1aa' : '#71717a', display: 'inline-block', width: 130 }}>Số tài khoản:</span> <strong>0123456789</strong></div>
              <div style={{ marginBottom: 8 }}><span style={{ color: isDark ? '#a1a1aa' : '#71717a', display: 'inline-block', width: 130 }}>Số tiền:</span> <strong style={{ color: isDark ? '#fff' : '#18181b' }}>{orderData.total.toLocaleString('vi-VN')} đ</strong></div>
              <div><span style={{ color: isDark ? '#a1a1aa' : '#71717a', display: 'inline-block', width: 130 }}>Nội dung CK:</span> <strong>Thanh toan don hang {orderData.id}</strong></div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <Button 
            type="primary" 
            size="large" 
            onClick={() => navigate('/')} 
            style={{ 
              background: '#18181b', 
              borderColor: '#18181b', 
              borderRadius: 12, 
              height: 48, 
              fontWeight: 700, 
              padding: '0 40px',
              color: '#ffffff'
            }}
          >
            Tiếp tục mua sắm
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '100px 24px 48px', maxWidth: 1240, margin: '0 auto' }}>
      <Row gutter={[36, 36]}>
      {/* Cột form thông tin */}
      <Col xs={24} lg={14}>
        <div 
          style={{ 
            padding: 36, 
            borderRadius: 20, 
            background: isDark ? '#18181b' : '#ffffff',
            border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
          }}
        >
          {!b2cUser && !localStorage.getItem('b2c_token') && (
            <div style={{
              background: isDark ? '#27272a' : '#f4f4f5',
              border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14
            }}>
              <div>
                <div style={{ fontWeight: 700, color: isDark ? '#ffffff' : '#18181b', fontSize: 14 }}>
                  Yêu cầu đăng nhập để hoàn tất đơn hàng
                </div>
                <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 2 }}>
                  Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục thanh toán và bảo lưu đơn hàng.
                </div>
              </div>
              <Button 
                type="primary"
                style={{
                  background: '#18181b',
                  borderColor: '#18181b',
                  borderRadius: 10,
                  fontWeight: 600,
                  height: 38,
                  color: '#ffffff'
                }}
                onClick={() => openAuthModal && openAuthModal()}
              >
                Đăng nhập ngay
              </Button>
            </div>
          )}

          <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', marginBottom: 24, fontWeight: 700 }}>Thông tin nhận hàng</Title>
          
          {savedAddresses.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: isDark ? '#202024' : '#fafafa', borderRadius: 12, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
              <div style={{ color: isDark ? '#e4e4e7' : '#18181b', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                Chọn từ Sổ địa chỉ đã lưu:
              </div>
              <Select
                size="large"
                placeholder="Chọn địa chỉ đã lưu..."
                style={{ width: '100%' }}
                value={selectedAddressId}
                onChange={handleSelectAddress}
                options={savedAddresses.map(a => ({
                  value: a.id,
                  label: `${a.name} — ${a.phone} — ${a.street}, ${a.district}, ${a.province}`
                }))}
              />
            </div>
          )}

          <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="full_name" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Họ và tên</span>} rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}>
                  <Input size="large" style={{ borderRadius: 10, background: isDark ? '#202024' : '#f4f4f5', border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Số điện thoại</span>} rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                  <Input size="large" style={{ borderRadius: 10, background: isDark ? '#202024' : '#f4f4f5', border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>
                    Địa chỉ nhận hàng (Số nhà, đường...) <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setIsMapModalOpen(true)} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      padding: 0, 
                      color: isDark ? '#ffffff' : '#18181b', 
                      cursor: 'pointer', 
                      fontWeight: 600, 
                      fontSize: 13,
                      textDecoration: 'underline'
                    }}
                  >
                    Chọn vị trí trên bản đồ
                  </button>
                </div>
                <Form.Item name="address" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cụ thể' }]}>
                  <Input size="large" placeholder="Nhập địa chỉ hoặc chọn trên bản đồ..." style={{ borderRadius: 10, background: isDark ? '#202024' : '#f4f4f5', border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500, marginBottom: 8 }}>
                    Tỉnh / Thành phố <span style={{ color: '#ef4444' }}>*</span>
                  </div>
                  <Select 
                    size="large" 
                    placeholder="Chọn Tỉnh/Thành phố" 
                    value={province}
                    onChange={setProvince}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'HCM', label: 'Hồ Chí Minh' },
                      { value: 'HN', label: 'Hà Nội' },
                      { value: 'DN', label: 'Đà Nẵng' },
                      { value: 'OTHER', label: 'Tỉnh/Thành khác' }
                    ]}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="email" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Email nhận thông báo đơn hàng</span>}>
                  <Input size="large" placeholder="email@example.com" style={{ borderRadius: 10, background: isDark ? '#202024' : '#f4f4f5', border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ borderColor: isDark ? '#27272a' : '#e4e4e7', margin: '20px 0' }} />
            
            <Title level={4} style={{ color: isDark ? '#fff' : '#18181b', marginTop: 8, marginBottom: 16, fontWeight: 700 }}>
              Phương thức thanh toán
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div 
                onClick={() => setPaymentMethod('COD')}
                style={{ 
                  padding: 16, 
                  border: paymentMethod === 'COD' 
                    ? `2px solid ${isDark ? '#ffffff' : '#18181b'}` 
                    : `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                  borderRadius: 14, 
                  background: paymentMethod === 'COD' 
                    ? (isDark ? '#27272a' : '#f4f4f5') 
                    : 'transparent', 
                  color: isDark ? '#fff' : '#18181b', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Thanh toán khi nhận hàng (COD)</div>
                  <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 2 }}>Thanh toán tiền mặt cho nhân viên giao vận khi nhận kiện hàng</div>
                </div>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: '50%', 
                  border: `2px solid ${paymentMethod === 'COD' ? (isDark ? '#fff' : '#18181b') : '#a1a1aa'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {paymentMethod === 'COD' && (
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isDark ? '#fff' : '#18181b' }} />
                  )}
                </div>
              </div>

              <div 
                onClick={() => setPaymentMethod('VNPAY')}
                style={{ 
                  padding: 16, 
                  border: paymentMethod === 'VNPAY' 
                    ? `2px solid ${isDark ? '#ffffff' : '#18181b'}` 
                    : `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                  borderRadius: 14, 
                  background: paymentMethod === 'VNPAY' 
                    ? (isDark ? '#27272a' : '#f4f4f5') 
                    : 'transparent', 
                  color: isDark ? '#fff' : '#18181b', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Chuyển khoản Ngân hàng / Quét mã QR</div>
                  <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 2 }}>Hỗ trợ ứng dụng mọi ngân hàng qua VietQR tiện lợi, tức thì</div>
                </div>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: '50%', 
                  border: `2px solid ${paymentMethod === 'VNPAY' ? (isDark ? '#fff' : '#18181b') : '#a1a1aa'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {paymentMethod === 'VNPAY' && (
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isDark ? '#fff' : '#18181b' }} />
                  )}
                </div>
              </div>
            </div>

            <Button 
              type="primary" 
              htmlType={b2cUser || localStorage.getItem('b2c_token') ? "submit" : "button"} 
              onClick={() => {
                if (!b2cUser && !localStorage.getItem('b2c_token')) {
                  message.warning('Vui lòng đăng nhập để thực hiện mua hàng');
                  if (typeof openAuthModal === 'function') openAuthModal();
                }
              }}
              size="large" 
              block 
              loading={loading}
              style={{ 
                marginTop: 36, 
                height: 52, 
                borderRadius: 14, 
                fontSize: 16, 
                fontWeight: 700, 
                background: '#18181b', 
                borderColor: '#18181b',
                color: '#ffffff'
              }}
            >
              {b2cUser || localStorage.getItem('b2c_token') ? 'Xác nhận đặt hàng' : 'Đăng nhập để đặt hàng'}
            </Button>
          </Form>

          <Modal
            title={<span style={{ fontWeight: 700, fontSize: 18 }}>Ghim vị trí trên bản đồ</span>}
            open={isMapModalOpen}
            onCancel={() => setIsMapModalOpen(false)}
            footer={[
              <Button key="ok" type="primary" onClick={() => setIsMapModalOpen(false)} style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 8, fontWeight: 600 }}>
                Xác nhận vị trí
              </Button>
            ]}
            width={700}
          >
            <div style={{ height: 400, borderRadius: 14, overflow: 'hidden', border: '1px solid #d4d4d8', marginTop: 16 }}>
              <MapContainer center={mapPosition} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker />
                <MapResizer />
              </MapContainer>
            </div>
            <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 12 }}>
              Nhấp vào bản đồ để chọn toạ độ giao hàng chính xác.
            </div>
          </Modal>

        </div>
      </Col>

      {/* Cột tóm tắt đơn hàng */}
      <Col xs={24} lg={10}>
        <div 
          style={{ 
            padding: 36, 
            borderRadius: 20, 
            position: 'sticky', 
            top: 100, 
            background: isDark ? '#18181b' : '#ffffff',
            border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
            <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>
              Tóm tắt đơn hàng
            </Title>
            <span style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', fontWeight: 600 }}>
              {checkoutItems.length} sản phẩm
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
            {checkoutItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 14 }}>Giỏ hàng của bạn đang trống.</div>
                <Button type="primary" onClick={() => navigate('/products')} style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 10, fontWeight: 600 }}>
                  Khám phá sản phẩm
                </Button>
              </div>
            ) : (
              checkoutItems.map((item, idx) => (
                <div key={`${item.id}-${item.selectedVariant?.id || idx}`} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <img src={item.selectedVariant?.image || item.image || (item.images && item.images[0]) || '/images/commerce/prod_mouse.jpg'} alt={item.name} style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: '#fff', border: '1px solid #eee', padding: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: isDark ? '#fff' : '#18181b', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    {item.selectedVariant && (
                      <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>{item.selectedVariant.color} {item.selectedVariant.storage}</div>
                    )}
                    <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 12 }}>Số lượng: {item.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#18181b', fontSize: 14 }}>
                    {(Number((item.price || 0) * (item.quantity || 1)) || 0).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))
            )}
          </div>

          <Divider style={{ borderColor: isDark ? '#27272a' : '#e4e4e7' }} />

          {/* VOUCHER SECTION */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 8, color: isDark ? '#fff' : '#18181b', fontWeight: 600, fontSize: 13 }}>
              Mã giảm giá (Voucher)
            </div>
            <Space.Compact style={{ width: '100%' }}>
              <Input 
                placeholder="Nhập mã (VD: GETSHOPY10)" 
                value={voucherCode} 
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                disabled={appliedVoucher !== null}
                style={{ borderRadius: '10px 0 0 10px' }}
              />
              {appliedVoucher ? (
                <Button type="primary" danger onClick={() => { setAppliedVoucher(null); setDiscount(0); setVoucherCode(''); }} style={{ borderRadius: '0 10px 10px 0', fontWeight: 600 }}>
                  Hủy
                </Button>
              ) : (
                <Button type="primary" onClick={handleApplyVoucher} loading={loading} style={{ background: '#18181b', borderColor: '#18181b', borderRadius: '0 10px 10px 0', fontWeight: 600 }}>
                  Áp dụng
                </Button>
              )}
            </Space.Compact>
            {appliedVoucher && (
              <div style={{ marginTop: 8, color: isDark ? '#e4e4e7' : '#18181b', fontSize: 13, fontWeight: 500 }}>
                Đã áp dụng: {appliedVoucher.description}
              </div>
            )}
          </div>

          {/* LOYALTY POINTS SECTION */}
          {points > 0 && (
            <div style={{ marginBottom: 20, padding: 14, background: isDark ? '#202024' : '#fafafa', borderRadius: 12, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
              <div style={{ marginBottom: 6, color: isDark ? '#fff' : '#18181b', fontWeight: 600, fontSize: 13 }}>
                Điểm tích luỹ thành viên
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13 }}>Khả dụng: <strong>{points.toLocaleString()}</strong> điểm</span>
                <Checkbox checked={usePoints} onChange={e => setUsePoints(e.target.checked)}>
                  Dùng {maxPointsToUse.toLocaleString()} điểm (-{(maxPointsToUse * 1000).toLocaleString('vi-VN')} đ)
                </Checkbox>
              </div>
            </div>
          )}

          <Divider style={{ borderColor: isDark ? '#27272a' : '#e4e4e7', margin: '16px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: isDark ? '#a1a1aa' : '#71717a', fontSize: 14 }}>
            <span>Tạm tính</span>
            <span style={{ color: isDark ? '#fff' : '#18181b', fontWeight: 500 }}>{subTotal.toLocaleString('vi-VN')} đ</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: isDark ? '#a1a1aa' : '#71717a', fontSize: 14 }}>
            <span>Phí vận chuyển</span>
            <span style={{ color: isDark ? '#fff' : '#18181b', fontWeight: 500 }}>{province ? `${shippingFee.toLocaleString('vi-VN')} đ` : 'Chưa xác định'}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#ef4444', fontSize: 14 }}>
              <span>Giảm giá Voucher</span>
              <span style={{ fontWeight: 600 }}>- {discount.toLocaleString('vi-VN')} đ</span>
            </div>
          )}
          {pointsDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#ef4444', fontSize: 14 }}>
              <span>Quy đổi điểm thưởng</span>
              <span style={{ fontWeight: 600 }}>- {pointsDiscount.toLocaleString('vi-VN')} đ</span>
            </div>
          )}
          
          <Divider style={{ borderColor: isDark ? '#27272a' : '#e4e4e7', margin: '16px 0' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#18181b' }}>Tổng thanh toán</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: isDark ? '#fff' : '#18181b' }}>
              {finalTotal > 0 ? finalTotal.toLocaleString('vi-VN') : 0} đ
            </span>
          </div>
        </div>
      </Col>
      </Row>
    </div>
  );
}
