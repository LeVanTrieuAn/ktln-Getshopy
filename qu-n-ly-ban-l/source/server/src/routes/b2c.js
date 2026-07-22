const express = require('express');
const { readDb, writeDb } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'istore_secret';

// Get Categories
router.get('/categories', async (req, res) => {
  try {
    const db = await readDb();
    res.json(db.categories || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const getActiveFlashSaleItems = (db) => {
  const activeSale = (db.flash_sales || []).find(fs => !fs.is_deleted);
  if (!activeSale || (activeSale.end_time && new Date(activeSale.end_time).getTime() <= Date.now())) {
    return [];
  }
  return (db.flash_sale_items || []).filter(i => i.flash_sale_id === activeSale.id);
};

const applyFlashSaleToProduct = (product, fsItems) => {
  const fsItem = fsItems.find(i => i.product_id === product.id);
  if (fsItem) {
    // Keep original_price as the base price, update price to discount_price
    product.original_price = product.price;
    product.price = fsItem.discount_price;
  }
  return product;
};

// Get Brands
router.get('/brands', async (req, res) => {
  try {
    const db = await readDb();
    res.json(db.brands || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Products (with Filter/Sort)
router.get('/products', async (req, res) => {
  try {
    const db = await readDb();
    let products = (db.products || []).filter(p => !p.is_deleted);
    const { category_id, brand_id, search, sort, branch_id } = req.query;

    if (category_id && category_id !== 'ALL') {
      products = products.filter(p => p.category_id === category_id);
    }
    if (brand_id && brand_id !== 'ALL') {
      products = products.filter(p => p.brand_id === brand_id);
    }
    if (search) {
      products = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (branch_id) {
      products = products.filter(p => !p.branch_ids || p.branch_ids.length === 0 || p.branch_ids.includes(branch_id));
    }
    if (sort) {
      if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
      if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
      if (sort === 'newest') products.sort((a, b) => b.id - a.id);
    }
    
    const fsItems = getActiveFlashSaleItems(db);
    products = products.map(p => applyFlashSaleToProduct(p, fsItems));

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Product Detail
router.get('/products/:id', async (req, res) => {
  try {
    const db = await readDb();
    const product = (db.products || []).find(p => p.id == req.params.id && !p.is_deleted);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    // Attach reviews
    const reviews = (db.reviews || []).filter(r => r.product_id == product.id);
    product.reviews = reviews;

    const fsItems = getActiveFlashSaleItems(db);
    applyFlashSaleToProduct(product, fsItems);

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Flash Sales
router.get('/flash-sales', async (req, res) => {
  try {
    const db = await readDb();
    const activeSale = (db.flash_sales || []).find(fs => !fs.is_deleted);
    if (!activeSale) return res.json(null);

    // Check if flash sale event has ended
    if (activeSale.end_time && new Date(activeSale.end_time).getTime() <= Date.now()) {
      return res.json(null);
    }

    const items = (db.flash_sale_items || []).filter(i => i.flash_sale_id === activeSale.id);
    if (!items || items.length === 0) return res.json(null);

    const products = db.products || [];

    const enrichedItems = items.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      return prod ? { ...prod, ...item } : null;
    }).filter(Boolean);

    if (!enrichedItems.length) return res.json(null);

    res.json({ ...activeSale, items: enrichedItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Checkout moved to index.js to sync with ClickHouse

// Apply Voucher
router.post('/cart/apply-voucher', async (req, res) => {
  try {
    const { code, cart_total } = req.body;
    const db = await readDb();
    const voucher = (db.vouchers || []).find(v => v.code === code.toUpperCase());
    
    if (!voucher) return res.status(404).json({ error: 'Mã giảm giá không hợp lệ' });
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

    res.json({ success: true, discount, voucher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get My Orders
router.get('/orders/me', async (req, res) => {
  try {
    // In a real app, get user from auth token. Here we just return mock orders or filter by email if provided.
    const { email } = req.query;
    const db = await readDb();
    let orders = db.orders || [];
    if (email) {
      orders = orders.filter(o => o.customer?.email === email);
    }
    // Sort newest first
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
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

    const db = await readDb();
    
    const newReview = {
      id: 'REV-' + Date.now(),
      product_id: parseInt(id),
      reviewer: reviewer || 'Khách hàng',
      rating: parseInt(rating),
      comment: comment,
      date: new Date().toISOString()
    };

    if (!db.reviews) db.reviews = [];
    db.reviews.push(newReview);
    
    await writeDb(db);
    res.json({ success: true, review: newReview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTHENTICATION ---

// Register
router.post('/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;
    const db = await readDb();
    
    if (!db.b2c_customers) db.b2c_customers = [];
    
    const exists = db.b2c_customers.find(u => u.email === email);
    if (exists) return res.status(400).json({ error: 'Email đã được sử dụng' });

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now(),
      full_name,
      email,
      phone: phone || '',
      password_hash,
      loyalty_points: 0,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + email,
      provider: 'local'
    };

    db.b2c_customers.push(newUser);
    await writeDb(db);

    const token = jwt.sign({ id: newUser.id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = newUser;
    
    res.json({ token, user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await readDb();
    
    const user = (db.b2c_customers || []).find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    
    const provider = user.provider || 'local';
    if (provider !== 'local') {
      return res.status(400).json({ error: `Tài khoản này được liên kết với ${provider}. Vui lòng đăng nhập bằng ${provider}.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });

    const token = jwt.sign({ id: user.id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = user;
    
    res.json({ token, user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Social Login (Mock)
router.post('/auth/social', async (req, res) => {
  try {
    const { provider, email, full_name, avatar } = req.body; // provider: 'google' | 'facebook'
    const db = await readDb();
    if (!db.b2c_customers) db.b2c_customers = [];

    let user = db.b2c_customers.find(u => u.email === email);

    if (!user) {
      // Auto-register
      user = {
        id: Date.now(),
        full_name,
        email,
        phone: '',
        password_hash: '', // No password for social
        loyalty_points: 0,
        avatar: avatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + email),
        provider: provider
      };
      db.b2c_customers.push(user);
      await writeDb(db);
    } else {
      if (user.provider !== provider) {
         // Auto-link or reject based on business logic. Here we allow it but update provider.
         user.provider = provider;
         user.avatar = avatar || user.avatar;
         await writeDb(db);
      }
    }

    const token = jwt.sign({ id: user.id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash: _, ...userWithoutPass } = user;
    
    res.json({ token, user: userWithoutPass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
