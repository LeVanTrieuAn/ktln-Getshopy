/**
 * HeroBanner3D.jsx — Three.js / R3F 3D scene cho HeroBanner
 * ════════════════════════════════════════════════════════════════
 * File này được lazy-loaded qua React.lazy() từ HeroBanner.jsx,
 * giúp vendor-three (190 KB gzip) + vendor-r3f (92 KB gzip) không
 * block initial render → TBT giảm ~282 KB.
 *
 * Props:
 *   animRef        — { progress: number }    (written by GSAP ScrollTrigger)
 *   invalidateRef  — { fn: Function|null }   (bridge GSAP → WebGL invalidate)
 * ════════════════════════════════════════════════════════════════
 */
import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';

// ─── Assets ───────────────────────────────────────────────────────────────────
import m1Url  from '../../assets/Meshy_AI_Create_a_highly_detai_0814020033_texture.glb';
import m2Url  from '../../assets/Meshy_AI_Create_a_highly_detai_0814022556_texture.glb';
import m3Url  from '../../assets/Meshy_AI_Create_a_highly_detai_0814023145_texture.glb';
import m4Url  from '../../assets/Meshy_AI_Create_a_highly_detai_0814024521_texture.glb';
import boxUrl from '../../assets/Meshy_AI_Create_a_clean_reali_0814034508_texture.glb';

// ─── Draco decoder ────────────────────────────────────────────────────────────
// Points to Google's CDN. Fetched once and cached — no extra bundle weight.
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// ─── Preload all GLB assets ───────────────────────────────────────────────────
// Bắt đầu fetch ngay khi chunk này được tải (sau lazy import),
// trước khi bất kỳ component nào render.
useGLTF.preload(m1Url);
useGLTF.preload(m2Url);
useGLTF.preload(m3Url);
useGLTF.preload(m4Url);
useGLTF.preload(boxUrl);

// ─── Product configuration ────────────────────────────────────────────────────
const PRODUCTS = [
  { url: m1Url, finalPos: [-8.5, 3.2, -1],  finalScale: 1.65, initialRotation: [0.1,  0.5,  0],    rotateSpeed: [0, 0.003, 0],          floatFreq: 0.80, floatAmp: 0.12, stagger: 0.00 },
  { url: m2Url, finalPos: [8.5, -3.2, -2],  finalScale: 1.55, initialRotation: [0.2, -0.5,  0.1],  rotateSpeed: [0.001, 0.005, 0.001],  floatFreq: 0.65, floatAmp: 0.15, stagger: 0.04 },
  { url: m3Url, finalPos: [8.5,  3.2,  0],  finalScale: 1.6,  initialRotation: [-0.1, 0.3,  0.05], rotateSpeed: [0, 0.004, 0],          floatFreq: 0.90, floatAmp: 0.10, stagger: 0.08 },
  { url: m4Url, finalPos: [-8.2, -3.2, 1],  finalScale: 1.2,  initialRotation: [0.15,-0.2,  0.1],  rotateSpeed: [0.002, 0.004, 0],      floatFreq: 0.55, floatAmp: 0.14, stagger: 0.12 },
];

// ─── Math helpers ─────────────────────────────────────────────────────────────
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const lerp         = (a, b, t) => a + (b - a) * t;
const clamp        = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Dispose helper — frees GPU memory for a cloned Three.js Object3D ─────────
function disposeObject(obj) {
  obj.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      m.map?.dispose();
      m.normalMap?.dispose();
      m.roughnessMap?.dispose();
      m.metalnessMap?.dispose();
      m.dispose();
    });
  });
}

// ─── Loading Skeleton (Suspense fallback) ─────────────────────────────────────
// Shown inside the Canvas while useGLTF suspends during network fetch.
// Geometry thuần Three.js — không cần tải thêm tài nguyên nào.
function LoadingSkeleton() {
  const ringRef  = useRef();
  const ring2Ref = useRef();
  const dotRef   = useRef();

  useFrame((_, delta) => {
    if (ringRef.current)  ringRef.current.rotation.z  -= delta * 1.2;
    if (ring2Ref.current) ring2Ref.current.rotation.z += delta * 0.8;
    if (dotRef.current)   dotRef.current.rotation.y   += delta * 2.0;
  });

  return (
    <group>
      {/* Outer ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2.2, 0.06, 12, 80]} />
        <meshStandardMaterial color="#059669" opacity={0.6} transparent />
      </mesh>
      {/* Inner ring */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.4, 0.04, 12, 60]} />
        <meshStandardMaterial color="#10b981" opacity={0.4} transparent />
      </mesh>
      {/* Centre dot */}
      <mesh ref={dotRef}>
        <octahedronGeometry args={[0.35]} />
        <meshStandardMaterial color="#064e3b" />
      </mesh>
      <ambientLight intensity={0.8} />
    </group>
  );
}

// ─── FrameController ─────────────────────────────────────────────────────────
function FrameController({ animRef, invalidateRef }) {
  const { invalidate } = useThree();

  // Bridge: cho phép GSAP (chạy ngoài React tree) gọi invalidate()
  useEffect(() => {
    invalidateRef.fn = invalidate;
    return () => { invalidateRef.fn = null; };
  }, [invalidate, invalidateRef]);

  useFrame(() => {
    // Keep frames alive only during the float phase (progress ≥ 0.40).
    // Before that the box is static and the canvas should idle.
    if (animRef.progress >= 0.40) invalidate();
  });

  return null;
}

// ─── Box Model ────────────────────────────────────────────────────────────────
function BoxModel({ animRef }) {
  const { scene } = useGLTF(boxUrl);
  const cloned    = useMemo(() => scene.clone(), [scene]);
  const groupRef  = useRef();

  // Tier-2: dispose cloned geometry + materials on unmount
  useEffect(() => () => disposeObject(cloned), [cloned]);

  useFrame(() => {
    if (!groupRef.current) return;
    const p = animRef.progress;

    const raw     = p < 0.10 ? 1 : p > 0.28 ? 0 : 1 - (p - 0.10) / 0.18;
    const opacity = clamp(raw, 0, 1);
    groupRef.current.visible = opacity > 0.01;
    if (!groupRef.current.visible) return;

    groupRef.current.scale.setScalar(1 + (1 - opacity) * 0.25);

    groupRef.current.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => { m.transparent = true; m.opacity = opacity; });
    });
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={cloned} scale={1.8} />
      </Center>
    </group>
  );
}

// ─── Animated Product ─────────────────────────────────────────────────────────
function AnimatedProduct({ config, animRef }) {
  const { scene }      = useGLTF(config.url);
  const cloned         = useMemo(() => scene.clone(), [scene]);
  const { invalidate } = useThree();

  const groupRef   = useRef();
  const meshRef    = useRef();
  const isDragging = useRef(false);
  const prevPtr    = useRef({ x: 0, y: 0 });
  const floatClock = useRef(Math.random() * Math.PI * 2);

  // Tier-2: dispose VRAM resources on unmount (triggered when Canvas unmounts
  // via IntersectionObserver, or when component is removed from the tree).
  useEffect(() => () => disposeObject(cloned), [cloned]);

  const PHASE_START = 0.22 + config.stagger;
  const PHASE_END   = 0.92;

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return;
    const p = animRef.progress;

    if (p < PHASE_START) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;

    const localP = clamp((p - PHASE_START) / (PHASE_END - PHASE_START), 0, 1);
    const eased  = easeOutCubic(localP);
    const [fx, fy, fz] = config.finalPos;

    const arcZ = Math.sin(localP * Math.PI) * 3.0;
    groupRef.current.position.set(lerp(0, fx, eased), lerp(0, fy, eased), lerp(0, fz, eased) + arcZ);
    groupRef.current.scale.setScalar(lerp(0, config.finalScale, eased));

    if (localP > 0.75) {
      floatClock.current += delta * config.floatFreq;
      const blend = clamp((localP - 0.75) / 0.25, 0, 1);
      groupRef.current.position.y += Math.sin(floatClock.current) * config.floatAmp * blend;
    }

    if (!isDragging.current) {
      meshRef.current.rotation.x += config.rotateSpeed[0];
      meshRef.current.rotation.y += config.rotateSpeed[1];
      meshRef.current.rotation.z += config.rotateSpeed[2];
    }
  });

  const onDown = (e) => {
    e.stopPropagation();
    isDragging.current = true;
    prevPtr.current = { x: e.clientX, y: e.clientY };
    e.target.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'grabbing';
  };

  const onMove = (e) => {
    if (!isDragging.current || !meshRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - prevPtr.current.x;
    const dy = e.clientY - prevPtr.current.y;
    prevPtr.current = { x: e.clientX, y: e.clientY };
    meshRef.current.rotation.y += dx * 0.012;
    meshRef.current.rotation.x += dy * 0.012;
    invalidate();
  };

  const onUp = (e) => {
    e.stopPropagation();
    isDragging.current = false;
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
    document.body.style.cursor = 'grab';
  };

  return (
    <group ref={groupRef}>
      <group
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!isDragging.current) document.body.style.cursor = 'auto'; }}
      >
        <Center>
          <primitive ref={meshRef} object={cloned} scale={1} rotation={config.initialRotation} />
        </Center>
      </group>
    </group>
  );
}

// ─── 3D Scene ──────────────────────────────────────────────────────────────────
function Scene({ animRef, invalidateRef }) {
  return (
    <>
      <FrameController animRef={animRef} invalidateRef={invalidateRef} />

      {/*
        ── Ánh sáng thủ công (thay thế Environment preset="city")
        Environment preset tải file .hdr từ GitHub raw CDN → bị rate-limit 429.
        Dùng 3 điểm ánh sáng sau để tạo hiệu ứng tương đương, hoàn toàn offline.
      */}
      <ambientLight intensity={0.55} />
      {/* Key light — ánh sáng chính từ trên cao, hơi sang phải */}
      <directionalLight position={[6, 10, 6]}  intensity={1.4} color="#ffffff" />
      {/* Fill light — từ dưới trái, giảm bóng cứng */}
      <directionalLight position={[-8, -4, -4]} intensity={0.5} color="#a7f3d0" />
      {/* Rim light — viền đường vành thương hiệu Getshopy */}
      <directionalLight position={[0, -6, -8]}  intensity={0.3} color="#059669" />
      {/* Hemisphere — mô phỏng ánh sáng môi trường (sky vs ground) */}
      <hemisphereLight skyColor="#dbeafe" groundColor="#064e3b" intensity={0.4} />

      {/* Suspense bao GLB loaders — không hiện gì khi đang tải */}
      <Suspense fallback={null}>
        <BoxModel animRef={animRef} />
        {PRODUCTS.map((cfg, i) => <AnimatedProduct key={i} config={cfg} animRef={animRef} />)}
      </Suspense>
    </>
  );
}

// ─── HeroBanner3D — Default Export (lazy-loaded chunk) ───────────────────────
/**
 * @param {Object} props
 * @param {{ progress: number }}   props.animRef       — GSAP scroll progress bridge
 * @param {{ fn: Function|null }}  props.invalidateRef — R3F invalidate bridge
 * @param {boolean}                props.isInView      — Mount Canvas only when in viewport
 */
export default function HeroBanner3D({ animRef, invalidateRef, isInView }) {
  const [canvasKey, setCanvasKey]       = React.useState(0);
  const [canvasEnabled, setCanvasEnabled] = React.useState(true);
  const contextHandled = React.useRef(false);
  const recoveryTimer  = React.useRef(null);

  React.useEffect(() => () => {
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
  }, []);

  const handleCreated = React.useCallback(({ gl }) => {
    // CAPTURE PHASE + stopImmediatePropagation:
    // - Capture phase: chạy TRƯỚC handler nội bộ của R3F (bubble phase)
    // - stopImmediatePropagation: R3F không nhận event → không tự tạo WebGLRenderer mới
    // → Phá vỡ vòng lặp: context lost → R3F tạo renderer → context lost → ...
    gl.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation(); // R3F sẽ KHÔNG nhận event này

      if (contextHandled.current) return; // chỉ xử lý 1 lần
      contextHandled.current = true;

      // Xóa Canvas khỏi DOM ngay lập tức — không remount ngay
      setCanvasEnabled(false);

      // Thử khôi phục 1 lần duy nhất sau 6s
      // (đủ dài để Lighthouse/headless hoàn thành screenshot, giải phóng GPU)
      recoveryTimer.current = setTimeout(() => {
        recoveryTimer.current = null;
        contextHandled.current = false;
        setCanvasKey((k) => k + 1);
        setCanvasEnabled(true);
      }, 6000);
    }, true /* capture = true */);
  }, []);

  return (isInView && canvasEnabled) ? (
    <Canvas
      key={canvasKey}
      frameloop="demand"
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      camera={{ position: [0, 0, 12], fov: 50 }}
      gl={{ powerPreference: 'high-performance', antialias: false }}
      style={{ pointerEvents: 'auto' }}
      onCreated={handleCreated}
    >
      <Scene animRef={animRef} invalidateRef={invalidateRef} />
    </Canvas>
  ) : null;
}
