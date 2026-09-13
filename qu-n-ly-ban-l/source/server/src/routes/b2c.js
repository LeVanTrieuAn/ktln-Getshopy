const express = require('express');
const { prisma } = require('../db');
const { cached } = require('../redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'istore_secret';

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

// Get Products (with Filter/Sort)
router.get('/products', async (req, res) => {
  try {
    const { category_id, brand_ids, search, sort, branch_id, page = 1, limit = 12 } = req.query;
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 12;
    const skip = (pageNumber - 1) * limitNumber;

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
    
    // Handle multi-word search correctly using AND for each token
    if (search) {
      const searchTokens = search.trim().split(/\s+/).filter(Boolean);
      if (searchTokens.length > 0) {
        where.AND = searchTokens.map(t => ({ name: { contains: t, mode: 'insensitive' } }));
      }
    }

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
      
      // Tokenized search for raw SQL
      if (search) {
        const searchTokens = search.trim().split(/\s+/).filter(Boolean);
        searchTokens.forEach(t => {
          params.push(`%${t}%`);
          conditions.push(`name ILIKE $${params.length}`);
        });
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
      const orderSQL = ORDER_MAP[sort] ?? 'id DESC';

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
    } else {
      // Real DB-level pagination: only the requested page is ever fetched/serialized.
      [products, total] = await Promise.all([
        prisma.product.findMany({ where, orderBy, skip, take: limitNumber, select: listSelect }),
        prisma.product.count({ where })
      ]);
    }

    const fsItems = await getActiveFlashSaleItems();
    products = products.map(p => applyFlashSaleToProduct({ ...p, id: Number(p.id) }, fsItems));

    res.json({
      data: products,
      total,
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
router.get('/orders/me', async (req, res) => {
  try {
    const { email } = req.query;
    // In JSON, customer info is stored in `customer` Json field. We'll find orders where customer->>email = email.
    // However, Prisma currently doesn't deeply filter JSON nicely across all DBs without raw,
    // but in Postgres we can use path-based filtering, OR we fetch and filter since number of orders is small,
    // OR we just use Prisma's Json filtering:
    let orders;
    const allOrders = await prisma.order.findMany({ orderBy: { date: 'desc' } });
    if (email) {
      orders = allOrders.filter(o => {
        try {
          let cust = o.customer;
          if (typeof cust === 'string') cust = JSON.parse(cust);
          return cust && cust.email === email;
        } catch (e) {
          return false;
        }
      });
    } else {
      orders = allOrders;
    }
    res.json(orders);
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

    // Update product overall rating
    const allReviews = await prisma.review.findMany({ where: { product_id: BigInt(id) } });
    if (allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await prisma.product.update({
        where: { id: BigInt(id) },
        data: { rating: avgRating }
      });
    }

    res.json({ success: true, review: { ...newReview, product_id: Number(newReview.product_id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- B2C MIDDLEWARE ---
const b2cAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  }
};

// --- WISHLIST ---
router.get('/wishlist', b2cAuth, async (req, res) => {
  try {
    const list = await prisma.wishlist.findMany({
      where: { customer_id: BigInt(req.user.id) }
    });
    const productIds = list.map(item => item.product_id);
    
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, is_deleted: false }
    });
    
    res.json(products.map(p => ({ ...p, id: Number(p.id) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/wishlist', b2cAuth, async (req, res) => {
  try {
    const { product_id } = req.body;
    const existing = await prisma.wishlist.findFirst({
      where: { 
        customer_id: BigInt(req.user.id), 
        product_id: BigInt(product_id) 
      }
    });
    
    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      res.json({ success: true, action: 'removed' });
    } else {
      await prisma.wishlist.create({
        data: { 
          customer_id: BigInt(req.user.id), 
          product_id: BigInt(product_id) 
        }
      });
      res.json({ success: true, action: 'added' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTHENTICATION ---

// Register
router.post('/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;
    
    const exists = await prisma.b2CCustomer.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email đã được sử dụng' });

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await prisma.b2CCustomer.create({
      data: {
        full_name,
        email,
        phone: phone || '',
        password_hash,
        loyalty_points: 0,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + email,
        provider: 'local'
      }
    });

    const token = jwt.sign({ id: Number(newUser.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = newUser;
    
    res.json({ token, user: { ...userWithoutPass, id: Number(userWithoutPass.id) } });
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
    
    const provider = user.provider || 'local';
    if (provider !== 'local') {
      return res.status(400).json({ error: `Tài khoản này được liên kết với ${provider}. Vui lòng đăng nhập bằng ${provider}.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });

    const token = jwt.sign({ id: Number(user.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = user;
    
    res.json({ token, user: { ...userWithoutPass, id: Number(userWithoutPass.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Social Login
router.post('/auth/social', async (req, res) => {
  try {
    const { provider, email: mockEmail, full_name: mockName, avatar: mockAvatar, token: accessToken } = req.body;
    
    let realEmail = mockEmail;
    let realName = mockName;
    let realAvatar = mockAvatar;

    // Nếu provider là google và có token, xác thực với Google
    if (provider === 'google' && accessToken) {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) {
          throw new Error('Failed to verify Google token');
        }
        const googleUser = await response.json();
        realEmail = googleUser.email;
        realName = googleUser.name;
        realAvatar = googleUser.picture;
      } catch (e) {
        return res.status(401).json({ error: 'Google authentication failed' });
      }
    }

    let user = await prisma.b2CCustomer.findUnique({ where: { email: realEmail } });

    if (!user) {
      // Auto-register
      user = await prisma.b2CCustomer.create({
        data: {
          full_name: realName,
          email: realEmail,
          phone: '',
          password_hash: '', 
          loyalty_points: 0,
          avatar: realAvatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + realEmail),
          provider: provider
        }
      });
    } else {
      if (user.provider !== provider) {
         user = await prisma.b2CCustomer.update({
           where: { email: realEmail },
           data: {
             provider: provider,
             avatar: realAvatar || user.avatar
           }
         });
      }
    }

    const token = jwt.sign({ id: Number(user.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = user;
    
    res.json({ token, user: { ...userWithoutPass, id: Number(userWithoutPass.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NOTE: /recommendations endpoint đã được chuyển sang routes/recommendation.js
//       sử dụng services/RecommendationService.js

module.exports = router;

