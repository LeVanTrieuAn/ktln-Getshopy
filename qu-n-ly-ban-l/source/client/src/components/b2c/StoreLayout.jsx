import { Layout, Badge, Input, Button, Drawer, Row, Col, Checkbox, InputNumber, Dropdown, message, Avatar } from 'antd';
import { ShoppingOutlined, SearchOutlined, ShoppingCartOutlined, UserOutlined, FireOutlined, LogoutOutlined, SwapOutlined, FileSearchOutlined, TagOutlined, HomeOutlined, AppstoreOutlined, EnvironmentOutlined, DownOutlined, RobotOutlined, BulbOutlined, CameraOutlined } from '@ant-design/icons';
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
  const { isDark, toggleTheme, bg, compareList, lang, toggleLang, t, b2cUser, user, b2cLogout, logout, selectedBranch, setSelectedBranch } = useApp();
  const currentUser = b2cUser || user;
  const { cart, removeFromCart, cartTotal, cartCount, toggleSelect, toggleSelectAll, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  
  // Auth Modal State
  const [authOpen, setAuthOpen] = useState(false);

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
    <Layout style={{ minHeight: '100vh', background: bg }}>
      <div className="ambient-glow" />
      <Header style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: '90%',
        maxWidth: 1400,
        padding: '0 32px',
        background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        borderRadius: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        lineHeight: '64px',
        boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.03)',
        overflow: 'visible',
      }}>
        {/* LOGO */}
        <div 
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{
            width: 32, height: 32,
            background: isDark ? '#fff' : '#000',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            <ShoppingOutlined style={{ color: isDark ? '#000' : '#fff' }} />
          </div>
          <div style={{ color: isDark ? '#fff' : '#111', fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px', lineHeight: 1 }}>Getshopy.</div>
        </div>

        {/* NAV LINKS */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24, margin: '0 24px' }}>
          {[
            { label: 'Trang chủ', path: '/' },
            { label: 'Sản phẩm', path: '/shop' },
            { label: 'Bán chạy', path: '/shop?sort=bestseller' },
            { label: 'Khuyến mãi', path: '/shop?sort=discount' },
            { label: 'Danh mục', path: '/shop' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.path}
              onClick={(e) => { e.preventDefault(); navigate(item.path); }}
              className="minimal-nav-link"
              style={{
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* RIGHT SECTION: Search + Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          
          {/* FULL SEARCH BAR */}
          <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: searchImageBase64 ? 290 : 240,
              height: 38,
              borderRadius: 19,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${searchImageBase64 ? '#10b981' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)')}`,
              transition: 'border-color 0.2s ease, background 0.2s ease, width 0.25s ease',
              boxShadow: searchImageBase64 ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none',
            }}>
              {/* Search Icon */}
              <div style={{ minWidth: 36, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SearchOutlined style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }} />
              </div>

              {/* Thumbnail ảnh khi đã chọn */}
              {searchImageBase64 && (
                <div style={{ position: 'relative', flexShrink: 0, marginRight: 5 }}>
                  <img
                    src={searchImageBase64}
                    alt="search img"
                    style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'cover', border: '1.5px solid #10b981', display: 'block' }}
                  />
                  <div
                    onClick={clearSearchImage}
                    style={{
                      position: 'absolute', top: -5, right: -5,
                      width: 13, height: 13, borderRadius: '50%',
                      background: '#ef4444', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, cursor: 'pointer', fontWeight: 900,
                      border: '1px solid #fff', lineHeight: 1,
                    }}
                  >✕</div>
                </div>
              )}

              {/* Text input */}
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchImageBase64 ? 'Thêm mô tả (tùy chọn)...' : 'Tìm kiếm...'}
                value={searchKeyword}
                onChange={(e) => { setSearchKeyword(e.target.value); setShowSearchDropdown(true); }}
                onFocus={(e) => {
                  setShowSearchDropdown(true);
                  e.currentTarget.parentElement.style.borderColor = searchImageBase64 ? '#10b981' : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)');
                  e.currentTarget.parentElement.style.background = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
                }}
                onBlur={(e) => {
                  e.currentTarget.parentElement.style.borderColor = searchImageBase64 ? '#10b981' : '';
                  e.currentTarget.parentElement.style.background = '';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowSearchDropdown(false);
                    if (searchImageBase64) {
                      navigate(`/shop?search=${encodeURIComponent(searchKeyword.trim() || '__image__')}`);
                    } else if (searchKeyword.trim()) {
                      navigate(`/shop?search=${encodeURIComponent(searchKeyword.trim())}`);
                    } else { navigate('/shop'); }
                  }
                  if (e.key === 'Escape') { setSearchKeyword(''); setShowSearchDropdown(false); clearSearchImage(); }
                }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
                  paddingRight: 2, minWidth: 0,
                }}
              />

              {/* Nút camera */}
              <input
                ref={searchImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleSearchImageSelect}
              />
              <div
                onClick={() => searchImageInputRef.current?.click()}
                title="Tìm kiếm bằng hình ảnh"
                style={{
                  minWidth: 30, height: 30, marginRight: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                  background: searchImageBase64 ? 'rgba(16,185,129,0.2)' : 'transparent',
                  color: searchImageBase64 ? '#10b981' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'),
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)'; e.currentTarget.style.color = '#10b981'; }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = searchImageBase64 ? 'rgba(16,185,129,0.2)' : 'transparent';
                  e.currentTarget.style.color = searchImageBase64 ? '#10b981' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)');
                }}
              >
                <CameraOutlined style={{ fontSize: 14 }} />
              </div>
            </div>

            {/* DROPDOWN */}
            {(showSearchDropdown || isSearching || isAiSearching || isImageSearching) &&
              (searchKeyword.trim() !== '' || searchImageBase64) && (
              <div style={{
                position: 'absolute', top: 46, right: 0, width: 340,
                background: isDark ? '#1e293b' : '#fff',
                borderRadius: 16,
                boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 40px rgba(0,0,0,0.08)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
                zIndex: 1000, overflow: 'hidden'
              }}>

                {/* Hint header khi có ảnh */}
                {searchImageBase64 && !isImageSearching && imageSearchHint && (
                  <div style={{
                    padding: '8px 14px',
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f0',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <img src={searchImageBase64} alt="" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', border: '1px solid #10b981' }} />
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imageSearchHint}
                    </span>
                  </div>
                )}

                {/* Đang phân tích ảnh */}
                {isImageSearching && (
                  <div style={{ padding: '18px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>AI đang phân tích ảnh...</div>
                  </div>
                )}

                {/* Đang tìm kiếm thường */}
                {isSearching && !isImageSearching && (
                  <div style={{ padding: '14px 16px', textAlign: 'center', color: '#888', fontSize: 13 }}>Đang tìm kiếm...</div>
                )}

                {/* Đang hỏi AI */}
                {!isSearching && !isImageSearching && isAiSearching && (
                  <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                    <RobotOutlined style={{ fontSize: 26, marginBottom: 10, color: '#10b981' }} />
                    <div style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>Đang để AI tìm giúp bạn...</div>
                  </div>
                )}

                {/* Kết quả */}
                {!isSearching && !isAiSearching && !isImageSearching && searchResults.length > 0 && (
                  <div>
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={() => {
                          setShowSearchDropdown(false); setSearchExpanded(false);
                          navigate(`/product/${p.id}`);
                          setSearchKeyword(''); clearSearchImage();
                        }}
                        style={{
                          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                          cursor: 'pointer', borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f5f5f5',
                          color: isDark ? '#fff' : '#111'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <img src={p.image || (p.images && p.images[0])} alt={p.name} style={{ width: 40, height: 40, objectFit: 'contain', background: isDark ? '#111' : '#f5f5f5', borderRadius: 8, padding: 4, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', fontSize: 12, fontWeight: 500 }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                        </div>
                        {searchImageBase64 && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, flexShrink: 0, background: 'rgba(16,185,129,0.1)', padding: '2px 5px', borderRadius: 4 }}>AI</span>}
                      </div>
                    ))}
                    <div
                      onMouseDown={() => {
                        setShowSearchDropdown(false); setSearchExpanded(false);
                        navigate(`/shop?search=${encodeURIComponent(searchKeyword.trim() || '__image__')}`);
                      }}
                      style={{ padding: '10px 16px', textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontWeight: 500, fontSize: 13, borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f0' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {searchImageBase64
                        ? `Xem tất cả kết quả từ ảnh${searchKeyword ? ` + "${searchKeyword}"` : ''}`
                        : `Xem tất cả kết quả cho "${searchKeyword}"`}
                    </div>
                  </div>
                )}

                {/* Không có kết quả */}
                {!isSearching && !isAiSearching && !isImageSearching && searchResults.length === 0 && (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', fontSize: 13 }}>
                    {searchImageBase64 ? 'Không tìm thấy sản phẩm phù hợp với ảnh' : 'Không tìm thấy sản phẩm phù hợp'}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* CART ICON */}
          <Badge count={cartCount} showZero={false} size="small" style={{ backgroundColor: isDark ? '#fff' : '#000', color: isDark ? '#000' : '#fff', boxShadow: 'none' }}>
            <Button 
              type="text" 
              icon={<ShoppingCartOutlined style={{ fontSize: 20, color: isDark ? '#fff' : '#111' }} />} 
              onClick={() => setCartOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38, width: 38, padding: 0, borderRadius: '50%' }}
            />
          </Badge>

          {/* DIVIDER */}
          <div style={{ width: 1, height: 20, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', margin: '0 8px' }} />

          {/* SIGN UP & LOGIN */}
          {currentUser ? (
            <Dropdown
              menu={{
                items: [
                  { key: '1', label: t('nav.my_account'), icon: <UserOutlined />, onClick: () => navigate('/account') },
                  { key: '2', label: t('nav.switch_account'), icon: <SwapOutlined />, onClick: () => { b2cLogout(); logout(); setAuthOpen(true); } },
                  { key: '3', label: t('nav.logout'), icon: <LogoutOutlined />, onClick: () => { b2cLogout(); logout(); message.success(t('nav.logged_out_success')); navigate('/'); } }
                ]
              }}
              placement="bottomRight"
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                <Avatar 
                  src={currentUser.avatar ? currentUser.avatar.replace('notionists', 'avataaars') : (`https://api.dicebear.com/7.x/avataaars/svg?seed=` + (currentUser.email || 'user'))} 
                  icon={<UserOutlined />} 
                  size={32} 
                  style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? '#1e293b' : '#fff' }} 
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#fff' : '#111', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.full_name || currentUser.name || currentUser.email}
                </span>
              </div>
            </Dropdown>
          ) : (
            <>
              {/* Nút Đăng ký — ghost/outline */}
              <div
                onClick={() => setAuthOpen(true)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'}`,
                  background: 'transparent',
                  transition: 'all 0.2s ease',
                  lineHeight: '20px',
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = isDark ? '#fff' : '#000';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Đăng ký
              </div>

              {/* Nút Đăng nhập — green gradient solid */}
              <div
                onClick={() => setAuthOpen(true)}
                style={{
                  padding: '7px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  lineHeight: '20px',
                  letterSpacing: '0.01em',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.45)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Đăng nhập
              </div>
            </>
          )}
        </div>
      </Header>
      <style>{`
        .minimal-nav-link:hover { color: ${isDark ? '#fff' : '#000'} !important; }
        .minimal-nav-link { position: relative; display: inline-block; }
        .minimal-nav-link::after {
          content: ''; position: absolute; width: 0; height: 1.5px; bottom: -4px; left: 0;
          background-color: ${isDark ? '#fff' : '#000'}; transition: width 0.3s ease;
        }
        .minimal-nav-link:hover::after { width: 100%; }
      `}</style>

      <Content style={{ padding: 0, width: '100%', position: 'relative', zIndex: 1 }}>
        <Outlet />
      </Content>

      <Footer style={{ 
        background: isDark ? '#000' : '#111', 
        color: '#fff', 
        padding: '64px 24px 24px', 
        marginTop: 64 
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Row gutter={[48, 32]}>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 16 }}>Getshopy</div>
              <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                {t('footer.description')}
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
                <li style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>{t('footer.about_intro')}</li>
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
        title={t('cart.title')}
        placement="right"
        onClose={() => setCartOpen(false)}
        open={cartOpen}
        width={400}
        styles={{ 
          body: { paddingBottom: 80, background: isDark ? '#111827' : '#fff' },
          header: { background: isDark ? '#111827' : '#fff', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}` }
        }}
      >
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 100, color: '#888' }}>{t('cart.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: isDark ? '1px solid #333' : '1px solid #eee' }}>
              <Checkbox 
                checked={cart.length > 0 && cart.every(i => i.selected)} 
                onChange={(e) => toggleSelectAll(e.target.checked)}
              >
                <span style={{ color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{t('cart.select_all')} ({cart.length})</span>
              </Checkbox>
            </div>
            {cart.map((item, idx) => (
              <div key={`${item.id}-${item.selectedVariant?.id || idx}`} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Checkbox checked={item.selected} onChange={() => toggleSelect(item.id, item.selectedVariant?.id)} />
                <img src={item.selectedVariant?.image || (item.images && item.images.length > 0 ? item.images[0] : item.image)} alt={item.name} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, background: isDark ? '#222' : '#f9f9f9', padding: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: isDark ? '#fff' : '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  {item.selectedVariant && (
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                      {t('cart.variant')}: {item.selectedVariant.color} {item.selectedVariant.storage ? `- ${item.selectedVariant.storage}` : ''}
                    </div>
                  )}
                  <div style={{ color: '#10b981', fontWeight: 700 }}>{item.price.toLocaleString('vi-VN')} đ</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <InputNumber min={1} max={item.selectedVariant?.stock ?? item.stock} value={item.quantity} onChange={(val) => updateQuantity(item.id, item.selectedVariant?.id, val)} size="small" style={{ width: 60 }} />
                    <Button danger type="text" size="small" onClick={() => removeFromCart(item.id, item.selectedVariant?.id)}>{t('cart.remove')}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {cart.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, width: '100%',
            padding: 24, background: isDark ? '#1f2937' : '#f9fafb',
            borderTop: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, color: isDark ? '#aaa' : '#555' }}>{t('cart.total')}:</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{cartTotal.toLocaleString('vi-VN')} đ</span>
            </div>
            <Button type="primary" block size="large" onClick={() => { 
              if (!b2cUser) {
                setCartOpen(false);
                setAuthOpen(true);
                message.warning('Vui lòng đăng nhập để tiến hành đặt hàng');
              } else {
                setCartOpen(false); 
                navigate('/checkout'); 
              }
            }}
              style={{ background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none', height: 48, borderRadius: 12, fontWeight: 700, fontSize: 16 }}>
              {t('cart.checkout')}
            </Button>
          </div>
        )}
      </Drawer>

      {/* CHATBOT */}
      <AIChatbot />

      {/* AUTH MODAL */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </Layout>
  );
}
