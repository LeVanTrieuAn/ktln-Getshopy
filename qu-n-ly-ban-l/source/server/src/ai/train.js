const { PrismaClient } = require('@prisma/client');
const path = require('path');
const NaiveBayes = require('./NaiveBayes');
const registerAllIntents = require('./trainingData');

const prisma = new PrismaClient();
const MODEL_PATH = path.join(__dirname, 'ai_model_weights.json');

async function trainModel() {
  console.log('--- KHOI DONG HE THONG HUAN LUYEN (TRAINING) AI NOI BO ---');
  
  const ai = new NaiveBayes();

  // ===================================================================
  // BUOC 1: Nap toan bo mau cau tinh (tu trainingData.js)
  // Bao gom 50+ Intent: Greeting, Help, ASK_PRICE, COMPARE, v.v...
  // ===================================================================
  console.log('[1/3] Dang nap du lieu tinh tu trainingData.js...');
  registerAllIntents(ai);

  // ===================================================================
  // BUOC 2: Sinh them mau cau DONG tu du lieu thuc trong Database
  // Moi san pham / danh muc se tu tao ra hang chuc cau hoi mau
  // ===================================================================
  console.log('[2/3] Dang ket noi Database de sinh cau hoi mau dong...');
  
  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany({
    where: { is_deleted: false },
    orderBy: { sold: 'desc' },
    take: 1000 // Giới hạn 1000 sản phẩm phổ biến nhất để tránh OOM khi train 1.1M+ câu
  });

  console.log(`      -> Tim thay ${categories.length} Danh muc va ${products.length} San pham.`);

  // Sinh cau mau theo tung Danh muc
  categories.forEach(cat => {
    const name = cat.name.toLowerCase();
    ai.addDocument(`toi muon mua ${name}`, 'SEARCH_CATEGORY');
    ai.addDocument(`shop co ban ${name} khong`, 'SEARCH_CATEGORY');
    ai.addDocument(`cho xem cac mau ${name}`, 'SEARCH_CATEGORY');
    ai.addDocument(`gioi thieu ${name}`, 'SEARCH_CATEGORY');
    ai.addDocument(`tam tien nao nen mua ${name}`, 'ASK_RECOMMEND');
    ai.addDocument(`${name} nao ngon nhat hien tai`, 'ASK_RECOMMEND');
  });

  // Sinh cau mau theo tung San pham
  products.forEach(prod => {
    const name = prod.name.toLowerCase();

    // Tim kiem
    ai.addDocument(`toi muon mua ${name}`, 'SEARCH_PRODUCT');
    ai.addDocument(`tim ${name}`, 'SEARCH_PRODUCT');
    ai.addDocument(`shop co ${name} khong`, 'SEARCH_PRODUCT');
    ai.addDocument(`xem thong tin ${name}`, 'SEARCH_PRODUCT');

    // Hoi gia
    ai.addDocument(`gia ${name} bao nhieu`, 'ASK_PRICE');
    ai.addDocument(`cho hoi gia ${name}`, 'ASK_PRICE');
    ai.addDocument(`${name} nay bao nhieu tien`, 'ASK_PRICE');
    ai.addDocument(`xin bao gia ${name}`, 'ASK_PRICE');
    ai.addDocument(`${name} may trieu`, 'ASK_PRICE');

    // Hoi cau hinh
    ai.addDocument(`cau hinh ${name}`, 'ASK_SPECS');
    ai.addDocument(`cho xem thong so ${name}`, 'ASK_SPECS');
    ai.addDocument(`ram chip cua ${name} la gi`, 'ASK_SPECS');
    ai.addDocument(`${name} pin bao nhieu`, 'ASK_SPECS');
    ai.addDocument(`man hinh ${name} may inch`, 'ASK_SPECS');
    ai.addDocument(`${name} co chong nuoc khong`, 'ASK_SPECS');

    // So sanh
    ai.addDocument(`${name} co tot khong`, 'COMPARE_PRODUCT');
    ai.addDocument(`so sanh ${name}`, 'COMPARE_PRODUCT');
    ai.addDocument(`${name} hay loai khac`, 'COMPARE_PRODUCT');

    // Kiem tra ton kho
    ai.addDocument(`${name} con hang khong`, 'CHECK_STOCK');
    ai.addDocument(`${name} con khong shop`, 'CHECK_STOCK');
    ai.addDocument(`con ${name} khong`, 'CHECK_STOCK');

    // Goi y
    ai.addDocument(`nen mua ${name} khong`, 'ASK_RECOMMEND');
  });

  // ===================================================================
  // BUOC 3: Thuc thi Huan luyen va Luu Model ra o cung
  // ===================================================================
  console.log('[3/3] Dang nhoi du lieu vao Thuat toan Mang Xac suat (Naive Bayes)...');
  ai.train();

  await ai.saveModel(MODEL_PATH);
  console.log('--- Naive Bayes: HOAN TAT ---');
  console.log(`Da xuat ket qua Bo nao AI ra file vat ly: ${MODEL_PATH}`);

  // ===================================================================
  // BUOC 4 (MOI - ENSEMBLE): Train Logistic Regression & Linear SVM
  // Su dung cung corpus voi Naive Bayes (ai.documents da duoc populate)
  // ===================================================================
  console.log('\n--- BAT DAU TRAIN ENSEMBLE SUPPLEMENTARY MODELS ---');

  // Chuyen doi documents cua NaiveBayes sang { text, intent }
  const trainingCorpus = ai.documents.map(doc => ({
    text:   doc.tokens.join(' '),
    intent: doc.intentClass,
  }));

  console.log(`[Ensemble] Corpus: ${trainingCorpus.length} mau cau.`);

  // -----------------------------------------------------------------
  // BUOC 4A: Train Logistic Regression
  // Luu: lr_model_weights.json
  // -----------------------------------------------------------------
  const LR_MODEL_PATH = path.join(__dirname, 'lr_model_weights.json');
  try {
    const LogisticRegression = require('./LogisticRegression');
    const lr = new LogisticRegression({ learningRate: 0.1, epochs: 80, l2Lambda: 0.001 });
    console.log('[4A/4B] Training Logistic Regression...');
    lr.fit(trainingCorpus);
    await lr.saveModel(LR_MODEL_PATH);
    console.log('[4A] Logistic Regression: HOAN TAT');
  } catch (err) {
    console.error('[4A] LR training that bai (khong anh huong NaiveBayes):', err.message);
  }

  // -----------------------------------------------------------------
  // BUOC 4B: Train Linear SVM (One-vs-Rest)
  // Luu: svm_model_weights.json
  // -----------------------------------------------------------------
  const SVM_MODEL_PATH = path.join(__dirname, 'svm_model_weights.json');
  try {
    const LinearSVM = require('./LinearSVM');
    const svm = new LinearSVM({ learningRate: 0.01, epochs: 40, lambda: 0.001 });
    console.log('[4B/4B] Training Linear SVM (One-vs-Rest)...');
    svm.fit(trainingCorpus);
    await svm.saveModel(SVM_MODEL_PATH);
    console.log('[4B] Linear SVM: HOAN TAT');
  } catch (err) {
    console.error('[4B] SVM training that bai (khong anh huong NaiveBayes):', err.message);
  }

  console.log('\n=== TRAINING TOAN BO HE THONG HOAN TAT ===');
  console.log(`  NaiveBayes  -> ${MODEL_PATH}`);
  console.log(`  LogisticReg -> ${LR_MODEL_PATH}`);
  console.log(`  LinearSVM   -> ${SVM_MODEL_PATH}`);
  return true;
}

// Neu chay truc tiep file bang lenh `node train.js`
if (require.main === module) {
  trainModel()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
}

module.exports = { trainModel };
