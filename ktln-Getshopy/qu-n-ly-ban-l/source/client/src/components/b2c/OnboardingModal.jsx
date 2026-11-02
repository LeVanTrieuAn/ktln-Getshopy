import { useEffect, useMemo, useState } from 'react';
import { message, Spin } from 'antd';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

/**
 * OnboardingModal — hỏi sở thích ở lần đầu khách vào hoặc khi sửa lại.
 *
 * VÌ SAO: khách mới chưa có lịch sử mua lẫn lịch sử duyệt, nên collaborative
 * filtering không có gì để tính và mọi gợi ý rơi về hàng bán chạy. Hỏi thẳng thì
 * có tín hiệu ngay từ phút đầu.
 *
 * Bước 4 (không quan tâm) là bước quý nhất cho việc cải tiến model: dữ liệu mua
 * hàng chỉ nói khách ĐÃ mua gì, không bao giờ nói khách KHÔNG thích gì.
 *
 * Modal có 2 mode:
 *   - 'first': mở ngay sau đăng ký. Chặn click backdrop (chỉ skip/hoàn tất).
 *   - 'edit':  mở từ Account khi muốn sửa. Pre-fill từ preferences hiện tại. Có nút ✕ để đóng.
 *
 * Props:
 *   - open:    boolean — có hiển thị không
 *   - mode:    'first' | 'edit' (mặc định 'first')
 *   - onClose: () => void — gọi khi modal đóng (sau skip / finish / cancel)
 */
const STEPS = ['Danh mục', 'Hãng', 'Tầm giá', 'Không quan tâm'];

// Cache tĩnh cấp module: options danh mục/hãng không thay đổi theo phiên của user.
// Khi mở modal lần đầu hoặc mở lại sau đó, data có ngay lập tức (0ms).
let cachedOpts = null;

export default function OnboardingModal({ open, onClose, mode = 'first' }) {
  const { isDark, b2cUser } = useApp();

  const [opts, setOpts] = useState(cachedOpts);
  const [loadingOpts, setLoadingOpts] = useState(!cachedOpts);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [likedCats, setLikedCats] = useState([]);
  const [likedBrands, setLikedBrands] = useState([]);
  const [priceBand, setPriceBand] = useState(null);
  const [dislikedCats, setDislikedCats] = useState([]);
  const [dislikedBrands, setDislikedBrands] = useState([]);

  // Bước 1 (Danh mục): Tìm kiếm & Mở rộng danh mục con
  const [catSearch, setCatSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState([]);

  // Bước 2 (Hãng thích): Tìm kiếm & Xem tất cả
  const [likedBrandSearch, setLikedBrandSearch] = useState('');
  const [showAllLikedBrands, setShowAllLikedBrands] = useState(false);

  // Bước 4 (Không muốn thấy): Tìm kiếm & Xem tất cả
  const [dislikeBrandSearch, setDislikeBrandSearch] = useState('');
  const [showAllDislikeBrands, setShowAllDislikeBrands] = useState(false);

  const loadOptions = () => {
    setLoadingOpts(true);
    setLoadError(false);
    api.b2c.getOnboardingOptions()
      .then(res => {
        cachedOpts = res;
        setOpts(res);
        setLoadingOpts(false);
      })
      .catch(err => {
        console.error('Failed to load onboarding options:', err);
        setLoadError(true);
        setLoadingOpts(false);
        message.error('Không tải được danh sách lựa chọn');
      });
  };

  // Load options + (nếu edit) pre-fill từ preferences hiện tại.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // Reset step & state chọn mỗi lần mở
    setStep(0);
    setLikedCats([]);
    setLikedBrands([]);
    setPriceBand(null);
    setDislikedCats([]);
    setDislikedBrands([]);
    setCatSearch('');
    setExpandedCats([]);
    setLikedBrandSearch('');
    setShowAllLikedBrands(false);
    setDislikeBrandSearch('');
    setShowAllDislikeBrands(false);

    if (!cachedOpts) {
      loadOptions();
    } else {
      setOpts(cachedOpts);
      setLoadingOpts(false);
      setLoadError(false);
    }

    if (mode === 'edit') {
      api.b2c.getMyPreferences()
        .then(pref => {
          if (cancelled || !pref) return;
          setLikedCats(Array.isArray(pref.liked_categories) ? pref.liked_categories : []);
          setLikedBrands(Array.isArray(pref.liked_brands) ? pref.liked_brands : []);
          setPriceBand(pref.price_band || null);
          setDislikedCats(Array.isArray(pref.disliked_categories) ? pref.disliked_categories : []);
          setDislikedBrands(Array.isArray(pref.disliked_brands) ? pref.disliked_brands : []);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  // Tìm danh mục cha tương ứng từ các ID danh mục đã chọn (để map hãng)
  const selectedParentCatIds = useMemo(() => {
    if (!opts) return [];
    const set = new Set();
    const catMap = new Map((opts.allCategories || []).map(c => [c.id, c]));
    for (const id of likedCats) {
      const cat = catMap.get(id);
      if (cat) {
        if (cat.parent_id) set.add(cat.parent_id);
        else set.add(cat.id);
      } else {
        set.add(id);
      }
    }
    return [...set];
  }, [opts, likedCats]);

  // Hãng thuộc các danh mục đã chọn
  const brandsForLiked = useMemo(() => {
    if (!opts) return [];
    const seen = new Map();
    for (const pId of selectedParentCatIds) {
      for (const b of opts.brandsByCategory?.[pId] || []) {
        if (!seen.has(b.id)) seen.set(b.id, b);
      }
    }
    // Nếu chưa chọn danh mục hoặc danh mục chưa có hãng, fallback sang toàn bộ 91 hãng
    if (seen.size === 0 && (opts.allBrands || []).length > 0) {
      return opts.allBrands || [];
    }
    return [...seen.values()];
  }, [opts, selectedParentCatIds]);

  const sortedBrandsForLiked = useMemo(() => {
    return [...brandsForLiked].sort((a, b) => (b.sold || 0) - (a.sold || 0));
  }, [brandsForLiked]);

  // Lọc thương hiệu thích: Top 12 + tìm kiếm toàn cục 91 hãng + mở rộng
  const visibleLikedBrands = useMemo(() => {
    if (likedBrandSearch.trim()) {
      const q = likedBrandSearch.trim().toLowerCase();
      const pool = opts?.allBrands || sortedBrandsForLiked;
      return pool.filter(b => b.name.toLowerCase().includes(q));
    }
    if (showAllLikedBrands || sortedBrandsForLiked.length <= 12) {
      return sortedBrandsForLiked;
    }
    const top12 = sortedBrandsForLiked.slice(0, 12);
    const selectedBeyondTop12 = sortedBrandsForLiked.slice(12).filter(b => likedBrands.includes(b.id));
    return [...top12, ...selectedBeyondTop12];
  }, [sortedBrandsForLiked, likedBrandSearch, showAllLikedBrands, likedBrands, opts]);

  // Danh mục chưa chọn thích
  const catsNotLiked = useMemo(() => {
    if (!opts) return [];
    const list = opts.allCategories || opts.categories || [];
    return list.filter(c => !likedCats.includes(c.id));
  }, [opts, likedCats]);

  // Hãng chưa chọn thích
  const brandsNotLiked = useMemo(() => {
    const pool = brandsForLiked.length > 0 ? brandsForLiked : (opts?.allBrands || []);
    return pool.filter(b => !likedBrands.includes(b.id));
  }, [brandsForLiked, opts, likedBrands]);

  const sortedBrandsNotLiked = useMemo(() => {
    return [...brandsNotLiked].sort((a, b) => (b.sold || 0) - (a.sold || 0));
  }, [brandsNotLiked]);

  // Lọc hãng không thích: Top 12 + tìm kiếm 91 hãng + mở rộng
  const visibleDislikeBrands = useMemo(() => {
    if (dislikeBrandSearch.trim()) {
      const q = dislikeBrandSearch.trim().toLowerCase();
      const pool = opts?.allBrands || sortedBrandsNotLiked;
      return pool.filter(b => b.name.toLowerCase().includes(q));
    }
    if (showAllDislikeBrands || sortedBrandsNotLiked.length <= 12) {
      return sortedBrandsNotLiked;
    }
    const top12 = sortedBrandsNotLiked.slice(0, 12);
    const selectedBeyondTop12 = sortedBrandsNotLiked.slice(12).filter(b => dislikedBrands.includes(b.id));
    return [...top12, ...selectedBeyondTop12];
  }, [sortedBrandsNotLiked, dislikeBrandSearch, showAllDislikeBrands, dislikedBrands, opts]);

  // Lọc danh sách nhóm cha hiển thị ở Bước 1 theo từ khóa tìm kiếm
  const displayedParents = useMemo(() => {
    if (!opts?.categories) return [];
    if (!catSearch.trim()) return opts.categories;
    const q = catSearch.trim().toLowerCase();
    return opts.categories.filter(p => {
      const matchParent = p.name.toLowerCase().includes(q);
      const matchChild = p.children?.some(ch => ch.name.toLowerCase().includes(q));
      return matchParent || matchChild;
    });
  }, [opts, catSearch]);

  const toggle = (setFn) => (id) =>
    setFn(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  // Toggle danh mục cha: Nếu chọn/bỏ chọn cha thì đồng bộ danh mục con tương ứng
  const toggleCat = (id) => {
    setLikedCats(prev => {
      const isCurrentlyLiked = prev.includes(id);
      let next;
      if (isCurrentlyLiked) {
        const parentObj = opts?.categories?.find(c => c.id === id);
        const childIds = parentObj?.children?.map(ch => ch.id) || [];
        next = prev.filter(x => x !== id && !childIds.includes(x));
      } else {
        next = [...prev, id];
      }
      setDislikedCats(d => d.filter(x => !next.includes(x)));
      return next;
    });
  };

  const toggleChildCat = (childId, parentId) => {
    setLikedCats(prev => {
      const isCurrentlyLiked = prev.includes(childId);
      const next = isCurrentlyLiked ? prev.filter(x => x !== childId) : [...prev, childId];
      setDislikedCats(d => d.filter(x => !next.includes(x)));
      return next;
    });
  };

  const selectAllChildren = (parent) => {
    const childIds = parent.children?.map(ch => ch.id) || [];
    setLikedCats(prev => {
      const combined = new Set([...prev, parent.id, ...childIds]);
      const next = [...combined];
      setDislikedCats(d => d.filter(x => !next.includes(x)));
      return next;
    });
  };

  const clearChildren = (parent) => {
    const childIds = parent.children?.map(ch => ch.id) || [];
    setLikedCats(prev => {
      const next = prev.filter(x => x !== parent.id && !childIds.includes(x));
      return next;
    });
  };

  const toggleExpandCat = (id) => {
    setExpandedCats(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const finish = async () => {
    setSaving(true);
    try {
      const allowed = new Set((opts?.allBrands || brandsForLiked).map(b => b.id));
      await api.b2c.saveMyPreferences({
        liked_categories: likedCats,
        liked_brands: likedBrands.filter(b => allowed.has(b)),
        disliked_categories: dislikedCats.filter(c => !likedCats.includes(c)),
        disliked_brands: dislikedBrands.filter(b => allowed.has(b) && !likedBrands.includes(b)),
        price_band: priceBand,
      });
      message.success('Đã lưu sở thích — gợi ý sẽ bám theo ý bạn');
      onClose();
    } catch (e) {
      message.error(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    if (mode === 'edit') {
      onClose();
      return;
    }
    try {
      await api.b2c.skipOnboarding();
    } catch {
      /* bỏ qua lỗi */
    }
    onClose();
  };

  const totalDisliked = dislikedCats.length + dislikedBrands.length;
  const canNext = step !== 0 || likedCats.length > 0;
  const last = step === STEPS.length - 1;

  if (!open) return null;

  const T = isDark
    ? {
        bg: 'rgba(0, 0, 0, 0.7)',
        card: '#141417',
        fg: '#fafafa',
        sub: '#a1a1aa',
        line: '#27272a',
        soft: '#1e1e24',
        inv: '#fafafa',
        invFg: '#09090b',
        no: '#f87171',
      }
    : {
        bg: 'rgba(0, 0, 0, 0.45)',
        card: '#ffffff',
        fg: '#09090b',
        sub: '#71717a',
        line: '#e4e4e7',
        soft: '#f8f8fa',
        inv: '#09090b',
        invFg: '#ffffff',
        no: '#dc2626',
      };

  return (
    <div
      className={`ob-overlay ${isDark ? 'is-dark' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: T.bg,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        '--card': T.card,
        '--fg': T.fg,
        '--sub': T.sub,
        '--line': T.line,
        '--soft': T.soft,
        '--inv': T.inv,
        '--inv-fg': T.invFg,
        '--no': T.no,
      }}
    >
      <style>{CSS}</style>
      <div
        className={`ob-card ${isDark ? 'is-dark' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'edit' && (
          <button
            type="button"
            className="ob-close-btn"
            onClick={onClose}
            aria-label="Đóng modal"
          >
            ✕
          </button>
        )}

        {loadingOpts ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 340 }}>
            <Spin size="large" />
          </div>
        ) : loadError || !opts ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--fg)', marginBottom: 8 }}>
              Không tải được danh sách lựa chọn
            </div>
            <p style={{ fontSize: 13, color: 'var(--sub)', maxWidth: 360, marginBottom: 22, lineHeight: 1.5 }}>
              Hệ thống đang bận hoặc đường truyền chậm. Bạn có thể thử tải lại hoặc bỏ qua để tiếp tục mua sắm.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="ob-btn ghost" onClick={skip}>
                {mode === 'edit' ? 'Đóng' : 'Bỏ qua'}
              </button>
              <button type="button" className="ob-btn" onClick={loadOptions}>
                Thử lại
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="ob-head">
              <div className="ob-kicker">
                {mode === 'edit' ? 'Cập nhật sở thích' : `Chào ${b2cUser?.full_name?.split(' ').pop() || 'bạn'} 👋`}
              </div>
              <h1 id="ob-title" className="ob-title">
                {mode === 'edit' ? 'Sửa lại sở thích của bạn' : 'Giúp chúng tôi gợi ý đúng ý bạn'}
              </h1>
              <p className="ob-sub">
                {mode === 'edit'
                  ? 'Bạn có thể chỉnh sửa lại bất cứ lúc nào.'
                  : 'Mất chừng 30 giây. Bỏ qua được, và sửa lại bất cứ lúc nào trong trang tài khoản.'}
              </p>

              <div className="ob-steps">
                {STEPS.map((s, i) => (
                  <div key={s} className={`ob-step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`}>
                    <span className="ob-dot">{i < step ? '✓' : i + 1}</span>
                    <span className="ob-step-lb">{s}</span>
                  </div>
                ))}
              </div>
            </header>

            <section className="ob-body">
              {step === 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h2 className="ob-q">Bạn quan tâm những nhóm hàng nào?</h2>
                      <p className="ob-hint" style={{ margin: '4px 0 0' }}>
                        Chọn nhóm chính hoặc bấm mở rộng để chọn chi tiết từng loại phụ kiện
                      </p>
                    </div>
                    {likedCats.length > 0 && (
                      <span className="ob-selected-badge">
                        ✓ Đã chọn {likedCats.length} danh mục
                      </span>
                    )}
                  </div>

                  <div className="ob-search-box">
                    <span className="ob-search-icon">🔍</span>
                    <input
                      type="text"
                      className="ob-search-input"
                      placeholder="Tìm nhanh trong 49 danh mục (VD: Ốp lưng, Sạc dự phòng, Chuột, Tai nghe...)"
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                    />
                    {catSearch && (
                      <button type="button" className="ob-search-clear" onClick={() => setCatSearch('')}>
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="ob-cat-list">
                    {displayedParents.map(parent => {
                      const hasChildren = parent.children && parent.children.length > 0;
                      const isParentSelected = likedCats.includes(parent.id);
                      const selectedChildrenCount = hasChildren
                        ? parent.children.filter(ch => likedCats.includes(ch.id)).length
                        : 0;
                      const isExpanded = expandedCats.includes(parent.id) || (catSearch.trim() && parent.children?.some(ch => ch.name.toLowerCase().includes(catSearch.trim().toLowerCase())));

                      return (
                        <div key={parent.id} className={`ob-cat-card ${isParentSelected || selectedChildrenCount > 0 ? 'is-selected' : ''}`}>
                          <div className="ob-cat-header">
                            <button
                              type="button"
                              className={`ob-cat-main-btn ${isParentSelected ? 'active' : ''}`}
                              onClick={() => toggleCat(parent.id)}
                            >
                              <span className="ob-cat-check">{isParentSelected ? '✓' : selectedChildrenCount > 0 ? '◐' : '○'}</span>
                              <span className="ob-cat-name">{parent.name}</span>
                              {selectedChildrenCount > 0 && (
                                <span className="ob-cat-subcount">{selectedChildrenCount}/{parent.children.length}</span>
                              )}
                            </button>

                            {hasChildren && (
                              <button
                                type="button"
                                className={`ob-cat-expand-btn ${isExpanded ? 'open' : ''}`}
                                onClick={() => toggleExpandCat(parent.id)}
                              >
                                {isExpanded ? '▴ Thu gọn' : `▾ ${parent.children.length} nhóm con`}
                              </button>
                            )}
                          </div>

                          {hasChildren && isExpanded && (
                            <div className="ob-cat-subpanel">
                              <div className="ob-cat-sub-actions">
                                <span className="ob-cat-sub-label">Chi tiết phụ kiện:</span>
                                <button
                                  type="button"
                                  className="ob-text-btn"
                                  onClick={() => selectAllChildren(parent)}
                                >
                                  Chọn tất cả ({parent.children.length})
                                </button>
                                {selectedChildrenCount > 0 && (
                                  <button
                                    type="button"
                                    className="ob-text-btn"
                                    onClick={() => clearChildren(parent)}
                                  >
                                    Bỏ chọn
                                  </button>
                                )}
                              </div>
                              <div className="ob-cat-sub-grid">
                                {parent.children.map(child => {
                                  const isChildSelected = likedCats.includes(child.id);
                                  return (
                                    <button
                                      key={child.id}
                                      type="button"
                                      className={`ob-sub-chip ${isChildSelected ? 'active' : ''}`}
                                      onClick={() => toggleChildCat(child.id, parent.id)}
                                    >
                                      {isChildSelected && <span className="ob-sub-tick">✓</span>}
                                      <span>{child.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h2 className="ob-q">Bạn hay dùng hãng nào?</h2>
                      <p className="ob-hint" style={{ margin: '4px 0 0' }}>
                        Hiển thị theo nhóm bạn đã chọn · không bắt buộc
                      </p>
                    </div>
                    {likedBrands.length > 0 && (
                      <span className="ob-selected-badge">
                        ✓ Đã chọn {likedBrands.length} thương hiệu
                      </span>
                    )}
                  </div>

                  <div className="ob-search-box">
                    <span className="ob-search-icon">🔍</span>
                    <input
                      type="text"
                      className="ob-search-input"
                      placeholder={`Tìm nhanh trong tất cả ${opts?.allBrands?.length || 91} thương hiệu...`}
                      value={likedBrandSearch}
                      onChange={(e) => setLikedBrandSearch(e.target.value)}
                    />
                    {likedBrandSearch && (
                      <button type="button" className="ob-search-clear" onClick={() => setLikedBrandSearch('')}>
                        ✕
                      </button>
                    )}
                  </div>

                  {visibleLikedBrands.length === 0 ? (
                    <p className="ob-empty">
                      Không tìm thấy thương hiệu nào khớp với "{likedBrandSearch}"
                    </p>
                  ) : (
                    <>
                      <div className="ob-grid">
                        {visibleLikedBrands.map(b => (
                          <Chip
                            key={b.id}
                            on={likedBrands.includes(b.id)}
                            onClick={() => toggle(setLikedBrands)(b.id)}
                          >
                            {b.name}
                          </Chip>
                        ))}
                      </div>

                      {sortedBrandsForLiked.length > 12 && !likedBrandSearch && (
                        <div style={{ marginTop: 14 }}>
                          <button
                            type="button"
                            className="ob-more-btn"
                            onClick={() => setShowAllLikedBrands(v => !v)}
                          >
                            {showAllLikedBrands
                              ? '▴ Thu gọn bớt thương hiệu'
                              : `▾ Xem tất cả ${sortedBrandsForLiked.length} thương hiệu`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="ob-q">Tầm giá bạn thường mua?</h2>
                  <p className="ob-hint">Chọn một · bấm lại để bỏ chọn</p>
                  <div className="ob-grid ob-grid-2">
                    {opts.priceBands.map(p => (
                      <Chip key={p.id} on={priceBand === p.id} onClick={() => setPriceBand(v => (v === p.id ? null : p.id))}>
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h2 className="ob-q">Có gì bạn KHÔNG muốn thấy?</h2>
                      <p className="ob-hint">Hệ thống sẽ lọc bớt gợi ý các mặt hàng này · không bắt buộc</p>
                    </div>
                    {totalDisliked > 0 && (
                      <div className="ob-dislike-badge">
                        <span>✕ Đang ẩn:</span>
                        {dislikedCats.length > 0 && <span>{dislikedCats.length} danh mục</span>}
                        {dislikedCats.length > 0 && dislikedBrands.length > 0 && <span>, </span>}
                        {dislikedBrands.length > 0 && <span>{dislikedBrands.length} thương hiệu</span>}
                      </div>
                    )}
                  </div>

                  {totalDisliked === 0 && (
                    <div className="ob-step4-tip">
                      💡 Nếu bạn không có ác cảm với món hàng nào, hãy bấm <strong>"Hoàn tất"</strong> ngay bên dưới.
                    </div>
                  )}

                  {catsNotLiked.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="ob-group">Danh mục chưa quan tâm ({catsNotLiked.length})</div>
                      <div className="ob-grid">
                        {catsNotLiked.slice(0, 16).map(c => (
                          <Chip
                            key={c.id}
                            no
                            on={dislikedCats.includes(c.id)}
                            onClick={() => toggle(setDislikedCats)(c.id)}
                          >
                            {c.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}

                  {brandsNotLiked.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 10 }}>
                        <div className="ob-group" style={{ margin: 0 }}>
                          Thương hiệu ({visibleDislikeBrands.length}/{brandsNotLiked.length})
                        </div>
                        {dislikedBrands.length > 0 && (
                          <button
                            type="button"
                            className="ob-text-btn"
                            onClick={() => setDislikedBrands([])}
                          >
                            Bỏ chọn thương hiệu ({dislikedBrands.length})
                          </button>
                        )}
                      </div>

                      <div className="ob-search-box">
                        <span className="ob-search-icon">🔍</span>
                        <input
                          type="text"
                          className="ob-search-input"
                          placeholder={`Tìm nhanh trong tất cả ${opts?.allBrands?.length || 91} thương hiệu muốn ẩn...`}
                          value={dislikeBrandSearch}
                          onChange={(e) => setDislikeBrandSearch(e.target.value)}
                        />
                        {dislikeBrandSearch && (
                          <button
                            type="button"
                            className="ob-search-clear"
                            onClick={() => setDislikeBrandSearch('')}
                            aria-label="Xóa tìm kiếm"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {visibleDislikeBrands.length === 0 ? (
                        <p className="ob-empty" style={{ padding: '12px 0' }}>
                          Không tìm thấy thương hiệu nào khớp với "{dislikeBrandSearch}"
                        </p>
                      ) : (
                        <div className="ob-grid">
                          {visibleDislikeBrands.map(b => (
                            <Chip
                              key={b.id}
                              no
                              on={dislikedBrands.includes(b.id)}
                              onClick={() => toggle(setDislikedBrands)(b.id)}
                            >
                              {b.name}
                            </Chip>
                          ))}
                        </div>
                      )}

                      {sortedBrandsNotLiked.length > 12 && !dislikeBrandSearch && (
                        <div style={{ marginTop: 14 }}>
                          <button
                            type="button"
                            className="ob-more-btn"
                            onClick={() => setShowAllDislikeBrands(v => !v)}
                          >
                            {showAllDislikeBrands
                              ? '▴ Thu gọn bớt thương hiệu'
                              : `▾ Xem tất cả ${sortedBrandsNotLiked.length} thương hiệu`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <footer className="ob-foot">
              <button type="button" className="ob-link" onClick={skip}>
                {mode === 'edit' ? 'Đóng' : 'Bỏ qua'}
              </button>
              <div className="ob-nav">
                {step > 0 && (
                  <button type="button" className="ob-btn ghost" onClick={() => setStep(s => s - 1)}>
                    Quay lại
                  </button>
                )}
                {!last ? (
                  <button type="button" className="ob-btn" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
                    Tiếp
                  </button>
                ) : (
                  <button type="button" className="ob-btn" disabled={saving} onClick={finish}>
                    {saving ? 'Đang lưu…' : 'Hoàn tất'}
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

// ── Hiệu ứng chip ──────────────────────────────────────────────────────
function Chip({ on, no, onClick, children }) {
  return (
    <button
      type="button"
      className={`ob-chip${on ? (no ? ' no' : ' on') : ''}`}
      onClick={onClick}
      aria-pressed={on}
    >
      {on && (
        <span className={`ob-tick${no ? ' is-no' : ''}`} key={String(on)}>
          {no ? '✕' : '✓'}
        </span>
      )}
      <span className="ob-chip-text">{children}</span>
    </button>
  );
}

const CSS = `
@keyframes obScaleIn {
  from { opacity: 0; transform: scale(0.96) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.ob-card {
  --card: #ffffff;
  --fg: #09090b;
  --sub: #71717a;
  --line: #e4e4e7;
  --soft: #f8f8fa;
  --inv: #09090b;
  --inv-fg: #ffffff;
  --no: #dc2626;

  width: 100%;
  max-width: 620px;
  max-height: min(680px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 24px;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  position: relative;
  animation: obScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

[data-theme='dark'] .ob-card,
.ob-card.is-dark {
  --card: #141417;
  --fg: #fafafa;
  --sub: #a1a1aa;
  --line: #27272a;
  --soft: #1e1e24;
  --inv: #fafafa;
  --inv-fg: #09090b;
  --no: #f87171;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.ob-close-btn {
  position: absolute;
  top: 22px;
  right: 22px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--soft);
  color: var(--sub);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  z-index: 10;
  transition: all .18s ease;
}
.ob-close-btn:hover {
  background: var(--line);
  color: var(--fg);
  transform: scale(1.06);
}

.ob-head {
  padding: 28px 28px 18px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
  position: relative;
}
.ob-kicker {
  font-size: 13px;
  font-weight: 500;
  color: var(--sub);
  margin-bottom: 6px;
}
.ob-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: -.02em;
}
.ob-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--sub);
  line-height: 1.5;
}

.ob-steps { display: flex; gap: 8px; margin-top: 20px; }
.ob-step { flex: 1; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--sub); }
.ob-dot { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; border: 1.5px solid var(--line);
          display: grid; place-items: center; font-size: 11px; font-weight: 700; transition: all .2s ease; }
.ob-step.on .ob-dot { background: var(--inv); color: var(--inv-fg); border-color: var(--inv); }
.ob-step.done .ob-dot { background: #10b981; color: #ffffff; border-color: #10b981; }
.ob-step.on .ob-step-lb { color: var(--fg); font-weight: 600; }
.ob-step.done .ob-step-lb { color: var(--fg); }

.ob-body {
  padding: 24px 28px;
  min-height: 250px;
  flex: 1;
  overflow-y: auto;
}
.ob-body::-webkit-scrollbar { width: 5px; }
.ob-body::-webkit-scrollbar-track { background: transparent; }
.ob-body::-webkit-scrollbar-thumb { background: var(--line); border-radius: 4px; }

.ob-q { margin: 0; font-size: 17px; font-weight: 650; color: var(--fg); }
.ob-hint { margin: 4px 0 18px; font-size: 12.5px; color: var(--sub); }
.ob-group { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
            color: var(--sub); margin: 16px 0 10px; }
.ob-group:first-of-type { margin-top: 0; }
.ob-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 10px; }
.ob-grid-2 { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
.ob-empty { color: var(--sub); font-size: 13.5px; padding: 12px 0; }

/* ── Chip ──────────────────────────────────────────────────────────────── */
.ob-chip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 10px 14px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  color: var(--fg);
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: transform .18s cubic-bezier(.16,1,.3,1),
              border-color .18s ease,
              background-color .22s ease,
              box-shadow .22s ease,
              color .18s ease;
}
.ob-chip-text {
  flex: 1;
  white-space: normal;
  line-height: 1.35;
}
.ob-chip:hover {
  border-color: #10b981;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, .12);
}
.ob-chip:active {
  transform: scale(.97);
  transition-duration: 80ms;
}
.ob-chip:focus-visible {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, .28);
}

/* Selected (liked) */
.ob-chip.on {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
  border-color: #10b981;
  font-weight: 600;
  box-shadow: 0 0 0 1px rgba(16, 185, 129, .35) inset, 0 4px 14px -4px rgba(16, 185, 129, .35);
}
[data-theme='dark'] .ob-chip.on,
.ob-card.is-dark .ob-chip.on {
  background: rgba(16, 185, 129, 0.18);
  color: #34d399;
  border-color: #10b981;
}

/* Disliked */
.ob-chip.no {
  border-color: #dc2626;
  color: #dc2626;
  background: rgba(220, 38, 38, .08);
  box-shadow: 0 0 0 1px rgba(220, 38, 38, .25) inset;
}
[data-theme='dark'] .ob-chip.no,
.ob-card.is-dark .ob-chip.no {
  color: #f87171;
  border-color: #f87171;
  background: rgba(248, 113, 113, .14);
}
.ob-chip.no:hover {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, .14);
  transform: translateY(-1px);
  border-color: #dc2626;
}

/* Tick */
.ob-tick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #10b981;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  flex: 0 0 20px;
  animation: tickPop .32s cubic-bezier(.34, 1.56, .64, 1) both;
}
.ob-tick.is-no { background: #dc2626; animation-name: tickShake; }
@keyframes tickPop {
  0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes tickShake {
  0%   { transform: scale(0) rotate(0); opacity: 0; }
  35%  { transform: scale(1.18) rotate(-8deg); opacity: 1; }
  55%  { transform: scale(1)    rotate(6deg); }
  72%  { transform: scale(1.05) rotate(-3deg); }
  100% { transform: scale(1)    rotate(0); }
}

.ob-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 28px;
  border-top: 1px solid var(--line);
  background: var(--soft);
  flex-shrink: 0;
}
.ob-link {
  background: none;
  border: none;
  color: var(--sub);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 4px;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color .15s ease;
}
.ob-link:hover {
  color: var(--fg);
}
.ob-nav { display: flex; gap: 10px; }
.ob-btn {
  min-width: 104px;
  height: 42px;
  padding: 0 20px;
  border-radius: 12px;
  border: 1px solid var(--inv);
  color: var(--inv-fg);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: var(--inv);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all .18s ease;
}
.ob-btn:hover:not(:disabled) {
  opacity: .9;
  transform: translateY(-1px);
}
.ob-btn:active:not(:disabled) {
  transform: scale(.98);
}
.ob-btn.ghost {
  background: transparent;
  color: var(--fg);
  border-color: var(--line);
}
.ob-btn.ghost:hover {
  background: var(--card);
}
.ob-btn:disabled {
  opacity: .35;
  cursor: not-allowed;
}
.ob-dislike-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(220, 38, 38, .12);
  color: var(--no);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
.ob-step4-tip {
  font-size: 12.5px;
  color: var(--sub);
  background: var(--soft);
  border: 1px solid var(--line);
  padding: 9px 14px;
  border-radius: 11px;
  margin-bottom: 16px;
  line-height: 1.45;
}
.ob-search-box {
  position: relative;
  margin-bottom: 12px;
}
.ob-search-input {
  width: 100%;
  height: 38px;
  padding: 0 34px 0 34px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--soft);
  color: var(--fg);
  font-size: 13px;
  outline: none;
  transition: all .18s ease;
}
.ob-search-input:focus {
  background: var(--card);
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, .12);
}
.ob-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: var(--sub);
  pointer-events: none;
}
.ob-search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--sub);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
}
.ob-search-clear:hover {
  color: var(--fg);
}
.ob-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px dashed var(--line);
  background: var(--soft);
  color: var(--fg);
  font-size: 12.5px;
  font-weight: 550;
  cursor: pointer;
  transition: all .15s ease;
}
.ob-more-btn:hover {
  background: var(--line);
  border-color: var(--sub);
}
.ob-text-btn {
  background: none;
  border: none;
  color: var(--no);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  padding: 2px 4px;
}
.ob-text-btn:hover {
  opacity: .8;
}
.ob-cat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ob-cat-card {
  border: 1.5px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  transition: all .2s ease;
  overflow: hidden;
}
.ob-cat-card.is-selected {
  border-color: #10b981;
}
.ob-cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}
.ob-cat-main-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: var(--fg);
  font-size: 14px;
  font-weight: 550;
  cursor: pointer;
  text-align: left;
  flex: 1;
  padding: 6px 4px;
}
.ob-cat-check {
  font-size: 15px;
  color: var(--sub);
  width: 20px;
  display: grid;
  place-items: center;
}
.ob-cat-main-btn.active .ob-cat-check {
  color: #10b981;
  font-weight: 800;
}
.ob-cat-name {
  flex: 1;
}
.ob-cat-subcount {
  font-size: 11.5px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  font-weight: 600;
}
.ob-cat-expand-btn {
  background: var(--soft);
  border: 1px solid var(--line);
  color: var(--sub);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all .15s ease;
}
.ob-cat-expand-btn:hover {
  color: var(--fg);
  border-color: var(--sub);
}
.ob-cat-expand-btn.open {
  background: var(--line);
  color: var(--fg);
}
.ob-cat-subpanel {
  padding: 12px 14px 14px;
  border-top: 1px dashed var(--line);
  background: var(--soft);
}
.ob-cat-sub-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.ob-cat-sub-label {
  font-size: 11.5px;
  color: var(--sub);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.ob-cat-sub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  gap: 7px;
}
.ob-sub-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--fg);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all .15s ease;
}
.ob-sub-chip:hover {
  border-color: #10b981;
}
.ob-sub-chip.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
  font-weight: 600;
}
[data-theme='dark'] .ob-sub-chip.active,
.ob-card.is-dark .ob-sub-chip.active {
  color: #34d399;
}
.ob-sub-tick {
  font-size: 10px;
  font-weight: 800;
  color: #10b981;
}
.ob-selected-badge {
  font-size: 12px;
  font-weight: 600;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  padding: 3px 10px;
  border-radius: 12px;
}

@media (max-width: 480px) {
  .ob-card { max-height: calc(100vh - 24px); border-radius: 18px; }
  .ob-head, .ob-body, .ob-foot { padding-left: 18px; padding-right: 18px; }
  .ob-step-lb { display: none; }
  .ob-grid { grid-template-columns: 1fr 1fr; }
  .ob-grid-2 { grid-template-columns: 1fr; }
}
`;