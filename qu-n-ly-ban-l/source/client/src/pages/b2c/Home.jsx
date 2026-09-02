import { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Typography, Spin, Tag, Rate, Statistic, Pagination } from 'antd';
import {
  AppstoreOutlined,
  AudioOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  CustomerServiceOutlined,
  DesktopOutlined,
  FireOutlined,
  HddOutlined,
  HomeOutlined,
  LaptopOutlined,
  LeftOutlined,
  MobileOutlined,
  PrinterOutlined,
  PlayCircleOutlined,
  RightOutlined,
  ShoppingCartOutlined,
  TabletOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';
import HeroBanner from '../../components/b2c/HeroBanner';

const { Title, Text } = Typography;
const { Timer } = Statistic;

const iconMap = {
  'MobileOutlined': <MobileOutlined />,
  'LaptopOutlined': <LaptopOutlined />,
  'TabletOutlined': <TabletOutlined />,
  'AudioOutlined': <AudioOutlined />,
  'DesktopOutlined': <DesktopOutlined />,
  'CameraOutlined': <CameraOutlined />,
  'ClockCircleOutlined': <ClockCircleOutlined />,
  'CustomerServiceOutlined': <CustomerServiceOutlined />,
  'PlayCircleOutlined': <PlayCircleOutlined />,
  'HomeOutlined': <HomeOutlined />,
  'PrinterOutlined': <PrinterOutlined />,
  'HddOutlined': <HddOutlined />,
};

export default function Home() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [categories, setCategories] = useState([]);
  const [flashSale, setFlashSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);
  const scrollContainerRef = useRef(null);
  const { addToCart } = useCart();
  const { isDark, t, selectedBranch, b2cUser } = useApp();
  const navigate = useNavigate();
  const featuredCategories = categories.filter(c => !c.parent_id).slice(0, 5);
  const rootCategories = activeCategories;

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };



  // Load initial data (categories, flash sale, top selling)
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [catData, flashData, topSellingData, activeCatData] = await Promise.all([
          api.b2c.getCategories(),
          api.b2c.getFlashSales(),
          api.b2c.getProducts('ALL', '', 'best_selling', selectedBranch?.id, 1, 10),
          api.b2c.getActiveCategories(selectedBranch?.id || '')
        ]);
        setCategories(catData);
        setFlashSale(flashData);
        setTopSellingProducts(topSellingData.data || []);
        setActiveCategories(activeCatData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedBranch]);

  // Load products by category & page
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const prodData = await api.b2c.getProducts(selectedCategory, '', 'newest', selectedBranch?.id, currentPage, 15);
        setProducts(prodData.data || []);
        setTotalProducts(prodData.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, [selectedBranch, selectedCategory, currentPage]);

  const handleCategoryTab = (catId) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
  };


  return (
    <div>
      {/* ══════════════════════════════════════════════════════════════════
           HERO BANNER — Professional GSAP (HeroBanner component)
           Nằm ngoài điều kiện loading để render ngay, triệt tiêu CLS = 1.0
         ══════════════════════════════════════════════════════════════════ */}
      <HeroBanner />

      {/* Content sections below banner */}
      <div style={{ padding: '48px 48px 0', maxWidth: 1400, margin: '0 auto' }}>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>
        ) : (
          <>

      {/* Flash Sale */}
      {flashSale && flashSale.items && flashSale.items.length > 0 && new Date(flashSale.end_time).getTime() > Date.now() && (
        <div style={{ background: 'linear-gradient(135deg, #ef4444, #991b1b)', borderRadius: 24, padding: 32, marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ThunderboltOutlined style={{ fontSize: 40, color: '#fef08a' }} />
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>{flashSale.title}</Title>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>{t('home.flash_sale_subtitle')}</div>
              </div>
            </div>
            <Timer type="countdown"
              value={new Date(flashSale.end_time).getTime()} 
              format="D [ngày] HH:mm:ss" 
              onFinish={() => setFlashSale(null)}
              valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 700, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: 12 }} 
            />
          </div>
          <Row gutter={[24, 24]}>
            {flashSale.items?.map(p => (
              <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
                <Card
                  hoverable onClick={() => navigate(`/product/${p.id}`)}
                  style={{ borderRadius: 16, overflow: 'hidden', border: 'none' }}
                  cover={
                    <div style={{ padding: 24, background: isDark ? 'rgba(0,0,0,0.3)' : '#f9f9f9', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                      <img 
                        alt={p.name} 
                        src={p.image} 
                        width={160}
                        height={160}
                        style={{ height: 160, objectFit: 'contain' }} 
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format'; }}
                      />
                      <Tag color="red" style={{ position: 'absolute', top: 12, left: 12, fontSize: 14, padding: '4px 8px', borderRadius: 8, fontWeight: 700 }}>
                        -{Math.round((1 - p.discount_price/p.original_price)*100)}%
                      </Tag>
                    </div>
                  }
                >
                  <Title level={5} style={{ margin: 0, fontSize: 16, height: 44, overflow: 'hidden' }}>{p.name}</Title>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{p.discount_price.toLocaleString('vi-VN')} đ</div>
                    <div style={{ fontSize: 14, color: '#888', textDecoration: 'line-through' }}>{p.original_price.toLocaleString('vi-VN')} đ</div>
                  </div>
                  <div style={{ background: '#fee2e2', borderRadius: 8, height: 8, marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ background: '#ef4444', height: '100%', width: `${(p.sold/p.limit)*100}%` }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{t('home.sold')} {p.sold}/{p.limit}</div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}


      {/* Top 10 Best Selling Products Section */}
      {topSellingProducts && topSellingProducts.length > 0 && (
        <div style={{
          marginBottom: 48,
          background: isDark 
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)' 
            : 'linear-gradient(135deg, #fffbeb 0%, #f0fdf4 100%)',
          borderRadius: 24,
          padding: '28px 24px',
          border: isDark ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid #fde68a',
          boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <Title level={2} style={{ 
                color: isDark ? '#fff' : '#111', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                margin: 0,
                fontSize: 24 
              }}>
                <TrophyOutlined style={{ color: '#f59e0b', fontSize: 28 }} />
                <span style={{
                  background: 'linear-gradient(135deg, #f59e0b, #10b981)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800
                }}>
                  {t('home.top_selling')}
                </span>
                <Tag color="gold" style={{ borderRadius: 12, border: 'none', fontWeight: 700, padding: '2px 10px' }}>
                  🔥 HOT
                </Tag>
              </Title>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#666', fontSize: 14 }}>
                {t('home.top_selling_subtitle')}
              </Text>
            </div>

            {/* Navigation Arrows */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleScrollLeft}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                  color: isDark ? '#fff' : '#333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#fff'; e.currentTarget.style.color = isDark ? '#fff' : '#333'; }}
              >
                <LeftOutlined />
              </button>
              <button
                onClick={handleScrollRight}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                  color: isDark ? '#fff' : '#333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#fff'; e.currentTarget.style.color = isDark ? '#fff' : '#333'; }}
              >
                <RightOutlined />
              </button>
            </div>
          </div>

          {/* Horizontal Scrollable Container ("1 Dòng") */}
          <div 
            ref={scrollContainerRef}
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              scrollBehavior: 'smooth',
              padding: '8px 4px 12px 4px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {topSellingProducts.map((p, index) => {
              const rank = index + 1;
              let rankBadgeStyle = {
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(16,185,129,0.3)'
              };
              if (rank === 1) {
                rankBadgeStyle = {
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.5)'
                };
              } else if (rank === 2) {
                rankBadgeStyle = {
                  background: 'linear-gradient(135deg, #9ca3af, #4b5563)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(156,163,175,0.4)'
                };
              } else if (rank === 3) {
                rankBadgeStyle = {
                  background: 'linear-gradient(135deg, #b45309, #78350f)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(180,83,9,0.4)'
                };
              }

              return (
                <div 
                  key={p.id}
                  style={{
                    width: 240,
                    flexShrink: 0,
                  }}
                >
                  <Card
                    hoverable
                    onClick={() => navigate(`/product/${p.id}`)}
                    style={{
                      borderRadius: 16,
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #eee',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      transition: 'all 0.3s ease'
                    }}
                    styles={{ body: { padding: 16, flex: 1, display: 'flex', flexDirection: 'column' } }}
                    cover={
                      <div style={{ padding: 16, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                        {/* Rank Badge */}
                        <div style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          borderRadius: 12,
                          padding: '3px 10px',
                          fontSize: 12,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          zIndex: 2,
                          ...rankBadgeStyle
                        }}>
                          {rank === 1 ? <CrownOutlined /> : `#${rank}`}
                        </div>

                        <img 
                          alt={p.name} 
                          src={p.image} 
                          width={160}
                          height={160}
                          style={{ height: 160, objectFit: 'contain' }} 
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format'; }}
                        />

                        {p.original_price > p.price && (
                          <Tag color="#ef4444" style={{ position: 'absolute', top: 10, right: 10, borderRadius: 8, fontWeight: 700, margin: 0 }}>
                            -{((1 - p.price / p.original_price) * 100).toFixed(0)}%
                          </Tag>
                        )}
                      </div>
                    }
                  >
                    <div style={{ flex: 1 }}>
                      <Title level={5} style={{ color: isDark ? '#fff' : '#000', margin: 0, fontSize: 14, height: 40, overflow: 'hidden', lineHeight: '1.4' }}>
                        {p.name}
                      </Title>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <Rate disabled defaultValue={p.rating} style={{ fontSize: 12, color: '#facc15' }} />
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#888', fontSize: 11 }}>
                          ({p.sold} {t('home.sold').toLowerCase()})
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#f59e0b' }}>
                          {p.price.toLocaleString('vi-VN')} đ
                        </div>
                        {p.original_price > p.price && (
                          <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : '#999', textDecoration: 'line-through' }}>
                            {p.original_price.toLocaleString('vi-VN')} đ
                          </div>
                        )}
                      </div>
                      <div 
                        onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                        style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 18, 
                          background: 'rgba(245, 158, 11, 0.12)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#f59e0b', 
                          cursor: 'pointer', 
                          transition: 'all 0.3s' 
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'; e.currentTarget.style.color = '#f59e0b'; }}
                      >
                        <ShoppingCartOutlined style={{ fontSize: 16 }} />
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Discover — phân theo category */}
      <div id="product-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <Title level={2} style={{ color: isDark ? '#fff' : '#111', display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
          <FireOutlined style={{ color: '#10b981' }} /> {t('home.daily_discover')}
        </Title>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleCategoryTab('ALL')}
            style={{
              padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
              background: selectedCategory === 'ALL' ? '#10b981' : (isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'),
              color: selectedCategory === 'ALL' ? '#fff' : (isDark ? 'rgba(255,255,255,0.7)' : '#555'),
              boxShadow: selectedCategory === 'ALL' ? '0 4px 12px rgba(16,185,129,0.35)' : 'none',
            }}
          >Tất cả</button>
          {rootCategories.map(c => (
            <button
              key={c.id}
              onClick={() => handleCategoryTab(c.id)}
              style={{
                padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
                background: selectedCategory === c.id ? '#10b981' : (isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'),
                color: selectedCategory === c.id ? '#fff' : (isDark ? 'rgba(255,255,255,0.7)' : '#555'),
                boxShadow: selectedCategory === c.id ? '0 4px 12px rgba(16,185,129,0.35)' : 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {c.name}
              {c.product_count != null && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: selectedCategory === c.id ? 'rgba(255,255,255,0.3)' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                  borderRadius: 10, padding: '1px 7px',
                  color: selectedCategory === c.id ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : '#666'),
                }}>{c.product_count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loadingProducts ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
      ) : null}
      <Row gutter={[20, 20]} style={{ opacity: loadingProducts ? 0.4 : 1, transition: 'opacity 0.3s' }}>
        {products.map(p => (
          <Col className="daily-product-col" key={p.id}>
            <Card
              hoverable
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                borderRadius: 16, background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #eee',
                overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%'
              }}
              styles={{ body: { padding: 20, flex: 1, display: 'flex', flexDirection: 'column' } }}
              cover={
                <div style={{ padding: 24, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <img 
                    alt={p.name} 
                    src={p.image} 
                    width={200}
                    height={200}
                    style={{ height: 200, objectFit: 'contain' }} 
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format'; }}
                  />
                  {p.original_price > p.price && (
                    <Tag color="#10b981" style={{ position: 'absolute', top: 12, left: 12, borderRadius: 8, fontWeight: 700 }}>
                    {t('home.discount')} {(100 - (p.price/p.original_price)*100).toFixed(0)}%
                    </Tag>
                  )}
                </div>
              }
            >
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ color: isDark ? '#fff' : '#000', margin: 0, fontSize: 16, height: 44, overflow: 'hidden' }}>{p.name}</Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Rate disabled defaultValue={p.rating} style={{ fontSize: 14, color: '#facc15' }} />
                  <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#888', fontSize: 12 }}>({p.sold} {t('home.sold').toLowerCase()})</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{p.price.toLocaleString('vi-VN')} đ</div>
                  {p.original_price > p.price && (
                    <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : '#999', textDecoration: 'line-through' }}>
                      {p.original_price.toLocaleString('vi-VN')} đ
                    </div>
                  )}
                </div>
                <div 
                  onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                  style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', cursor: 'pointer', transition: 'all 0.3s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = '#10b981'; }}
                >
                  <ShoppingCartOutlined style={{ fontSize: 18 }} />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      
      {totalProducts > 15 && (
        <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 40 }}>
          <Pagination 
            current={currentPage} 
            total={totalProducts} 
            pageSize={15} 
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
          />
        </div>
      )}
          </>
        )}
      </div>
    </div>
  );
}
