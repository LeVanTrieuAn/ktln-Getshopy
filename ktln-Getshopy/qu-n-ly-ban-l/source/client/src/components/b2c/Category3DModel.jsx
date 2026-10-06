/**
 * Category3DModel.jsx — Interactive 3D FBX viewer cho category cards
 * ════════════════════════════════════════════════════════════════════
 * UX Flow:
 *   1. Hiện ảnh snapshot tĩnh (PNG pre-generated từ script snapshot-fbx.cjs)
 *   2. Canvas 3D mount sẵn ngầm (hidden), FBX load sẵn trong background
 *   3. Hover → Canvas hiện lên + auto-rotate (instant, không delay)
 *   4. Rời chuột → Canvas ẩn, snapshot hiện lại
 *   5. Hover lại → Canvas hiện ngay (KHÔNG re-mount, đã mount sẵn)
 *
 * Refs:
 *   Three.js FBXLoader: https://threejs.org/docs/#examples/en/loaders/FBXLoader
 *   Performance pattern: docs/optimizing/OPTIMIZE-3D.md
 * ════════════════════════════════════════════════════════════════════
 */
import React, { useRef, useMemo, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';

// ─── Preload helper — gọi ở module-level để fetch FBX sớm ───────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function preloadFBX(url) {
  useLoader.preload(FBXLoader, url);
}

// ─── Dispose helper ───────────────────────────────────────────────────────────
function disposeObject(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (!m) return;
        m.map?.dispose(); m.normalMap?.dispose(); m.roughnessMap?.dispose();
        m.metalnessMap?.dispose(); m.emissiveMap?.dispose(); m.aoMap?.dispose();
        m.dispose();
      });
    }
  });
}

// ─── FBX Model (live 3D inside Canvas) ────────────────────────────────────────
function FBXModel({ url, autoRotateSpeed, initialRotation, isHovered, onReady }) {
  const fbx = useLoader(FBXLoader, url);
  const { invalidate } = useThree();

  // Inner group: holds the clone with initialRotation baked in
  // Outer pivot: used for auto-rotation (rotates around Y in world space)
  const pivotRef = useRef();
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;

  const wrapper = useMemo(() => {
    const clone = fbx.clone(true);

    if (initialRotation[0] || initialRotation[1] || initialRotation[2]) {
      clone.rotation.set(initialRotation[0], initialRotation[1], initialRotation[2]);
    }
    clone.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2.2 / maxDim : 1;

    const grp = new THREE.Group();
    grp.add(clone);
    grp.scale.setScalar(scale);
    grp.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    grp.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => { if (m) { m.side = THREE.DoubleSide; m.needsUpdate = true; } });
      }
    });

    return grp;
  }, [fbx, initialRotation]);

  useEffect(() => () => disposeObject(wrapper), [wrapper]);

  // Notify parent that model is ready to display
  useEffect(() => { onReady(); }, [onReady]);

  // Force first frame
  useEffect(() => { invalidate(); }, [invalidate]);

  // Kick-start render loop when hover begins
  // (frameloop="demand" means useFrame only runs during invalidate-triggered renders)
  useEffect(() => {
    if (isHovered) invalidate();
  }, [isHovered, invalidate]);

  useFrame(() => {
    if (!pivotRef.current) return;
    if (isHoveredRef.current) {
      pivotRef.current.rotation.y += autoRotateSpeed;
      invalidate();
    }
  });

  return (
    <group ref={pivotRef}>
      <primitive object={wrapper} />
    </group>
  );
}

// ─── Category3DModel — Exported Component ─────────────────────────────────────
/**
 * @param {Object}   props
 * @param {string}   props.fbxUrl          — URL to the .fbx file
 * @param {string}   props.snapshotImage   — Pre-generated PNG snapshot (from scripts/snapshot-fbx.cjs)
 * @param {boolean}  props.isDark
 * @param {boolean}  props.isHovered
 * @param {number}   [props.height=220]
 * @param {number}   [props.autoRotateSpeed=0.005]
 * @param {number[]} [props.initialRotation=[0,0,0]]
 */
const DEFAULT_ROTATION = [0, 0, 0];

export default function Category3DModel({
  fbxUrl,
  snapshotImage,
  isDark,
  isHovered = false,
  height = 220,
  autoRotateSpeed = 0.005,
  initialRotation = DEFAULT_ROTATION,
}) {
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [fbxReady, setFbxReady] = useState(false);

  // IntersectionObserver — mount Canvas chỉ khi card gần viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '200px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleModelReady = useCallback(() => setFbxReady(true), []);

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>

      {/* Layer 1: Snapshot PNG — hiện ngay lập tức, mờ dần khi hover */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        transition: 'opacity 0.3s ease',
        opacity: isHovered && fbxReady ? 0 : 1,
        pointerEvents: 'none',
      }}>
        {snapshotImage ? (
          <img
            src={snapshotImage}
            alt=""
            loading="lazy"
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              WebkitUserDrag: 'none',
            }}
          />
        ) : (
          // Fallback shimmer nếu chưa có snapshot PNG
          <div style={{
            width: '100%', height: '100%', borderRadius: 12,
            background: isDark
              ? 'linear-gradient(110deg, #1e293b 8%, #334155 18%, #1e293b 33%)'
              : 'linear-gradient(110deg, #f5f5f7 8%, #e8e8ea 18%, #f5f5f7 33%)',
            backgroundSize: '200% 100%',
            animation: 'cat3d-shimmer 1.5s linear infinite',
          }} />
        )}
      </div>

      {/* Layer 2: Live Canvas — LUÔN mounted (không unmount), chỉ toggle opacity */}
      {isInView && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          opacity: isHovered && fbxReady ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: isHovered && fbxReady ? 'auto' : 'none',
        }}>
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            performance={{ min: 0.5 }}
            camera={{ position: [0, 0, 4.5], fov: 40 }}
            gl={{ powerPreference: 'high-performance', antialias: false, alpha: true }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            <ambientLight intensity={0.65} />
            <directionalLight position={[4, 6, 4]} intensity={1.3} color="#ffffff" />
            <directionalLight position={[-3, -2, -3]} intensity={0.4} color={isDark ? '#a7f3d0' : '#e5e7eb'} />
            <hemisphereLight
              skyColor={isDark ? '#1e293b' : '#f0f9ff'}
              groundColor={isDark ? '#064e3b' : '#ecfdf5'}
              intensity={0.4}
            />
            <Suspense fallback={null}>
              <FBXModel
                url={fbxUrl}
                autoRotateSpeed={autoRotateSpeed}
                initialRotation={initialRotation}
                isHovered={isHovered}
                onReady={handleModelReady}
              />
            </Suspense>
          </Canvas>
        </div>
      )}

      <style>{`
        @keyframes cat3d-shimmer {
          to { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
