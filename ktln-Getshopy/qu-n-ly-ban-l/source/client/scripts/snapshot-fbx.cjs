/**
 * snapshot-fbx.cjs — Script tự động chụp ảnh snapshot từ các model FBX
 * ═══════════════════════════════════════════════════════════════════════
 * Dùng Puppeteer (headless Chrome với WebGL thật) để:
 *   1. Tạo HTML page tạm render model FBX bằng Three.js
 *   2. Chụp screenshot từng model
 *   3. Lưu PNG vào src/assets/
 *
 * Chạy: node scripts/snapshot-fbx.cjs
 *
 * Refs: Puppeteer docs https://pptr.dev/
 * ═══════════════════════════════════════════════════════════════════════
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── Config ───────────────────────────────────────────────────────────────────
const SNAPSHOT_WIDTH  = 600;
const SNAPSHOT_HEIGHT = 440;

const MODELS = [
  {
    fbx: 'iPhone13ProMax.fbx',
    out: 'snapshot_phone.png',
    rotation: [0, 0, 0],       // đúng trục
  },
  {
    fbx: 'COMPUTER.fbx',
    out: 'snapshot_laptop.png',
    rotation: [0, 0, 0],
  },
  {
    fbx: 'Ipad+Pro(2024).fbx',
    out: 'snapshot_tablet.png',
    rotation: [0, 0, 0],
  },
  {
    fbx: 'power_adapterr.fbx',
    out: 'snapshot_adapter.png',
    rotation: [0, 1.5707963, 0], // Xoay 90° trục Y → nhìn thẳng mặt trước có pin
  },
  {
    fbx: 'smartwatch.fbx',
    out: 'snapshot_watch.png',
    rotation: [-1.5707963, 0, 0],   // -PI/2: Z-up → Y-up
  },
];

const ASSETS_DIR = path.resolve(__dirname, '../src/assets');

// ─── Serve assets statically on a temp port ───────────────────────────────────
function serveAssets(port) {
  const server = http.createServer((req, res) => {
    const filePath = path.join(ASSETS_DIR, decodeURIComponent(req.url));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': req.url.endsWith('.fbx') ? 'application/octet-stream' : 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// ─── HTML template to render one FBX model ───────────────────────────────────
function makeHtml(fbxUrl, rotation, width, height) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${width}px; height:${height}px; overflow:hidden; background:transparent; }
  canvas { display:block; }
</style>
</head>
<body>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const W = ${width}, H = ${height};
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000);
camera.position.set(0, 0, 4.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(W, H);
renderer.setPixelRatio(2);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const d1 = new THREE.DirectionalLight(0xffffff, 1.3);
d1.position.set(4, 6, 4);
scene.add(d1);
const d2 = new THREE.DirectionalLight(0xe5e7eb, 0.4);
d2.position.set(-3, -2, -3);
scene.add(d2);
scene.add(new THREE.HemisphereLight(0xf0f9ff, 0xecfdf5, 0.4));

// Load FBX
const loader = new FBXLoader();
loader.load('${fbxUrl}', (fbx) => {
  // Apply rotation correction
  const rot = ${JSON.stringify(rotation)};
  fbx.rotation.set(rot[0], rot[1], rot[2]);
  fbx.updateMatrixWorld(true);

  // Auto-center + scale
  const box = new THREE.Box3().setFromObject(fbx);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? 2.2 / maxDim : 1;

  const wrapper = new THREE.Group();
  wrapper.add(fbx);
  wrapper.scale.setScalar(scale);
  wrapper.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  // DoubleSide materials
  wrapper.traverse(child => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { if (m) { m.side = THREE.DoubleSide; m.needsUpdate = true; } });
    }
  });

  scene.add(wrapper);
  
  // Render continuously for a few seconds to ensure textures load and decode
  function animate() {
    if (!window.__SNAPSHOT_READY__) requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  // Wait a bit for textures to load
  setTimeout(() => {
    window.__SNAPSHOT_READY__ = true;
  }, 3000);
}, undefined, (err) => {
  console.error('FBX load error:', err);
  window.__SNAPSHOT_ERROR__ = true;
});
</script>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const ASSET_PORT = 19871;
  console.log(`[snapshot-fbx] Starting asset server on port ${ASSET_PORT}...`);
  const server = await serveAssets(ASSET_PORT);

  console.log('[snapshot-fbx] Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-unsafe-webgpu',
      '--disable-gpu-sandbox',
    ],
  });

  for (const model of MODELS) {
    const outPath = path.join(ASSETS_DIR, model.out);
    // Overwrite existing snapshots
    // if (fs.existsSync(outPath)) {
    //   console.log(`[snapshot-fbx] Skip (already exists): ${model.out}`);
    //   continue;
    // }

    console.log(`[snapshot-fbx] Rendering: ${model.fbx} → ${model.out}`);
    const page = await browser.newPage();
    await page.setViewport({ width: SNAPSHOT_WIDTH, height: SNAPSHOT_HEIGHT });

    const fbxUrl = `http://localhost:${ASSET_PORT}/${encodeURIComponent(model.fbx)}`;
    const html = makeHtml(fbxUrl, model.rotation, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Wait for model to load and render (max 30s)
    const ready = await page.waitForFunction(
      '() => window.__SNAPSHOT_READY__ === true || window.__SNAPSHOT_ERROR__ === true',
      { timeout: 30000 }
    ).then(() => true).catch(() => false);

    if (!ready) {
      console.error(`[snapshot-fbx] TIMEOUT: ${model.fbx}`);
      await page.close();
      continue;
    }

    const hasError = await page.evaluate(() => !!window.__SNAPSHOT_ERROR__);
    if (hasError) {
      console.error(`[snapshot-fbx] ERROR loading: ${model.fbx}`);
      await page.close();
      continue;
    }

    // We already waited 3000ms inside the browser context, just a small buffer here
    await new Promise(r => setTimeout(r, 500));

    await page.screenshot({
      path: outPath,
      omitBackground: true,   // transparent PNG
      clip: { x: 0, y: 0, width: SNAPSHOT_WIDTH, height: SNAPSHOT_HEIGHT },
    });

    console.log(`[snapshot-fbx] ✓ Saved: ${model.out}`);
    await page.close();
  }

  await browser.close();
  server.close();
  console.log('[snapshot-fbx] Done!');
})();
