/**
 * HeroBanner.jsx — Getshopy Hero Banner
 * ════════════════════════════════════════════════════════════════
 * Tier-1 + Tier-2 performance optimisations:
 *
 * Tier 1 (render budget):
 *   • frameloop="demand"       — render only when invalidated         [HeroBanner3D]
 *   • FrameController          — self-loops only during float phase   [HeroBanner3D]
 *   • IntersectionObserver     — unmounts Canvas when off-screen
 *   • dpr={[1, 1.5]}           — caps pixel ratio                     [HeroBanner3D]
 *   • performance={{ min:0.5}} — adaptive quality                     [HeroBanner3D]
 *
 * Tier 2 (load + memory):
 *   • React.lazy + Suspense    — defers vendor-three (190 KB) + vendor-r3f (92 KB)
 *                                away from the initial bundle → TBT −282 KB
 *   • <picture> WebP fallback  — hero_bg_light.webp (~100 KB) vs .png (433 KB)
 *   • <Suspense> + 3D skeleton — graceful loading state               [HeroBanner3D]
 *   • dispose() on unmount     — frees VRAM for cloned scenes/mats   [HeroBanner3D]
 *   • Draco-compressed GLBs    — (run scripts/compress-glb.cjs)      [HeroBanner3D]
 * ════════════════════════════════════════════════════════════════
 */
import { lazy, useRef, useState, useEffect, Suspense } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// ─── Assets ───────────────────────────────────────────────────────────────────
import heroBgWebP from '../../assets/hero_bg_light.webp';
import heroBgPng  from '../../assets/hero_bg_light.png';

// ─── Lazy-load 3D scene ───────────────────────────────────────────────────────
// vendor-three (190 KB gzip) + vendor-r3f (92 KB gzip) chỉ tải khi cần,
// KHÔNG block initial render → TBT giảm ~282 KB.
const HeroBanner3D = lazy(() => import('./HeroBanner3D'));

gsap.registerPlugin(ScrollTrigger, useGSAP);

// ─── Shared state bridges ─────────────────────────────────────────────────────
// Module-level refs để tránh re-render khi GSAP cập nhật progress.
const anim          = { progress: 0 };   // written by GSAP, read by useFrame (HeroBanner3D)
const r3fInvalidate = { fn: null };      // R3F invalidate() bridge: GSAP → WebGL

// ─── Math helpers ─────────────────────────────────────────────────────────────
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const lerp         = (a, b, t) => a + (b - a) * t;
const clamp        = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Hero Banner Component ────────────────────────────────────────────────────
export default function HeroBanner() {
  const heroRef    = useRef(null);
  const wrapperRef = useRef(null);   // observe wrapper (GSAP không touch) thay vì section
  const [isInView, setIsInView] = useState(true);

  // Tier-1: IntersectionObserver — unmount Canvas when hero leaves viewport.
  // QUAN TRỌNG: observe wrapperRef (div ngoài), KHÔNG observe heroRef (section).
  // Lý do: GSAP ScrollTrigger apply transform: translateY(1460px) lên section
  // khi scroll qua hero zone — IntersectionObserver sẽ thấy section như ở off-screen
  // dù thực tế hero vẫn visible → isInView=false → Canvas unmount sai.
  // Wrapper không bị GSAP move nên vị trí luôn chính xác.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '100px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useGSAP(() => {
    const wrapper  = wrapperRef.current;
    const wordmark = wrapper.querySelector('.gsap-wordmark');

    gsap.set(wordmark, { opacity: 0, y: 30 });

    ScrollTrigger.create({
      trigger:      wrapper,
      start:        'top top',
      end:          'bottom bottom', // Exactly 200vh of scrub distance
      scrub:        1,
      onUpdate: (self) => {
        const p = self.progress;
        anim.progress = p;
        r3fInvalidate.fn?.();

        const wAlpha = easeOutCubic(clamp((p - 0.65) / 0.30, 0, 1));
        gsap.set(wordmark, { opacity: wAlpha, y: lerp(30, 0, wAlpha) });
      },
    });
  }, { scope: wrapperRef });

  // .hero-pin-wrapper: contain: layout → isolate layout context.
  // GSAP pinSpacing vẫn add spacer, nhưng chỉ trong layout context này
  // (không làn sang main.ant-layout-content → CLS giảm đáng kể).
  return (
    <div ref={wrapperRef} className="hero-pin-wrapper" style={styles.pinWrapper}>
      <section ref={heroRef} style={styles.section}>

        {/* Background image — WebP với PNG fallback */}
        <div className="gsap-bg-wrap" style={styles.bgWrapper}>
          <picture>
            <source srcSet={heroBgWebP} type="image/webp" />
            <img
              src={heroBgPng}
              alt="Getshopy Hero"
              style={styles.bg}
              loading="eager"
              width="1920"
              height="1080"
              fetchPriority="high"
            />
          </picture>
          <div style={styles.vignette} />
        </div>

        <div style={styles.centerGlow} />

        <div className="gsap-wordmark" style={styles.wordmark}>GetShopy</div>

        {/* 3D Canvas — lazy-loaded, chỉ mount khi hero in viewport */}
        <div style={styles.canvasWrapper}>
          <Suspense fallback={null}>
            <HeroBanner3D
              animRef={anim}
              invalidateRef={r3fInvalidate}
              isInView={isInView}
            />
          </Suspense>
        </div>

      </section>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  // pinWrapper: tất cả styles giờ được định nghĩa trong CSS class `.hero-pin-wrapper`
  // (index.css) để browser biết height=300vh TRƯỚC khi JS/React mount → không CLS.
  // Inline style được xoá để tránh override class.
  pinWrapper: {},
  section: {
    position: 'sticky', top: 0, width: '100%', height: '100vh',
    overflow: 'hidden', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  bgWrapper: {
    position: 'absolute', inset: 0, zIndex: 0,
    WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
    maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
  },
  bg: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', transformOrigin: 'center center',
  },
  vignette: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 85% 75% at 50% 50%, transparent 45%, rgba(200,220,215,0.4) 100%)',
    pointerEvents: 'none',
  },
  centerGlow: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)', width: 700, height: 400,
    background: 'radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 65%)',
    zIndex: 2, pointerEvents: 'none',
  },
  wordmark: {
    position: 'absolute', zIndex: 5,
    fontSize: 'clamp(64px, 10vw, 140px)', fontWeight: 900, fontStyle: 'italic',
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
    background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
    letterSpacing: '-1.5px', lineHeight: 1.1, paddingRight: '12px',
    userSelect: 'none', cursor: 'default', willChange: 'transform, opacity',
    filter: 'drop-shadow(0 4px 12px rgba(16,185,129,0.15))',
  },
  canvasWrapper: {
    position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
  },
};
