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

import bannerImg from '../../assets/banner.png';
import airpodsImg from '../../assets/airpods.png';
import watchImg from '../../assets/watch.png';
import cameraImg from '../../assets/camera.png';
import iphoneImg from '../../assets/iphone.png';
import macbookImg from '../../assets/macbook.png';
import imacImg from '../../assets/imac.png';

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

// Floating product images config - positioned around the banner, close to center but avoiding text
const floatingProducts = [
  { 
    img: airpodsImg, 
    alt: 'AirPods Pro',
    finalStyle: { top: '20%', left: '22%', width: 200, transform: 'rotate(-10deg)' },
    delay: '0s'
  },
  { 
    img: watchImg, 
    alt: 'Apple Watch',
    finalStyle: { bottom: '18%', left: '18%', width: 160, transform: 'rotate(5deg)' },
    delay: '0.15s'
  },
  { 
    img: cameraImg, 
    alt: 'Security Camera',
    finalStyle: { top: '20%', right: '18%', width: 180, transform: 'rotate(8deg)' },
    delay: '0.3s'
  },
  { 
    img: iphoneImg, 
    alt: 'iPhone Pro',
    finalStyle: { bottom: '15%', right: '22%', width: 150, transform: 'rotate(-12deg)' },
    delay: '0.45s'
  },
  { 
    img: macbookImg, 
    alt: 'MacBook',
    // Top-center, above Getshopy text
    finalStyle: { top: '13%', left: '50%', width: 200, transform: 'translateX(-50%) rotate(5deg)' },
    delay: '0.2s'
  },
  { 
    img: imacImg, 
    alt: 'iMac',
    // Bottom-center, below Getshopy text
    finalStyle: { bottom: '12%', left: '50%', width: 220, transform: 'translateX(-50%) rotate(-3deg)' },
    delay: '0.35s'
  }
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [flashSale, setFlashSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [animateProducts, setAnimateProducts] = useState(false);
  const scrollContainerRef = useRef(null);
  const { addToCart } = useCart();
  const { isDark, t, selectedBranch, b2cUser } = useApp();
  const navigate = useNavigate();
  const featuredCategories = categories.slice(0, 5);

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

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimateProducts(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [prodData, catData, flashData, topSellingData] = await Promise.all([
          api.b2c.getProducts('ALL', '', 'newest', selectedBranch?.id, currentPage, 15),
          api.b2c.getCategories(),
          api.b2c.getFlashSales(),
          api.b2c.getProducts('ALL', '', 'best_selling', selectedBranch?.id, 1, 10)
        ]);
        setProducts(prodData.data || []);
        setTotalProducts(prodData.total || 0);
        setCategories(catData);
        setFlashSale(flashData);
        setTopSellingProducts(topSellingData.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedBranch, currentPage]);

  useEffect(() => {
    async function loadRecs() {
      if (b2cUser && b2cUser.email) {
        setLoadingRecs(true);
        try {
          const recs = await api.ai.getRecommendations(b2cUser.email);
          setRecommendations(recs);
        } catch (err) {
          console.error('Failed to load recommendations', err);
        } finally {
          setLoadingRecs(false);
        }
      }
    }
    loadRecs();
  }, [b2cUser]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>;

  return (
    <div>
      {/* Hero Banner Section */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 600,
        overflow: 'hidden',
      }}>
        {/* Banner Background Image */}
        <img 
          src={bannerImg} 
          alt="Getshopy Banner" 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
        />
        
        {/* Dark overlay for depth */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.3) 100%)',
          zIndex: 1,
        }} />

        {/* Floating Product Images - animated from center outward */}
        {floatingProducts.map((product, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              zIndex: 2,
              transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transitionDelay: product.delay,
              filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))',
              cursor: 'pointer',
              ...(animateProducts ? {
                ...product.finalStyle,
                opacity: 1,
              } : {
                top: '50%',
                left: '50%',
                width: 0,
                opacity: 0,
                transform: 'translate(-50%, -50%) scale(0)',
              }),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'drop-shadow(0 25px 50px rgba(16,185,129,0.5))';
              e.currentTarget.style.zIndex = '10';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))';
              e.currentTarget.style.zIndex = '2';
            }}
          >
            <img 
              src={product.img} 
              alt={product.alt}
              style={{
                width: '100%',
                height: 'auto',
                pointerEvents: 'none',
              }}
            />
          </div>
        ))}

        {/* CTA Buttons at bottom center */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
          display: 'flex',
          gap: 16,
          opacity: animateProducts ? 1 : 0,
          transition: 'opacity 0.8s ease 0.8s',
        }}>
          <div
            onClick={() => navigate('/shop')}
            style={{
              padding: '14px 36px',
              background: 'linear-gradient(135deg, #10b981, #047857)',
              color: '#fff',
              borderRadius: 50,
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
              transition: 'all 0.3s ease',
              border: 'none',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(16,185,129,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(16,185,129,0.4)';
            }}
          >
            Mua sắm ngay
          </div>
          <div
            onClick={() => navigate('/shop')}
            style={{
              padding: '14px 36px',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              borderRadius: 50,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.3)',
              transition: 'all 0.3s ease',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Khám phá ưu đãi
          </div>
        </div>
      </div>

      {/* CSS Animation Keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 20px 40px rgba(0,0,0,0.4)); }
          50% { filter: drop-shadow(0 25px 50px rgba(16,185,129,0.3)); }
        }
      `}</style>

      {/* Content sections below banner */}
      <div style={{ padding: '48px 48px 0', maxWidth: 1400, margin: '0 auto' }}>

      {/* Categories */}
      <Title level={3} style={{ color: isDark ? '#fff' : '#111', marginBottom: 24 }}>{t('home.featured_categories')}</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
        {featuredCategories.map(c => (
          <Col xs={12} sm={8} md={6} lg={4} key={c.id}>
            <div 
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
                borderRadius: 16, padding: '24px 16px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#10b981'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#eee'; }}
              onClick={() => navigate(`/shop?category=${c.id}`)}
            >
              <div style={{ fontSize: 32, color: '#10b981', marginBottom: 12 }}>{iconMap[c.icon]}</div>
              <div style={{ color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{t(`home.category_${c.id}`)}</div>
            </div>
          </Col>
        ))}
        <Col xs={12} sm={8} md={6} lg={4} key="all-categories">
          <div
            style={{
              background: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: 16, padding: '24px 16px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.background = isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5'; }}
            onClick={() => navigate('/shop')}
          >
            <div style={{ fontSize: 32, color: '#10b981', marginBottom: 12 }}><AppstoreOutlined /></div>
            <div style={{ color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{t('home.all_categories')}</div>
          </div>
        </Col>
      </Row>

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
                        style={{ height: 160, objectFit: 'contain' }} 
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
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

      {/* AI Recommendations */}
      {b2cUser && recommendations.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <Title level={2} style={{ color: isDark ? '#fff' : '#111', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              fontWeight: 800
            }}>AI Gợi ý cho bạn</span>
            <Tag color="purple" style={{ borderRadius: 12, border: 'none', background: 'rgba(139, 92, 246, 0.1)' }}>Powered by OpenRouter</Tag>
          </Title>
          <Row gutter={[24, 24]}>
            {recommendations.map(p => (
              <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
                <Card
                  hoverable
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{
                    borderRadius: 16, background: isDark ? 'rgba(139, 92, 246, 0.05)' : '#faf5ff',
                    border: isDark ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid #e9d5ff',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%'
                  }}
                  styles={{ body: { padding: 20, flex: 1, display: 'flex', flexDirection: 'column' } }}
                  cover={
                    <div style={{ padding: 24, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                      <img 
                        alt={p.name} 
                        src={p.image} 
                        style={{ height: 200, objectFit: 'contain' }} 
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
                      />
                    </div>
                  }
                >
                  <div style={{ flex: 1 }}>
                    <Title level={4} style={{ color: isDark ? '#fff' : '#000', margin: 0, fontSize: 16, height: 44, overflow: 'hidden' }}>{p.name}</Title>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{p.price.toLocaleString('vi-VN')} đ</div>
                    </div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                      style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', cursor: 'pointer', transition: 'all 0.3s' }}
                    >
                      <ShoppingCartOutlined style={{ fontSize: 18 }} />
                    </div>
                  </div>
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
                          style={{ height: 160, objectFit: 'contain' }} 
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
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

      {/* Daily Discover */}
      <Title level={2} style={{ color: isDark ? '#fff' : '#111', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FireOutlined style={{ color: '#10b981' }} /> {t('home.daily_discover')}
      </Title>

      <Row gutter={[20, 20]}>
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
                    style={{ height: 200, objectFit: 'contain' }} 
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
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
      </div>
    </div>
  );
}
