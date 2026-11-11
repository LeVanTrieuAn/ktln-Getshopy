import { useState, useEffect, useRef, useCallback } from 'react';
import { Row, Col, Card, Typography, Menu, Divider, Tag, Steps, Button, Input, message, Spin, Modal, Form, Empty } from 'antd';
import { SketchOutlined, CrownOutlined, StarOutlined, TrophyOutlined, GiftOutlined, GoogleOutlined, LockOutlined, CloseOutlined, SafetyCertificateFilled } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { getProductImage, handleImageError } from '../../utils/categoryResolver';
import html2pdf from 'html2pdf.js';
import OrderTrackingMap from '../../components/b2c/OrderTrackingMap';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import { EnvironmentFilled, AimOutlined } from '@ant-design/icons';

const DefaultIcon = L.divIcon({
  html: ReactDOMServer.renderToString(
    <div style={{ color: '#ef4444', fontSize: '28px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
      <EnvironmentFilled />
    </div>
  ),
  className: 'custom-leaflet-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});
L.Marker.prototype.options.icon = DefaultIcon;

const { Title, Text } = Typography;

// Đo lại khung bản đồ trong lúc Modal chạy hiệu ứng mở. Từ 12/11/2026 chạy lại MỖI LẦN mở (active),
// không chỉ lần đầu: Modal không huỷ bản đồ khi đóng, mà lúc nó đang ẩn (display: none) mà xoay máy
// thì Leaflet đo được khung 0×0 — mở lại thấy bản đồ xám nếu không đo lại.
const MapResizer = ({ active = true }) => {
  const map = useMap();
  useEffect(() => {
    if (!active) return undefined;
    // Invalidate size periodically to ensure it catches modal animations
    const interval = setInterval(() => {
      map.invalidateSize();
    }, 100);
    const stop = setTimeout(() => {
      clearInterval(interval);
      map.invalidateSize();
    }, 1500);
    return () => { clearInterval(interval); clearTimeout(stop); };
  }, [map, active]);
  return null;
};

// ── Bản đồ ghim địa chỉ trong Sổ địa chỉ (12/11/2026) — cùng cách làm với Checkout.jsx ──
// Zoom 13 cũ: trên điện thoại cả mấy quận dồn vào một khung, ô bản đồ 256 px bị phóng lên nên mờ, tên
// phường/đường chồng lên nhau. Nay mở ở 16 (vài dãy phố) và tự hỏi vị trí máy; có vị trí thì ghim ở 17.
const PICKER_ZOOM = 16;
const LOCATED_ZOOM = 17;
// enableHighAccuracy: xin GPS chứ không chỉ Wi-Fi/IP. timeout 10 s tính từ lúc khách đã cho phép (W3C
// Geolocation API, PositionOptions.timeout). maximumAge 60 s: vị trí vừa lấy thì dùng lại cho nhanh.
const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };

const fmtAccuracy = (m) => (m >= 1000
  ? `${(m / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`
  : `${Math.round(m)} m`);

// Mã lỗi theo GeolocationPositionError: 1 = không được cấp quyền, 2 = không xác định được, 3 = quá giờ.
const geoErrorText = (err) => {
  switch (err?.code) {
    case 1: return 'Chưa được cấp quyền vị trí — bật trong cài đặt trình duyệt, hoặc chạm vào bản đồ để chọn.';
    case 2: return 'Không xác định được vị trí (GPS tắt hoặc sóng yếu) — thử lại, hoặc chạm vào bản đồ để chọn.';
    case 3: return 'Lấy vị trí quá lâu — thử lại, hoặc chạm vào bản đồ để chọn.';
    default: return 'Không lấy được vị trí — thử lại, hoặc chạm vào bản đồ để chọn.';
  }
};

// MapContainer chỉ đọc center/zoom lúc tạo bản đồ; đưa bản đồ tới vị trí vừa định vị thì phải gọi
// setView trên chính bản đồ. Mỗi lần `view` là object mới -> đưa bản đồ tới đó (null = để nguyên).
const MapView = ({ view }) => {
  const map = useMap();
  useEffect(() => {
    if (view) map.setView(view.center, view.zoom);
  }, [map, view]);
  return null;
};

export default function Account() {
  const { isDark, wishlist, toggleWishlist, t, b2cUser, user, b2cLogout, logout, openAuthModal, openOnboarding, onboardingOpen } = useApp();
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
  
  // Password Setting State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();
  const [settingPassword, setSettingPassword] = useState(false);

  // ── Preferences tab ─────────────────────────────────────────────────
  // Tab "Sởthích cá nhân" hiển thị trạng thái onboarding hiện tại (đã hoàn tất
  // / đã bỏ qua / chưa có) và cho phép mở modal onboarding ở mode 'edit' để
  // sửa lại. Mở modal xong thì refetch để hiển thị sở thích mới.
  const [pref, setPref] = useState(null);
  const [prefLoading, setPrefLoading] = useState(false);
  const fetchPref = async () => {
    setPrefLoading(true);
    try { setPref(await api.b2c.getMyPreferences()); }
    catch { setPref(null); }
    finally { setPrefLoading(false); }
  };
  useEffect(() => {
    if (activeTab === 'preferences' && !onboardingOpen) fetchPref();
  }, [activeTab, onboardingOpen]);

  // Định vị cho bản đồ ghim (12/11/2026) — xem chú thích PICKER_ZOOM ở đầu file
  const [mapView, setMapView] = useState(null);
  const [geo, setGeo] = useState({ status: 'idle', text: '' }); // idle | locating | done | warn | error
  // Tăng mỗi lần hỏi vị trí / đóng hộp / khách tự chạm chọn: kết quả định vị về muộn thì bỏ, không được
  // kéo ghim khỏi chỗ khách vừa chọn hay ghi vào ô địa chỉ khi hộp đã đóng.
  const geoReqRef = useRef(0);
  // Bị từ chối quyền / máy không hỗ trợ: không tự hỏi lại mỗi lần mở (vẫn bấm nút để thử lại được)
  const geoBlockedRef = useRef(false);

  // Điền ô "Địa chỉ cụ thể" từ điểm trên bản đồ — dùng chung cho chạm chọn (luồng cũ) và định vị
  const fillStreetFromPoint = useCallback((lat, lng) => {
    form.setFieldsValue({ street: `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
  }, [form]);

  const locateMe = useCallback(() => {
    const reqId = ++geoReqRef.current;
    if (!navigator.geolocation || window.isSecureContext === false) {
      geoBlockedRef.current = true;
      setGeo({ status: 'error', text: navigator.geolocation
        ? 'Định vị chỉ chạy trên trang HTTPS — hãy chạm vào bản đồ để chọn.'
        : 'Trình duyệt không hỗ trợ định vị — hãy chạm vào bản đồ để chọn.' });
      return;
    }
    setGeo({ status: 'locating', text: 'Đang lấy vị trí hiện tại…' });
    navigator.geolocation.getCurrentPosition((pos) => {
      if (reqId !== geoReqRef.current) return;
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const acc = fmtAccuracy(accuracy);
      if (accuracy > 1000) {
        // Chỉ có vị trí theo mạng/IP (sai cả km): ghim vào đây là lưu sai địa chỉ -> chỉ đưa bản đồ tới gần
        setMapView({ center: [lat, lng], zoom: PICKER_ZOOM - 1 });
        setGeo({ status: 'warn', text: `Chỉ định vị được gần đúng (sai số ~${acc}) nên chưa ghim — hãy chạm đúng chỗ nhận hàng.` });
        return;
      }
      setMapPosition([lat, lng]);
      setMapView({ center: [lat, lng], zoom: accuracy > 150 ? PICKER_ZOOM : LOCATED_ZOOM });
      fillStreetFromPoint(lat, lng);
      setGeo(accuracy > 150
        ? { status: 'warn', text: `Đã ghim vị trí gần đúng (sai số ~${acc}) — kiểm tra lại, lệch thì chạm đúng chỗ.` }
        : { status: 'done', text: `Đã ghim vị trí hiện tại (sai số ~${acc}). Chạm bản đồ nếu cần chỉnh.` });
    }, (err) => {
      if (reqId !== geoReqRef.current) return;
      if (err?.code === 1) geoBlockedRef.current = true;
      setGeo({ status: 'error', text: geoErrorText(err) });
    }, GEO_OPTIONS);
  }, [fillStreetFromPoint]);

  // Mở hộp "Thêm địa chỉ" mà ô địa chỉ cụ thể còn trống -> tự hỏi vị trí một lần. Ô đã có nội dung
  // (khách đang gõ dở rồi đóng hộp) thì KHÔNG tự hỏi để khỏi ghi đè; muốn thì bấm "Dùng vị trí hiện tại".
  useEffect(() => {
    if (!isAddressModalOpen) return undefined;
    if (!geoBlockedRef.current && !String(form.getFieldValue('street') || '').trim()) locateMe();
    return () => {
      geoReqRef.current += 1; // đóng hộp: bỏ kết quả định vị còn đang chờ
      setGeo(g => (g.status === 'locating' ? { status: 'idle', text: '' } : g));
    };
  }, [isAddressModalOpen, form, locateMe]);

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        // Khách tự chạm chọn thì chỗ đó thắng: bỏ kết quả định vị còn đang chờ
        geoReqRef.current += 1;
        setGeo({ status: 'idle', text: '' });
        setMapView(null);
        setMapPosition([e.latlng.lat, e.latlng.lng]);
        fillStreetFromPoint(e.latlng.lat, e.latlng.lng);
      },
    });
    return mapPosition === null ? null : <Marker position={mapPosition}></Marker>;
  };

  // Loyalty State
  // Điểm lấy từ server (/b2c/me). Trước 11/11/2026 đọc localStorage['b2c_points']:
  // sửa DevTools là lên hạng Kim cương trên giao diện, còn khách vừa đăng nhập thì
  // luôn thấy 0 điểm vì không chỗ nào ghi khoá đó lúc login.
  const [points, setPoints] = useState(0);

  useEffect(() => {
    localStorage.setItem('b2c_addresses', JSON.stringify(addresses));
  }, [addresses]);

  const currentUser = b2cUser || user;

  useEffect(() => {
    if (currentUser?.email) {
      handleLookup(currentUser.email);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!b2cUser) { setPoints(0); return; }
    api.b2c.getMe().then(me => setPoints(Number(me?.loyalty_points) || 0)).catch(() => {});
  }, [b2cUser]);

  const handleLookup = async (email = lookupEmail) => {
    if (!email) return message.error(t('account.lookup_placeholder'));
    try {
      setLoading(true);
      const data = await api.b2c.getMyOrders();
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

  const handleSetPassword = async (values) => {
    try {
      setSettingPassword(true);
      const res = await api.b2c.setPassword(values.new_password);
      if (res.success) {
        message.success('Đã thiết lập mật khẩu thành công! Bây giờ bạn có thể đăng nhập bằng Email.');
        setIsPasswordModalOpen(false);
        passwordForm.resetFields();
        // Update user state manually if possible or force reload
        if (currentUser) currentUser.has_password = true;
      }
    } catch (err) {
      message.error(err.message || 'Lỗi khi thiết lập mật khẩu');
    } finally {
      setSettingPassword(false);
    }
  };

  // Trạng thái THANH TOÁN là trục riêng, không lẫn với trạng thái GIAO HÀNG.
  // Một đơn có thể "Đã xác nhận" mà vẫn "Chưa thanh toán" (COD), hoặc
  // "Đã huỷ" mà vẫn còn nợ tiền khách (REFUND_REQUIRED).
  const getPaymentLabel = (o) => {
    switch (o.payment_status) {
      case 'PAID':            return { text: 'Đã thanh toán', color: 'success' };
      case 'PENDING':         return { text: 'Chờ chuyển khoản', color: 'warning' };
      case 'EXPIRED':         return { text: 'Quá hạn thanh toán', color: 'default' };
      case 'REFUND_REQUIRED': return { text: 'Đang hoàn tiền', color: 'processing' };
      case 'CANCELLED':       return { text: 'Đã huỷ', color: 'default' };
      case 'UNPAID':
        return o.payment_method === 'COD'
          ? { text: 'Thanh toán khi nhận hàng', color: 'default' }
          : { text: 'Chưa thanh toán', color: 'warning' };
      default: return null;
    }
  };

  // Khách chỉ huỷ được đơn chưa rời kho. Đang giao/đã giao thì phải qua hỗ trợ.
  const canCancel = (o) =>
    !['CANCELLED', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(o.status);

  const [cancelling, setCancelling] = useState(null);

  const handleCancel = (order) => {
    Modal.confirm({
      title: `Huỷ đơn ${order.id}?`,
      content: order.payment_status === 'PAID'
        ? 'Đơn này đã thanh toán. Sau khi huỷ, khoản tiền sẽ được hoàn lại và bộ phận hỗ trợ sẽ liên hệ với bạn.'
        : 'Hàng đang giữ cho đơn này sẽ được trả lại kho. Thao tác không thể hoàn tác.',
      okText: 'Huỷ đơn',
      okButtonProps: { danger: true },
      cancelText: 'Không',
      onOk: async () => {
        setCancelling(order.id);
        try {
          const res = await api.b2c.cancelOrder(order.id, 'Khách tự huỷ');
          message.success(res.message || 'Đã huỷ đơn hàng');
          await handleLookup(currentUser?.email);
        } catch (err) {
          message.error(err.message || 'Không huỷ được đơn hàng');
        } finally {
          setCancelling(null);
        }
      },
    });
  };

  const getOrderStatus = (status) => {
    switch (status) {
      case 'PENDING': return { text: 'Chờ thanh toán', color: 'default', step: 0 };
      case 'CONFIRMED': return { text: 'Đã xác nhận', color: 'processing', step: 0 };
      case 'PACKED': return { text: 'Đã đóng gói', color: 'warning', step: 1 };
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
    tier: points > 1000 ? 'Thành viên Kim cương' : (points > 500 ? 'Thành viên Vàng' : (points > 100 ? 'Thành viên Bạc' : 'Thành viên Đồng')),
    points: points
  };

  const getTierStyle = (tier) => {
    if (tier.includes('Kim cương')) return { bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(56, 189, 248, 0.3) 100%)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.6)', icon: <SketchOutlined />, glow: 'rgba(6, 182, 212, 0.5)' };
    if (tier.includes('Vàng')) return { bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(250, 204, 21, 0.3) 100%)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.6)', icon: <CrownOutlined />, glow: 'rgba(251, 191, 36, 0.5)' };
    if (tier.includes('Bạc')) return { bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(209, 213, 219, 0.3) 100%)', color: '#9ca3af', border: 'rgba(156, 163, 175, 0.6)', icon: <StarOutlined />, glow: 'rgba(156, 163, 175, 0.5)' };
    return { bg: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(217, 119, 6, 0.3) 100%)', color: '#cd7f32', border: 'rgba(205, 127, 50, 0.6)', icon: <TrophyOutlined />, glow: 'rgba(205, 127, 50, 0.5)' };
  };

  // Get first character of user name as letter avatar
  const userInitial = (mockUser.name || 'U').trim().charAt(0).toUpperCase();

  const handleLogout = () => {
    b2cLogout();
    logout();
    message.success(t('account.logout_success'));
    navigate('/', { replace: true });
  };

  const menuItems = [
    { key: 'orders', label: 'Quản lý đơn hàng' },
    { key: 'profile', label: 'Hồ sơ cá nhân' },
    { key: 'address', label: 'Sổ địa chỉ' },
    { key: 'wishlist', label: 'Sản phẩm yêu thích' },
    { key: 'preferences', label: 'Sở thích cá nhân' },
    { key: 'loyalty', label: 'Điểm thưởng & Ưu đãi' },
    { type: 'divider' },
    { key: 'logout', label: 'Đăng xuất', danger: true }
  ];

  // Chưa đăng nhập: trước 11/11/2026 trang vẫn dựng hồ sơ giả "Khách vãng lai ·
  // Thành viên Đồng" kèm đủ menu và nút Đăng xuất, còn ô "tra cứu theo email" thì
  // bỏ qua email (getMyOrders tra theo token). Mời đăng nhập thay vì giả lập tài
  // khoản. Đặt sau mọi hook ở trên nên không vi phạm thứ tự hook.
  if (!currentUser) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '120px 24px 64px' }}>
        <Card style={{ borderRadius: 20, textAlign: 'center' }} styles={{ body: { padding: '40px 32px' } }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={null} />
          <Title level={3} style={{ marginTop: 8, marginBottom: 8 }}>Đăng nhập để xem tài khoản</Title>
          <Text type="secondary">Theo dõi đơn hàng, lưu địa chỉ giao hàng, sản phẩm yêu thích và điểm thưởng của bạn.</Text>
          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              onClick={() => openAuthModal()}
              style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 999, paddingInline: 32 }}
            >
              Đăng nhập / Đăng ký
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(20px, 7vw, 100px) clamp(12px, 4vw, 24px) 48px' }}>
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0px var(--glow-color); }
          50% { box-shadow: 0 0 12px var(--glow-color); }
          100% { box-shadow: 0 0 0px var(--glow-color); }
        }
        @keyframes shineEffect {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }
        .shiny-badge {
          position: relative;
          overflow: hidden;
          animation: pulseGlow 2.5s infinite;
        }
        .shiny-badge::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -100%;
          width: 50%;
          height: 200%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%);
          transform: rotate(30deg);
          animation: shineEffect 3s infinite;
        }
      `}</style>
      <Row gutter={[{ xs: 0, md: 32 }, { xs: 20, md: 32 }]}>
        <Col xs={24} md={7} lg={6}>
          <div 
            style={{ 
              background: isDark ? '#18181b' : '#ffffff',
              border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {/* Monochromatic text-based avatar */}
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: isDark ? '#27272a' : '#18181b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  border: `2px solid ${isDark ? '#3f3f46' : '#27272a'}`,
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: -1
                }}
              >
                {userInitial}
              </div>
              <Title level={4} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>{mockUser.name}</Title>
              <div style={{ marginTop: 8 }}>
                <span 
                  className="shiny-badge"
                  style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: getTierStyle(mockUser.tier).bg,
                  color: getTierStyle(mockUser.tier).color,
                  border: `1px solid ${getTierStyle(mockUser.tier).border}`,
                  '--glow-color': getTierStyle(mockUser.tier).glow
                }}>
                  {getTierStyle(mockUser.tier).icon} {mockUser.tier}
                </span>
              </div>
            </div>

            <Divider style={{ margin: '16px 0', borderColor: isDark ? '#27272a' : '#f4f4f5' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {menuItems.map((item, idx) => {
                if (item.type === 'divider') {
                  return <Divider key={`div-${idx}`} style={{ margin: '10px 0', borderColor: isDark ? '#27272a' : '#f4f4f5' }} />;
                }
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (item.key === 'logout') {
                        handleLogout();
                      } else {
                        setActiveTab(item.key);
                        // Điện thoại: cột nội dung nằm DƯỚI menu dài — không cuộn thì bấm
                        // tab xong tưởng không có gì xảy ra.
                        if (window.innerWidth < 768) {
                          setTimeout(() => document.getElementById('account-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: isActive 
                        ? (isDark ? '#27272a' : '#18181b') 
                        : 'transparent',
                      color: isActive 
                        ? '#ffffff' 
                        : (item.danger ? '#ef4444' : (isDark ? '#a1a1aa' : '#52525b')),
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5';
                        if (!item.danger) e.currentTarget.style.color = isDark ? '#ffffff' : '#18181b';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        if (!item.danger) e.currentTarget.style.color = isDark ? '#a1a1aa' : '#52525b';
                      }
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Col>

        <Col xs={24} md={17} lg={18}>
          <div 
            id="account-content"
            style={{ 
              background: isDark ? '#18181b' : '#ffffff',
              scrollMarginTop: 64,
              border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
              borderRadius: 20,
              padding: 'clamp(16px, 5vw, 32px)',
              minHeight: 520,
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
            }}
          >
            {activeTab === 'orders' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>Đơn hàng của tôi</Title>
                    <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>Theo dõi trạng thái và lịch sử mua sắm</div>
                  </div>
                  {!b2cUser && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input 
                        placeholder="Nhập email tra cứu..." 
                        value={lookupEmail}
                        onChange={e => setLookupEmail(e.target.value)}
                        style={{ width: 250, borderRadius: 10, borderColor: isDark ? '#3f3f46' : '#d4d4d8' }}
                      />
                      <Button 
                        type="primary" 
                        onClick={() => handleLookup()} 
                        style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 10, fontWeight: 600 }}
                      >
                        Tra cứu
                      </Button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
                ) : orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: isDark ? '#a1a1aa' : '#71717a' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Chưa tìm thấy đơn hàng nào</div>
                    <div style={{ fontSize: 14 }}>Tài khoản {b2cUser ? b2cUser.email : lookupEmail || 'hiện tại'} chưa có giao dịch nào.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {orders.map(order => (
                      <div 
                        key={order.id} 
                        style={{ 
                          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                          borderRadius: 16, 
                          padding: 24,
                          background: isDark ? '#202024' : '#fafafa'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: isDark ? '#fff' : '#18181b', fontSize: 15 }}>
                              Mã đơn: {order.id}
                            </span>
                            <span style={{ marginLeft: 16, color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13 }}>
                              {new Date(order.date || order.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {/* Trạng thái THANH TOÁN tách riêng khỏi trạng thái GIAO HÀNG:
                                đơn COD có thể "Đã xác nhận" mà vẫn chưa trả tiền. */}
                            {getPaymentLabel(order) && (
                              <Tag color={getPaymentLabel(order).color} style={{ margin: 0 }}>
                                {getPaymentLabel(order).text}
                              </Tag>
                            )}
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              background: isDark ? '#27272a' : '#ffffff',
                              color: isDark ? '#f4f4f5' : '#18181b',
                              border: `1px solid ${isDark ? '#3f3f46' : '#d4d4d8'}`
                            }}>
                              {getOrderStatus(order.status).text}
                            </span>
                            {canCancel(order) && (
                              <Button
                                size="small" danger
                                loading={cancelling === order.id}
                                onClick={() => handleCancel(order)}
                              >
                                Huỷ đơn
                              </Button>
                            )}
                          </div>
                        </div>
                        <Divider style={{ margin: '14px 0', borderColor: isDark ? '#27272a' : '#e4e4e7' }} />
                        
                        {order.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                              <img 
                                src={getProductImage(item)} 
                                alt={item.name} 
                                referrerPolicy="no-referrer"
                                onError={(e) => handleImageError(e, item)}
                                style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain', background: '#fff', border: '1px solid #eee' }} 
                              />
                              <div>
                                <div style={{ color: isDark ? '#f4f4f5' : '#18181b', fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                                {item.selectedVariant && <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>{item.selectedVariant.color} {item.selectedVariant.storage}</div>}
                                <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>Số lượng: {item.quantity || 1}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 600, color: isDark ? '#f4f4f5' : '#18181b', fontSize: 14 }}>
                              {(item.price * (item.quantity || 1)).toLocaleString('vi-VN')} đ
                            </div>
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', fontStyle: 'italic', marginBottom: 12 }}>
                            ... và {order.items.length - 2} sản phẩm khác
                          </div>
                        )}

                        <Divider style={{ margin: '16px 0', borderColor: isDark ? '#27272a' : '#e4e4e7' }} />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 18 }}>
                          <div>Tạm tính: {order.subTotal?.toLocaleString('vi-VN')} đ</div>
                          <div>Phí vận chuyển: {order.shippingFee?.toLocaleString('vi-VN')} đ</div>
                          {order.discount > 0 && <div style={{ color: '#ef4444' }}>Giảm giá: -{order.discount?.toLocaleString('vi-VN')} đ</div>}
                          <div style={{ color: isDark ? '#fff' : '#18181b', marginTop: 4, fontSize: 15 }}>
                            Thành tiền: <span style={{ fontSize: 20, fontWeight: 800, color: isDark ? '#fff' : '#18181b' }}>{order.total?.toLocaleString('vi-VN')} đ</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <Button 
                            onClick={() => setSelectedOrder(order)}
                            style={{ 
                              borderRadius: 10, 
                              fontWeight: 600,
                              borderColor: isDark ? '#3f3f46' : '#d4d4d8',
                              background: isDark ? '#27272a' : '#ffffff',
                              color: isDark ? '#f4f4f5' : '#18181b'
                            }}
                          >
                            Xem chi tiết
                          </Button>
                          <Button 
                            onClick={() => {
                              const invoiceHtml = `
                                <div style="padding: 40px; font-family: sans-serif; color: #18181b; background: #fff; width: 100%; box-sizing: border-box;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #18181b; padding-bottom: 20px; margin-bottom: 30px;">
                                    <div>
                                      <h1 style="color: #18181b; margin: 0; font-size: 24px;">GETSHOPY</h1>
                                      <p style="margin: 5px 0; color: #71717a;">Hệ thống bán lẻ thiết bị công nghệ chính hãng</p>
                                    </div>
                                    <div style="text-align: right;">
                                      <h2 style="margin: 0; color: #18181b; font-size: 20px;">HÓA ĐƠN ĐIỆN TỬ</h2>
                                      <p style="margin: 5px 0; color: #71717a;">Mã đơn: <b>${order.id}</b></p>
                                      <p style="margin: 5px 0; color: #71717a;">Ngày: ${new Date(order.date || order.created_at).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                  </div>

                                  <div style="margin-bottom: 30px;">
                                    <h3 style="color: #18181b; border-bottom: 1px solid #e4e4e7; padding-bottom: 10px;">THÔNG TIN KHÁCH HÀNG</h3>
                                    <p><b>Họ tên:</b> ${order.customer?.full_name || order.customer_info?.fullName || 'Khách hàng'}</p>
                                    <p><b>Số điện thoại:</b> ${order.customer?.phone || order.customer_info?.phone || ''}</p>
                                    <p><b>Địa chỉ:</b> ${order.customer?.address || order.customer_info?.address || ''}, ${order.customer?.province || order.customer_info?.province || ''}</p>
                                  </div>

                                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                                    <thead>
                                      <tr style="background: #18181b; color: #fff;">
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

                                  <table style="width: 100%; margin-top: 20px;">
                                      <tr>
                                        <td style="width: 55%;"></td>
                                        <td style="width: 25%; padding: 8px 0; color: #71717a; font-size: 14px;">Tạm tính:</td>
                                        <td style="width: 20%; padding: 8px 0; text-align: right; font-weight: bold; font-size: 15px;">${order.subTotal?.toLocaleString('vi-VN') || 0} đ</td>
                                      </tr>
                                      <tr>
                                        <td></td>
                                        <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Phí vận chuyển:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 15px;">${order.shippingFee?.toLocaleString('vi-VN') || 0} đ</td>
                                      </tr>
                                      ${order.discount > 0 ? `
                                      <tr>
                                        <td></td>
                                        <td style="padding: 8px 0; color: #ef4444; font-size: 14px;">Giảm giá:</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #ef4444; font-size: 15px;">-${order.discount?.toLocaleString('vi-VN')} đ</td>
                                      </tr>
                                      ` : ''}
                                      <tr>
                                        <td style="border-top: 2px solid #18181b; padding-top: 16px;"></td>
                                        <td style="border-top: 2px solid #18181b; padding-top: 16px; font-size: 16px; font-weight: bold; color: #18181b;">TỔNG CỘNG:</td>
                                        <td style="border-top: 2px solid #18181b; padding-top: 16px; text-align: right; font-size: 22px; font-weight: 900; color: #ef4444;">${order.total?.toLocaleString('vi-VN') || 0} đ</td>
                                      </tr>
                                  </table>
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
                            style={{ 
                              borderRadius: 10, 
                              fontWeight: 600,
                              borderColor: isDark ? '#3f3f46' : '#d4d4d8',
                              background: isDark ? '#27272a' : '#ffffff',
                              color: isDark ? '#f4f4f5' : '#18181b'
                            }}
                          >
                            Tải hóa đơn PDF
                          </Button>
                          <Button 
                            type="primary" 
                            onClick={() => navigate('/shop')}
                            style={{ 
                              background: '#18181b', 
                              borderColor: '#18181b',
                              borderRadius: 10,
                              fontWeight: 600,
                              color: '#ffffff'
                            }}
                          >
                            Mua lại
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                  <div>
                    <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                      Hồ sơ cá nhân
                      {currentUser?.provider?.includes('google') && (
                        <Tag color="success" style={{ margin: 0, fontSize: 13, padding: '2px 8px', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <GoogleOutlined /> Đã liên kết Google
                        </Tag>
                      )}
                    </Title>
                    <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>Thông tin tài khoản đăng nhập của bạn</div>
                  </div>
                  {currentUser && (
                    <Button 
                      danger 
                      onClick={handleLogout}
                      style={{ borderRadius: 10, fontWeight: 600 }}
                    >
                      Đăng xuất
                    </Button>
                  )}
                </div>
                {!currentUser ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 14, background: isDark ? '#202024' : '#fafafa' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: isDark ? '#fff' : '#18181b' }}>Vui lòng đăng nhập để xem hồ sơ cá nhân</div>
                    <Button type="primary" onClick={() => openAuthModal()} style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 10, fontWeight: 600, height: 40, padding: '0 24px' }}>
                      Đăng nhập / Đăng ký
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    <div style={{ padding: 20, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 14, background: isDark ? '#202024' : '#fafafa' }}>
                      <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13, marginBottom: 6 }}>Họ và tên</div>
                      <div style={{ color: isDark ? '#fff' : '#18181b', fontWeight: 600, fontSize: 16 }}>{mockUser.name}</div>
                    </div>
                    <div style={{ padding: 20, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 14, background: isDark ? '#202024' : '#fafafa' }}>
                      <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13, marginBottom: 6 }}>Địa chỉ email</div>
                      <div style={{ color: isDark ? '#fff' : '#18181b', fontWeight: 600, fontSize: 16 }}>{mockUser.email}</div>
                    </div>
                    <div style={{ padding: 20, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 14, background: isDark ? '#202024' : '#fafafa' }}>
                      <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13, marginBottom: 6 }}>Số điện thoại</div>
                      <div style={{ color: isDark ? '#fff' : '#18181b', fontWeight: 600, fontSize: 16 }}>{mockUser.phone}</div>
                    </div>
                    <div style={{ padding: 20, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 14, background: isDark ? '#202024' : '#fafafa' }}>
                      <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13, marginBottom: 6 }}>Hạng thành viên</div>
                      <div style={{ color: getTierStyle(mockUser.tier).color, fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {getTierStyle(mockUser.tier).icon} {mockUser.tier} <span style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 14 }}>({points.toLocaleString('vi-VN')} điểm)</span>
                      </div>
                    </div>
                  </div>
                )}
                  
                {/* Password & Linking Section */}
                {currentUser && (
                  <div style={{ marginTop: 24, padding: 24, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 14, background: isDark ? '#202024' : '#fafafa' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#18181b', marginBottom: 16 }}>Bảo mật & Liên kết</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: isDark ? '#fff' : '#18181b' }}>Đăng nhập bằng Email</div>
                        <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a' }}>Sử dụng mật khẩu để đăng nhập trực tiếp</div>
                      </div>
                      {currentUser?.has_password ? (
                        <Tag color="success" style={{ margin: 0, padding: '4px 12px', borderRadius: 6, fontWeight: 600 }}>Đã thiết lập mật khẩu</Tag>
                      ) : (
                        <Button type="primary" onClick={() => setIsPasswordModalOpen(true)} style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 8, fontWeight: 600 }}>
                          Thiết lập mật khẩu
                        </Button>
                      )}
                    </div>
                    
                    <Divider style={{ margin: '16px 0', borderColor: isDark ? '#3f3f46' : '#e4e4e7' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: isDark ? '#fff' : '#18181b' }}>Đăng nhập qua Google</div>
                        <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a' }}>Đăng nhập nhanh không cần mật khẩu</div>
                      </div>
                      {currentUser?.provider?.includes('google') ? (
                        <Tag color="success" style={{ margin: 0, padding: '4px 12px', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <GoogleOutlined /> Đã liên kết Google
                        </Tag>
                      ) : (
                        <Button onClick={() => message.info('Vui lòng đăng xuất và dùng nút Google để liên kết tài khoản này')} style={{ borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <GoogleOutlined /> Liên kết Google
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                <Modal
                  open={isPasswordModalOpen}
                  onCancel={() => setIsPasswordModalOpen(false)}
                  footer={null}
                  centered
                  width={420}
                  closeIcon={<span style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 16, marginTop: 4, marginRight: 4 }}><CloseOutlined /></span>}
                  styles={{ 
                    content: { 
                      padding: 0, 
                      borderRadius: 16, 
                      overflow: 'hidden', 
                      background: isDark ? '#18181b' : '#ffffff',
                      border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`
                    } 
                  }}
                >
                  <div style={{ padding: '36px 32px 32px', background: isDark ? 'linear-gradient(180deg, rgba(39,39,42,0.4) 0%, rgba(24,24,27,0) 100%)' : 'linear-gradient(180deg, rgba(244,244,245,0.6) 0%, rgba(255,255,255,0) 100%)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: isDark ? '#27272a' : '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: isDark ? '#fff' : '#18181b', fontSize: 24, boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.05)' }}>
                        <SafetyCertificateFilled style={{ color: isDark ? '#fff' : '#18181b' }} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: isDark ? '#fff' : '#18181b', marginBottom: 8, letterSpacing: '-0.02em' }}>Thiết lập mật khẩu</div>
                      <div style={{ fontSize: 14.5, color: isDark ? '#a1a1aa' : '#71717a', lineHeight: 1.5 }}>
                        Tạo mật khẩu để đăng nhập trực tiếp bằng địa chỉ Email này cho những lần sau.
                      </div>
                    </div>

                    <Form form={passwordForm} layout="vertical" onFinish={handleSetPassword} requiredMark={false}>
                      <Form.Item 
                        name="new_password" 
                        label={<span style={{ fontWeight: 600, color: isDark ? '#e4e4e7' : '#3f3f46', fontSize: 14 }}>Mật khẩu mới</span>} 
                        rules={[
                          { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                          { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                        ]}
                      >
                        <Input.Password 
                          size="large" 
                          placeholder="Nhập mật khẩu mới" 
                          prefix={<LockOutlined style={{ color: isDark ? '#a1a1aa' : '#a1a1aa', marginRight: 8 }} />}
                          style={{ borderRadius: 10, padding: '8px 12px' }} 
                        />
                      </Form.Item>
                      
                      <Form.Item 
                        name="confirm_password" 
                        label={<span style={{ fontWeight: 600, color: isDark ? '#e4e4e7' : '#3f3f46', fontSize: 14 }}>Xác nhận mật khẩu</span>} 
                        dependencies={['new_password']}
                        rules={[
                          { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('new_password') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('Hai mật khẩu không khớp!'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password 
                          size="large" 
                          placeholder="Nhập lại mật khẩu" 
                          prefix={<LockOutlined style={{ color: isDark ? '#a1a1aa' : '#a1a1aa', marginRight: 8 }} />}
                          style={{ borderRadius: 10, padding: '8px 12px' }} 
                        />
                      </Form.Item>

                      <Button type="primary" htmlType="submit" size="large" loading={settingPassword} style={{ width: '100%', background: isDark ? '#fff' : '#18181b', color: isDark ? '#18181b' : '#fff', borderColor: isDark ? '#fff' : '#18181b', borderRadius: 10, fontWeight: 700, marginTop: 12, height: 48, fontSize: 16 }}>
                        Lưu mật khẩu
                      </Button>
                    </Form>
                  </div>
                </Modal>
              </div>
            )}
            
            {activeTab === 'address' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>Sổ địa chỉ</Title>
                    <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>Quản lý các địa chỉ nhận hàng đã lưu</div>
                  </div>
                  <Button 
                    type="primary" 
                    onClick={() => setIsAddressModalOpen(true)} 
                    style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 10, fontWeight: 600 }}
                  >
                    Thêm địa chỉ mới
                  </Button>
                </div>
                
                {addresses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: isDark ? '#a1a1aa' : '#71717a' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Chưa có địa chỉ nào được lưu</div>
                    <div style={{ fontSize: 14 }}>Hãy thêm địa chỉ để thanh toán nhanh chóng hơn trong lần mua sau.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {addresses.map(addr => (
                      <div 
                        key={addr.id} 
                        style={{ 
                          padding: 20, 
                          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                          borderRadius: 14, 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          background: isDark ? '#202024' : '#fafafa'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: isDark ? '#fff' : '#18181b', marginBottom: 4 }}>
                            {addr.name} — {addr.phone}
                            {addr.isDefault && (
                              <span style={{ 
                                marginLeft: 10, 
                                padding: '2px 8px', 
                                borderRadius: 10, 
                                fontSize: 11, 
                                fontWeight: 600, 
                                background: isDark ? '#27272a' : '#e4e4e7',
                                color: isDark ? '#f4f4f5' : '#18181b'
                              }}>
                                Mặc định
                              </span>
                            )}
                          </div>
                          <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 14 }}>
                            {addr.street}, {addr.ward}, {addr.district}, {addr.province}
                          </div>
                        </div>
                        <Button 
                          type="text" 
                          danger 
                          onClick={() => handleDeleteAddress(addr.id)}
                          style={{ fontWeight: 600 }}
                        >
                          Xoá
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Modal
                  title={<span style={{ fontWeight: 700, fontSize: 18 }}>Thêm địa chỉ giao hàng</span>}
                  open={isAddressModalOpen}
                  onCancel={() => setIsAddressModalOpen(false)}
                  footer={null}
                  width={800}
                >
                  <div style={{ display: 'flex', gap: 24, marginTop: 20, flexDirection: 'row', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 340px' }}>
                      <Form form={form} layout="vertical" onFinish={handleAddAddress}>
                        <Form.Item name="name" label="Họ và tên" rules={[{ required: true }]}><Input placeholder="Nhập họ và tên người nhận" style={{ borderRadius: 10 }} /></Form.Item>
                        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }]}><Input placeholder="Nhập số điện thoại nhận hàng" style={{ borderRadius: 10 }} /></Form.Item>
                        <Row gutter={12}>
                          <Col span={12}><Form.Item name="province" label="Tỉnh/Thành phố" rules={[{ required: true }]}><Input placeholder="Ví dụ: TP. Hồ Chí Minh" style={{ borderRadius: 10 }} /></Form.Item></Col>
                          <Col span={12}><Form.Item name="district" label="Quận/Huyện" rules={[{ required: true }]}><Input placeholder="Ví dụ: Quận 1" style={{ borderRadius: 10 }} /></Form.Item></Col>
                        </Row>
                        <Form.Item name="ward" label="Phường/Xã" rules={[{ required: true }]}><Input placeholder="Ví dụ: Phường Bến Nghé" style={{ borderRadius: 10 }} /></Form.Item>
                        <Form.Item name="street" label="Địa chỉ cụ thể" rules={[{ required: true }]}><Input.TextArea placeholder="Số nhà, tên đường hoặc toạ độ..." rows={2} style={{ borderRadius: 10 }} /></Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: '100%', background: '#18181b', borderColor: '#18181b', borderRadius: 10, height: 44, fontWeight: 600, marginTop: 12 }}>
                          Lưu địa chỉ
                        </Button>
                      </Form>
                    </div>
                    <div style={{ flex: '1 1 340px' }}>
                      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Ghim vị trí trên bản đồ</div>
                      {/* Nút định vị + dòng trạng thái (12/11/2026): tự hỏi một lần khi mở hộp; nút để thử
                          lại sau khi bị từ chối / quá giờ, hoặc chủ động ghi đè ô địa chỉ cụ thể. */}
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', marginBottom: 10 }}>
                        <Button
                          icon={<AimOutlined />}
                          onClick={() => locateMe()}
                          loading={geo.status === 'locating'}
                          style={{ borderRadius: 8, fontWeight: 600 }}
                        >
                          Dùng vị trí hiện tại
                        </Button>
                        <span
                          role="status"
                          aria-live="polite"
                          style={{
                            flex: '1 1 200px', fontSize: 12,
                            color: geo.status === 'error' ? '#ef4444' : geo.status === 'warn' ? '#d97706' : (isDark ? '#a1a1aa' : '#71717a'),
                          }}
                        >
                          {geo.text}
                        </span>
                      </div>
                      <div style={{ height: 380, borderRadius: 14, overflow: 'hidden', border: `1px solid ${isDark ? '#3f3f46' : '#d4d4d8'}`, position: 'relative', zIndex: 0 }}>
                        <MapContainer
                          center={mapPosition}
                          zoom={PICKER_ZOOM}
                          scrollWheelZoom={true}
                          style={{ height: '100%', width: '100%', zIndex: 0 }}
                          whenCreated={(mapInstance) => { setTimeout(() => mapInstance.invalidateSize(), 300); }}
                        >
                          {/* Ô bản đồ OSM France: không cần key. CARTO đòi API key từ 09/2026 — thiếu key mọi ô
                              chỉ là chữ "API KEY REQUIRED"; tile.openstreetmap.org không kết nối được từ mạng VN (đo 11/11/2026). */}
                          <TileLayer
                            attribution='&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
                          />
                          <LocationMarker />
                          <MapView view={mapView} />
                          <MapResizer active={isAddressModalOpen} />
                        </MapContainer>
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 8 }}>
                        Nhấp trực tiếp trên bản đồ để chọn toạ độ giao hàng.
                      </div>
                    </div>
                  </div>
                </Modal>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>Sở thích cá nhân</Title>
                  <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>
                    Những gì bạn chọn giúp AI-Rec gợi ý đúng sản phẩm hơn
                  </div>
                </div>

                <div
                  style={{
                    background: isDark ? '#18181b' : '#ffffff',
                    border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                    borderRadius: 16,
                    padding: 24,
                  }}
                >
                  {prefLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
                  ) : !pref ? (
                    <Empty
                      description={<span style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>Bạn chưa chọn sở thích nào. Hãy chọn để gợi ý phù hợp hơn.</span>}
                    >
                      <Button type="primary" onClick={() => openOnboarding()} style={{ background: isDark ? '#fafafa' : '#18181b', borderColor: isDark ? '#fafafa' : '#18181b', color: isDark ? '#0b0b0d' : '#ffffff' }}>
                        Chọn sở thích ngay
                      </Button>
                    </Empty>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Tag color={pref.status === 'completed' ? 'green' : 'default'}>
                          {pref.status === 'completed' ? 'Đã hoàn tất' : pref.status === 'skipped' ? 'Đã bỏ qua' : 'Chưa hoàn tất'}
                        </Tag>
                        {pref.updated_at && (
                          <span style={{ fontSize: 12, color: isDark ? '#71717a' : '#a1a1aa' }}>
                            Cập nhật {new Date(pref.updated_at).toLocaleString('vi-VN')}
                          </span>
                        )}
                      </div>

                      <PrefRow label="Nhóm hàng quan tâm" items={pref.liked_categories} isDark={isDark} />
                      <PrefRow label="Hãng quan tâm" items={pref.liked_brands} isDark={isDark} />
                      <PrefRow label="Tầm giá" items={pref.price_band ? [pref.price_band] : []} isDark={isDark} />
                      <PrefRow label="Không muốn thấy — nhóm hàng" items={pref.disliked_categories} isDark={isDark} danger />
                      <PrefRow label="Không muốn thấy — hãng" items={pref.disliked_brands} isDark={isDark} danger />

                      <div style={{ marginTop: 20 }}>
                        <Button type="primary" onClick={() => openOnboarding()} style={{ background: isDark ? '#fafafa' : '#18181b', borderColor: isDark ? '#fafafa' : '#18181b', color: isDark ? '#0b0b0d' : '#ffffff' }}>
                          Sửa lại sở thích
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'loyalty' && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>Điểm thưởng & Voucher</Title>
                  <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>Tích luỹ điểm từ mỗi đơn hàng để đổi voucher giảm giá</div>
                </div>

                {/* Luxury monochrome card */}
                <div 
                  style={{ 
                    background: isDark ? '#27272a' : '#18181b', 
                    borderRadius: 20, 
                    padding: 'clamp(20px, 6vw, 32px)',
                    color: '#ffffff', 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: 16,
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    boxShadow: '0 8px 24px -4px rgba(0,0,0,0.2)',
                    border: `1px solid ${isDark ? '#3f3f46' : '#27272a'}`
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, marginBottom: 8 }}>Hạng thành viên hiện tại</div>
                    <div style={{ fontSize: 'clamp(19px, 5.5vw, 24px)', fontWeight: 700, marginBottom: 16, color: getTierStyle(mockUser.tier).color, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      {getTierStyle(mockUser.tier).icon} {mockUser.tier}
                    </div>
                    <div style={{ fontSize: 'clamp(34px, 10vw, 44px)', fontWeight: 800, letterSpacing: -1, lineHeight: 1.1 }}>
                      {points.toLocaleString('vi-VN')} <span style={{ fontSize: 20, fontWeight: 500, opacity: 0.8 }}>Điểm</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div 
                      className="shiny-badge"
                      style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 20,
                      background: getTierStyle(mockUser.tier).bg,
                      color: getTierStyle(mockUser.tier).color,
                      border: `1px solid ${getTierStyle(mockUser.tier).border}`,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      whiteSpace: 'nowrap',
                      '--glow-color': getTierStyle(mockUser.tier).glow
                    }}>
                      <GiftOutlined style={{ fontSize: 15 }} /> GETSHOPY REWARDS
                    </div>
                  </div>
                </div>
                
                <Title level={4} style={{ color: isDark ? '#fff' : '#18181b', marginTop: 36, marginBottom: 18, fontWeight: 700 }}>Ưu đãi quy đổi</Title>
                <Row gutter={[16, 16]}>
                  {[
                    { pts: 50, desc: 'Voucher giảm 50.000 đ', code: 'VCH50K' },
                    { pts: 100, desc: 'Voucher giảm 100.000 đ', code: 'VCH100K' },
                    { pts: 200, desc: 'Voucher giảm 200.000 đ', code: 'VCH200K' }
                  ].map(v => (
                    <Col xs={24} md={8} key={v.pts}>
                      <div 
                        style={{ 
                          border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                          borderRadius: 16, 
                          padding: 24, 
                          textAlign: 'center',
                          background: isDark ? '#202024' : '#fafafa'
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: isDark ? '#fff' : '#18181b', marginBottom: 6 }}>{v.desc}</div>
                        <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13, marginBottom: 16 }}>Yêu cầu {v.pts} điểm</div>
                        <Button 
                          type="primary" 
                          disabled={points < v.pts} 
                          style={{ 
                            background: points >= v.pts ? '#18181b' : undefined, 
                            borderColor: points >= v.pts ? '#18181b' : undefined,
                            borderRadius: 10,
                            fontWeight: 600,
                            width: '100%' 
                          }}
                        >
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
                <div style={{ marginBottom: 28 }}>
                  <Title level={3} style={{ color: isDark ? '#fff' : '#18181b', margin: 0, fontWeight: 700 }}>Sản phẩm yêu thích</Title>
                  <div style={{ fontSize: 14, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>Danh sách các sản phẩm bạn đã đánh dấu quan tâm</div>
                </div>
                
                {(!wishlist || wishlist.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: isDark ? '#a1a1aa' : '#71717a' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Chưa có sản phẩm yêu thích nào</div>
                    <div style={{ fontSize: 14 }}>Bấm vào sản phẩm khi duyệt cửa hàng để lưu lại danh sách quan tâm.</div>
                  </div>
                ) : (
                  <Row gutter={[20, 20]}>
                    {wishlist.map(p => (
                      <Col xs={24} sm={12} md={8} key={p.id}>
                        <div 
                          style={{ 
                            background: isDark ? '#202024' : '#ffffff', 
                            border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                            borderRadius: 16, 
                            overflow: 'hidden',
                            padding: 16,
                            position: 'relative'
                          }}
                        >
                          <div 
                            onClick={() => navigate(`/product/${p.id}`)} 
                            style={{ padding: 16, display: 'flex', justifyContent: 'center', cursor: 'pointer', background: '#ffffff', borderRadius: 12, marginBottom: 12 }}
                          >
                            <img 
                              alt={p.name} 
                              src={getProductImage(p)} 
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, p)}
                              style={{ height: 140, objectFit: 'contain' }} 
                            />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? '#fff' : '#18181b', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div style={{ color: isDark ? '#fff' : '#18181b', fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
                            {p.price?.toLocaleString('vi-VN')} đ
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button 
                              type="primary"
                              onClick={() => navigate(`/product/${p.id}`)}
                              style={{ flex: 1, background: '#18181b', borderColor: '#18181b', borderRadius: 10, fontWeight: 600 }}
                            >
                              Xem chi tiết
                            </Button>
                            <Button 
                              danger
                              onClick={() => { toggleWishlist(p); message.success('Đã bỏ yêu thích'); }}
                              style={{ borderRadius: 10, fontWeight: 600 }}
                            >
                              Bỏ lưu
                            </Button>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            )}
          </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 12 }}>Ngày đặt hàng</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{new Date(selectedOrder.date || selectedOrder.created_at).toLocaleString('vi-VN')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 12 }}>Trạng thái</div>
                <span style={{
                  display: 'inline-block',
                  marginTop: 4,
                  padding: '3px 10px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  background: isDark ? '#27272a' : '#f4f4f5',
                  color: isDark ? '#f4f4f5' : '#18181b',
                  border: `1px solid ${isDark ? '#3f3f46' : '#d4d4d8'}`
                }}>
                  {getOrderStatus(selectedOrder.status).text}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 32, padding: 20, background: isDark ? '#202024' : '#f9f9f9', borderRadius: 14, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}` }}>
              {/* Clean number-based steps, NO ICONS */}
              <Steps 
                current={getOrderStatus(selectedOrder.status).step}
                size="small"
                items={[
                  { title: 'Chờ xác nhận' },
                  { title: 'Đã đóng gói' },
                  { title: 'Đang giao hàng' },
                  { title: 'Đã nhận hàng' },
                ]}
              />
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Bản đồ Tracking hành trình</div>
              <OrderTrackingMap order={selectedOrder} />
            </div>

            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Danh sách sản phẩm ({selectedOrder.items.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 14, border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, borderRadius: 12, background: isDark ? '#202024' : '#ffffff' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <img 
                      src={getProductImage(item)} 
                      alt={item.name} 
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, item)}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', background: '#fff', border: '1px solid #eee' }} 
                    />
                    <div>
                      <div style={{ color: isDark ? '#f4f4f5' : '#18181b', fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      {item.selectedVariant && <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>{item.selectedVariant.color} {item.selectedVariant.storage}</div>}
                      <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a' }}>Số lượng: {item.quantity || 1}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: isDark ? '#f4f4f5' : '#18181b', display: 'flex', alignItems: 'center' }}>
                    {(item.price * (item.quantity || 1)).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))}
            </div>

            <Divider style={{ margin: '16px 0', borderColor: isDark ? '#27272a' : '#e4e4e7' }} />
                        
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', color: isDark ? '#a1a1aa' : '#71717a' }}>
              <div>Tạm tính: {selectedOrder.subTotal?.toLocaleString('vi-VN')} đ</div>
              <div>Phí vận chuyển: {selectedOrder.shippingFee?.toLocaleString('vi-VN')} đ</div>
              {selectedOrder.discount > 0 && <div style={{ color: '#ef4444' }}>Giảm giá: -{selectedOrder.discount?.toLocaleString('vi-VN')} đ</div>}
              <div style={{ marginTop: 8, color: isDark ? '#fff' : '#18181b', fontSize: 15 }}>
                Thành tiền: <span style={{ fontSize: 22, fontWeight: 800, color: isDark ? '#fff' : '#18181b' }}>{selectedOrder.total?.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Hiển thị 1 dòng trong tab "Sở thích cá nhân". items là mảng id (number|string).
// Thay vì map sang tên (phải load thêm API options), hiển thị số lượng + tag mẫu.
// Mục tiêu: user thấy "có/không" để quyết định bấm Sửa — chi tiết nằm trong modal.
function PrefRow({ label, items = [], isDark, danger = false }) {
  const count = items.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${isDark ? '#27272a' : '#f4f4f5'}` }}>
      <div style={{ minWidth: 200, color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13 }}>{label}</div>
      {count === 0 ? (
        <span style={{ color: isDark ? '#52525b' : '#d4d4d8', fontSize: 13 }}>—</span>
      ) : (
        <Tag color={danger ? 'red' : 'blue'}>{count} lựa chọn</Tag>
      )}
    </div>
  );
}
