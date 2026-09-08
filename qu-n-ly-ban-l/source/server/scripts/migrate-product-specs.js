'use strict';
/**
 * migrate-product-specs.js — Batch generate specs <table> cho ~370K SP đang thiếu
 *
 * Quét tất cả SP có description nhưng không có <table>
 * → Dùng generateSpecsFromName() + category template
 * → Append <table> specs vào cuối HTML description
 *
 * Chạy: node scripts/migrate-product-specs.js
 */

const { prisma } = require('../src/db');
const PSC = require('../src/services/ProductSpecsCache');

const BATCH_SIZE = 2000;

function specsToHTML(specs, productName, brandId) {
  if (!specs || Object.keys(specs).length === 0) return null;

  const fieldLabels = {
    screen: 'Màn hình', chip: 'Chip', ram: 'RAM', storage: 'Bộ nhớ',
    camera: 'Camera', front_camera: 'Camera trước', battery: 'Pin',
    os: 'Hệ điều hành', weight: 'Khối lượng', gpu: 'Card đồ họa',
    connectivity: 'Kết nối', waterproof: 'Chống nước',
    wattage: 'Công suất', capacity: 'Dung lượng', ports: 'Cổng sạc',
    protocol: 'Chuẩn sạc', resolution: 'Độ phân giải', fps: 'FPS',
    feature: 'Tính năng', compatibility: 'Tương thích', type: 'Loại',
    material: 'Chất liệu', size: 'Kích thước', dpi: 'DPI',
    switch_type: 'Switch', layout: 'Layout', wifi_standard: 'Chuẩn WiFi',
    speed: 'Tốc độ', brightness: 'Độ sáng', generation: 'Thế hệ',
    connector: 'Jack cắm', magnification: 'Độ phóng đại',
    speed_class: 'Tốc độ', usb_standard: 'Chuẩn USB',
    interface: 'Giao tiếp', features: 'Tính năng', product: 'Sản phẩm',
    duration: 'Thời hạn', max_size: 'Hỗ trợ', arms: 'Số cánh tay',
    laptop_size: 'Laptop', brand_model: 'Model', pressure: 'Độ nhạy',
    polar_pattern: 'Hướng thu', frequency_response: 'Tần số',
    'switch': 'Switch',
  };

  const rows = Object.entries(specs)
    .map(([k, v]) => `<tr><td>${fieldLabels[k] || k}</td><td>${v}</td></tr>`)
    .join('');

  return `<table>${rows}</table>`;
}

async function migrate() {
  console.log('=== MIGRATION: Generate specs table cho SP thiếu ===\n');

  // Đếm tổng SP cần migrate
  const totalMissing = await prisma.product.count({
    where: {
      is_deleted: false,
      OR: [
        { description: { not: { contains: '<table>' } } },
        { description: null },
      ],
    },
  });

  console.log(`Tổng SP cần migrate: ${totalMissing.toLocaleString()}`);
  if (totalMissing === 0) {
    console.log('Không có SP nào cần migrate!');
    process.exit(0);
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let cursor = undefined;

  while (true) {
    const batch = await prisma.product.findMany({
      where: {
        is_deleted: false,
        OR: [
          { description: { not: { contains: '<table>' } } },
          { description: null },
        ],
      },
      select: { id: true, name: true, description: true, category_id: true, brand_id: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    const updates = [];

    for (const product of batch) {
      const specs = PSC.generateSpecsFromName(product.name, product.category_id);
      if (!specs) {
        skipped++;
        continue;
      }

      const tableHTML = specsToHTML(specs, product.name, product.brand_id);
      if (!tableHTML) {
        skipped++;
        continue;
      }

      const existingDesc = product.description || '';
      // Chèn table vào trong <div class="specs"> nếu có, hoặc tạo mới
      let newDesc;
      if (existingDesc.includes('</div>')) {
        // Chèn trước </div>
        newDesc = existingDesc.replace('</div>', `${tableHTML}</div>`);
      } else if (existingDesc) {
        newDesc = `<div class="specs"><h3>${product.name}</h3><p>${existingDesc}</p>${tableHTML}</div>`;
      } else {
        newDesc = `<div class="specs"><h3>${product.name}</h3>${tableHTML}</div>`;
      }

      updates.push(
        prisma.product.update({
          where: { id: product.id },
          data: { description: newDesc },
        })
      );
    }

    // Execute batch updates
    if (updates.length > 0) {
      await prisma.$transaction(updates);
      updated += updates.length;
    }
    skipped += batch.length - updates.length;
    processed += batch.length;

    const pct = Math.round(processed / totalMissing * 100);
    process.stdout.write(`\r  [${pct}%] Processed: ${processed.toLocaleString()} / ${totalMissing.toLocaleString()} | Updated: ${updated.toLocaleString()} | Skipped: ${skipped.toLocaleString()}`);
  }

  console.log('\n');
  console.log('=== MIGRATION COMPLETE ===');
  console.log(`  Total processed: ${processed.toLocaleString()}`);
  console.log(`  Updated (specs added): ${updated.toLocaleString()}`);
  console.log(`  Skipped (no pattern match): ${skipped.toLocaleString()}`);

  // Verify
  const remainingNoSpecs = await prisma.product.count({
    where: {
      is_deleted: false,
      description: { not: { contains: '<table>' } },
    },
  });
  console.log(`  Remaining without specs: ${remainingNoSpecs.toLocaleString()}`);

  process.exit(0);
}

migrate().catch(e => {
  console.error('\nMigration failed:', e);
  process.exit(1);
});
