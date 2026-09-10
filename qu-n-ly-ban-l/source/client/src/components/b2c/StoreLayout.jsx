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
  ShoppingCartOutlined,
  UserOutlined,
  FireOutlined,
  LogoutOutlined,
  SwapOutlined,
  FileSearchOutlined,
  TagOutlined,
  HomeOutlined,
  AppstoreOutlined,
  EnvironmentOutlined,
  DownOutlined,
  RobotOutlined,
  BulbOutlined,
  CameraOutlined,
  RightOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import AIChatbot from './AIChatbot';
import AuthModal from './AuthModal';
import { useApp } from '../../context/AppContext';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

import { SunOutlined, MoonOutlined } from '@ant-design/icons';

const { Header, Content, Footer } = Layout;

export default function StoreLayout() {
  const { isDark, toggleTheme, bg, compareList, lang, toggleLang, t, b2cUser, user, b2cLogout, logout, selectedBranch, setSelectedBranch, authOpen, setAuthOpen, openAuthModal, closeAuthModal, authSuccessCallback } = useApp();
  const currentUser = b2cUser || user;
  const { cart, removeFromCart, cartTotal, cartCount, toggleSelect, toggleSelectAll, updateQuantity, cartOpen, setCartOpen } = useCart();
  const navigate = useNavigate();

  // Navbar dropdown states
  const [productsOpen, setProductsOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);

  // Categories from DB for Products dropdown
  const [navCategories, setNavCategories] = useState([
    { id: 'cat-phone', name: 'Điện thoại', icon: '📱', desc: 'iPhone, Samsung, Xiaomi...' },
    { id: 'cat-laptop', name: 'Laptop', icon: '💻', desc: 'MacBook, Dell, ThinkPad, Asus' },
    { id: 'cat-tablet', name: 'Tablet', icon: '📲', desc: 'iPad Pro, Air, Galaxy Tab' },
    { id: 'cat-watch', name: 'Smartwatch', icon: '⌚', desc: 'Apple Watch, Garmin, Amazfit' },
    { id: 'cat-mobile-acc', name: 'Phụ kiện di động', icon: '🔌', desc: 'Sạc nhanh, pin sạc, ốp lưng' },
    { id: 'cat-laptop-acc', name: 'Phụ kiện laptop, PC', icon: '🖱️', desc: 'Chuột, bàn phím, cáp chuyển' },
    { id: 'cat-av', name: 'Thiết bị nghe nhìn, âm thanh', icon: '🎧', desc: 'AirPods, Marshall, Sony, JBL' },
    { id: 'cat-camera', name: 'Camera', icon: '📷', desc: 'Camera an ninh, webcam' },
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
          icon: c.icon || '📦',
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


  return (
    <Layout style={{ minHeight: '100vh', background: isDark ? '#090d16' : '#ffffff' }}>
      <Header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        padding: '0 32px',
        background: isDark ? 'rgba(9, 13, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 72,
        lineHeight: '72px',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 16px rgba(0,0,0,0.02)',
      }}>
        {/* LEFT NAV: Home, About, Products ⌵ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 1 }}>
          <span
            onClick={() => navigate('/')}
            className="commerce-nav-link"
            style={{
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: isDark ? '#ffffff' : '#18181b',
              transition: 'opacity 0.2s',
            }}
          >
            Home
          </span>
          <span
            onClick={() => {
              navigate('/about');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="commerce-nav-link"
            style={{
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: isDark ? 'rgba(255,255,255,0.65)' : '#71717a',
              transition: 'color 0.2s',
            }}
          >
            About
          </span>
          {/* PRODUCTS MEGA DROPDOWN */}
          <Dropdown
            open={productsOpen}
            onOpenChange={setProductsOpen}
            placement="bottomLeft"
            overlayStyle={{ minWidth: 560, maxWidth: '95vw', zIndex: 1050 }}
            dropdownRender={() => (
              <div
                style={{
                  width: 560,
                  maxWidth: '92vw',
                  background: isDark ? '#111827' : '#ffffff',
                  borderRadius: 20,
                  boxShadow: isDark 
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
                    : '0 25px 50px -12px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                  padding: '18px 20px',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
                }}
              >
                {/* Header Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  marginBottom: 10,
                  borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: isDark ? '#9ca3af' : '#6b7280'
                    }}>
                      Danh mục sản phẩm
                    </span>
                  </div>
                  <span
                    onClick={() => {
                      setProductsOpen(false);
                      navigate('/shop');
                    }}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: isDark ? '#34d399' : '#059669',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Xem tất cả <RightOutlined style={{ fontSize: 10 }} />
                  </span>
                </div>

                {/* 2-Column Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '6px 10px',
                }}>
                  {[
                    {
                      key: 'all',
                      title: 'Tất cả sản phẩm',
                      desc: 'Toàn bộ 34.000+ thiết bị',
                      icon: '🛍️',
                      path: '/shop'
                    },
                    ...navCategories.map(cat => ({
                      key: cat.id,
                      title: cat.name,
                      desc: cat.desc,
                      icon: cat.icon || '📦',
                      path: `/shop?category=${cat.id}`
                    }))
                  ].map((item) => (
                    <div
                      key={item.key}
                      onClick={() => {
                        setProductsOpen(false);
                        navigate(item.path);
                      }}
                      className="dropdown-menu-card-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 14,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 38,
                        height: 38,
                        minWidth: 38,
                        borderRadius: 10,
                        background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: isDark ? '#f3f4f6' : '#18181b',
                          lineHeight: 1.3,
                          marginBottom: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.title}
                        </div>
                        <div style={{
                          fontSize: 11.5,
                          color: isDark ? '#9ca3af' : '#71717a',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.desc}
                        </div>
                      </div>
                      <RightOutlined className="item-arrow" style={{
                        fontSize: 10,
                        color: isDark ? '#6b7280' : '#a1a1aa',
                        opacity: 0,
                        transition: 'all 0.2s ease',
                        transform: 'translateX(-4px)',
                        flexShrink: 0
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          >
            <span
              className="commerce-nav-link"
              style={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: productsOpen 
                  ? (isDark ? '#ffffff' : '#000000') 
                  : (isDark ? 'rgba(255,255,255,0.65)' : '#71717a'),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'color 0.2s',
              }}
            >
              Products <DownOutlined style={{
                fontSize: 10,
                opacity: 0.7,
                transform: productsOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease'
              }} />
            </span>
          </Dropdown>
        </div>

        {/* CENTER: GetShopy Brand */}
        <div 
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.3px',
            color: isDark ? '#ffffff' : '#111111',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          GetShopy
        </div>

        {/* RIGHT NAV: Pages ⌵, Contact, User, Bag, Theme */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 22, flex: 1 }}>
          {/* PAGES DROPDOWN */}
          <Dropdown
            open={pagesOpen}
            onOpenChange={setPagesOpen}
            placement="bottomRight"
            overlayStyle={{ minWidth: 290, zIndex: 1050 }}
            dropdownRender={() => (
              <div
                style={{
                  width: 290,
                  background: isDark ? '#111827' : '#ffffff',
                  borderRadius: 18,
                  boxShadow: isDark 
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
                    : '0 25px 50px -12px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                  padding: '14px 16px',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
                }}
              >
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  paddingBottom: 8,
                  marginBottom: 6,
                  borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                }}>
                  Điều hướng nhanh
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    {
                      key: 'shop',
                      title: 'Cửa hàng (Shop Catalog)',
                      desc: 'Duyệt tất cả sản phẩm & bộ lọc',
                      icon: <ShoppingOutlined style={{ fontSize: 16, color: '#10b981' }} />,
                      iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                      path: '/shop'
                    },
                    {
                      key: 'best',
                      title: 'Sản phẩm bán chạy',
                      desc: 'Top thiết bị mua nhiều nhất',
                      icon: <FireOutlined style={{ fontSize: 16, color: '#ef4444' }} />,
                      iconBg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                      path: '/shop?sort=bestseller'
                    },
                    {
                      key: 'compare',
                      title: 'So sánh thiết bị',
                      desc: 'Đối chiếu thông số kỹ thuật',
                      icon: <SwapOutlined style={{ fontSize: 16, color: '#3b82f6' }} />,
                      iconBg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                      path: '/compare'
                    },
                    {
                      key: 'account',
                      title: 'Đơn hàng & Tài khoản',
                      desc: 'Lịch sử mua sắm & tích điểm',
                      icon: <UserOutlined style={{ fontSize: 16, color: '#8b5cf6' }} />,
                      iconBg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f5f3ff',
                      path: '/account'
                    }
                  ].map((item) => (
                    <div
                      key={item.key}
                      onClick={() => {
                        setPagesOpen(false);
                        navigate(item.path);
                      }}
                      className="dropdown-menu-card-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '9px 10px',
                        borderRadius: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 34,
                        height: 34,
                        minWidth: 34,
                        borderRadius: 9,
                        background: item.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isDark ? '#f3f4f6' : '#18181b',
                          lineHeight: 1.3,
                          marginBottom: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.title}
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: isDark ? '#9ca3af' : '#71717a',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.desc}
                        </div>
                      </div>
                      <RightOutlined className="item-arrow" style={{
                        fontSize: 9,
                        color: isDark ? '#6b7280' : '#a1a1aa',
                        opacity: 0,
                        transition: 'all 0.2s ease',
                        transform: 'translateX(-4px)',
                        flexShrink: 0
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          >
            <span
              className="commerce-nav-link"
              style={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: pagesOpen 
                  ? (isDark ? '#ffffff' : '#000000') 
                  : (isDark ? 'rgba(255,255,255,0.65)' : '#71717a'),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'color 0.2s',
              }}
            >
              Pages <DownOutlined style={{
                fontSize: 10,
                opacity: 0.7,
                transform: pagesOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease'
              }} />
            </span>
          </Dropdown>

          <span
            onClick={() => {
              const el = document.getElementById('footer-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="commerce-nav-link"
            style={{
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: isDark ? 'rgba(255,255,255,0.65)' : '#71717a',
              transition: 'color 0.2s',
            }}
          >
            Contact
          </span>

          {/* User Icon & Dropdown */}
          {currentUser ? (
            <Dropdown
              dropdownRender={() => (
                <div
                  style={{
                    minWidth: 260,
                    background: isDark ? '#18181b' : '#ffffff',
                    borderRadius: 20,
                    padding: '12px',
                    boxShadow: isDark
                      ? '0 20px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)'
                      : '0 20px 40px -8px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.08)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  {/* User Profile Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5'}` }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: isDark ? '#27272a' : '#18181b',
                        color: '#ffffff',
                        border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#18181b'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <UserOutlined style={{ fontSize: 20, color: '#ffffff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: isDark ? '#ffffff' : '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentUser.full_name || 'Khách hàng'}
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentUser.email || 'customer@getshopy.vn'}
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div
                      onClick={() => navigate('/account')}
                      className="user-dropdown-custom-item"
                      style={{
                        color: isDark ? '#e4e4e7' : '#27272a',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <UserOutlined style={{ fontSize: 16, color: isDark ? '#a1a1aa' : '#52525b' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('nav.my_account')}</div>
                        <div style={{ fontSize: 11, color: isDark ? '#71717a' : '#a1a1aa' }}>Hồ sơ & thông tin tài khoản</div>
                      </div>
                    </div>

                    <div
                      onClick={() => navigate('/account?tab=orders')}
                      className="user-dropdown-custom-item"
                      style={{
                        color: isDark ? '#e4e4e7' : '#27272a',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <ShoppingOutlined style={{ fontSize: 16, color: isDark ? '#a1a1aa' : '#52525b' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('account.my_orders') || 'Đơn hàng của tôi'}</div>
                        <div style={{ fontSize: 11, color: isDark ? '#71717a' : '#a1a1aa' }}>Quản lý đơn mua & hóa đơn</div>
                      </div>
                    </div>

                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5', margin: '4px 2px' }} />

                    <div
                      onClick={() => { b2cLogout(); logout(); message.success(t('nav.logged_out_success')); navigate('/'); }}
                      className="user-dropdown-custom-item"
                      style={{
                        color: '#ef4444',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogoutOutlined style={{ fontSize: 16, color: '#ef4444' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('nav.logout')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              placement="bottomRight"
              trigger={['hover', 'click']}
            >
              <div
                style={{
                  position: 'relative',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: isDark ? '#27272a' : '#18181b',
                  color: '#ffffff',
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#18181b'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.15)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.15)';
                }}
              >
                <UserOutlined style={{ fontSize: 17, color: '#ffffff' }} />
                {/* Active online dot */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: '#10b981',
                    border: `1.5px solid ${isDark ? '#09090b' : '#ffffff'}`,
                  }}
                />
              </div>
            </Dropdown>
          ) : (
            <div
              onClick={() => openAuthModal()}
              title="Đăng nhập / Tài khoản"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.25)' : '#27272a'}`,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: isDark ? '#ffffff' : '#18181b',
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.borderColor = '#18181b'; 
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.25)' : '#27272a'; 
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <UserOutlined style={{ fontSize: 17 }} />
            </div>
          )}

          {/* Shopping Bag Icon with Badge */}
          <div
            onClick={() => setCartOpen(true)}
            style={{
              position: 'relative',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              color: isDark ? '#ffffff' : '#18181b',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <ShoppingOutlined style={{ fontSize: 22 }} />
            {cartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 0,
                background: '#000000',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: `1.5px solid ${isDark ? '#090d16' : '#ffffff'}`,
              }}>
                {cartCount}
              </span>
            )}
          </div>

          {/* Theme toggle */}
          <div
            onClick={toggleTheme}
            title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isDark ? '#facc15' : '#71717a',
              transition: 'all 0.2s',
            }}
          >
            {isDark ? <SunOutlined style={{ fontSize: 16 }} /> : <MoonOutlined style={{ fontSize: 16 }} />}
          </div>
        </div>
      </Header>
      <style>{`
        .commerce-nav-link:hover { color: ${isDark ? '#fff' : '#000'} !important; opacity: 1 !important; }
        .commerce-nav-link { position: relative; display: inline-flex; align-items: center; }
        .dropdown-menu-card-item {
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dropdown-menu-card-item:hover {
          background: ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#f4f4f6'} !important;
          transform: translateY(-1px);
        }
        .dropdown-menu-card-item:hover .item-arrow {
          opacity: 1 !important;
          transform: translateX(0) !important;
          color: #10b981 !important;
        }
        .dropdown-menu-card-item:active {
          transform: scale(0.98);
        }
      `}</style>
      <style>{`
        .minimal-nav-link:hover { color: ${isDark ? '#fff' : '#000'} !important; }
        .minimal-nav-link { position: relative; display: inline-block; }
        .minimal-nav-link::after {
          content: ''; position: absolute; width: 0; height: 1.5px; bottom: -4px; left: 0;
          background-color: ${isDark ? '#fff' : '#000'}; transition: width 0.3s ease;
        }
        .minimal-nav-link:hover::after { width: 100%; }
        @media (max-width: 900px) {
          .store-nav-links { display: none !important; }
        }
      `}</style>

      <Content style={{ padding: 0, width: '100%', position: 'relative', zIndex: 1 }}>
        <Outlet />
      </Content>

      <Footer id="footer-section" style={{ 
        background: isDark ? '#05070e' : '#0c0f17', 
        color: '#fff', 
        padding: '64px 24px 32px', 
        marginTop: 64,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'}`
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Row gutter={[48, 32]}>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 16 }}>GetShopy</div>
              <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, fontSize: 14 }}>
                High-quality tech gadgets & minimalist accessories engineered for simplicity, utility, and refined aesthetics.
              </p>
              <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
                {/* Mock Social Icons */}
                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>F</div>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>I</div>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Y</div>
              </div>
            </Col>
            <Col xs={12} md={5}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#10b981' }}>{t('footer.about')}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li 
                  onClick={() => {
                    navigate('/about');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                >
                  {t('footer.about_intro')}
                </li>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.careers')}</li>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.terms')}</li>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.privacy')}</li>
              </ul>
            </Col>
            <Col xs={12} md={5}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#10b981' }}>{t('footer.support')}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.help_center')}</li>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.refund')}</li>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.customer_service')}</li>
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.warranty_policy')}</li>
              </ul>
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#10b981' }}>{t('footer.download_app')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                  App Store
                </div>
                <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                  Google Play
                </div>
              </div>
            </Col>
          </Row>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 48, paddingTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
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
  );
}
