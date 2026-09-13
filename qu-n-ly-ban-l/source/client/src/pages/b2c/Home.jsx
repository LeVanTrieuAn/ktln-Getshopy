import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Spin, Modal, Input } from 'antd';
import {
  SearchOutlined,
  ShoppingOutlined,
  CheckOutlined,
  AppstoreOutlined,
  RightOutlined,
  ArrowRightOutlined,
  MobileOutlined,
  LaptopOutlined,
  CustomerServiceOutlined,
  ClockCircleOutlined,
  SkinOutlined,
  CameraOutlined,
  TabletOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

// 6 Category Cards Data
const CATEGORY_CARDS = [
  {
    id: 'cat-phone',
    title: 'Điện thoại',
    description: 'Smartphone cao cấp, camera đỉnh cao, hiệu năng vượt trội và thiết kế thời thượng.',
    linkText: 'Khám phá danh mục →',
    image: '/images/commerce/cat_phone.jpg',
    type: 'category',
    categoryKey: 'cat-phone'
  },
  {
    id: 'cat-laptop',
    title: 'Laptop',
    description: 'Máy tính xách tay mỏng nhẹ, pin trâu và hiệu năng tối ưu cho mọi tác vụ sáng tạo.',
    linkText: 'Khám phá danh mục →',
    image: '/images/commerce/cat_laptop.jpg',
    type: 'category',
    categoryKey: 'cat-laptop'
  },
  {
    id: 'cat-tablet',
    title: 'iPad & Tablet',
    description: 'Màn hình Liquid Retina sắc nét, hỗ trợ bút stylus và bàn phím, đa nhiệm mạnh mẽ mọi lúc mọi nơi.',
    linkText: 'Khám phá danh mục →',
    image: '/images/commerce/cat_tablet.jpg',
    type: 'category',
    categoryKey: 'cat-tablet'
  },
  {
    id: 'cat-mobile-acc',
    title: 'Phụ kiện',
    description: 'Ốp lưng sang trọng, củ sạc siêu nhanh, cáp chống đứt và các phụ kiện công nghệ thiết yếu.',
    linkText: 'Khám phá danh mục →',
    image: '/images/commerce/cat_phone_case.jpg',
    type: 'category',
    categoryKey: 'cat-mobile-acc'
  },
  {
    id: 'cat-watch',
    title: 'Đồng hồ thông minh',
    description: 'Theo dõi sức khoẻ chuyên sâu, đo nhịp tim, giấc ngủ và đồng hành cùng lối sống năng động.',
    linkText: 'Khám phá danh mục →',
    image: '/images/commerce/cat_smartwatch.jpg',
    type: 'category',
    categoryKey: 'cat-watch'
  },
  {
    id: 'all-categories',
    title: 'Tất cả danh mục',
    description: 'Khám phá toàn bộ 49+ danh mục thiết bị và phụ kiện công nghệ đa dạng tại GetShopy.',
    linkText: 'Xem tất cả danh mục ↗',
    image: '/images/commerce/cat_all.jpg',
    type: 'modal',
    categoryKey: 'ALL'
  }
];

export default function Home() {
  const { isDark, selectedBranch, b2cUser } = useApp();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [newestProducts, setNewestProducts] = useState([]);
  const [loadingRec, setLoadingRec] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [addedItemMap, setAddedItemMap] = useState({});

  // All Categories Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // 1. Fetch Categories
  useEffect(() => {
    api.b2c.getCategories()
      .then(data => setCategories(data || []))
      .catch(() => setCategories([]));
  }, []);

  // 2. Fetch "Dành riêng cho bạn" (Exactly 8 products from AI recommendation or personalized top picks)
  useEffect(() => {
    let ignore = false;
    async function loadRecommendations() {
      try {
        setLoadingRec(true);
        const recData = await api.recommendation.get(b2cUser?.email || '');
        if (ignore) return;
        if (Array.isArray(recData) && recData.length > 0) {
          setRecommendedProducts(recData.slice(0, 8));
        } else {
          // Fallback to top rated/bestselling items
          const res = await api.b2c.getProducts('ALL', '', 'best_selling', selectedBranch?.id, 1, 8);
          if (ignore) return;
          setRecommendedProducts(res?.data?.slice(0, 8) || []);
        }
      } catch (err) {
        if (ignore) return;
        console.warn('Rec error:', err);
        try {
          const res = await api.b2c.getProducts('ALL', '', 'best_selling', selectedBranch?.id, 1, 8);
          if (ignore) return;
          setRecommendedProducts(res?.data?.slice(0, 8) || []);
        } catch {
          if (ignore) return;
          setRecommendedProducts([]);
        }
      } finally {
        if (!ignore) setLoadingRec(false);
      }
    }
    loadRecommendations();
    return () => { ignore = true; };
  }, [selectedBranch, b2cUser]);

  // 3. Fetch "Sản phẩm mới" (Exactly 8 newest products)
  useEffect(() => {
    async function loadNewest() {
      try {
        setLoadingNew(true);
        const res = await api.b2c.getProducts('ALL', '', 'newest', selectedBranch?.id, 1, 8);
        setNewestProducts(res?.data?.slice(0, 8) || []);
      } catch (err) {
        console.warn('Newest error:', err);
        setNewestProducts([]);
      } finally {
        setLoadingNew(false);
      }
    }
    loadNewest();
  }, [selectedBranch]);

  // Handle clicking a category card
  const handleCategoryClick = (cat) => {
    if (cat.type === 'modal' || cat.id === 'all-categories') {
      setIsModalOpen(true);
    } else {
      navigate(`/shop?category=${cat.categoryKey || cat.id}`);
    }
  };

  // Handle smooth scroll to catalog section
  const scrollToCatalog = () => {
    const el = document.getElementById('catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Add to cart handler with visual feedback
  const handleAddToCart = (item, e) => {
    e?.stopPropagation();
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      stock: item.stock || 99
    });
    setAddedItemMap(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedItemMap(prev => ({ ...prev, [item.id]: false }));
    }, 2000);
  };

  // Grouped categories for the "All Categories" popup modal
  const hierarchicalCategories = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    const result = parents.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parent_id === parent.id)
    }));

    if (!modalSearch.trim()) return result;
    const q = modalSearch.trim().toLowerCase();

    return result
      .map(parent => {
        const parentMatch = parent.name.toLowerCase().includes(q);
        const matchedChildren = parent.children.filter(ch => ch.name.toLowerCase().includes(q));
        if (parentMatch) return parent;
        if (matchedChildren.length > 0) return { ...parent, children: matchedChildren };
        return null;
      })
      .filter(Boolean);
  }, [categories, modalSearch]);

  // Map category to icon
  const getCategoryIcon = (catId) => {
    if (catId.includes('phone')) return <MobileOutlined />;
    if (catId.includes('laptop')) return <LaptopOutlined />;
    if (catId.includes('tablet')) return <TabletOutlined />;
    if (catId.includes('watch')) return <ClockCircleOutlined />;
    if (catId.includes('av')) return <CustomerServiceOutlined />;
    if (catId.includes('cam')) return <CameraOutlined />;
    return <SkinOutlined />;
  };

  // Filter newest products by search query if typed
  const filteredNewestProducts = useMemo(() => {
    if (!searchQuery.trim()) return newestProducts;
    const q = searchQuery.trim().toLowerCase();
    return newestProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
    );
  }, [newestProducts, searchQuery]);

  // Helper renderer for product card matching reference template
  const renderProductCard = (product) => {
    const catName = (product.category_name || product.Category?.name || 'TECHNOLOGY').toUpperCase();
    const formattedPrice = `${Math.round(product.price).toLocaleString('vi-VN')} đ`;

    return (
      <div
        key={product.id}
        onClick={() => navigate(`/product/${product.id}`)}
        className="commerce-product-card"
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.25s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        {/* Rounded Top Image Container */}
        <div
          style={{
            background: isDark ? '#121722' : '#f5f5f7',
            borderRadius: 24,
            height: 320,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: 24,
            border: isDark ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}
        >
          <img
            src={product.image || (product.images && product.images[0]) || '/images/commerce/prod_mouse.jpg'}
            alt={product.name}
            loading="lazy"
            style={{
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain',
              mixBlendMode: isDark ? 'normal' : 'multiply',
              transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/commerce/prod_mouse.jpg';
            }}
          />

          {/* Quick Add To Bag Button */}
          <div
            onClick={(e) => handleAddToCart(product, e)}
            title="Thêm vào giỏ"
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              width: 38,
              height: 38,
              borderRadius: 19,
              background: addedItemMap[product.id]
                ? '#10b981'
                : (isDark ? 'rgba(255,255,255,0.15)' : '#18181b'),
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              zIndex: 3,
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {addedItemMap[product.id] ? (
              <CheckOutlined style={{ fontSize: 15 }} />
            ) : (
              <ShoppingOutlined style={{ fontSize: 15 }} />
            )}
          </div>
        </div>

        {/* Details below image */}
        <div style={{ marginTop: 12 }}>
          {/* Category */}
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isDark ? 'rgba(255,255,255,0.45)' : '#a1a1aa',
            marginBottom: 4,
          }}>
            {catName}
          </div>

          {/* Product Name */}
          <h4 style={{
            fontSize: 15,
            fontWeight: 600,
            margin: 0,
            color: isDark ? '#ffffff' : '#18181b',
            letterSpacing: '-0.01em',
            lineHeight: 1.4,
            height: 42,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {product.name}
          </h4>

          {/* Price */}
          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: isDark ? 'rgba(255,255,255,0.65)' : '#52525b',
            marginTop: 4,
          }}>
            {formattedPrice}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: isDark ? '#090d16' : '#ffffff',
      color: isDark ? '#ffffff' : '#18181b',
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowX: 'hidden',
    }}>

      {/* ══════════════════════════════════════════════════════════════════
           1. HERO SECTION: Minimalist 2-column layout
         ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '60px 24px 70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 40,
      }}>
        {/* Left Column: Heading + Description + Buttons */}
        <div style={{ flex: '1 1 480px', maxWidth: 580 }}>
          <h1 style={{
            fontSize: 'clamp(38px, 4.4vw, 56px)',
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
            color: isDark ? '#ffffff' : '#111111',
            margin: '0 0 20px 0',
          }}>
            High-quality tech<br />gadgets & accessories
          </h1>

          <p style={{
            fontSize: 'clamp(14px, 1.15vw, 15px)',
            lineHeight: 1.65,
            color: isDark ? 'rgba(255, 255, 255, 0.62)' : '#71717a',
            maxWidth: 440,
            margin: '0 0 34px 0',
          }}>
            Sem sit amet adipiscing ullamcorper adipiscing adipiscing duis convallis tincidunt senectus enim blandit elit egestas.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Primary Dark Pill Button */}
            <button
              onClick={scrollToCatalog}
              style={{
                background: isDark ? '#ffffff' : '#000000',
                color: isDark ? '#000000' : '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '13px 28px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Browse products
            </button>

            {/* Secondary Outline Pill Button */}
            <button
              onClick={() => {
                const el = document.getElementById('footer-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else navigate('/shop');
              }}
              style={{
                background: 'transparent',
                color: isDark ? '#ffffff' : '#18181b',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#e4e4e7'}`,
                borderRadius: 9999,
                padding: '13px 28px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              About us
            </button>
          </div>
        </div>

        {/* Right Column: Hero Smartphone with Fluted Glass */}
        <div style={{
          flex: '1 1 480px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}>
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 540,
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.04)',
            background: isDark ? '#111827' : '#f9f9fb',
          }}>
            <img
              src="/images/commerce/hero_tech_phone.jpg"
              alt="High-quality tech gadgets"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'cover',
              }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           2. 6 CATEGORY CARDS SECTION: 3 Columns x 2 Rows
         ══════════════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1320, margin: '0 auto 80px', padding: '0 24px' }}>
        <div className="commerce-categories-grid">
          {CATEGORY_CARDS.map(cat => (
            <div
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              className="commerce-category-card"
              style={{
                background: isDark ? '#121722' : '#f5f5f7',
                borderRadius: 28,
                padding: '40px 36px',
                height: 380,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.02)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 36px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card Header Content */}
              <div style={{ zIndex: 2, maxWidth: '62%' }}>
                <h3 style={{
                  fontSize: 24,
                  fontWeight: 600,
                  margin: '0 0 10px 0',
                  color: isDark ? '#ffffff' : '#111111',
                  letterSpacing: '-0.02em',
                }}>
                  {cat.title}
                </h3>
                <p style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: isDark ? 'rgba(255, 255, 255, 0.62)' : '#71717a',
                  margin: 0,
                }}>
                  {cat.description}
                </p>
              </div>

              {/* Category Image with multiply blend mode to eliminate white border box */}
              <div style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                width: '58%',
                height: '220px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                pointerEvents: 'none',
              }}>
                <img
                  src={cat.image}
                  alt={cat.title}
                  loading="lazy"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    mixBlendMode: isDark ? 'normal' : 'multiply',
                    transition: 'transform 0.35s ease',
                    filter: isDark ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' : 'drop-shadow(0 10px 20px rgba(0,0,0,0.04))',
                  }}
                />
              </div>

              {/* Button at bottom left */}
              <div style={{ zIndex: 3 }}>
                <button
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isDark ? '#ffffff' : '#111111',
                    background: 'transparent',
                    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                    borderRadius: 9999,
                    padding: '8px 18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
                    e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';
                    e.currentTarget.style.gap = '10px';
                    e.stopPropagation();
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
                    e.currentTarget.style.gap = '7px';
                  }}
                  onClick={e => { e.stopPropagation(); handleCategoryClick(cat); }}
                >
                  {cat.type === 'modal' ? 'Xem tất cả' : 'Khám phá'}
                  <ArrowRightOutlined style={{ fontSize: 11 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           3. PHẦN "DÀNH RIÊNG CHO BẠN" (Đặt trước, nổi bật hơn Sản phẩm mới)
              Load đúng 8 sản phẩm theo đúng mẫu reference
         ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        maxWidth: 1320,
        margin: '0 auto 70px',
        padding: '0 24px',
      }}>
        {/* Header Bar matching reference template line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 14,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          marginBottom: 36,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: isDark ? '#ffffff' : '#111111',
              letterSpacing: '-0.01em',
              paddingBottom: 14,
              marginBottom: -15,
              borderBottom: `2px solid ${isDark ? '#ffffff' : '#111111'}`,
              display: 'inline-block',
            }}>
              Dành riêng cho bạn
            </span>
          </div>
        </div>

        {/* Grid of 8 Recommended Products */}
        {loadingRec ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : recommendedProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>
            Chưa có dữ liệu gợi ý cho tài khoản này.
          </div>
        ) : (
          <div className="commerce-products-grid">
            {recommendedProducts.slice(0, 8).map(product => renderProductCard(product))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           4. PHẦN "SẢN PHẨM MỚI" (Load đúng 8 sản phẩm, theo mẫu reference)
         ══════════════════════════════════════════════════════════════════ */}
      <section id="catalog" style={{
        maxWidth: 1320,
        margin: '0 auto 80px',
        padding: '0 24px',
      }}>
        {/* Header Bar matching reference template */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 14,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          marginBottom: 36,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: isDark ? '#ffffff' : '#111111',
              letterSpacing: '-0.01em',
              paddingBottom: 14,
              marginBottom: -15,
              borderBottom: `2px solid ${isDark ? '#ffffff' : '#111111'}`,
              display: 'inline-block',
            }}>
              Sản phẩm mới
            </span>
          </div>

          {/* Right: Search Input matching template */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: 240,
            maxWidth: '100%',
          }}>
            <input
              type="text"
              placeholder="Search for products"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13.5,
                color: isDark ? '#ffffff' : '#111111',
                padding: '4px 0',
              }}
            />
            <SearchOutlined style={{
              fontSize: 15,
              color: isDark ? 'rgba(255,255,255,0.45)' : '#9ca3af',
              cursor: 'pointer',
            }} />
          </div>
        </div>

        {/* Grid of 8 Newest Products */}
        {loadingNew ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : filteredNewestProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>
            Không tìm thấy sản phẩm mới nào phù hợp với tìm kiếm của bạn.
          </div>
        ) : (
          <div className="commerce-products-grid">
            {filteredNewestProducts.slice(0, 8).map(product => renderProductCard(product))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           5. ALL CATEGORIES POPUP MODAL
         ══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setModalSearch(''); }}
        footer={null}
        width={920}
        centered
        styles={{
          content: {
            borderRadius: 24,
            padding: '32px 36px',
            background: isDark ? '#0f172a' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
          }
        }}
      >
        <div>
          {/* Modal Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h2 style={{
                fontSize: 24,
                fontWeight: 700,
                margin: '0 0 6px 0',
                color: isDark ? '#ffffff' : '#111111',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <AppstoreOutlined style={{ color: '#10b981' }} /> Tất cả danh mục
              </h2>
              <p style={{ margin: 0, color: isDark ? 'rgba(255,255,255,0.6)' : '#71717a', fontSize: 13.5 }}>
                Chọn danh mục bạn quan tâm để khám phá ngay các sản phẩm tương ứng
              </p>
            </div>
          </div>

          {/* Modal Search Bar */}
          <div style={{ marginBottom: 24 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#9ca3af', marginRight: 6 }} />}
              placeholder="Tìm nhanh danh mục (ví dụ: Điện thoại, Cáp sạc, Tablet...)"
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              allowClear
              style={{
                height: 44,
                borderRadius: 12,
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                color: isDark ? '#ffffff' : '#111111',
                fontSize: 14,
              }}
            />
          </div>

          {/* Categories Hierarchical List */}
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
            {hierarchicalCategories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                Không tìm thấy danh mục phù hợp.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {hierarchicalCategories.map(parent => (
                  <div
                    key={parent.id}
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                      borderRadius: 16,
                      padding: '18px 22px',
                      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f2',
                    }}
                  >
                    {/* Parent Category Row */}
                    <div
                      onClick={() => {
                        setIsModalOpen(false);
                        navigate(`/shop?category=${parent.id}`);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        paddingBottom: parent.children?.length > 0 ? 14 : 0,
                        borderBottom: parent.children?.length > 0
                          ? (isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb')
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18, color: '#10b981' }}>{getCategoryIcon(parent.id)}</span>
                        <span style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: isDark ? '#ffffff' : '#111111',
                        }}>
                          {parent.name}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#10b981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        Xem tất cả <RightOutlined style={{ fontSize: 10 }} />
                      </span>
                    </div>

                    {/* Subcategories Chips */}
                    {parent.children && parent.children.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 14,
                      }}>
                        {parent.children.map(child => (
                          <div
                            key={child.id}
                            onClick={() => {
                              setIsModalOpen(false);
                              navigate(`/shop?category=${child.id}`);
                            }}
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                              borderRadius: 20,
                              padding: '6px 14px',
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: isDark ? 'rgba(255,255,255,0.85)' : '#374151',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#10b981';
                              e.currentTarget.style.color = '#10b981';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
                              e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.85)' : '#374151';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <span>{child.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Responsive Styles */}
      <style>{`
        .commerce-categories-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 1080px) {
          .commerce-categories-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .commerce-categories-grid {
            grid-template-columns: 1fr;
          }
        }

        .commerce-products-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 28px 22px;
        }
        @media (max-width: 1120px) {
          .commerce-products-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 780px) {
          .commerce-products-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 480px) {
          .commerce-products-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
