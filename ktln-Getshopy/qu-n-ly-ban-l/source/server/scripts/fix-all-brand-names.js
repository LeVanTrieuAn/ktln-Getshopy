/**
 * fix-all-brand-names.js
 * ─────────────────────────────────────────────────────────────────
 * Fix triệt để: mọi sản phẩm phải có tên đúng brand của nó.
 * - Dùng template cụ thể nếu có
 * - Nếu không có template → tạo tên tự động từ brand + category
 *   (VD: "Hikvision Camera Giám Sát 2MP Full HD" — dù brand
 *    không liên quan đến category đó trên thực tế)
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ── Brand names ─────────────────────────────────────────────────
const BRAND_NAME = {
  'br-apple':'Apple','br-samsung':'Samsung','br-oppo':'OPPO','br-xiaomi':'Xiaomi',
  'br-vivo':'vivo','br-realme':'realme','br-nokia':'Nokia','br-masstel':'Masstel',
  'br-mobell':'Mobell','br-tecno':'TECNO','br-infinix':'Infinix','br-itel':'itel',
  'br-honor':'HONOR','br-motorola':'Motorola','br-asus':'Asus','br-hp':'HP',
  'br-lenovo':'Lenovo','br-acer':'Acer','br-dell':'Dell','br-msi':'MSI',
  'br-lg':'LG','br-microsoft':'Microsoft','br-gigabyte':'Gigabyte','br-razer':'Razer',
  'br-garmin':'Garmin','br-huawei':'Huawei','br-amazfit':'Amazfit','br-befit':'BeFit',
  'br-fitbit':'Fitbit','br-polar':'Polar',
  'br-anker':'Anker','br-baseus':'Baseus','br-energizer':'Energizer',
  'br-ugreen':'Ugreen','br-romoss':'Romoss','br-aukey':'Aukey',
  'br-ravpower':'RAVPower','br-belkin':'Belkin','br-xmobile':'Xmobile',
  'br-pisen':'Pisen','br-spigen':'Spigen','br-esr':'ESR',
  'br-hydragel':'Hydragel','br-capdase':'Capdase','br-memumi':'Memumi',
  'br-zagg':'ZAGG','br-nillkin':'Nillkin','br-rock':'Rock',
  'br-jbl':'JBL','br-sony-audio':'Sony','br-bose':'Bose',
  'br-sennheiser':'Sennheiser','br-jabra':'Jabra','br-edifier':'Edifier',
  'br-1more':'1MORE','br-skullcandy':'Skullcandy','br-beats':'Beats',
  'br-shure':'Shure','br-audio-technica':'Audio-Technica',
  'br-plantronics':'Plantronics','br-logitech':'Logitech',
  'br-marshall':'Marshall','br-harman':'Harman Kardon',
  'br-hikvision':'Hikvision','br-dahua':'Dahua','br-kbone':'KBvision',
  'br-reolink':'Reolink','br-imou':'Imou','br-ezviz':'EZVIZ',
  'br-tp-link':'TP-Link','br-xiaomi-cam':'Xiaomi','br-vantech':'Vantech',
  'br-imilab':'IMILAB','br-annke':'ANNKE',
  'br-seagate':'Seagate','br-wd':'WD','br-samsung-st':'Samsung',
  'br-sandisk':'SanDisk','br-kingston':'Kingston','br-lexar':'Lexar',
  'br-transcend':'Transcend','br-toshiba':'Toshiba','br-pny':'PNY',
  'br-tplink-net':'TP-Link','br-asus-net':'Asus','br-linksys':'Linksys',
  'br-dlink':'D-Link','br-netgear':'Netgear','br-totolink':'TOTOLINK',
  'br-mercusys':'Mercusys',
};

// ── Category product type labels ─────────────────────────────────
const CAT_TYPE = {
  'cat-phone': 'Điện thoại',
  'cat-laptop': 'Laptop',
  'cat-tablet': 'Máy tính bảng',
  'cat-watch': 'Đồng hồ thông minh',
  'cat-mobile-acc-powerbank': 'Pin sạc dự phòng',
  'cat-mobile-acc-charger': 'Củ sạc nhanh',
  'cat-mobile-acc-case-phone': 'Ốp lưng điện thoại',
  'cat-mobile-acc-case-tablet': 'Ốp lưng tablet',
  'cat-mobile-acc-screen': 'Miếng dán màn hình',
  'cat-mobile-acc-cam-cover': 'Dán camera điện thoại',
  'cat-mobile-acc-airpods-case': 'Túi đựng AirPods',
  'cat-mobile-acc-fan': 'Quạt tản nhiệt mini',
  'cat-mobile-acc-pen': 'Bút cảm ứng',
  'cat-mobile-acc-stand': 'Giá đỡ điện thoại',
  'cat-mobile-acc-strap': 'Dây đeo điện thoại',
  'cat-mobile-acc-lens': 'Ống kính điện thoại',
  'cat-laptop-acc-hub': 'Hub USB-C đa năng',
  'cat-laptop-acc-mouse': 'Chuột không dây',
  'cat-laptop-acc-keyboard': 'Bàn phím cơ không dây',
  'cat-laptop-acc-router': 'Router WiFi',
  'cat-laptop-acc-bag': 'Balo laptop chống sốc',
  'cat-laptop-acc-pouch': 'Túi chống sốc laptop',
  'cat-laptop-acc-keyboard-cover': 'Phủ phím laptop',
  'cat-laptop-acc-software': 'Phần mềm bản quyền',
  'cat-laptop-acc-monitor-stand': 'Giá treo màn hình',
  'cat-laptop-acc-mousepad': 'Miếng lót chuột gaming',
  'cat-laptop-acc-drawing': 'Bảng vẽ điện tử',
  'cat-av-bt-earphone': 'Tai nghe Bluetooth True Wireless',
  'cat-av-wire-earphone': 'Tai nghe có dây',
  'cat-av-headphone': 'Tai nghe chụp tai ANC',
  'cat-av-sport-earphone': 'Tai nghe thể thao chống nước',
  'cat-av-speaker': 'Loa Bluetooth',
  'cat-av-mic': 'Micro thu âm',
  'cat-av-projector': 'Máy chiếu',
  'cat-av-smartglass': 'Kính thông minh',
  'cat-av-hdd': 'Ổ cứng di động',
  'cat-av-sdcard': 'Thẻ nhớ microSD',
  'cat-av-usb': 'USB Flash Drive',
  'cat-cam-security': 'Camera giám sát IP',
  'cat-cam-indoor': 'Camera trong nhà WiFi',
  'cat-cam-outdoor': 'Camera ngoài trời',
  'cat-cam-solar': 'Camera năng lượng mặt trời',
  'cat-cam-4g': 'Camera 4G không dây',
  'cat-cam-doorbell': 'Chuông cửa camera',
  'cat-cam-webcam': 'Webcam HD',
};

// ── Spec suffixes per category ────────────────────────────────────
const CAT_SPECS = {
  'cat-phone':['5G 256GB Chính Hãng','5G 128GB Mới 2024','512GB Dual SIM','256GB Chống Nước','128GB Pin Khủng 5000mAh'],
  'cat-laptop':['i7 16GB 512GB SSD','Ryzen 7 16GB 512GB','i5 8GB 512GB SSD','Core Ultra 7 16GB 1TB','i9 32GB 1TB RTX4060'],
  'cat-tablet':['WiFi 128GB','5G 256GB','WiFi 64GB 4G LTE','WiFi 256GB Bút Cảm Ứng','4G 128GB Giải Trí'],
  'cat-watch':['46mm GPS Theo Dõi Sức Khỏe','44mm Chống Nước 5ATM','47mm AMOLED Đo SpO2','41mm Nhẹ Thể Thao','49mm Ultra Khám Phá'],
  'cat-mobile-acc-powerbank':['20000mAh 65W PD Fast Charge','10000mAh 22.5W Compact','30000mAh 100W Siêu Nhanh','15000mAh 45W Không Dây','25000mAh Màn Hình LED'],
  'cat-mobile-acc-charger':['20W USB-C PD Fast Charge','65W GaN 3 Cổng','45W Super Fast Charge','30W Wireless + Có Dây','100W GaN Pro 4 Cổng'],
  'cat-mobile-acc-case-phone':['Silicon Cao Cấp Chống Sốc','Carbon Fiber Siêu Mỏng','MagSafe Từ Tính','Leather Case Mịn Tay','Clear Case Trong Suốt Chống Ố Vàng'],
  'cat-mobile-acc-case-tablet':['Bao Da Thông Minh Auto Sleep','Khung Nhôm Chống Va Đập','Bàn Phím Bluetooth Tích Hợp','Mặt Lưng Trong Suốt','Vỏ Gập 360 Đứng Đỡ'],
  'cat-mobile-acc-screen':['Kính Cường Lực 9H Full Cover','Hydrogel Nano Chống Trầy','Matte Chống Bóng Chói','Anti Spy Privacy','3D Full Glue Chống Va Đập'],
  'cat-mobile-acc-cam-cover':['Dán Camera Chống Lóa','Kính Cường Lực Camera Lens','Bảo Vệ Camera Toàn Diện','Anti Scratch Lens Film','Tempered Glass Camera Cover'],
  'cat-mobile-acc-airpods-case':['Bao Silicon Chống Sốc','Case Da Cao Cấp','Ốp Cứng Trong Suốt','Leather Case Móc Khóa','Bảo Vệ Hộp Sạc ANC'],
  'cat-mobile-acc-fan':['Quạt Tản Nhiệt 7 Cánh Turbo','Quạt Mini Type-C Linh Hoạt','Tản Nhiệt Kẹp Lưng Gaming','Quạt USB-C Im Lặng','Tản Nhiệt Chơi Game 5000 RPM'],
  'cat-mobile-acc-pen':['Bút Cảm Ứng Thế Hệ 2','Stylus Active 4096 Cấp Áp Lực','Bút Vẽ Chuyên Nghiệp','Apple Pencil Compatible','Bút Từ Tính Sạc Không Dây'],
  'cat-mobile-acc-stand':['Giá Đỡ Điều Chỉnh Góc 360°','Đế Hít Từ Tính MagSafe','Giá Đỡ Gấp Gọn Siêu Mỏng','Stand Đa Năng Điện Thoại/Tablet','Giá Hít Kính Xe Hơi Xoay 360'],
  'cat-mobile-acc-strap':['Dây Đeo Chéo Vai Thể Thao','Dây Cổ Điện Thoại Chống Rơi','Lanyard Nhanh Chóng','Dây Đeo Tay Anti-Lost','Crossbody Strap Điều Chỉnh Được'],
  'cat-mobile-acc-lens':['Ống Kính Góc Rộng 0.45x','Ống Kính Macro 20x Cận Cảnh','Fisheye 198° Siêu Rộng','Telephoto 2x Zoom Quang Học','Bộ Lens 3 Trong 1 Pro'],
  'cat-laptop-acc-hub':['12-in-1 Thunderbolt 4 HDMI 4K 100W PD','9-in-1 USB-C HDMI PD 100W SD Card','7-in-1 4K HDMI Ethernet USB3.0','Dual Monitor Hub DP HDMI 4K','USB-C Docking 10Gbps SSD M.2'],
  'cat-laptop-acc-mouse':['Ergonomic 2400 DPI Bluetooth','Gaming 25600 DPI 5 Nút','Silent Wireless 3 Mode Kết Nối','Trackball Vertical Chống Mỏi Tay','Pro Wireless 7200 DPI Siêu Nhẹ'],
  'cat-laptop-acc-keyboard':['Cơ 87 Phím TKL Wireless Red Switch','Wireless Slim LED Backlighting','Mechanical Pro RGB Hot-swap','60% Compact Wireless Bluetooth','Full Size 108 Phím LED RGB Tenkeyless'],
  'cat-laptop-acc-router':['WiFi 6 AX3000 MU-MIMO Mesh','WiFi 6E AXE5400 Tri-Band','WiFi 7 BE9300 4x4 MIMO','Dual Band AC2100 Beamforming','Mesh WiFi System 3-Pack AX1800'],
  'cat-laptop-acc-bag':['Balo 15.6" Chống Thấm USB Sạc','Túi Xách 14" Chống Sốc Nhiều Ngăn','Balo Gaming 17" Thoáng Lưng','Briefcase 15" Da PU Chuyên Nghiệp','Backpack 16" Waterproof Khoá TSA'],
  'cat-laptop-acc-pouch':['Túi Chống Sốc Neoprene 15.6"','Bao Da Slim 14" Thoát Nhiệt','Sleeve 13" Nỉ Siêu Mỏng','Túi Kéo Vali 15.6" Tiện Lợi','Pouch 14" Vải Canvas Thời Trang'],
  'cat-laptop-acc-keyboard-cover':['Phủ Phím Silicon Siêu Mỏng','Cover Phím TPU In Ký Tự Rõ','Phủ Phím Chống Nước Nano','Skin Bàn Phím Dustproof','Phủ Phím Full Size Mờ Chống Dơ'],
  'cat-laptop-acc-software':['Bản Quyền 1 PC 1 Năm','License 3 Thiết Bị Vĩnh Viễn','Key Activation 5 PC Online','Enterprise 1 User Subscription','Lifetime Activation Digital Key'],
  'cat-laptop-acc-monitor-stand':['Giá Đỡ Màn Hình 17-32" Điều Chỉnh','Arm Màn Hình Kép VESA 75/100','Stand Màn Hình Nâng Hạ Xoay 360','Single Monitor Arm Gas Spring','Giá Đỡ Gấp Khúc Siêu Nhẹ'],
  'cat-laptop-acc-mousepad':['XXL 900x400mm Chống Trượt','Speed Edition 800x300mm Gaming','RGB LED Chống Nước XL','Natural Rubber 450x400mm Dày 4mm','Hard Surface Large 400x350mm'],
  'cat-laptop-acc-drawing':['Bảng Vẽ A5 8192 Cấp Áp Lực','Pen Display 15.6" 2K IPS','Drawing Tablet A4 Cảm Ứng Đa Điểm','Bảng Vẽ Không Dây Bluetooth','Pro Pen 2 Tilt Detection 60°'],
  'cat-av-bt-earphone':['True Wireless ANC 40dB Chống Ồn','TWS 30h Pin LDAC Hi-Res','Earbuds IPX5 ANC Spatial Audio','In-Ear ANC Adaptive EQ','Pro TWS Đa Điểm Kết Nối'],
  'cat-av-wire-earphone':['In-Ear Dynamic Hi-Res 3.5mm','Balanced Armature IEM Audiophile','Neckband 3-Button Remote Mic','Wired In-Ear 10mm Driver Bass Boost','Earphone 3.5mm + Type-C Adapter'],
  'cat-av-headphone':['Over-Ear ANC 40dB Hi-Res 30h','On-Ear Foldable ANC Bluetooth','Studio Monitor Open-Back 250Ω','Wireless ANC Multi-Point 35h','Gaming Headset 7.1 Surround RGB'],
  'cat-av-sport-earphone':['IPX7 Sport Hook Running ANC','Ear Hook True Wireless Thể Thao','Bone Conduction Open-Ear Swimming','Secure Fit In-Ear IPX5 Workout','Earhook Sport ANC 9h Pin Nhanh Sạc'],
  'cat-av-speaker':['Loa Bluetooth 360° IPX7 20W','Loa Di Động 40W Chống Nước','Loa 2.0 Bookshelf Hi-Fi 100W','Loa Karaoke Bluetooth Bass Sâu','Party Speaker 100W TWS LED RGB'],
  'cat-av-mic':['USB Condenser Cardioid Podcast','XLR Dynamic Vocal Broadcast','Wireless Clip-On Lavalier','Shotgun Camera Interview','USB Desktop Studio Recording'],
  'cat-av-projector':['4K UHD 3500 Lumens Laser','1080p Full HD 3LCD 4000AN','Mini Projector 700 Lumens WiFi','Home Cinema 4K HDR 60Hz HDMI','Smart Projector 2K Android 11'],
  'cat-av-smartglass':['AR Smart Glasses WiFi BT 5.0','Kính VR 4K 120Hz 6DOF','Smart Eyewear Assistant AI','Open-Ear Audio Glasses UV400','Mixed Reality Headset 6DoF'],
  'cat-av-hdd':['SSD Portable 2TB USB 3.2 Gen2','HDD External 4TB USB 3.0 5400RPM','NVMe M.2 2TB PCIe 4.0 7000MB/s','SSD SATA 2.5" 1TB 560MB/s','Portable SSD 1TB IP55 Chống Sốc'],
  'cat-av-sdcard':['microSDXC 256GB V30 A2 UHS-I U3','microSDXC 512GB 200MB/s A2 V30','SD Card 64GB Class 10 UHS-I U1','microSD 128GB 100MB/s A1 V10','Pro Plus 256GB 180MB/s R U3 A2'],
  'cat-av-usb':['USB 3.2 256GB 420MB/s Type-A','Dual Drive Go USB-C + USB-A 128GB','Ultra Fit USB 3.1 128GB Nano','USB 3.0 512GB 150MB/s Flip Cap','USB-C 256GB USB 3.2 Gen2 600MB/s'],
  'cat-cam-security':['Camera IP PoE 4MP Full Color AcuSense','Camera Dome 8MP H.265+ IR 30m','PTZ Camera 4MP Zoom Quang Học 4x','Turret Camera 2MP Hồng Ngoại','Camera AI 4MP 180° Panoramic'],
  'cat-cam-indoor':['Camera Trong Nhà 2K WiFi Xoay 360°','IP Camera 1080p Phát Hiện Chuyển Động','Pan Tilt 3MP Color Night Vision','Dome 4MP Two-Way Audio','Smart Indoor 2K Auto Tracking'],
  'cat-cam-outdoor':['Camera Ngoài Trời 4MP IP67 Color','Outdoor 2MP IR 60m H.265','Bullet 8MP PoE Varifocal Lens','Ngoài Trời 4K 8MP AcuSense','IP67 2K Starlight Color Night'],
  'cat-cam-solar':['Camera Solar 2K Không Dây 5000mAh','Solar Security 1080p PIR Motion','4MP Solar Camera 10000mAh 4G','Camera Pin Mặt Trời 2MP Wifi','Outdoor Solar 2K Color Night 6600mAh'],
  'cat-cam-4g':['Camera 4G LTE 2MP SIM Thẻ','4G IP Camera 1080p PIR Outdoor','Solar 4G Camera 2MP 10000mAh','4G LTE 3MP Starlight Color Night','Outdoor 4G 2K Full Color Sim'],
  'cat-cam-doorbell':['Video Doorbell WiFi 2K HD Chuông','Smart Doorbell 1080p Xem Điện Thoại','Wireless Doorbell Camera PIR 2-Way','Doorbell 4MP Color Night 180°','Video Door Phone 2MP IP65 WiFi'],
  'cat-cam-webcam':['Webcam 4K 30fps USB-C Autofocus','Full HD 1080p 60fps Streaming','Webcam 2K AI Noise Cancel Mic','Wide-Angle 1080p USB Plug&Play','Business Webcam 4K 30fps Teams'],
};

// ── Generic image pools per category ────────────────────────────
const CAT_IMAGES = {
  'cat-phone':['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bzvgxxv-thumb-543840420?$650_519_PNG$','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-black.png','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/reno12-pro-kv-banner.jpg'],
  'cat-laptop':['https://dlcdnwebimgs.asus.com/gain/6B89CBA5-45EB-4A1F-8779-3E1A487C2D59/w1000/h732','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/inspiron-notebooks/inspiron-15-3520/media-gallery/notebook-inspiron-15-3520-gallery-2.psd?fmt=pjpg&pscan=auto&scl=1&wid=800&hei=800&qlt=90','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c09061534.png'],
  'cat-tablet':['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-select-wifi-spacegray-13?wid=800&hei=800&fmt=jpeg&qlt=90','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzaaxxv-thumb-542071234?$650_519_PNG$','https://m.media-amazon.com/images/I/61aNcL2uqWL._AC_SL1500_.jpg'],
  'cat-watch':['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYE53ref_VW_34FR+watch-45-alum-jetblack-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzaaxxv-thumb-542013856?$650_519_PNG$','https://res.garmin.com/en/products/010-02803-00/v/cf-lg.jpg'],
  'cat-mobile-acc-powerbank':['https://m.media-amazon.com/images/I/61lMvqFsY-L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71xnKm-MMAL._AC_SL1500_.jpg'],
  'cat-mobile-acc-charger':['https://m.media-amazon.com/images/I/61pB3HIXNSL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MHJA3?wid=600&hei=600&fmt=jpeg&qlt=90'],
  'cat-mobile-acc-case-phone':['https://m.media-amazon.com/images/I/71OI6fmJN1L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61A+7rbnrfL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61ZGV9SHJNL._AC_SL1500_.jpg'],
  'cat-mobile-acc-case-tablet':['https://m.media-amazon.com/images/I/71lCrdY6gYL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71MHhFYzZ9L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/51Nt9m-XxnL._AC_SL1000_.jpg'],
  'cat-mobile-acc-screen':['https://m.media-amazon.com/images/I/61GGGa0dUNL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71sQXH2g9OL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71KopFhUFxL._AC_SL1500_.jpg'],
  'cat-mobile-acc-cam-cover':['https://m.media-amazon.com/images/I/71KopFhUFxL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/81g2sXBQnvL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61GGGa0dUNL._AC_SL1500_.jpg'],
  'cat-mobile-acc-airpods-case':['https://m.media-amazon.com/images/I/61fhLCDZRLL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71F3XzK1WJL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71UkO5J-K0L._AC_SL1500_.jpg'],
  'cat-mobile-acc-fan':['https://m.media-amazon.com/images/I/71mPFt8BWJL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61OXAp0Y25L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71wK5LNPKPL._AC_SL1500_.jpg'],
  'cat-mobile-acc-pen':['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQGQ3?wid=600&hei=600&fmt=jpeg&qlt=90','https://m.media-amazon.com/images/I/61GkUE7FWNL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71PEQdqQBPL._AC_SL1500_.jpg'],
  'cat-mobile-acc-stand':['https://m.media-amazon.com/images/I/61nkTbwKpQL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71VuaDhyBjL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61VxH-G84dL._AC_SL1500_.jpg'],
  'cat-mobile-acc-strap':['https://m.media-amazon.com/images/I/51JXFU-DJPL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71Y5u0z9pQL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71-B8rDFYGL._AC_SL1500_.jpg'],
  'cat-mobile-acc-lens':['https://m.media-amazon.com/images/I/71VGJnkLHSL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61OKRGvPYzL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71A+0mT6CQL._AC_SL1500_.jpg'],
  'cat-laptop-acc-hub':['https://m.media-amazon.com/images/I/71l5JQJuenL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71NjhqJEGFL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71mPY4HVLRL._AC_SL1500_.jpg'],
  'cat-laptop-acc-mouse':['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png','https://m.media-amazon.com/images/I/71fzQrGH9dL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61mpMH5TzkL._AC_SL1500_.jpg'],
  'cat-laptop-acc-keyboard':['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-top-view-graphite.png','https://m.media-amazon.com/images/I/71b8fQb-FXL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71XGNyZ5f2L._AC_SL1500_.jpg'],
  'cat-laptop-acc-router':['https://static.tp-link.com/upload/product-overview/2023/202305/20230504/Archer%20AX73_01.jpg','https://m.media-amazon.com/images/I/71L-FUi7BGL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71FEQ9QJRRL._AC_SL1500_.jpg'],
  'cat-laptop-acc-bag':['https://m.media-amazon.com/images/I/71PJc3BQDBL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71ELlnCG7fL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71wNX8EX0xL._AC_SL1500_.jpg'],
  'cat-laptop-acc-pouch':['https://m.media-amazon.com/images/I/71PJc3BQDBL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61Fji-CqhRL._AC_SL1000_.jpg','https://m.media-amazon.com/images/I/71q4ZFfGaZL._AC_SL1500_.jpg'],
  'cat-laptop-acc-keyboard-cover':['https://m.media-amazon.com/images/I/71BLVwFlAbL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71nPkG0v36L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71G7HBLuuKL._AC_SL1500_.jpg'],
  'cat-laptop-acc-software':['https://m.media-amazon.com/images/I/71W42O-oFQL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/81hDkDqoXiL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71qZ5HFYMKL._AC_SL1500_.jpg'],
  'cat-laptop-acc-monitor-stand':['https://m.media-amazon.com/images/I/61HHsGEMjTL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61cjQ0J4UyL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71C7NKQFJPL._AC_SL1500_.jpg'],
  'cat-laptop-acc-mousepad':['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mousepads/g840-xl-gaming-mouse-pad/g840-xl-gaming-mouse-pad-gallery-1.png','https://m.media-amazon.com/images/I/71mkjmtT5kL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61UjGb0cvCL._AC_SL1500_.jpg'],
  'cat-laptop-acc-drawing':['https://m.media-amazon.com/images/I/71G1lWQQWIL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71kSsBW9hVL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71xGN8bFhXL._AC_SL1500_.jpg'],
  'cat-av-bt-earphone':['https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-pro-2-select-202309?wid=700&hei=700&fmt=jpeg&qlt=90','https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9e51498a/JBL_TOURPRO2_PRODUCT%20IMAGE_HERO_34D_8055.png?sw=600&sh=600&sm=fit&sfrm=png'],
  'cat-av-wire-earphone':['https://m.media-amazon.com/images/I/61HmYADdamL._AC_SL1000_.jpg','https://m.media-amazon.com/images/I/71qSuZHfHOL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/81e7RvtyalL._AC_SL1500_.jpg'],
  'cat-av-headphone':['https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_B_Front_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha','https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCultraHP_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png','https://m.media-amazon.com/images/I/71bQW-lVdmL._AC_SL1500_.jpg'],
  'cat-av-sport-earphone':['https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_ENDURANCEPEAK3_PRODUCT_IMAGE_HERO_34D.png?sw=600&sh=600&sm=fit&sfrm=png','https://m.media-amazon.com/images/I/61V2piRTFtL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71kR-zOjYUL._AC_SL1500_.jpg'],
  'cat-av-speaker':['https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw65eaac1a/JBL_CHARGE5_HERO_BLACK_0046_x1.png?sw=600&sh=600&sm=fit&sfrm=png','https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/speakers/soundlink_flex_2/product_silo_images/SLFlex2_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png','https://m.media-amazon.com/images/I/61wy+lAirnL._AC_SL1200_.jpg'],
  'cat-av-mic':['https://m.media-amazon.com/images/I/61YzNZnP2IL._AC_SL1000_.jpg','https://m.media-amazon.com/images/I/61tKfpPTL1L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71sWcGcL4bL._AC_SL1500_.jpg'],
  'cat-av-projector':['https://m.media-amazon.com/images/I/71XZL-5xFCL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71QZ9-TTYQL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71NwGK6S2hL._AC_SL1500_.jpg'],
  'cat-av-smartglass':['https://m.media-amazon.com/images/I/51L-F-JhauL._AC_SL1000_.jpg','https://m.media-amazon.com/images/I/71U+1nOYCPL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61Xd6j7XCJL._AC_SL1500_.jpg'],
  'cat-av-hdd':['https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/expansion/portables/product-img/expansion-portable-2TB-back_900x900.png','https://m.media-amazon.com/images/I/61g2X-YWKIL._AC_SL1200_.jpg','https://images.samsung.com/is/image/samsung/p6pim/uk/mu-pc2t0k-am/gallery/uk-portable-ssd-t7-mu-pc2t0k-am-thumb-451940888?$650_519_PNG$'],
  'cat-av-sdcard':['https://m.media-amazon.com/images/I/714B3YVB9ML._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/714JtHFi4lL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71MCbNV0HML._AC_SL1500_.jpg'],
  'cat-av-usb':['https://m.media-amazon.com/images/I/714FHHlJuDL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61EjDO2KEEL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/81e7RvtyalL._AC_SL1500_.jpg'],
  'cat-cam-security':['https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/8-MP-AcuSense.jpg','https://m.media-amazon.com/images/I/61BvdJ+KWKL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71KLLY7-JpL._AC_SL1500_.jpg'],
  'cat-cam-indoor':['https://www.imoulife.com/imagex/imagefiles/imou/20230413/9_cce50c38-0b40-44e2-8e6c-61d0d13bd9e0.jpg','https://static.tp-link.com/upload/product-overview/2024/202402/20240228/Tapo%20C225_01.jpg','https://m.media-amazon.com/images/I/71aDrfhO6BL._AC_SL1500_.jpg'],
  'cat-cam-outdoor':['https://m.media-amazon.com/images/I/71C+YLizTFL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71KLLY7-JpL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/81tkPQ4KEFL._AC_SL1500_.jpg'],
  'cat-cam-solar':['https://m.media-amazon.com/images/I/71FAlB3NIOL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71mSEOEFHQL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71a2S0BqeqL._AC_SL1500_.jpg'],
  'cat-cam-4g':['https://m.media-amazon.com/images/I/61BvdJ+KWKL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71KLLY7-JpL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71C+YLizTFL._AC_SL1500_.jpg'],
  'cat-cam-doorbell':['https://m.media-amazon.com/images/I/61m1+VSHJ5L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71rfKVbLc4L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71K9FmMBomL._AC_SL1500_.jpg'],
  'cat-cam-webcam':['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-500/gallery/brio-500-webcam-front-view-graphite.png','https://m.media-amazon.com/images/I/61Y1tBVS9PL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71qr1vBPxXL._AC_SL1500_.jpg'],
};

const DEFAULT_IMGS = ['https://m.media-amazon.com/images/I/61lMvqFsY-L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71xnKm-MMAL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

function generateTemplate(catId, brandId) {
  const brand = BRAND_NAME[brandId] || brandId;
  const type  = CAT_TYPE[catId]    || 'Sản phẩm';
  const specs = CAT_SPECS[catId]   || ['Chính Hãng','Bảo Hành 12 Tháng','Mới 100%','Cao Cấp','Chất Lượng'];
  const imgs  = CAT_IMAGES[catId]  || DEFAULT_IMGS;
  const name  = `${brand} ${type} ${rand(specs)}`;
  const price = 500000 + Math.floor(Math.random() * 29500000);
  return { name, price, orig: Math.floor(price * 1.1), imgs };
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧 FIX ALL BRAND NAMES — Triệt để đúng brand');
  console.log('═'.repeat(60));

  const pairs = await prisma.$queryRaw`
    SELECT DISTINCT category_id, brand_id FROM "Product" WHERE is_deleted = false
  `;
  const total = await prisma.product.count({ where: { is_deleted: false } });
  console.log(`  Tổng cặp: ${pairs.length} | Tổng SP: ${total.toLocaleString()}`);
  console.log('─'.repeat(60));

  // Cache: mỗi cặp (cat, brand) → pool templates
  const templateCache = {};
  for (const { category_id: catId, brand_id: brandId } of pairs) {
    const key = `${catId}|${brandId}`;
    // Sinh 5 variant để có sự đa dạng
    const pool = [];
    for (let i = 0; i < 5; i++) pool.push(generateTemplate(catId, brandId));
    templateCache[key] = pool;
  }

  const startMs = Date.now();
  let totalUpdated = 0;
  let pairsDone = 0;

  for (const { category_id: catId, brand_id: brandId } of pairs) {
    pairsDone++;
    const key   = `${catId}|${brandId}`;
    const pool  = templateCache[key];
    let cursor;

    while (true) {
      const products = await prisma.product.findMany({
        where:   { category_id: catId, brand_id: brandId, is_deleted: false },
        select:  { id: true },
        take:    5000,
        orderBy: { id: 'asc' },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!products.length) break;

      const byTemplate = {};
      for (const p of products) {
        const t = rand(pool);
        if (!byTemplate[t.name]) byTemplate[t.name] = { t, ids: [] };
        byTemplate[t.name].ids.push(p.id);
      }

      await Promise.all(
        Object.values(byTemplate).map(({ t, ids }) =>
          prisma.product.updateMany({
            where: { id: { in: ids } },
            data: {
              name:           t.name,
              price:          t.price,
              original_price: t.orig,
              image:          t.imgs[0],
              images:         JSON.stringify(t.imgs),
            },
          })
        )
      );

      totalUpdated += products.length;
      cursor = products[products.length - 1].id;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps     = Math.round(totalUpdated / Math.max(elapsed, 1));
      const eta     = rps > 0 ? Math.ceil((total - totalUpdated) / rps) : 0;
      const etaStr  = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
      process.stdout.write(
        `\r  ${pairsDone}/${pairs.length} pairs | ${totalUpdated.toLocaleString()}/${total.toLocaleString()}  ${rps.toLocaleString()}/s  ETA:${etaStr}   `
      );
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║       FIX ALL BRAND NAMES HOÀN THÀNH           ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Sản phẩm đã fix: ${String(totalUpdated.toLocaleString()).padStart(12)}                ║`);
  console.log(`  ║  Thời gian      : ${String(elapsed + 's').padStart(12)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  // Kiểm tra mẫu ngẫu nhiên
  const samples = await prisma.$queryRaw`
    SELECT p.name, p.brand_id, b.name as brand_name
    FROM "Product" p
    JOIN "Brand" b ON b.id = p.brand_id
    WHERE p.is_deleted = false
    ORDER BY RANDOM() LIMIT 12
  `;
  console.log('\n  📋 Kiểm tra ngẫu nhiên:');
  for (const s of samples) {
    const brandWord = s.brand_name.split(' ')[0].toLowerCase();
    const ok = s.name.toLowerCase().includes(brandWord) ? '✅' : '⚠️ ';
    console.log(`  ${ok} [${s.brand_name}] ${s.name}`);
  }
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
