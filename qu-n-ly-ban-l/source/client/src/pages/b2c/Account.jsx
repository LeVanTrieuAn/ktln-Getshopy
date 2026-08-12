import { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Menu, Avatar, Divider, Tag, Steps, Button, Input, message, Spin, Modal, Form, Empty } from 'antd';
import { UserOutlined, ShoppingOutlined, HeartOutlined, TrophyOutlined, EnvironmentOutlined, LogoutOutlined, HeartFilled, FilePdfOutlined, CheckCircleOutlined, InboxOutlined, CarOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import OrderTrackingMap from '../../components/b2c/OrderTrackingMap';
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

export default function Account() {
  const { isDark, wishlist, toggleWishlist, t, b2cUser, user, b2cLogout, logout } = useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');

  // Address State
  const [addresses, setAddresses] = useState(() => JSON.parse(localStorage.getItem('b2c_addresses') || '[]'));
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [mapPosition, setMapPosition] = useState([10.762622, 106.660172]); // Default HCMC
  const [form] = Form.useForm();

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setMapPosition([e.latlng.lat, e.latlng.lng]);
        // Simulate reverse geocoding
        form.setFieldsValue({
          street: `Toạ độ: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
        });
      },
    });
    return mapPosition === null ? null : <Marker position={mapPosition}></Marker>;
  };

  // Loyalty State
  const [points] = useState(() => parseInt(localStorage.getItem('b2c_points') || '0'));

  useEffect(() => {
    localStorage.setItem('b2c_addresses', JSON.stringify(addresses));
  }, [addresses]);

  const currentUser = b2cUser || user;

  useEffect(() => {
    if (currentUser?.email) {
      handleLookup(currentUser.email);
    }
  }, [currentUser]);

  const handleLookup = async (email = lookupEmail) => {
    if (!email) return message.error(t('account.lookup_placeholder'));
    try {
      setLoading(true);
      const data = await api.b2c.getMyOrders(email);
      setOrders(data);
    } catch (err) {
      message.error(t('account.order_not_found'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = (values) => {
    const newAddress = { id: Date.now(), ...values, isDefault: addresses.length === 0 };
    setAddresses([...addresses, newAddress]);
    setIsAddressModalOpen(false);
    form.resetFields();
    message.success('Đã thêm địa chỉ mới');
  };

  const handleDeleteAddress = (id) => {
    setAddresses(addresses.filter(a => a.id !== id));
    message.success('Đã xoá địa chỉ');
  };

  const getOrderStatus = (status) => {
    switch (status) {
      case 'PENDING': return { text: 'Chờ thanh toán', color: 'default', step: 0 };
      case 'CONFIRMED': return { text: 'Đã xác nhận', color: 'processing', step: 0 };
      case 'PACKED': return { text: 'Đã đóng gói', color: 'orange', step: 1 };
      case 'SHIPPING': return { text: 'Đang vận chuyển', color: 'cyan', step: 2 };
      case 'DELIVERED': 
      case 'COMPLETED': return { text: 'Đã giao hàng', color: 'success', step: 3 };
      case 'CANCELLED': return { text: 'Đã huỷ', color: 'error', step: -1 };
      default: return { text: status || 'Chờ xác nhận', color: 'default', step: 0 };
    }
  };

  // User profile
  const mockUser = {
    name: currentUser ? (currentUser.full_name || currentUser.name || currentUser.email) : 'Khách vãng lai',
    email: currentUser?.email || 'Chưa đăng nhập',
    phone: currentUser?.phone || 'Chưa cập nhật',
    tier: points > 500 ? 'Thành viên Vàng' : (points > 100 ? 'Thành viên Bạc' : 'Thành viên Đồng'),
    points: points
  };

  const handleLogout = () => {
    b2cLogout();
    logout();
    message.success(t('account.logout_success'));
    navigate('/', { replace: true });
  };

  const menuItems = [
    { key: 'profile', icon: <UserOutlined />, label: t('account.profile') },
    { key: 'orders', icon: <ShoppingOutlined />, label: t('account.my_orders') },
    { key: 'address', icon: <EnvironmentOutlined />, label: t('account.address_book') },
    { key: 'wishlist', icon: <HeartOutlined />, label: t('account.wishlist') },
    { key: 'loyalty', icon: <TrophyOutlined />, label: t('account.loyalty') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: t('account.logout'), danger: true }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 0' }}>
      <Row gutter={[32, 32]}>
        <Col xs={24} md={6}>
          <Card 
            style={{ 
              background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
              borderRadius: 16 
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar 
                size={80} 
                src={b2cUser?.avatar ? b2cUser.avatar.replace('notionists', 'avataaars') : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + (b2cUser?.email || 'khachhang')} 
                icon={<UserOutlined />} 
                style={{ background: '#fff', marginBottom: 16, border: '3px solid #10b981' }} 
              />
              <Title level={4} style={{ color: isDark ? '#fff' : '#000', margin: 0 }}>{mockUser.name}</Title>
              <Tag color="gold" style={{ marginTop: 8, borderRadius: 12, fontWeight: 700 }}>{mockUser.tier}</Tag>
            </div>
            
            <Menu 
              mode="inline" 
              selectedKeys={[activeTab]}
              onClick={({ key }) => {
                if (key === 'logout') {
                  handleLogout();
                } else {
                  setActiveTab(key);
                }
              }}
              items={menuItems}
              style={{ background: 'transparent', border: 'none' }}
              theme={isDark ? 'dark' : 'light'}
            />
          </Card>
        </Col>

        <Col xs={24} md={18}>
          <Card 
            style={{ 
              background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
              borderRadius: 16, minHeight: 500 
            }}
          >
            {activeTab === 'orders' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                  <Title level={3} style={{ color: isDark ? '#fff' : '#000', margin: 0 }}>{t('account.order_management')}</Title>
                  {!b2cUser && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input 
                        placeholder={t('account.lookup_placeholder')} 
                        value={lookupEmail}
                        onChange={e => setLookupEmail(e.target.value)}
                        style={{ width: 250, borderRadius: 8 }}
                      />
                      <Button type="primary" onClick={() => handleLookup()} style={{ background: '#10b981', borderColor: '#10b981' }}>{t('account.lookup_btn')}</Button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
                ) : orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                    {t('account.order_not_found')} <b>{b2cUser ? b2cUser.email : lookupEmail}</b>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {orders.map(order => (
                      <div key={order.id} style={{ border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', borderRadius: 12, padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#000' }}>
                            {t('account.order_id')} {order.id}
                            <span style={{ marginLeft: 16, color: '#888', fontWeight: 'normal', fontSize: 12 }}>
                              {new Date(order.date || order.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <Tag color={getOrderStatus(order.status).color}>
                            {getOrderStatus(order.status).text}
                          </Tag>
                        </div>
                        <Divider style={{ margin: '12px 0' }} />
                        
                        {order.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <img src={item.selectedVariant?.image || item.image || (item.images && item.images[0])} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
                              <div>
                                <div style={{ color: isDark ? '#ccc' : '#444', fontWeight: 600 }}>{item.name}</div>
                                {item.selectedVariant && <div style={{ fontSize: 12, color: '#888' }}>{item.selectedVariant.color} {item.selectedVariant.storage}</div>}
                                <div style={{ fontSize: 12, color: '#888' }}>SL: {item.quantity || 1}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 600, color: isDark ? '#aaa' : '#555' }}>
                              {(item.price * (item.quantity || 1)).toLocaleString('vi-VN')} đ
                            </div>
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 12 }}>
                            ... và {order.items.length - 2} sản phẩm khác
                          </div>
                        )}

                        <Divider style={{ margin: '16px 0' }} />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', color: isDark ? '#aaa' : '#666', marginBottom: 16 }}>
                          <div>Tạm tính: {order.subTotal?.toLocaleString('vi-VN')} đ</div>
                          <div>Phí vận chuyển: {order.shippingFee?.toLocaleString('vi-VN')} đ</div>
                          {order.discount > 0 && <div style={{ color: '#ef4444' }}>Giảm giá: -{order.discount?.toLocaleString('vi-VN')} đ</div>}
                          <div style={{ color: isDark ? '#aaa' : '#666', marginTop: 4 }}>Thành tiền: <span style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{order.total?.toLocaleString('vi-VN')} đ</span></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                          <Button 
                            onClick={() => setSelectedOrder(order)}
                            style={{ borderRadius: 8, fontWeight: 600 }}
                          >
                            Xem chi tiết
                          </Button>
                          <Button 
                            icon={<FilePdfOutlined />} 
                            onClick={() => {
                              const invoiceHtml = `
                                <div style="padding: 40px; font-family: sans-serif; color: #000; background: #fff; width: 800px;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px;">
                                    <div>
                                      <h1 style="color: #10b981; margin: 0;">GETSHOPY STORE</h1>
                                      <p style="margin: 5px 0; color: #555;">Hệ thống bán lẻ thiết bị công nghệ hàng đầu</p>
                                    </div>
                                    <div style="text-align: right;">
                                      <h2 style="margin: 0; color: #333;">HÓA ĐƠN ĐIỆN TỬ</h2>
                                      <p style="margin: 5px 0; color: #555;">Mã đơn: <b>${order.id}</b></p>
                                      <p style="margin: 5px 0; color: #555;">Ngày: ${new Date(order.date || order.created_at).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                  </div>

                                  <div style="margin-bottom: 30px;">
                                    <h3 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">THÔNG TIN KHÁCH HÀNG</h3>
                                    <p><b>Họ tên:</b> ${order.customer?.full_name || order.customer_info?.fullName || 'Khách hàng'}</p>
                                    <p><b>Số điện thoại:</b> ${order.customer?.phone || order.customer_info?.phone || ''}</p>
                                    <p><b>Địa chỉ:</b> ${order.customer?.address || order.customer_info?.address || ''}, ${order.customer?.province || order.customer_info?.province || ''}</p>
                                  </div>

                                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                                    <thead>
                                      <tr style="background: #10b981; color: #fff;">
                                        <th style="padding: 12px; text-align: left;">Sản phẩm</th>
                                        <th style="padding: 12px; text-align: right;">Đơn giá</th>
                                        <th style="padding: 12px; text-align: right;">SL</th>
                                        <th style="padding: 12px; text-align: right;">Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${order.items.map(item => `
                                        <tr style="border-bottom: 1px solid #eee;">
                                          <td style="padding: 12px;">${item.name} ${item.selectedVariant ? `(${item.selectedVariant.color} - ${item.selectedVariant.storage})` : ''}</td>
                                          <td style="padding: 12px; text-align: right;">${item.price.toLocaleString('vi-VN')} đ</td>
                                          <td style="padding: 12px; text-align: right;">${item.quantity || 1}</td>
                                          <td style="padding: 12px; text-align: right;">${(item.price * (item.quantity || 1)).toLocaleString('vi-VN')} đ</td>
                                        </tr>
                                      `).join('')}
                                    </tbody>
                                  </table>

                                  <div style="display: flex; justify-content: flex-end;">
                                    <table style="width: 300px;">
                                      <tr>
                                        <td style="padding: 8px 0; color: #555;">Tạm tính:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: bold;">${order.subTotal?.toLocaleString('vi-VN') || 0} đ</td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 8px 0; color: #555;">Phí vận chuyển:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: bold;">${order.shippingFee?.toLocaleString('vi-VN') || 0} đ</td>
                                      </tr>
                                      ${order.discount > 0 ? `
                                      <tr>
                                        <td style="padding: 8px 0; color: #ef4444;">Giảm giá:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #ef4444;">-${order.discount?.toLocaleString('vi-VN')} đ</td>
                                      </tr>
                                      ` : ''}
                                      <tr style="border-top: 2px solid #eee;">
                                        <td style="padding: 16px 0; font-size: 18px; font-weight: bold;">TỔNG CỘNG:</td>
                                        <td style="padding: 16px 0; text-align: right; font-size: 18px; font-weight: bold; color: #10b981;">${order.total?.toLocaleString('vi-VN') || 0} đ</td>
                                      </tr>
                                    </table>
                                  </div>
                                </div>
                              `;
                              const opt = {
                                margin: 0.5,
                                filename: `HoaDon_${order.id}.pdf`,
                                image: { type: 'jpeg', quality: 0.98 },
                                html2canvas: { scale: 2 },
                                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                              };
                              html2pdf().set(opt).from(invoiceHtml).save();
                            }}
                          >
                            Tải Hóa Đơn PDF
                          </Button>
                          <Button type="primary" style={{ background: '#10b981', borderColor: '#10b981' }}>Mua lại</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <Title level={3} style={{ color: isDark ? '#fff' : '#000', margin: 0 }}>Hồ sơ cá nhân</Title>
                  <Button 
                    type="primary" 
                    danger 
                    icon={<LogoutOutlined />} 
                    onClick={handleLogout}
                    style={{ borderRadius: 8 }}
                  >
                    {t('account.logout')}
                  </Button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div style={{ color: isDark ? '#aaa' : '#666', marginBottom: 8 }}>Họ và tên</div>
                    <div style={{ padding: '12px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: 8, color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{mockUser.name}</div>
                  </div>
                  <div>
                    <div style={{ color: isDark ? '#aaa' : '#666', marginBottom: 8 }}>Email</div>
                    <div style={{ padding: '12px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: 8, color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{mockUser.email}</div>
                  </div>
                  <div>
                    <div style={{ color: isDark ? '#aaa' : '#666', marginBottom: 8 }}>Số điện thoại</div>
                    <div style={{ padding: '12px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: 8, color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{mockUser.phone}</div>
                  </div>
                  <div>
                    <div style={{ color: isDark ? '#aaa' : '#666', marginBottom: 8 }}>Hạng thành viên</div>
                    <div style={{ padding: '12px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: 8, color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{mockUser.tier}</div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'address' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <Title level={3} style={{ color: isDark ? '#fff' : '#000', margin: 0 }}>Sổ địa chỉ</Title>
                  <Button type="primary" onClick={() => setIsAddressModalOpen(true)} style={{ background: '#10b981' }}>+ Thêm địa chỉ mới</Button>
                </div>
                
                {addresses.length === 0 ? (
                  <Empty description="Bạn chưa có địa chỉ nào" style={{ padding: '40px 0' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {addresses.map(addr => (
                      <div key={addr.id} style={{ padding: 20, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16, color: isDark ? '#fff' : '#000', marginBottom: 4 }}>
                            {addr.name} | {addr.phone}
                            {addr.isDefault && <Tag color="green" style={{ marginLeft: 12 }}>Mặc định</Tag>}
                          </div>
                          <div style={{ color: isDark ? '#aaa' : '#666' }}>{addr.street}, {addr.ward}, {addr.district}, {addr.province}</div>
                        </div>
                        <Button type="text" danger onClick={() => handleDeleteAddress(addr.id)}>Xoá</Button>
                      </div>
                    ))}
                  </div>
                )}

                <Modal
                  title="Thêm địa chỉ giao hàng"
                  open={isAddressModalOpen}
                  onCancel={() => setIsAddressModalOpen(false)}
                  footer={null}
                  width={800}
                >
                  <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
                    <div style={{ flex: 1 }}>
                      <Form form={form} layout="vertical" onFinish={handleAddAddress}>
                        <Form.Item name="name" label="Họ và tên" rules={[{ required: true }]}><Input placeholder="Nhập họ và tên" /></Form.Item>
                        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }]}><Input placeholder="Nhập số điện thoại" /></Form.Item>
                        <Row gutter={12}>
                          <Col span={12}><Form.Item name="province" label="Tỉnh/Thành phố" rules={[{ required: true }]}><Input placeholder="Ví dụ: TP. Hồ Chí Minh" /></Form.Item></Col>
                          <Col span={12}><Form.Item name="district" label="Quận/Huyện" rules={[{ required: true }]}><Input placeholder="Ví dụ: Quận 1" /></Form.Item></Col>
                        </Row>
                        <Form.Item name="ward" label="Phường/Xã" rules={[{ required: true }]}><Input placeholder="Ví dụ: Phường Bến Nghé" /></Form.Item>
                        <Form.Item name="street" label="Địa chỉ cụ thể" rules={[{ required: true }]}><Input.TextArea placeholder="Số nhà, tên đường hoặc Toạ độ trên bản đồ..." rows={2} /></Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: '100%', background: '#10b981', marginTop: 16 }}>Lưu địa chỉ</Button>
                      </Form>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>Ghim vị trí trên bản đồ</div>
                      <div style={{ height: 450, borderRadius: 12, overflow: 'hidden', border: '1px solid #d9d9d9' }}>
                        <MapContainer center={mapPosition} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <LocationMarker />
                          <MapResizer />
                        </MapContainer>
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>* Bấm vào bản đồ để chọn toạ độ giao hàng chính xác. Toạ độ sẽ được tự động điền vào ô "Địa chỉ cụ thể".</div>
                    </div>
                  </div>
                </Modal>
              </div>
            )}
            
            {activeTab === 'loyalty' && (
              <div>
                <Title level={3} style={{ color: isDark ? '#fff' : '#000', marginBottom: 24 }}>Điểm thưởng & Voucher</Title>
                <div style={{ background: 'linear-gradient(135deg, #10b981, #047857)', borderRadius: 24, padding: 32, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
                  <div>
                    <div style={{ fontSize: 16, opacity: 0.9, marginBottom: 8 }}>Hạng thẻ: <strong>{mockUser.tier}</strong></div>
                    <div style={{ fontSize: 40, fontWeight: 800 }}>{points.toLocaleString()} <span style={{ fontSize: 20, fontWeight: 500 }}>Điểm</span></div>
                  </div>
                  <TrophyOutlined style={{ fontSize: 80, opacity: 0.2 }} />
                </div>
                
                <Title level={4} style={{ color: isDark ? '#fff' : '#000', marginTop: 32, marginBottom: 16 }}>Đổi thưởng</Title>
                <Row gutter={[16, 16]}>
                  {[
                    { pts: 50, desc: 'Voucher giảm 50K' },
                    { pts: 100, desc: 'Voucher giảm 100K' },
                    { pts: 200, desc: 'Voucher giảm 200K' }
                  ].map(v => (
                    <Col xs={24} md={8} key={v.pts}>
                      <div style={{ border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>{v.desc}</div>
                        <div style={{ color: isDark ? '#aaa' : '#666', marginBottom: 16 }}>Cần {v.pts} điểm</div>
                        <Button type="primary" disabled={points < v.pts} style={{ background: points >= v.pts ? '#10b981' : undefined, width: '100%' }}>
                          Đổi ngay
                        </Button>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
            
            {activeTab === 'wishlist' && (
              <div>
                <Title level={3} style={{ color: isDark ? '#fff' : '#000', marginBottom: 24 }}>Sản phẩm yêu thích</Title>
                
                {(!wishlist || wishlist.length === 0) ? (
                  <Empty description="Bạn chưa có sản phẩm yêu thích nào" style={{ padding: '40px 0' }} />
                ) : (
                  <Row gutter={[24, 24]}>
                    {wishlist.map(p => (
                      <Col xs={24} sm={12} md={8} key={p.id}>
                        <Card 
                          hoverable 
                          style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}
                          cover={<div onClick={() => navigate(`/product/${p.id}`)} style={{ padding: 24, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><img alt={p.name} src={p.image} style={{ height: 160, objectFit: 'contain' }} /></div>}
                        >
                          <div style={{ position: 'absolute', top: 12, right: 12 }}>
                            <Button 
                              type="text" 
                              icon={<HeartFilled style={{ color: '#ef4444', fontSize: 20 }} />} 
                              onClick={(e) => { e.stopPropagation(); toggleWishlist(p); message.success('Đã bỏ yêu thích'); }}
                            />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : '#1a1a1a', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ color: '#10b981', fontSize: 18, fontWeight: 800 }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            )}
            
            {(activeTab !== 'orders' && activeTab !== 'profile' && activeTab !== 'address' && activeTab !== 'loyalty' && activeTab !== 'wishlist') && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400, color: '#888' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                <div>Tính năng đang được phát triển...</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={<span style={{ fontSize: 18, fontWeight: 700 }}>Chi tiết đơn hàng {selectedOrder?.id}</span>}
        open={!!selectedOrder}
        onCancel={() => setSelectedOrder(null)}
        footer={null}
        width={800}
        centered
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        {selectedOrder && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ color: '#888', fontSize: 12 }}>Ngày đặt hàng</div>
                <div style={{ fontWeight: 600 }}>{new Date(selectedOrder.date || selectedOrder.created_at).toLocaleString('vi-VN')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#888', fontSize: 12 }}>Trạng thái</div>
                <Tag color={getOrderStatus(selectedOrder.status).color} style={{ margin: 0, marginTop: 4 }}>
                  {getOrderStatus(selectedOrder.status).text}
                </Tag>
              </div>
            </div>

            <div style={{ marginBottom: 32, padding: 24, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', borderRadius: 12 }}>
              <Steps 
                current={getOrderStatus(selectedOrder.status).step}
                size="small"
                items={[
                  { title: 'Chờ xác nhận', icon: <CheckCircleOutlined /> },
                  { title: 'Đã đóng gói', icon: <InboxOutlined /> },
                  { title: 'Đang giao hàng', icon: <CarOutlined /> },
                  { title: 'Đã nhận hàng', icon: <EnvironmentOutlined /> },
                ]}
              />
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Bản đồ Tracking</div>
              <OrderTrackingMap order={selectedOrder} />
            </div>

            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Sản phẩm ({selectedOrder.items.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #eee', borderRadius: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <img src={item.selectedVariant?.image || item.image || (item.images && item.images[0])} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
                    <div>
                      <div style={{ color: isDark ? '#ccc' : '#222', fontWeight: 600 }}>{item.name}</div>
                      {item.selectedVariant && <div style={{ fontSize: 12, color: '#888' }}>{item.selectedVariant.color} {item.selectedVariant.storage}</div>}
                      <div style={{ fontSize: 12, color: '#888' }}>SL: {item.quantity || 1}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: isDark ? '#aaa' : '#10b981', display: 'flex', alignItems: 'center' }}>
                    {(item.price * (item.quantity || 1)).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))}
            </div>

            <Divider style={{ margin: '16px 0' }} />
                        
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', color: isDark ? '#aaa' : '#666' }}>
              <div>Tạm tính: {selectedOrder.subTotal?.toLocaleString('vi-VN')} đ</div>
              <div>Phí vận chuyển: {selectedOrder.shippingFee?.toLocaleString('vi-VN')} đ</div>
              {selectedOrder.discount > 0 && <div style={{ color: '#ef4444' }}>Giảm giá: -{selectedOrder.discount?.toLocaleString('vi-VN')} đ</div>}
              <div style={{ marginTop: 8 }}>Thành tiền: <span style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{selectedOrder.total?.toLocaleString('vi-VN')} đ</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
