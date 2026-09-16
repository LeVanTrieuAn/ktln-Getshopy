/**
 * crawl-tgdd.js
 * ─────────────────────────────────────────────────────────────────
 * Crawl dữ liệu sản phẩm thực từ thegioididong.com
 * Dùng puppeteer-core với Chrome đã cài sẵn trên máy.
 *
 * Cách dùng:
 *   node scripts/crawl-tgdd.js
 *   node scripts/crawl-tgdd.js --resume    ← tiếp tục từ checkpoint
 *   node scripts/crawl-tgdd.js --cat dtdd  ← chỉ crawl 1 category
 *
 * Output: scripts/data/tgdd-products.json (checkpoint từng category)
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

// ── Cấu hình ─────────────────────────────────────────────────────
const CHROME_PATH = process.env.CHROME_PATH || (
  process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome'
);

const DATA_DIR       = path.join(__dirname, 'data');
const OUTPUT_FILE    = path.join(DATA_DIR, 'tgdd-products.json');
const PROGRESS_FILE  = path.join(DATA_DIR, 'crawl-progress.json');

const DELAY_MS        = 800;    // delay giữa các request (ms)
const PAGE_TIMEOUT_MS = 25000;  // timeout mỗi trang
const MAX_PAGES_PER_CAT = 300;  // Tăng lên 300 trang để vét sạch (~6000 sp/cat)
const HEADLESS        = true;

// ── Mapping TGDD URL → category_id trong DB ──────────────────────
const CATEGORY_MAP = [
  // [slug tgdd, category_id, tên hiển thị]
  { slug: 'dtdd',                          catId: 'cat-phone',                   name: 'Điện thoại'           },
  { slug: 'laptop',                        catId: 'cat-laptop',                  name: 'Laptop'               },
  { slug: 'may-tinh-bang',                 catId: 'cat-tablet',                  name: 'Máy tính bảng'        },
  { slug: 'dong-ho-thong-minh',            catId: 'cat-watch',                   name: 'Đồng hồ thông minh'   },
  { slug: 'pin-sac-du-phong',              catId: 'cat-mobile-acc-powerbank',    name: 'Sạc dự phòng'         },
  { slug: 'sac-cap-dien-thoai',            catId: 'cat-mobile-acc-charger',      name: 'Sạc, cáp'             },
  { slug: 'op-lung-dien-thoai',            catId: 'cat-mobile-acc-case-phone',   name: 'Ốp lưng điện thoại'   },
  { slug: 'op-lung-may-tinh-bang',         catId: 'cat-mobile-acc-case-tablet',  name: 'Ốp lưng máy tính bảng'},
  { slug: 'mieng-dan-man-hinh-dien-thoai', catId: 'cat-mobile-acc-screen',       name: 'Miếng dán màn hình'   },
  { slug: 'mieng-dan-camera',              catId: 'cat-mobile-acc-cam-cover',    name: 'Miếng dán Camera'     },
  { slug: 'tui-dung-airpods',              catId: 'cat-mobile-acc-airpods-case', name: 'Túi đựng AirPods'     },
  { slug: 'quat-mini',                     catId: 'cat-mobile-acc-fan',          name: 'Quạt mini'            },
  { slug: 'but-cam-ung',                   catId: 'cat-mobile-acc-pen',          name: 'Bút cảm ứng'          },
  { slug: 'gia-do-dien-thoai',             catId: 'cat-mobile-acc-stand',        name: 'Giá đỡ điện thoại'    },
  { slug: 'day-deo-dien-thoai',            catId: 'cat-mobile-acc-strap',        name: 'Dây đeo điện thoại'   },
  { slug: 'hub-cap-chuyen-doi',            catId: 'cat-laptop-acc-hub',          name: 'Hub, cáp chuyển đổi'  },
  { slug: 'chuot-may-tinh',                catId: 'cat-laptop-acc-mouse',        name: 'Chuột máy tính'       },
  { slug: 'ban-phim',                      catId: 'cat-laptop-acc-keyboard',     name: 'Bàn phím'             },
  { slug: 'router-wifi',                   catId: 'cat-laptop-acc-router',       name: 'Router & Thiết bị mạng'},
  { slug: 'balo-tui-chong-soc',            catId: 'cat-laptop-acc-bag',          name: 'Balo, túi chống sốc'  },
  { slug: 'tui-dung-phu-kien',             catId: 'cat-laptop-acc-pouch',        name: 'Túi đựng phụ kiện'    },
  { slug: 'phu-phim-laptop',               catId: 'cat-laptop-acc-keyboard-cover',name:'Phủ phím laptop'      },
  { slug: 'gia-teo-man-hinh',              catId: 'cat-laptop-acc-monitor-stand',name: 'Giá treo màn hình'    },
  { slug: 'mieng-lot-chuot',               catId: 'cat-laptop-acc-mousepad',     name: 'Miếng lót chuột'      },
  { slug: 'bang-ve-dien-tu',               catId: 'cat-laptop-acc-drawing',      name: 'Bảng vẽ điện tử'      },
  { slug: 'tai-nghe-bluetooth',            catId: 'cat-av-bt-earphone',          name: 'Tai nghe Bluetooth'   },
  { slug: 'tai-nghe-day',                  catId: 'cat-av-wire-earphone',        name: 'Tai nghe dây'         },
  { slug: 'tai-nghe-chup-tai',             catId: 'cat-av-headphone',            name: 'Tai nghe chụp tai'    },
  { slug: 'tai-nghe-the-thao',             catId: 'cat-av-sport-earphone',       name: 'Tai nghe thể thao'    },
  { slug: 'loa-bluetooth',                 catId: 'cat-av-speaker',              name: 'Loa'                  },
  { slug: 'micro-thu-am',                  catId: 'cat-av-mic',                  name: 'Micro'                },
  { slug: 'may-chieu-mini',                catId: 'cat-av-projector',            name: 'Máy chiếu'            },
  { slug: 'kinh-thong-minh',               catId: 'cat-av-smartglass',           name: 'Kính thông minh'      },
  { slug: 'o-cung-di-dong',                catId: 'cat-av-hdd',                  name: 'Ổ cứng'               },
  { slug: 'the-nho',                        catId: 'cat-av-sdcard',               name: 'Thẻ nhớ'              },
  { slug: 'usb-o-nhap',                    catId: 'cat-av-usb',                  name: 'USB'                  },
  { slug: 'camera-giam-sat',               catId: 'cat-cam-security',            name: 'Camera giám sát'      },
  { slug: 'camera-ip-wifi',                catId: 'cat-cam-indoor',              name: 'Camera trong nhà'     },
  { slug: 'camera-ngoai-troi',             catId: 'cat-cam-outdoor',             name: 'Camera ngoài trời'    },
  { slug: 'camera-nang-luong-mat-troi',    catId: 'cat-cam-solar',               name: 'Camera năng lượng mặt trời'},
  { slug: 'camera-4g',                     catId: 'cat-cam-4g',                  name: 'Camera 4G'            },
  { slug: 'chuong-cua-camera',             catId: 'cat-cam-doorbell',            name: 'Chuông cửa Camera'    },
  { slug: 'webcam',                        catId: 'cat-cam-webcam',              name: 'Webcam'               },
];

// ── Brand mapping từ tên thương hiệu → brand_id trong DB ─────────
const BRAND_MAP = {
  'apple':          'br-apple',
  'samsung':        'br-samsung',
  'oppo':           'br-oppo',
  'xiaomi':         'br-xiaomi',
  'vivo':           'br-vivo',
  'realme':         'br-realme',
  'nokia':          'br-nokia',
  'masstel':        'br-masstel',
  'mobell':         'br-mobell',
  'tecno':          'br-tecno',
  'infinix':        'br-infinix',
  'itel':           'br-itel',
  'honor':          'br-honor',
  'motorola':       'br-motorola',
  'asus':           'br-asus',
  'hp':             'br-hp',
  'lenovo':         'br-lenovo',
  'acer':           'br-acer',
  'dell':           'br-dell',
  'msi':            'br-msi',
  'lg':             'br-lg',
  'microsoft':      'br-microsoft',
  'gigabyte':       'br-gigabyte',
  'razer':          'br-razer',
  'garmin':         'br-garmin',
  'huawei':         'br-huawei',
  'amazfit':        'br-amazfit',
  'fitbit':         'br-fitbit',
  'polar':          'br-polar',
  'anker':          'br-anker',
  'baseus':         'br-baseus',
  'energizer':      'br-energizer',
  'ugreen':         'br-ugreen',
  'romoss':         'br-romoss',
  'belkin':         'br-belkin',
  'spigen':         'br-spigen',
  'esr':            'br-esr',
  'jbl':            'br-jbl',
  'sony':           'br-sony-audio',
  'bose':           'br-bose',
  'sennheiser':     'br-sennheiser',
  'jabra':          'br-jabra',
  'edifier':        'br-edifier',
  '1more':          'br-1more',
  'skullcandy':     'br-skullcandy',
  'beats':          'br-beats',
  'shure':          'br-shure',
  'logitech':       'br-logitech',
  'marshall':       'br-marshall',
  'harman':         'br-harman',
  'hikvision':      'br-hikvision',
  'dahua':          'br-dahua',
  'kbvision':       'br-kbone',
  'reolink':        'br-reolink',
  'imou':           'br-imou',
  'ezviz':          'br-ezviz',
  'tp-link':        'br-tp-link',
  'tplink':         'br-tp-link',
  'seagate':        'br-seagate',
  'western':        'br-wd',
  'sandisk':        'br-sandisk',
  'kingston':       'br-kingston',
  'lexar':          'br-lexar',
  'transcend':      'br-transcend',
  'toshiba':        'br-toshiba',
  'pny':            'br-pny',
  'netgear':        'br-netgear',
  'linksys':        'br-linksys',
  'dlink':          'br-dlink',
  'd-link':         'br-dlink',
  'totolink':       'br-totolink',
  'mercusys':       'br-mercusys',
};

// ── Helpers ──────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mapBrand(productName) {
  const nameLower = productName.toLowerCase();
  for (const [keyword, brandId] of Object.entries(BRAND_MAP)) {
    if (nameLower.includes(keyword)) return brandId;
  }
  return 'br-apple'; // fallback
}

function cleanPrice(priceStr) {
  if (!priceStr) return 0;
  return parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { completedSlugs: [], totalCrawled: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadExistingProducts() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function appendProducts(newProducts) {
  const existing = loadExistingProducts();
  const combined = [...existing, ...newProducts];
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(combined, null, 2));
  return combined.length;
}

// ── Parse sản phẩm từ HTML đã render ─────────────────────────────
async function parseProductsFromPage(page, catId) {
  return await page.evaluate((catId) => {
    const products = [];
    
    // TGDD: li.item chứa a.main-contain với data attributes đầy đủ
    // Cấu trúc: li.item > a.main-contain[data-name, data-price, data-brand]
    const items = document.querySelectorAll('ul.listproduct li.item');
    
    items.forEach(item => {
      try {
        // Lấy thẻ a chứa data attributes chính
        const anchor = item.querySelector('a.main-contain, a[data-name]');
        if (!anchor) return;
        
        // Tên sản phẩm (ưu tiên data-name, fallback sang p.product-title)
        let name = anchor.getAttribute('data-name') || '';
        if (!name) {
          const titleEl = item.querySelector('p.product-title, h3');
          name = titleEl ? titleEl.textContent.trim() : '';
        }
        if (!name || name.length < 3) return;
        
        // Giá từ data-price (chính xác nhất)
        const priceRaw = parseFloat(anchor.getAttribute('data-price') || '0');
        
        // Giá hiển thị (strong.price)
        const priceEl    = item.querySelector('strong.price, .price strong, p.special-price');
        const priceText  = priceEl ? priceEl.textContent.trim() : String(priceRaw);
        
        // Giá gốc
        const origPriceEl   = item.querySelector('.price-old, del, s, .price-through');
        const origPriceText = origPriceEl ? origPriceEl.textContent.trim() : priceText;
        
        // Ảnh (TGDD dùng img.thumb)
        const imgEl = item.querySelector('img.thumb, .item-img img, img[src*="cdn.tgdd"]');
        let imageUrl = imgEl
          ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || '')
          : '';
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
        if (!imageUrl.startsWith('http')) imageUrl = '';
        
        // URL sản phẩm
        const href = anchor.getAttribute('href') || '';
        const productUrl = href.startsWith('/')
          ? 'https://www.thegioididong.com' + href
          : href;
        
        // Brand từ data-brand (TGDD lưu sẵn)
        const brandAttr = anchor.getAttribute('data-brand') || item.getAttribute('data-brand') || '';
        
        // Rating (nếu có)
        const ratingEl  = item.querySelector('[class*="rating"], .count-star');
        const ratingText = ratingEl ? ratingEl.textContent.trim() : '4.8';
        
        products.push({
          name,
          priceText,
          origPriceText,
          priceRaw,
          imageUrl,
          productUrl,
          ratingText,
          brandAttr,
          catId,
        });
      } catch (e) {}
    });
    
    return products;
  }, catId);
}

// ── Hàm crawl 1 trang cụ thể ──────────────────────────────────────
async function crawlPage(browser, catSlug, catId, page, seenUrls) {
  const url = `https://www.thegioididong.com/${catSlug}?p=${page}`;
  let tabPage;
  try {
    tabPage = await browser.newPage();
    await tabPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await tabPage.setExtraHTTPHeaders({
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    await tabPage.setRequestInterception(true);
    tabPage.on('request', req => {
      const type = req.resourceType();
      if (['stylesheet', 'font', 'media'].includes(type)) req.abort();
      else req.continue();
    });

    await tabPage.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await tabPage.waitForSelector('ul.listproduct li.item, ul.listproduct', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000)); // wait for populate

    const pageProducts = await parseProductsFromPage(tabPage, catId);
    
    const validProducts = [];
    for (const raw of pageProducts) {
      const price = raw.priceRaw && raw.priceRaw > 1000 ? Math.round(raw.priceRaw) : cleanPrice(raw.priceText);
      const origPrice = cleanPrice(raw.origPriceText) || price;
      
      if (price < 1000 || !raw.name) continue;
      
      const brandAttrLower = (raw.brandAttr || '').toLowerCase().trim();
      const brandId = brandAttrLower ? (BRAND_MAP[brandAttrLower] || mapBrand(raw.name)) : mapBrand(raw.name);
      
      let rating = parseFloat(raw.ratingText) || 4.8;
      if (isNaN(rating) || rating > 5) rating = 4.8;
      if (rating < 1) rating = 4.5;

      if (raw.productUrl && seenUrls.has(raw.productUrl)) continue;

      validProducts.push({
        name:           raw.name,
        price:          price,
        original_price: Math.max(price, origPrice),
        category_id:    catId,
        brand_id:       brandId,
        image:          raw.imageUrl || null,
        images:         raw.imageUrl ? JSON.stringify([raw.imageUrl]) : JSON.stringify([]),
        description:    `${raw.name} — Sản phẩm chính hãng tại Thế Giới Di Động.`,
        variants:       JSON.stringify([]),
        stock:          Math.floor(Math.random() * 200) + 50,
        rating:         Math.round(rating * 10) / 10,
        sold:           Math.floor(Math.random() * 1000),
        branch_ids:     ['HCM001'],
        is_banner:      false,
        is_deleted:     false,
        productUrl:     raw.productUrl,
      });
    }
    
    return { page, success: true, count: pageProducts.length, validProducts };
  } catch (err) {
    return { page, success: false, count: 0, validProducts: [], error: err.message };
  } finally {
    if (tabPage) await tabPage.close().catch(() => {});
  }
}

// ── Crawl 1 category (Batching) ──────────────────────────────────
async function crawlCategory(browser, catSlug, catId, catName, seenUrls, catExistingCount) {
  const products = [];
  let page = Math.max(1, Math.floor(catExistingCount / 20) - 1);
  let consecutiveEmpty = 0;
  const CONCURRENCY = 4; // Mở 4 tab cùng lúc

  console.log(`\n  📂 Crawling: ${catName} (/${catSlug}) - Bắt đầu từ trang ${page} (đã có ${catExistingCount} sp) [BATCH: ${CONCURRENCY}]`);

  while (page <= MAX_PAGES_PER_CAT) {
    const batchPromises = [];
    for (let i = 0; i < CONCURRENCY && (page + i) <= MAX_PAGES_PER_CAT; i++) {
      batchPromises.push(crawlPage(browser, catSlug, catId, page + i, seenUrls));
    }
    
    const results = await Promise.all(batchPromises);
    
    for (const res of results) {
      if (!res.success) {
        console.log(`    ⚠ Lỗi trang ${res.page}: ${res.error}`);
        consecutiveEmpty++;
      } else if (res.validProducts.length === 0) {
        // Nếu không có sản phẩm mới nào, tính là trang rỗng
        consecutiveEmpty++;
      } else {
        consecutiveEmpty = 0;
        products.push(...res.validProducts);
        // Cập nhật seenUrls để các trang tiếp theo không trùng
        for (const p of res.validProducts) {
          if (p.productUrl) seenUrls.add(p.productUrl);
        }
        process.stdout.write(`    Trang ${res.page}: +${res.validProducts.length} sp mới → Tổng mới: ${products.length} \r`);
      }
    }
    
    if (consecutiveEmpty >= 2 * CONCURRENCY) {
      console.log(`\n    → Hết dữ liệu (nhiều trang rỗng liên tiếp)`);
      break;
    }

    await sleep(DELAY_MS);
    page += CONCURRENCY;
  }

  console.log(`\n    ✅ Crawled thêm ${products.length} sản phẩm mới từ "${catName}"`);
  return products;
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isResume = args.includes('--resume');
  const filterCat = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null;

  console.log('\n🕷️  TGDD PRODUCT CRAWLER');
  console.log('═'.repeat(60));
  console.log(`  Chrome  : ${CHROME_PATH}`);
  console.log(`  Resume  : ${isResume}`);
  console.log(`  Output  : ${OUTPUT_FILE}`);
  console.log('═'.repeat(60));

  // Tạo thư mục data nếu chưa có
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Khôi phục dữ liệu đã có để tránh trùng lặp
  const existingProducts = loadExistingProducts();
  const seenUrls = new Set(existingProducts.filter(p => p.productUrl).map(p => p.productUrl));
  console.log(`  🔄 Đã tải ${existingProducts.length} sản phẩm từ file hiện tại.`);

  let progress = loadProgress();

  const targetCats = filterCat
    ? CATEGORY_MAP.filter(c => c.catId === filterCat)
    : CATEGORY_MAP;

  console.log(`\n  Sẽ crawl ${targetCats.length} categories`);

  // Launch browser
  console.log('\n  🚀 Khởi động Chrome...');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
      ],
    });
    console.log('  ✅ Chrome đã khởi động!');
  } catch (err) {
    console.error('\n❌ Không thể khởi động Chrome:', err.message);
    console.error('\n💡 Hãy kiểm tra CHROME_PATH:');
    console.error(`   set CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`);
    console.error(`   node scripts/crawl-tgdd.js`);
    process.exit(1);
  }

  let grandTotal = progress.totalCrawled;

  try {
    for (let i = 0; i < targetCats.length; i++) {
      const { slug, catId, name } = targetCats[i];
      const catExistingCount = existingProducts.filter(p => p.category_id === catId).length;

      console.log(`\n[${i + 1}/${targetCats.length}] ${name}`);

      // Truyền thêm seenUrls và catExistingCount
      const products = await crawlCategory(browser, slug, catId, name, seenUrls, catExistingCount);

      if (products.length > 0) {
        const newTotal = appendProducts(products);
        grandTotal = newTotal;
        progress.totalCrawled = newTotal;
        saveProgress(progress);
        console.log(`  💾 Đã lưu. Tổng tích lũy: ${newTotal} sản phẩm`);
        
        // Cập nhật seenUrls
        for (const p of products) {
          if (p.productUrl) seenUrls.add(p.productUrl);
        }
      }

      // Nghỉ giữa các category
      if (i < targetCats.length - 1) {
        const wait = 3000 + Math.random() * 2000;
        console.log(`  ⏳ Nghỉ ${(wait / 1000).toFixed(1)}s trước category tiếp theo...`);
        await sleep(wait);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n\n═══════════════════════════════════════════════');
  console.log('✅ CRAWL HOÀN THÀNH!');
  console.log(`  📦 Tổng sản phẩm crawled: ${grandTotal}`);
  console.log(`  📁 File: ${OUTPUT_FILE}`);
  console.log('═══════════════════════════════════════════════');
  console.log('\nBước tiếp theo:');
  console.log('  node scripts/replace-products.js');
}

main().catch(err => {
  console.error('\n❌ Lỗi nghiêm trọng:', err);
  process.exit(1);
});
