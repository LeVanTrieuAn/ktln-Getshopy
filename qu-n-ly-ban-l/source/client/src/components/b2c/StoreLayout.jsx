import { Layout, Badge, Input, Button, Drawer, Row, Col, Checkbox, InputNumber, Dropdown, message, Avatar, ConfigProvider } from 'antd';

/* ─── Cart Drawer Custom Styles (Black Checkbox Tick) ─────────── */
const CART_STYLE_ID = 'cart-drawer-custom-styles';
if (typeof document !== 'undefined' && !document.getElementById(CART_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = CART_STYLE_ID;
  s.textContent = `
    .cart-drawer-custom .ant-checkbox-checked .ant-checkbox-inner {
      background-color: #18181b !important;
      border-color: #18181b !important;
    }
    .cart-drawer-custom .ant-checkbox-inner {
      border-radius: 6px !important;
      width: 18px !important;
      height: 18px !important;
      border: 1.5px solid #d4d4d8 !important;
    }
    .cart-drawer-custom .ant-checkbox:hover .ant-checkbox-inner,
    .cart-drawer-custom .ant-checkbox-wrapper:hover .ant-checkbox-inner {
      border-color: #18181b !important;
    }
    .cart-drawer-custom .ant-checkbox-checked::after {
      border: 1px solid #18181b !important;
    }
    .user-dropdown-custom-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 13.5px;
      font-weight: 500;
      transition: all 0.16s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .user-dropdown-custom-item:hover {
      transform: translateX(2px);
    }
  `;
  document.head.appendChild(s);
}
import {
  ShoppingOutlined,
  SearchOutlined,
  UserOutlined,
  FireOutlined,
  LogoutOutlined,
  SwapOutlined,
  FileSearchOutlined,
  HomeOutlined,
  AppstoreOutlined,
  DownOutlined,
  CameraOutlined,
  RightOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  GlobalOutlined,
  MobileOutlined,
  LaptopOutlined,
  TabletOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  InboxOutlined,
  CloseOutlined,
  MenuOutlined,
  OrderedListOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import AIChatbot from './AIChatbot';
import AuthModal from './AuthModal';
import { useApp } from '../../context/AppContext';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

const { Sider, Content, Footer } = Layout;

export default function StoreLayout() {
  const { isDark, toggleTheme, bg, compareList, lang, toggleLang, t, b2cUser, user, b2cLogout, logout, selectedBranch, setSelectedBranch, authOpen, setAuthOpen, openAuthModal, closeAuthModal, authSuccessCallback } = useApp();
  const currentUser = b2cUser || user;
  const { cart, removeFromCart, cartTotal, cartCount, toggleSelect, toggleSelectAll, updateQuantity, cartOpen, setCartOpen } = useCart();
  const navigate = useNavigate();

  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Navbar dropdown states
  const [productsOpen, setProductsOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);

  // Categories from DB for Products dropdown
  const CAT_ICON_MAP = {
    'cat-phone': <MobileOutlined />,
    'cat-laptop': <LaptopOutlined />,
    'cat-tablet': <TabletOutlined />,
    'cat-watch': <ClockCircleOutlined />,
    'cat-mobile-acc': <ThunderboltOutlined />,
    'cat-laptop-acc': <AppstoreOutlined />,
    'cat-av': <AudioOutlined />,
    'cat-camera': <VideoCameraOutlined />,
  };

  const [navCategories, setNavCategories] = useState([
    { id: 'cat-phone', name: 'Điện thoại', icon: <MobileOutlined />, desc: 'iPhone, Samsung, Xiaomi...' },
    { id: 'cat-laptop', name: 'Laptop', icon: <LaptopOutlined />, desc: 'MacBook, Dell, ThinkPad, Asus' },
    { id: 'cat-tablet', name: 'Tablet', icon: <TabletOutlined />, desc: 'iPad Pro, Air, Galaxy Tab' },
    { id: 'cat-watch', name: 'Smartwatch', icon: <ClockCircleOutlined />, desc: 'Apple Watch, Garmin, Amazfit' },
    { id: 'cat-mobile-acc', name: 'Phụ kiện di động', icon: <ThunderboltOutlined />, desc: 'Sạc nhanh, pin sạc, ốp lưng' },
    { id: 'cat-laptop-acc', name: 'Phụ kiện laptop, PC', icon: <AppstoreOutlined />, desc: 'Chuột, bàn phím, cáp chuyển' },
    { id: 'cat-av', name: 'Thiết bị nghe nhìn', icon: <AudioOutlined />, desc: 'AirPods, Marshall, Sony, JBL' },
    { id: 'cat-camera', name: 'Camera', icon: <VideoCameraOutlined />, desc: 'Camera an ninh, webcam' },
  ]);

  useEffect(() => {
    api.b2c.getCategories().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        const roots = data.filter(c => !c.parent_id);
        const DESC_MAP = {
          'cat-phone': 'iPhone, Samsung, Xiaomi...',
          'cat-laptop': 'MacBook, Dell, ThinkPad, Asus',
          'cat-tablet': 'iPad Pro, Air, Galaxy Tab',
          'cat-watch': 'Apple Watch, Garmin, Amazfit',
          'cat-mobile-acc': 'Sạc nhanh, pin sạc, ốp lưng',
          'cat-laptop-acc': 'Chuột, bàn phím, cáp chuyển',
          'cat-av': 'AirPods, Marshall, Sony, JBL',
          'cat-camera': 'Camera an ninh, webcam',
        };
        setNavCategories(roots.map(c => ({
          id: c.id,
          name: c.name,
          icon: CAT_ICON_MAP[c.id] || <InboxOutlined />,
          desc: DESC_MAP[c.id] || 'Thiết bị chính hãng',
        })));
      }
    }).catch(err => console.warn('Categories nav fetch error:', err));
  }, []);

  // Flash sale check for header badge
  const [hasFlashSale, setHasFlashSale] = useState(false);

  // Branches list state
  const [branches, setBranches] = useState([
    { id: 'HCM001', name: 'HCM - Quận 1', address: 'Hồ Chí Minh' },
    { id: 'HN001', name: 'HN - Hoàn Kiếm', address: 'Hà Nội' },
    { id: 'DN001', name: 'ĐN - Hải Châu', address: 'Đà Nẵng' }
  ]);

  useEffect(() => {
    api.b2b.getBranches().then(data => {
      if (data && data.length > 0) {
        const uniqueBranches = Array.from(new Map(data.map(item => [item.id, item])).values());
        setBranches(uniqueBranches);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.b2c.getFlashSales().then(data => {
      if (data && data.items && data.items.length > 0 && new Date(data.end_time).getTime() > Date.now()) {
        setHasFlashSale(true);
      } else {
        setHasFlashSale(false);
      }
    }).catch(() => setHasFlashSale(false));
  }, []);

  useEffect(() => {
    api.b2c.getFlashSales().then(data => {
      if (data && data.items && data.items.length > 0 && new Date(data.end_time).getTime() > Date.now()) {
        setHasFlashSale(true);
      } else {
        setHasFlashSale(false);
      }
    }).catch(() => setHasFlashSale(false));
  }, []);

  // Live Search States
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [searchImageBase64, setSearchImageBase64] = useState(null);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const [imageSearchHint, setImageSearchHint] = useState('');
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchImageInputRef = useRef(null);

  // Close search & dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
        setSearchExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchExpand = () => {
    setSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleSearchCollapse = () => {
    if (!searchKeyword && !searchImageBase64) {
      setSearchExpanded(false);
      setShowSearchDropdown(false);
    }
  };

  const resizeAndEncodeForSearch = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxPx = 600;
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')); };
    img.src = url;
  });

  const handleSearchImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { message.warning('Ảnh quá lớn (tối đa 5MB)'); return; }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) { message.warning('Chỉ hỗ trợ JPG, PNG, WEBP, GIF'); return; }
    try {
      const b64 = await resizeAndEncodeForSearch(file);
      setSearchImageBase64(b64);
      setSearchResults([]);
      setImageSearchHint('');
      setShowSearchDropdown(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } catch { message.error('Không đọc được ảnh'); }
  };

  const clearSearchImage = () => {
    setSearchImageBase64(null);
    setImageSearchHint('');
    setSearchResults([]);
  };


  // Debounced search
  useEffect(() => {
    // Có ảnh → dùng smart-search-image (4 trường hợp)
    if (searchImageBase64) {
      const timer = setTimeout(async () => {
        try {
          setIsImageSearching(true);
          setShowSearchDropdown(true);
          const result = await api.ai.smartSearchWithImage(searchKeyword, searchImageBase64);
          setSearchResults((result?.products || []).slice(0, 5));
          setImageSearchHint(result?.hint || '');
        } catch (e) {
          console.warn('[ImageSearch]', e.message);
          setSearchResults([]);
        } finally {
          setIsImageSearching(false);
        }
      }, searchKeyword ? 700 : 400);
      return () => clearTimeout(timer);
    }

    // Không có ảnh → text search thường
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      setIsAiSearching(false);
      return;
    }
    setIsAiSearching(false);
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await api.b2c.getProducts('ALL', searchKeyword, 'newest');
        const top5 = (results?.data || []).slice(0, 5);
        if (top5.length > 0) {
          setSearchResults(top5);
        } else {
          setIsAiSearching(true);
          try {
            const aiResult = await api.ai.smartSearch(searchKeyword);
            setSearchResults((aiResult?.products || []).slice(0, 5));
          } catch (aiErr) {
            console.warn('[SmartSearch] AI failed:', aiErr.message);
            setSearchResults([]);
          } finally {
            setIsAiSearching(false);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKeyword, searchImageBase64]);


  const SIDEBAR_WIDTH = 280;
  const SIDEBAR_COLLAPSED_WIDTH = 68;
  const currentWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  /* ── Sidebar nav item renderer ── */
  const SideNavItem = ({ icon, label, path, onClick: customOnClick, active, badge }) => {
    const isActive = active ?? location?.pathname === path;
    return (
      <div
        onClick={customOnClick ?? (() => navigate(path))}
        title={sidebarCollapsed ? (typeof label === 'string' ? label : undefined) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: sidebarCollapsed ? '10px 0' : '10px 14px',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          borderRadius: 8,
          cursor: 'pointer',
          background: isActive
            ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)')
            : 'transparent',
          color: isActive ? (isDark ? '#ffffff' : '#000000') : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'),
          fontWeight: isActive ? 600 : 400,
          fontSize: 14,
          transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
          userSelect: 'none',
          position: 'relative',
          marginBottom: 1,
        }}
        className="b2c-sidebar-nav-item"
        data-active={isActive ? 'true' : 'false'}
        data-dark={isDark ? 'true' : 'false'}
      >
        <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
          {badge ? (
            <Badge count={badge} size="small" offset={[4, -2]}>{icon}</Badge>
          ) : icon}
        </span>
        {!sidebarCollapsed && (
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        )}
        {isActive && !sidebarCollapsed && (
          <span style={{
            width: 3, height: 3, borderRadius: '50%',
            background: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
            flexShrink: 0,
          }} />
        )}
      </div>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh', background: isDark ? '#0a0a0a' : '#ffffff' }}>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        .b2c-sidebar-nav-item:hover {
          background: ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'} !important;
          color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .b2c-sidebar-nav-item[data-active="true"]:hover {
          background: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} !important;
          color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .dropdown-menu-card-item {
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dropdown-menu-card-item:hover {
          background: ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'} !important;
        }
        .dropdown-menu-card-item:hover .item-arrow {
          opacity: 1 !important;
          transform: translateX(0) !important;
          color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .dropdown-menu-card-item:active { transform: scale(0.98); }
        .b2c-mobile-overlay { display: none; }
        @media (max-width: 768px) {
          .b2c-sidebar-fixed { transform: translateX(-100%) !important; }
          .b2c-sidebar-fixed.b2c-sidebar-mobile-open { transform: translateX(0) !important; }
          .b2c-main-content { margin-left: 0 !important; }
          .b2c-mobile-overlay { display: block; }
        }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div
        className={`b2c-sidebar-fixed${mobileSidebarOpen ? ' b2c-sidebar-mobile-open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          background: isDark ? 'rgba(9, 13, 22, 0.94)' : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: isDark ? '4px 0 24px rgba(0,0,0,0.5)' : '4px 0 24px rgba(0,0,0,0.06)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* ── Logo ── */}
        <div style={{
          padding: sidebarCollapsed ? '20px 0' : '20px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          flexShrink: 0,
          cursor: 'pointer',
        }} onClick={() => navigate('/')}>
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            background: isDark ? '#ffffff' : '#000000',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            <ShoppingOutlined style={{ color: isDark ? '#000000' : '#ffffff' }} />
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ color: isDark ? '#fff' : '#000', fontWeight: 800, fontSize: 16, lineHeight: 1.2, letterSpacing: '-0.5px' }}>GetShopy</div>
              <div style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em' }}>STORE</div>
            </div>
          )}
        </div>

        {/* ── Search Bar ── */}
        <div style={{
          padding: sidebarCollapsed ? '12px 0' : '12px 14px',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
          flexShrink: 0,
        }}>
          {sidebarCollapsed ? (
            <div
              title="Tìm kiếm"
              onClick={() => { setSidebarCollapsed(false); setTimeout(() => searchInputRef.current?.focus(), 200); }}
              style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.5)' : '#71717a', fontSize: 17, padding: '8px 0' }}
            >
              <SearchOutlined />
            </div>
          ) : (
            <div ref={searchRef} style={{ position: 'relative' }}>
              {/* Search image preview */}
              {searchImageBase64 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 8px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  <img src={searchImageBase64} alt="search" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 5 }} />
                  <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.6)' : '#52525b', flex: 1 }}>Tìm bằng ảnh</span>
                  <button onClick={clearSearchImage} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.5)' : '#71717a', fontSize: 12, padding: 0, display: 'flex', alignItems: 'center' }}><CloseOutlined style={{ fontSize: 10 }} /></button>
                </div>
              )}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f4f5f7',
                borderRadius: 10, padding: '7px 11px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <SearchOutlined style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : '#a1a1aa', flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  placeholder="Tìm kiếm..."
                  value={searchKeyword}
                  onChange={e => { setSearchKeyword(e.target.value); setShowSearchDropdown(true); }}
                  onFocus={() => searchKeyword && setShowSearchDropdown(true)}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 13, color: isDark ? '#ffffff' : '#18181b',
                    fontFamily: 'inherit',
                  }}
                />
                <input ref={searchImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSearchImageSelect} />
                <button
                  title="Tìm bằng ảnh"
                  onClick={() => searchImageInputRef.current?.click()}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : '#a1a1aa', fontSize: 14, display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  <CameraOutlined />
                </button>
              </div>

              {/* Search Dropdown */}
              {showSearchDropdown && (searchResults.length > 0 || isSearching || isAiSearching || isImageSearching || searchImageBase64) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 1000,
                  background: isDark ? '#111827' : '#ffffff',
                  borderRadius: 14,
                  boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.12)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  overflow: 'hidden',
                  maxHeight: 360, overflowY: 'auto',
                }}>
                  {(isSearching || isAiSearching || isImageSearching) && (
                    <div style={{ padding: '14px 16px', color: isDark ? '#9ca3af' : '#71717a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SearchOutlined style={{ fontSize: 13, opacity: 0.5 }} />
                      {isAiSearching ? 'AI đang tìm kiếm...' : isImageSearching ? 'Phân tích ảnh...' : 'Đang tìm kiếm...'}
                    </div>
                  )}
                  {imageSearchHint && !isImageSearching && (
                    <div style={{ padding: '8px 16px 4px', fontSize: 11.5, color: isDark ? 'rgba(255,255,255,0.5)' : '#52525b', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <InfoCircleOutlined style={{ fontSize: 11, opacity: 0.6 }} /> {imageSearchHint}
                    </div>
                  )}
                  {searchResults.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => { navigate(`/product/${prod.id}`); setShowSearchDropdown(false); setSearchKeyword(''); setSearchImageBase64(null); }}
                      style={{ display: 'flex', gap: 10, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <img src={prod.image || (prod.images && prod.images[0]) || '/images/commerce/prod_mouse.jpg'} alt={prod.name} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: isDark ? '#1a2233' : '#f4f5f7', padding: 4 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f3f4f6' : '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.name}</div>
                        <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#52525b', fontWeight: 600 }}>{Number(prod.price || 0).toLocaleString('vi-VN')} đ</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Nav Links ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: sidebarCollapsed ? '10px 8px' : '10px 10px' }}>
          {/* Main nav */}
          <div style={{ marginBottom: 4 }}>
            {!sidebarCollapsed && (
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', padding: '4px 14px 8px' }}>Điều hướng</div>
            )}
            <SideNavItem icon={<HomeOutlined />} label="Trang chủ" path="/" active={location?.pathname === '/'} />
            <SideNavItem icon={<ShoppingOutlined />} label="Cửa hàng" path="/shop" />

            {/* Products with expandable sub-items */}
            <Dropdown
              open={productsOpen}
              onOpenChange={setProductsOpen}
              placement="rightTop"
              overlayStyle={{ zIndex: 1050 }}
              dropdownRender={() => (
                <div style={{
                  width: 320,
                  background: isDark ? '#111827' : '#ffffff',
                  borderRadius: 16,
                  boxShadow: isDark
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                    : '0 25px 50px -12px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                  padding: '14px 12px',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', paddingBottom: 8, marginBottom: 6, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Danh mục</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[{ key: 'all', title: 'Tất cả sản phẩm', desc: 'Toàn bộ 600.000+ sản phẩm', icon: <OrderedListOutlined />, path: '/shop' },
                      ...navCategories.map(cat => ({ key: cat.id, title: cat.name, desc: cat.desc, icon: cat.icon || <InboxOutlined />, path: `/shop?category=${cat.id}` }))
                    ].map(item => (
                      <div key={item.key} onClick={() => { setProductsOpen(false); navigate(item.path); }} className="dropdown-menu-card-item"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, color: isDark ? 'rgba(255,255,255,0.7)' : '#52525b' }}>{item.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f3f4f6' : '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
                        </div>
                        <RightOutlined className="item-arrow" style={{ fontSize: 9, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', opacity: 0, transition: 'all 0.2s ease', transform: 'translateX(-4px)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            >
              <div>
                <SideNavItem
                  icon={<AppstoreOutlined />}
                  label={<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>Sản phẩm <DownOutlined style={{ fontSize: 10, opacity: 0.6, transform: productsOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} /></span>}
                  active={false}
                />
              </div>
            </Dropdown>

            {/* Pages dropdown */}
            <Dropdown
              open={pagesOpen}
              onOpenChange={setPagesOpen}
              placement="rightTop"
              overlayStyle={{ zIndex: 1050 }}
              dropdownRender={() => (
                <div style={{
                  width: 290,
                  background: isDark ? '#111827' : '#ffffff',
                  borderRadius: 16,
                  boxShadow: isDark ? '0 25px 50px -12px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.1)' : '0 25px 50px -12px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
                  padding: '14px 12px',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', paddingBottom: 8, marginBottom: 6, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>Điều hướng nhanh</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[
                      { key: 'shop', title: 'Cửa hàng', desc: 'Duyệt tất cả sản phẩm', icon: <ShoppingOutlined style={{ fontSize: 14 }} />, path: '/shop' },
                      { key: 'best', title: 'Bán chạy nhất', desc: 'Top thiết bị mua nhiều nhất', icon: <FireOutlined style={{ fontSize: 14 }} />, path: '/shop?sort=bestseller' },
                      { key: 'compare', title: 'So sánh thiết bị', desc: 'Đối chiếu thông số kỹ thuật', icon: <SwapOutlined style={{ fontSize: 14 }} />, path: '/compare' },
                      { key: 'account', title: 'Đơn hàng & Tài khoản', desc: 'Lịch sử mua sắm & tích điểm', icon: <UserOutlined style={{ fontSize: 14 }} />, path: '/account' },
                    ].map(item => (
                      <div key={item.key} onClick={() => { setPagesOpen(false); navigate(item.path); }} className="dropdown-menu-card-item"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isDark ? 'rgba(255,255,255,0.7)' : '#52525b' }}>{item.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f3f4f6' : '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
                        </div>
                        <RightOutlined className="item-arrow" style={{ fontSize: 9, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', opacity: 0, transition: 'all 0.2s ease', transform: 'translateX(-4px)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            >
              <div>
                <SideNavItem
                  icon={<FileSearchOutlined />}
                  label={<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>Trang <DownOutlined style={{ fontSize: 10, opacity: 0.6, transform: pagesOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} /></span>}
                  active={false}
                />
              </div>
            </Dropdown>

            <SideNavItem
              icon={<PhoneOutlined />}
              label="Liên hệ"
              onClick={() => { const el = document.getElementById('footer-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
              active={false}
            />
            <SideNavItem icon={<InfoCircleOutlined />} label="Về chúng tôi" path="/about" />
          </div>

          {/* Divider */}
          {!sidebarCollapsed && (
            <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '8px 14px 12px' }} />
          )}

          {/* Actions */}
          <div>
            {!sidebarCollapsed && (
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', padding: '4px 14px 8px' }}>Tài khoản</div>
            )}
            {currentUser ? (
              <Dropdown
                dropdownRender={() => (
                  <div style={{
                    minWidth: 260,
                    background: isDark ? '#18181b' : '#ffffff',
                    borderRadius: 16,
                    padding: '12px',
                    boxShadow: isDark ? '0 20px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)' : '0 20px 40px -8px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5'}` }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: isDark ? '#27272a' : '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <UserOutlined style={{ fontSize: 18, color: '#ffffff' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#ffffff' : '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.full_name || 'Khách hàng'}</div>
                        <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email || 'customer@getshopy.vn'}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div onClick={() => navigate('/account')} className="user-dropdown-custom-item" style={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <UserOutlined style={{ fontSize: 15, color: isDark ? '#a1a1aa' : '#52525b' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('nav.my_account')}</div>
                          <div style={{ fontSize: 11, color: isDark ? '#71717a' : '#a1a1aa' }}>Hồ sơ & thông tin tài khoản</div>
                        </div>
                      </div>
                      <div onClick={() => navigate('/account?tab=orders')} className="user-dropdown-custom-item" style={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <ShoppingOutlined style={{ fontSize: 15, color: isDark ? '#a1a1aa' : '#52525b' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('account.my_orders') || 'Đơn hàng của tôi'}</div>
                          <div style={{ fontSize: 11, color: isDark ? '#71717a' : '#a1a1aa' }}>Quản lý đơn mua & hóa đơn</div>
                        </div>
                      </div>
                      <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5', margin: '4px 2px' }} />
                      <div onClick={() => { b2cLogout(); logout(); message.success(t('nav.logged_out_success')); navigate('/'); }} className="user-dropdown-custom-item" style={{ color: '#ef4444' }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <LogoutOutlined style={{ fontSize: 15, color: '#ef4444' }} />
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('nav.logout')}</div></div>
                      </div>
                    </div>
                  </div>
                )}
                placement="rightBottom"
                trigger={['hover', 'click']}
              >
                <div className="b2c-sidebar-nav-item" data-active="false" data-dark={isDark ? 'true' : 'false'} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: sidebarCollapsed ? '10px 0' : '10px 14px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  borderRadius: 10, cursor: 'pointer', marginBottom: 2,
                  color: isDark ? 'rgba(255,255,255,0.72)' : '#52525b',
                }}>
                  <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDark ? '#27272a' : '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserOutlined style={{ fontSize: 14, color: '#fff' }} />
                    </div>
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: isDark ? '#ffffff' : '#000000', border: `1.5px solid ${isDark ? '#09090b' : '#fff'}` }} />
                  </div>
                  {!sidebarCollapsed && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#fff' : '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.full_name || 'Tài khoản'}</div>
                      <div style={{ fontSize: 11, color: isDark ? '#a1a1aa' : '#71717a' }}>Đã đăng nhập</div>
                    </div>
                  )}
                </div>
              </Dropdown>
            ) : (
              <div onClick={() => openAuthModal()} className="b2c-sidebar-nav-item" data-active="false" data-dark={isDark ? 'true' : 'false'} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: sidebarCollapsed ? '10px 0' : '10px 14px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                borderRadius: 10, cursor: 'pointer', marginBottom: 2,
                color: isDark ? 'rgba(255,255,255,0.72)' : '#52525b',
              }} title={sidebarCollapsed ? 'Đăng nhập' : undefined}>
                <UserOutlined style={{ fontSize: 17, flexShrink: 0 }} />
                {!sidebarCollapsed && <span style={{ fontSize: 14, fontWeight: 500 }}>Đăng nhập</span>}
              </div>
            )}

            {/* Cart */}
            <div onClick={() => setCartOpen(true)} className="b2c-sidebar-nav-item" data-active="false" data-dark={isDark ? 'true' : 'false'} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: sidebarCollapsed ? '10px 0' : '10px 14px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              borderRadius: 10, cursor: 'pointer', marginBottom: 2,
              color: isDark ? 'rgba(255,255,255,0.72)' : '#52525b',
            }} title={sidebarCollapsed ? 'Giỏ hàng' : undefined}>
              <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingOutlined style={{ fontSize: 15 }} />
                {cartCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -6,
                    background: isDark ? '#ffffff' : '#000000', color: isDark ? '#000000' : '#ffffff', fontSize: 9, fontWeight: 700,
                    minWidth: 14, height: 14, borderRadius: 7, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>{cartCount}</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Giỏ hàng</span>
                  {cartCount > 0 && <span style={{ fontSize: 11, background: isDark ? '#ffffff' : '#000000', color: isDark ? '#000000' : '#ffffff', borderRadius: 20, padding: '1px 7px', fontWeight: 700 }}>{cartCount}</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom Actions ── */}
        <div style={{
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
          padding: sidebarCollapsed ? '12px 0' : '12px 10px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {/* Theme toggle */}
          <div onClick={toggleTheme} className="b2c-sidebar-nav-item" data-active="false" data-dark={isDark ? 'true' : 'false'} title={sidebarCollapsed ? (isDark ? 'Chế độ sáng' : 'Chế độ tối') : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: sidebarCollapsed ? '10px 0' : '10px 14px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderRadius: 8, cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', marginBottom: 1 }}>
            {isDark ? <SunOutlined style={{ fontSize: 15 }} /> : <MoonOutlined style={{ fontSize: 15 }} />}
            {!sidebarCollapsed && <span style={{ fontSize: 14, fontWeight: 400 }}>{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</span>}
          </div>

          {/* Language toggle */}
          <div onClick={toggleLang} className="b2c-sidebar-nav-item" data-active="false" data-dark={isDark ? 'true' : 'false'} title={sidebarCollapsed ? 'Đổi ngôn ngữ' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: sidebarCollapsed ? '10px 0' : '10px 14px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderRadius: 8, cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', marginBottom: 1 }}>
            <GlobalOutlined style={{ fontSize: 15 }} />
            {!sidebarCollapsed && <span style={{ fontSize: 14, fontWeight: 400 }}>{lang === 'vi' ? 'Tiếng Việt' : 'English'}</span>}
          </div>

          {/* Collapse toggle */}
          <div onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: sidebarCollapsed ? '10px 0' : '10px 14px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderRadius: 8, cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', transition: 'all 0.18s' }}
            onMouseEnter={e => e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'}
            onMouseLeave={e => e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}>
            {sidebarCollapsed ? <MenuUnfoldOutlined style={{ fontSize: 15 }} /> : <MenuFoldOutlined style={{ fontSize: 15 }} />}
            {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 400 }}>Thu gọn</span>}
          </div>
        </div>
      </div>

      {/* ── Mobile overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="b2c-mobile-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* ── Mobile hamburger ── */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        style={{
          display: 'none',
          position: 'fixed', top: 14, left: 14, zIndex: 201,
          width: 40, height: 40, borderRadius: 10,
          background: isDark ? 'rgba(9,13,22,0.9)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          backdropFilter: 'blur(12px)', cursor: 'pointer',
          alignItems: 'center', justifyContent: 'center',
          color: isDark ? '#fff' : '#18181b', fontSize: 16,
        }}
        className="b2c-hamburger-btn"
      >
        {mobileSidebarOpen ? <CloseOutlined style={{ fontSize: 14 }} /> : <MenuOutlined style={{ fontSize: 14 }} />}
      </button>

      {/* ── MAIN CONTENT ── */}
      <Layout
        className="b2c-main-content"
        style={{
          marginLeft: currentWidth,
          transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
          background: 'transparent',
          minHeight: '100vh',
        }}
      >
        <Content style={{ padding: 0, width: '100%', position: 'relative', zIndex: 1 }}>
          <Outlet />
        </Content>


      <Footer id="footer-section" style={{ 
        background: isDark ? '#0a0a0a' : '#ffffff', 
        color: isDark ? '#ffffff' : '#000000',
        padding: '64px 24px 32px', 
        marginTop: 0,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Row gutter={[48, 32]}>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 16, color: isDark ? '#ffffff' : '#000000' }}>GetShopy</div>
              <p style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', lineHeight: 1.8, fontSize: 14 }}>
                High-quality tech gadgets &amp; minimalist accessories engineered for simplicity, utility, and refined aesthetics.
              </p>
              <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
                {/* Social Icons */}
                <div style={{ width: 38, height: 38, borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 13, fontWeight: 700 }}>F</div>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 13, fontWeight: 700 }}>I</div>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontSize: 13, fontWeight: 700 }}>Y</div>
              </div>
            </Col>
            <Col xs={12} md={5}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: isDark ? '#ffffff' : '#000000', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('footer.about')}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li 
                  onClick={() => { navigate('/about'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontSize: 14, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = isDark ? '#ffffff' : '#000000'}
                  onMouseLeave={e => e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                >
                  {t('footer.about_intro')}
                </li>
                {[t('footer.careers'), t('footer.terms'), t('footer.privacy')].map((item, i) => (
                  <li key={i} style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontSize: 14, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = isDark ? '#ffffff' : '#000000'}
                    onMouseLeave={e => e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}>{item}</li>
                ))}
              </ul>
            </Col>
            <Col xs={12} md={5}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: isDark ? '#ffffff' : '#000000', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('footer.support')}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[t('footer.help_center'), t('footer.refund'), t('footer.customer_service'), t('footer.warranty_policy')].map((item, i) => (
                  <li key={i} style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontSize: 14, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = isDark ? '#ffffff' : '#000000'}
                    onMouseLeave={e => e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}>{item}</li>
                ))}
              </ul>
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, color: isDark ? '#ffffff' : '#000000', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('footer.download_app')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '12px 24px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)', fontSize: 14, fontWeight: 600, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}>
                  App Store
                </div>
                <div style={{ padding: '12px 24px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)', fontSize: 14, fontWeight: 600, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}>
                  Google Play
                </div>
              </div>
            </Col>
          </Row>
          <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, marginTop: 48, paddingTop: 24, textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontSize: 13 }}>
            {t('footer.copyright')}
          </div>
        </div>
      </Footer>

      {/* Cart Drawer */}
      <Drawer
        title={<span style={{ fontSize: 19, fontWeight: 700, color: isDark ? '#fff' : '#18181b' }}>{t('cart.title')}</span>}
        placement="right"
        onClose={() => setCartOpen(false)}
        open={cartOpen}
        width={440}
        zIndex={10005}
        rootClassName="cart-drawer-custom"
        styles={{ 
          body: { padding: '20px 24px 140px', background: isDark ? '#111827' : '#ffffff' },
          header: { padding: '20px 24px', background: isDark ? '#111827' : '#ffffff', borderBottom: isDark ? '1px solid #27272a' : '1px solid #f4f4f5' }
        }}
      >
        <ConfigProvider theme={{ token: { colorPrimary: '#18181b', colorPrimaryHover: '#27272a' } }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 100, color: '#888', fontSize: 15 }}>{t('cart.empty')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Select all header bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: 14,
                background: isDark ? 'rgba(255,255,255,0.04)' : '#f8f9fa',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f2'}`,
                marginBottom: 6,
              }}>
                <Checkbox 
                  checked={cart.length > 0 && cart.every(i => i.selected)} 
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <span style={{ color: isDark ? '#fff' : '#18181b', fontWeight: 700, fontSize: 15, paddingLeft: 8 }}>
                    {t('cart.select_all')} ({cart.length})
                  </span>
                </Checkbox>
              </div>

              {/* Items List */}
              {cart.map((item, idx) => {
                const itemPrice = Number(item.price) || 0;
                const itemImg = item.selectedVariant?.image || item.image || (item.images && item.images.length > 0 ? item.images[0] : '/images/commerce/prod_mouse.jpg');
                return (
                  <div
                    key={`${item.id}-${item.selectedVariant?.id || idx}`}
                    style={{
                      display: 'flex',
                      gap: 14,
                      alignItems: 'center',
                      padding: '14px',
                      borderRadius: 16,
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fcfcfd',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f0f0f2'}`,
                      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                  >
                    <Checkbox
                      checked={item.selected}
                      onChange={() => toggleSelect(item.id, item.selectedVariant?.id)}
                    />
                    <img
                      src={itemImg}
                      alt={item.name}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: 'contain',
                        borderRadius: 12,
                        background: isDark ? '#1a2233' : '#f4f5f7',
                        padding: 6,
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15.5,
                          color: isDark ? '#fff' : '#18181b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 4,
                          lineHeight: 1.4
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </div>
                      {item.selectedVariant && (
                        <div style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#71717a', marginBottom: 4 }}>
                          {t('cart.variant')}: <strong>{item.selectedVariant.color || ''} {item.selectedVariant.storage ? `- ${item.selectedVariant.storage}` : ''}</strong>
                        </div>
                      )}
                      <div style={{ color: isDark ? '#ffffff' : '#18181b', fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
                        {itemPrice.toLocaleString('vi-VN')} đ
                      </div>
                      {/* Quantity Stepper: [-] [quantity] [+] */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 10,
                        border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e4e4e7'}`,
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        height: 32,
                        padding: '0 2px',
                      }}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.selectedVariant?.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          style={{
                            width: 28,
                            height: 28,
                            border: 'none',
                            borderRadius: 7,
                            background: 'transparent',
                            color: item.quantity <= 1 ? (isDark ? '#52525b' : '#d4d4d8') : (isDark ? '#ffffff' : '#18181b'),
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            if (item.quantity > 1) {
                              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#f4f4f5';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            minWidth: 32,
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: 14,
                            color: isDark ? '#ffffff' : '#18181b',
                            userSelect: 'none',
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const maxStock = Number(item.selectedVariant?.stock ?? item.stock ?? 999);
                            updateQuantity(item.id, item.selectedVariant?.id, Math.min(maxStock, item.quantity + 1));
                          }}
                          disabled={item.quantity >= Number(item.selectedVariant?.stock ?? item.stock ?? 999)}
                          style={{
                            width: 28,
                            height: 28,
                            border: 'none',
                            borderRadius: 7,
                            background: 'transparent',
                            color: item.quantity >= Number(item.selectedVariant?.stock ?? item.stock ?? 999) ? (isDark ? '#52525b' : '#d4d4d8') : (isDark ? '#ffffff' : '#18181b'),
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: item.quantity >= Number(item.selectedVariant?.stock ?? item.stock ?? 999) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            const maxStock = Number(item.selectedVariant?.stock ?? item.stock ?? 999);
                            if (item.quantity < maxStock) {
                              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#f4f4f5';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Delete button (Black trash bin icon placed at the far right) */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id, item.selectedVariant?.id)}
                      title="Xóa khỏi giỏ hàng"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? '#ffffff' : '#18181b',
                        fontSize: 18,
                        transition: 'all 0.18s ease',
                        flexShrink: 0,
                        marginLeft: 4,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.transform = 'scale(1.12)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = isDark ? '#ffffff' : '#18181b';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {cart.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, width: '100%',
              padding: '20px 24px',
              background: isDark ? '#111827' : '#ffffff',
              borderTop: `1px solid ${isDark ? '#27272a' : '#f0f0f2'}`,
              boxShadow: isDark ? '0 -8px 24px rgba(0,0,0,0.4)' : '0 -8px 24px rgba(0,0,0,0.06)',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#9ca3af' : '#52525b' }}>{t('cart.total')}:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: isDark ? '#ffffff' : '#18181b' }}>{(Number(cartTotal) || 0).toLocaleString('vi-VN')} đ</span>
              </div>
              <Button
                type="primary"
                block
                size="large"
                onClick={() => { 
                  if (cart.length === 0) {
                    message.warning('Giỏ hàng của bạn đang trống');
                    return;
                  }
                  // Nếu chưa có sản phẩm nào được chọn, tự động chọn tất cả để sang checkout không bị trống
                  if (!cart.some(i => i.selected)) {
                    toggleSelectAll(true);
                  }
                  setCartOpen(false); 
                  if (!b2cUser && !localStorage.getItem('b2c_token')) {
                    message.warning('Vui lòng đăng nhập để thực hiện mua hàng');
                    openAuthModal(() => {
                      navigate('/checkout');
                    });
                    return;
                  }
                  navigate('/checkout'); 
                }}
                style={{
                  background: '#18181b',
                  color: '#ffffff',
                  border: 'none',
                  height: 52,
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#27272a'}
                onMouseLeave={e => e.currentTarget.style.background = '#18181b'}
              >
                {t('cart.checkout')} {cart.filter(i => i.selected).length > 0 ? `(${cart.filter(i => i.selected).length})` : `(${cart.length})`}
              </Button>
            </div>
          )}
        </ConfigProvider>
      </Drawer>

      {/* CHATBOT */}
      <AIChatbot />

      {/* AUTH MODAL */}
      <AuthModal open={authOpen} onClose={closeAuthModal} onSuccess={authSuccessCallback} />
      </Layout>
    </Layout>
  );
}
