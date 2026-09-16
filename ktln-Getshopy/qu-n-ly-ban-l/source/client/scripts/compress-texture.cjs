/**
 * compress-texture.cjs
 * ════════════════════════════════════════════════════════════════
 * Tối ưu geometry trong GLB (dedup, weld, simplify, prune, re-draco).
 * Dùng gltf-transform optimize với --texture-compress false do
 * bug libvips/sharp trên Windows khi xử lý texture colorspace=32
 * (texture JPEG từ Meshy AI) — xem issue:
 * https://github.com/donmccurdy/glTF-Transform/issues
 *
 * NOTE về KTX2/WebP texture trong GLB:
 *   - Trên Linux/Mac: chạy `gltf-transform webp input.glb output.glb --quality 85`
 *   - Trên Windows: libvips báo lỗi "colourspace: parameter space not set"
 *     với texture từ Meshy AI → cần dùng trên Linux hoặc Docker
 *
 * Công nghệ: @gltf-transform/cli  (npm install -g @gltf-transform/cli)
 *
 * Chạy:
 *   node scripts/compress-texture.cjs
 *
 * Kết quả ước tính: giảm thêm ~5-10% geometry (sau Draco đã nén)
 * ════════════════════════════════════════════════════════════════
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');
const GLB_FILES  = [
  'Meshy_AI_Create_a_clean_reali_0814034508_texture.glb',
  'Meshy_AI_Create_a_highly_detai_0814020033_texture.glb',
  'Meshy_AI_Create_a_highly_detai_0814022556_texture.glb',
  'Meshy_AI_Create_a_highly_detai_0814023145_texture.glb',
  'Meshy_AI_Create_a_highly_detai_0814024521_texture.glb',
];

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ── Kiểm tra gltf-transform có sẵn không ───────────────────────
const gtCheck = spawnSync('gltf-transform', ['--version'], { shell: true });
if (gtCheck.status !== 0) {
  console.error('❌  gltf-transform không tìm thấy!');
  console.error('   Cài đặt: npm install -g @gltf-transform/cli');
  process.exit(1);
}
const gtVersion = gtCheck.stdout?.toString().trim() || '?';

console.log(`🔧  gltf-transform v${gtVersion}`);
console.log(`📦  Mode: geometry optimize + re-draco (no texture — Windows libvips workaround)`);
console.log(`\n⚠️  NOTE: WebP/KTX2 texture compress trong GLB bị lỗi trên Windows`);
console.log(`    (libvips/sharp colorspace=32 bug với Meshy AI textures)`);
console.log(`    → Để nén texture: chạy trên Linux/Docker:`);
console.log(`      gltf-transform webp input.glb output.glb --quality 85\n`);
console.log('🗜️  GLB Geometry Optimize (dedup + weld + simplify + prune + draco)\n' + '─'.repeat(65));

let totalBefore = 0, totalAfter = 0;

for (const file of GLB_FILES) {
  const input = path.join(ASSETS_DIR, file);
  const tmp   = path.join(ASSETS_DIR, '__opt_' + file);

  if (!fs.existsSync(input)) {
    console.log(`⚠️  Bỏ qua (không tìm thấy): ${file}`);
    continue;
  }

  const before = fs.statSync(input).size;
  totalBefore += before;

  console.log(`\n🔄  ${file}`);
  console.log(`    Trước: ${formatBytes(before)}`);

  try {
    // optimize: dedup, weld, simplify, prune, sparse, re-draco
    // --texture-compress false: bỏ qua nén texture (Windows workaround)
    execSync(
      `gltf-transform optimize "${input}" "${tmp}" --compress draco --texture-compress false`,
      { stdio: 'pipe' }
    );

    if (!fs.existsSync(tmp)) {
      console.log(`    ⚡ Không có output (bỏ qua)`);
      totalAfter += before;
      continue;
    }

    const after = fs.statSync(tmp).size;
    totalAfter += after;

    if (after < before) {
      fs.renameSync(tmp, input);
      const saved = before - after;
      const pct   = ((saved / before) * 100).toFixed(1);
      console.log(`    Sau:   ${formatBytes(after)}  (-${pct}%, tiết kiệm ${formatBytes(saved)})`);
      console.log(`    ✅  OK`);
    } else {
      fs.unlinkSync(tmp);
      totalAfter = totalAfter - after + before; // revert
      console.log(`    ⚡  Đã tối ưu, bỏ qua (không giảm được)`);
    }
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    totalAfter += before;
    console.error(`    ❌  Lỗi: ${err.message.split('\n')[0]}`);
  }
}

console.log('\n' + '─'.repeat(65));
if (totalBefore > 0) {
  const totalSaved = totalBefore - totalAfter;
  const totalPct   = ((Math.max(0, totalSaved) / totalBefore) * 100).toFixed(1);
  console.log(`📊  Tổng: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (-${totalPct}%)`);
  if (totalSaved > 0) console.log(`💾  Tiết kiệm: ${formatBytes(totalSaved)}`);
}

console.log('\n✨  Hoàn thành!');
console.log('\n💡  Để giảm thêm 30-50% GLB size (texture):');
console.log('    → Chạy trên Linux/Mac: gltf-transform webp input.glb output.glb --quality 85');
console.log('    → Hoặc dùng Docker: docker run --rm -v $(pwd):/data ghcr.io/donmccurdy/gltf-transform:latest webp ...');
