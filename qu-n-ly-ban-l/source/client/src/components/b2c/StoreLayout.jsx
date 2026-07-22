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
  const { isDark, toggleTheme, bg, compareList, lang, toggleLang, t, b2cUser, b2cLogout, selectedBranch, setSelectedBranch } = useApp();
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
      if (data && data.length > 0) setBranches(data);
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
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        padding: '0 24px',
        background: isDark ? 'rgba(5, 8, 20, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 72,
      }}>
        {/* LOGO */}
        <div 
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #10b981, #047857)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            <ShoppingOutlined style={{ color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ color: isDark ? '#fff' : '#1a1a1a', fontWeight: 800, fontSize: 20, lineHeight: 1, marginBottom: 2 }}>Getshopy</div>
            <div style={{ color: isDark ? '#10b981' : '#047857', fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, lineHeight: 1 }}>STORE</div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div ref={searchRef} style={{ flex: 1, maxWidth: 600, margin: '0 40px', position: 'relative' }}>
          <Input 
            size="large"
            placeholder={t('nav.search_placeholder')}
            prefix={<SearchOutlined style={{ color: '#888' }} />}
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
              borderRadius: 20,
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: isDark ? '#fff' : '#000'
            }}
          />
          
          {/* LIVE SEARCH DROPDOWN */}
          {showSearchDropdown && (searchKeyword.trim() !== '') && (
            <div style={{
              position: 'absolute', top: 48, left: 0, right: 0,
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

        {/* ICONS */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          
          {/* THEME TOGGLE */}
          <Button 
            type="text" 
            icon={isDark ? <SunOutlined style={{ fontSize: 22, color: '#fff' }} /> : <MoonOutlined style={{ fontSize: 22, color: '#333' }} />} 
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, width: 40, padding: 0 }}
          />

          {/* BRANCH SELECTOR DROPDOWN */}
          <Dropdown
            menu={{
              items: branches.map(b => ({
                key: b.id,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                    <EnvironmentOutlined style={{ color: selectedBranch?.id === b.id ? '#10b981' : '#888' }} />
                    <span style={{ fontWeight: selectedBranch?.id === b.id ? 700 : 400, color: selectedBranch?.id === b.id ? '#10b981' : undefined }}>
                      {b.name}
                    </span>
                  </div>
                ),
                onClick: () => {
                  setSelectedBranch(b);
                  message.success(`Đã chuyển sang chi nhánh: ${b.name}`);
                }
              }))
            }}
            placement="bottomLeft"
          >
            <Button
              type="text"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 40,
                padding: '0 16px',
                borderRadius: 20,
                background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: isDark ? '#fff' : '#1a1a1a',
                fontWeight: 600,
                fontSize: 13
              }}
            >
              <EnvironmentOutlined style={{ color: '#10b981', fontSize: 16 }} />
              <span>{selectedBranch?.name || 'HCM - Quận 1'}</span>
              <DownOutlined style={{ fontSize: 10, color: '#888' }} />
            </Button>
          </Dropdown>

          {b2cUser ? (
            <Dropdown
              menu={{
                items: [
                  { key: '1', label: t('nav.my_account'), icon: <UserOutlined />, onClick: () => navigate('/account') },
                  { key: '2', label: t('nav.switch_account'), icon: <SwapOutlined />, onClick: () => { b2cLogout(); setAuthOpen(true); } },
                  { key: '3', label: t('nav.logout'), icon: <LogoutOutlined />, onClick: () => { b2cLogout(); message.success(t('nav.logged_out_success')); navigate('/'); } }
                ]
              }}
              placement="bottomRight"
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, height: 40 }}>
                <Avatar 
                  src={b2cUser.avatar ? b2cUser.avatar.replace('notionists', 'avataaars') : (`https://api.dicebear.com/7.x/avataaars/svg?seed=` + b2cUser.email)} 
                  icon={<UserOutlined />} 
                  size={40} 
                  style={{ border: '2px solid #10b981', background: isDark ? '#1e293b' : '#fff' }} 
                />
                <div style={{ display: 'none', flexDirection: 'column', '@media (minWidth: 768px)': { display: 'flex' } }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fff' : '#000', lineHeight: 1 }}>{b2cUser.full_name}</span>
                </div>
              </div>
            </Dropdown>
          ) : (
            <Button 
              type="primary" 
              icon={<UserOutlined />} 
              onClick={() => setAuthOpen(true)}
              style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, fontWeight: 600, height: 40 }}
            >
              {t('nav.login')}
            </Button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', height: 40 }}>
            <Badge count={cartCount} showZero={false} color="#10b981">
              <Button 
                type="text" 
                icon={<ShoppingCartOutlined style={{ fontSize: 24, color: isDark ? '#fff' : '#333' }} />} 
                onClick={() => setCartOpen(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, width: 40, padding: 0 }}
              />
            </Badge>
          </div>
        </div>
      </Header>

      {/* CATEGORY NAVIGATION TABS */}
      <div style={{ 
        background: isDark ? '#0f172a' : '#fff', 
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#eee'}`,
        padding: '0 24px',
        position: 'relative',
        zIndex: 40,
        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.02)'
      }}>
        <div style={{ 
          maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 32, overflowX: 'auto', 
          whiteSpace: 'nowrap', padding: '16px 0', alignItems: 'center',
          scrollbarWidth: 'none' /* hide scrollbar firefox */
        }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', fontWeight: 600, color: isDark ? '#fff' : '#111', fontSize: 15, transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 6 }} className="nav-link">
            <HomeOutlined style={{ color: '#3b82f6' }} /> {t('nav.home')}
          </div>
          <div onClick={() => navigate('/shop')} style={{ cursor: 'pointer', fontWeight: 600, color: isDark ? '#fff' : '#111', fontSize: 15, transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 6 }} className="nav-link">
            <AppstoreOutlined style={{ color: '#ec4899' }} /> {t('nav.products')}
          </div>
          <div onClick={() => navigate('/account')} style={{ cursor: 'pointer', fontWeight: 600, color: isDark ? '#fff' : '#111', fontSize: 15, transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 6 }} className="nav-link">
            <FileSearchOutlined style={{ color: '#10b981' }} /> {t('nav.order_lookup')}
          </div>
          <div onClick={() => navigate('/compare')} style={{ cursor: 'pointer', fontWeight: 600, color: isDark ? '#fff' : '#111', fontSize: 15, transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 6 }} className="nav-link">
            <SwapOutlined style={{ color: '#8b5cf6' }} /> {t('nav.compare_products')}
          </div>
          <div onClick={() => navigate('/shop')} style={{ cursor: 'pointer', fontWeight: 600, color: isDark ? '#fff' : '#111', fontSize: 15, transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 6 }} className="nav-link">
            <TagOutlined style={{ color: '#f59e0b' }} /> {t('nav.hot_deals')}
          </div>
          
          <div style={{ flex: 1 }}></div>
          
          {/* Highlight Tags */}
          {hasFlashSale && (
            <div onClick={() => navigate('/')} style={{ cursor: 'pointer', fontWeight: 700, color: '#ef4444', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FireOutlined /> {t('nav.flash_sale_happening')}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .nav-link:hover { color: #10b981 !important; }
        .nav-link { position: relative; }
        .nav-link::after {
          content: ''; position: absolute; width: 0; height: 2px; bottom: -8px; left: 0;
          background-color: #10b981; transition: width 0.3s;
        }
        .nav-link:hover::after { width: 100%; }
      `}</style>

      <Content style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
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
