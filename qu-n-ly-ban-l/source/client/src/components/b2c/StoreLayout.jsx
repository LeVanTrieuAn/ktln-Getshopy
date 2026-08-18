import { Layout, Badge, Input, Button, Drawer, Row, Col, Checkbox, InputNumber, Dropdown, message, Avatar } from 'antd';
import { ShoppingOutlined, SearchOutlined, ShoppingCartOutlined, UserOutlined, FireOutlined, LogoutOutlined, SwapOutlined, FileSearchOutlined, TagOutlined, HomeOutlined, AppstoreOutlined, EnvironmentOutlined, DownOutlined, RobotOutlined, BulbOutlined } from '@ant-design/icons';
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
  const [isAiSearch, setIsAiSearch] = useState(false);    // true khi đang hiện kết quả AI
  const [aiHint, setAiHint] = useState('');               // nhãn giải thích từ AI
  const [offerAiSearch, setOfferAiSearch] = useState(false); // hiện "để AI tìm giúp" button
  const [isAiSearching, setIsAiSearching] = useState(false);  // đang chạy AI search
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

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
    if (!searchKeyword) {
      setSearchExpanded(false);
      setShowSearchDropdown(false);
    }
  };

  // Hàm gọi AI search khi user chủ động bấm nút
  const handleAiSearch = async () => {
    if (!searchKeyword.trim()) return;
    setOfferAiSearch(false);
    setIsAiSearching(true);
    try {
      const aiResult = await api.ai.smartSearch(searchKeyword);
      if (aiResult && aiResult.products && aiResult.products.length > 0) {
        setSearchResults(aiResult.products.slice(0, 5));
        setIsAiSearch(true);
        setAiHint(aiResult.hint || 'Kết quả từ AI');
      } else {
        setIsAiSearch(true);
        setAiHint('AI cũng không tìm thấy sản phẩm phù hợp');
      }
    } catch (err) {
      console.warn('[SmartSearch] AI failed:', err.message);
    } finally {
      setIsAiSearching(false);
    }
  };

  // Debounced normal search only
  useEffect(() => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      setIsAiSearch(false);
      setAiHint('');
      setOfferAiSearch(false);
      return;
    }
    setIsAiSearch(false);
    setAiHint('');
    setOfferAiSearch(false);
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await api.b2c.getProducts('ALL', searchKeyword, 'newest');
        const top5 = (results || []).slice(0, 5);
        setSearchResults(top5);
        // Nếu 0 kết quả → đề xuất AI (user tự chọn)
        if (top5.length === 0) setOfferAiSearch(true);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKeyword]);


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
              width: 240,
              height: 38,
              borderRadius: 19,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'}`,
              transition: 'border-color 0.2s ease, background 0.2s ease',
            }}>
              {/* Icon */}
              <div style={{
                minWidth: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <SearchOutlined style={{
                  fontSize: 14,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
                }} />
              </div>
              {/* Input */}
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm kiếm..."
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={(e) => {
                  setShowSearchDropdown(true);
                  e.currentTarget.parentElement.style.borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';
                  e.currentTarget.parentElement.style.background = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
                }}
                onBlur={(e) => {
                  e.currentTarget.parentElement.style.borderColor = '';
                  e.currentTarget.parentElement.style.background = '';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowSearchDropdown(false);
                    if (searchKeyword.trim()) navigate(`/shop?search=${encodeURIComponent(searchKeyword.trim())}`);
                    else navigate('/shop');
                  }
                  if (e.key === 'Escape') {
                    setSearchKeyword('');
                    setShowSearchDropdown(false);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
                  paddingRight: 14,
                }}
              />
            </div>
            {(showSearchDropdown || offerAiSearch || isAiSearching) && (searchKeyword.trim() !== '') && (
              <div style={{
                position: 'absolute', top: 46, right: 0, width: 320,
                background: isDark ? '#1e293b' : '#fff',
                borderRadius: 16,
                boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 40px rgba(0,0,0,0.08)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
                zIndex: 1000,
                overflow: 'hidden'
              }}>

                {/* State 1: Đang tìm kiếm thường */}
                {isSearching && (
                  <div style={{ padding: '14px 16px', textAlign: 'center', color: '#888', fontSize: 13 }}>
                    Đang tìm kiếm...
                  </div>
                )}

                {/* State 2: Đang hỏi AI */}
                {isAiSearching && (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <RobotOutlined style={{ fontSize: 28, marginBottom: 12, color: isDark ? '#34d399' : '#10b981' }} />
                    <div style={{ fontSize: 13, color: isDark ? '#34d399' : '#10b981', fontWeight: 500 }}>Đang hỏi AI tìm giúp bạn...</div>
                  </div>
                )}

                {/* State 3: Không có kết quả → offer AI */}
                {!isSearching && !isAiSearching && offerAiSearch && (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <SearchOutlined style={{ fontSize: 24, marginBottom: 12, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)' }} />
                    <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', marginBottom: 4 }}>
                      Không tìm thấy kết quả nào cho
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#fff' : '#111', marginBottom: 14 }}>
                      "{searchKeyword}"
                    </div>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); handleAiSearch(); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 18px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: 20,
                        color: '#fff', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <BulbOutlined /> Để AI tìm giúp bạn
                    </button>
                  </div>
                )}

                {/* State 4: Có kết quả (thường hoặc AI) */}
                {!isSearching && !isAiSearching && !offerAiSearch && searchResults.length > 0 && (
                  <div>
                    {/* AI hint banner */}
                    {isAiSearch && aiHint && (
                      <div style={{
                        padding: '8px 14px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.07)',
                        borderBottom: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(16,185,129,0.12)',
                      }}>
                        <BulbOutlined style={{ fontSize: 14, color: isDark ? '#34d399' : '#10b981' }} />
                        <span style={{ fontSize: 12, color: isDark ? '#34d399' : '#10b981', fontWeight: 500 }}>AI: {aiHint}</span>
                      </div>
                    )}
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={() => {
                          setShowSearchDropdown(false);
                          setSearchExpanded(false);
                          navigate(`/product/${p.id}`);
                          setSearchKeyword('');
                          setIsAiSearch(false);
                          setOfferAiSearch(false);
                        }}
                        style={{
                          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                          cursor: 'pointer', borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f5f5f5',
                          color: isDark ? '#fff' : '#111'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fafafa'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <img src={p.image || (p.images && p.images[0])} alt={p.name} style={{ width: 40, height: 40, objectFit: 'contain', background: isDark ? '#111' : '#f5f5f5', borderRadius: 8, padding: 4, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', fontSize: 12, fontWeight: 500 }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>
                    ))}
                    <div
                      onMouseDown={() => {
                        setShowSearchDropdown(false);
                        setSearchExpanded(false);
                        navigate(`/shop?search=${encodeURIComponent(searchKeyword.trim())}`);
                      }}
                      style={{ padding: '10px 16px', textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontWeight: 500, fontSize: 13, borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f0' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fafafa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      Xem tất cả kết quả cho "{searchKeyword}"
                    </div>
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
              <div
                onClick={() => setAuthOpen(true)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = isDark ? '#fff' : '#000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'; }}
              >
                Đăng ký
              </div>
              <div
                onClick={() => setAuthOpen(true)}
                style={{
                  padding: '6px 20px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDark ? '#000' : '#fff',
                  background: isDark ? '#fff' : '#000',
                  border: 'none',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = 1; }}
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
