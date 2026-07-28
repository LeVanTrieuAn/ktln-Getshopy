const express = require('express');
const { readDb, writeDb } = require('../db');
const router = express.Router();

// Get all reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany();
    // Convert BigInt product_id to Number for JSON serialization
    res.json(reviews.map(r => ({ ...r, product_id: Number(r.product_id) })));
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

    const review = await prisma.review.update({
      where: { id: id },
      data: {
        reply: reply,
        reply_date: new Date()
      }
    });

    res.json({ message: 'Reply sent successfully', review: { ...review, product_id: Number(review.product_id) } });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Review not found' });
    res.status(500).json({ error: err.message });
  }
});
// ─── MASTER DATA MANAGEMENT ───

// Branches
router.get('/branches', async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({ where: { is_deleted: false } });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/branches', async (req, res) => {
  try {
    const { id, name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const newBranch = await prisma.branch.create({
      data: {
        id: id || `BR-${Date.now()}`,
        name,
        address: address || ''
      }
    });
    
    res.json({ message: 'Branch added successfully', branch: newBranch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/branches/:id', async (req, res) => {
  try {
    const { name, address } = req.body;
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(address && { address })
      }
    });
    res.json({ message: 'Branch updated successfully', branch });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Branch not found' });
    res.status(500).json({ error: err.message }); 
  }
});

router.delete('/branches/:id', async (req, res) => {
  try {
    await prisma.branch.update({
      where: { id: req.params.id },
      data: { is_deleted: true }
    });
    res.json({ message: 'Branch soft-deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Branch not found' });
    res.status(500).json({ error: err.message });
  }
});

// Brands
router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({ where: { is_deleted: false } });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/brands', async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const newBrand = await prisma.brand.create({
      data: {
        id: id || `BRD-${Date.now()}`,
        name
      }
    });
    
    res.json({ message: 'Brand added successfully', brand: newBrand });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/brands/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const brand = await prisma.brand.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name })
      }
    });
    res.json({ message: 'Brand updated successfully', brand });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Brand not found' });
    res.status(500).json({ error: err.message }); 
  }
});

router.delete('/brands/:id', async (req, res) => {
  try {
    await prisma.brand.update({
      where: { id: req.params.id },
      data: { is_deleted: true }
    });
    res.json({ message: 'Brand soft-deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Brand not found' });
    res.status(500).json({ error: err.message }); 
  }
});

// Products
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { is_deleted: false }, orderBy: { id: 'desc' } });
    res.json(products.map(p => ({ ...p, id: Number(p.id) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products', async (req, res) => {
  try {
    const { name, category_id, price, image, images, branch_ids, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

    const newProduct = await prisma.product.create({
      data: {
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
      }
    });
    
    res.json({ message: 'Product added successfully', product: { ...newProduct, id: Number(newProduct.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, category_id, price, image, images, branch_ids, stock, is_banner } = req.body;
    
    const product = await prisma.product.update({
      where: { id: BigInt(req.params.id) },
      data: {
        ...(name && { name }),
        ...(category_id && { category_id }),
        ...(price !== undefined && { price: Number(price) }),
        ...(image && { image }),
        ...(images !== undefined && { images }),
        ...(branch_ids && { branch_ids }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(is_banner !== undefined && { is_banner })
      }
    });
    
    res.json({ message: 'Product updated successfully', product: { ...product, id: Number(product.id) } });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    res.status(500).json({ error: err.message }); 
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await prisma.product.update({
      where: { id: BigInt(req.params.id) },
      data: { is_deleted: true }
    });
    res.json({ message: 'Product soft-deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    res.status(500).json({ error: err.message }); 
  }
});

// Flash Sales / Discounts
router.get('/flash-sales', async (req, res) => {
  try {
    const flashSales = await prisma.flashSale.findMany({ where: { is_deleted: false } });
    res.json(flashSales.map(fs => ({ ...fs, id: Number(fs.id) })));
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

    const fsStartTime = start_time ? new Date(start_time) : new Date();
    const fsEndTime = end_time ? new Date(end_time) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    let productsToApply = [];
    if (product_id) {
      const prod = await prisma.product.findUnique({ where: { id: BigInt(product_id) } });
      if (prod) productsToApply.push(prod);
    } else if (category_id) {
      productsToApply = await prisma.product.findMany({ where: { category_id, is_deleted: false } });
    }

    if (productsToApply.length === 0) {
      return res.status(400).json({ error: 'No products found' });
    }

    // Check overlap
    const activeFlashSales = await prisma.flashSale.findMany({
      where: {
        is_deleted: false,
        end_time: { gte: fsStartTime },
        start_time: { lte: fsEndTime }
      }
    });

    for (const fs of activeFlashSales) {
      const existingItems = await prisma.flashSaleItem.findMany({ where: { flash_sale_id: fs.id } });
      const existingProdIds = existingItems.map(item => Number(item.product_id));
      if (productsToApply.some(p => existingProdIds.includes(Number(p.id)))) {
        return res.status(400).json({ error: 'Sản phẩm đã tồn tại trong một mã giảm giá khác cùng thời điểm' });
      }
    }
    
    // Create new flash sale
    const newFS = await prisma.flashSale.create({
      data: {
        title,
        start_time: fsStartTime,
        end_time: fsEndTime,
        product_id: product_id ? String(product_id) : null,
        category_id: category_id || null,
        discount_percent: Number(discount_percent)
      }
    });
    
    // Create items
    const fsItemsData = productsToApply.map(prod => {
      const discounted = Math.round(prod.price * (1 - (Number(discount_percent) / 100)));
      return {
        flash_sale_id: newFS.id,
        product_id: prod.id,
        discount_price: discounted,
        limit: 100,
        sold: 0
      };
    });
    
    await prisma.flashSaleItem.createMany({ data: fsItemsData });
    
    res.json({ message: 'Flash sale created successfully', flashSale: { ...newFS, id: Number(newFS.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/flash-sales/:id', async (req, res) => {
  try {
    const { title, start_time, end_time, product_id, category_id, discount_percent } = req.body;
    
    let productsToApply = [];
    if (product_id) {
      const prod = await prisma.product.findUnique({ where: { id: BigInt(product_id) } });
      if (prod) productsToApply.push(prod);
    } else if (category_id) {
      productsToApply = await prisma.product.findMany({ where: { category_id, is_deleted: false } });
    }

    // Update FS
    const updatedFS = await prisma.flashSale.update({
      where: { id: BigInt(req.params.id) },
      data: {
        ...(title && { title }),
        ...(start_time && { start_time: new Date(start_time) }),
        ...(end_time && { end_time: new Date(end_time) }),
        ...(product_id !== undefined && { product_id: product_id ? String(product_id) : null }),
        ...(category_id !== undefined && { category_id: category_id || null }),
        ...(discount_percent !== undefined && { discount_percent: Number(discount_percent) })
      }
    });

    // Replace items
    await prisma.flashSaleItem.deleteMany({ where: { flash_sale_id: BigInt(req.params.id) } });
    
    const fsItemsData = productsToApply.map(prod => {
      const discounted = Math.round(prod.price * (1 - (Number(updatedFS.discount_percent) / 100)));
      return {
        flash_sale_id: updatedFS.id,
        product_id: prod.id,
        discount_price: discounted,
        limit: 100,
        sold: 0
      };
    });
    
    await prisma.flashSaleItem.createMany({ data: fsItemsData });
    
    res.json({ message: 'Flash sale updated successfully', flashSale: { ...updatedFS, id: Number(updatedFS.id) } });
  } catch (err) { 
    if (err.code === 'P2025') return res.status(404).json({ error: 'Flash sale not found' });
    res.status(500).json({ error: err.message }); 
  }
});

router.delete('/flash-sales/:id', async (req, res) => {
  try {
    await prisma.flashSale.update({
      where: { id: BigInt(req.params.id) },
      data: { is_deleted: true }
    });
    res.json({ message: 'Flash sale soft-deleted successfully' });
  } catch (err) { 
    if (err.code === 'P2025') return res.status(404).json({ error: 'Flash sale not found' });
    res.status(500).json({ error: err.message }); 
  }
});

module.exports = router;
