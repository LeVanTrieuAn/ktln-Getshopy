import { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Spin, Tag, Rate, Select, Empty, InputNumber, Button, Checkbox, Slider, Radio, Divider, Pagination } from 'antd';
import { ShoppingCartOutlined, FilterOutlined, RobotOutlined, BulbOutlined, FrownOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

const { Title, Text } = Typography;

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  
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

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsAiLoading(true);
    setAiSearchDone(false);
    try {
      const result = await api.ai.smartSearch(searchQuery);
      setAiResults(result?.products || []);
      setAiHint(result?.hint || 'Kết quả gợi ý từ AI');
      setAiSearchDone(true);
    } catch (err) {
      console.error('[AI Search]', err);
      setAiSearchDone(true);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
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

          {/* Trạng thái chưa search AI */}
          {!aiSearchDone && !isAiLoading && (
            <>
              <Empty description={null} />
              <div style={{ marginTop: 16, color: isDark ? '#aaa' : '#666', fontSize: 15 }}>
                {t('shop.no_products')}
              </div>
              {searchQuery && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontSize: 13, marginBottom: 14 }}>
                    Bạn có muốn để AI tìm sản phẩm phù hợp với&nbsp;
                    <strong style={{ color: isDark ? '#fff' : '#111' }}>"{searchQuery}"</strong>&nbsp;không?
                  </div>
                  <button
                    onClick={handleAiSearch}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none', borderRadius: 24,
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    {isAiLoading ? (
                      <><Spin size="small" style={{ marginRight: 6 }} /> Đang hỏi AI...</>
                    ) : (
                      <><BulbOutlined /> Để AI tìm giúp bạn</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Đang hỏi AI */}
          {isAiLoading && (
            <div style={{ padding: '24px 0' }}>
              <RobotOutlined style={{ fontSize: 40, marginBottom: 16, color: isDark ? '#34d399' : '#10b981' }} />
              <br/>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: isDark ? '#34d399' : '#10b981', fontWeight: 500 }}>
                Đang hỏi AI tìm giúp bạn...
              </div>
            </div>
          )}

          {/* Kết quả AI */}
          {aiSearchDone && aiResults.length > 0 && (
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
                            onError={(e) => { e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=No+Image'; }} />
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
          {aiSearchDone && aiResults.length === 0 && (
            <>
              <Empty description={<span style={{ color: isDark ? '#aaa' : '#555' }}>AI cũng không tìm thấy sản phẩm phù hợp</span>} />
              <button onClick={() => { setAiSearchDone(false); }}
                style={{ marginTop: 16, padding: '8px 20px', borderRadius: 20, border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#ddd'}`, background: 'transparent', cursor: 'pointer', color: isDark ? '#aaa' : '#666', fontSize: 13 }}>
                Thử lại
              </button>
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
