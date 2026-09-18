import { useState, useEffect, useMemo } from 'react';
import { Typography, Spin, Empty, Slider, Pagination, Input, Modal, message, Select, Popover, InputNumber } from 'antd';
import {
  ShoppingOutlined,
  RobotOutlined,
  BulbOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
  CloseOutlined,
  CheckOutlined,
  HeartOutlined,
  HeartFilled,
  MobileOutlined,
  LaptopOutlined,
  TabletOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  UsbOutlined,
  CustomerServiceOutlined,
  CameraOutlined,
  HomeOutlined,
  WifiOutlined,
  DesktopOutlined,
  InboxOutlined
} from '@ant-design/icons';

const CAT_ICON_MAP = {
  'cat-phone': <MobileOutlined />,
  'cat-laptop': <LaptopOutlined />,
  'cat-tablet': <TabletOutlined />,
  'cat-watch': <ClockCircleOutlined />,
  'cat-mobile-acc': <ApiOutlined />,
  'cat-laptop-acc': <UsbOutlined />,
  'cat-audio': <CustomerServiceOutlined />,
  'cat-camera': <CameraOutlined />,
  'cat-smarthome': <HomeOutlined />,
  'cat-network': <WifiOutlined />,
  'cat-gaming': <DesktopOutlined />
};
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

// ── Skeleton Card ────────────────────────────────────────────────
function SkeletonCard({ isDark }) {
  const base = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';
  const shine = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';
  return (
    <div style={{
      borderRadius: 24, overflow: 'hidden', padding: 16,
      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
      border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f0f0f2',
    }}>
      <div style={{ height: 220, borderRadius: 20, background: `linear-gradient(90deg,${base} 25%,${shine} 50%,${base} 75%)`, backgroundSize: '400% 100%', animation: 'shimmer 1.5s infinite', marginBottom: 16 }} />
      <div style={{ height: 12, borderRadius: 6, background: base, marginBottom: 10, width: '40%' }} />
      <div style={{ height: 16, borderRadius: 8, background: base, marginBottom: 8, width: '85%' }} />
      <div style={{ height: 16, borderRadius: 8, background: base, marginBottom: 16, width: '60%' }} />
      <div style={{ height: 36, borderRadius: 9999, background: base, width: '65%', margin: '0 auto' }} />
    </div>
  );
}

// ── Product Card (No Rating, Pill Price Button, Heart Wishlist) ─────
function ProductCard({ p, isDark, navigate, addToCart, isFavorited, onToggleFavorite }) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const discount = p.original_price > p.price
    ? Math.round((1 - p.price / p.original_price) * 100)
    : 0;
  const isTopItem = (p.sold && p.sold > 40) || p.is_featured;

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    const pToAdd = {
      ...p,
      price: Number(p.price || 0),
      selectedVariant: null
    };
    addToCart(pToAdd, 1, false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/product/${p.id}`)}
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        cursor: 'pointer',
        background: isDark ? '#121722' : '#ffffff',
        border: isDark
          ? `1px solid ${hovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`
          : `1px solid ${hovered ? '#e4e4e7' : '#f0f0f2'}`,
        boxShadow: hovered
          ? (isDark ? '0 16px 36px rgba(0,0,0,0.5)' : '0 16px 36px rgba(0,0,0,0.06)')
          : (isDark ? '0 4px 16px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.02)'),
        transform: hovered ? 'translateY(-4px)' : 'none',
        transition: 'all 0.25s cubic-bezier(.16,1,.3,1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        padding: '16px 16px 20px',
      }}
    >
      {/* Top Bar on Card: Wishlist Heart */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 3,
      }}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(p.id);
          }}
          title={isFavorited ? 'Bỏ yêu thích' : 'Yêu thích'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: isDark ? 'rgba(255,255,255,0.1)' : '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isFavorited ? (
            <HeartFilled style={{ fontSize: 16, color: '#ef4444' }} />
          ) : (
            <HeartOutlined style={{ fontSize: 16, color: isDark ? '#ffffff' : '#6b7280' }} />
          )}
        </div>
      </div>

      {/* Image Area */}
      <div style={{
        background: isDark ? '#0d131f' : '#f5f5f7',
        borderRadius: 20,
        height: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 16,
        marginBottom: 16,
      }}>
        {/* Badges */}
        {discount > 0 ? (
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: '#ef4444',
            color: '#fff',
            fontWeight: 700,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 12,
            letterSpacing: '0.02em',
          }}>
            -{discount}%
          </div>
        ) : isTopItem ? (
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: '#fbbf24',
            color: '#78350f',
            fontWeight: 700,
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 12,
            letterSpacing: '0.02em',
          }}>
            Top item
          </div>
        ) : null}

        <img
          alt={p.name}
          src={p.image}
          loading="lazy"
          style={{
            maxWidth: '85%',
            maxHeight: '85%',
            objectFit: 'contain',
            mixBlendMode: isDark ? 'normal' : 'multiply',
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 0.35s ease',
          }}
          onError={(e) => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }}
        />
      </div>

      {/* Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          {/* Category Name */}
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? 'rgba(255,255,255,0.45)' : '#9ca3af',
            marginBottom: 4,
          }}>
            {p.category_name || p.Category?.name || 'TECHNOLOGY'}
          </div>

          {/* Product Title */}
          <h4 style={{
            fontSize: 15,
            fontWeight: 600,
            color: isDark ? '#ffffff' : '#18181b',
            margin: '0 0 12px 0',
            lineHeight: 1.4,
            height: 42,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {p.name}
          </h4>
        </div>

        {/* Price & Action Pill Button matching reference mockup */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginTop: 'auto',
          paddingTop: 6,
          flexWrap: 'wrap',
        }}>
          {p.original_price > p.price && (
            <span style={{
              fontSize: 13,
              color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af',
              textDecoration: 'line-through',
            }}>
              {Math.round(p.original_price).toLocaleString('vi-VN')} đ
            </span>
          )}

          {/* Pill Button with Cart Icon & Price */}
          <button
            onClick={handleQuickAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 9999,
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e4e4e7'}`,
              background: added
                ? '#10b981'
                : (isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'),
              color: added
                ? '#ffffff'
                : (isDark ? '#ffffff' : '#18181b'),
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(.16,1,.3,1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => {
              if (!added) {
                e.currentTarget.style.borderColor = isDark ? '#ffffff' : '#000000';
                e.currentTarget.style.background = isDark ? '#ffffff' : '#000000';
                e.currentTarget.style.color = isDark ? '#000000' : '#ffffff';
              }
            }}
            onMouseLeave={e => {
              if (!added) {
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : '#e4e4e7';
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff';
                e.currentTarget.style.color = isDark ? '#ffffff' : '#18181b';
              }
            }}
          >
            {added ? (
              <>
                <CheckOutlined style={{ fontSize: 13 }} /> Đã thêm
              </>
            ) : (
              <>
                <ShoppingOutlined style={{ fontSize: 13 }} /> {Math.round(p.price).toLocaleString('vi-VN')} đ
              </>
            )}
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

  // Filters state
  const [brands, setBrands] = useState([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(50000000);
  const [appliedMinPrice, setAppliedMinPrice] = useState(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState(null);

  // Wishlist state (local + remote synced)
  const [wishlistIds, setWishlistIds] = useState([]);

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryModalSearch, setCategoryModalSearch] = useState('');
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // AI search
  const [aiResults, setAiResults] = useState([]);
  const [aiHint, setAiHint] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSearchDone, setAiSearchDone] = useState(false);

  const { addToCart } = useCart();
  const { isDark, t, selectedBranch, b2cUser } = useApp();
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

  // Load wishlist
  useEffect(() => {
    if (b2cUser?.id) {
      api.b2c.getWishlist(b2cUser.id)
        .then(res => {
          if (Array.isArray(res)) setWishlistIds(res.map(item => item.product_id || item.id));
        })
        .catch(() => {});
    }
  }, [b2cUser]);

  const handleToggleFavorite = async (productId) => {
    const isFav = wishlistIds.includes(productId);
    if (isFav) {
      setWishlistIds(prev => prev.filter(id => id !== productId));
      message.info('Đã xoá khỏi danh sách yêu thích');
    } else {
      setWishlistIds(prev => [...prev, productId]);
      message.success('Đã thêm vào danh sách yêu thích');
    }

    if (b2cUser?.id) {
      try {
        await api.b2c.toggleWishlist(b2cUser.id, productId);
      } catch (err) {
        console.warn('Wishlist sync err:', err);
      }
    }
  };

  // Main data loader
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let [prodData, catData, brandData, activeCatData] = await Promise.all([
          api.b2c.getProducts(categoryFilter, searchQuery, sort, selectedBranch?.id, currentPage, 24, brands),
          api.b2c.getCategories(),
          api.b2c.getBrands(),
          api.b2c.getActiveCategories(selectedBranch?.id || ''),
        ]);

        let allProds = prodData.data || [];
        if (appliedMinPrice !== null) allProds = allProds.filter(p => p.price >= appliedMinPrice);
        if (appliedMaxPrice !== null) allProds = allProds.filter(p => p.price <= appliedMaxPrice);

        setProducts(allProds);
        setTotalProducts(prodData.total || 0);
        setCategories(catData || []);
        setBrandList(brandData || []);
        setActiveCategories(activeCatData || []);

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
  }, [categoryFilter, searchQuery, sort, selectedBranch, appliedMinPrice, appliedMaxPrice, brands, currentPage]);

  const applyPriceFilter = () => {
    setAppliedMinPrice(minPrice);
    setAppliedMaxPrice(maxPrice);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setMinPrice(0);
    setMaxPrice(50000000);
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
    setBrands([]);
    setCurrentPage(1);
  };

  const hasActiveFilters = appliedMinPrice !== null || appliedMaxPrice !== null || brands.length > 0;

  // Toggle brand selection
  const handleToggleBrand = (brandId) => {
    setBrands(prev =>
      prev.includes(brandId) ? prev.filter(id => id !== brandId) : [...prev, brandId]
    );
    setCurrentPage(1);
  };

  // Grouped hierarchical categories for Modal
  const hierarchicalCategories = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    const result = parents.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parent_id === parent.id)
    }));

    if (!categoryModalSearch.trim()) return result;
    const q = categoryModalSearch.trim().toLowerCase();

    return result
      .map(parent => {
        const parentMatch = parent.name.toLowerCase().includes(q);
        const matchedChildren = parent.children.filter(ch => ch.name.toLowerCase().includes(q));
        if (parentMatch) return parent;
        if (matchedChildren.length > 0) return { ...parent, children: matchedChildren };
        return null;
      })
      .filter(Boolean);
  }, [categories, categoryModalSearch]);

  const handleSelectCategory = (catId) => {
    setIsCategoryModalOpen(false);
    navigate(catId === 'ALL' ? '/shop' : `/shop?category=${catId}`);
  };

  // Active category display name
  const rootCategories = categories.filter(c => !c.parent_id);
  const activeCatName = categoryFilter === 'ALL'
    ? t('shop.all_products')
    : (categories.find(c => c.id === categoryFilter)?.name || t('shop.all_products'));

  const bg = isDark ? '#090d16' : '#ffffff';
  const cardBg = isDark ? '#121722' : '#ffffff';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
  const textCol = isDark ? '#ffffff' : '#111111';
  const subCol = isDark ? 'rgba(255,255,255,0.6)' : '#71717a';

  const categoryPopoverContent = (
    <div style={{ width: 800, padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: textCol }}>
            Toàn bộ danh mục sản phẩm
          </h2>
          <p style={{ margin: 0, color: subCol, fontSize: 13 }}>
            Chọn bất kỳ danh mục nào bên dưới để lọc sản phẩm tức thì
          </p>
        </div>
      </div>

      {/* Category Search Input */}
      <div style={{ marginBottom: 20 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#9ca3af', marginRight: 6 }} />}
          placeholder="Tìm kiếm danh mục (ví dụ: Điện thoại, Cáp sạc, Tablet...)"
          value={categoryModalSearch}
          onChange={e => setCategoryModalSearch(e.target.value)}
          allowClear
          style={{
            height: 40,
            borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
            color: textCol,
            fontSize: 13.5,
            padding: '0 16px',
          }}
        />
      </div>

      {/* Hierarchical Categories View */}
      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
        {hierarchicalCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: subCol }}>
            Không tìm thấy danh mục phù hợp.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {hierarchicalCategories.map(parent => (
              <div
                key={parent.id}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                  borderRadius: 16,
                  padding: 16,
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f2',
                }}
              >
                {/* Parent Category */}
                <div
                  onClick={() => handleSelectCategory(parent.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderRadius: 10,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>
                      {CAT_ICON_MAP[parent.id] || <InboxOutlined />}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: textCol }}>
                      {parent.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: isDark ? '#ffffff' : '#000000' }}>
                    Xem tất cả →
                  </span>
                </div>

                {/* Subcategories Pills */}
                {parent.children && parent.children.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingLeft: 8 }}>
                    {parent.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => handleSelectCategory(child.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 9999,
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                          color: isDark ? 'rgba(255,255,255,0.85)' : '#374151',
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = isDark ? '#ffffff' : '#111111';
                          e.currentTarget.style.color = isDark ? '#000000' : '#ffffff';
                          e.currentTarget.style.borderColor = isDark ? '#ffffff' : '#111111';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
                          e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.85)' : '#374151';
                          e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';
                        }}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      paddingTop: 0,
      minHeight: '100vh',
      background: bg,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>

      {/* ── 1. Top Category Pill Tabs Bar (Matches mockup pill tag design) ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 90,
        background: isDark ? 'rgba(9, 13, 22, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${borderCol}`,
        padding: '14px 0',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: 2,
          }}>
            {/* Pill 1: Tất cả */}
            <button
              onClick={() => handleSelectCategory('ALL')}
              style={{
                padding: '9px 22px',
                borderRadius: 9999,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13.5,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s cubic-bezier(.16,1,.3,1)',
                background: categoryFilter === 'ALL'
                  ? (isDark ? '#ffffff' : '#111111')
                  : (isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                color: categoryFilter === 'ALL'
                  ? (isDark ? '#000000' : '#ffffff')
                  : (isDark ? 'rgba(255,255,255,0.75)' : '#4b5563'),
                boxShadow: categoryFilter === 'ALL' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              Tất cả
            </button>

            {/* Pill 2: Tab đặc biệt "Danh mục" (mở Popover) */}
            <Popover
              content={categoryPopoverContent}
              trigger="hover"
              placement="bottomLeft"
              overlayInnerStyle={{ borderRadius: 20, padding: 24, background: isDark ? '#0f172a' : '#ffffff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)' }}
            >
              <button
                style={{
                  padding: '9px 16px',
                  borderRadius: 9999,
                  border: isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13.5,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  color: isDark ? '#ffffff' : '#111111',
                  boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = isDark ? '#ffffff' : '#000000';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.18)' : '#e5e7eb';
                }}
              >
                <AppstoreOutlined style={{ fontSize: 16 }} />
                Danh mục
              </button>
            </Popover>
          </div>
        </div>
      </div>

      {/* ── 2. Main Layout (Sidebar + Products Grid) ── */}
      <div style={{
        display: 'flex',
        maxWidth: 1400,
        margin: '0 auto',
        padding: '32px 32px 64px',
        gap: 32,
      }}>

        {/* ── Left Sidebar Filter ── */}
        {sidebarOpen && (
          <aside style={{
            width: 270,
            flexShrink: 0,
            alignSelf: 'flex-start',
            position: 'sticky',
            top: 150,
            maxHeight: 'calc(100vh - 170px)',
            overflowY: 'auto',
            paddingRight: 4,
          }}>

            {/* Filter Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: textCol, display: 'flex', alignItems: 'center', gap: 8 }}>
                Bộ lọc
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CloseOutlined /> Xoá lọc
                </button>
              )}
            </div>

            {/* Card 1: Khoảng giá (Price Range — ĐÃ BỎ BIỂU ĐỒ theo yêu cầu) */}
            <div style={{
              background: cardBg,
              border: `1px solid ${borderCol}`,
              borderRadius: 20,
              padding: '20px 20px',
              marginBottom: 20,
              boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: textCol }}>
                  Khoảng giá
                </span>
                {(appliedMinPrice !== null || appliedMaxPrice !== null) && (
                  <button
                    onClick={() => {
                      setMinPrice(100000);
                      setMaxPrice(50000000);
                      setAppliedMinPrice(null);
                      setAppliedMaxPrice(null);
                      setCurrentPage(1);
                    }}
                    style={{
                      background: 'none', border: 'none', color: isDark ? '#9ca3af' : '#71717a',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div style={{ fontSize: 12, color: subCol, marginBottom: 18 }}>
                {appliedMinPrice !== null || appliedMaxPrice !== null
                  ? `${(appliedMinPrice || 100000).toLocaleString('vi-VN')} đ — ${(appliedMaxPrice || 50000000).toLocaleString('vi-VN')} đ`
                  : 'Lọc theo ngân sách sản phẩm'}
              </div>

              {/* Clean Range Slider (No Histogram / Chart) */}
              <Slider
                range
                min={100000}
                max={50000000}
                step={100000}
                value={[minPrice, maxPrice]}
                onChange={([valMin, valMax]) => {
                  setMinPrice(valMin);
                  setMaxPrice(valMax);
                }}
                styles={{
                  track: { background: isDark ? '#ffffff' : '#111111', height: 4 },
                  rail: { background: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb', height: 4 },
                  handle: {
                    borderColor: isDark ? '#ffffff' : '#111111',
                    background: isDark ? '#111111' : '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    marginTop: -5,
                  }
                }}
              />

              {/* Price Pill Values */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <InputNumber
                  min={100000}
                  max={50000000}
                  step={100000}
                  value={minPrice}
                  onChange={v => { if (v !== null) setMinPrice(v) }}
                  formatter={value => `${value} đ`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={value => value?.replace(/\D/g, '')}
                  bordered={false}
                  controls={false}
                  style={{
                    flex: 1,
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                    borderRadius: 10,
                    color: textCol,
                    fontWeight: 600,
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                />
                <span style={{ color: subCol, fontSize: 12 }}>—</span>
                <InputNumber
                  min={100000}
                  max={50000000}
                  step={100000}
                  value={maxPrice}
                  onChange={v => { if (v !== null) setMaxPrice(v) }}
                  formatter={value => `${value} đ`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={value => value?.replace(/\D/g, '')}
                  bordered={false}
                  controls={false}
                  style={{
                    flex: 1,
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                    borderRadius: 10,
                    color: textCol,
                    fontWeight: 600,
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                />
              </div>

              {/* Apply Price Button */}
              <button
                onClick={applyPriceFilter}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: '9px 0',
                  borderRadius: 12,
                  background: isDark ? '#ffffff' : '#111111',
                  color: isDark ? '#111111' : '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Áp dụng giá
              </button>
            </div>

            {/* Card 2: Thương hiệu (Brand — Tick màu đen + Show more popup) */}
            <div style={{
              background: cardBg,
              border: `1px solid ${borderCol}`,
              borderRadius: 20,
              padding: '20px 20px',
              boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: textCol }}>
                  Thương hiệu
                </span>
                {brands.length > 0 && (
                  <button
                    onClick={() => { setBrands([]); setCurrentPage(1); }}
                    style={{
                      background: 'none', border: 'none', color: isDark ? '#9ca3af' : '#71717a',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Brand list with custom BLACK checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {brandList.slice(0, 7).map(b => {
                  const isChecked = brands.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleToggleBrand(b.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: '4px 2px',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{
                        fontSize: 13.5,
                        fontWeight: isChecked ? 600 : 400,
                        color: isChecked ? textCol : subCol,
                      }}>
                        {b.name}
                      </span>

                      {/* Custom Black Tick Checkbox */}
                      <div style={{
                        width: 19,
                        height: 19,
                        borderRadius: 5,
                        border: isChecked
                          ? `2px solid ${isDark ? '#ffffff' : '#000000'}`
                          : `1.5px solid ${isDark ? 'rgba(255,255,255,0.3)' : '#d1d5db'}`,
                        background: isChecked
                          ? (isDark ? '#ffffff' : '#000000')
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}>
                        {isChecked && (
                          <CheckOutlined style={{
                            fontSize: 11,
                            color: isDark ? '#000000' : '#ffffff',
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* More Brands Button (Opens Popup) */}
              {brandList.length > 7 && (
                <button
                  onClick={() => setIsBrandModalOpen(true)}
                  style={{
                    marginTop: 14,
                    background: 'none',
                    border: 'none',
                    padding: '6px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    color: isDark ? '#38bdf8' : '#2563eb',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Khác ({brandList.length - 7}+) →
                </button>
              )}
            </div>

          </aside>
        )}

        {/* ── Right Column: Products List ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Toolbar Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              <Title level={3} style={{ color: textCol, margin: 0, fontWeight: 700, fontSize: 22 }}>
                {searchQuery ? `Kết quả: "${searchQuery}"` : activeCatName}
              </Title>
              {!loading && (
                <Text style={{ color: subCol, fontSize: 13 }}>
                  {totalProducts.toLocaleString()} sản phẩm tìm thấy
                </Text>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Filter toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 14,
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                  color: textCol,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                {sidebarOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
                {hasActiveFilters && (
                  <span style={{
                    background: isDark ? '#ffffff' : '#000000',
                    color: isDark ? '#000000' : '#ffffff',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {[appliedMinPrice, appliedMaxPrice, ...brands].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Sort Select */}
              <Select
                value={sort}
                onChange={val => { setSort(val); setCurrentPage(1); }}
                style={{ width: 160, borderRadius: 12 }}
                options={[
                  { value: 'newest', label: 'Mới nhất' },
                  { value: 'best_selling', label: 'Bán chạy' },
                  { value: 'price_asc', label: 'Giá tăng dần' },
                  { value: 'price_desc', label: 'Giá giảm dần' },
                ]}
              />

              {/* View mode toggle */}
              <div style={{ display: 'flex', borderRadius: 9999, overflow: 'hidden', border: `1px solid ${borderCol}` }}>
                {[['grid', <AppstoreOutlined />], ['list', <BarsOutlined />]].map(([mode, icon]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '8px 12px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: viewMode === mode ? (isDark ? '#ffffff' : '#111111') : cardBg,
                      color: viewMode === mode ? (isDark ? '#000000' : '#ffffff') : subCol,
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active filter tags */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {appliedMinPrice !== null && (
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
                  color: textCol,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  Từ {appliedMinPrice.toLocaleString('vi-VN')} đ
                  <CloseOutlined
                    style={{ cursor: 'pointer', fontSize: 10 }}
                    onClick={() => { setMinPrice(0); setAppliedMinPrice(null); }}
                  />
                </div>
              )}
              {appliedMaxPrice !== null && (
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
                  color: textCol,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  Đến {appliedMaxPrice.toLocaleString('vi-VN')} đ
                  <CloseOutlined
                    style={{ cursor: 'pointer', fontSize: 10 }}
                    onClick={() => { setMaxPrice(50000000); setAppliedMaxPrice(null); }}
                  />
                </div>
              )}
              {brands.map(bid => {
                const b = brandList.find(x => x.id === bid);
                return b ? (
                  <div
                    key={bid}
                    style={{
                      background: isDark ? '#ffffff' : '#111111',
                      color: isDark ? '#000000' : '#ffffff',
                      padding: '4px 12px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {b.name}
                    <CloseOutlined
                      style={{ cursor: 'pointer', fontSize: 10 }}
                      onClick={() => setBrands(brands.filter(x => x !== bid))}
                    />
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Product Grid / List */}
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : '1fr',
              gap: 24,
            }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} isDark={isDark} />)}
            </div>
          ) : products.length === 0 ? (
            <div style={{
              background: cardBg,
              border: `1px solid ${borderCol}`,
              borderRadius: 24,
              padding: 64,
              textAlign: 'center',
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
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 24, textAlign: 'left',
                  }}>
                    {aiResults.map(p => (
                      <ProductCard
                        key={p.id}
                        p={p}
                        isDark={isDark}
                        navigate={navigate}
                        addToCart={addToCart}
                        isFavorited={wishlistIds.includes(p.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                </>
              )}
              {!isAiLoading && aiSearchDone && aiResults.length === 0 && (
                <Empty description={<span style={{ color: subCol }}>Không tìm thấy sản phẩm phù hợp với bộ lọc</span>} />
              )}
              {!isAiLoading && !aiSearchDone && (
                <Empty description={<span style={{ color: subCol }}>Không có sản phẩm nào</span>} />
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid'
                ? 'repeat(auto-fill, minmax(260px, 1fr))'
                : '1fr',
              gap: viewMode === 'grid' ? 24 : 16,
            }}>
              {products.map(p => (
                viewMode === 'grid' ? (
                  <ProductCard
                    key={p.id}
                    p={p}
                    isDark={isDark}
                    navigate={navigate}
                    addToCart={addToCart}
                    isFavorited={wishlistIds.includes(p.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ) : (
                  // List View (No Rating, Pill Price Button)
                  <div
                    key={p.id}
                    onClick={() => navigate(`/product/${p.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 20,
                      padding: '16px 20px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: cardBg,
                      border: `1px solid ${borderCol}`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <img
                      alt={p.name}
                      src={p.image}
                      width={84}
                      height={84}
                      style={{
                        objectFit: 'contain',
                        borderRadius: 14,
                        background: isDark ? 'rgba(0,0,0,0.2)' : '#f5f5f7',
                        padding: 8,
                        mixBlendMode: isDark ? 'normal' : 'multiply',
                      }}
                      onError={e => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: subCol, marginBottom: 2 }}>
                        {p.category_name || p.Category?.name || 'TECHNOLOGY'}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: textCol, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const pToAdd = {
                            ...p,
                            price: Number(p.price || 0),
                            selectedVariant: null
                          };
                          addToCart(pToAdd, 1, false);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 18px',
                          borderRadius: 9999,
                          border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#e4e4e7'}`,
                          background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                          color: textCol,
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: 'pointer',
                        }}
                      >
                        <ShoppingOutlined /> {Math.round(p.price).toLocaleString('vi-VN')} đ
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalProducts > 24 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 48, marginBottom: 40, width: '100%' }}>
              <div className="modern-pagination-container">
                <Pagination
                  current={currentPage}
                  total={totalProducts}
                  pageSize={24}
                  onChange={page => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  showSizeChanger={false}
                  itemRender={(page, type, originalElement) => {
                    if (type === 'prev') {
                      return (
                        <span className="custom-pag-arrow" title="Trang trước">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                          </svg>
                        </span>
                      );
                    }
                    if (type === 'next') {
                      return (
                        <span className="custom-pag-arrow" title="Trang sau">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      );
                    }
                    if (type === 'page') {
                      return <span className="custom-pag-num">{page}</span>;
                    }
                    if (type === 'jump-prev' || type === 'jump-next') {
                      return <span className="custom-pag-dots">•••</span>;
                    }
                    return originalElement;
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>



      {/* ── 4. Brand Selection Modal ("More Brand") ── */}
      <Modal
        open={isBrandModalOpen}
        onCancel={() => { setIsBrandModalOpen(false); setBrandSearch(''); }}
        footer={null}
        width={700}
        centered
        styles={{
          content: {
            borderRadius: 24,
            padding: '30px 34px',
            background: isDark ? '#0f172a' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
          }
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0', color: textCol }}>
                Tất cả thương hiệu
              </h3>
              <p style={{ margin: 0, color: subCol, fontSize: 13 }}>
                Chọn một hoặc nhiều thương hiệu để lọc sản phẩm
              </p>
            </div>
            {brands.length > 0 && (
              <button
                onClick={() => setBrands([])}
                style={{
                  background: 'none', border: 'none', color: '#ef4444',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Bỏ chọn tất cả ({brands.length})
              </button>
            )}
          </div>

          {/* Search Brand */}
          <Input
            prefix={<SearchOutlined style={{ color: '#9ca3af', marginRight: 6 }} />}
            placeholder="Tìm nhanh thương hiệu..."
            value={brandSearch}
            onChange={e => setBrandSearch(e.target.value)}
            allowClear
            style={{
              height: 42,
              borderRadius: 12,
              marginBottom: 18,
              background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
              color: textCol,
              padding: '0 16px',
            }}
          />

          {/* Brands Grid */}
          <div style={{
            maxHeight: '52vh',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            paddingRight: 6,
          }}>
            {brandList
              .filter(b => b.name.toLowerCase().includes(brandSearch.trim().toLowerCase()))
              .map(b => {
                const isChecked = brands.includes(b.id);
                return (
                  <div
                    key={b.id}
                    onClick={() => handleToggleBrand(b.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isChecked
                        ? (isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5')
                        : (isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                      cursor: 'pointer',
                      border: isChecked
                        ? `1.5px solid ${isDark ? '#ffffff' : '#000000'}`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: isChecked ? 600 : 400, color: textCol }}>
                      {b.name}
                    </span>

                    {/* Black Checkbox */}
                    <div style={{
                      width: 19,
                      height: 19,
                      borderRadius: 5,
                      border: isChecked
                        ? `2px solid ${isDark ? '#ffffff' : '#000000'}`
                        : `1.5px solid ${isDark ? 'rgba(255,255,255,0.3)' : '#d1d5db'}`,
                      background: isChecked
                        ? (isDark ? '#ffffff' : '#000000')
                        : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isChecked && (
                        <CheckOutlined style={{
                          fontSize: 11,
                          color: isDark ? '#000000' : '#ffffff',
                        }} />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 12 }}>
            <button
              onClick={() => setIsBrandModalOpen(false)}
              style={{
                padding: '10px 24px',
                borderRadius: 9999,
                border: 'none',
                background: isDark ? '#ffffff' : '#111111',
                color: isDark ? '#000000' : '#ffffff',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              Áp dụng ({brands.length} đã chọn)
            </button>
          </div>
        </div>
      </Modal>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}
