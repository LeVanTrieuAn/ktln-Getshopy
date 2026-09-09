import { useState, useEffect, useRef, useMemo } from 'react';
import { Typography, Spin, Tag, Rate, Select, Empty, InputNumber, Button, Slider, Pagination, Input } from 'antd';
import {
  ShoppingCartOutlined, FilterOutlined, RobotOutlined, BulbOutlined,
  AppstoreOutlined, BarsOutlined, SearchOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';
import { useTracking } from '../../hooks/useTracking';

// ── Category-aware image fallback ───────────────────────────────
const FALLBACK_BY_CAT = {
  phone:   'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80&auto=format',
  laptop:  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format',
  tablet:  'https://images.unsplash.com/photo-1544244015-0df4512b8c72?w=400&h=400&fit=crop&q=80&auto=format',
  watch:   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop&q=80&auto=format',
  audio:   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&q=80&auto=format',
  camera:  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=400&fit=crop&q=80&auto=format',
  default: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format',
};
function getFallback(categoryId) {
  const c = categoryId || '';
  if (c === 'cat-phone' || c.startsWith('c1')) return FALLBACK_BY_CAT.phone;
  if (c === 'cat-laptop' || c.startsWith('c2')) return FALLBACK_BY_CAT.laptop;
  if (c === 'cat-tablet' || c.startsWith('c3')) return FALLBACK_BY_CAT.tablet;
  if (c.startsWith('c7')) return FALLBACK_BY_CAT.watch;
  if (c.startsWith('cat-av') || c.includes('earphone') || c.includes('headphone') || c.includes('speaker')) return FALLBACK_BY_CAT.audio;
  if (c.startsWith('cat-cam') || c.startsWith('c6')) return FALLBACK_BY_CAT.camera;
  return FALLBACK_BY_CAT.default;
}

const { Title, Text } = Typography;

function useBenchmarkMode() {
  return useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('benchmark'),
    []
  );
}

// ── Skeleton Card ────────────────────────────────────────────────
function SkeletonCard({ isDark }) {
  const base = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb';
  const shine = isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6';
  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
      border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e5e7eb',
    }}>
      <div style={{ height: 200, background: `linear-gradient(90deg,${base} 25%,${shine} 50%,${base} 75%)`, backgroundSize: '400% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div style={{ padding: 20 }}>
        {[1,0.7,0.5].map((w, i) => (
          <div key={i} style={{ height: 14, borderRadius: 7, background: base, marginBottom: 10, width: `${w * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── Product Card ────────────────────────────────────────────────
function ProductCard({ p, isDark, navigate, addToCart, t }) {
  const [hovered, setHovered] = useState(false);
  const discount = p.original_price > p.price
    ? Math.round((1 - p.price / p.original_price) * 100)
    : 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/product/${p.id}`)}
      style={{
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        border: isDark
          ? `1px solid ${hovered ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`
          : `1px solid ${hovered ? '#10b981' : '#e5e7eb'}`,
        boxShadow: hovered
          ? '0 20px 40px rgba(16,185,129,0.15)'
          : '0 2px 12px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-6px)' : 'none',
        transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column', height: '100%',
      }}
    >
      {/* Image area */}
      <div style={{
        position: 'relative',
        padding: '24px 24px 16px',
        background: isDark ? 'rgba(0,0,0,0.2)' : (hovered ? '#f0fdf4' : '#f9fafb'),
        transition: 'background 0.3s',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: 200,
      }}>
        <img
          alt={p.name}
          src={p.image}
          width={180} height={180}
          style={{
            objectFit: 'contain', height: 180,
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 0.4s cubic-bezier(.4,0,.2,1)',
          }}
          onError={(e) => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }}
        />

        {/* Discount badge */}
        {discount > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff', fontWeight: 800, fontSize: 12,
            padding: '4px 10px', borderRadius: 20,
            boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
          }}>
            -{discount}%
          </div>
        )}

        {/* Quick add */}
        <button
          onClick={(e) => { e.stopPropagation(); addToCart(p); }}
          style={{
            position: 'absolute', bottom: 12, right: 12,
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: hovered ? '#10b981' : 'rgba(16,185,129,0.15)',
            color: hovered ? '#fff' : '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18,
            transform: hovered ? 'scale(1) rotate(0deg)' : 'scale(0.85) rotate(-10deg)',
            opacity: hovered ? 1 : 0,
            transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
            boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
          }}
        >
          <ShoppingCartOutlined />
        </button>
      </div>

      {/* Info area */}
      <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontWeight: 700, fontSize: 14, lineHeight: 1.4,
          color: isDark ? '#f3f4f6' : '#111827',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          flex: 1,
        }}>
          {p.name}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Rate disabled defaultValue={Math.round(p.rating || 0)} style={{ fontSize: 11, color: '#f59e0b' }} />
          <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>
            ({(p.sold || 0).toLocaleString()})
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
              {p.price.toLocaleString('vi-VN')}<span style={{ fontSize: 12, fontWeight: 600 }}> đ</span>
            </div>
            {discount > 0 && (
              <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af', textDecoration: 'line-through', marginTop: 2 }}>
                {p.original_price.toLocaleString('vi-VN')} đ
              </div>
            )}
          </div>

          {/* Cart button (visible always on mobile, hover on desktop) */}
          <button
            onClick={(e) => { e.stopPropagation(); addToCart(p); }}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'rgba(16,185,129,0.12)', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.color = '#10b981'; }}
          >
            <ShoppingCartOutlined />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isBenchmark = useBenchmarkMode();

  // Filters state
  const [brands, setBrands] = useState([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [minPrice, setMinPrice] = useState(null);
  const [maxPrice, setMaxPrice] = useState(null);
  const [appliedMinPrice, setAppliedMinPrice] = useState(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState(null);
  const [minRating, setMinRating] = useState(0);

  // AI search
  const [aiResults, setAiResults] = useState([]);
  const [aiHint, setAiHint] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSearchDone, setAiSearchDone] = useState(false);

  const { addToCart } = useCart();
  const { isDark, t, selectedBranch } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackCategoryView, trackSearchQuery } = useTracking();

  const queryParams = new URLSearchParams(location.search);
  const categoryFilter = queryParams.get('category') || 'ALL';
  const searchQuery = queryParams.get('search') || '';

  // Track category views
  useEffect(() => {
    if (categoryFilter && categoryFilter !== 'ALL') {
      trackCategoryView(categoryFilter);
    }
  }, [categoryFilter]);

  useEffect(() => {
    setAiResults([]); setAiHint(''); setAiSearchDone(false);
  }, [searchQuery]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let [prodData, catData, brandData, activeCatData] = await Promise.all([
          // Truyền brands vào API để backend xử lý multi-brand filter (server-side)
          api.b2c.getProducts(categoryFilter, searchQuery, sort, selectedBranch?.id, currentPage, 16, brands),
          api.b2c.getCategories(),
          api.b2c.getBrands(),
          api.b2c.getActiveCategories(selectedBranch?.id || ''),
        ]);

        let allProds = prodData.data || [];
        if (appliedMinPrice !== null) allProds = allProds.filter(p => p.price >= appliedMinPrice);
        if (appliedMaxPrice !== null) allProds = allProds.filter(p => p.price <= appliedMaxPrice);
        // brand filter đã xử lý server-side — không cần lọc lại client
        if (minRating > 0) allProds = allProds.filter(p => p.rating >= minRating);

        setProducts(allProds);
        setTotalProducts(prodData.total || 0);
        setCategories(catData);
        setBrandList(brandData || []);
        setActiveCategories(activeCatData || []);

        // Track search query with result count
        if (searchQuery.trim()) {
          trackSearchQuery(searchQuery, prodData.total || 0);
        }

        if (allProds.length === 0 && searchQuery.trim()) {
          setIsAiLoading(true);
          setAiSearchDone(false);
          try {
            const result = await api.ai.smartSearch(searchQuery);
            setAiResults(result?.products || []);
            setAiHint(result?.hint || 'Kết quả gợi ý từ AI');
          } catch { } finally {
            setIsAiLoading(false);
            setAiSearchDone(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [categoryFilter, searchQuery, sort, selectedBranch, appliedMinPrice, appliedMaxPrice, brands, minRating, currentPage]);

  const applyPriceFilter = () => { setAppliedMinPrice(minPrice); setAppliedMaxPrice(maxPrice); };
  const clearAllFilters = () => {
    setMinPrice(null); setMaxPrice(null);
    setAppliedMinPrice(null); setAppliedMaxPrice(null);
    setBrands([]); setMinRating(0);
  };
  const hasActiveFilters = appliedMinPrice !== null || appliedMaxPrice !== null || brands.length > 0 || minRating > 0;

  // Root categories
  const rootCategories = categories.filter(c => !c.parent_id);

  // Active category name
  const activeCatName = categoryFilter === 'ALL'
    ? t('shop.all_products')
    : (rootCategories.find(c => c.id === categoryFilter)?.name || t('shop.all_products'));

  const bg = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#fff';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
  const textCol = isDark ? '#f1f5f9' : '#1e293b';
  const subCol = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: bg }}>

      {/* ── Sticky Top Bar ── */}
      <div style={{
        position: 'sticky', top: 64, zIndex: 90,
        background: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${borderCol}`,
      }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 48px' }}>
        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', padding: '12px 0 0',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {/* Tất cả */}
          <button
            onClick={() => navigate('/shop')}
            style={{
              padding: '8px 20px', borderRadius: '12px 12px 0 0', border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              background: categoryFilter === 'ALL'
                ? (isDark ? '#10b981' : '#10b981')
                : 'transparent',
              color: categoryFilter === 'ALL' ? '#fff' : subCol,
              borderBottom: categoryFilter === 'ALL' ? '2px solid #10b981' : '2px solid transparent',
            }}
          >
            Tất cả
          </button>

          {activeCategories.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/shop?category=${c.id}`)}
              style={{
                padding: '8px 20px', borderRadius: '12px 12px 0 0', border: 'none',
                cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                background: categoryFilter === c.id
                  ? (isDark ? '#10b981' : '#10b981')
                  : 'transparent',
                color: categoryFilter === c.id ? '#fff' : subCol,
                borderBottom: categoryFilter === c.id ? '2px solid #10b981' : '2px solid transparent',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto', padding: '32px 48px 64px', gap: 28 }}>

        {/* ── Left Sidebar Filter ── */}
        {sidebarOpen && (
          <aside style={{
            width: 280, flexShrink: 0,
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: 20,
            padding: 24,
            alignSelf: 'flex-start',
            position: 'sticky', top: 130,
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
          }}>
            {/* Filter header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: textCol, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FilterOutlined style={{ color: '#10b981' }} /> Bộ lọc
              </span>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} style={{
                  background: 'none', border: 'none', color: '#ef4444',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <CloseOutlined /> Xóa tất cả
                </button>
              )}
            </div>

            {/* Price range */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: subCol, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                Khoảng giá (VNĐ)
              </div>

              {/* CSS: track transparent, chỉ thumb nhận pointer events */}
              <style>{`
                .price-range-wrap input[type='range'] {
                  pointer-events: none;
                  position: absolute;
                  width: 100%;
                  height: 0;
                  top: 50%;
                  transform: translateY(-50%);
                  appearance: none;
                  -webkit-appearance: none;
                  background: transparent;
                  margin: 0; padding: 0;
                  outline: none;
                }
                .price-range-wrap input[type='range']::-webkit-slider-thumb {
                  pointer-events: all;
                  -webkit-appearance: none;
                  width: 18px; height: 18px;
                  border-radius: 50%;
                  background: #fff;
                  border: 2.5px solid #10b981;
                  box-shadow: 0 1px 6px rgba(0,0,0,0.18);
                  cursor: grab;
                  margin-top: 0;
                }
                .price-range-wrap input[type='range']::-moz-range-thumb {
                  pointer-events: all;
                  width: 18px; height: 18px;
                  border-radius: 50%;
                  background: #fff;
                  border: 2.5px solid #10b981;
                  box-shadow: 0 1px 6px rgba(0,0,0,0.18);
                  cursor: grab;
                }
                .price-range-wrap input[type='range']::-webkit-slider-runnable-track {
                  background: transparent;
                }
              `}</style>

              <div className="price-range-wrap" style={{ position: 'relative', height: 28, marginBottom: 4 }}>
                {/* Rail */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '50%',
                  transform: 'translateY(-50%)', height: 4,
                  background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 2,
                  pointerEvents: 'none',
                }} />
                {/* Active track */}
                <div style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                  height: 4, borderRadius: 2, background: '#10b981', pointerEvents: 'none',
                  left: `${((minPrice || 0) / 100000000) * 100}%`,
                  right: `${100 - ((maxPrice || 100000000) / 100000000) * 100}%`,
                }} />
                {/* Input min — z-index cao hơn khi giá trị gần max để vẫn kéo được */}
                <input type="range" min={0} max={100000000} step={500000}
                  value={minPrice || 0}
                  onChange={e => { const v = Number(e.target.value); if (v <= (maxPrice || 100000000)) setMinPrice(v); }}
                  style={{ zIndex: (minPrice || 0) > 90000000 ? 5 : 3 }}
                />
                {/* Input max */}
                <input type="range" min={0} max={100000000} step={500000}
                  value={maxPrice || 100000000}
                  onChange={e => { const v = Number(e.target.value); if (v >= (minPrice || 0)) setMaxPrice(v); }}
                  style={{ zIndex: 4 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <InputNumber
                  placeholder="Từ" value={minPrice} onChange={setMinPrice}
                  style={{ flex: 1, borderRadius: 10 }} size="small"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
                <span style={{ color: subCol, alignSelf: 'center' }}>—</span>
                <InputNumber
                  placeholder="Đến" value={maxPrice} onChange={setMaxPrice}
                  style={{ flex: 1, borderRadius: 10 }} size="small"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </div>
              <Button
                type="primary" block onClick={applyPriceFilter}
                style={{ marginTop: 12, borderRadius: 10, background: '#10b981', borderColor: '#10b981', fontWeight: 700 }}
              >
                Áp dụng
              </Button>
            </div>

            <div style={{ height: 1, background: borderCol, marginBottom: 24 }} />

            {/* Rating */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: subCol, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Đánh giá tối thiểu
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 4, 3].map(v => (
                  <button
                    key={v}
                    onClick={() => setMinRating(v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', borderRadius: 10, border: 'none',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      background: minRating === v
                        ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5')
                        : 'transparent',
                      color: minRating === v ? '#10b981' : textCol,
                      fontWeight: minRating === v ? 700 : 500,
                    }}
                  >
                    {v === 0 ? (
                      <span>Tất cả đánh giá</span>
                    ) : (
                      <>
                        <Rate disabled defaultValue={v} style={{ fontSize: 13, color: '#f59e0b' }} />
                        <span style={{ fontSize: 13 }}>trở lên</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: borderCol, marginBottom: 24 }} />

            {/* Brands */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: subCol, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Thương hiệu
              </div>
              
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                borderRadius: 12, padding: '8px 12px',
                marginBottom: 16,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                transition: 'all 0.2s',
              }}>
                <SearchOutlined style={{ color: subCol, fontSize: 15 }} />
                <input
                  onChange={(e) => setBrandSearch(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: textCol, width: '100%', fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {brandList
                  .filter(b => b.name.toLowerCase().includes((brandSearch || '').toLowerCase()))
                  .map(b => {
                    const active = brands.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBrands(active ? brands.filter(x => x !== b.id) : [...brands, b.id])}
                        style={{
                          padding: '5px 14px', borderRadius: 20, border: 'none',
                          cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                          background: active ? '#10b981' : (isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'),
                          color: active ? '#fff' : textCol,
                          boxShadow: active ? '0 2px 8px rgba(16,185,129,0.35)' : 'none',
                        }}
                      >
                        {b.name}
                      </button>
                    );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* ── Right: Products ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Toolbar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 24, flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <Title level={3} style={{ color: textCol, margin: 0, fontWeight: 800 }}>
                {searchQuery ? `Kết quả: "${searchQuery}"` : activeCatName}
              </Title>
              {!loading && (
                <Text style={{ color: subCol, fontSize: 13 }}>
                  {totalProducts.toLocaleString()} sản phẩm
                </Text>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Filter toggle */}
              <button
                onClick={() => setSidebarOpen(v => !v)}
                style={{
                  padding: '8px 16px', borderRadius: 12, border: `1px solid ${borderCol}`,
                  background: sidebarOpen ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : cardBg,
                  color: sidebarOpen ? '#10b981' : textCol,
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                }}
              >
                <FilterOutlined /> {sidebarOpen ? 'Ẩn bộ lọc' : 'Bộ lọc'}
                {hasActiveFilters && (
                  <span style={{
                    background: '#10b981', color: '#fff', borderRadius: '50%',
                    width: 18, height: 18, fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {[appliedMinPrice, appliedMaxPrice, ...brands, minRating > 0 ? 1 : null].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Sort */}
              <Select
                value={sort} onChange={val => { setSort(val); setCurrentPage(1); }}
                style={{ width: 160, borderRadius: 12 }}
                options={[
                  { value: 'newest', label: '🕐 Mới nhất' },
                  { value: 'best_selling', label: '🔥 Bán chạy' },
                  { value: 'price_asc', label: '💰 Giá tăng dần' },
                  { value: 'price_desc', label: '💎 Giá giảm dần' },
                ]}
              />

              {/* View mode toggle */}
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${borderCol}` }}>
                {[['grid', <AppstoreOutlined />], ['list', <BarsOutlined />]].map(([mode, icon]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '8px 12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      background: viewMode === mode ? '#10b981' : cardBg,
                      color: viewMode === mode ? '#fff' : subCol,
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {appliedMinPrice !== null && (
                <Tag closable onClose={() => { setMinPrice(null); setAppliedMinPrice(null); }}
                  color="green" style={{ borderRadius: 20, padding: '4px 12px', fontWeight: 600 }}>
                  Từ {appliedMinPrice.toLocaleString('vi-VN')} đ
                </Tag>
              )}
              {appliedMaxPrice !== null && (
                <Tag closable onClose={() => { setMaxPrice(null); setAppliedMaxPrice(null); }}
                  color="green" style={{ borderRadius: 20, padding: '4px 12px', fontWeight: 600 }}>
                  Đến {appliedMaxPrice.toLocaleString('vi-VN')} đ
                </Tag>
              )}
              {brands.map(bid => {
                const b = brandList.find(x => x.id === bid);
                return b ? (
                  <Tag key={bid} closable onClose={() => setBrands(brands.filter(x => x !== bid))}
                    color="green" style={{ borderRadius: 20, padding: '4px 12px', fontWeight: 600 }}>
                    {b.name}
                  </Tag>
                ) : null;
              })}
              {minRating > 0 && (
                <Tag closable onClose={() => setMinRating(0)}
                  color="green" style={{ borderRadius: 20, padding: '4px 12px', fontWeight: 600 }}>
                  ⭐ {minRating}+ sao
                </Tag>
              )}
            </div>
          )}

          {/* Product grid */}
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(220px, 1fr))' : '1fr',
              gap: 20,
            }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} isDark={isDark} />)}
            </div>
          ) : products.length === 0 ? (
            <div style={{
              background: cardBg, border: `1px solid ${borderCol}`,
              borderRadius: 24, padding: 64, textAlign: 'center',
            }}>
              {isAiLoading && (
                <div>
                  <RobotOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 16 }} />
                  <br /><Spin size="large" />
                  <div style={{ marginTop: 16, color: '#10b981', fontWeight: 600 }}>AI đang tìm kiếm...</div>
                </div>
              )}
              {!isAiLoading && aiSearchDone && aiResults.length > 0 && (
                <>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 20px', marginBottom: 28, borderRadius: 20,
                    background: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981', fontWeight: 700,
                  }}>
                    <BulbOutlined /> AI: {aiHint}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 20, textAlign: 'left',
                  }}>
                    {aiResults.map(p => (
                      <ProductCard key={p.id} p={p} isDark={isDark} navigate={navigate} addToCart={addToCart} t={t} />
                    ))}
                  </div>
                </>
              )}
              {!isAiLoading && aiSearchDone && aiResults.length === 0 && (
                <Empty description={<span style={{ color: subCol }}>Không tìm thấy sản phẩm phù hợp</span>} />
              )}
              {!isAiLoading && !aiSearchDone && (
                <Empty description={<span style={{ color: subCol }}>Không có sản phẩm nào</span>} />
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid'
                ? 'repeat(auto-fill, minmax(220px, 1fr))'
                : '1fr',
              gap: viewMode === 'grid' ? 20 : 14,
            }}>
              {products.map(p => (
                viewMode === 'grid' ? (
                  <ProductCard key={p.id} p={p} isDark={isDark} navigate={navigate} addToCart={addToCart} t={t} />
                ) : (
                  // List view
                  <div
                    key={p.id}
                    onClick={() => navigate(`/product/${p.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px',
                      borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                      background: cardBg, border: `1px solid ${borderCol}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.1)'; e.currentTarget.style.borderColor = '#10b981'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = borderCol; }}
                  >
                    <img alt={p.name} src={p.image} width={80} height={80}
                      style={{ objectFit: 'contain', borderRadius: 12, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', padding: 8 }}
                      onError={e => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: textCol, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <Rate disabled defaultValue={Math.round(p.rating || 0)} style={{ fontSize: 11, color: '#f59e0b' }} />
                      <span style={{ fontSize: 11, color: subCol, marginLeft: 6 }}>({p.sold || 0})</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{p.price.toLocaleString('vi-VN')} đ</div>
                      {p.original_price > p.price && (
                        <div style={{ fontSize: 12, color: subCol, textDecoration: 'line-through' }}>{p.original_price.toLocaleString('vi-VN')} đ</div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); addToCart(p); }}
                      style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(16,185,129,0.12)', color: '#10b981', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.color = '#10b981'; }}
                    >
                      <ShoppingCartOutlined />
                    </button>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalProducts > 16 && (
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Pagination
                current={currentPage}
                total={totalProducts}
                pageSize={16}
                onChange={page => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                showSizeChanger={false}
                showTotal={(total, range) => (
                  <span style={{ color: subCol, fontSize: 13 }}>
                    {range[0]}–{range[1]} / {total.toLocaleString()} sản phẩm
                  </span>
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}
