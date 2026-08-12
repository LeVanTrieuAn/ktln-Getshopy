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

const getActiveFlashSaleItems = async () => {
  const activeSale = await prisma.flashSale.findFirst({
    where: { 
      is_deleted: false,
      end_time: { gt: new Date() } 
    }
  });
  if (!activeSale) return [];
  return await prisma.flashSaleItem.findMany({ where: { flash_sale_id: activeSale.id } });
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
    const brands = await cached('brands:active', 300, () => prisma.brand.findMany({ where: { is_deleted: false } }));
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Products (with Filter/Sort)
router.get('/products', async (req, res) => {
  try {
    const { category_id, brand_id, search, sort, branch_id, page = 1, limit = 12 } = req.query;
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 12;
    const skip = (pageNumber - 1) * limitNumber;
    
    let where = { is_deleted: false };
    if (category_id && category_id !== 'ALL') where.category_id = category_id;
    if (brand_id && brand_id !== 'ALL') where.brand_id = brand_id;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    let orderBy = { id: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    if (sort === 'price_desc') orderBy = { price: 'desc' };
    if (sort === 'newest') orderBy = { id: 'desc' };

    // Only the fields the shop list card / branch filter actually need —
    // skips description/variants which are only used on the detail page.
    const listSelect = {
      id: true, name: true, price: true, original_price: true, image: true,
      stock: true, rating: true, sold: true, category_id: true, brand_id: true,
      branch_ids: true, is_banner: true, created_at: true
    };

    let products, total;

    if (branch_id) {
      // branch_ids is a JSON array, so it can't be pushed into the SQL WHERE/LIMIT here.
      // Bounded fallback: filter/paginate in-app over a capped candidate set instead of
      // the full table. Known limitation — see PERF-PRODUCTS.md §3.1 for a real fix
      // (jsonb containment query or a proper product_branch join table).
      const BRANCH_FILTER_CAP = 5000;
      let candidates = await prisma.product.findMany({ where, orderBy, take: BRANCH_FILTER_CAP, select: listSelect });
      candidates = candidates.filter(p => {
        if (!p.branch_ids) return true;
        let arr = p.branch_ids;
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr); } catch(e) { arr = []; }
        }
        return !Array.isArray(arr) || arr.length === 0 || arr.includes(branch_id);
      });
      total = candidates.length;
      products = candidates.slice(skip, skip + limitNumber);
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
    if (email) {
      orders = await prisma.order.findMany({
        where: {
          customer: {
            path: ['email'],
            equals: email
          }
        },
        orderBy: { date: 'desc' }
      });
    } else {
      orders = await prisma.order.findMany({ orderBy: { date: 'desc' } });
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

    res.json({ success: true, review: { ...newReview, product_id: Number(newReview.product_id) } });
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

// Social Login (Mock)
router.post('/auth/social', async (req, res) => {
  try {
    const { provider, email, full_name, avatar } = req.body;
    
    let user = await prisma.b2CCustomer.findUnique({ where: { email } });

    if (!user) {
      // Auto-register
      user = await prisma.b2CCustomer.create({
        data: {
          full_name,
          email,
          phone: '',
          password_hash: '', 
          loyalty_points: 0,
          avatar: avatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + email),
          provider: provider
        }
      });
    } else {
      if (user.provider !== provider) {
         user = await prisma.b2CCustomer.update({
           where: { email },
           data: {
             provider: provider,
             avatar: avatar || user.avatar
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

module.exports = router;
