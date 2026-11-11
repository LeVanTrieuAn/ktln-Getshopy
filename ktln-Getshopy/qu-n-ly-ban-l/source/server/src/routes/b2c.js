const express = require('express');
const { prisma } = require('../db');
const { cached } = require('../redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, lowercase, chuẩn hóa khoảng trắng.
 * Dùng để tạo param cho unaccent() hoặc fallback ILIKE khi extension chưa enabled.
 * Ví dụ: "Điện Thoại" → "dien thoai", "Đồng hồ" → "dong ho"
 * Nguồn: Unicode NFD normalization (ECMA-262, String.prototype.normalize)
 * @param {string} str
 * @returns {string}
 */
function stripVi(str) {
  return (str || '')
    .normalize('NFD')               // tách tổ hợp dấu ra thành ký tự riêng
    .replace(/[\u0300-\u036f]/g, '') // xóa combining diacritical marks
    .replace(/đ/gi, 'd')            // đ/Đ không thuộc NFD diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bảng alias tìm kiếm: từ khóa tiếng Việt không dấu/có dấu → category_id.
 * Cho phép người dùng gõ "dien thoai", "dong ho", "sac, cap", "may tinh bang"...
 * mà hệ thống vẫn tự nhận diện đúng category tương ứng.
 */
const CATEGORY_SEARCH_ALIASES = [
  // Cụ thể trước, chung chung sau
  { keywords: ['dien thoai', 'smartphone', 'dtdd', 'phone'], catId: 'cat-phone' },
  { keywords: ['laptop', 'macbook', 'may tinh xach tay'], catId: 'cat-laptop' },
  { keywords: ['may tinh bang', 'tablet', 'ipad', 'mtb'], catId: 'cat-tablet' },
  { keywords: ['dong ho thong minh', 'smartwatch', 'dong ho', 'apple watch', 'watch'], catId: 'cat-watch' },
  { keywords: ['sac du phong', 'pin du phong', 'powerbank', 'power bank'], catId: 'cat-mobile-acc-powerbank' },
  { keywords: ['sac, cap', 'sac cap', 'sac va cap', 'cap sac', 'cu sac', 'adapter', 'day cap'], catId: 'cat-mobile-acc-charger' },
  { keywords: ['op lung dien thoai', 'op lung phone', 'op lung', 'bao da'], catId: 'cat-mobile-acc-case-phone' },
  { keywords: ['op lung may tinh bang', 'op lung tablet'], catId: 'cat-mobile-acc-case-tablet' },
  { keywords: ['mieng dan camera', 'dan camera'], catId: 'cat-mobile-acc-cam-cover' },
  { keywords: ['mieng dan man hinh', 'kinh cuong luc', 'cuong luc', 'mieng dan'], catId: 'cat-mobile-acc-screen' },
  { keywords: ['tui dung airpods', 'case airpods'], catId: 'cat-mobile-acc-airpods-case' },
  { keywords: ['quat mini', 'quat cam tay'], catId: 'cat-mobile-acc-fan' },
  { keywords: ['but cam ung', 'but tablet', 'stylus'], catId: 'cat-mobile-acc-pen' },
  { keywords: ['gia do dien thoai', 'gia do laptop', 'gia do', 'stand'], catId: 'cat-mobile-acc-stand' },
  { keywords: ['day deo dien thoai', 'day deo'], catId: 'cat-mobile-acc-strap' },
  { keywords: ['hub, cap chuyen doi', 'hub usb-c', 'hub', 'cap chuyen doi'], catId: 'cat-laptop-acc-hub' },
  { keywords: ['chuot may tinh', 'chuot khong day', 'chuot', 'mouse'], catId: 'cat-laptop-acc-mouse' },
  { keywords: ['ban phim co', 'ban phim', 'keyboard'], catId: 'cat-laptop-acc-keyboard' },
  { keywords: ['router wifi', 'router & thiet bi mang', 'router', 'thiet bi mang', 'wifi'], catId: 'cat-laptop-acc-router' },
  { keywords: ['balo, tui chong soc', 'balo chong soc', 'tui chong soc', 'balo laptop', 'balo'], catId: 'cat-laptop-acc-bag' },
  { keywords: ['tui dung phu kien', 'tui phu kien'], catId: 'cat-laptop-acc-pouch' },
  { keywords: ['phu phim laptop', 'lot ban phim'], catId: 'cat-laptop-acc-keyboard-cover' },
  { keywords: ['phan mem', 'software'], catId: 'cat-laptop-acc-software' },
  { keywords: ['gia treo man hinh', 'arm man hinh'], catId: 'cat-laptop-acc-monitor-stand' },
  { keywords: ['mieng lot chuot', 'lot chuot', 'mousepad', 'pad chuot'], catId: 'cat-laptop-acc-mousepad' },
  { keywords: ['bang ve dien tu', 'bang ve', 'drawing tablet'], catId: 'cat-laptop-acc-drawing' },
  { keywords: ['tai nghe bluetooth', 'tai nghe bt', 'tai nghe tws', 'tai nghe khong day', 'airpods'], catId: 'cat-av-bt-earphone' },
  { keywords: ['tai nghe day', 'tai nghe co day'], catId: 'cat-av-wire-earphone' },
  { keywords: ['tai nghe chup tai', 'headphone', 'headset'], catId: 'cat-av-headphone' },
  { keywords: ['tai nghe the thao'], catId: 'cat-av-sport-earphone' },
  // "tai nghe" chung chung: cả 4 loại, không chỉ Bluetooth ("tai nghe sony" trước
  // đây bỏ sót tai nghe dây / chụp tai / thể thao).
  { keywords: ['tai nghe'], catId: ['cat-av-bt-earphone', 'cat-av-wire-earphone', 'cat-av-headphone', 'cat-av-sport-earphone'] },
  { keywords: ['loa bluetooth', 'loa khong day', 'loa', 'soundbar', 'speaker'], catId: 'cat-av-speaker' },
  { keywords: ['micro thu am', 'micro', 'mic thu am', 'mic'], catId: 'cat-av-mic' },
  { keywords: ['may chieu mini', 'may chieu', 'projector'], catId: 'cat-av-projector' },
  { keywords: ['kinh thong minh', 'smartglass'], catId: 'cat-av-smartglass' },
  { keywords: ['o cung di dong', 'o cung', 'ssd', 'hdd'], catId: 'cat-av-hdd' },
  { keywords: ['the nho', 'microsd', 'sdcard', 'sd card'], catId: 'cat-av-sdcard' },
  { keywords: ['usb', 'o nho usb', 'flash drive'], catId: 'cat-av-usb' },
  { keywords: ['camera giam sat', 'camera ngoai troi', 'camera an ninh'], catId: 'cat-cam-security' },
  { keywords: ['camera trong nha', 'camera ip', 'camera wifi'], catId: 'cat-cam-indoor' },
  { keywords: ['chuong cua camera', 'chuong cua thong minh', 'doorbell', 'chuong cua'], catId: 'cat-cam-doorbell' },
  { keywords: ['camera nang luong mat troi'], catId: 'cat-cam-solar' },
  { keywords: ['camera 4g'], catId: 'cat-cam-4g' },
  { keywords: ['webcam'], catId: 'cat-cam-webcam' },
  { keywords: ['camera'], catId: 'cat-cam-security' },
];

/**
 * Trích xuất danh mục và token từ khóa từ chuỗi tìm kiếm của người dùng.
 * Ví dụ: "dien thoai samsung" -> { categoryId: 'cat-phone', remainingTokens: ['samsung'] }
 *        "dong ho" -> { categoryId: 'cat-watch', remainingTokens: [] }
 *        "sac, cap" -> { categoryId: 'cat-mobile-acc-charger', remainingTokens: [] }
 *        "iphone 16" -> { categoryId: null, remainingTokens: ['iphone', '16'] }
 */
function extractCategoryAndTokens(rawSearch) {
  if (!rawSearch) return { categoryId: null, remainingTokens: [] };
  const normalized = stripVi(rawSearch).replace(/[,+]/g, ' ');
  let matchedCatId = null;
  let matchedKeyword = '';

  // Từ khoá KHỚP DÀI NHẤT thắng (cụ thể nhất), không phải từ khoá đứng trước trong
  // danh sách. Lấy cái khớp đầu tiên thì (đo 11/11/2026): "gia do laptop" -> Laptop
  // + tên chứa "gia","do" -> 0 kết quả (danh mục Giá đỡ có 7.500 sp); "camera wifi"
  // -> Router; "op lung dien thoai" -> Điện thoại; "microsd" -> Micro.
  for (const item of CATEGORY_SEARCH_ALIASES) {
    for (const kw of item.keywords) {
      const kwNorm = stripVi(kw).replace(/[,+]/g, ' ');
      if (kwNorm.length <= matchedKeyword.length) continue;
      const regex = new RegExp(`(^|\\s)${kwNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (regex.test(normalized)) {
        matchedCatId = item.catId;
        matchedKeyword = kwNorm;
      }
    }
  }

  if (!matchedCatId) {
    return {
      categoryId: null,
      remainingTokens: rawSearch.trim().split(/\s+/).filter(Boolean)
    };
  }

  // Loại bỏ từ khóa category đã nhận diện để lấy phần token còn lại
  const remainingStr = normalized.replace(new RegExp(matchedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ').trim();
  const remainingTokens = remainingStr.split(/\s+/).filter(Boolean);

  return {
    categoryId: matchedCatId,
    remainingTokens
  };
}

// KHÔNG có giá trị mặc định: secret hardcode trong source nghĩa là bất kỳ ai
// đọc được repo cũng ký được token giả cho mọi tài khoản.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Thiếu JWT_SECRET. Sinh bằng: openssl rand -base64 48');
}
const { authB2C } = require('../middleware/authB2C');
const { normalizePhoneVN, isValidPhoneVN, isValidEmail, isValidFullName } = require('../utils/validators');
const { OAuth2Client } = require('google-auth-library');

// Client ID phải khớp với VITE_GOOGLE_CLIENT_ID mà trình duyệt dùng. Thiếu
// biến này thì đăng nhập Google bị từ chối thẳng, KHÔNG rơi về chế độ tin
// tưởng dữ liệu client gửi lên.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Get Categories — barely change, so cache for a few minutes instead of hitting DB every load
router.get('/categories', async (req, res) => {
  try {
    const categories = await cached('categories:all', 300, () => prisma.category.findMany());
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get only root categories that have at least 1 product (for Home page tabs)
router.get('/categories/active', async (req, res) => {
  try {
    const { branch_id } = req.query;

    const cacheKey = `categories:active:${branch_id || 'all'}`;
    const result = await cached(cacheKey, 120, async () => {
      // 1. Lấy tất cả category
      const allCategories = await prisma.category.findMany();

      // 2. Đếm số sản phẩm theo category_id
      let productGroups;
      if (branch_id) {
        const branchJson = JSON.stringify([branch_id]);
        const rows = await prisma.$queryRawUnsafe(
          `SELECT category_id, COUNT(*)::int AS count
           FROM "Product"
           WHERE is_deleted = false
             AND (branch_ids::jsonb = '[]'::jsonb OR branch_ids::jsonb @> $1::jsonb)
           GROUP BY category_id`,
          branchJson
        );
        productGroups = rows;
      } else {
        productGroups = await prisma.product.groupBy({
          by: ['category_id'],
          where: { is_deleted: false },
          _count: { id: true },
        });
      }

      // category_id có sản phẩm
      const catIdsWithProducts = new Set(
        productGroups.map(g => g.category_id)
      );

      // 3. Xây map id -> category để tra nhanh parent
      const catMap = {};
      allCategories.forEach(c => { catMap[c.id] = c; });

      // 4. Hàm leo lên tìm root category (parent_id null)
      const getRootId = (catId) => {
        let cur = catMap[catId];
        while (cur && cur.parent_id) {
          cur = catMap[cur.parent_id];
        }
        return cur ? cur.id : catId;
      };

      // 5. Tập root category có sản phẩm
      const rootIdsWithProducts = new Set(
        [...catIdsWithProducts].map(getRootId)
      );

      // 6. Trả về chỉ root categories (parent_id null) có sản phẩm, kèm product_count
      const activeRoots = allCategories
        .filter(c => !c.parent_id && rootIdsWithProducts.has(c.id))
        .map(c => ({
          ...c,
          product_count: productGroups
            .filter(g => getRootId(g.category_id) === c.id)
            .reduce((sum, g) => sum + (g._count?.id ?? g.count ?? 0), 0),
        }))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      return activeRoots;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// P-01: In-memory TTL cache cho flash sale — tránh 2 DB queries mỗi request
const FLASH_SALE_TTL_MS = 60_000; // 60 giây
let _fsCache = null;
let _fsCacheTime = 0;
let _fsCachePromise = null; // Thundering herd prevention

const getActiveFlashSaleItems = async () => {
  // Cache hit
  if (_fsCache && Date.now() - _fsCacheTime < FLASH_SALE_TTL_MS) return _fsCache;
  // Thundering herd: nếu đang fetch thì dùng chung promise
  if (_fsCachePromise) return _fsCachePromise;
  _fsCachePromise = (async () => {
    try {
      const activeSale = await prisma.flashSale.findFirst({
        where: { is_deleted: false, end_time: { gt: new Date() } }
      });
      const items = activeSale
        ? await prisma.flashSaleItem.findMany({ where: { flash_sale_id: activeSale.id } })
        : [];
      _fsCache = items;
      _fsCacheTime = Date.now();
      return _fsCache;
    } finally {
      _fsCachePromise = null;
    }
  })();
  return _fsCachePromise;
};

const applyFlashSaleToProduct = (product, fsItems) => {
  const fsItem = fsItems.find(i => Number(i.product_id) === Number(product.id));
  if (fsItem) {
    product.original_price = product.price;
    product.price = fsItem.discount_price;
  }
  return product;
};

// Get Brands — same rationale as categories
router.get('/brands', async (req, res) => {
  try {
    const brands = await cached('brands:active', 300, async () => {
      const list = await prisma.brand.findMany({ where: { is_deleted: false }, orderBy: { name: 'asc' } });
      // "Khác" luôn xuất hiện cuối cùng
      const others = list.filter(b => b.name === 'Khác' || b.id === 'brand-other');
      const rest   = list.filter(b => b.name !== 'Khác' && b.id !== 'brand-other');
      return [...rest, ...others];
    });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Branches — danh sách chi nhánh cho bộ chọn cửa hàng (StoreLayout).
// Trước đây cửa hàng gọi GET /api/b2b/branches của trang quản trị, route đó trả
// MỌI cột của bảng và không cần đăng nhập. /api/b2b giờ bắt quyền admin, nên cửa
// hàng có route riêng, chỉ trả các cột khách cần thấy.
router.get('/branches', async (req, res) => {
  try {
    const branches = await cached('branches:active', 300, () =>
      prisma.branch.findMany({
        where: { is_deleted: false },
        select: { id: true, name: true, address: true },
        orderBy: { name: 'asc' },
      })
    );
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Lấy tất cả category IDs (bao gồm chính nó + toàn bộ con cháu)
 * Dùng để filter sản phẩm khi chọn category cha.
 */
async function getCategoryDescendants(rootId) {
  const allCats = await cached('categories:all', 300, () => prisma.category.findMany());
  const result = new Set();
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift();
    result.add(cur);
    allCats
      .filter(c => c.parent_id === cur)
      .forEach(c => queue.push(c.id));
  }
  return [...result];
}

// Extension unaccent do migration 20261111150000_add_unaccent_extension cài — app
// KHÔNG tự CREATE lúc chạy (thay đổi cấu trúc DB phải nằm trong lịch sử migration,
// và tài khoản của app không nên cần quyền đó). Ở đây chỉ ĐỌC xem đã có chưa:
// chưa có thì tìm bằng ILIKE thường và BÁO trong log thay vì im lặng. Kiểm tra lại
// tối đa mỗi 60 s, nên DB lên muộn hơn server cũng tự bắt kịp.
let hasUnaccent = false;
let unaccentCheckedAt = 0;
async function refreshUnaccentFlag() {
  if (hasUnaccent || Date.now() - unaccentCheckedAt < 60000) return;
  unaccentCheckedAt = Date.now();
  try {
    const ext = await prisma.$queryRawUnsafe("SELECT 1 FROM pg_extension WHERE extname = 'unaccent'");
    hasUnaccent = ext.length > 0;
    if (!hasUnaccent) {
      console.warn('[search] Thiếu extension unaccent (migration add_unaccent_extension chưa chạy?) — tìm không dấu theo tên sẽ kém đi.');
    }
  } catch (e) {
    console.warn('[search] Không kiểm tra được extension unaccent:', e.message);
  }
}

/**
 * Thêm các điều kiện tìm kiếm thông minh vào SQL:
 * - Tự động nhận diện danh mục từ từ khóa không dấu/có dấu (ví dụ: "dien thoai", "dong ho", "sac, cap", "may tinh bang")
 * - Nếu không chọn category cụ thể và từ khóa khớp category -> lọc theo category đó + tìm tên
 * - Hỗ trợ unaccent(name) ILIKE unaccent(...) nếu extension đã kích hoạt, hoặc fallback ILIKE song song
 */
async function appendSearchConditions(conditions, params, rawSearch, category_id) {
  if (!rawSearch || !rawSearch.trim()) return;

  await refreshUnaccentFlag();
  let rankSQL = null;
  const trimmed = rawSearch.trim();
  const extracted = extractCategoryAndTokens(trimmed);
  const isSpecificCatSelected = category_id && category_id !== 'ALL';

  const addNameCond = (token) => {
    const stripped = stripVi(token);
    params.push(`%${token}%`, `%${stripped}%`);
    if (hasUnaccent) {
      return `(name ILIKE $${params.length - 1} OR unaccent(name) ILIKE unaccent($${params.length}))`;
    }
    return `(name ILIKE $${params.length - 1} OR name ILIKE $${params.length})`;
  };

  if (!isSpecificCatSelected && extracted.categoryId) {
    // categoryId có thể là mảng (vd. "tai nghe" -> 4 loại tai nghe): gộp hậu duệ.
    const roots = [].concat(extracted.categoryId);
    const catIds = [...new Set((await Promise.all(roots.map(getCategoryDescendants))).flat())];
    if (extracted.remainingTokens.length === 0) {
      // Chỉ gõ tên danh mục (ví dụ "dien thoai", "dong ho", "sac, cap", "may tinh bang")
      // -> Lấy tất cả sản phẩm thuộc danh mục đó HOẶC có tên chứa từ khóa
      params.push(catIds, `%${trimmed}%`, `%${stripVi(trimmed)}%`);
      // Xếp hạng: sản phẩm ĐÚNG danh mục lên trước, sản phẩm chỉ trùng chữ trong tên
      // xếp sau. Không có thì "dien thoai" ra trang đầu toàn "Giá đỡ điện thoại" (mã
      // mới nhất) — thấy trên giao diện 11/11/2026.
      rankSQL = `(category_id = ANY($${params.length - 2})) DESC`;
      if (hasUnaccent) {
        conditions.push(
          `(category_id = ANY($${params.length - 2}) OR name ILIKE $${params.length - 1} OR unaccent(name) ILIKE unaccent($${params.length}))`
        );
      } else {
        conditions.push(
          `(category_id = ANY($${params.length - 2}) OR name ILIKE $${params.length - 1} OR name ILIKE $${params.length})`
        );
      }
    } else {
      // Gõ danh mục kèm từ khóa (ví dụ "dien thoai samsung", "laptop asus")
      params.push(catIds);
      conditions.push(`category_id = ANY($${params.length})`);
      extracted.remainingTokens.forEach(t => {
        conditions.push(addNameCond(t));
      });
    }
  } else {
    // Không nhận diện danh mục hoặc người dùng đã chủ động chọn category_id
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    tokens.forEach(t => {
      conditions.push(addNameCond(t));
    });
  }
  return rankSQL;
}

/** ORDER BY: tiêu chí xếp hạng của tìm kiếm (nếu có) chỉ áp khi sắp mặc định / mới nhất. */
function buildOrderSQL(orderMap, sort, rankSQL) {
  const base = orderMap[sort] ?? 'id DESC';
  return rankSQL && (!sort || sort === 'newest') ? `${rankSQL}, ${base}` : base;
}

// Get Products (with Filter/Sort)
router.get('/products', async (req, res) => {
  try {
    const { category_id, brand_ids, search, sort, branch_id, page = 1, limit = 12, min_price, max_price } = req.query;
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 12;
    const skip = (pageNumber - 1) * limitNumber;
    const parsedMinPrice = min_price ? parseFloat(min_price) : null;
    const parsedMaxPrice = max_price ? parseFloat(max_price) : null;

    // Parse multi-brand: brand_ids=br-apple,br-samsung  OR  brand_ids=br-apple
    const brandIdList = brand_ids && brand_ids !== 'ALL'
      ? brand_ids.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    let where = { is_deleted: false };

    // Expand category filter to include all sub-categories
    if (category_id && category_id !== 'ALL') {
      const catIds = await getCategoryDescendants(category_id);
      where.category_id = catIds.length === 1 ? catIds[0] : { in: catIds };
    }

    if (brandIdList.length === 1) where.brand_id = brandIdList[0];
    else if (brandIdList.length > 1) where.brand_id = { in: brandIdList };

    // Price range filter
    if (parsedMinPrice !== null || parsedMaxPrice !== null) {
      where.price = {};
      if (parsedMinPrice !== null) where.price.gte = parsedMinPrice;
      if (parsedMaxPrice !== null) where.price.lte = parsedMaxPrice;
    }
    
    const hasSearch = Boolean(search && search.trim());
    let orderBy = { id: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    if (sort === 'price_desc') orderBy = { price: 'desc' };
    if (sort === 'newest') orderBy = { id: 'desc' };
    if (sort === 'best_selling' || sort === 'bestseller' || sort === 'sold_desc') orderBy = { sold: 'desc' };

    // Only the fields the shop list card / branch filter actually need —
    // skips description/variants which are only used on the detail page.
    const listSelect = {
      id: true, name: true, price: true, original_price: true, image: true,
      stock: true, rating: true, sold: true, category_id: true, brand_id: true,
      branch_ids: true, is_banner: true, created_at: true
    };

    let products, total;

    if (branch_id) {
      // ── DB-level jsonb containment filter ──────────────────────────────────
      // branch_ids is a proper jsonb array. Two cases:
      //   branch_ids @> '["HCM001"]' → product is assigned to this branch
      //   branch_ids = '[]'          → product is available at ALL branches
      const branchJson = JSON.stringify([branch_id]);

      const conditions = [`is_deleted = false`];
      const params = [];

      params.push(branchJson);
      conditions.push(`(branch_ids::jsonb = '[]'::jsonb OR branch_ids::jsonb @> $${params.length}::jsonb)`);

      // Expand category filter to include all sub-categories (raw SQL path)
      if (category_id && category_id !== 'ALL') {
        const catIds = await getCategoryDescendants(category_id);
        if (catIds.length === 1) {
          params.push(catIds[0]);
          conditions.push(`category_id = $${params.length}`);
        } else {
          // PostgreSQL ANY array parameter
          params.push(catIds);
          conditions.push(`category_id = ANY($${params.length})`);
        }
      }
      if (brandIdList.length === 1) {
        params.push(brandIdList[0]);
        conditions.push(`brand_id = $${params.length}`);
      } else if (brandIdList.length > 1) {
        params.push(brandIdList);
        conditions.push(`brand_id = ANY($${params.length})`);
      }
      
      // Tokenized search với unaccent() và tự động nhận diện danh mục
      const searchRank = await appendSearchConditions(conditions, params, search, category_id);

      // Price range for raw SQL
      if (parsedMinPrice !== null) {
        params.push(parsedMinPrice);
        conditions.push(`price >= $${params.length}`);
      }
      if (parsedMaxPrice !== null) {
        params.push(parsedMaxPrice);
        conditions.push(`price <= $${params.length}`);
      }

      const whereSQL = conditions.join(' AND ');

      // P-05: Prisma type-safe orderBy — loại bỏ string interpolation vào raw SQL
      const ORDER_MAP = {
        price_asc:    'price ASC',
        price_desc:   'price DESC',
        best_selling: 'sold DESC',
        bestseller:   'sold DESC',
        sold_desc:    'sold DESC',
        newest:       'id DESC',
      };
      const orderSQL = buildOrderSQL(ORDER_MAP, sort, searchRank);

      const [rows, countRows] = await Promise.all([
        prisma.$queryRawUnsafe(
          `SELECT id, name, price, original_price, image, stock, rating, sold,
                  category_id, brand_id, branch_ids, is_banner, created_at
           FROM "Product"
           WHERE ${whereSQL}
           ORDER BY ${orderSQL}
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          ...params, limitNumber, skip
        ),
        prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS count FROM "Product" WHERE ${whereSQL}`,
          ...params
        ),
      ]);

      total    = Number(countRows[0].count);
      products = rows.map(p => ({ ...p, id: Number(p.id) }));
    } else if (hasSearch) {
      // ── No branch_id + có search → dùng raw SQL để hỗ trợ unaccent() và danh mục ──────
      const conditions2 = [`is_deleted = false`];
      const params2 = [];

      if (category_id && category_id !== 'ALL') {
        const catIds = await getCategoryDescendants(category_id);
        if (catIds.length === 1) {
          params2.push(catIds[0]);
          conditions2.push(`category_id = $${params2.length}`);
        } else {
          params2.push(catIds);
          conditions2.push(`category_id = ANY($${params2.length})`);
        }
      }
      if (brandIdList.length === 1) {
        params2.push(brandIdList[0]);
        conditions2.push(`brand_id = $${params2.length}`);
      } else if (brandIdList.length > 1) {
        params2.push(brandIdList);
        conditions2.push(`brand_id = ANY($${params2.length})`);
      }
      if (parsedMinPrice !== null) { params2.push(parsedMinPrice); conditions2.push(`price >= $${params2.length}`); }
      if (parsedMaxPrice !== null) { params2.push(parsedMaxPrice); conditions2.push(`price <= $${params2.length}`); }

      // unaccent search + auto-resolve category
      const searchRank2 = await appendSearchConditions(conditions2, params2, search, category_id);

      const ORDER_MAP2 = {
        price_asc: 'price ASC', price_desc: 'price DESC',
        best_selling: 'sold DESC', bestseller: 'sold DESC', sold_desc: 'sold DESC', newest: 'id DESC',
      };
      const orderSQL2 = buildOrderSQL(ORDER_MAP2, sort, searchRank2);
      const whereSQL2 = conditions2.join(' AND ');

      const [rows2, countRows2] = await Promise.all([
        prisma.$queryRawUnsafe(
          `SELECT id, name, price, original_price, image, stock, rating, sold,
                  category_id, brand_id, branch_ids, is_banner, created_at
           FROM "Product"
           WHERE ${whereSQL2}
           ORDER BY ${orderSQL2}
           LIMIT $${params2.length + 1} OFFSET $${params2.length + 2}`,
          ...params2, limitNumber, skip
        ),
        prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS count FROM "Product" WHERE ${whereSQL2}`,
          ...params2
        ),
      ]);
      total    = Number(countRows2[0].count);
      products = rows2.map(p => ({ ...p, id: Number(p.id) }));
    } else {
      // Real DB-level pagination: only the requested page is ever fetched/serialized.
      [products, total] = await Promise.all([
        prisma.product.findMany({ where, orderBy, skip, take: limitNumber, select: listSelect }),
        prisma.product.count({ where })
      ]);
    }

    const fsItems = await getActiveFlashSaleItems();
    products = products.map(p => applyFlashSaleToProduct({ ...p, id: Number(p.id) }, fsItems));

    // totalAll: tổng sản phẩm toàn DB (không filter), cache 5 phút
    // Dùng cho banner "Bán chạy nhất" để luôn hiển thị tổng thật (600,000)
    const totalAll = await cached('products:total_all', 300, () =>
      prisma.product.count({ where: { is_deleted: false } })
    );

    res.json({
      data: products,
      total,
      totalAll,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Product Detail
router.get('/products/:id', async (req, res) => {
  try {
    let product = await prisma.product.findFirst({ where: { id: BigInt(req.params.id), is_deleted: false } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    // Attach reviews
    const reviews = await prisma.review.findMany({ where: { product_id: BigInt(product.id) } });
    
    // Ensure JSON fields are parsed if they are stored as strings
    let variants = product.variants;
    let images = product.images;
    if (typeof variants === 'string') try { variants = JSON.parse(variants); } catch (e) { variants = []; }
    if (typeof images === 'string') try { images = JSON.parse(images); } catch (e) { images = []; }
    
    product = { 
      ...product, 
      id: Number(product.id),
      variants: variants,
      images: images,
      reviews: reviews.map(r => ({ ...r, product_id: Number(r.product_id) })) 
    };

    const fsItems = await getActiveFlashSaleItems();
    product = applyFlashSaleToProduct(product, fsItems);

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Flash Sales
router.get('/flash-sales', async (req, res) => {
  try {
    const activeSale = await prisma.flashSale.findFirst({
      where: { 
        is_deleted: false,
        end_time: { gt: new Date() } 
      }
    });
    
    if (!activeSale) return res.json(null);

    const items = await prisma.flashSaleItem.findMany({ where: { flash_sale_id: activeSale.id } });
    if (!items || items.length === 0) return res.json(null);

    const productIds = items.map(i => i.product_id);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    const enrichedItems = items.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) return null;
      return { 
        ...prod, 
        id: Number(prod.id),
        id_item: Number(item.id),
        flash_sale_id: Number(item.flash_sale_id), 
        product_id: Number(item.product_id), 
        discount_price: item.discount_price,
        limit: item.limit,
        sold: item.sold
      };
    }).filter(Boolean);

    if (!enrichedItems.length) return res.json(null);

    res.json({ ...activeSale, id: Number(activeSale.id), items: enrichedItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Checkout moved to index.js to sync with ClickHouse

// Apply Voucher
router.post('/cart/apply-voucher', async (req, res) => {
  try {
    const { code, cart_total } = req.body;
    const voucher = await prisma.voucher.findUnique({ where: { code: code.toUpperCase() } });
    
    if (!voucher || voucher.is_deleted) return res.status(404).json({ error: 'Mã giảm giá không hợp lệ' });
    if (cart_total < voucher.min_order_value) {
      return res.status(400).json({ error: `Đơn hàng tối thiểu ${voucher.min_order_value.toLocaleString()}đ để áp dụng mã này` });
    }

    let discount = 0;
    if (voucher.type === 'percent') {
      discount = (cart_total * voucher.value) / 100;
      if (discount > voucher.max_discount) discount = voucher.max_discount;
    } else {
      discount = voucher.value;
    }

    res.json({ success: true, discount, voucher: { ...voucher, id: Number(voucher.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get My Orders
//
// Sửa ba vấn đề của bản cũ:
//   1. KHÔNG CÓ AUTH — truyền email bất kỳ là xem được đơn người khác, và gọi
//      không kèm email thì trả về TOÀN BỘ đơn hàng của mọi khách.
//   2. Không include items — schema đã tách OrderItem ra bảng riêng, trang
//      "Đơn hàng của tôi" đọc order.items sẽ nhận undefined.
//   3. Lọc theo customer->>email trong JSON thay vì customer_id đã có sẵn.
router.get('/orders/me', authB2C, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      // customer_id LẤY TỪ TOKEN, không từ query
      where: { customer_id: BigInt(req.b2cUser.id) },
      orderBy: { date: 'desc' },
      take: Math.min(Number(req.query.limit) || 50, 200),
      include: { items: true },
    });

    const productIds = [];
    orders.forEach(o => o.items.forEach(i => productIds.push(i.product_id)));
    
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] } },
      select: { id: true, image: true, images: true, variants: true }
    });
    
    const productMap = {};
    products.forEach(p => {
       productMap[p.id.toString()] = p;
    });

    // Chuẩn hoá cho client: BigInt không serialize được sang JSON, và giữ tên
    // trường `items` để phần hiển thị cũ không phải sửa.
    const data = orders.map(o => ({
      id: o.id,
      date: o.date,
      status: o.status,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      payment_ref: o.payment_ref,
      expires_at: o.expires_at,
      paid_at: o.paid_at,
      subTotal: o.subTotal,
      shippingFee: o.shippingFee,
      discount: o.discount,
      total: o.total,
      customer: o.customer,
      items: o.items.map(i => {
        const product = productMap[i.product_id.toString()];
        let image = product?.image || (product?.images && product.images[0]) || '';
        if (i.variant_id && product?.variants) {
          const variant = (product.variants || []).find(v => String(v.id) === String(i.variant_id));
          if (variant && variant.image) image = variant.image;
        }
        return {
          id: Number(i.id),
          product_id: Number(i.product_id),
          name: i.product_name,
          quantity: i.quantity,
          price: i.unit_price,
          net_amount: i.net_amount,
          variant_id: i.variant_id,
          image: image
        };
      }),
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Review
router.post('/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewer, rating, comment } = req.body;
    
    if (!rating || !comment) return res.status(400).json({ error: 'Rating and comment are required' });

    const newReview = await prisma.review.create({
      data: {
        id: 'REV-' + Date.now(),
        product_id: BigInt(id),
        reviewer: reviewer || 'Khách hàng',
        rating: parseInt(rating),
        comment: comment,
        date: new Date()
      }
    });

    // Tính lại Product.rating = AVG thực từ toàn bộ reviews
    // (Sản phẩm chưa có review nào → rating = 0, không phải null)
    const agg = await prisma.review.aggregate({
      where: { product_id: BigInt(id) },
      _avg: { rating: true },
      _count: { id: true },
    });

    const newRating = agg._avg.rating
      ? Math.round(agg._avg.rating * 10) / 10
      : 0;

    await prisma.product.update({
      where: { id: BigInt(id) },
      data: { rating: newRating },
    });

    res.json({
      success: true,
      review: { ...newReview, product_id: Number(newReview.product_id) },
      product_rating: newRating,
      review_count: agg._count.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- AUTHENTICATION ---

// Hồ sơ + điểm thưởng HIỆN TẠI từ DB. Trang Tài khoản và Thanh toán trước đây đọc
// điểm từ localStorage['b2c_points'] — sửa DevTools là "có" điểm vô hạn và hạng Kim
// cương trên giao diện (server vẫn tự kiểm điểm khi trừ tiền ở pricingService, nên
// không mất tiền, nhưng số hiển thị sai và số được giảm ở trang thanh toán lệch).
router.get('/me', authB2C, async (req, res) => {
  try {
    const c = await prisma.b2CCustomer.findUnique({
      where: { id: BigInt(req.b2cUser.id) },
      select: { id: true, full_name: true, email: true, phone: true, avatar: true, loyalty_points: true, provider: true, created_at: true },
    });
    if (!c) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json({ ...c, id: Number(c.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register
router.post('/auth/register', async (req, res) => {
  try {
    // Trước 11/11/2026 route này không kiểm tra gì: thiếu email thì Prisma lỗi 500,
    // mật khẩu 1 ký tự vẫn nhận, phone lưu nguyên chuỗi (kể cả "0163789557vhvbj").
    // Xem utils/validators.js. Email chỉ trim, KHÔNG đổi chữ thường — login so khớp
    // nguyên văn, đổi ở đây sẽ làm tài khoản cũ có chữ hoa không đăng nhập được.
    const full_name = String(req.body.full_name || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const rawPhone = req.body.phone;

    if (!isValidFullName(full_name)) return res.status(400).json({ error: 'Họ tên phải từ 2 đến 100 ký tự và có chữ cái' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
    if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Mật khẩu phải từ 6 đến 128 ký tự' });
    const phone = rawPhone ? normalizePhoneVN(rawPhone) : '';
    if (phone && !isValidPhoneVN(phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ (ví dụ: 0912345678)' });

    const exists = await prisma.b2CCustomer.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email đã được sử dụng' });

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await prisma.b2CCustomer.create({
      data: {
        full_name,
        email,
        phone,
        password_hash,
        loyalty_points: 0,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + email,
        provider: 'local'
      }
    });

    const token = jwt.sign({ id: Number(newUser.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = newUser;
    
    res.json({ token, user: { ...userWithoutPass, has_password: true, id: Number(userWithoutPass.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.b2CCustomer.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    
    if (!user.password_hash) {
      const providerStr = user.provider === 'google' ? 'Google' : user.provider;
      return res.status(400).json({ error: `Tài khoản này được đăng ký qua ${providerStr} và chưa có mật khẩu. Vui lòng đăng nhập bằng ${providerStr}.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });

    const token = jwt.sign({ id: Number(user.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = user;
    
    res.json({ token, user: { ...userWithoutPass, has_password: true, id: Number(userWithoutPass.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Social Login (Mock)
/**
 * Đăng nhập bằng Google.
 *
 * BẢN CŨ CÓ LỖ HỔNG CHIẾM TÀI KHOẢN. Nó nhận `email` thẳng từ req.body rồi
 * cấp JWT cho email đó, không xác thực gì:
 *
 *     POST /api/b2c/auth/social {"provider":"google","email":"<bất kỳ>"}
 *     -> JWT hợp lệ 7 ngày với tư cách khách hàng đó
 *
 * Email chưa tồn tại thì nó còn tự tạo tài khoản mới. Hai nút Facebook/Apple
 * cũ khai thác đúng đường này để demo — đã gỡ bỏ cùng lỗ hổng.
 *
 * Bản này chỉ tin DANH TÍNH LẤY TỪ TOKEN do Google ký:
 *
 *   1. `credential` là ID token (JWT) Google ký bằng khoá riêng của họ.
 *   2. verifyIdToken kiểm chữ ký bằng khoá công khai của Google (thư viện tự
 *      tải và cache, nên không phải gọi mạng mỗi lần đăng nhập).
 *   3. `audience` bắt buộc: chặn token Google phát cho MỘT APP KHÁC. Thiếu bước
 *      này thì kẻ tấn công lấy token hợp lệ từ app bất kỳ của họ và dùng được
 *      ở đây — chữ ký vẫn đúng, chỉ là không dành cho ta.
 *   4. `email_verified`: Google có loại tài khoản email chưa xác minh. Bỏ qua
 *      cờ này thì đăng ký email của người khác rồi chiếm tài khoản tại đây.
 *
 * Email LUÔN lấy từ payload đã verify, không bao giờ từ req.body.
 */
router.post('/auth/social', async (req, res) => {
  try {
    const { provider, credential } = req.body;

    if (provider !== 'google') {
      // Danh sách cho phép, không phải danh sách chặn: thêm provider mới phải
      // là hành động có chủ đích, kèm đoạn xác thực riêng của provider đó.
      return res.status(400).json({ error: 'Phương thức đăng nhập không được hỗ trợ' });
    }
    if (!googleClient) {
      return res.status(503).json({
        error: 'Đăng nhập Google chưa được cấu hình trên máy chủ (thiếu GOOGLE_CLIENT_ID)',
      });
    }
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Thiếu credential từ Google' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      // Không trả chi tiết lỗi của thư viện ra ngoài: nó mô tả chính xác bước
      // nào hỏng, đủ để người thăm dò biết cần sửa gì ở token giả.
      return res.status(401).json({ error: 'Token Google không hợp lệ hoặc đã hết hạn' });
    }

    if (!payload?.email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'Tài khoản Google chưa xác minh email' });
    }

    const email = payload.email.toLowerCase();
    const fullName = payload.name || email.split('@')[0];
    const avatar = payload.picture || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + email);

    let user = await prisma.b2CCustomer.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.b2CCustomer.create({
        data: {
          full_name: fullName,
          email,
          phone: '',
          // Chuỗi rỗng, không phải hash của mật khẩu nào. Đường đăng nhập bằng
          // mật khẩu dùng bcrypt.compare, và compare với chuỗi rỗng luôn sai —
          // nên tài khoản Google không thể đăng nhập bằng mật khẩu trống.
          password_hash: '',
          loyalty_points: 0,
          avatar,
          provider: 'google',
        },
      });
    } else if (!user.provider?.includes('google')) {
      // Email đã đăng ký bằng mật khẩu, giờ đăng nhập bằng Google. Gộp làm một
      // tài khoản là đúng: Google đã xác minh chủ sở hữu email chính là người
      // này. Nhưng KHÔNG xoá password_hash — chủ tài khoản vẫn đăng nhập bằng
      // mật khẩu như cũ được.
      let newProvider = user.provider || '';
      if (!newProvider.includes('google')) {
        newProvider = newProvider === 'local' ? 'local,google' : (newProvider ? newProvider + ',google' : 'google');
      }
      user = await prisma.b2CCustomer.update({
        where: { email },
        data: { provider: newProvider, avatar: user.avatar || avatar },
      });
    }

    const token = jwt.sign({ id: Number(user.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = user;

    res.json({ token, user: { ...userWithoutPass, has_password: !!user.password_hash, id: Number(userWithoutPass.id) } });
  } catch (err) {
    console.error('[auth/social]', err);
    res.status(500).json({ error: 'Không đăng nhập được, vui lòng thử lại' });
  }
});

// Set Password
router.post('/auth/set-password', authB2C, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu mới' });

    const password_hash = await bcrypt.hash(new_password, 10);
    let user = await prisma.b2CCustomer.findUnique({ where: { id: req.b2cUser.id } });
    
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    let newProvider = user.provider || '';
    if (!newProvider.includes('local')) {
      newProvider = newProvider ? newProvider + ',local' : 'local';
    }

    user = await prisma.b2CCustomer.update({
      where: { id: req.b2cUser.id },
      data: { password_hash, provider: newProvider }
    });

    const { password_hash: _, ...userWithoutPass } = user;
    res.json({ success: true, user: { ...userWithoutPass, has_password: true, id: Number(userWithoutPass.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

