/**
 * analyze-naming.js — Phân tích cách đặt tên 18K sản phẩm gốc
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();

(async () => {
  const cats = [
    'cat-phone','cat-laptop','cat-tablet','cat-watch',
    'cat-mobile-acc-charger','cat-mobile-acc-case-phone','cat-mobile-acc-screen',
    'cat-mobile-acc-case-tablet','cat-mobile-acc-powerbank','cat-mobile-acc-stand',
    'cat-mobile-acc-fan','cat-mobile-acc-cam-cover','cat-mobile-acc-airpods-case',
    'cat-laptop-acc-mouse','cat-laptop-acc-keyboard','cat-laptop-acc-bag',
    'cat-laptop-acc-mousepad','cat-laptop-acc-pouch','cat-laptop-acc-drawing',
    'cat-laptop-acc-hub',
    'cat-av-bt-earphone','cat-av-headphone','cat-av-wire-earphone',
    'cat-av-sport-earphone','cat-av-speaker','cat-av-mic',
    'cat-av-hdd','cat-av-sdcard','cat-av-usb','cat-av-projector',
    'cat-cam-security','cat-cam-indoor','cat-cam-doorbell',
  ];

  const allNames = {};
  
  for (const cat of cats) {
    // Get REAL product names (non-picsum = real products from original 18K)
    const samples = await p.product.findMany({
      where: { category_id: cat, is_deleted: false },
      select: { name: true, brand_id: true },
      take: 50,
      orderBy: { id: 'asc' },
    });
    
    if (samples.length > 0) {
      allNames[cat] = samples.map(s => ({ name: s.name, brand: s.brand_id }));
      console.log(`\n=== ${cat} (${samples.length} samples) ===`);
      for (const s of samples.slice(0, 20)) {
        console.log(`  [${s.brand_id}] ${s.name}`);
      }
    }
  }

  // Export for reference
  const outPath = path.join(__dirname, 'data', 'real-name-samples.json');
  fs.writeFileSync(outPath, JSON.stringify(allNames, null, 2));
  console.log(`\nExported to: ${outPath}`);
})().finally(() => p.$disconnect());
