const express = require('express');
const { prisma } = require('../db');
const { invalidate } = require('../redis');
// Cache số đếm / thứ hạng danh sách sản phẩm của cửa hàng (routes/b2c.js, 12/11/2026):
// xoá khi thêm/sửa/xoá sản phẩm để "N sản phẩm" và danh mục cập nhật ngay.
const { invalidateListingCache } = require('./b2c');
// Quản lý khách hàng (16/11/2026) — phần thuần ở services/customerAdmin.js.
const bcrypt = require('bcryptjs');
const customerAdmin = require('../services/customerAdmin');
const mail = require('../services/mailService');
const { invalidateCustomerStatus } = require('../middleware/authB2C');
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
    // GET /api/b2c/branches (cửa hàng) cache 5 phút
    await invalidate('branches:active');

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
    await invalidate('branches:active');
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
    await invalidate('branches:active');
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
    await invalidate('brands:active');

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
    await invalidate('brands:active');
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
    await invalidate('brands:active');
    res.json({ message: 'Brand soft-deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Brand not found' });
    res.status(500).json({ error: err.message }); 
  }
});

// Products
/**
 * Danh sách sản phẩm cho khu quản trị — CÓ PHÂN TRANG.
 *
 * Bản cũ trả VỀ TOÀN BỘ catalog. Khi kho còn ~50.000 sản phẩm thì nó nặng
 * nhưng sống được; với 600.000 thì Node dựng 600.000 object rồi `.map()` tạo
 * thêm một bản sao nữa — tràn heap và TIẾN TRÌNH CHẾT. Không phải một trang
 * lỗi: cả máy chủ sập, mọi người dùng nhận 502 cho tới khi container khởi
 * động lại.
 *
 * Trình duyệt cũng không khá hơn: antd Table và Select không render nổi
 * 600.000 dòng. Nên phân trang ở đây là bắt buộc cả hai phía.
 *
 * Ba chế độ:
 *   ?page=&limit=   phân trang cho bảng
 *   ?search=        tìm theo tên, lọc trong SQL chứ không tải hết về rồi lọc
 *   ?ids=1,2,3      tra đúng vài sản phẩm (bảng flash sale cần tên theo id)
 */
router.get('/products', async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    // Trần 100: tham số do client gửi, không được để client tự quyết định
    // nạp bao nhiêu vào bộ nhớ máy chủ.
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();

    const where = { is_deleted: false };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    if (req.query.ids) {
      const ids = String(req.query.ids).split(',')
        .map(x => x.trim()).filter(x => /^\d+$/.test(x)).slice(0, 200)
        .map(x => BigInt(x));
      if (ids.length === 0) return res.json({ data: [], total: 0, page: 1, limit });
      where.id = { in: ids };
    }

    const select = {
      id: true, name: true, price: true, original_price: true, category_id: true,
      brand_id: true, stock: true, rating: true, sold: true, image: true, images: true,
      branch_ids: true, is_banner: true, is_deleted: true, created_at: true,
    };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where, orderBy: { id: 'desc' },
        skip: req.query.ids ? 0 : (page - 1) * limit,
        take: limit, select,
      }),
    ]);

    res.json({ data: products.map(p => ({ ...p, id: Number(p.id) })), total, page, limit });
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

    // Đồng bộ bản ghi Inventory cho sản phẩm mới để B2C đặt hàng không bị lỗi thiếu bản ghi tồn kho
    await prisma.inventory.upsert({
      where: {
        product_id_variant_id_branch_id: {
          product_id: newProduct.id,
          variant_id: '',
          branch_id: '',
        },
      },
      update: { on_hand: Math.max(0, newProduct.stock) },
      create: {
        product_id: newProduct.id,
        variant_id: '',
        branch_id: '',
        on_hand: Math.max(0, newProduct.stock),
        reserved: 0,
      },
    });
    
    invalidateListingCache();   // chạy nền, tự bắt lỗi — không bắt quản trị chờ
    res.json({ message: 'Product added successfully', product: { ...newProduct, id: Number(newProduct.id) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, category_id, price, image, images, branch_ids, stock, is_banner } = req.body;
    const productId = BigInt(req.params.id);
    
    const product = await prisma.product.update({
      where: { id: productId },
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

    // Nếu admin sửa stock trên B2B, đồng bộ xuống bảng Inventory
    if (stock !== undefined) {
      const targetStock = Math.max(0, Number(stock));
      const invRows = await prisma.inventory.findMany({
        where: { product_id: productId },
        orderBy: { id: 'asc' },
      });
      if (invRows.length === 0) {
        await prisma.inventory.create({
          data: {
            product_id: productId,
            variant_id: '',
            branch_id: '',
            on_hand: targetStock,
            reserved: 0,
          },
        });
      } else if (invRows.length === 1) {
        await prisma.inventory.update({
          where: { id: invRows[0].id },
          data: { on_hand: invRows[0].reserved + targetStock },
        });
      } else {
        // Nhiều biến thể: điều chỉnh chênh lệch vào biến thể đầu tiên và đồng bộ lại variants JSONB
        const currentAvail = invRows.reduce((s, r) => s + Math.max(0, r.on_hand - r.reserved), 0);
        const diff = targetStock - currentAvail;
        if (diff !== 0) {
          const first = invRows[0];
          const nextOnHand = Math.max(first.reserved, first.on_hand + diff);
          await prisma.inventory.update({
            where: { id: first.id },
            data: { on_hand: nextOnHand },
          });
          const { syncProductStock } = require('../services/payment/inventoryService');
          await syncProductStock(prisma, invRows.map(r => r.id));
        }
      }
    }
    
    invalidateListingCache();
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
    invalidateListingCache();
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

// Customers (B2C)
// Phân trang + tìm ở máy chủ. Bản cũ trả cả bảng (40.008 khách, ~7 MB JSON, 1,5–2,5 s
// mỗi lần mở trang Quản lý chung — đo 11/11/2026) để bảng antd tự chia trang ở client.
// Trả { data, total, page, limit } giống /b2b/products.
// (16/11/2026) Thêm ?status=all|active|inactive và cột is_active / deactivated_at. Đo trên
// production cùng ngày (40.010 khách, EXPLAIN ANALYZE): count 15 ms, trang 20 dòng 16 ms.
router.get('/customers', async (req, res) => {
  try {
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const built = customerAdmin.buildCustomerListWhere({ search: req.query.search, status: req.query.status });
    if (!built.ok) return res.status(400).json({ error: built.error });
    const { where } = built;

    const [total, customers] = await Promise.all([
      prisma.b2CCustomer.count({ where }),
      prisma.b2CCustomer.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: customerAdmin.CUSTOMER_SELECT,
      }),
    ]);
    res.json({ data: customers.map(customerAdmin.toCustomerDto), total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Quản lý khách hàng: thêm / sửa / vô hiệu hoá / kích hoạt lại (16/11/2026) ───
// KHÔNG có DELETE: "xoá" khách = vô hiệu hoá (xem services/customerAdmin.js). Mọi route ở
// đây đã qua requireAdmin (index.js gắn cho cả /api/b2b).

// Cùng cost với /auth/register (routes/b2c.js) và passwordReset.js.
const BCRYPT_COST = 10;
const { MSG: CUSTOMER_MSG } = customerAdmin;

/**
 * Khách KHÁC đang dùng email này, so không phân biệt hoa thường (/auth/register lưu email
 * nguyên văn nên "An@x.com" và "an@x.com" có thể cùng tồn tại). lower() = lower() là phép
 * so bằng, không phải ILIKE: email có "_" hay "%" không bị hiểu thành ký tự đại diện.
 * Quét tuần tự: 21 ms trên 40.010 khách (production, 16/11/2026) — chỉ chạy khi quản trị
 * thêm / sửa email nên không đáng một index biểu thức.
 */
async function findEmailOwner(email, excludeId = BigInt(-1)) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM "B2CCustomer"
    WHERE lower(email) = lower(${email}) AND id <> ${excludeId}
    LIMIT 1`;
  return rows[0] || null;
}

const adminTag = (req) => `quản trị #${req.adminUser?.id ?? '?'}`;

// Chi tiết + thống kê đơn (chỉ đọc). "Đã chi tiêu" = tổng đơn payment_status = 'PAID' (đã
// thu tiền; đơn hoàn tiền chuyển sang REFUNDED nên tự rơi ra). Dùng index Order(customer_id):
// khách nhiều đơn nhất trên production (624 đơn) tốn 1,9 ms — đo 16/11/2026.
router.get('/customers/:id', async (req, res) => {
  const id = customerAdmin.parseCustomerId(req.params.id);
  if (!id) return res.status(400).json({ error: CUSTOMER_MSG.ID });
  try {
    const [customer, stats] = await Promise.all([
      prisma.b2CCustomer.findUnique({ where: { id }, select: customerAdmin.CUSTOMER_SELECT }),
      prisma.$queryRaw`
        SELECT count(*)::int AS order_count,
               count(*) FILTER (WHERE payment_status = 'PAID')::int AS paid_order_count,
               COALESCE(sum(total) FILTER (WHERE payment_status = 'PAID'), 0)::bigint AS total_spent,
               max(date) AS last_order_date
        FROM "Order" WHERE customer_id = ${id}`,
    ]);
    if (!customer) return res.status(404).json({ error: CUSTOMER_MSG.NOT_FOUND });
    res.json({ ...customerAdmin.toCustomerDto(customer), stats: customerAdmin.toOrderStats(stats[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/customers', async (req, res) => {
  try {
    const checked = customerAdmin.validateCreateCustomer(req.body);
    if (!checked.ok) return res.status(400).json({ error: checked.errors[0], errors: checked.errors });
    const v = checked.value;

    if (await findEmailOwner(v.email)) {
      return res.status(409).json({ error: CUSTOMER_MSG.DUPLICATE_EMAIL, code: 'EMAIL_TAKEN' });
    }

    // Mật khẩu ngẫu nhiên, băm xong là bỏ: không trả ra, không ghi log, không gửi email.
    // Khách tự đặt mật khẩu bằng "Quên mật khẩu?" (OTP gửi tới chính email này).
    const password_hash = await bcrypt.hash(customerAdmin.generateInitialPassword(), BCRYPT_COST);
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.b2CCustomer.create({
        data: { ...customerAdmin.buildCreateData(v), password_hash },
        select: customerAdmin.CUSTOMER_SELECT,
      });
      const adj = customerAdmin.buildLoyaltyAdjustment(c.id, v.loyalty_points);
      if (adj) await tx.loyaltyTransaction.create({ data: adj });
      return c;
    });
    const customer = customerAdmin.toCustomerDto(created);
    console.log(`[customers] ${adminTag(req)} tạo khách #${customer.id}`);

    // Lỗi SMTP không làm hỏng việc tạo khách: sendWelcomeEmail không bao giờ ném lỗi, chỉ
    // báo lại để trang quản trị hiện "chưa gửi được email".
    const email = await customerAdmin.sendWelcomeEmail({ mail, customer, requested: v.send_welcome_email });
    res.status(201).json({ message: 'Đã tạo khách hàng', customer, email });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: CUSTOMER_MSG.DUPLICATE_EMAIL, code: 'EMAIL_TAKEN' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/customers/:id', async (req, res) => {
  const id = customerAdmin.parseCustomerId(req.params.id);
  if (!id) return res.status(400).json({ error: CUSTOMER_MSG.ID });
  try {
    const existing = await prisma.b2CCustomer.findUnique({
      where: { id },
      select: { email: true, provider: true, loyalty_points: true },
    });
    if (!existing) return res.status(404).json({ error: CUSTOMER_MSG.NOT_FOUND });

    const checked = customerAdmin.validateUpdateCustomer(req.body, existing);
    if (!checked.ok) return res.status(400).json({ error: checked.errors[0], errors: checked.errors });
    const data = checked.data;

    if (data.email && await findEmailOwner(data.email, id)) {
      return res.status(409).json({ error: CUSTOMER_MSG.DUPLICATE_EMAIL, code: 'EMAIL_TAKEN' });
    }
    if (Object.keys(data).length === 0) {
      const current = await prisma.b2CCustomer.findUnique({ where: { id }, select: customerAdmin.CUSTOMER_SELECT });
      return res.json({ message: 'Không có thay đổi nào', changed: false, customer: customerAdmin.toCustomerDto(current) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let delta = 0;
      if (data.loyalty_points !== undefined) {
        // Khoá dòng rồi mới tính chênh lệch: checkout trừ điểm (decrement) cùng lúc thì số ghi
        // vào sổ cái vẫn đúng bằng phần quản trị thực sự đổi.
        const rows = await tx.$queryRaw`SELECT loyalty_points FROM "B2CCustomer" WHERE id = ${id} FOR UPDATE`;
        if (!rows.length) throw Object.assign(new Error('not found'), { code: 'P2025' });
        delta = data.loyalty_points - Number(rows[0].loyalty_points);
      }
      const c = await tx.b2CCustomer.update({ where: { id }, data, select: customerAdmin.CUSTOMER_SELECT });
      const adj = customerAdmin.buildLoyaltyAdjustment(id, delta);
      if (adj) await tx.loyaltyTransaction.create({ data: adj });
      return c;
    });
    console.log(`[customers] ${adminTag(req)} sửa khách #${id}: ${Object.keys(data).join(', ')}`);
    res.json({ message: 'Đã cập nhật khách hàng', changed: true, customer: customerAdmin.toCustomerDto(updated) });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: CUSTOMER_MSG.DUPLICATE_EMAIL, code: 'EMAIL_TAKEN' });
    if (err.code === 'P2025') return res.status(404).json({ error: CUSTOMER_MSG.NOT_FOUND });
    res.status(500).json({ error: err.message });
  }
});

// { active: false } = vô hiệu hoá, { active: true } = kích hoạt lại. Gọi lại với trạng thái
// đang có thì không đổi gì (giữ nguyên deactivated_at của lần vô hiệu hoá đầu).
router.patch('/customers/:id/status', async (req, res) => {
  const id = customerAdmin.parseCustomerId(req.params.id);
  if (!id) return res.status(400).json({ error: CUSTOMER_MSG.ID });
  const active = customerAdmin.parseStatusBody(req.body);
  if (active === null) return res.status(400).json({ error: CUSTOMER_MSG.STATUS_BODY });
  try {
    // updateMany có điều kiện trạng thái cũ: một câu lệnh, không đọc-rồi-ghi.
    const { count } = await prisma.b2CCustomer.updateMany({
      where: { id, is_active: !active },
      data: { is_active: active, deactivated_at: active ? null : new Date() },
    });
    // Xoá bộ đệm của authB2C NGAY: token của khách bị từ chối từ request kế tiếp — trên MỌI
    // bản server (cân bằng tải, 18/11/2026). await: Redis nhận tin rồi mới trả lời quản trị;
    // không bao giờ ném lỗi, Redis rớt thì trả ngay (bản khác chờ TTL 30 s).
    await invalidateCustomerStatus(id);
    const customer = await prisma.b2CCustomer.findUnique({ where: { id }, select: customerAdmin.CUSTOMER_SELECT });
    if (!customer) return res.status(404).json({ error: CUSTOMER_MSG.NOT_FOUND });
    if (count) console.log(`[customers] ${adminTag(req)} ${active ? 'kích hoạt lại' : 'vô hiệu hoá'} khách #${id}`);
    res.json({
      message: active ? 'Đã kích hoạt lại tài khoản' : 'Đã vô hiệu hoá tài khoản',
      changed: count > 0,
      customer: customerAdmin.toCustomerDto(customer),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
