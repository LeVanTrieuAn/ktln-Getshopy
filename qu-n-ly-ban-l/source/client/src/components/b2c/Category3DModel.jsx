/**
 * Category3DModel.jsx — Interactive 3D FBX viewer cho category cards
 * ════════════════════════════════════════════════════════════════════
 * UX Flow (v5 — always-mounted, GPU-optimized):
 *   1. Load → 3D model hiện ngay (tĩnh, không xoay)
 *   2. Hover → auto-rotate
 *   3. Rời chuột → DỪNG xoay, GIỮ NGUYÊN góc hiện tại
 *   4. Hover lại → tiếp tục xoay từ góc đã dừng
 *
 *   GPU optimization: DPR=1, frameloop=demand, context recovery handlers
 * ════════════════════════════════════════════════════════════════════
 */
import React, { useRef, useMemo, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';

// ─── Preload helper ──────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function preloadFBX(url) {
  useLoader.preload(FBXLoader, url);
}

// ─── Dispose helper ──────────────────────────────────────────────────────────
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

// ─── FBX Model inner component ───────────────────────────────────────────────
function FBXModel({ url, autoRotateSpeed, initialRotation, isHovered, onReady }) {
  const fbx = useLoader(FBXLoader, url);
  const { invalidate } = useThree();

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

  // Notify parent + force first render
  useEffect(() => {
    onReady();
    invalidate();
  }, [onReady, invalidate]);

  // Kick-start render loop when hover begins
  useEffect(() => {
    if (isHovered) invalidate();
  }, [isHovered, invalidate]);

  useFrame(() => {
    if (!pivotRef.current) return;
    if (isHoveredRef.current) {
      pivotRef.current.rotation.y += autoRotateSpeed;
      invalidate();
    }
    // Không hover → giữ nguyên góc, GPU nghỉ
  });

  return (
    <group ref={pivotRef}>
      <primitive object={wrapper} />
    </group>
  );
}

// ─── WebGL Context Recovery ──────────────────────────────────────────────────
function ContextRecovery() {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (e) => {
      e.preventDefault();
      console.warn('[Category3D] WebGL context lost, will restore...');
    };
    const handleRestored = () => {
      console.log('[Category3D] WebGL context restored');
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, invalidate]);

  return null;
}

// ─── Category3DModel — Exported Component ─────────────────────────────────────
const DEFAULT_ROTATION = [0, 0, 0];

export default function Category3DModel({
  fbxUrl,
  isDark,
  isHovered = false,
  height = 220,
  autoRotateSpeed = 0.005,
  initialRotation = DEFAULT_ROTATION,
}) {
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [fbxReady, setFbxReady] = useState(false);

  // IntersectionObserver — mount Canvas chỉ khi card trong viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '100px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleModelReady = useCallback(() => setFbxReady(true), []);

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>

      {/* Shimmer — hiện trong lúc FBX đang load */}
      {!fbxReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 12,
            background: isDark
              ? 'linear-gradient(110deg, #1e293b 8%, #334155 18%, #1e293b 33%)'
              : 'linear-gradient(110deg, #f5f5f7 8%, #e8e8ea 18%, #f5f5f7 33%)',
            backgroundSize: '200% 100%',
            animation: 'cat3d-shimmer 1.5s linear infinite',
          }} />
        </div>
      )}

      {/* Live 3D Canvas — always mounted when in view */}
      {isInView && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          opacity: fbxReady ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}>
          <Canvas
            frameloop="demand"
            dpr={1}
            camera={{ position: [0, 0, 4.5], fov: 40 }}
            gl={{
              powerPreference: 'default',
              antialias: false,
              alpha: true,
              stencil: false,
              depth: true,
              failIfMajorPerformanceCaveat: false,
            }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            <ContextRecovery />
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
