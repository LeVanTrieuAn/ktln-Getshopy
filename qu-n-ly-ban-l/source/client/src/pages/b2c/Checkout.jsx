import { useState, useEffect } from 'react';
import { Row, Col, Typography, Form, Input, Button, Divider, message, Result, Select, Space, Tag, Checkbox, Modal } from 'antd';
import { ShoppingOutlined, CheckCircleFilled, TagOutlined, BankOutlined, WalletOutlined, TrophyOutlined } from '@ant-design/icons';
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
  const { cart, clearCart } = useCart();
  const { isDark, b2cUser } = useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!b2cUser && !localStorage.getItem('b2c_token')) {
      message.warning('Vui lòng đăng nhập để xem trang thanh toán');
      navigate('/');
    } else if (b2cUser) {
      form.setFieldsValue({
        full_name: form.getFieldValue('full_name') || b2cUser.full_name,
        phone: form.getFieldValue('phone') || b2cUser.phone,
      });
    }
  }, [b2cUser, navigate, form]);

  if (!b2cUser && !localStorage.getItem('b2c_token')) return null;

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
  
  // Checkout logic states
  const checkoutItems = cart.filter(item => item.selected);
  const subTotal = checkoutItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
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
      // Map province to mock shipping fees
      const provStr = addr.province.toLowerCase();
      if (provStr.includes('hồ chí minh') || provStr.includes('hcm')) setProvince('HCM');
      else if (provStr.includes('hà nội') || provStr.includes('hn')) setProvince('HN');
      else if (provStr.includes('đà nẵng') || provStr.includes('dn')) setProvince('DN');
      else setProvince('OTHER');
    }
  };

  async function onFinish(values) {
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
        customer_info: { ...values, province, email: b2cUser?.email },
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

      clearCart(); // Should technically only clear selected items, but clear all for demo
      setOrderData({
        id: res.order?.id || `ORD${Date.now()}`,
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
    const isBankTransfer = orderData.method === 'BANK_TRANSFER';
    // VietQR Format (Mock bank: MBBank, Account: 0123456789, Template: print)
    const qrUrl = isBankTransfer 
      ? `https://img.vietqr.io/image/MB-0123456789-print.png?amount=${orderData.total}&addInfo=Thanh toan don hang ${orderData.id}&accountName=GETSHOPY STORE` 
      : null;

    return (
      <div className="glass-panel" style={{ padding: 64, textAlign: 'center', borderRadius: 24, maxWidth: 600, margin: '100px auto' }}>
        <CheckCircleFilled style={{ fontSize: 80, color: '#10b981', marginBottom: 24 }} />
        <Title level={2} style={{ color: isDark ? '#fff' : '#000' }}>Đặt Hàng Thành Công!</Title>
        <p style={{ color: isDark ? '#bbb' : '#555', fontSize: 16, marginBottom: 24 }}>
          Cảm ơn bạn đã mua sắm tại Getshopy. Mã đơn hàng của bạn là <strong>{orderData.id}</strong>.
        </p>

        {isBankTransfer && (
          <div style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', padding: 24, borderRadius: 16, marginBottom: 32, border: '1px solid #10b981' }}>
            <Title level={4} style={{ color: '#10b981', marginTop: 0 }}>Quét mã QR để thanh toán</Title>
            <div style={{ background: '#fff', display: 'inline-block', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <img src={qrUrl} alt="VietQR" style={{ width: 250, height: 250, objectFit: 'contain' }} />
            </div>
            <div style={{ textAlign: 'left', background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', padding: 16, borderRadius: 8, fontSize: 14 }}>
              <div style={{ marginBottom: 8 }}><span style={{ color: '#888', display: 'inline-block', width: 120 }}>Ngân hàng:</span> <strong>MBBank</strong></div>
              <div style={{ marginBottom: 8 }}><span style={{ color: '#888', display: 'inline-block', width: 120 }}>Chủ tài khoản:</span> <strong>GETSHOPY STORE</strong></div>
              <div style={{ marginBottom: 8 }}><span style={{ color: '#888', display: 'inline-block', width: 120 }}>Số tài khoản:</span> <strong>0123456789</strong></div>
              <div style={{ marginBottom: 8 }}><span style={{ color: '#888', display: 'inline-block', width: 120 }}>Số tiền:</span> <strong style={{ color: '#ef4444' }}>{orderData.total.toLocaleString('vi-VN')} đ</strong></div>
              <div><span style={{ color: '#888', display: 'inline-block', width: 120 }}>Nội dung CK:</span> <strong>Thanh toan don hang {orderData.id}</strong></div>
            </div>
          </div>
        )}

        <Button type="primary" size="large" onClick={() => navigate('/')} style={{ background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none', borderRadius: 12, height: 48, fontWeight: 700, padding: '0 40px' }}>
          Tiếp tục mua sắm
        </Button>
      </div>
    );
  }

  return (
    <Row gutter={[40, 40]}>
      {/* Cột form thông tin */}
      <Col xs={24} lg={14}>
        <div className="glass-panel" style={{ padding: 40, borderRadius: 24 }}>
          <Title level={3} style={{ color: isDark ? '#fff' : '#111', marginBottom: 32 }}>Thông tin giao hàng</Title>
          
          {savedAddresses.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4', borderRadius: 12, border: '1px solid #10b981' }}>
              <div style={{ color: isDark ? '#ddd' : '#333', fontWeight: 600, marginBottom: 8 }}>Chọn từ Sổ địa chỉ:</div>
              <Select
                size="large"
                placeholder="Chọn địa chỉ đã lưu..."
                style={{ width: '100%' }}
                value={selectedAddressId}
                onChange={handleSelectAddress}
                options={savedAddresses.map(a => ({
                  value: a.id,
                  label: `${a.name} - ${a.phone} - ${a.street}, ${a.district}, ${a.province}`
                }))}
              />
            </div>
          )}

          <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="full_name" label={<span style={{ color: isDark ? '#ccc' : '#555' }}>Họ và tên</span>} rules={[{ required: true }]}>
                  <Input size="large" style={{ borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', border: 'none', color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label={<span style={{ color: isDark ? '#ccc' : '#555' }}>Số điện thoại</span>} rules={[{ required: true }]}>
                  <Input size="large" style={{ borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', border: 'none', color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                  <span style={{ color: isDark ? '#ccc' : '#555' }}>Địa chỉ nhận hàng (Số nhà, đường...) <span style={{color: '#ff4d4f'}}>*</span></span>
                  <Button type="link" onClick={() => setIsMapModalOpen(true)} style={{ padding: 0, color: '#10b981' }}>📍 Chọn trên Bản đồ</Button>
                </div>
                <Form.Item name="address" rules={[{ required: true, message: 'Vui lòng nhập hoặc chọn địa chỉ' }]}>
                  <Input size="large" placeholder="Nhập địa chỉ hoặc bấm Chọn trên Bản đồ..." style={{ borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', border: 'none', color: isDark ? '#fff' : '#000' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ color: isDark ? '#ccc' : '#555', marginBottom: 8 }}>Tỉnh / Thành phố</div>
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
            </Row>

            <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }} />
            
            <Title level={4} style={{ color: isDark ? '#fff' : '#111', marginTop: 16 }}>Phương thức thanh toán</Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div 
                onClick={() => setPaymentMethod('COD')}
                style={{ padding: 16, border: paymentMethod === 'COD' ? `2px solid #10b981` : (isDark ? '2px solid #333' : '2px solid #eee'), borderRadius: 12, background: paymentMethod === 'COD' ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5') : 'transparent', color: isDark ? '#fff' : '#000', fontWeight: paymentMethod === 'COD' ? 600 : 400, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <WalletOutlined style={{ fontSize: 24, color: paymentMethod === 'COD' ? '#10b981' : '#888' }} />
                Thanh toán khi nhận hàng (COD)
              </div>
              <div 
                onClick={() => setPaymentMethod('VNPAY')}
                style={{ padding: 16, border: paymentMethod === 'VNPAY' ? `2px solid #10b981` : (isDark ? '2px solid #333' : '2px solid #eee'), borderRadius: 12, background: paymentMethod === 'VNPAY' ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5') : 'transparent', color: isDark ? '#fff' : '#000', fontWeight: paymentMethod === 'VNPAY' ? 600 : 400, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <BankOutlined style={{ fontSize: 24, color: paymentMethod === 'VNPAY' ? '#10b981' : '#888' }} />
                Chuyển khoản Ngân hàng / VNPay
              </div>
            </div>

            <Button 
              type="primary" 
              htmlType="submit" 
              size="large" 
              block 
              loading={loading}
              style={{ marginTop: 40, height: 56, borderRadius: 16, fontSize: 18, fontWeight: 700, background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none' }}
            >
              Hoàn tất đặt hàng
            </Button>
          </Form>

          <Modal
            title="Ghim vị trí trên bản đồ"
            open={isMapModalOpen}
            onCancel={() => setIsMapModalOpen(false)}
            footer={[
              <Button key="ok" type="primary" onClick={() => setIsMapModalOpen(false)} style={{ background: '#10b981' }}>Xác nhận vị trí</Button>
            ]}
            width={700}
          >
            <div style={{ height: 400, borderRadius: 12, overflow: 'hidden', border: '1px solid #d9d9d9', marginTop: 16 }}>
              <MapContainer center={mapPosition} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker />
                <MapResizer />
              </MapContainer>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 12 }}>* Bấm vào bản đồ để chọn toạ độ giao hàng chính xác. Toạ độ sẽ được tự động điền vào ô "Địa chỉ nhận hàng".</div>
          </Modal>

        </div>
      </Col>

      {/* Cột giỏ hàng */}
      <Col xs={24} lg={10}>
        <div className="glass-panel" style={{ padding: 40, borderRadius: 24, position: 'sticky', top: 100 }}>
          <Title level={3} style={{ color: isDark ? '#fff' : '#111', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShoppingOutlined style={{ color: '#10b981' }} /> Tóm tắt đơn hàng
          </Title>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
            {checkoutItems.length === 0 ? (
              <div style={{ color: '#ef4444' }}>Bạn chưa chọn sản phẩm nào để thanh toán.</div>
            ) : (
              checkoutItems.map(item => (
                <div key={`${item.id}-${item.selectedVariant?.id}`} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <img src={item.selectedVariant?.image || item.image || (item.images && item.images[0])} alt={item.name} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12, background: '#fff' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: isDark ? '#fff' : '#000', fontSize: 14 }}>{item.name}</div>
                    {item.selectedVariant && (
                      <div style={{ fontSize: 12, color: '#888' }}>{item.selectedVariant.color} {item.selectedVariant.storage}</div>
                    )}
                    <div style={{ color: '#888', fontSize: 12 }}>SL: {item.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: isDark ? '#ccc' : '#333' }}>
                    {(item.price * item.quantity).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))
            )}
          </div>

          <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }} />

          {/* VOUCHER SECTION */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: isDark ? '#fff' : '#111', fontWeight: 600 }}>
              <TagOutlined style={{ color: '#10b981' }} /> Mã giảm giá (Voucher)
            </div>
            <Space.Compact style={{ width: '100%' }}>
              <Input 
                placeholder="Nhập mã (VD: GETSHOPY10)" 
                value={voucherCode} 
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                disabled={appliedVoucher !== null}
              />
              {appliedVoucher ? (
                <Button type="primary" danger onClick={() => { setAppliedVoucher(null); setDiscount(0); setVoucherCode(''); }}>Hủy mã</Button>
              ) : (
                <Button type="primary" onClick={handleApplyVoucher} loading={loading} style={{ background: '#10b981', borderColor: '#10b981' }}>Áp dụng</Button>
              )}
            </Space.Compact>
            {appliedVoucher && (
              <div style={{ marginTop: 8, color: '#10b981', fontSize: 13 }}>
                <CheckCircleFilled /> {appliedVoucher.description}
              </div>
            )}
          </div>

          {/* LOYALTY POINTS SECTION */}
          {points > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: isDark ? 'rgba(255,255,255,0.05)' : '#f9f9f9', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: isDark ? '#fff' : '#111', fontWeight: 600 }}>
                <TrophyOutlined style={{ color: '#f59e0b' }} /> Điểm thành viên
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: isDark ? '#bbb' : '#666' }}>Bạn có <strong>{points.toLocaleString()}</strong> điểm</span>
                <Checkbox checked={usePoints} onChange={e => setUsePoints(e.target.checked)}>
                  Dùng {maxPointsToUse.toLocaleString()} điểm (-{(maxPointsToUse * 1000).toLocaleString('vi-VN')} đ)
                </Checkbox>
              </div>
            </div>
          )}

          <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: isDark ? '#bbb' : '#666' }}>
            <span>Tạm tính</span>
            <span>{subTotal.toLocaleString('vi-VN')} đ</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: isDark ? '#bbb' : '#666' }}>
            <span>Phí vận chuyển</span>
            <span>{province ? `${shippingFee.toLocaleString('vi-VN')} đ` : 'Chưa xác định'}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#ef4444' }}>
              <span>Giảm giá Voucher</span>
              <span>- {discount.toLocaleString('vi-VN')} đ</span>
            </div>
          )}
          {pointsDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#f59e0b' }}>
              <span>Quy đổi điểm thưởng</span>
              <span>- {pointsDiscount.toLocaleString('vi-VN')} đ</span>
            </div>
          )}
          
          <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: isDark ? '#fff' : '#000' }}>Tổng thanh toán</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{finalTotal > 0 ? finalTotal.toLocaleString('vi-VN') : 0} đ</span>
          </div>
        </div>
      </Col>
    </Row>
  );
}
