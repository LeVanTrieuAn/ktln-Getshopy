/**
 * compress-glb.js
 * Compresses all GLB files in src/assets using Draco encoding.
 * Run with: node scripts/compress-glb.js
 *
 * Results go to src/assets/ with the same filename (overwrites originals).
 * Draco compression typically reduces GLB size by 50–80%.
 */
const { execSync } = require('child_process');
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
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

console.log('🗜️  Draco GLB Compression\n' + '─'.repeat(50));

let totalBefore = 0, totalAfter = 0;

for (const file of GLB_FILES) {
  const input  = path.join(ASSETS_DIR, file);
  const tmp    = path.join(ASSETS_DIR, '__tmp_' + file);

  if (!fs.existsSync(input)) {
    console.log(`⚠️  Skipped (not found): ${file}`);
    continue;
  }

  const before = fs.statSync(input).size;
  totalBefore += before;

  try {
    execSync(
      `gltf-pipeline -i "${input}" -o "${tmp}" --draco.compressionLevel 7 --draco.quantizePositionBits 14 --draco.quantizeNormalBits 10 --draco.quantizeTexcoordBits 12`,
      { stdio: 'pipe' }
    );

    const after = fs.statSync(tmp).size;
    totalAfter += after;

    // Replace original only if compression actually reduced size
    if (after < before) {
      fs.renameSync(tmp, input);
      const pct = (((before - after) / before) * 100).toFixed(1);
      console.log(`✅  ${file}`);
      console.log(`    ${formatBytes(before)} → ${formatBytes(after)}  (-${pct}%)\n`);
    } else {
      fs.unlinkSync(tmp);
      console.log(`⚡  ${file} — already optimal, skipped\n`);
    }
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.error(`❌  ${file}: ${err.message}\n`);
  }
}

console.log('─'.repeat(50));
console.log(`Total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (-${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%)`);
