import { useState, useEffect, useRef, useMemo } from 'react';
import { Row, Col, Card, Typography, Spin, Tag, Rate, Select, Empty, InputNumber, Button, Checkbox, Slider, Radio, Divider, Pagination } from 'antd';
import { ShoppingCartOutlined, FilterOutlined, RobotOutlined, BulbOutlined, FrownOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

// ── Category-aware image fallback ───────────────────────────────
const FALLBACK_BY_CAT = {
  phone:    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80&auto=format',
  laptop:   'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format',
  tablet:   'https://images.unsplash.com/photo-1544244015-0df4512b8c72?w=400&h=400&fit=crop&q=80&auto=format',
  watch:    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop&q=80&auto=format',
  audio:    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&q=80&auto=format',
  camera:   'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=400&fit=crop&q=80&auto=format',
  acc:      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop&q=80&auto=format',
  default:  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format',
};
function getFallback(categoryId) {
  const c = categoryId || '';
  if (c === 'cat-phone') return FALLBACK_BY_CAT.phone;
  if (c === 'cat-laptop') return FALLBACK_BY_CAT.laptop;
  if (c === 'cat-tablet') return FALLBACK_BY_CAT.tablet;
  if (c === 'cat-watch') return FALLBACK_BY_CAT.watch;
  if (c.startsWith('cat-av') || c.includes('earphone') || c.includes('headphone') || c.includes('speaker') || c.includes('mic')) return FALLBACK_BY_CAT.audio;
  if (c.startsWith('cat-cam')) return FALLBACK_BY_CAT.camera;
  if (c.startsWith('cat-mobile-acc')) return FALLBACK_BY_CAT.phone;
  if (c.startsWith('cat-laptop-acc')) return FALLBACK_BY_CAT.laptop;
  return FALLBACK_BY_CAT.default;
}

const { Title, Text } = Typography;

// ── Benchmark helper: chỉ bật khi URL có ?benchmark=true ───────────────────
function useBenchmarkMode() {
  return useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('benchmark'),
    []
  );
}

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const isBenchmark = useBenchmarkMode();
  const benchRef    = useRef({ fetchStart: 0, renderStart: 0 });
  
  // Advanced filters
  const [minPrice, setMinPrice] = useState(null);
  const [maxPrice, setMaxPrice] = useState(null);
  const [appliedMinPrice, setAppliedMinPrice] = useState(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState(null);
  
  const [brands, setBrands] = useState([]);
  const [minRating, setMinRating] = useState(0);

  // AI search states
  const [aiResults, setAiResults] = useState([]);
  const [aiHint, setAiHint] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSearchDone, setAiSearchDone] = useState(false);

  const { addToCart } = useCart();
  const { isDark, t, selectedBranch } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const categoryFilter = queryParams.get('category') || 'ALL';
  const searchQuery = queryParams.get('search') || '';

  // Reset AI khi search query thay đổi
  useEffect(() => {
    setAiResults([]);
    setAiHint('');
    setAiSearchDone(false);
  }, [searchQuery]);


  useEffect(() => {
    async function load() {
      setLoading(true);
      const t0 = isBenchmark ? performance.now() : 0;
      if (isBenchmark) {
        benchRef.current.fetchStart = t0;
        console.log('[Benchmark] ProductList fetch start');
      }
      try {
        let [prodData, catData, brandData] = await Promise.all([
          api.b2c.getProducts(categoryFilter, searchQuery, sort, selectedBranch?.id, currentPage, 12),
          api.b2c.getCategories(),
          api.b2c.getBrands()
        ]);
        
        let allProds = prodData.data || [];
        if (appliedMinPrice !== null) allProds = allProds.filter(p => p.price >= appliedMinPrice);
        if (appliedMaxPrice !== null) allProds = allProds.filter(p => p.price <= appliedMaxPrice);
        if (brands.length > 0) {
          allProds = allProds.filter(p => brands.includes(p.brand_id));
        }
        if (minRating > 0) allProds = allProds.filter(p => p.rating >= minRating);

        setProducts(allProds);
        setTotalProducts(prodData.total || 0);
        setCategories(catData);
        setBrandList(brandData || []);

        if (isBenchmark) {
          const fetchEnd = performance.now();
          const fetchMs  = Math.round(fetchEnd - t0);
          console.log(`[Benchmark] ✅ ProductList fetch done: ${fetchMs}ms | rows=${allProds.length} | total=${prodData.total || 0}`);
          if (prodData.total > 10000) {
            console.warn(`[Benchmark] ⚠️  Large dataset: ${(prodData.total || 0).toLocaleString()} sản phẩm trong DB`);
          }
        }

        // Tự động gọi AI search nếu DB không tìm thấy sản phẩm nào và có từ khoá
        if (allProds.length === 0 && searchQuery.trim()) {
          setIsAiLoading(true);
          setAiSearchDone(false);
          try {
            const result = await api.ai.smartSearch(searchQuery);
            setAiResults(result?.products || []);
            setAiHint(result?.hint || 'Kết quả gợi ý từ AI');
          } catch (aiErr) {
            console.error('[AI Search auto]', aiErr);
          } finally {
            setIsAiLoading(false);
            setAiSearchDone(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        if (isBenchmark) {
          const totalMs = Math.round(performance.now() - t0);
          console.log(`[Benchmark] ProductList total load+render: ${totalMs}ms`);
        }
      }
    }
    load();
  }, [categoryFilter, searchQuery, sort, selectedBranch, appliedMinPrice, appliedMaxPrice, brands, minRating, currentPage]);

  const applyPriceFilter = () => {
    setAppliedMinPrice(minPrice);
    setAppliedMaxPrice(maxPrice);
  };

  const clearPriceFilter = () => {
    setMinPrice(null);
    setMaxPrice(null);
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
  };

  return (
    <div style={{ padding: '100px 48px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ color: isDark ? '#fff' : '#111', margin: 0 }}>
          {searchQuery ? `${t('shop.search_results')}: "${searchQuery}"` : t('shop.all_products')}
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: isDark ? '#aaa' : '#555' }}><FilterOutlined /> {t('shop.sort_by')}:</span>
          <Select 
            value={sort} 
            onChange={setSort} 
            style={{ width: 180 }}
            options={[
              { value: 'newest', label: t('shop.sort_newest') },
              { value: 'price_asc', label: t('shop.sort_price_asc') },
              { value: 'price_desc', label: t('shop.sort_price_desc') }
            ]} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, overflowX: 'auto', paddingBottom: 8 }}>
        <Tag.CheckableTag
          checked={categoryFilter === 'ALL'}
          onChange={() => navigate('/shop')}
          style={{ fontSize: 16, padding: '8px 16px', borderRadius: 20 }}
        >
          {t('shop.all')}
        </Tag.CheckableTag>
        {categories.map(c => (
          <Tag.CheckableTag
            key={c.id}
            checked={categoryFilter === c.id}
            onChange={() => navigate(`/shop?category=${c.id}`)}
            style={{ fontSize: 16, padding: '8px 16px', borderRadius: 20 }}
          >
            {t(`home.category_${c.id}`)}
          </Tag.CheckableTag>
        ))}
      </div>

      {/* HORIZONTAL FILTERS */}
      <div style={{ 
        background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', 
        padding: 32, borderRadius: 20, marginBottom: 40,
        border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #eee' 
      }}>
        <Row gutter={[48, 32]}>
          {/* PRICE FILTER */}
          <Col xs={24} md={10}>
            <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#333', marginBottom: 16, fontSize: 16 }}><FilterOutlined /> {t('shop.price_range')}</div>
            <Slider 
              range 
              min={0} 
              max={100000000} 
              step={500000}
              value={[minPrice !== null ? minPrice : 0, maxPrice !== null ? maxPrice : 100000000]}
              onChange={(val) => { setMinPrice(val[0]); setMaxPrice(val[1]); }}
              style={{ marginBottom: 24 }}
              trackStyle={[{ backgroundColor: '#10b981' }]}
              handleStyle={[{ borderColor: '#10b981' }, { borderColor: '#10b981' }]}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <InputNumber 
                placeholder={t('shop.from')} 
                value={minPrice} 
                onChange={setMinPrice} 
                style={{ flex: 1 }} 
                size="large"
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
              />
              <span style={{ color: '#888' }}>-</span>
              <InputNumber 
                placeholder={t('shop.to')} 
                value={maxPrice} 
                onChange={setMaxPrice} 
                style={{ flex: 1 }} 
                size="large"
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button type="primary" size="large" onClick={applyPriceFilter} style={{ flex: 1, background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}>{t('shop.apply')}</Button>
              {(appliedMinPrice !== null || appliedMaxPrice !== null) && (
                <Button type="default" size="large" onClick={clearPriceFilter} style={{ color: '#ef4444', borderColor: '#ef4444' }}>{t('shop.clear')}</Button>
              )}
            </div>
          </Col>

          {/* BRAND FILTER */}
          <Col xs={24} md={8}>
            <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#333', marginBottom: 16, fontSize: 16 }}>{t('shop.brands')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {brandList.map(b => (
                <Tag.CheckableTag 
                  key={b.id} 
                  checked={brands.includes(b.id)} 
                  onChange={(checked) => setBrands(checked ? [...brands, b.id] : brands.filter(x => x !== b.id))}
                  style={{ 
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ddd', 
                    padding: '6px 16px', borderRadius: 20, fontSize: 14,
                    background: brands.includes(b.id) ? '#10b981' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'),
                    color: brands.includes(b.id) ? '#fff' : (isDark ? '#ccc' : '#333')
                  }}
                >
                  {b.name}
                </Tag.CheckableTag>
              ))}
            </div>
          </Col>

          {/* RATING FILTER */}
          <Col xs={24} md={6}>
            <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#333', marginBottom: 16, fontSize: 16 }}>{t('shop.min_rating')}</div>
            <Select 
              value={minRating}
              onChange={setMinRating}
              style={{ width: '100%' }}
              size="large"
              options={[
                { value: 0, label: t('shop.all_ratings') },
                { value: 5, label: t('shop.star_5') },
                { value: 4, label: t('shop.star_4') },
                { value: 3, label: t('shop.star_3') }
              ]}
            />
          </Col>
        </Row>
      </div>

      {/* MAIN PRODUCT GRID */}
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>
      ) : products.length === 0 ? (
        <div className="glass-panel" style={{ padding: 64, textAlign: 'center', borderRadius: 24 }}>

          {/* Đang hỏi AI (tự động) */}
          {isAiLoading && (
            <div style={{ padding: '24px 0' }}>
              <RobotOutlined style={{ fontSize: 40, marginBottom: 16, color: isDark ? '#34d399' : '#10b981' }} />
              <br/>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: isDark ? '#34d399' : '#10b981', fontWeight: 500 }}>
                Đang để AI tìm giúp bạn...
              </div>
            </div>
          )}

          {/* Kết quả AI */}
          {!isAiLoading && aiSearchDone && aiResults.length > 0 && (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', marginBottom: 28,
                background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
                border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`,
                borderRadius: 20,
              }}>
                <BulbOutlined style={{ fontSize: 16, color: isDark ? '#34d399' : '#10b981' }} />
                <span style={{ fontSize: 13, color: isDark ? '#34d399' : '#10b981', fontWeight: 600 }}>AI: {aiHint}</span>
              </div>
              <Row gutter={[24, 24]} style={{ textAlign: 'left' }}>
                {aiResults.map(p => (
                  <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
                    <Card
                      hoverable
                      onClick={() => navigate(`/product/${p.id}`)}
                      style={{
                        borderRadius: 16, background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #eee',
                        overflow: 'hidden',
                      }}
                      cover={
                        <div style={{ padding: 20, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', display: 'flex', justifyContent: 'center' }}>
                          <img alt={p.name} src={p.image || p.images?.[0]} style={{ height: 160, objectFit: 'contain' }}
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80&auto=format'; }} />
                        </div>
                      }
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#fff' : '#111', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                      {p.category && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{p.category}</div>}
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* AI cũng không tìm thấy */}
          {!isAiLoading && aiSearchDone && aiResults.length === 0 && (
            <Empty description={<span style={{ color: isDark ? '#aaa' : '#555' }}>Không tìm thấy sản phẩm phù hợp</span>} />
          )}

          {/* Không có search query — hiển thị empty bình thường */}
          {!isAiLoading && !aiSearchDone && (
            <>
              <Empty description={null} />
              <div style={{ marginTop: 16, color: isDark ? '#aaa' : '#666', fontSize: 15 }}>
                {t('shop.no_products')}
              </div>
            </>
          )}

        </div>
      ) : (
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
                      width={200}
                      height={200}
                      style={{ height: 200, objectFit: 'contain' }} 
                      onError={(e) => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }}
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
      )}

      {totalProducts > 12 && (
        <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 40 }}>
          <Pagination 
            current={currentPage} 
            total={totalProducts} 
            pageSize={12} 
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
}
