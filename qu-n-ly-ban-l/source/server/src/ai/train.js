const { PrismaClient } = require('@prisma/client');
const path = require('path');
const NaiveBayes = require('./NaiveBayes');
const registerAllIntents = require('./trainingData');

const prisma = new PrismaClient();
const MODEL_PATH = path.join(__dirname, 'ai_model_weights.json');

async function trainModel() {
  console.log('--- KHỞI ĐỘNG HỆ THỐNG HUẤN LUYỆN (TRAINING) AI NỘI BỘ ---');
  
  const ai = new NaiveBayes();

  // ═══════════════════════════════════════════════════════════════════
  // BƯỚC 1: Nạp toàn bộ mẫu câu tĩnh (từ trainingData.js)
  // Bao gồm 50+ Intent: Greeting, Help, ASK_PRICE, COMPARE, v.v...
  // ═══════════════════════════════════════════════════════════════════
  console.log('[1/3] Đang nạp dữ liệu tĩnh từ trainingData.js...');
  registerAllIntents(ai);

  // ═══════════════════════════════════════════════════════════════════
  // BƯỚC 2: Sinh thêm mẫu câu ĐỘNG từ dữ liệu thực trong Database
  // Mỗi sản phẩm / danh mục sẽ tự tạo ra hàng chục câu hỏi mẫu
  // ═══════════════════════════════════════════════════════════════════
  console.log('[2/3] Đang kết nối Database để sinh câu hỏi mẫu động...');
  
  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany({ where: { is_deleted: false } });

  console.log(`      -> Tìm thấy ${categories.length} Danh mục và ${products.length} Sản phẩm.`);

  // Sinh câu mẫu theo từng Danh mục
  categories.forEach(cat => {
    const name = cat.name.toLowerCase();
    ai.addDocument(`tôi muốn mua ${name}`, 'SEARCH_CATEGORY');
    ai.addDocument(`shop có bán ${name} không`, 'SEARCH_CATEGORY');
    ai.addDocument(`cho xem các mẫu ${name}`, 'SEARCH_CATEGORY');
    ai.addDocument(`giới thiệu ${name}`, 'SEARCH_CATEGORY');
    ai.addDocument(`tầm tiền nào nên mua ${name}`, 'ASK_RECOMMEND');
    ai.addDocument(`${name} nào ngon nhất hiện tại`, 'ASK_RECOMMEND');
  });

  // Sinh câu mẫu theo từng Sản phẩm
  products.forEach(prod => {
    const name = prod.name.toLowerCase();

    // Tìm kiếm
    ai.addDocument(`tôi muốn mua ${name}`, 'SEARCH_PRODUCT');
    ai.addDocument(`tìm ${name}`, 'SEARCH_PRODUCT');
    ai.addDocument(`shop có ${name} không`, 'SEARCH_PRODUCT');
    ai.addDocument(`xem thông tin ${name}`, 'SEARCH_PRODUCT');

    // Hỏi giá
    ai.addDocument(`giá ${name} bao nhiêu`, 'ASK_PRICE');
    ai.addDocument(`cho hỏi giá ${name}`, 'ASK_PRICE');
    ai.addDocument(`${name} này bao nhiêu tiền`, 'ASK_PRICE');
    ai.addDocument(`xin báo giá ${name}`, 'ASK_PRICE');
    ai.addDocument(`${name} mấy triệu`, 'ASK_PRICE');

    // Hỏi cấu hình
    ai.addDocument(`cấu hình ${name}`, 'ASK_SPECS');
    ai.addDocument(`cho xem thông số ${name}`, 'ASK_SPECS');
    ai.addDocument(`ram chip của ${name} là gì`, 'ASK_SPECS');
    ai.addDocument(`${name} pin bao nhiêu`, 'ASK_SPECS');
    ai.addDocument(`màn hình ${name} mấy inch`, 'ASK_SPECS');
    ai.addDocument(`${name} có chống nước không`, 'ASK_SPECS');

    // So sánh
    ai.addDocument(`${name} có tốt không`, 'COMPARE_PRODUCT');
    ai.addDocument(`so sánh ${name}`, 'COMPARE_PRODUCT');
    ai.addDocument(`${name} hay loại khác`, 'COMPARE_PRODUCT');

    // Kiểm tra tồn kho
    ai.addDocument(`${name} còn hàng không`, 'CHECK_STOCK');
    ai.addDocument(`${name} còn không shop`, 'CHECK_STOCK');
    ai.addDocument(`còn ${name} không`, 'CHECK_STOCK');

    // Gợi ý
    ai.addDocument(`nên mua ${name} không`, 'ASK_RECOMMEND');
  });

  // ═══════════════════════════════════════════════════════════════════
  // BƯỚC 3: Thực thi Huấn luyện và Lưu Model ra ổ cứng
  // ═══════════════════════════════════════════════════════════════════
  console.log('[3/3] Đang nhồi dữ liệu vào Thuật toán Mạng Xác suất (Naive Bayes)...');
  ai.train();

  await ai.saveModel(MODEL_PATH);
  console.log('--- HOÀN TẤT ---');
  console.log(`Đã xuất kết quả Bộ não AI ra file vật lý: ${MODEL_PATH}`);
  return true;
}

// Nếu chạy trực tiếp file bằng lệnh `node train.js`
if (require.main === module) {
  trainModel()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
}

module.exports = { trainModel };
