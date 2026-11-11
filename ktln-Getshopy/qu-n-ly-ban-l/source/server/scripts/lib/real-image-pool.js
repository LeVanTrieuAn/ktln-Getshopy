'use strict';
/**
 * real-image-pool.js — bộ ảnh sản phẩm THẬT để gán cho catalog tổng hợp.
 * ─────────────────────────────────────────────────────────────────
 * Catalog 600k do fill-600k.js sinh ra mang ảnh picsum.photos (ảnh ngẫu nhiên,
 * không liên quan sản phẩm). Không có ảnh đúng từng sản phẩm vì sản phẩm là
 * tổng hợp; thay vào đó gán ảnh của một sản phẩm THẬT cùng loại, ưu tiên:
 *
 *   1. brand    — cùng danh mục + cùng hãng   (data/tgdd-products.json)
 *   2. category — cùng danh mục, khác hãng    (data/tgdd-products.json)
 *   3. crawl    — danh mục bộ crawl cũ không có (data/extra-category-images.json,
 *                 tạo bởi scripts/crawl-category-images.js)
 *   4. borrow   — danh mục TGDĐ không bán: mượn danh mục gần nhất (BORROW)
 *
 * Nguồn ảnh: Thế Giới Di Động (https://www.thegioididong.com). Chỉ lưu link CDN.
 *
 * Gán theo mã sản phẩm (id % số ảnh) nên cố định: chạy lại, hay dựng máy mới
 * rồi chạy, đều ra đúng cùng một ảnh cho cùng một sản phẩm.
 */

const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

// Danh mục TGDĐ không bán (11/11/2026) -> danh mục gần nhất có ảnh thật.
const BORROW = {
  'cat-laptop-acc-keyboard-cover': 'cat-laptop-acc-keyboard', // Phủ phím -> Bàn phím
};

// Bộ crawl cũ gán nhầm danh mục cho vài trang TGDĐ: cat-cam-indoor (Camera trong
// nhà) chứa toàn chân tripod/gậy selfie (/gay-tu-suong) và camera hành trình
// (/camera-hanh-trinh-hanh-dong) — không mẫu nào là camera trong nhà. Không lấy
// ảnh của chúng cho danh mục đó; ảnh đúng loại lấy ở tầng crawl.
const EXCLUDE_SLUGS = {
  'cat-cam-indoor': ['gay-tu-suong', 'camera-hanh-trinh-hanh-dong'],
};
const slugOf = (url) => (url || '').split('/')[3] || '';

const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const uniqSorted = (arr) => [...new Set(arr)].sort();

function loadPools() {
  const products = require(path.join(DATA, 'tgdd-products.json'));
  const byCatBrand = new Map();
  const byCat = new Map();
  for (const p of products) {
    if (!isUrl(p.image)) continue;
    if ((EXCLUDE_SLUGS[p.category_id] || []).includes(slugOf(p.productUrl))) continue;
    const kb = `${p.category_id}|${p.brand_id}`;
    if (!byCatBrand.has(kb)) byCatBrand.set(kb, []);
    byCatBrand.get(kb).push(p.image);
    if (!byCat.has(p.category_id)) byCat.set(p.category_id, []);
    byCat.get(p.category_id).push(p.image);
  }
  for (const m of [byCatBrand, byCat]) for (const [k, v] of m) m.set(k, uniqSorted(v));

  const crawled = new Map();
  try {
    const extra = require(path.join(DATA, 'extra-category-images.json'));
    for (const [cat, entry] of Object.entries(extra.categories || {})) {
      const urls = uniqSorted((entry.items || []).map((i) => i.image).filter(isUrl));
      if (urls.length) crawled.set(cat, urls);
    }
  } catch {
    // Chưa chạy crawl-category-images.js: bỏ qua tầng 3.
  }
  return { byCatBrand, byCat, crawled };
}

/** Bộ ảnh cho một cặp (danh mục, hãng) + tầng đã dùng; null nếu không có. */
function poolFor(pools, categoryId, brandId) {
  const exact = pools.byCatBrand.get(`${categoryId}|${brandId}`);
  if (exact) return { tier: 'brand', urls: exact };
  const cat = pools.byCat.get(categoryId);
  if (cat) return { tier: 'category', urls: cat };
  const crawl = pools.crawled.get(categoryId);
  if (crawl) return { tier: 'crawl', urls: crawl };
  const near = BORROW[categoryId];
  if (near) {
    const urls = pools.byCat.get(near) || pools.crawled.get(near);
    if (urls) return { tier: 'borrow', urls };
  }
  return null;
}

/** Ảnh chính + danh sách ảnh cho sản phẩm có mã `id` (cùng công thức với SQL). */
function pickImages(urls, id) {
  const n = urls.length;
  const i = Number(BigInt(id) % BigInt(n));
  const image = urls[i];
  const images = n > 1 ? [image, urls[(i + 1) % n]] : [image];
  return { image, images };
}

module.exports = { loadPools, poolFor, pickImages, BORROW, EXCLUDE_SLUGS };
