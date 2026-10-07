'use strict';
/**
 * Onboarding — thu sở thích tường minh của khách mới.
 *
 * VÌ SAO CẦN: khách vừa đăng ký chưa có lịch sử mua LẪN lịch sử duyệt. Collaborative
 * filtering không có gì để tính, vector sở thích bên BehaviorService cũng rỗng, nên
 * mọi nguồn gợi ý đều rơi về hàng bán chạy (cold-start phía khách).
 *
 * Hỏi thẳng ở lần đầu vào thì có tín hiệu ngay. Và nó mang thứ dữ liệu mua hàng không
 * bao giờ có: tín hiệu PHỦ ĐỊNH ("không quan tâm") — CF không phân biệt được "chưa biết
 * tới món này" với "không thích món này".
 *
 * Endpoints (đều gắn ở /api/b2c):
 *   GET  /onboarding/options    — danh mục, hãng theo danh mục, tầm giá (công khai)
 *   GET  /me/preferences        — sở thích hiện tại; null = chưa từng thấy onboarding
 *   PUT  /me/preferences        — lưu (status = completed)
 *   POST /me/preferences/skip   — bỏ qua (status = skipped)
 *
 * customer_id LUÔN lấy từ token (authB2C), không bao giờ từ body — cùng bài học với
 * /orders/me: tham số client gửi lên thì client sửa được, token thì không.
 */
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { cached } = require('../redis');
const { authB2C } = require('../middleware/authB2C');

// Tầm giá cố định, đơn vị đồng. Khoá ngắn gọn để lưu; nhãn chỉ để hiển thị.
// PHẢI khớp var `price_bands` trong local-infra-sandbox/dbt_warehouse/dbt_project.yml:
// dbt gán PriceBand cho sản phẩm theo đó, AI-Rec so với mã khách chọn ở đây.
const PRICE_BANDS = [
  { id: 'lt5',    label: 'Dưới 5 triệu',     min: 0,          max: 5_000_000 },
  { id: '5to15',  label: '5 – 15 triệu',     min: 5_000_000,  max: 15_000_000 },
  { id: '15to30', label: '15 – 30 triệu',    min: 15_000_000, max: 30_000_000 },
  { id: 'gt30',   label: 'Trên 30 triệu',    min: 30_000_000, max: null },
];
const PRICE_BAND_IDS = new Set(PRICE_BANDS.map(b => b.id));

// Trần số phần tử mỗi mảng: nâng lên 100 để người dùng thoải mái chọn
// cả danh mục cha và các danh mục con chuyên biệt.
const MAX_ITEMS = 100;

// ─────────────────────────────────────────────────────────────────────────────
// GET /onboarding/options
// ─────────────────────────────────────────────────────────────────────────────
router.get('/onboarding/options', async (req, res) => {
  try {
    // Cache 24h. Đổi key v4 để làm mới ngay cấu trúc phân cấp và toàn bộ 91 hãng.
    const data = await cached('onboarding:options:v4', 86400, async () => {
      // Lấy toàn bộ 49 danh mục trong database (cả 8 nhóm cha và 41 nhóm con)
      const allCategories = await prisma.category.findMany({
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, parent_id: true, icon: true },
      });

      // Tạo cấu trúc cây 2 tầng: 8 nhóm cha, mỗi cha chứa danh sách children gồm các danh mục con
      const categories = allCategories
        .filter(c => !c.parent_id)
        .map(parent => ({
          id: parent.id,
          name: parent.name,
          icon: parent.icon,
          children: allCategories
            .filter(child => child.parent_id === parent.id)
            .map(child => ({ id: child.id, name: child.name, icon: child.icon })),
        }));

      // Hãng thuộc danh mục CHA nào: sản phẩm gắn vào danh mục con hoặc cha,
      // gom theo parent_id để người dùng chọn hãng theo nhóm ngành đã chọn.
      const rows = await prisma.$queryRaw`
        SELECT COALESCE(c.parent_id, c.id) AS parent_id,
               b.id   AS brand_id,
               b.name AS brand_name,
               COUNT(*)::int AS products,
               COALESCE(SUM(p.sold), 0)::int AS sold
        FROM "Product" p
        JOIN "Category" c ON c.id = p.category_id
        JOIN "Brand"    b ON b.id = p.brand_id
        WHERE p.is_deleted = false AND b.is_deleted = false
        GROUP BY 1, 2, 3
      `;

      const brandsByCategory = {};
      for (const r of rows) {
        (brandsByCategory[r.parent_id] ||= []).push({
          id: r.brand_id, name: r.brand_name, products: r.products, sold: r.sold,
        });
      }

      // Sắp xếp hãng bán chạy lên trước, không cắt bỏ để người dùng có thể xem tất cả
      for (const k of Object.keys(brandsByCategory)) {
        brandsByCategory[k].sort((a, b) => b.sold - a.sold || b.products - a.products || a.name.localeCompare(b.name));
      }

      // Toàn bộ 91 thương hiệu trong cơ sở dữ liệu phục vụ tìm kiếm toàn cục
      const allBrands = await prisma.$queryRaw`
        SELECT b.id, b.name,
               COUNT(*)::int AS products,
               COALESCE(SUM(p.sold), 0)::int AS sold
        FROM "Product" p
        JOIN "Brand" b ON b.id = p.brand_id
        WHERE p.is_deleted = false AND b.is_deleted = false
        GROUP BY b.id, b.name
        ORDER BY sold DESC, products DESC, b.name ASC
      `;

      return {
        categories,
        allCategories,
        brandsByCategory,
        allBrands,
        priceBands: PRICE_BANDS.map(({ id, label }) => ({ id, label })),
      };
    });
    res.json(data);
  } catch (err) {
    console.error('[onboarding/options]', err);
    res.status(500).json({ error: 'Không tải được danh sách lựa chọn' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /me/preferences
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me/preferences', authB2C, async (req, res) => {
  try {
    const pref = await prisma.customerPreference.findUnique({
      where: { customer_id: BigInt(req.b2cUser.id) },
    });
    // null (không phải 404) để client phân biệt rõ "chưa từng thấy onboarding"
    // với lỗi thật. 404 còn dễ bị lẫn với sai đường dẫn.
    res.json(pref ? serialize(pref) : null);
  } catch (err) {
    console.error('[me/preferences GET]', err);
    res.status(500).json({ error: 'Không tải được sở thích' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /me/preferences
// ─────────────────────────────────────────────────────────────────────────────
router.put('/me/preferences', authB2C, async (req, res) => {
  try {
    const body = req.body || {};
    const liked_categories    = strArray(body.liked_categories);
    const liked_brands        = strArray(body.liked_brands);
    const disliked_categories = strArray(body.disliked_categories);
    const disliked_brands     = strArray(body.disliked_brands);
    const price_band = body.price_band == null || body.price_band === '' ? null : String(body.price_band);

    for (const [name, arr] of Object.entries({ liked_categories, liked_brands, disliked_categories, disliked_brands })) {
      if (arr === null) return res.status(400).json({ error: `${name} phải là mảng chuỗi` });
      if (arr.length > MAX_ITEMS) return res.status(400).json({ error: `${name} tối đa ${MAX_ITEMS} mục` });
    }
    if (price_band !== null && !PRICE_BAND_IDS.has(price_band)) {
      return res.status(400).json({ error: 'Tầm giá không hợp lệ' });
    }

    // Vừa thích vừa không thích cùng một thứ là dữ liệu mâu thuẫn — model không biết
    // tin chiều nào. Từ chối thẳng thay vì lặng lẽ chọn một phía.
    const clashC = liked_categories.filter(x => disliked_categories.includes(x));
    const clashB = liked_brands.filter(x => disliked_brands.includes(x));
    if (clashC.length || clashB.length) {
      return res.status(400).json({ error: 'Một mục không thể vừa quan tâm vừa không quan tâm' });
    }

    // Kiểm mã có thật. Bỏ bước này thì bất kỳ chuỗi nào cũng vào DB, và AI-Rec sẽ
    // dựng profile trên những danh mục không tồn tại.
    const [cats, brands] = await Promise.all([
      prisma.category.findMany({ where: { id: { in: [...liked_categories, ...disliked_categories] } }, select: { id: true } }),
      prisma.brand.findMany({ where: { id: { in: [...liked_brands, ...disliked_brands] }, is_deleted: false }, select: { id: true } }),
    ]);
    const okCat = new Set(cats.map(c => c.id));
    const okBrand = new Set(brands.map(b => b.id));
    const badCat = [...liked_categories, ...disliked_categories].filter(x => !okCat.has(x));
    const badBrand = [...liked_brands, ...disliked_brands].filter(x => !okBrand.has(x));
    if (badCat.length || badBrand.length) {
      return res.status(400).json({ error: 'Có danh mục hoặc hãng không tồn tại', invalid: [...badCat, ...badBrand] });
    }

    const data = {
      status: 'completed',
      liked_categories, liked_brands, disliked_categories, disliked_brands, price_band,
    };
    const pref = await prisma.customerPreference.upsert({
      where: { customer_id: BigInt(req.b2cUser.id) },
      update: data,
      create: { customer_id: BigInt(req.b2cUser.id), ...data },
    });
    res.json(serialize(pref));
  } catch (err) {
    console.error('[me/preferences PUT]', err);
    res.status(500).json({ error: 'Không lưu được sở thích' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /me/preferences/skip
// ─────────────────────────────────────────────────────────────────────────────
router.post('/me/preferences/skip', authB2C, async (req, res) => {
  try {
    const id = BigInt(req.b2cUser.id);
    const existing = await prisma.customerPreference.findUnique({ where: { customer_id: id } });
    // Đã điền rồi thì "bỏ qua" không được xoá mất dữ liệu đã khai — chỉ ghi skipped
    // khi chưa có gì. Nếu không, bấm nhầm nút là mất sạch sở thích.
    const pref = existing
      ? existing
      : await prisma.customerPreference.create({ data: { customer_id: id, status: 'skipped' } });
    res.json(serialize(pref));
  } catch (err) {
    console.error('[me/preferences/skip]', err);
    res.status(500).json({ error: 'Không ghi nhận được' });
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────
function strArray(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) return null;
  // Bỏ trùng và rỗng: client gửi ["a","a",""] thì lưu ["a"].
  return [...new Set(v.map(x => String(x).trim()).filter(Boolean))];
}

function serialize(p) {
  return { ...p, customer_id: Number(p.customer_id) };
}

module.exports = router;
