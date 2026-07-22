const express = require('express');
const { readDb, writeDb } = require('../db');
const router = express.Router();

// Get all reviews
router.get('/reviews', async (req, res) => {
  try {
    const db = await readDb();
    res.json(db.reviews || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reply to a review
router.post('/reviews/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    
    if (!reply) return res.status(400).json({ error: 'Reply content is required' });

    const db = await readDb();
    const reviews = db.reviews || [];
    const reviewIndex = reviews.findIndex(r => r.id == id);
    
    if (reviewIndex === -1) return res.status(404).json({ error: 'Review not found' });
    
    reviews[reviewIndex].reply = reply;
    reviews[reviewIndex].reply_date = new Date().toISOString();
    
    db.reviews = reviews;
    await writeDb(db);
    
    res.json({ message: 'Reply sent successfully', review: reviews[reviewIndex] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── MASTER DATA MANAGEMENT ───

// Branches
router.get('/branches', async (req, res) => {
  try {
    const db = await readDb();
    res.json((db.branches || []).filter(b => !b.is_deleted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/branches', async (req, res) => {
  try {
    const { id, name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const db = await readDb();
    const branches = db.branches || [];
    const newBranch = {
      id: id || `BR-${Date.now()}`,
      name,
      address: address || ''
    };
    branches.push(newBranch);
    db.branches = branches;
    await writeDb(db);
    
    res.json({ message: 'Branch added successfully', branch: newBranch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/branches/:id', async (req, res) => {
  try {
    const { name, address } = req.body;
    const db = await readDb();
    const branches = db.branches || [];
    const index = branches.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Branch not found' });
    branches[index] = { ...branches[index], name: name || branches[index].name, address: address || branches[index].address };
    db.branches = branches;
    await writeDb(db);
    res.json({ message: 'Branch updated successfully', branch: branches[index] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/branches/:id', async (req, res) => {
  try {
    const db = await readDb();
    const branches = db.branches || [];
    const index = branches.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Branch not found' });
    branches[index].is_deleted = true;
    db.branches = branches;
    await writeDb(db);
    res.json({ message: 'Branch soft-deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Brands
router.get('/brands', async (req, res) => {
  try {
    const db = await readDb();
    res.json((db.brands || []).filter(b => !b.is_deleted));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/brands', async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const db = await readDb();
    const brands = db.brands || [];
    const newBrand = {
      id: id || `BRD-${Date.now()}`,
      name
    };
    brands.push(newBrand);
    db.brands = brands;
    await writeDb(db);
    
    res.json({ message: 'Brand added successfully', brand: newBrand });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/brands/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const db = await readDb();
    const brands = db.brands || [];
    const index = brands.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Brand not found' });
    brands[index] = { ...brands[index], name: name || brands[index].name };
    db.brands = brands;
    await writeDb(db);
    res.json({ message: 'Brand updated successfully', brand: brands[index] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/brands/:id', async (req, res) => {
  try {
    const db = await readDb();
    const brands = db.brands || [];
    const index = brands.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Brand not found' });
    brands[index].is_deleted = true;
    db.brands = brands;
    await writeDb(db);
    res.json({ message: 'Brand soft-deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Products
router.get('/products', async (req, res) => {
  try {
    const db = await readDb();
    res.json((db.products || []).filter(p => !p.is_deleted));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products', async (req, res) => {
  try {
    const { name, category_id, price, image, images, branch_ids, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

    const db = await readDb();
    const products = db.products || [];
    const newProduct = {
      id: Date.now(),
      name,
      price: Number(price),
      original_price: Number(price),
      category_id: category_id || 'c1',
      brand_id: 'b1',
      stock: stock !== undefined ? Number(stock) : 100,
      rating: 5,
      sold: 0,
      image: image || 'https://placehold.co/800x800/10b981/ffffff?text=New+Product',
      images: images || [],
      description: 'New product description',
      variants: [],
      branch_ids: branch_ids || []
    };
    
    products.unshift(newProduct); // add to top
    db.products = products;
    await writeDb(db);
    
    res.json({ message: 'Product added successfully', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, category_id, price, image, images, branch_ids, stock, is_banner } = req.body;
    const db = await readDb();
    const products = db.products || [];
    const index = products.findIndex(p => p.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    
    products[index] = {
      ...products[index],
      name: name || products[index].name,
      category_id: category_id || products[index].category_id,
      price: price !== undefined ? Number(price) : products[index].price,
      image: image || products[index].image,
      images: images !== undefined ? images : products[index].images,
      branch_ids: branch_ids || products[index].branch_ids,
      stock: stock !== undefined ? Number(stock) : products[index].stock,
      is_banner: is_banner !== undefined ? is_banner : products[index].is_banner
    };
    
    db.products = products;
    await writeDb(db);
    res.json({ message: 'Product updated successfully', product: products[index] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const db = await readDb();
    const products = db.products || [];
    const index = products.findIndex(p => p.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    
    products[index].is_deleted = true;
    db.products = products;
    await writeDb(db);
    res.json({ message: 'Product soft-deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Flash Sales / Discounts
router.get('/flash-sales', async (req, res) => {
  try {
    const db = await readDb();
    res.json((db.flash_sales || []).filter(fs => !fs.is_deleted));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const checkFlashSaleOverlap = (db, fsId, startTime, endTime, productsToApply) => {
  const activeFlashSales = (db.flash_sales || []).filter(fs => !fs.is_deleted && fs.id !== fsId);
  const prodIdsToApply = productsToApply.map(p => p.id);
  
  for (const fs of activeFlashSales) {
    const overlapTime = new Date(startTime).getTime() <= new Date(fs.end_time).getTime() && 
                        new Date(endTime).getTime() >= new Date(fs.start_time).getTime();
    if (overlapTime) {
      const existingProdIds = (db.flash_sale_items || [])
        .filter(item => item.flash_sale_id === fs.id)
        .map(item => item.product_id);
      if (prodIdsToApply.some(id => existingProdIds.includes(id))) return true;
    }
  }
  return false;
};

router.post('/flash-sales', async (req, res) => {
  try {
    const { title, product_id, category_id, discount_percent, start_time, end_time } = req.body;
    if (!title || (!product_id && !category_id) || discount_percent === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = await readDb();
    const flashSales = db.flash_sales || [];
    const flashSaleItems = db.flash_sale_items || [];
    const products = db.products || [];
    
    const fsStartTime = start_time || new Date().toISOString();
    const fsEndTime = end_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Create new flash sale
    const fsId = Date.now();
    const newFS = {
      id: fsId,
      title,
      start_time: fsStartTime,
      end_time: fsEndTime,
      product_id,
      category_id,
      discount_percent
    };
    
    let productsToApply = [];
    if (product_id) {
      const prod = products.find(p => p.id === Number(product_id));
      if (prod) productsToApply.push(prod);
    } else if (category_id) {
      productsToApply = products.filter(p => p.category_id === category_id);
    }

    if (checkFlashSaleOverlap(db, fsId, fsStartTime, fsEndTime, productsToApply)) {
      return res.status(400).json({ error: 'Sản phẩm đã tồn tại trong một mã giảm giá khác cùng thời điểm' });
    }
    
    flashSales.unshift(newFS);
    
    for (const prod of productsToApply) {
      const discounted = Math.round(prod.price * (1 - (Number(discount_percent) / 100)));
      flashSaleItems.unshift({
        flash_sale_id: fsId,
        product_id: prod.id,
        discount_price: discounted,
        limit: 100,
        sold: 0
      });
    }
    
    db.flash_sales = flashSales;
    db.flash_sale_items = flashSaleItems;
    await writeDb(db);
    
    res.json({ message: 'Flash sale created successfully', flashSale: newFS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/flash-sales/:id', async (req, res) => {
  try {
    const { title, start_time, end_time, product_id, category_id, discount_percent } = req.body;
    const db = await readDb();
    const flashSales = db.flash_sales || [];
    let flashSaleItems = db.flash_sale_items || [];
    const products = db.products || [];
    
    const index = flashSales.findIndex(fs => fs.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Flash sale not found' });
    
    const updatedFS = {
      ...flashSales[index],
      title: title || flashSales[index].title,
      start_time: start_time || flashSales[index].start_time,
      end_time: end_time || flashSales[index].end_time,
      product_id: product_id !== undefined ? product_id : flashSales[index].product_id,
      category_id: category_id !== undefined ? category_id : flashSales[index].category_id,
      discount_percent: discount_percent !== undefined ? discount_percent : flashSales[index].discount_percent
    };

    let productsToApply = [];
    if (updatedFS.product_id) {
      const prod = products.find(p => p.id === Number(updatedFS.product_id));
      if (prod) productsToApply.push(prod);
    } else if (updatedFS.category_id) {
      productsToApply = products.filter(p => p.category_id === updatedFS.category_id);
    }

    if (checkFlashSaleOverlap(db, updatedFS.id, updatedFS.start_time, updatedFS.end_time, productsToApply)) {
      return res.status(400).json({ error: 'Sản phẩm đã tồn tại trong một mã giảm giá khác cùng thời điểm' });
    }

    flashSales[index] = updatedFS;
    db.flash_sales = flashSales;

    // Remove old items
    flashSaleItems = flashSaleItems.filter(item => item.flash_sale_id !== updatedFS.id);
    // Add new items
    for (const prod of productsToApply) {
      const discounted = Math.round(prod.price * (1 - (Number(updatedFS.discount_percent) / 100)));
      flashSaleItems.unshift({
        flash_sale_id: updatedFS.id,
        product_id: prod.id,
        discount_price: discounted,
        limit: 100,
        sold: 0
      });
    }
    db.flash_sale_items = flashSaleItems;

    await writeDb(db);
    res.json({ message: 'Flash sale updated successfully', flashSale: updatedFS });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/flash-sales/:id', async (req, res) => {
  try {
    const db = await readDb();
    const flashSales = db.flash_sales || [];
    const index = flashSales.findIndex(fs => fs.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Flash sale not found' });
    
    flashSales[index].is_deleted = true;
    db.flash_sales = flashSales;
    await writeDb(db);
    res.json({ message: 'Flash sale soft-deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
