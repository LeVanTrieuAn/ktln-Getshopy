import { Layout, Badge, Input, Button, Drawer, Row, Col, Checkbox, InputNumber, Dropdown, message, Avatar } from 'antd';
import { ShoppingOutlined, SearchOutlined, ShoppingCartOutlined, UserOutlined, FireOutlined, LogoutOutlined, SwapOutlined, FileSearchOutlined, TagOutlined, HomeOutlined, AppstoreOutlined, EnvironmentOutlined, DownOutlined } from '@ant-design/icons';
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
  const searchRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await api.b2c.getProducts('ALL', searchKeyword, 'newest');
        setSearchResults(results.slice(0, 5)); // Show max 5 results
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

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
        width: '80%',
        maxWidth: 1200,
        padding: '0 24px',
        background: isDark ? 'rgba(5, 8, 20, 0.25)' : 'rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)'}`,
        borderRadius: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        lineHeight: '52px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* LOGO */}
        <div 
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #10b981, #047857)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            <ShoppingOutlined style={{ color: '#fff' }} />
          </div>
          <div style={{ color: isDark ? '#fff' : '#1a1a1a', fontWeight: 800, fontSize: 17, lineHeight: 1 }}>Getshopy</div>
        </div>

        {/* NAV LINKS */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 12px' }}>
          {[
            { label: 'Trang chủ', path: '/' },
            { label: 'Sản phẩm', path: '/shop' },
            { label: 'Bán chạy', path: '/shop?sort=bestseller' },
            { label: 'Khuyến mãi', path: '/shop?sort=discount' },
            { label: 'Danh mục', path: '/shop' },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => navigate(item.path)}
              style={{
                padding: '6px 14px',
                borderRadius: 30,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)',
                transition: 'all 0.25s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
                e.currentTarget.style.color = '#10b981';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)';
              }}
            >
              {item.label}
            </div>
          ))}
        </nav>

        {/* RIGHT SECTION: Search + Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          
          {/* COMPACT SEARCH */}
          <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Input 
              size="small"
              placeholder="Tìm kiếm..."
              prefix={<SearchOutlined style={{ color: '#888', fontSize: 14 }} />}
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => { if (searchKeyword) setShowSearchDropdown(true); }}
              onPressEnter={(e) => {
                setShowSearchDropdown(false);
                if (e.target.value.trim()) {
                  navigate(`/shop?search=${encodeURIComponent(e.target.value.trim())}`);
                } else {
                  navigate('/shop');
                }
              }}
              style={{ 
                width: 150,
                borderRadius: 30,
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: 'none',
                color: isDark ? '#fff' : '#000',
                height: 34,
                fontSize: 12,
              }}
            />
            
            {/* LIVE SEARCH DROPDOWN */}
            {showSearchDropdown && (searchKeyword.trim() !== '') && (
              <div style={{
                position: 'absolute', top: 42, left: 0, right: 0, minWidth: 300,
                background: isDark ? '#1e293b' : '#fff',
                borderRadius: 16,
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
                zIndex: 1000,
                overflow: 'hidden'
              }}>
                {isSearching ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>Đang tìm kiếm...</div>
                ) : searchResults.length > 0 ? (
                  <div>
                    {searchResults.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          navigate(`/product/${p.id}`);
                          setSearchKeyword('');
                        }}
                        style={{
                          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                          cursor: 'pointer', borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f0f0f0',
                          color: isDark ? '#fff' : '#000'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <img src={p.image || (p.images && p.images[0])} alt={p.name} style={{ width: 40, height: 40, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                          <div style={{ color: '#10b981', fontSize: 13, fontWeight: 700 }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>
                    ))}
                    <div 
                      onClick={() => {
                        setShowSearchDropdown(false);
                        navigate(`/shop?search=${encodeURIComponent(searchKeyword.trim())}`);
                      }}
                      style={{ padding: 12, textAlign: 'center', color: '#10b981', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {t('nav.search_results_for')} "{searchKeyword}"
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>{t('nav.no_results')}</div>
                )}
              </div>
            )}
          </div>

          {/* CART ICON */}
          <Badge count={cartCount} showZero={false} color="#10b981" size="small">
            <Button 
              type="text" 
              icon={<ShoppingCartOutlined style={{ fontSize: 18, color: isDark ? '#fff' : '#333' }} />} 
              onClick={() => setCartOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 34, width: 34, padding: 0, borderRadius: 30 }}
            />
          </Badge>

          {/* DIVIDER */}
          <div style={{ width: 1, height: 24, background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

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
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, height: 34 }}>
                <Avatar 
                  src={currentUser.avatar ? currentUser.avatar.replace('notionists', 'avataaars') : (`https://api.dicebear.com/7.x/avataaars/svg?seed=` + (currentUser.email || 'user'))} 
                  icon={<UserOutlined />} 
                  size={32} 
                  style={{ border: '2px solid #10b981', background: isDark ? '#1e293b' : '#fff' }} 
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#fff' : '#000', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.full_name || currentUser.name || currentUser.email}
                </span>
              </div>
            </Dropdown>
          ) : (
            <>
              <div
                onClick={() => setAuthOpen(true)}
                style={{
                  padding: '5px 16px',
                  borderRadius: 30,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isDark ? '#fff' : '#000',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                  lineHeight: 'normal',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Đăng ký
              </div>
              <div
                onClick={() => setAuthOpen(true)}
                style={{
                  padding: '5px 20px',
                  borderRadius: 30,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  color: isDark ? '#fff' : '#000',
                  background: 'transparent',
                  border: isDark ? '1.5px solid rgba(255,255,255,0.7)' : '1.5px solid #000',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                  lineHeight: 'normal',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Đăng nhập
              </div>
            </>
          )}
        </div>
      </Header>
      <style>{`
        .nav-link:hover { color: #10b981 !important; }
        .nav-link { position: relative; }
        .nav-link::after {
          content: ''; position: absolute; width: 0; height: 2px; bottom: -8px; left: 0;
          background-color: #10b981; transition: width 0.3s;
        }
        .nav-link:hover::after { width: 100%; }
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
