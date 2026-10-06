import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Spin } from 'antd';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

/**
 * Onboarding — hỏi sở thích ở lần đầu khách vào.
 *
 * VÌ SAO: khách mới chưa có lịch sử mua lẫn lịch sử duyệt, nên collaborative
 * filtering không có gì để tính và mọi gợi ý rơi về hàng bán chạy. Hỏi thẳng thì
 * có tín hiệu ngay từ phút đầu.
 *
 * Bước 4 (không quan tâm) là bước quý nhất cho việc cải tiến model: dữ liệu mua
 * hàng chỉ nói khách ĐÃ mua gì, không bao giờ nói khách KHÔNG thích gì.
 *
 * Luôn có nút "Bỏ qua" — không được cản đường mua hàng.
 */
const STEPS = ['Danh mục', 'Hãng', 'Tầm giá', 'Không quan tâm'];

export default function Onboarding() {
  const { isDark, b2cUser } = useApp();
  const navigate = useNavigate();

  const [opts, setOpts] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [likedCats, setLikedCats] = useState([]);
  const [likedBrands, setLikedBrands] = useState([]);
  const [priceBand, setPriceBand] = useState(null);
  const [dislikedCats, setDislikedCats] = useState([]);
  const [dislikedBrands, setDislikedBrands] = useState([]);

  useEffect(() => {
    // Chưa đăng nhập thì onboarding vô nghĩa — không có ai để gắn sở thích vào.
    if (!b2cUser) { navigate('/', { replace: true }); return; }
    api.b2c.getOnboardingOptions()
      .then(setOpts)
      .catch(() => { message.error('Không tải được lựa chọn'); navigate('/', { replace: true }); });
  }, [b2cUser, navigate]);

  // Hãng thuộc các danh mục đã chọn, bỏ trùng (một hãng có thể nằm ở nhiều danh mục).
  const brandsForLiked = useMemo(() => {
    if (!opts) return [];
    const seen = new Map();
    for (const c of likedCats) {
      for (const b of opts.brandsByCategory[c] || []) if (!seen.has(b.id)) seen.set(b.id, b);
    }
    return [...seen.values()];
  }, [opts, likedCats]);

  const toggle = (setFn) => (id) =>
    setFn(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  // Đổi danh mục đã thích thì dọn các lựa chọn phụ thuộc, tránh lưu một hãng
  // thuộc danh mục vừa bị bỏ chọn, hoặc một danh mục vừa thích vừa ghét.
  const toggleCat = (id) => {
    setLikedCats(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setDislikedCats(d => d.filter(x => !next.includes(x)));
      return next;
    });
  };

  const finish = async () => {
    setSaving(true);
    try {
      // Hãng "không quan tâm" chỉ tính trong các danh mục còn đang thích.
      const allowed = new Set(brandsForLiked.map(b => b.id));
      await api.b2c.saveMyPreferences({
        liked_categories: likedCats,
        liked_brands: likedBrands.filter(b => allowed.has(b)),
        disliked_categories: dislikedCats.filter(c => !likedCats.includes(c)),
        disliked_brands: dislikedBrands.filter(b => allowed.has(b) && !likedBrands.includes(b)),
        price_band: priceBand,
      });
      message.success('Đã lưu sở thích — gợi ý sẽ bám theo ý bạn');
      navigate('/', { replace: true });
    } catch (e) {
      message.error(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    try { await api.b2c.skipOnboarding(); } catch { /* bỏ qua lỗi: chỉ là ghi nhận */ }
    navigate('/', { replace: true });
  };

  if (!opts) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  }

  const T = isDark
    ? { bg: '#0b0b0d', card: '#141417', fg: '#fafafa', sub: '#8f8f99', line: '#2a2a2e', soft: '#1b1b1f', inv: '#fafafa', invFg: '#0b0b0d', no: '#f87171' }
    : { bg: '#f4f4f5', card: '#ffffff', fg: '#0a0a0a', sub: '#71717a', line: '#e4e4e7', soft: '#fafafa', inv: '#0a0a0a', invFg: '#ffffff', no: '#dc2626' };

  const canNext = step !== 0 || likedCats.length > 0;
  const last = step === STEPS.length - 1;

  const catsNotLiked = opts.categories.filter(c => !likedCats.includes(c.id));
  const brandsNotLiked = brandsForLiked.filter(b => !likedBrands.includes(b.id));

  return (
    <div className="ob-root" style={{
      '--fg': T.fg, '--sub': T.sub, '--line': T.line, '--soft': T.soft, '--card': T.card,
      '--inv': T.inv, '--inv-fg': T.invFg, '--no': T.no, background: T.bg,
    }}>
      <style>{CSS}</style>
      <div className="ob-card">
        <header className="ob-head">
          <div className="ob-kicker">Chào {b2cUser?.full_name?.split(' ').pop() || 'bạn'} 👋</div>
          <h1 className="ob-title">Giúp chúng tôi gợi ý đúng ý bạn</h1>
          <p className="ob-sub">Mất chừng 30 giây. Bỏ qua được, và sửa lại bất cứ lúc nào trong trang tài khoản.</p>

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
              <h2 className="ob-q">Bạn quan tâm những nhóm hàng nào?</h2>
              <p className="ob-hint">Chọn một hoặc nhiều</p>
              <div className="ob-grid">
                {opts.categories.map(c => (
                  <Chip key={c.id} on={likedCats.includes(c.id)} onClick={() => toggleCat(c.id)}>{c.name}</Chip>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="ob-q">Bạn hay dùng hãng nào?</h2>
              <p className="ob-hint">Trong các nhóm vừa chọn · không bắt buộc</p>
              {brandsForLiked.length === 0
                ? <p className="ob-empty">Chưa có hãng nào trong các nhóm này.</p>
                : <div className="ob-grid">
                    {brandsForLiked.map(b => (
                      <Chip key={b.id} on={likedBrands.includes(b.id)} onClick={() => toggle(setLikedBrands)(b.id)}>{b.name}</Chip>
                    ))}
                  </div>}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="ob-q">Tầm giá bạn thường mua?</h2>
              <p className="ob-hint">Chọn một · bấm lại để bỏ chọn</p>
              <div className="ob-grid ob-grid-2">
                {opts.priceBands.map(p => (
                  <Chip key={p.id} on={priceBand === p.id} onClick={() => setPriceBand(v => (v === p.id ? null : p.id))}>{p.label}</Chip>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="ob-q">Có gì bạn KHÔNG muốn thấy?</h2>
              <p className="ob-hint">Chúng tôi sẽ bớt gợi ý những thứ này · không bắt buộc</p>
              {catsNotLiked.length > 0 && (
                <>
                  <div className="ob-group">Nhóm hàng</div>
                  <div className="ob-grid">
                    {catsNotLiked.map(c => (
                      <Chip key={c.id} no on={dislikedCats.includes(c.id)} onClick={() => toggle(setDislikedCats)(c.id)}>{c.name}</Chip>
                    ))}
                  </div>
                </>
              )}
              {brandsNotLiked.length > 0 && (
                <>
                  <div className="ob-group">Hãng — trong những nhóm bạn quan tâm</div>
                  <div className="ob-grid">
                    {brandsNotLiked.map(b => (
                      <Chip key={b.id} no on={dislikedBrands.includes(b.id)} onClick={() => toggle(setDislikedBrands)(b.id)}>{b.name}</Chip>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <footer className="ob-foot">
          <button type="button" className="ob-link" onClick={skip}>Bỏ qua</button>
          <div className="ob-nav">
            {step > 0 && <button type="button" className="ob-btn ghost" onClick={() => setStep(s => s - 1)}>Quay lại</button>}
            {!last
              ? <button type="button" className="ob-btn" disabled={!canNext} onClick={() => setStep(s => s + 1)}>Tiếp</button>
              : <button type="button" className="ob-btn" disabled={saving} onClick={finish}>{saving ? 'Đang lưu…' : 'Hoàn tất'}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Chip({ on, no, onClick, children }) {
  return (
    <button type="button" className={`ob-chip${on ? (no ? ' no' : ' on') : ''}`} onClick={onClick} aria-pressed={on}>
      {on && <span className="ob-tick">{no ? '✕' : '✓'}</span>}
      {children}
    </button>
  );
}

const CSS = `
.ob-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
.ob-card { width: 100%; max-width: 620px; background: var(--card); border: 1px solid var(--line); border-radius: 20px;
           box-shadow: 0 20px 50px rgba(0,0,0,.08); overflow: hidden; }
.ob-head { padding: 30px 30px 18px; border-bottom: 1px solid var(--line); }
.ob-kicker { font-size: 13px; color: var(--sub); margin-bottom: 6px; }
.ob-title { margin: 0; font-size: 23px; font-weight: 700; color: var(--fg); letter-spacing: -.02em; }
.ob-sub { margin: 7px 0 0; font-size: 13px; color: var(--sub); line-height: 1.55; }

.ob-steps { display: flex; gap: 6px; margin-top: 20px; }
.ob-step { flex: 1; display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--sub); }
.ob-dot { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; border: 1px solid var(--line);
          display: grid; place-items: center; font-size: 11px; font-weight: 600; }
.ob-step.on .ob-dot { background: var(--inv); color: var(--inv-fg); border-color: var(--inv); }
.ob-step.done .ob-dot { background: var(--soft); color: var(--fg); }
.ob-step.on .ob-step-lb { color: var(--fg); font-weight: 600; }

.ob-body { padding: 24px 30px; min-height: 250px; }
.ob-q { margin: 0; font-size: 17px; font-weight: 650; color: var(--fg); }
.ob-hint { margin: 5px 0 18px; font-size: 12.5px; color: var(--sub); }
.ob-group { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
            color: var(--sub); margin: 16px 0 9px; }
.ob-group:first-of-type { margin-top: 0; }
.ob-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
.ob-grid-2 { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.ob-empty { color: var(--sub); font-size: 13px; }

.ob-chip { position: relative; display: flex; align-items: center; gap: 7px; min-height: 44px; padding: 10px 13px;
           border: 1px solid var(--line); border-radius: 11px; background: var(--card); color: var(--fg);
           font-size: 13.5px; text-align: left; cursor: pointer; transition: border-color .12s, background .12s; }
.ob-chip:hover { border-color: var(--sub); }
.ob-chip.on { background: var(--inv); color: var(--inv-fg); border-color: var(--inv); }
.ob-chip.no { border-color: var(--no); color: var(--no); background: transparent; }
.ob-tick { font-size: 12px; font-weight: 700; }

.ob-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px;
           padding: 16px 30px; border-top: 1px solid var(--line); background: var(--soft); }
.ob-link { background: none; border: none; color: var(--sub); font-size: 13px; cursor: pointer; padding: 6px 2px;
           text-decoration: underline; text-underline-offset: 3px; }
.ob-nav { display: flex; gap: 9px; }
.ob-btn { min-width: 108px; height: 42px; padding: 0 18px; border-radius: 10px; border: 1px solid var(--inv);
          background: var(--inv); color: var(--inv-fg); font-size: 14px; font-weight: 600; cursor: pointer; }
.ob-btn.ghost { background: transparent; color: var(--fg); border-color: var(--line); }
.ob-btn:disabled { opacity: .35; cursor: not-allowed; }

@media (max-width: 480px) {
  .ob-head, .ob-body, .ob-foot { padding-left: 18px; padding-right: 18px; }
  .ob-step-lb { display: none; }
  .ob-grid { grid-template-columns: 1fr 1fr; }
}
`;
