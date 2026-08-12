const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, '../db.json');

// Using the same default data in case db.json is missing
const defaultData = require('./db_legacy_data'); // We'll extract defaultData to a separate file

async function main() {
  console.log('Bắt đầu chuyển đổi dữ liệu sang PostgreSQL...');

  let data;
  try {
    const fileContent = await fs.readFile(dbPath, 'utf-8');
    data = JSON.parse(fileContent);
    console.log('Đã đọc file db.json thành công.');
  } catch (error) {
    console.log('Không tìm thấy db.json, sẽ dùng dữ liệu mẫu (defaultData).');
    data = defaultData;
  }

  // 1. Users
  if (data.users) {
    for (const u of data.users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          full_name: u.full_name,
          email: u.email,
          password_hash: u.password_hash,
          role: u.role,
          status: u.status
        }
      });
    }
    console.log(`Đã seed ${data.users.length} users.`);
  }

  // 2. B2C Customers
  if (data.b2c_customers) {
    for (const c of data.b2c_customers) {
      await prisma.b2CCustomer.upsert({
        where: { email: c.email },
        update: {},
        create: {
          full_name: c.full_name,
          email: c.email,
          phone: c.phone || null,
          password_hash: c.password_hash,
          loyalty_points: c.loyalty_points || 0,
          avatar: c.avatar || null,
          provider: c.provider || 'local'
        }
      });
    }
    console.log(`Đã seed ${data.b2c_customers.length} b2c_customers.`);
  }

  // 3. Categories
  if (data.categories) {
    for (const cat of data.categories) {
      await prisma.category.upsert({
        where: { id: cat.id },
        update: {},
        create: {
          id: cat.id,
          name: cat.name,
          icon: cat.icon
        }
      });
    }
    console.log(`Đã seed ${data.categories.length} categories.`);
  }

  // 4. Brands
  if (data.brands) {
    for (const brand of data.brands) {
      await prisma.brand.upsert({
        where: { id: brand.id },
        update: {},
        create: {
          id: brand.id,
          name: brand.name
        }
      });
    }
    console.log(`Đã seed ${data.brands.length} brands.`);
  }

  // 4.5 Branches
  if (data.branches) {
    for (const branch of data.branches) {
      await prisma.branch.upsert({
        where: { id: branch.id },
        update: {},
        create: {
          id: branch.id,
          name: branch.name,
          address: branch.address || null
        }
      });
    }
    console.log(`Đã seed ${data.branches.length} branches.`);
  }

  // 5. Products
  if (data.products) {
    for (const p of data.products) {
      // Because product ID in prisma is BigInt but default is Int/number
      const product = await prisma.product.findFirst({ where: { name: p.name } });
      if (!product) {
        await prisma.product.create({
          data: {
            name: p.name,
            price: p.price,
            original_price: p.original_price,
            category_id: p.category_id,
            brand_id: p.brand_id,
            stock: p.stock || 0,
            rating: p.rating || 5,
            sold: p.sold || 0,
            image: p.image || null,
            images: p.images || [],
            description: p.description || null,
            variants: p.variants || [],
            branch_ids: p.branch_ids || [],
            is_deleted: p.is_deleted || false
          }
        });
      }
    }
    console.log(`Đã seed ${data.products.length} products.`);
  }

  // 6. Flash Sales
  if (data.flash_sales) {
    for (const fsItem of data.flash_sales) {
      const existing = await prisma.flashSale.findFirst({ where: { title: fsItem.title } });
      if (!existing) {
        await prisma.flashSale.create({
          data: {
            title: fsItem.title,
            start_time: new Date(),
            end_time: new Date(fsItem.end_time),
            discount_percent: fsItem.discount_percent || 50,
          }
        });
      }
    }
    console.log(`Đã seed ${data.flash_sales.length} flash_sales.`);
  }

  console.log('Quá trình seed hoàn tất!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
