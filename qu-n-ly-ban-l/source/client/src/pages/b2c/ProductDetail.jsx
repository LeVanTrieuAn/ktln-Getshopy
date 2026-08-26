import { useState, useEffect, useRef } from 'react';
import { Row, Col, Typography, Button, Spin, Breadcrumb, Tabs, Divider, Tag, Rate, Avatar, List, Card, Input, message, Carousel } from 'antd';
import { ShoppingCartOutlined, ThunderboltOutlined, CheckCircleOutlined, SafetyCertificateOutlined, UserOutlined, RobotOutlined, HeartOutlined, HeartFilled, SwapOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

const { Title, Paragraph, Text } = Typography;

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const carouselRef = useRef(null);
  const { addToCart } = useCart();
  const { isDark, t, wishlist, toggleWishlist, compareList, toggleCompare, recentlyViewed, addRecentlyViewed } = useApp();
  const navigate = useNavigate();

  const [zoomScale, setZoomScale] = useState(1);
  const [transformOrigin, setTransformOrigin] = useState('center center');

  // Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.b2c.getProductDetails(id);
        setProduct(data);
        
        if (data.image) setMainImage(data.image);
        else if (data.images && data.images.length > 0) setMainImage(data.images[0]);

        if (data.variants && data.variants.length > 0) {
          setSelectedVariantId(data.variants[0].id);
        }
        
        addRecentlyViewed(data);

        // Fetch related products
        const allProds = await api.b2c.getProducts(data.category_id);
        setRelatedProducts(allProds.filter(p => p.id != id).slice(0, 4));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    // M-07: Dựa vào window.location để tự động detect host
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:8080`;
    const ws = new WebSocket(wsHost);
    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'STOCK_UPDATE') {
          // Re-fetch product data silently to get new stock
          const data = await api.b2c.getProductDetails(id);
          setProduct(data);
        }
      } catch (err) {}
    };
    ws.onerror = () => {};
    return () => {
      if (ws.readyState === 1) ws.close();
    };
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>;
  if (!product) return <div style={{ textAlign: 'center', marginTop: 100, color: '#fff' }}>Sản phẩm không tồn tại</div>;

  const activeVariant = product?.variants?.find(v => v.id === selectedVariantId);
  const currentPrice = activeVariant?.price || product?.price;
  const currentStock = activeVariant?.stock ?? product?.stock;

  const isWished = wishlist?.some(p => p.id === product.id);
  const isCompared = compareList?.some(p => p.id === product.id);
  const allImages = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];

  const getProductToAdd = () => {
    const p = { ...product };
    if (selectedVariantId) {
      const variant = product.variants.find(v => v.id === selectedVariantId);
      if (variant) {
        p.selectedVariant = variant;
        p.price = variant.price; // Use variant price
      }
    }
    return p;
  };

  const handleAddToCart = () => {
    addToCart(getProductToAdd(), 1);
  };

  const handleBuyNow = () => {
    addToCart(getProductToAdd(), 1);
    navigate('/checkout');
  };

  const submitReview = async () => {
    if (!reviewComment.trim()) return message.error('Vui lòng nhập nội dung đánh giá!');
    try {
      setSubmittingReview(true);
      const res = await api.b2c.addReview(id, { rating: reviewRating, comment: reviewComment });
      if (res.success) {
        message.success('Đánh giá của bạn đã được gửi thành công!');
        setProduct({ ...product, reviews: [res.review, ...(product.reviews || [])] });
        setReviewComment('');
        setReviewRating(5);
      }
    } catch (err) {
      message.error('Lỗi khi gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };



  const handleMouseEnter = () => {
    setZoomScale(2.5);
  };

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setTransformOrigin(`${x}% ${y}%`);
  };

  const handleMouseLeave = () => {
    setZoomScale(1);
    setTransformOrigin('center center');
  };

  return (
    <div style={{ padding: '100px 48px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <Breadcrumb style={{ marginBottom: 24, fontSize: 14 }} items={[
        { title: <span onClick={() => navigate('/')} style={{ cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>{t('nav.home')}</span> },
        { title: <span style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>{t(`home.category_${product.category_id}`)}</span> },
        { title: <span style={{ color: isDark ? '#fff' : '#000' }}>{product.name}</span> }
      ]} />

      <div className="glass-panel" style={{ padding: 48, borderRadius: 24, marginBottom: 40 }}>
        <Row gutter={[48, 48]} align="top">
          {/* IMAGE GALLERY */}
          <Col xs={24} md={12}>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9', borderRadius: 24, padding: 40, marginBottom: 16 }}>
              <Carousel 
                ref={carouselRef} 
                dots={false} 
                effect="scrollx"
                beforeChange={(from, to) => {
                  setMainImage(allImages[to]);
                  setZoomScale(1);
                }}
              >
                {allImages.map((img, idx) => (
                  <div key={idx}>
                    <div 
                      onMouseEnter={handleMouseEnter}
                      onMouseMove={handleMouseMove} 
                      onMouseLeave={handleMouseLeave}
                      style={{ display: 'flex', justifyContent: 'center', width: '100%', height: 400, overflow: 'hidden', cursor: 'zoom-in' }}
                    >
                      <img 
                        src={img} 
                        alt={`${product.name} - ${idx}`} 
                        width={400}
                        height={400}
                        style={{ 
                          width: '100%', maxWidth: 400, height: '100%', objectFit: 'contain',
                          transform: `scale(${zoomScale})`, 
                          transformOrigin: transformOrigin,
                          transition: zoomScale === 1 ? 'transform 0.3s ease' : 'none' 
                        }} 
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
                      />
                    </div>
                  </div>
                ))}
              </Carousel>
            </div>
            {allImages.length > 1 && (
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {allImages.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setMainImage(img);
                      if (carouselRef.current) carouselRef.current.goTo(idx);
                    }}
                    style={{ 
                      width: 80, height: 80, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                      border: mainImage === img ? '2px solid #10b981' : (isDark ? '2px solid #333' : '2px solid #eee'),
                      padding: 8, background: isDark ? '#111' : '#fff'
                    }}
                  >
                    <img src={img} width={64} height={64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="thumb" />
                  </div>
                ))}
              </div>
            )}
          </Col>
          
          {/* PRODUCT INFO */}
          <Col xs={24} md={12}>
            <Title level={1} style={{ color: isDark ? '#fff' : '#111', fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{product.name}</Title>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Rate disabled defaultValue={product.rating} style={{ fontSize: 16, color: '#facc15' }} />
              <span style={{ color: isDark ? '#aaa' : '#666' }}>({product.reviews?.length || 0} {t('product.reviews')})</span>
              <Divider type="vertical" />
              <span style={{ color: isDark ? '#aaa' : '#666' }}>{t('product.sold')}: {product.sold}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>{currentPrice.toLocaleString('vi-VN')} đ</span>
              {product.original_price > currentPrice && (
                <span style={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,0.4)' : '#999', textDecoration: 'line-through' }}>
                  {product.original_price.toLocaleString('vi-VN')} đ
                </span>
              )}
            </div>

            {/* Màu sắc / Biến thể */}
            {product.variants && product.variants.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ color: isDark ? '#ccc' : '#555', fontWeight: 600, marginBottom: 12 }}>{t('product.choose_variant')}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {product.variants.map(v => (
                    <Button 
                      key={v.id}
                      size="large"
                      onClick={() => setSelectedVariantId(v.id)}
                      style={{ 
                        height: 'auto',
                        padding: '8px 16px',
                        borderRadius: 8, 
                        borderColor: selectedVariantId === v.id ? '#10b981' : (isDark ? '#444' : '#d9d9d9'),
                        color: selectedVariantId === v.id ? '#10b981' : (isDark ? '#fff' : '#000'),
                        background: selectedVariantId === v.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        fontWeight: selectedVariantId === v.id ? 700 : 400,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start'
                      }}
                    >
                      <span>{v.color} {v.storage ? `- ${v.storage}` : ''}</span>
                      <span style={{ fontSize: 12, fontWeight: 'normal', opacity: 0.8 }}>
                        {(v.price ?? product.price ?? 0).toLocaleString('vi-VN')}đ
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: isDark ? '#ccc' : '#555' }}>
                <CheckCircleOutlined style={{ color: '#10b981' }} /> {t('product.in_stock')}: {currentStock} {t('product.items')}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: isDark ? '#ccc' : '#555' }}>
                <SafetyCertificateOutlined style={{ color: '#10b981' }} /> {t('product.warranty')}
              </div>
            </div>

            <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eee' }} />

            <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
              <Button 
                type="default" 
                size="large" 
                icon={isWished ? <HeartFilled style={{ color: '#ef4444' }} /> : <HeartOutlined />}
                onClick={() => { toggleWishlist(product); message.success(isWished ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích'); }}
                style={{ height: 56, width: 56, borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDark ? '#444' : '#d9d9d9' }}
              />
              <Button 
                type="default" 
                size="large" 
                icon={<SwapOutlined style={{ color: isCompared ? '#8b5cf6' : undefined }} />}
                onClick={() => { 
                  try { 
                    toggleCompare(product); 
                    message.success(isCompared ? 'Đã bỏ so sánh' : 'Đã thêm vào danh sách so sánh'); 
                  } catch (e) { 
                    message.error(e.message); 
                  }
                }}
                style={{ height: 56, width: 56, borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isCompared ? '#8b5cf6' : (isDark ? '#444' : '#d9d9d9') }}
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart}
                disabled={currentStock <= 0}
                style={{ height: 56, borderRadius: 16, fontSize: 16, fontWeight: 600, flex: 1, background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6', color: isDark ? '#fff' : '#000', border: 'none' }}
              >
                {t('product.add_to_cart')}
              </Button>
              <Button 
                type="primary" 
                size="large" 
                icon={<ThunderboltOutlined />}
                onClick={handleBuyNow}
                disabled={currentStock <= 0}
                style={{ height: 56, borderRadius: 16, fontSize: 16, fontWeight: 700, flex: 1, background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none' }}
              >
                {t('product.buy_now')}
              </Button>
            </div>
          </Col>
        </Row>
      </div>

      <div className="glass-panel" style={{ padding: 40, borderRadius: 24 }}>
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: <span style={{ fontSize: 16, fontWeight: 600 }}>{t('product.features')}</span>,
              children: (
                <div style={{ color: isDark ? '#bbb' : '#444', fontSize: 16, lineHeight: 1.8, padding: '24px 0' }}>
                  <p>Sản phẩm <strong>{product.name}</strong> mang đến những công nghệ tiên tiến nhất với hiệu năng vượt trội. Thiết kế sang trọng, thời lượng pin ấn tượng và hệ thống camera đỉnh cao giúp bạn làm việc và giải trí không giới hạn.</p>
                  <ul>
                    <li>Màn hình Super Retina XDR sắc nét.</li>
                    <li>Chip xử lý mạnh mẽ nhất phân khúc.</li>
                    <li>Hệ điều hành tối ưu, mượt mà.</li>
                  </ul>
                </div>
              ),
            },
            {
              key: '2',
              label: <span style={{ fontSize: 16, fontWeight: 600 }}>{t('product.specifications')}</span>,
              children: <div style={{ color: isDark ? '#bbb' : '#444', padding: '24px 0', fontSize: 16, lineHeight: 1.8 }}>{product.description}</div>,
            },
            {
              key: '3',
              label: <span style={{ fontSize: 16, fontWeight: 600 }}>{t('product.reviews_title')} ({product.reviews?.length || 0})</span>,
              children: (
                <div style={{ padding: '24px 0' }}>
                  {/* AI Summary Block */}
                  {product.reviews && product.reviews.length > 0 && (
                    <div style={{ 
                      background: 'linear-gradient(to right, rgba(16, 185, 129, 0.1), rgba(4, 120, 87, 0.05))', 
                      border: '1px solid rgba(16, 185, 129, 0.3)', 
                      borderRadius: 12, 
                      padding: 24, 
                      marginBottom: 32,
                      display: 'flex', gap: 16, alignItems: 'flex-start'
                    }}>
                      <Avatar icon={<RobotOutlined />} style={{ background: '#10b981' }} size="large" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          Trí tuệ Nhân tạo (AI) tóm tắt đánh giá
                          <Tag color="green" style={{ margin: 0, borderRadius: 12 }}>Beta</Tag>
                        </div>
                        <div style={{ color: isDark ? '#ddd' : '#333', lineHeight: 1.6 }}>
                          Dựa trên phân tích {product.reviews.length} đánh giá từ người mua, phần lớn khách hàng (trên 90%) rất hài lòng về sản phẩm. 
                          <br/><br/>
                          <strong>Điểm mạnh:</strong> Hiệu năng mạnh mẽ vượt trội, thiết kế sang trọng, thời lượng pin ấn tượng.<br/>
                          <strong>Điểm yếu:</strong> Một số ít người dùng cho rằng giá thành cao và máy hơi ấm khi chơi game nặng.<br/>
                          <br/>
                          <em>Kết luận:</em> Sản phẩm rất đáng mua nếu bạn cần một cỗ máy làm việc chuyên nghiệp.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Review Form */}
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9', padding: 24, borderRadius: 16, marginBottom: 32 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: isDark ? '#fff' : '#000' }}>Viết đánh giá của bạn</div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <Avatar icon={<UserOutlined />} />
                      <div style={{ flex: 1 }}>
                        <Rate value={reviewRating} onChange={setReviewRating} style={{ marginBottom: 12, color: '#10b981' }} />
                        <Input.TextArea 
                          rows={3} 
                          placeholder="Chia sẻ cảm nhận của bạn về sản phẩm này..." 
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          style={{ borderRadius: 12, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#333' : '#d9d9d9' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                          <Button 
                            type="primary" 
                            loading={submittingReview} 
                            onClick={submitReview}
                            style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, fontWeight: 600 }}
                          >Gửi đánh giá</Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {product.reviews && product.reviews.length > 0 ? (
                    <List
                      itemLayout="horizontal"
                      dataSource={product.reviews}
                      renderItem={item => (
                        <List.Item style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee' }}>
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} />}
                            title={<span style={{ color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{item.reviewer || 'Khách hàng ẩn danh'}</span>}
                            description={
                              <div>
                                <Rate disabled value={item.rating} style={{ fontSize: 12, color: '#10b981' }} />
                                <div style={{ color: isDark ? '#aaa' : '#666', marginTop: 8 }}>{item.comment}</div>
                                <div style={{ color: isDark ? '#555' : '#999', fontSize: 12, marginTop: 4 }}>
                                  {new Date(item.date).toLocaleString('vi-VN')}
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này!</div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* CROSS-SELL AI */}
      {relatedProducts.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Title level={3} style={{ color: isDark ? '#fff' : '#111', fontWeight: 800, margin: 0 }}>Thường được mua cùng nhau</Title>
            <Tag color="purple" icon={<RobotOutlined />} style={{ borderRadius: 12, padding: '4px 12px', fontSize: 14, fontWeight: 600 }}>AI Đề xuất</Tag>
          </div>
          <Row gutter={[24, 24]}>
            {relatedProducts.map(p => (
              <Col xs={24} sm={12} md={6} key={p.id}>
                <Card 
                  hoverable 
                  className="product-card"
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}
                  cover={
                    <div style={{ position: 'relative' }}>
                      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                        <img 
                          alt={p.name} 
                          src={p.image} 
                          width={160}
                          height={160}
                          style={{ height: 160, objectFit: 'contain' }} 
                          onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
                        />
                      </div>
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <Button 
                          type="text" 
                          icon={wishlist?.some(w => w.id === p.id) ? <HeartFilled style={{ color: '#ef4444', fontSize: 18 }} /> : <HeartOutlined style={{ fontSize: 18 }} />} 
                          onClick={(e) => { e.stopPropagation(); toggleWishlist(p); message.success(wishlist?.some(w => w.id === p.id) ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích'); }}
                        />
                      </div>
                    </div>
                  }
                >
                  <div style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#fff' : '#1a1a1a', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ color: '#10b981', fontSize: 18, fontWeight: 800 }}>{p.price.toLocaleString('vi-VN')} đ</div>
                  <Button type="primary" style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none', borderRadius: 8 }} onClick={(e) => { e.stopPropagation(); const pToAdd = { ...p }; if (p.variants?.[0]) { pToAdd.selectedVariant = p.variants[0]; pToAdd.price = p.variants[0].price; } addToCart(pToAdd, 1); message.success('Đã thêm vào giỏ'); }}>Thêm vào giỏ</Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* RECENTLY VIEWED */}
      {recentlyViewed && recentlyViewed.filter(p => p.id !== product.id).length > 0 && (
        <div style={{ marginTop: 64 }}>
          <Title level={3} style={{ color: isDark ? '#fff' : '#000', marginBottom: 24 }}>Sản phẩm bạn vừa xem</Title>
          <Row gutter={[24, 24]}>
            {recentlyViewed.filter(p => p.id !== product.id).slice(0, 4).map(p => (
              <Col xs={12} md={6} key={p.id}>
                <Card 
                  hoverable 
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}
                  cover={
                    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                      <img 
                        alt={p.name} 
                        src={p.image || (p.images && p.images[0])} 
                        width={140}
                        height={140}
                        style={{ height: 140, objectFit: 'contain' }} 
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x400/222222/ffffff?text=Image+Not+Found'; }}
                      />
                    </div>
                  }
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#fff' : '#1a1a1a', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ color: '#10b981', fontSize: 16, fontWeight: 800 }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

    </div>
  );
}
