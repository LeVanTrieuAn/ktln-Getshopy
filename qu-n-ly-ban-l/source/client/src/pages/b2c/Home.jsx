import { useState, useEffect } from 'react';
import { Row, Col, Card, Carousel, Typography, Spin, Tag, Rate, Statistic } from 'antd';
import { ShoppingCartOutlined, FireOutlined, ThunderboltOutlined, MobileOutlined, LaptopOutlined, TabletOutlined, AudioOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

const { Title, Text } = Typography;
const { Timer } = Statistic;

const iconMap = {
  'MobileOutlined': <MobileOutlined />,
  'LaptopOutlined': <LaptopOutlined />,
  'TabletOutlined': <TabletOutlined />,
  'AudioOutlined': <AudioOutlined />
};

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [flashSale, setFlashSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const { addToCart } = useCart();
  const { isDark, t, selectedBranch, b2cUser } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [prodData, catData, flashData] = await Promise.all([
          api.b2c.getProducts('ALL', '', 'newest', selectedBranch?.id),
          api.b2c.getCategories(),
          api.b2c.getFlashSales()
        ]);
        setProducts(prodData);
        setCategories(catData);
        setFlashSale(flashData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedBranch]);

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

  const bannerProducts = products.filter(p => p.is_banner);

  return (
    <div>
      {/* Banner */}
      <Carousel autoplay effect="fade" style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 40 }}>
        {bannerProducts.length > 0 ? (
          bannerProducts.map(p => (
            <div key={p.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate(`/product/${p.id}`)}>
              <img src={p.image} alt="Banner" style={{ width: '100%', height: 400, objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'center', padding: '0 64px' }}>
                <div>
                  <h1 style={{ color: '#fff', fontSize: 48, fontWeight: 800, margin: 0 }}>{p.name}</h1>
                  <p style={{ color: '#10b981', fontSize: 24, fontWeight: 600 }}>{p.price?.toLocaleString('vi-VN')} đ</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          [
            <div key="fallback-1" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/product/1')}>
              <img src="https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=2000&auto=format&fit=crop" alt="Banner" style={{ width: '100%', height: 400, objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'center', padding: '0 64px' }}>
                <div>
                  <h1 style={{ color: '#fff', fontSize: 48, fontWeight: 800, margin: 0 }}>iPhone 15 Pro Max</h1>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>Titanium. So strong. So light. So Pro.</p>
                </div>
              </div>
            </div>,
            <div key="fallback-2" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/product/3')}>
              <img src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=2000&auto=format&fit=crop" alt="Banner" style={{ width: '100%', height: 400, objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'center', padding: '0 64px' }}>
                <div>
                  <h1 style={{ color: '#fff', fontSize: 48, fontWeight: 800, margin: 0 }}>MacBook Air M3</h1>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>Lean. Mean. M3 machine.</p>
                </div>
              </div>
            </div>
          ]
        )}
      </Carousel>

      {/* Categories */}
      <Title level={3} style={{ color: isDark ? '#fff' : '#111', marginBottom: 24 }}>{t('home.featured_categories')}</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
        {categories.map(c => (
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

      {/* Daily Discover */}
      <Title level={2} style={{ color: isDark ? '#fff' : '#111', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FireOutlined style={{ color: '#10b981' }} /> {t('home.daily_discover')}
      </Title>

      <Row gutter={[24, 24]}>
        {products.map(p => (
          <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
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
    </div>
  );
}
