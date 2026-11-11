import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Row, Col, Typography, Form, Input, Button, Divider, message, Select, Space, Checkbox, Modal, ConfigProvider } from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
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
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';
import { useTracking } from '../../hooks/useTracking';
import PaymentQRModal from '../../components/b2c/PaymentQRModal';
import { phoneRules, fullNameRules, addressRules, shortTextRules } from '../../utils/validators';
import { getProductImage, handleImageError } from '../../utils/categoryResolver';
import useMediaQuery from '../../hooks/useMediaQuery';

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

// ── Bản đồ ghim địa chỉ (12/11/2026) ──
// Trước đây mở ở zoom 13 tại một điểm cố định của TP.HCM: trên điện thoại cả mấy quận dồn vào một
// khung, ô bản đồ 256 px bị phóng lên nên mờ, tên phường/đường chồng lên nhau, khách phải tự kéo và
// phóng to mới tìm được nhà. Nay mở ở 16 (vài dãy phố) và tự hỏi vị trí máy; có vị trí thì ghim ở 17.
const PICKER_ZOOM = 16;
const LOCATED_ZOOM = 17;
// enableHighAccuracy: xin GPS chứ không chỉ Wi-Fi/IP — ghim giao hàng cần sát tới số nhà.
// timeout 10 s tính từ lúc khách đã cho phép (thời gian hộp hỏi quyền đang mở không bị tính —
// W3C Geolocation API, PositionOptions.timeout). maximumAge 60 s: vị trí vừa lấy thì dùng lại cho nhanh.
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

// MapContainer chỉ đọc center/zoom lúc tạo bản đồ; muốn đưa bản đồ tới vị trí vừa định vị thì phải
// gọi setView trên chính bản đồ. Mỗi lần `view` là object mới -> đưa bản đồ tới đó (null = để nguyên).
const MapView = ({ view }) => {
  const map = useMap();
  useEffect(() => {
    if (view) map.setView(view.center, view.zoom);
  }, [map, view]);
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
  
  // ── Điện thoại: thanh "Tổng tiền + Đặt hàng" ghim ở đáy (12/11/2026) ──
  // Trên điện thoại form ở trên, tổng tiền ở cột tóm tắt bên dưới, nút đặt hàng kẹt giữa trang: khách
  // phải cuộn qua hết form mới thấy nút, và lúc bấm thì chưa thấy tổng tiền. Ghim cả hai ở đáy như các
  // app mua sắm. Thanh thay chỗ thanh điều hướng dưới đáy của StoreLayout (báo ẩn qua Outlet context):
  // đặt chồng lên nhau thì mất ~120 px màn hình và nút Chat AI (đứng ngay trên thanh điều hướng) đè lên
  // nút Đặt hàng. Màn "Đặt hàng thành công" không có thanh này nên thanh điều hướng hiện lại.
  const isPhone = useMediaQuery('(max-width: 768px)');
  const showMobileBar = isPhone && !(success && orderData);
  const { setHideBottomNav } = useOutletContext() || {};
  // useLayoutEffect: ẩn trước khi vẽ, không nháy thanh điều hướng đè lên thanh đặt hàng lúc vào trang
  useLayoutEffect(() => {
    if (!showMobileBar || typeof setHideBottomNav !== 'function') return undefined;
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [showMobileBar, setHideBottomNav]);

  // Đang gõ (bàn phím ảo mở) thì giấu thanh: có trình duyệt thu nhỏ khung nhìn theo bàn phím, thanh
  // cố định nằm ngay trên bàn phím và che ô đang gõ; iOS thì thanh cố định trôi lệch khi cuộn lúc gõ.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!isPhone) return undefined;
    const isTextField = (el) => !!el && !el.readOnly && (el.tagName === 'TEXTAREA'
      || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|file|range|color)$/i.test(el.type)));
    let timer;
    // Chuyển ô = focusout rồi focusin: đợi một nhịp mới đọc ô đang focus để thanh không nháy giữa hai ô
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setTyping(isTextField(document.activeElement)), 0);
    };
    sync();
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
    };
  }, [isPhone]);

  // Map State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapPosition, setMapPosition] = useState([10.762622, 106.660172]); // Default HCMC
  // Định vị cho bản đồ (12/11/2026) — xem chú thích PICKER_ZOOM ở đầu file
  const [mapView, setMapView] = useState(null);
  const [geo, setGeo] = useState({ status: 'idle', text: '' }); // idle | locating | done | warn | error
  // Tăng mỗi lần hỏi vị trí / đóng bản đồ / khách tự chạm chọn: kết quả định vị về muộn thì bỏ,
  // không được kéo ghim khỏi chỗ khách vừa chọn hay ghi vào ô địa chỉ khi bản đồ đã đóng.
  const geoReqRef = useRef(0);
  // Bị từ chối quyền / máy không hỗ trợ: không tự hỏi lại mỗi lần mở (vẫn bấm nút để thử lại được)
  const geoBlockedRef = useRef(false);

  // Điền ô địa chỉ từ điểm trên bản đồ — dùng chung cho chạm chọn (luồng cũ) và định vị
  const fillAddressFromPoint = useCallback((lat, lng) => {
    form.setFieldsValue({ address: `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
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
        // Chỉ có vị trí theo mạng/IP (sai cả km): ghim vào đây là giao nhầm chỗ -> chỉ đưa bản đồ tới gần
        setMapView({ center: [lat, lng], zoom: PICKER_ZOOM - 1 });
        setGeo({ status: 'warn', text: `Chỉ định vị được gần đúng (sai số ~${acc}) nên chưa ghim — hãy chạm đúng chỗ giao hàng.` });
        return;
      }
      setMapPosition([lat, lng]);
      setMapView({ center: [lat, lng], zoom: accuracy > 150 ? PICKER_ZOOM : LOCATED_ZOOM });
      fillAddressFromPoint(lat, lng);
      setGeo(accuracy > 150
        ? { status: 'warn', text: `Đã ghim vị trí gần đúng (sai số ~${acc}) — kiểm tra lại, lệch thì chạm đúng chỗ.` }
        : { status: 'done', text: `Đã ghim vị trí hiện tại (sai số ~${acc}). Chạm bản đồ nếu cần chỉnh.` });
    }, (err) => {
      if (reqId !== geoReqRef.current) return;
      if (err?.code === 1) geoBlockedRef.current = true;
      setGeo({ status: 'error', text: geoErrorText(err) });
    }, GEO_OPTIONS);
  }, [fillAddressFromPoint]);

  // Mở bản đồ mà ô địa chỉ còn trống -> tự hỏi vị trí một lần (mở bản đồ là để ghim chỗ mình đang ở).
  // Ô đã có địa chỉ (gõ tay / chọn từ sổ địa chỉ) thì KHÔNG tự hỏi để khỏi ghi đè; muốn thì bấm nút.
  useEffect(() => {
    if (!isMapModalOpen) return undefined;
    if (!geoBlockedRef.current && !String(form.getFieldValue('address') || '').trim()) locateMe();
    return () => {
      geoReqRef.current += 1; // đóng bản đồ: bỏ kết quả định vị còn đang chờ
      setGeo(g => (g.status === 'locating' ? { status: 'idle', text: '' } : g));
    };
  }, [isMapModalOpen, form, locateMe]);

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        // Khách tự chạm chọn thì chỗ đó thắng: bỏ kết quả định vị còn đang chờ
        geoReqRef.current += 1;
        setGeo({ status: 'idle', text: '' });
        setMapView(null);
        setMapPosition([e.latlng.lat, e.latlng.lng]);
        fillAddressFromPoint(e.latlng.lat, e.latlng.lng);
      },
    });
    return mapPosition === null ? null : <Marker position={mapPosition}></Marker>;
  };
  
  // Checkout logic states: Ưu tiên các sản phẩm được chọn; nếu không có tick nào thì lấy tất cả sản phẩm trong giỏ hàng
  const selectedCartItems = cart.filter(item => item.selected);
  const checkoutItems = selectedCartItems.length > 0 ? selectedCartItems : cart;
  // Đã đăng nhập mà giỏ trống: không có gì để đặt. Chưa đăng nhập thì nút vẫn bấm
  // được vì nó mở hộp đăng nhập. Trước 11/11/2026 nút luôn bấm được, chỉ báo lỗi
  // sau khi gửi.
  const emptyCartBlocked = !!(b2cUser || localStorage.getItem('b2c_token')) && checkoutItems.length === 0;
  const isLoggedIn = !!(b2cUser || localStorage.getItem('b2c_token'));
  const subTotal = checkoutItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  
  const province = Form.useWatch('province', form);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  // Popup VietQR cho đơn chuyển khoản
  const [qrModal, setQrModal] = useState(null);

  // Address Book Integration
  const [savedAddresses] = useState(() => JSON.parse(localStorage.getItem('b2c_addresses') || '[]'));
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // Loyalty Points Integration
  // Số điểm HIỆN TẠI lấy từ server (/b2c/me). Trước 11/11/2026 đọc localStorage
  // ['b2c_points'] — vừa sửa tay được, vừa luôn là 0 với khách mới đăng nhập vì
  // không chỗ nào ghi khoá đó lúc login. Server vẫn tự kiểm điểm khi trừ tiền.
  const [points, setPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const refreshPoints = () => {
    if (!localStorage.getItem('b2c_token')) return;
    api.b2c.getMe().then(me => setPoints(Number(me?.loyalty_points) || 0)).catch(() => {});
  };
  useEffect(refreshPoints, [b2cUser]);
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
      let detectedProvince = 'OTHER';
      if (provStr.includes('hồ chí minh') || provStr.includes('hcm')) detectedProvince = 'HCM';
      else if (provStr.includes('hà nội') || provStr.includes('hn')) detectedProvince = 'HN';
      else if (provStr.includes('đà nẵng') || provStr.includes('dn')) detectedProvince = 'DN';
      form.setFieldsValue({ province: detectedProvince });
    }
  };

  // Dọn giỏ khi rời màn checkout — không gọi sớm hơn, xem chú thích trong onFinish
  const clearCartAfterOrder = (items) => {
    if (typeof removeItemsFromCart === 'function') removeItemsFromCart(items);
    else clearCart();
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
        customer_info: { ...values, province, district: values.district, ward: values.ward, email: b2cUser?.email || values.email },
        payment_method: paymentMethod,
        subTotal,
        shippingFee,
        discount: discount + pointsDiscount,
        total: finalTotal,
        voucher: appliedVoucher?.code || null,
        pointsUsed: usePoints ? maxPointsToUse : 0
      };
      const res = await api.b2c.checkout(orderPayload);
      
      // Điểm thưởng giờ do SERVER quản lý trong LoyaltyTransaction.
      // Trước đây client tự cộng/trừ localStorage['b2c_points'] — sửa DevTools
      // là có điểm vô hạn, và pointsDiscount kéo tổng tiền về 0.
      // Sau khi đặt, đọc lại số điểm thật từ server (đã trừ điểm dùng / cộng điểm COD).
      refreshPoints();

      // KHÔNG xoá giỏ ở đây.
      //
      // Đơn chuyển khoản mở popup QR đè lên màn checkout — màn này vẫn đang
      // hiển thị bên dưới và tính lại subTotal từ giỏ mỗi lần render. Xoá giỏ
      // lúc này thì phần tổng tiền tụt về 0 + phí ship ngay sau lưng popup,
      // trong khi QR mang số tiền đúng.
      //
      // Giỏ được xoá ở clearCartAfterOrder(), gọi khi thực sự rời màn checkout.

      // Track purchase events
      trackPurchase(checkoutItems.map(item => ({
        id: item.id,
        category_id: item.category_id,
        brand_id: item.brand_id,
        price: item.price,
        quantity: item.quantity,
      })));
      const common = {
        id: res.order_id,
        items: [...checkoutItems],
        customer_info: { ...values, province, district: values.district, ward: values.ward, email: b2cUser?.email || values.email },
        // Dùng số SERVER tính, không dùng số client tự cộng — hai bên có thể
        // lệch khi giá vừa đổi hoặc voucher/điểm bị server tính lại.
        subTotal: res.pricing?.subTotal ?? subTotal,
        shippingFee: res.pricing?.shippingFee ?? shippingFee,
        discount: res.pricing?.discount ?? (discount + pointsDiscount),
        total: res.pricing?.total ?? finalTotal,
        method: res.payment_method,
        payment_ref: res.payment_ref,
        payment_status: res.payment_status,
      };

      if (res.payment_method === 'BANK_TRANSFER' && res.qr) {
        // Chuyển khoản: mở popup QR, chờ webhook báo đã thanh toán
        setQrModal({ ...res, _order: common });
      } else {
        // COD chuyển thẳng sang màn hoàn tất, không có popup che
        clearCartAfterOrder(common.items);
        setOrderData(common);
        setSuccess(true);
      }
    } catch (err) {
      message.error(err.message || 'Thanh toán thất bại');
    } finally {
      setLoading(false);
    }
  }

  if (success && orderData) {
    const isBankTransfer = orderData.method === 'BANK_TRANSFER';
    const isPaid = orderData.payment_status === 'PAID';

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
                    src={getProductImage(item)}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, item)}
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

        {/* Trạng thái thanh toán — KHÔNG hiện lại QR ở đây.
            Màn này nói "đặt hàng thành công"; kèm thêm một mã QR chờ thanh toán
            là mâu thuẫn, khách không biết rốt cuộc đã xong hay chưa. QR chỉ
            sống trong popup, đúng lúc khách cần quét. */}
        {isBankTransfer && (
          <div style={{
            background: isPaid ? (isDark ? '#052e16' : '#f0fdf4') : (isDark ? '#2a1f05' : '#fffbeb'),
            border: `1px solid ${isPaid ? '#16a34a' : '#d97706'}`,
            padding: '16px 20px', borderRadius: 14, marginBottom: 28, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isPaid ? 0 : 8 }}>
              <span style={{ fontSize: 20 }}>{isPaid ? '✓' : '⏳'}</span>
              <strong style={{ color: isPaid ? '#16a34a' : '#d97706', fontSize: 15.5 }}>
                {isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
              </strong>
            </div>
            {!isPaid && (
              <div style={{ fontSize: 13.5, color: isDark ? '#a1a1aa' : '#71717a', lineHeight: 1.7 }}>
                Đơn đang được giữ hàng trong ít phút. Nếu bạn vừa chuyển khoản, hệ thống sẽ tự
                xác nhận trong giây lát. Quá thời gian giữ mà chưa nhận được tiền thì đơn sẽ tự huỷ.
                <div style={{ marginTop: 6 }}>
                  Mã đối soát: <strong style={{ color: isDark ? '#fff' : '#18181b', fontFamily: 'ui-monospace, monospace' }}>
                    {orderData.payment_ref || '—'}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}

        {!isBankTransfer && (
          <div style={{
            background: isDark ? '#202024' : '#fafafa', border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
            padding: '14px 20px', borderRadius: 14, marginBottom: 28, textAlign: 'left',
          }}>
            <strong style={{ color: isDark ? '#fff' : '#18181b' }}>Thanh toán khi nhận hàng</strong>
            <div style={{ fontSize: 13.5, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 4 }}>
              Bạn thanh toán trực tiếp cho nhân viên giao hàng.
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

  const qrPopup = (
    <PaymentQRModal
      open={!!qrModal}
      orderData={qrModal}
      isDark={isDark}
      onPaid={() => {
        // Webhook đã xác nhận tiền về
        clearCartAfterOrder(qrModal._order.items);
        setOrderData({ ...qrModal._order, payment_status: 'PAID' });
        setSuccess(true);
        setQrModal(null);
      }}
      onClose={async () => {
        // Khách đóng popup khi chưa chuyển khoản qua QR -> tự động chuyển đơn sang
        // Thanh toán khi nhận hàng (COD), giữ nguyên số tồn kho đã trừ (601 -> 600).
        const currentModal = qrModal;
        setQrModal(null);
        if (!currentModal) return;

        clearCartAfterOrder(currentModal._order.items);
        try {
          const switched = await api.b2c.switchOrderToCod(currentModal.order_id);
          if (switched?.already_paid || switched?.payment_status === 'PAID') {
            setOrderData({ ...currentModal._order, payment_status: 'PAID' });
          } else {
            message.info('Đơn hàng đã được chuyển sang Thanh toán khi nhận hàng (COD)');
            setOrderData({
              ...currentModal._order,
              method: 'COD',
              payment_method: 'COD',
              payment_status: 'UNPAID',
            });
          }
        } catch {
          setOrderData({
            ...currentModal._order,
            method: 'COD',
            payment_method: 'COD',
            payment_status: 'UNPAID',
          });
        }
        setSuccess(true);
      }}
    />
  );

  return (
    <>
    {qrPopup}
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

          <style>{`
            /* Khắc phục lỗi nền xanh của Autofill trên Chrome và đồng bộ chiều cao */
            .checkout-form input:-webkit-autofill,
            .checkout-form input:-webkit-autofill:hover, 
            .checkout-form input:-webkit-autofill:focus, 
            .checkout-form input:-webkit-autofill:active{
                -webkit-box-shadow: 0 0 0 1000px ${isDark ? '#202024' : '#f4f4f5'} inset !important;
                -webkit-text-fill-color: ${isDark ? '#fff' : '#000'} !important;
                transition: background-color 5000s ease-in-out 0s;
            }
            .checkout-form .ant-input,
            .checkout-form .ant-select-selector {
                height: 45px !important;
                display: flex !important;
                align-items: center;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            .checkout-form .ant-select-selection-item {
                line-height: 43px !important;
            }
            .checkout-form .ant-form-item-label > label {
                height: auto !important;
            }
          `}</style>
          <ConfigProvider theme={{ components: { Input: { borderRadius: 10, colorBgContainer: isDark ? '#202024' : '#f4f4f5', colorBorder: isDark ? '#27272a' : '#e4e4e7', colorText: isDark ? '#fff' : '#000', controlHeightLG: 45 }, Select: { borderRadius: 10, colorBgContainer: isDark ? '#202024' : '#f4f4f5', colorBorder: isDark ? '#27272a' : '#e4e4e7', colorText: isDark ? '#fff' : '#000', controlHeightLG: 45 } } }}>
            {/* Điện thoại: form ở trên, nút "Xác nhận đặt hàng" ở cuối trang — thiếu ô nào thì lỗi
                hiện TRÊN màn hình, khách bấm nút thấy "không có gì xảy ra" và tưởng không đặt
                được (thử 11/11/2026: 4 lỗi địa chỉ nằm cách mép trên 200–519 px, không cuộn,
                không có thông báo). Cuộn tới ô lỗi đầu tiên + báo một dòng ở đầu màn hình. */}
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onFinishFailed={() => message.error('Vui lòng điền đủ thông tin giao hàng (ô còn thiếu đã được đánh dấu)')}
              scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
              requiredMark={false}
              className="checkout-form"
            >
              <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="full_name" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Họ và tên</span>} rules={fullNameRules}>
                  <Input size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Số điện thoại</span>} rules={phoneRules(true)}>
                  <Input size="large" inputMode="tel" maxLength={15} placeholder="0912345678" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="province" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Tỉnh / Thành phố <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Chọn tỉnh/thành' }]}>
                  <Select 
                    size="large" 
                    placeholder="Chọn Tỉnh/Thành phố" 
                    style={{ width: '100%' }}
                    options={[
                      { value: 'HCM', label: 'Hồ Chí Minh' },
                      { value: 'HN', label: 'Hà Nội' },
                      { value: 'DN', label: 'Đà Nẵng' },
                      { value: 'OTHER', label: 'Tỉnh/Thành khác' }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="district" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Quận / Huyện</span>} rules={shortTextRules('Nhập quận/huyện')}>
                  <Input size="large" placeholder="Ví dụ: Quận 1" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="ward" label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Phường / Xã</span>} rules={shortTextRules('Nhập phường/xã')}>
                  <Input size="large" placeholder="Ví dụ: Phường Bến Nghé" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item 
                  name="address" 
                  rules={addressRules}
                  label={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minWidth: 200 }}>
                      <span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>
                        Số nhà, tên đường <span style={{ color: '#ef4444' }}>*</span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setIsMapModalOpen(true)} 
                        style={{ 
                          background: 'none', border: 'none', padding: 0, 
                          color: isDark ? '#ffffff' : '#18181b', 
                          cursor: 'pointer', fontWeight: 600, fontSize: 13, textDecoration: 'underline', marginLeft: 8
                        }}
                      >
                        Chọn trên bản đồ
                      </button>
                    </div>
                  }
                >
                  <Input size="large" placeholder="Số nhà, tên đường hoặc toạ độ..." />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]} label={<span style={{ color: isDark ? '#a1a1aa' : '#52525b', fontWeight: 500 }}>Email nhận thông báo đơn hàng</span>}>
                  <Input size="large" placeholder="email@example.com" />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ borderColor: isDark ? '#27272a' : '#e4e4e7', margin: '20px 0' }} />
            
            <Title level={4} style={{ color: isDark ? '#fff' : '#18181b', marginTop: 8, marginBottom: 16, fontWeight: 700 }}>
              Phương thức thanh toán
            </Title>
            {/* Vòng tròn chọn tự vẽ (div 20×20 bo 50%) nằm trong hàng flex cạnh đoạn mô tả dài: flex mặc định
                cho co lại, nên trên điện thoại hẹp bị bóp thành hình bầu dục (12/11/2026). flexShrink: 0 +
                minWidth/minHeight giữ đúng hình tròn; gap tách chữ khỏi vòng tròn. */}
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
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Thanh toán khi nhận hàng (COD)</div>
                  <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 2 }}>Thanh toán tiền mặt cho nhân viên giao vận khi nhận kiện hàng</div>
                </div>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  minWidth: 20,
                  minHeight: 20,
                  flexShrink: 0,
                  borderRadius: '50%', 
                  border: `2px solid ${paymentMethod === 'COD' ? (isDark ? '#fff' : '#18181b') : '#a1a1aa'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {paymentMethod === 'COD' && (
                    <div style={{ width: 10, height: 10, flexShrink: 0, borderRadius: '50%', background: isDark ? '#fff' : '#18181b' }} />
                  )}
                </div>
              </div>

              <div 
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                style={{ 
                  padding: 16, 
                  border: paymentMethod === 'BANK_TRANSFER' 
                    ? `2px solid ${isDark ? '#ffffff' : '#18181b'}` 
                    : `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`, 
                  borderRadius: 14, 
                  background: paymentMethod === 'BANK_TRANSFER' 
                    ? (isDark ? '#27272a' : '#f4f4f5') 
                    : 'transparent', 
                  color: isDark ? '#fff' : '#18181b', 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Chuyển khoản Ngân hàng / Quét mã QR</div>
                  <div style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginTop: 2 }}>Hỗ trợ ứng dụng mọi ngân hàng qua VietQR tiện lợi, tức thì</div>
                </div>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  minWidth: 20,
                  minHeight: 20,
                  flexShrink: 0,
                  borderRadius: '50%', 
                  border: `2px solid ${paymentMethod === 'BANK_TRANSFER' ? (isDark ? '#fff' : '#18181b') : '#a1a1aa'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div style={{ width: 10, height: 10, flexShrink: 0, borderRadius: '50%', background: isDark ? '#fff' : '#18181b' }} />
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
              disabled={emptyCartBlocked}
              style={{ 
                marginTop: 36, 
                height: 52, 
                borderRadius: 14, 
                fontSize: 16, 
                fontWeight: 700, 
                background: '#18181b', 
                borderColor: '#18181b',
                color: '#ffffff',
                // style gắn thẳng đè màu "disabled" của antd, nên tự làm mờ
                opacity: emptyCartBlocked ? 0.4 : 1,
              }}
            >
              {b2cUser || localStorage.getItem('b2c_token') ? 'Xác nhận đặt hàng' : 'Đăng nhập để đặt hàng'}
            </Button>
          </Form>
          </ConfigProvider>

          <Modal
            title={<span style={{ fontWeight: 700, fontSize: 18 }}>Ghim vị trí trên bản đồ</span>}
            open={isMapModalOpen}
            onCancel={() => setIsMapModalOpen(false)}
            centered
            footer={[
              <Button key="ok" type="primary" onClick={() => setIsMapModalOpen(false)} style={{ background: '#18181b', borderColor: '#18181b', borderRadius: 8, fontWeight: 600 }}>
                Xác nhận vị trí
              </Button>
            ]}
            width={1000}
            styles={{ body: { paddingTop: 20 } }}
          >
            {/* Nút định vị + dòng trạng thái (12/11/2026). Tự hỏi một lần khi mở (xem useEffect theo
                isMapModalOpen); nút để thử lại sau khi bị từ chối / quá giờ, hoặc chủ động ghi đè ô địa chỉ. */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', marginBottom: 12 }}>
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
                  flex: '1 1 220px', fontSize: 13,
                  color: geo.status === 'error' ? '#ef4444' : geo.status === 'warn' ? '#d97706' : (isDark ? '#a1a1aa' : '#71717a'),
                }}
              >
                {geo.text}
              </span>
            </div>
            {/* Điện thoại: khung 550 px + tiêu đề + nút thì cao hơn màn hình, nút "Xác nhận vị trí" rơi
                khỏi tầm nhìn mà vuốt trên bản đồ lại thành kéo bản đồ -> thấp xuống 55vh. Máy tính giữ 550. */}
            <div style={{ height: isPhone ? '55vh' : 550, borderRadius: 14, overflow: 'hidden', border: '1px solid #d4d4d8', position: 'relative', zIndex: 0 }}>
              <MapContainer center={mapPosition} zoom={PICKER_ZOOM} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                {/* Ô bản đồ OSM France: không cần key. CARTO đòi API key từ 09/2026 — thiếu key mọi ô
                    chỉ là chữ "API KEY REQUIRED"; tile.openstreetmap.org không kết nối được từ mạng VN (đo 11/11/2026). */}
                <TileLayer
                  attribution='&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
                />
                <LocationMarker />
                <MapView view={mapView} />
                <MapResizer active={isMapModalOpen} />
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
                  <img 
                    src={getProductImage(item)} 
                    alt={item.name} 
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, item)}
                    style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: '#fff', border: '1px solid #eee', padding: 2 }} 
                  />
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
                <span style={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 13 }}>Khả dụng: <strong>{points.toLocaleString('vi-VN')}</strong> điểm</span>
                <Checkbox checked={usePoints} onChange={e => setUsePoints(e.target.checked)}>
                  Dùng {maxPointsToUse.toLocaleString('vi-VN')} điểm (-{(maxPointsToUse * 1000).toLocaleString('vi-VN')} đ)
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

    {/* Thanh đặt hàng ghim đáy trên điện thoại — lý do xem chú thích ở showMobileBar. Cao 60px +
        safe-area, đúng bằng phần đệm đáy StoreLayout vẫn chừa cho thanh điều hướng
        (.b2c-main-content padding-bottom) nên không che dòng cuối trang. Nút Chat AI trên điện thoại
        đứng ở bottom 72px + safe-area, nằm trọn phía trên thanh, không đè nút. */}
    {showMobileBar && !typing && (
      <div
        className="checkout-mobile-bar"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 190,
          height: 'calc(60px + env(safe-area-inset-bottom))',
          padding: '0 16px env(safe-area-inset-bottom)',
          boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', gap: 12,
          background: isDark ? '#18181b' : '#ffffff',
          borderTop: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          {/* Chưa chọn tỉnh thì phí vận chuyển = 0 trong tổng — nói rõ để khách không bất ngờ khi tổng tăng */}
          <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {province ? 'Tổng thanh toán' : 'Tổng (chưa gồm phí vận chuyển)'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? '#fff' : '#18181b', whiteSpace: 'nowrap' }}>
            {finalTotal > 0 ? finalTotal.toLocaleString('vi-VN') : 0} đ
          </div>
        </div>
        {/* Cùng trạng thái với nút "Xác nhận đặt hàng" trong form: loading, disabled khi giỏ trống,
            chưa đăng nhập thì mở hộp đăng nhập. form.submit() gửi CHÍNH form đó nên vẫn qua luật
            kiểm tra, scrollToFirstError và onFinishFailed như bấm nút cũ. */}
        <Button
          type="primary"
          size="large"
          loading={loading}
          disabled={emptyCartBlocked}
          onClick={() => {
            if (!isLoggedIn) {
              message.warning('Vui lòng đăng nhập để thực hiện mua hàng');
              if (typeof openAuthModal === 'function') openAuthModal();
              return;
            }
            form.submit();
          }}
          style={{
            flexShrink: 0,
            height: 44,
            padding: '0 24px',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            // Nền tối thì đảo màu (như nút "Lưu mật khẩu" ở Account) — nút #18181b chìm vào nền #18181b
            background: isDark ? '#ffffff' : '#18181b',
            borderColor: isDark ? '#ffffff' : '#18181b',
            color: isDark ? '#18181b' : '#ffffff',
            // style gắn thẳng đè màu "disabled" của antd, nên tự làm mờ
            opacity: emptyCartBlocked ? 0.4 : 1,
          }}
        >
          {isLoggedIn ? 'Đặt hàng' : 'Đăng nhập'}
        </Button>
      </div>
    )}
    </>
  );
}
