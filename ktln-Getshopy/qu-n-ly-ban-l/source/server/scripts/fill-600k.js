/**
 * fill-600k.js
 * ─────────────────────────────────────────────────────────────────
 * Sinh catalog tổng hợp đến đúng TARGET sản phẩm, CÂN THEO NHÓM:
 *   ✅ Thiết bị (điện thoại, laptop, tablet, đồng hồ) = 40%, mỗi nhóm 10%
 *   ✅ Phụ kiện di động / phụ kiện laptop / nghe nhìn / camera = 60%, mỗi nhóm 15%
 *   ✅ Trong một nhóm: chia đều cho các danh mục lá
 *   ✅ Trong một danh mục lá: chia đều cho các hãng làm mặt hàng đó
 *   ✅ Không hãng nào vượt BRAND_CAP_SHARE (10%) catalog
 *   ✅ Giá rơi trong khoảng của từng danh mục
 *
 * Chỉ THÊM, không sửa/xoá sản phẩm đang có. Sản phẩm có sẵn được tính vào hạn
 * mức của danh mục và hãng của nó.
 *
 * Cách dùng:
 *   node scripts/fill-600k.js              ← đến 600.000
 *   node scripts/fill-600k.js 1000000      ← tuỳ chỉnh target
 *   node scripts/fill-600k.js --dry-run    ← chỉ in kế hoạch, không ghi DB
 *
 * VÌ SAO VIẾT LẠI (29/09) — bản cũ sinh ra catalog lệch hẳn:
 *   - Chỉ lấy danh mục có `parent_id`. 4 nhóm thiết bị không có danh mục con
 *     nên bị loại cả 4: 600.000 sản phẩm mà chỉ 6 cái là điện thoại/laptop/tablet.
 *   - Hãng không có trong BRAND_CAT_MAP được coi là làm MỌI danh mục, và các
 *     danh mục không hãng nào map thì chỉ còn đúng hãng đó -> br-kamera chiếm 41%.
 *   - Giá rải đều 150 nghìn – 50 triệu cho mọi danh mục: ốp lưng 40 triệu,
 *     laptop 200 nghìn. Đặc trưng "tầm giá" của content-based vì thế vô nghĩa.
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ── Cấu hình ─────────────────────────────────────────────────────
const ARGS          = process.argv.slice(2);
const DRY_RUN       = ARGS.includes('--dry-run');
const TARGET        = parseInt(ARGS.find(a => /^\d+$/.test(a)) || '600000', 10);
const MIN_PER_BRAND = 20;   // chỉ để kiểm tra ở báo cáo cuối
const MIN_PER_CAT   = 20;
const BATCH_SIZE    = 3000; // rows/lần insert

// Tỉ trọng từng nhóm (danh mục gốc). Tổng = 1.
const ROOT_SHARE = {
  // Thiết bị — 40%
  'cat-phone': 0.10, 'cat-laptop': 0.10, 'cat-tablet': 0.10, 'cat-watch': 0.10,
  // Phụ kiện, nghe nhìn, camera — 60%
  'cat-mobile-acc': 0.15, 'cat-laptop-acc': 0.15, 'cat-av': 0.15, 'cat-camera': 0.15,
};
// Không hãng nào quá 10% catalog. Không có số liệu thị phần để làm trọng số,
// nên trong một danh mục các hãng được chia ĐỀU — trần này chặn trường hợp một
// danh mục chỉ có một hãng kéo hãng đó lên quá cao.
const BRAND_CAP_SHARE = 0.10;

const CAT_NAMES = {
  'cat-phone':'Điện thoại','cat-laptop':'Laptop','cat-tablet':'Tablet','cat-watch':'Smartwatch',
  'cat-mobile-acc-powerbank':'Sạc dự phòng','cat-mobile-acc-charger':'Sạc, cáp',
  'cat-mobile-acc-case-phone':'Ốp lưng điện thoại','cat-mobile-acc-case-tablet':'Ốp lưng máy tính bảng',
  'cat-mobile-acc-screen':'Miếng dán','cat-mobile-acc-cam-cover':'Miếng dán Camera',
  'cat-mobile-acc-airpods-case':'Túi đựng AirPods','cat-mobile-acc-fan':'Quạt mini',
  'cat-mobile-acc-pen':'Bút tablet','cat-mobile-acc-stand':'Giá đỡ điện thoại/laptop',
  'cat-mobile-acc-strap':'Dây đeo điện thoại','cat-mobile-acc-lens':'Ống kính điện thoại',
  'cat-laptop-acc-hub':'Hub, cáp chuyển đổi','cat-laptop-acc-mouse':'Chuột máy tính',
  'cat-laptop-acc-keyboard':'Bàn phím','cat-laptop-acc-router':'Router & Thiết bị mạng',
  'cat-laptop-acc-bag':'Balo, túi chống sốc','cat-laptop-acc-pouch':'Túi đựng phụ kiện',
  'cat-laptop-acc-keyboard-cover':'Phủ phím laptop','cat-laptop-acc-software':'Phần mềm',
  'cat-laptop-acc-monitor-stand':'Giá treo màn hình','cat-laptop-acc-mousepad':'Miếng lót chuột',
  'cat-laptop-acc-drawing':'Bảng vẽ điện tử',
  'cat-av-bt-earphone':'Tai nghe Bluetooth','cat-av-wire-earphone':'Tai nghe dây',
  'cat-av-headphone':'Tai nghe chụp tai','cat-av-sport-earphone':'Tai nghe thể thao',
  'cat-av-speaker':'Loa','cat-av-mic':'Micro','cat-av-projector':'Máy chiếu',
  'cat-av-smartglass':'Kính thông minh','cat-av-hdd':'Ổ cứng',
  'cat-av-sdcard':'Thẻ nhớ','cat-av-usb':'USB',
  'cat-cam-security':'Camera Giám Sát','cat-cam-indoor':'Camera trong nhà',
  'cat-cam-outdoor':'Camera ngoài trời','cat-cam-solar':'Camera Năng Lượng Mặt Trời',
  'cat-cam-4g':'Camera 4G','cat-cam-doorbell':'Chuông cửa Camera','cat-cam-webcam':'Webcam',
};

// ── Khoảng giá niêm yết theo danh mục (đồng) ─────────────────────
// ƯỚC LƯỢNG cho dữ liệu tổng hợp theo mặt bằng giá bán lẻ điện máy ở VN,
// KHÔNG phải số liệu thị trường có nguồn. Mục đích duy nhất: giá tương quan với
// loại hàng như ngoài đời, để đặc trưng "tầm giá" mang thông tin.
const PRICE_RANGE = {
  'cat-phone':  [1_500_000, 45_000_000],
  'cat-laptop': [8_000_000, 60_000_000],
  'cat-tablet': [3_000_000, 40_000_000],
  'cat-watch':  [  800_000, 25_000_000],

  'cat-mobile-acc-powerbank':    [200_000, 2_000_000],
  'cat-mobile-acc-charger':      [ 80_000, 1_500_000],
  'cat-mobile-acc-case-phone':   [ 50_000, 1_200_000],
  'cat-mobile-acc-case-tablet':  [150_000, 2_000_000],
  'cat-mobile-acc-screen':       [ 50_000,   600_000],
  'cat-mobile-acc-cam-cover':    [ 50_000,   400_000],
  'cat-mobile-acc-airpods-case': [ 80_000,   800_000],
  'cat-mobile-acc-fan':          [100_000,   600_000],
  'cat-mobile-acc-pen':          [200_000, 3_500_000],
  'cat-mobile-acc-stand':        [ 80_000, 1_000_000],
  'cat-mobile-acc-strap':        [ 50_000,   500_000],
  'cat-mobile-acc-lens':         [150_000, 2_000_000],

  'cat-laptop-acc-hub':            [150_000,  3_000_000],
  'cat-laptop-acc-mouse':          [100_000,  3_000_000],
  'cat-laptop-acc-keyboard':       [200_000,  5_000_000],
  'cat-laptop-acc-router':         [300_000,  8_000_000],
  'cat-laptop-acc-bag':            [200_000,  3_000_000],
  'cat-laptop-acc-pouch':          [100_000,    800_000],
  'cat-laptop-acc-keyboard-cover': [ 50_000,    400_000],
  'cat-laptop-acc-software':       [500_000,  5_000_000],
  'cat-laptop-acc-monitor-stand':  [300_000,  3_000_000],
  'cat-laptop-acc-mousepad':       [ 50_000,  1_500_000],
  'cat-laptop-acc-drawing':        [800_000, 15_000_000],

  'cat-av-bt-earphone':    [  200_000,  8_000_000],
  'cat-av-wire-earphone':  [   50_000,  3_000_000],
  'cat-av-headphone':      [  400_000, 12_000_000],
  'cat-av-sport-earphone': [  300_000,  5_000_000],
  'cat-av-speaker':        [  300_000, 15_000_000],
  'cat-av-mic':            [  200_000,  8_000_000],
  'cat-av-projector':      [2_000_000, 40_000_000],
  'cat-av-smartglass':     [1_000_000, 15_000_000],
  'cat-av-hdd':            [  800_000,  8_000_000],
  'cat-av-sdcard':         [  100_000,  2_000_000],
  'cat-av-usb':            [   80_000,  1_500_000],

  'cat-cam-security': [  500_000, 6_000_000],
  'cat-cam-indoor':   [  300_000, 3_000_000],
  'cat-cam-outdoor':  [  500_000, 5_000_000],
  'cat-cam-solar':    [1_000_000, 6_000_000],
  'cat-cam-4g':       [1_000_000, 6_000_000],
  'cat-cam-doorbell': [  500_000, 5_000_000],
  'cat-cam-webcam':   [  300_000, 5_000_000],
};

// Chỉ các loại hàng này mới có biến thể dung lượng — ốp lưng "1TB" là vô nghĩa.
const STORAGE_CATS = new Set(['cat-phone','cat-laptop','cat-tablet','cat-av-hdd','cat-av-sdcard','cat-av-usb']);

// ── Brand → valid categories mapping ─────────────────────────────
// Bổ sung 29/09: 17 danh mục lá có dưới 3 hãng, 9 danh mục không hãng nào ->
// bản cũ dồn hết cho hãng không map. Chỉ thêm hãng CÓ THẬT làm mặt hàng đó và
// ĐÃ CÓ trong bảng Brand (không tạo hãng mới). br-cam-webcam không tồn tại
// trong bảng Brand nên bỏ; webcam chuyển cho Logitech/Microsoft/Razer/Dahua.
const BRAND_CAT_MAP = {
  'br-apple':    ['cat-phone','cat-laptop','cat-tablet','cat-watch',
                  'cat-mobile-acc-charger','cat-mobile-acc-case-phone','cat-mobile-acc-airpods-case',
                  'cat-mobile-acc-pen'],
  'br-samsung':  ['cat-phone','cat-tablet','cat-watch',
                  'cat-mobile-acc-case-phone','cat-av-bt-earphone','cat-av-wire-earphone',
                  'cat-mobile-acc-pen','cat-av-projector'],
  'br-oppo':     ['cat-phone','cat-mobile-acc-charger','cat-mobile-acc-case-phone'],
  'br-xiaomi':   ['cat-phone','cat-tablet','cat-watch','cat-mobile-acc-powerbank',
                  'cat-mobile-acc-charger','cat-cam-indoor','cat-av-bt-earphone',
                  'cat-mobile-acc-fan','cat-mobile-acc-pen','cat-av-projector','cat-av-smartglass',
                  'cat-laptop-acc-drawing'],
  'br-vivo':     ['cat-phone','cat-mobile-acc-charger'],
  'br-realme':   ['cat-phone','cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-nokia':    ['cat-phone'],
  'br-masstel':  ['cat-phone','cat-laptop','cat-tablet'],
  'br-mobell':   ['cat-phone'],
  'br-tecno':    ['cat-phone'],
  'br-infinix':  ['cat-phone','cat-laptop'],
  'br-itel':     ['cat-phone'],
  'br-honor':    ['cat-phone','cat-tablet','cat-watch'],
  'br-motorola': ['cat-phone'],
  'br-asus':     ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-router',
                  'cat-av-projector','cat-laptop-acc-bag'],
  'br-hp':       ['cat-laptop','cat-laptop-acc-mouse','cat-laptop-acc-keyboard','cat-laptop-acc-bag'],
  'br-lenovo':   ['cat-laptop','cat-tablet','cat-laptop-acc-keyboard',
                  'cat-mobile-acc-pen','cat-laptop-acc-bag'],
  'br-acer':     ['cat-laptop'],
  'br-dell':     ['cat-laptop','cat-laptop-acc-mouse','cat-laptop-acc-monitor-stand','cat-laptop-acc-bag'],
  'br-msi':      ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mousepad'],
  'br-lg':       ['cat-laptop','cat-av-projector'],
  'br-microsoft':['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse',
                  'cat-laptop-acc-software','cat-cam-webcam','cat-mobile-acc-pen'],
  'br-gigabyte': ['cat-laptop'],
  'br-razer':    ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad',
                  'cat-cam-webcam','cat-av-smartglass','cat-laptop-acc-bag'],
  'br-garmin':   ['cat-watch'],
  'br-huawei':   ['cat-watch','cat-mobile-acc-charger','cat-av-smartglass'],
  'br-amazfit':  ['cat-watch'],
  'br-befit':    ['cat-watch'],
  'br-fitbit':   ['cat-watch'],
  'br-polar':    ['cat-watch'],
  'br-anker':    ['cat-mobile-acc-powerbank','cat-mobile-acc-charger',
                  'cat-laptop-acc-hub','cat-laptop-acc-mouse'],
  'br-baseus':   ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-mobile-acc-screen',
                  'cat-laptop-acc-hub','cat-mobile-acc-case-phone',
                  'cat-mobile-acc-fan','cat-mobile-acc-pen','cat-mobile-acc-stand','cat-mobile-acc-strap',
                  'cat-mobile-acc-lens','cat-mobile-acc-cam-cover','cat-mobile-acc-airpods-case',
                  'cat-laptop-acc-pouch','cat-laptop-acc-monitor-stand'],
  'br-energizer':['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-ugreen':   ['cat-mobile-acc-charger','cat-laptop-acc-hub',
                  'cat-laptop-acc-mouse','cat-laptop-acc-keyboard',
                  'cat-mobile-acc-stand','cat-laptop-acc-pouch','cat-laptop-acc-monitor-stand'],
  'br-romoss':   ['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-aukey':    ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-laptop-acc-hub'],
  'br-ravpower': ['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-belkin':   ['cat-mobile-acc-charger','cat-laptop-acc-hub','cat-mobile-acc-case-phone',
                  'cat-mobile-acc-stand'],
  'br-xmobile':  ['cat-mobile-acc-charger','cat-mobile-acc-powerbank',
                  'cat-mobile-acc-lens','cat-mobile-acc-strap','cat-laptop-acc-keyboard-cover',
                  'cat-laptop-acc-drawing'],
  'br-pisen':    ['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-spigen':   ['cat-mobile-acc-case-phone','cat-mobile-acc-case-tablet',
                  'cat-mobile-acc-screen','cat-laptop-acc-pouch',
                  'cat-mobile-acc-airpods-case','cat-mobile-acc-strap'],
  'br-esr':      ['cat-mobile-acc-case-phone','cat-mobile-acc-case-tablet','cat-mobile-acc-screen',
                  'cat-mobile-acc-airpods-case','cat-mobile-acc-cam-cover','cat-mobile-acc-pen',
                  'cat-mobile-acc-strap'],
  'br-hydragel': ['cat-mobile-acc-screen','cat-mobile-acc-cam-cover'],
  'br-capdase':  ['cat-mobile-acc-case-phone','cat-laptop-acc-bag'],
  'br-memumi':   ['cat-mobile-acc-case-phone','cat-mobile-acc-case-tablet'],
  'br-zagg':     ['cat-mobile-acc-screen','cat-mobile-acc-case-phone','cat-laptop-acc-keyboard-cover'],
  'br-nillkin':  ['cat-mobile-acc-case-phone','cat-mobile-acc-screen',
                  'cat-mobile-acc-airpods-case','cat-mobile-acc-cam-cover'],
  'br-rock':     ['cat-mobile-acc-case-phone','cat-mobile-acc-charger',
                  'cat-mobile-acc-fan','cat-mobile-acc-stand','cat-mobile-acc-lens'],
  'br-jbl':      ['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-sport-earphone','cat-av-speaker'],
  'br-sony-audio':['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-headphone','cat-av-speaker'],
  'br-bose':     ['cat-av-headphone','cat-av-speaker','cat-av-bt-earphone','cat-av-smartglass'],
  'br-sennheiser':['cat-av-headphone','cat-av-wire-earphone','cat-av-mic'],
  'br-jabra':    ['cat-av-bt-earphone','cat-av-headphone'],
  'br-edifier':  ['cat-av-speaker','cat-av-headphone'],
  'br-1more':    ['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-sport-earphone'],
  'br-skullcandy':['cat-av-bt-earphone','cat-av-sport-earphone','cat-av-headphone'],
  'br-beats':    ['cat-av-bt-earphone','cat-av-headphone','cat-av-sport-earphone'],
  'br-shure':    ['cat-av-mic','cat-av-headphone','cat-av-wire-earphone'],
  'br-audio-technica':['cat-av-headphone','cat-av-wire-earphone','cat-av-mic'],
  'br-plantronics':['cat-av-headphone','cat-av-bt-earphone'],
  'br-logitech': ['cat-laptop-acc-mouse','cat-laptop-acc-keyboard',
                  'cat-laptop-acc-mousepad','cat-av-speaker',
                  'cat-cam-webcam','cat-mobile-acc-pen'],
  'br-marshall': ['cat-av-speaker','cat-av-headphone'],
  'br-harman':   ['cat-av-speaker','cat-av-bt-earphone'],
  'br-hikvision':['cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-4g','cat-cam-solar'],
  'br-dahua':    ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-4g',
                  'cat-cam-solar','cat-cam-webcam'],
  'br-kbone':    ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor'],
  'br-kamera':   ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor'],
  'br-reolink':  ['cat-cam-indoor','cat-cam-outdoor','cat-cam-solar'],
  'br-imou':     ['cat-cam-indoor','cat-cam-outdoor','cat-cam-doorbell','cat-cam-solar'],
  'br-ezviz':    ['cat-cam-indoor','cat-cam-outdoor','cat-cam-doorbell','cat-cam-security','cat-cam-solar'],
  'br-tp-link':  ['cat-cam-indoor','cat-laptop-acc-router','cat-cam-doorbell'],
  'br-xiaomi-cam':['cat-cam-indoor','cat-cam-outdoor','cat-cam-security'],
  'br-vantech':  ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor'],
  'br-imilab':   ['cat-cam-indoor','cat-cam-outdoor'],
  'br-annke':    ['cat-cam-security','cat-cam-outdoor','cat-cam-4g'],
  'br-seagate':  ['cat-av-hdd'],
  'br-wd':       ['cat-av-hdd'],
  'br-samsung-st':['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-sandisk':  ['cat-av-sdcard','cat-av-usb'],
  'br-kingston': ['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-lexar':    ['cat-av-sdcard','cat-av-usb'],
  'br-transcend':['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-toshiba':  ['cat-av-hdd'],
  'br-pny':      ['cat-av-sdcard','cat-av-usb'],
  'br-tplink-net':['cat-laptop-acc-router'],
  'br-asus-net': ['cat-laptop-acc-router'],
  'br-linksys':  ['cat-laptop-acc-router'],
  'br-dlink':    ['cat-laptop-acc-router'],
  'br-netgear':  ['cat-laptop-acc-router'],
  'br-totolink': ['cat-laptop-acc-router'],
  'br-mercusys': ['cat-laptop-acc-router'],
};

// ── Color / Storage / Adjectives ────────────────────────────────
const COLORS    = ['Black','White','Silver','Gold','Blue','Red','Green','Purple','Rose Gold','Gray','Midnight','Starlight'];
const STORAGES  = ['64GB','128GB','256GB','512GB','1TB','2TB'];
const ADJECTIVES= ['Pro','Max','Ultra','Plus','Lite','Air','Neo','Edge','Prime','Elite','SE','X','Z','S'];
const BRANCHES  = ['HCM001','HCM002','HN001'];
const PICSUM    = Array.from({ length: 50 }, (_, i) => (i * 20) % 1000);

const BRAND_NAMES = {
  'br-apple':'Apple','br-samsung':'Samsung','br-oppo':'OPPO','br-xiaomi':'Xiaomi',
  'br-vivo':'vivo','br-realme':'realme','br-nokia':'Nokia/HMD','br-masstel':'Masstel',
  'br-mobell':'Mobell','br-tecno':'TECNO','br-infinix':'Infinix','br-itel':'itel',
  'br-honor':'HONOR','br-motorola':'Motorola','br-asus':'Asus','br-hp':'HP',
  'br-lenovo':'Lenovo','br-acer':'Acer','br-dell':'Dell','br-msi':'MSI',
  'br-lg':'LG','br-microsoft':'Microsoft','br-gigabyte':'Gigabyte','br-razer':'Razer',
  'br-garmin':'Garmin','br-huawei':'Huawei','br-amazfit':'Amazfit','br-befit':'BeFit',
  'br-fitbit':'Fitbit','br-polar':'Polar','br-anker':'Anker','br-baseus':'Baseus',
  'br-energizer':'Energizer','br-ugreen':'Ugreen','br-romoss':'Romoss',
  'br-aukey':'Aukey','br-ravpower':'RAVPower','br-belkin':'Belkin',
  'br-xmobile':'Xmobile','br-pisen':'Pisen','br-spigen':'Spigen','br-esr':'ESR',
  'br-hydragel':'Hydragel','br-capdase':'Capdase','br-memumi':'Mẹ Muội',
  'br-zagg':'ZAGG','br-nillkin':'Nillkin','br-rock':'ROCK','br-jbl':'JBL',
  'br-sony-audio':'Sony','br-bose':'Bose','br-sennheiser':'Sennheiser',
  'br-jabra':'Jabra','br-edifier':'Edifier','br-1more':'1MORE',
  'br-skullcandy':'Skullcandy','br-beats':'Beats','br-shure':'Shure',
  'br-audio-technica':'Audio-Technica','br-plantronics':'Plantronics',
  'br-logitech':'Logitech','br-marshall':'Marshall','br-harman':'Harman Kardon',
  'br-hikvision':'Hikvision','br-dahua':'Dahua','br-kbone':'KBvision',
  'br-reolink':'Reolink','br-imou':'Imou','br-ezviz':'EZVIZ',
  'br-tp-link':'TP-Link','br-xiaomi-cam':'Xiaomi Camera','br-vantech':'Vantech',
  'br-imilab':'IMILAB','br-annke':'ANNKE','br-seagate':'Seagate',
  'br-wd':'Western Digital','br-samsung-st':'Samsung','br-sandisk':'SanDisk',
  'br-kingston':'Kingston','br-lexar':'Lexar','br-transcend':'Transcend',
  'br-toshiba':'Toshiba','br-pny':'PNY','br-tplink-net':'TP-Link',
  'br-asus-net':'Asus','br-linksys':'Linksys','br-dlink':'D-Link',
  'br-netgear':'Netgear','br-totolink':'TOTOLINK','br-mercusys':'Mercusys',
};

// ── Helpers ──────────────────────────────────────────────────────
// Dòng ngẫu nhiên có hạt giống cố định: cùng SEED_RANDOM_SEED và cùng trạng
// thái DB ban đầu thì mọi máy sinh ra đúng cùng một bộ sản phẩm. Xem scripts/lib/rng.js.
// Vì vậy mọi vòng lặp dưới đây duyệt theo thứ tự ĐÃ SẮP XẾP, không theo thứ tự
// DB trả về (Postgres không cam kết thứ tự khi không có ORDER BY).
const { createRng, shuffle } = require('./lib/rng');
const rng = createRng('fill-600k');

const rand    = (a, b) => rng() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick    = (arr)  => arr[randInt(0, arr.length - 1)];

let _globalIdx = 0; // hậu tố để tên sản phẩm unique — khởi tạo trong main()

// Tên hãng đọc từ bảng Brand, nạp một lần trong main(). Dùng làm dự phòng khi
// BRAND_NAMES (viết tay) thiếu một hãng.
//
// Trước đây dự phòng là CHÍNH MÃ HÃNG: `BRAND_NAMES[id] || id`. BRAND_NAMES thiếu
// 'br-kamera', nên 248.044 sản phẩm mang tên kiểu "br-kamera Loa Pro - 462311"
// — mã kỹ thuật lộ thẳng ra tên hiển thị trên cửa hàng. Hãng thì gắn đúng, chỉ
// có tên là sai, nên lỗi không làm hỏng dữ liệu mà chỉ làm xấu giao diện.
let DB_BRAND_NAMES = {};

function makeProduct(catId, brandId) {
  _globalIdx++;
  const idx       = _globalIdx;
  const catName   = CAT_NAMES[catId] || 'Sản phẩm';
  // Thứ tự: tên viết tay -> tên trong DB -> mới đến mã. Mã chỉ còn là đường
  // cùng khi hãng không tồn tại, và lúc đó tên sai là tín hiệu đúng để phát hiện.
  const brandName = BRAND_NAMES[brandId] || DB_BRAND_NAMES[brandId] || brandId;
  const adj       = pick(ADJECTIVES);
  // Tên loại hàng để nguyên: bản cũ lấy từ đầu (`split(' ')[0]`) nên ra
  // "Samsung Điện Pro", "JBL Tai Max", "Spigen Ốp Lite".
  const name      = `${brandName} ${catName} ${adj} - ${idx}`;

  // Log-uniform trong khoảng của danh mục: khoảng giá trải hàng chục lần (ốp
  // lưng 50 nghìn – 1,2 triệu), rải đều thì gần như mọi sản phẩm dồn về đầu
  // đắt; log-uniform chia đều theo BẬC giá (mỗi lần gấp đôi giá có cùng tỉ lệ).
  const [lo, hi]      = PRICE_RANGE[catId];
  const originalPrice = Math.round(Math.exp(rand(Math.log(lo), Math.log(hi))) / 1000) * 1000;
  const discountPct   = rand(0.02, 0.35);
  // Tiền là Int, đơn vị ĐỒNG. Công thức cũ `Math.round(x * 100) / 100` là tàn
  // dư từ thời cột tiền còn là Float — nó trả về số có 2 chữ số thập phân.
  // Product.price được Prisma ép về Int nên nhìn vẫn nguyên, nhưng giá trong
  // variants (JSON) giữ nguyên phần lẻ, và mọi phép so sánh số tiền sau đó lệch.
  // Làm tròn nghìn cho khớp cách niêm yết giá thực tế.
  const price         = Math.round(originalPrice * (1 - discountPct) / 1000) * 1000;

  const pId  = PICSUM[idx % PICSUM.length];
  const pId2 = PICSUM[(idx + 7) % PICSUM.length];
  const image  = `https://picsum.photos/id/${pId}/400/400`;
  const images = [image, `https://picsum.photos/id/${pId2}/400/400`];

  // ── Biến thể ──────────────────────────────────────────────────────────
  // Mỗi biến thể PHẢI có id, price, stock — không chỉ nhãn màu/dung lượng.
  //
  //   id    : khoá client gửi lên khi đặt hàng, và khoá của bảng Inventory.
  //           Thiếu id thì không tách được tồn kho theo biến thể, và client
  //           không có gì để chỉ ra khách đang chọn phiên bản nào.
  //   stock : tồn của RIÊNG biến thể đó. Thiếu thì màu đã hết vẫn bán được,
  //           vì hệ thống chỉ thấy tổng tồn của cả sản phẩm.
  //   price : biến thể dung lượng cao hơn thì đắt hơn — nếu dùng chung một
  //           giá thì khách chọn bản đắt vẫn trả giá gốc.
  //
  // Tổng stock các biến thể = stock của sản phẩm, để hai con số không mâu thuẫn.
  const productStock = randInt(0, 999);
  const numColors  = randInt(1, 3);
  const usedColors = new Set();
  const rawVariants = [];
  while (rawVariants.length < numColors) {
    const c = pick(COLORS);
    if (!usedColors.has(c)) {
      usedColors.add(c);
      rawVariants.push(STORAGE_CATS.has(catId) && rng() > 0.5 ? { color: c, storage: pick(STORAGES) } : { color: c });
    }
  }

  // Chia stock của sản phẩm cho các biến thể; phần dư dồn vào biến thể cuối
  const perVariant = Math.floor(productStock / rawVariants.length);
  const variants = rawVariants.map((v, i) => {
    // Dung lượng lớn hơn thì đắt hơn — cùng vị trí trong STORAGES thì cùng giá
    const storageIdx = v.storage ? STORAGES.indexOf(v.storage) : 0;
    const bump = storageIdx > 0 ? Math.round(price * 0.08 * storageIdx) : 0;
    return {
      // id ổn định trong phạm vi một sản phẩm, không phụ thuộc thứ tự mảng
      id: `v${i + 1}`,
      color: v.color,
      ...(v.storage ? { storage: v.storage } : {}),
      price: price + bump,
      stock: i === rawVariants.length - 1
        ? productStock - perVariant * (rawVariants.length - 1)
        : perVariant,
    };
  });

  const numBranches = randInt(1, BRANCHES.length);
  // Fisher-Yates thay cho sort(() => Math.random() - 0.5): cách cũ vừa lệch
  // phân bố vừa đưa hàm so sánh không nhất quán vào sort (kết quả không xác định).
  const branchIds   = shuffle(BRANCHES, rng).slice(0, numBranches);

  return {
    name, price,
    original_price: originalPrice,
    category_id:    catId,
    brand_id:       brandId,
    stock:          productStock,
    rating:         Math.round(rand(3.5, 5.0) * 100) / 100,
    sold:           randInt(0, 999),
    image, images,
    description: `${brandName} ${catName} ${adj} — Sản phẩm chính hãng, chất lượng cao, bảo hành đầy đủ.`,
    variants:    variants,
    branch_ids:  branchIds,
    is_banner:   false,
    is_deleted:  false,
  };
}

async function insertBatch(rows) {
  await prisma.product.createMany({ data: rows, skipDuplicates: false });
}

function printBar(done, total, startMs, label) {
  const pct     = Math.min(done / total, 1);
  const filled  = Math.round(pct * 35);
  const bar     = '█'.repeat(filled) + '░'.repeat(35 - filled);
  const elapsed = (Date.now() - startMs) / 1000;
  const rps     = done / Math.max(elapsed, 1);
  const eta     = rps > 0 ? Math.ceil((total - done) / rps) : 0;
  const etaStr  = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
  process.stdout.write(
    `\r  [${bar}] ${(pct*100).toFixed(1)}%  ${done.toLocaleString()}/${total.toLocaleString()}` +
    `  ${Math.round(rps).toLocaleString()}/s  ETA:${etaStr}  ${label}      `
  );
}

const pct = (n, total) => `${(100 * n / total).toFixed(1)}%`;

// In phân bố theo nhóm và các hãng lớn nhất — dùng cho cả kế hoạch lẫn kết quả.
function printDistribution(title, rootCount, brandCount, total) {
  console.log(`\n  ${title}`);
  for (const root of Object.keys(ROOT_SHARE).sort()) {
    const n = rootCount[root] || 0;
    console.log(`    ${root.padEnd(16)} ${String(n.toLocaleString()).padStart(9)}  ${pct(n, total).padStart(6)}  (mục tiêu ${pct(ROOT_SHARE[root], 1)})`);
  }
  const top = Object.entries(brandCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  console.log(`    Hãng lớn nhất: ${top.map(([b, n]) => `${b} ${pct(n, total)}`).join(', ')}`);
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 FILL ${TARGET.toLocaleString()} PRODUCTS — cân theo nhóm, trần ${pct(BRAND_CAP_SHARE, 1)} mỗi hãng${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('═'.repeat(65));

  // 1. Đọc brand, category và phân bố hiện có
  const [brands, categories, currentTotal, catRows, brandRows, seqRows] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, parent_id: true } }),
    prisma.product.count(),
    prisma.$queryRaw`SELECT category_id AS id, COUNT(*)::int AS cnt FROM "Product" GROUP BY category_id`,
    prisma.$queryRaw`SELECT brand_id AS id, COUNT(*)::int AS cnt FROM "Product" GROUP BY brand_id`,
    // Hậu tố tên bắt đầu sau giá trị cuối của sequence (không phải max(id)):
    // sau khi xoá bớt sản phẩm, max(id) lùi lại và hậu tố mới có thể trùng tên
    // sản phẩm cũ. Sequence thì không bao giờ lùi.
    prisma.$queryRaw`SELECT COALESCE(last_value, 0)::bigint AS last FROM pg_sequences WHERE sequencename = 'Product_id_seq'`,
  ]);
  DB_BRAND_NAMES = Object.fromEntries(brands.map(b => [b.id, b.name]));
  const dbBrandIds = new Set(brands.map(b => b.id));
  const catCount   = Object.fromEntries(catRows.map(r => [r.id, Number(r.cnt)]));
  const brandCount = Object.fromEntries(brandRows.map(r => [r.id, Number(r.cnt)]));

  // Danh mục lá = danh mục không có con. 4 nhóm thiết bị không có con nên
  // chính nhóm là lá — bản cũ lọc `parent_id not null` nên loại mất cả 4.
  const hasChild = new Set(categories.filter(c => c.parent_id).map(c => c.parent_id));
  const rootOf   = Object.fromEntries(categories.map(c => [c.id, c.parent_id || c.id]));
  const leaves   = categories.map(c => c.id)
    .filter(id => !hasChild.has(id) && ROOT_SHARE[rootOf[id]] !== undefined)
    .sort();

  // Thiếu cấu hình thì DỪNG, không lấy ngẫu nhiên thay: nhánh dự phòng "hãng
  // nào cũng được" chính là thứ đã sinh ra 41% br-kamera.
  const brandsOfLeaf = {};
  for (const leaf of leaves) {
    if (!PRICE_RANGE[leaf]) throw new Error(`Danh mục ${leaf} thiếu PRICE_RANGE`);
    brandsOfLeaf[leaf] = Object.keys(BRAND_CAT_MAP)
      .filter(b => dbBrandIds.has(b) && BRAND_CAT_MAP[b].includes(leaf))
      .sort();
    if (!brandsOfLeaf[leaf].length) throw new Error(`Danh mục ${leaf} không có hãng nào (BRAND_CAT_MAP ∩ bảng Brand)`);
  }
  for (const root of Object.keys(ROOT_SHARE)) {
    if (!leaves.some(l => rootOf[l] === root)) throw new Error(`Nhóm ${root} không có danh mục lá nào trong DB`);
  }
  const idle = [...dbBrandIds].filter(b => !leaves.some(l => brandsOfLeaf[l].includes(b))).sort();

  console.log(`  Brands trong DB   : ${dbBrandIds.size}${idle.length ? `  (không sinh thêm: ${idle.join(', ')})` : ''}`);
  console.log(`  Danh mục lá       : ${leaves.length}`);
  console.log(`  Sản phẩm hiện tại : ${currentTotal.toLocaleString()}`);
  console.log(`  Mục tiêu          : ${TARGET.toLocaleString()}`);

  const remaining = TARGET - currentTotal;
  if (remaining <= 0) {
    console.log(`\n✅ Đã đủ ${currentTotal.toLocaleString()} sản phẩm!`);
    return;
  }

  // 2. Hạn mức từng danh mục lá: tỉ trọng nhóm chia đều cho các lá trong nhóm,
  //    trừ đi số đã có sẵn.
  const leafNeed = {};
  for (const root of Object.keys(ROOT_SHARE).sort()) {
    const ls = leaves.filter(l => rootOf[l] === root);
    const rootTarget = Math.round(TARGET * ROOT_SHARE[root]);
    ls.forEach((l, i) => {
      const t = Math.floor(rootTarget / ls.length) + (i < rootTarget % ls.length ? 1 : 0);
      leafNeed[l] = Math.max(0, t - (catCount[l] || 0));
    });
  }
  // Làm tròn tỉ trọng, và sản phẩm có sẵn nằm ngoài các lá, làm tổng lệch vài
  // đơn vị so với `remaining` -> dồn chênh lệch theo vòng, lá cần nhiều trước.
  let diff = remaining - Object.values(leafNeed).reduce((s, n) => s + n, 0);
  const byNeed = [...leaves].sort((a, b) => leafNeed[b] - leafNeed[a] || a.localeCompare(b));
  for (let i = 0, guard = 0; diff !== 0; i = (i + 1) % byNeed.length) {
    if (++guard > 10 * (Math.abs(diff) + byNeed.length)) throw new Error('Không cân được tổng hạn mức');
    const l = byNeed[i];
    if (diff > 0) { leafNeed[l]++; diff--; }
    else if (leafNeed[l] > 0) { leafNeed[l]--; diff++; }
  }

  // 3. Chia hạn mức của lá cho các hãng, giữ trần BRAND_CAP_SHARE.
  const cap        = Math.floor(TARGET * BRAND_CAP_SHARE);
  const brandTotal = { ...brandCount };
  const jobs       = []; // [leaf, brand, count]
  for (const leaf of leaves) {
    // Phần dư chia cho các hãng đầu theo thứ tự đã xáo (tất định) — không hãng
    // nào luôn được ưu tiên chỉ vì đứng đầu bảng chữ cái.
    const order = shuffle(brandsOfLeaf[leaf], rng);
    const base  = Math.floor(leafNeed[leaf] / order.length);
    const extra = leafNeed[leaf] % order.length;
    const alloc = {};
    let overflow = 0;
    order.forEach((b, i) => {
      const want = base + (i < extra ? 1 : 0);
      const room = Math.max(0, cap - (brandTotal[b] || 0));
      alloc[b]   = Math.min(want, room);
      overflow  += want - alloc[b];
    });
    // Phần vượt trần dồn sang hãng khác cùng danh mục còn chỗ
    for (const b of order) {
      if (!overflow) break;
      const give = Math.min(overflow, Math.max(0, cap - (brandTotal[b] || 0) - alloc[b]));
      alloc[b] += give;
      overflow -= give;
    }
    if (overflow > 0) throw new Error(`Danh mục ${leaf}: mọi hãng đã chạm trần ${cap.toLocaleString()} — cần thêm hãng`);
    for (const b of order) {
      if (!alloc[b]) continue;
      jobs.push([leaf, b, alloc[b]]);
      brandTotal[b] = (brandTotal[b] || 0) + alloc[b];
    }
  }

  // Kế hoạch sau khi sinh (gồm cả sản phẩm có sẵn)
  const planRoot = {};
  for (const [id, n] of Object.entries(catCount)) planRoot[rootOf[id] || id] = (planRoot[rootOf[id] || id] || 0) + n;
  for (const [leaf, , n] of jobs) planRoot[rootOf[leaf]] = (planRoot[rootOf[leaf]] || 0) + n;
  printDistribution(`Kế hoạch (+${remaining.toLocaleString()} sản phẩm, ${jobs.length} cặp danh mục × hãng):`, planRoot, brandTotal, TARGET);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Không ghi gì vào DB.\n');
    return;
  }

  // 4. Trộn thứ tự sinh. Sinh tuần tự theo danh mục thì id tăng dần gom cả khối
  //    một loại hàng — trang "sản phẩm mới" chỉ toàn webcam.
  const plan = new Uint32Array(remaining);
  let k = 0;
  jobs.forEach(([, , n], j) => { for (let i = 0; i < n; i++) plan[k++] = j; });
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = plan[i]; plan[i] = plan[j]; plan[j] = t;
  }

  _globalIdx = Number(seqRows[0]?.last || 0);
  console.log('─'.repeat(65));
  const startMs = Date.now();
  for (let start = 0; start < plan.length; start += BATCH_SIZE) {
    const rows = [];
    for (let i = start; i < Math.min(start + BATCH_SIZE, plan.length); i++) {
      const [leaf, brand] = jobs[plan[i]];
      rows.push(makeProduct(leaf, brand));
    }
    await insertBatch(rows);
    printBar(start + rows.length, plan.length, startMs, 'insert');
  }

  // ── Final report ──────────────────────────────────────────────
  console.log('\n\n  🔍 Kiểm tra kết quả cuối...');
  const [finalTotal, finalCat, finalBrand] = await Promise.all([
    prisma.product.count(),
    prisma.$queryRaw`SELECT category_id AS id, COUNT(*)::int AS cnt FROM "Product" GROUP BY category_id`,
    prisma.$queryRaw`SELECT brand_id AS id, COUNT(*)::int AS cnt FROM "Product" GROUP BY brand_id`,
  ]);
  const finalRoot = {};
  for (const r of finalCat) finalRoot[rootOf[r.id] || r.id] = (finalRoot[rootOf[r.id] || r.id] || 0) + Number(r.cnt);
  const finalBrandMap = Object.fromEntries(finalBrand.map(r => [r.id, Number(r.cnt)]));
  const finalCatMap   = Object.fromEntries(finalCat.map(r => [r.id, Number(r.cnt)]));
  printDistribution('Phân bố thực tế:', finalRoot, finalBrandMap, finalTotal);

  const overCap     = Object.entries(finalBrandMap).filter(([, n]) => n > cap).map(([b]) => b);
  const brandsBelow = [...dbBrandIds].filter(b => !idle.includes(b) && (finalBrandMap[b] || 0) < MIN_PER_BRAND);
  const catsBelow   = leaves.filter(l => (finalCatMap[l] || 0) < MIN_PER_CAT);
  const elapsed     = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log(`\n  Tổng: ${finalTotal.toLocaleString()} | thêm ${remaining.toLocaleString()} trong ${elapsed}s`);
  console.log(`  Hãng vượt trần ${pct(BRAND_CAP_SHARE, 1)}: ${overCap.length ? overCap.join(', ') : 'không'}`);
  console.log(`  Hãng < ${MIN_PER_BRAND} sản phẩm: ${brandsBelow.length ? brandsBelow.join(', ') : 'không'}`);
  console.log(`  Danh mục < ${MIN_PER_CAT} sản phẩm: ${catsBelow.length ? catsBelow.join(', ') : 'không'}`);
  if (finalTotal !== TARGET || overCap.length) {
    throw new Error(`Kết quả không đạt: tổng ${finalTotal} (cần ${TARGET}), vượt trần: ${overCap.join(', ') || 'không'}`);
  }
  console.log('\n  ✅ Đạt mục tiêu phân bố.\n');
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
