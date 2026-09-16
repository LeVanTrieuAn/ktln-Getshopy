// ── Deterministic seed helper ─────────────────────────────────────
function seed(id, idx = 0) {
  const n = Number(BigInt(id) % BigInt(999983)) + idx * 31337;
  return ((n * 1664525 + 1013904223) & 0x7fffffff);
}
function pick(id, arr, idx = 0) { return arr[seed(id, idx) % arr.length]; }
function rng(id, min, max, idx = 0) { return min + (seed(id, idx) % (max - min + 1)); }
function brandOrigin() { return pick(0, ['Mỹ', 'Nhật Bản', 'Trung Quốc', 'Việt Nam', 'Hàn Quốc']); }

// ══════════════════════════════════════════════════════════════════
// SPEC GENERATOR — TGDD Style — Tất cả 49 categories
// ══════════════════════════════════════════════════════════════════
export function generateSpecs(product) {
  const cat   = product.category_id || '';
  const name  = (product.name || '').toLowerCase();
  const pid   = product.id;
  const price = product.price || 0;
  const isMid  = price >= 5_000_000 && price < 15_000_000;
  const isHigh = price >= 15_000_000;

  // ── PHONE ─────────────────────────────────────────────────────
  if (cat === 'cat-phone' || name.includes('iphone') || name.includes('galaxy') || name.includes('điện thoại') || name.includes('smartphone')) {
    const isApple = name.includes('apple') || name.includes('iphone');
    const isSamsung = name.includes('samsung') || name.includes('galaxy');
    const isXiaomi = name.includes('xiaomi') || name.includes('redmi');
    const chipsets = isApple ? ['Apple A16 Bionic', 'Apple A17 Pro', 'Apple A18', 'Apple A15 Bionic']
      : isSamsung ? (isHigh ? ['Snapdragon 8 Gen 3', 'Exynos 2400'] : ['Exynos 1380', 'Snapdragon 6 Gen 1'])
      : isXiaomi ? (isHigh ? ['Snapdragon 8 Gen 3'] : ['Dimensity 8200', 'Helio G99'])
      : (isHigh ? ['Snapdragon 8 Gen 3', 'Dimensity 9300'] : ['Dimensity 7050', 'Helio G85']);
    return [
      { section: '📱 Màn hình', rows: [
        ['Kích thước', pick(pid, ['6.1"', '6.4"', '6.5"', '6.6"', '6.7"', '6.8"'])],
        ['Công nghệ', isApple ? 'Super Retina XDR (OLED)' : isHigh ? 'Dynamic AMOLED 2X' : 'AMOLED'],
        ['Độ phân giải', isApple ? '2556 x 1179 px (460ppi)' : isHigh ? '3088 x 1440 px (QHD+)' : '2400 x 1080 px (FHD+)'],
        ['Tần số quét', isHigh ? '120Hz (adaptive)' : isMid ? '90Hz' : '60Hz'],
        ['Độ sáng tối đa', `${rng(pid, 600, 2000, 7)} nits`],
      ]},
      { section: '⚡ Bộ xử lý', rows: [
        ['Công nghệ CPU', pick(pid, chipsets)],
        ['Số nhân', `${pick(pid, [6, 8, 10], 1)}`],
        ['RAM', `${pick(pid, isHigh ? [12, 16] : isMid ? [6, 8] : [4, 6], 1)} GB`],
        ['Bộ nhớ trong', `${pick(pid, isHigh ? [256, 512] : isMid ? [128, 256] : [64, 128], 2)} GB`],
        ['Thẻ nhớ ngoài', isApple ? 'Không hỗ trợ' : 'MicroSD (lên đến 1TB)'],
      ]},
      { section: '📷 Camera', rows: [
        ['Camera sau', isHigh ? pick(pid, ['50MP + 50MP + 10MP', '200MP + 10MP + 10MP']) : '50MP + 8MP + 2MP'],
        ['Camera trước', isHigh ? '32MP' : '16MP'],
        ['Quay phim', isHigh ? '8K @30fps, 4K @60fps' : '4K @30fps, 1080p @60fps'],
        ['Tính năng', 'OIS, AI Camera, Chụp đêm, Zoom quang học'],
      ]},
      { section: '🔋 Pin & Sạc', rows: [
        ['Dung lượng pin', `${pick(pid, isHigh ? [4700, 5000, 5100] : [4500, 4800, 5000], 3)} mAh`],
        ['Công nghệ sạc', isHigh ? '45W có dây, 15W không dây' : '25W có dây'],
        ['Loại pin', 'Li-ion (không tháo rời)'],
      ]},
      { section: '📡 Kết nối', rows: [
        ['Mạng di động', isHigh || isMid ? '5G / 4G LTE' : '4G LTE / 3G'],
        ['SIM', isApple ? 'Nano SIM + eSIM' : 'Nano SIM + Nano SIM (Dual SIM)'],
        ['WiFi', isHigh ? 'Wi-Fi 6E (802.11ax)' : 'Wi-Fi 5 (802.11ac)'],
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : isMid ? '5.2' : '5.1'}`],
        ['NFC', isApple || isMid || isHigh ? 'Có' : 'Không'],
        ['GPS', 'GPS, GLONASS, BeiDou, Galileo'],
        ['Cổng kết nối', isApple ? 'USB-C (USB 3)' : 'USB Type-C'],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Hệ điều hành', isApple ? 'iOS 18' : 'Android 14'],
        ['Kháng nước', isHigh ? 'IP68 — Chống nước 6m/30 phút' : isMid ? 'IP67' : 'Chống nước cơ bản'],
        ['Cảm biến bảo mật', isApple ? 'Face ID' : isHigh ? 'Vân tay dưới màn hình' : 'Vân tay cạnh máy'],
        ['Kích thước', `${rng(pid, 145, 165, 12)} x ${rng(pid, 70, 77, 13)} x ${rng(pid, 75, 90, 14) / 10} mm`],
        ['Trọng lượng', `${rng(pid, 170, 230, 15)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Hàn Quốc', 'Mỹ', 'Trung Quốc'], 16)],
        ['Sản xuất tại', pick(pid, ['Việt Nam', 'Trung Quốc', 'Ấn Độ'], 17)],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── LAPTOP ────────────────────────────────────────────────────
  if (cat === 'cat-laptop' || name.includes('laptop') || name.includes('macbook') || name.includes('notebook')) {
    const isApple = name.includes('apple') || name.includes('macbook');
    const isGaming = name.includes('rog') || name.includes('gaming') || name.includes('msi') || name.includes('nitro') || name.includes('tuf');
    const cpus = isApple ? ['Apple M3', 'Apple M3 Pro', 'Apple M4']
      : isGaming ? ['Intel Core i9-14900HX', 'AMD Ryzen 9 7945HX', 'Intel Core i7-14700HX']
      : isHigh ? ['Intel Core Ultra 7 165H', 'AMD Ryzen 7 8845HS'] : isMid ? ['Intel Core i5-1335U', 'AMD Ryzen 5 7530U'] : ['Intel Core i3-1215U', 'AMD Ryzen 5 5625U'];
    const gpus = isApple ? ['Apple GPU 18-core', 'Apple GPU 30-core']
      : isGaming ? ['NVIDIA GeForce RTX 4080 16GB', 'NVIDIA GeForce RTX 4070 8GB', 'NVIDIA GeForce RTX 4060 8GB']
      : isHigh ? ['NVIDIA GeForce RTX 4050 6GB', 'Intel Arc Graphics'] : ['Intel Iris Xe Graphics', 'AMD Radeon Graphics'];
    const ram = pick(pid, isHigh || isGaming ? [16, 32, 64] : isMid ? [8, 16] : [8], 1);
    const ssd = pick(pid, isHigh || isGaming ? [512, 1024, 2048] : isMid ? [256, 512] : [256], 2);
    return [
      { section: '💻 Màn hình', rows: [
        ['Kích thước', pick(pid, isGaming ? ['15.6"', '16"', '17.3"'] : ['13.3"', '14"', '15.6"', '16"'])],
        ['Độ phân giải', isHigh || isGaming ? pick(pid, ['2560 x 1600 (QHD+)', '1920 x 1200 (FHD+)'], 4) : '1920 x 1080 (FHD)'],
        ['Tần số quét', isGaming ? pick(pid, ['144Hz', '165Hz', '240Hz'], 5) : isHigh ? '120Hz' : '60Hz'],
        ['Công nghệ', isApple ? 'Liquid Retina XDR (Mini-LED)' : isHigh ? 'IPS-level OLED' : 'IPS Anti-glare'],
        ['Độ phủ màu', isHigh || isGaming ? 'DCI-P3 100%' : 'sRGB 72%'],
      ]},
      { section: '⚡ Bộ xử lý & RAM', rows: [
        ['CPU', pick(pid, cpus)],
        ['Số nhân / Số luồng', `${pick(pid, [6, 8, 10, 12, 14], 3)} nhân / ${pick(pid, [12, 16, 20, 24], 4)} luồng`],
        ['RAM', `${ram} GB DDR${isHigh || isGaming ? '5' : '4'}`],
        ['Tốc độ RAM', `${isHigh ? '5600' : '4800'} MHz`],
        ['Ổ cứng', `${ssd} GB SSD NVMe PCIe ${isHigh ? '4.0' : '3.0'}`],
        ['Card đồ họa', pick(pid, gpus, 6)],
        ['VRAM', isGaming ? pick(pid, ['6GB GDDR6', '8GB GDDR6', '12GB GDDR6'], 7) : 'Dùng chung RAM'],
      ]},
      { section: '🔋 Pin & Sạc', rows: [
        ['Pin', isApple ? '70Wh, ~18 giờ' : isGaming ? pick(pid, ['90Wh, ~4-6 giờ', '99Wh, ~5-7 giờ'], 7) : pick(pid, ['50Wh, ~8-10 giờ', '65Wh, ~10-12 giờ'], 7)],
        ['Bộ sạc đi kèm', isGaming ? '200W Adapter' : isHigh ? '96W USB-C GaN' : '65W USB-C GaN'],
      ]},
      { section: '🔌 Cổng kết nối', rows: [
        ['USB-A 3.2', isApple ? 'Không' : `${rng(pid, 1, 3, 8)}x USB-A 3.2 Gen 1`],
        ['USB-C / Thunderbolt', isApple ? '2x Thunderbolt 4 (USB-C)' : isHigh ? '1x Thunderbolt 4 + 1x USB-C' : '1x USB-C 3.2'],
        ['HDMI', isGaming ? '2x HDMI 2.1' : '1x HDMI 1.4'],
        ['Jack tai nghe', '3.5mm combo'],
      ]},
      { section: '📡 Không dây & Bàn phím', rows: [
        ['WiFi', isHigh || isGaming ? 'Wi-Fi 6E (802.11ax)' : 'Wi-Fi 5 (802.11ac)'],
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : '5.0'}`],
        ['Webcam', '1080p FHD / IR (nhận diện khuôn mặt)'],
        ['Bàn phím', isGaming ? 'Full-size RGB Backlit, NKRO' : 'Chiclet, đèn nền trắng'],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Hệ điều hành', isApple ? 'macOS Sequoia' : 'Windows 11 Home'],
        ['Kích thước', `${rng(pid, 304, 360, 9)} x ${rng(pid, 210, 245, 10)} x ${rng(pid, 14, 22, 11)} mm`],
        ['Trọng lượng', `${(rng(pid, 12, 25, 12) / 10).toFixed(1)} kg`],
        ['Vật liệu vỏ', isApple ? 'Nhôm nguyên khối' : isHigh ? 'Nhôm + Magie' : 'Nhựa ABS cao cấp'],
        ['Bảo mật', 'Vân tay tích hợp phím nguồn' + (isApple || isHigh ? ' + Face ID' : '')],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Đài Loan', 'Mỹ', 'Trung Quốc'], 13)],
        ['Bảo hành', '24 tháng chính hãng'],
      ]},
    ];
  }

  // ── TABLET ────────────────────────────────────────────────────
  if (cat === 'cat-tablet' || name.includes('ipad') || name.includes('tablet') || name.includes('máy tính bảng')) {
    const isApple = name.includes('ipad') || name.includes('apple');
    const isPro = name.includes('pro');
    const isSamsung = name.includes('samsung') || name.includes('galaxy tab');
    return [
      { section: '📲 Màn hình', rows: [
        ['Công nghệ', isApple ? (isPro ? 'Tandem OLED (Ultra Retina XDR)' : 'Liquid Retina IPS') : (isHigh ? 'AMOLED' : 'IPS LCD')],
        ['Kích thước', isApple ? (isPro ? pick(pid, ['11" OLED', '13" OLED']) : pick(pid, ['10.9"', '11"'])) : pick(pid, ['10.4"', '10.5"', '11"', '12.4"'])],
        ['Độ phân giải', isApple ? '2360 x 1640 px (264 ppi)' : '2560 x 1600 px'],
        ['Tần số quét', isHigh || isPro ? '120Hz (ProMotion)' : '60Hz'],
        ['Độ sáng tối đa', `${rng(pid, 500, 1600, 4)} nits`],
      ]},
      { section: '⚡ Bộ xử lý & RAM', rows: [
        ['Chip', isApple ? (isPro ? pick(pid, ['Apple M4 (3nm)', 'Apple M2 (5nm)']) : 'Apple A16 Bionic (4nm)') : pick(pid, ['Snapdragon 870', 'Dimensity 9000', 'Exynos 1380'])],
        ['RAM', `${pick(pid, isApple ? (isPro ? [8, 16] : [8]) : [4, 6, 8], 1)} GB`],
        ['Bộ nhớ trong', `${pick(pid, isApple ? (isPro ? [256, 512, 1024] : [64, 128, 256]) : [64, 128, 256], 2)} GB`],
        ['Thẻ nhớ ngoài', isApple ? 'Không hỗ trợ' : 'MicroSD đến 1TB'],
      ]},
      { section: '📷 Camera', rows: [
        ['Camera sau', isApple ? (isPro ? '12MP Wide + LiDAR Scanner' : '12MP Wide + 12MP Ultra Wide') : `${rng(pid, 8, 13, 5)}MP AF`],
        ['Camera trước', isApple ? '12MP TrueDepth (Center Stage)' : `${rng(pid, 8, 13, 6)}MP`],
        ['Quay phim', '4K @60fps'],
      ]},
      { section: '📡 Kết nối & Pin', rows: [
        ['WiFi', 'Wi-Fi 6E (802.11ax) 2.4/5/6GHz'],
        ['Bluetooth', 'Bluetooth 5.3'],
        ['5G / 4G', isHigh ? 'Có (eSIM + Nano SIM)' : 'WiFi only'],
        ['Cổng', isApple ? (isPro ? 'Thunderbolt 4 / USB-C 4 (40Gbps)' : 'USB-C 3.1 Gen 2') : 'USB-C 3.1'],
        ['Dung lượng pin', pick(pid, ['7606 mAh', '8557 mAh', '10090 mAh', '11200 mAh'], 7)],
        ['Công nghệ sạc', isApple ? '20W USB-C' : '45W USB-C'],
        ['Hệ điều hành', isApple ? 'iPadOS 18' : isSamsung ? 'Android 14 + One UI 6' : 'Android 14'],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Kích thước', `${rng(pid, 247, 280, 8)} x ${rng(pid, 178, 200, 9)} x ${rng(pid, 55, 65, 10) / 10} mm`],
        ['Trọng lượng', `${rng(pid, 460, 680, 11)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── SMARTWATCH ────────────────────────────────────────────────
  if (cat === 'cat-watch' || name.includes('watch') || name.includes('đồng hồ') || name.includes('band')) {
    const isApple = name.includes('apple');
    const isSamsung = name.includes('samsung') || name.includes('galaxy watch');
    const isGarmin = name.includes('garmin');
    return [
      { section: '⌚ Màn hình', rows: [
        ['Kích thước', pick(pid, ['1.4"', '1.6"', '1.7"', '1.8"', '1.9"', '2.0"'])],
        ['Công nghệ', isApple ? 'LTPO OLED Always-On (2000 nits)' : isSamsung ? 'Super AMOLED Always-On' : isGarmin ? 'MIP Transflective' : 'AMOLED'],
        ['Độ phân giải', `${rng(pid, 320, 484, 1)} x ${rng(pid, 320, 484, 2)} px`],
        ['Always-On Display', isApple || isSamsung ? 'Có' : 'Có (tuỳ chọn)'],
      ]},
      { section: '❤️ Sức khỏe & Cảm biến', rows: [
        ['Đo nhịp tim', 'Liên tục 24/7 (quang học PPG)'],
        ['Đo SpO2', 'Có'],
        ['ECG (điện tâm đồ)', isApple || isSamsung ? 'Có (FDA cleared)' : 'Hãng không công bố'],
        ['Đo nhiệt độ da', isApple || isSamsung ? 'Có' : 'Hãng không công bố'],
        ['Phát hiện té ngã', isApple ? 'Có (gọi khẩn cấp tự động)' : 'Hãng không công bố'],
        ['Theo dõi giấc ngủ', 'Có (tự động, chi tiết pha ngủ)'],
        ['GPS tích hợp', isApple || isSamsung || isGarmin ? 'GPS + GLONASS + BeiDou + Galileo' : 'Không (GPS điện thoại)'],
        ['Số chế độ thể thao', `${rng(pid, 40, 150, 7)}+ chế độ`],
      ]},
      { section: '📡 Kết nối & Pin', rows: [
        ['Bluetooth', `Bluetooth ${isApple ? '5.3' : '5.1'}`],
        ['WiFi', 'Wi-Fi 802.11b/g/n (2.4GHz)'],
        ['NFC', isApple || isSamsung ? 'Có (Apple/Samsung Pay)' : 'Hãng không công bố'],
        ['LTE / eSIM', isHigh ? 'Có (eSIM tích hợp)' : 'Không'],
        ['Kháng nước', isApple ? 'WR50M (50m), IP6X bụi' : isSamsung ? '5ATM + IP68 (50m)' : pick(pid, ['5ATM (50m)', 'IP68'])],
        ['Thời lượng pin', isApple ? '18 giờ / 36 giờ Low Power Mode' : isSamsung ? '3-4 ngày / 7 ngày (Power Saving)' : `${rng(pid, 5, 14, 3)} ngày`],
        ['Sạc', isApple ? 'Magnetic USB-C Fast Charging' : 'Sạc từ tính không dây 5W'],
        ['Tương thích', isApple ? 'iOS (iPhone XS trở lên)' : 'Android 8.0+ / iOS 14+'],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Khối lượng', `${rng(pid, 29, 51, 14)} g (không dây đeo)`],
        ['Chất liệu vỏ', pick(pid, ['Nhôm aero space', 'Thép không gỉ', 'Titanium Grade 5'], 15)],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Hàn Quốc', 'Trung Quốc', 'Thụy Sĩ'], 17)],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── HEADPHONE / EARPHONE ──────────────────────────────────────
  if (cat === 'cat-av-bt-earphone' || cat === 'cat-av-wire-earphone' || cat === 'cat-av-headphone' || cat === 'cat-av-sport-earphone' ||
      name.includes('tai nghe') || name.includes('headphone') || name.includes('airpods') || name.includes('buds')) {
    const isWired = cat === 'cat-av-wire-earphone' || name.includes('có dây');
    const isANC = name.includes('anc') || name.includes('noise cancel') || name.includes('xm5') || name.includes('xm4');
    const isOverEar = cat === 'cat-av-headphone' || name.includes('chụp tai') || name.includes('over-ear');
    const isSport = cat === 'cat-av-sport-earphone' || name.includes('thể thao') || name.includes('sport');
    const isApple = name.includes('apple') || name.includes('airpods');
    const isSony = name.includes('sony') || name.includes('wh-') || name.includes('wf-');
    const codecs = isApple ? 'AAC, SBC (H2 chip)' : isHigh ? 'LDAC (990kbps), aptX HD, AAC, SBC' : 'AAC, SBC';
    const earBat = isOverEar ? `${rng(pid, 20, 40, 5)} giờ (ANC Off) / ${rng(pid, 15, 30, 6)} giờ (ANC On)` : `${rng(pid, 5, 9, 5)} giờ (tai nghe) + ${rng(pid, 15, 35, 7)} giờ (hộp sạc)`;
    return [
      { section: '🎵 Âm thanh', rows: [
        ['Driver (loa)', isOverEar ? `${rng(pid, 36, 45, 1)}mm Dynamic Driver` : `${rng(pid, 6, 13, 1)}mm Dynamic Driver`],
        ['Dải tần số', isHigh ? '5Hz – 40kHz (Hi-Res Audio)' : '20Hz – 20kHz'],
        ['Trở kháng', `${isOverEar ? pick(pid, [16, 32, 64, 150]) : pick(pid, [16, 28, 32])} Ω`],
        ['Độ nhạy', `${rng(pid, 96, 112, 2)} dB SPL/mW`],
        ['Chống ồn ANC', isANC ? (isHigh ? 'Có – Adaptive ANC, giảm đến -45dB' : 'Có – giảm đến -30dB') : 'Không'],
        ['Xuyên âm (Transparency)', isANC && (isHigh || isMid) ? 'Có (Ambient Mode)' : 'Không'],
        ['Hi-Res Audio', isHigh ? 'Có (LDAC 990kbps)' : 'Hãng không công bố'],
        ['Spatial Audio', isApple || isSony ? 'Có (với head tracking)' : 'Hãng không công bố'],
      ]},
      { section: '📡 Kết nối', rows: isWired ? [
        ['Cách kết nối', 'Dây cắm 3.5mm'],
        ['Độ dài dây cáp', `${rng(pid, 12, 15, 12) / 10} m`],
      ] : [
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : '5.2'}`],
        ['Codec hỗ trợ', codecs],
        ['Kết nối đồng thời (Multipoint)', '2 thiết bị'],
        ['Phạm vi kết nối', `${rng(pid, 8, 15, 4)} m`],
        ['Độ trễ (Latency)', isHigh ? '≤ 20ms (Game Mode)' : '≤ 40ms'],
        ['Đầu thu USB Receiver', pick(pid, ['Có (USB-A Nano Dongle)', 'Không'], 9)],
      ]},
      { section: '🔋 Pin & Sạc', rows: isWired ? [
        ['Nguồn điện', 'Không dùng pin (lấy từ thiết bị)'],
      ] : [
        ['Thời gian sử dụng', earBat],
        ['Loại pin', 'Li-polymer tích hợp'],
        ['Cổng sạc', pick(pid, ['USB-C', 'Micro USB'])],
        ['Sạc nhanh', isHigh ? '10 phút sạc = 1 giờ nghe' : '15 phút sạc = 1 giờ nghe'],
        ['Sạc không dây Qi', isApple || (isHigh && isOverEar) ? 'Có (Qi / MagSafe)' : 'Hãng không công bố'],
      ]},
      { section: '🎧 Thiết kế & Thông số', rows: [
        ['Kiểu đeo', isOverEar ? 'Over-Ear (chụp tai, đệm mút)' : isSport ? 'In-Ear Sport (móc tai cố định)' : 'In-Ear TWS (nhét tai)'],
        ['Chống nước', isSport ? 'IP55 – Chống mồ hôi & tia nước' : isHigh ? 'IPX4' : 'Hãng không công bố'],
        ['Microphone', isANC ? 'Dual mic array (ANC + cuộc gọi)' : `${rng(pid, 1, 2, 13)} microphone tích hợp`],
        ['Điều khiển', isOverEar ? 'Nút cứng + Cảm ứng trượt' : 'Cảm ứng đa điểm (tap/swipe)'],
        ['Ứng dụng', isApple ? 'Tự động qua iPhone Settings' : isSony ? 'Sony Headphones Connect' : 'Ứng dụng đi kèm'],
        ['Khối lượng', isOverEar ? `${rng(pid, 210, 310, 10)} g` : `${rng(pid, 4, 7, 10)} g/tai`],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Nhật Bản', 'Hàn Quốc', 'Trung Quốc'], 18)],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── CAMERA (IP/CCTV/Solar/4G/Doorbell/Webcam) ─────────────────
  if (cat.startsWith('cat-cam') || name.includes('camera') || name.includes('giám sát') || name.includes('webcam')) {
    const isOutdoor = cat === 'cat-cam-outdoor' || cat === 'cat-cam-solar' || cat === 'cat-cam-4g' || name.includes('ngoài trời');
    const is4G = cat === 'cat-cam-4g' || name.includes('4g');
    const isSolar = cat === 'cat-cam-solar' || name.includes('solar');
    const isDoorbell = cat === 'cat-cam-doorbell' || name.includes('chuông cửa');
    const isWebcam = cat === 'cat-cam-webcam' || name.includes('webcam');
    const isPTZ = name.includes('ptz') || name.includes('xoay');
    if (isWebcam) return [
      { section: '🎥 Hình ảnh & Video', rows: [
        ['Độ phân giải', pick(pid, ['4K (3840x2160)', '2K (2560x1440)', '1080p FHD', '720p HD'])],
        ['Tốc độ khung hình', pick(pid, ['30fps', '60fps'])],
        ['Góc nhìn', `${rng(pid, 78, 110, 2)}°`],
        ['Cảm biến', pick(pid, ['CMOS 1/2.8"', 'CMOS 1/3"', 'BSI CMOS'])],
        ['Autofocus', isHigh ? 'AI Autofocus (theo dõi khuôn mặt)' : 'Fixed Focus'],
        ['HDR', isHigh || isMid ? 'Có' : 'Không'],
      ]},
      { section: '🎙️ Âm thanh & Kết nối', rows: [
        ['Microphone', `${rng(pid, 1, 2, 5)} microphone tích hợp (khử ồn)`],
        ['Kết nối', 'USB-A / USB-C (Plug & Play)'],
        ['Tương thích', 'Windows, macOS, Linux, ChromeOS'],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Khối lượng', `${rng(pid, 100, 300, 8)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '24 tháng chính hãng'],
      ]},
    ];
    return [
      { section: '📷 Camera & Hình ảnh', rows: [
        ['Độ phân giải', isHigh ? pick(pid, ['8MP (4K)', '5MP (3K)']) : isMid ? pick(pid, ['4MP (2K)', '3MP']) : '2MP (FHD 1080p)'],
        ['Cảm biến', `1/${rng(pid, 24, 28, 1) / 10}" Progressive Scan CMOS`],
        ['Góc nhìn', isPTZ ? `Pan 360° / Tilt ${rng(pid, 90, 120, 2)}°` : `${rng(pid, 90, 130, 4)}°`],
        ['Tốc độ khung hình', `${pick(pid, [15, 20, 25, 30])} fps`],
        ['WDR', `${rng(pid, 100, 130, 7)} dB`],
        ['Nén video', 'H.265+ / H.265 / H.264+ / H.264'],
      ]},
      { section: '🌙 Chế độ ban đêm', rows: [
        ['Tầm nhìn ban đêm', isHigh ? `${rng(pid, 30, 60, 5)}m hồng ngoại / ${rng(pid, 20, 40, 6)}m Full Color` : `${rng(pid, 15, 30, 5)}m hồng ngoại`],
        ['Đèn hồng ngoại', `${rng(pid, 2, 4, 11)} IR LED SMD`],
        ['Full Color Night Vision', isHigh ? 'Có' : 'Hãng không công bố'],
        ['Độ sáng tối thiểu', `${rng(pid, 0, 2, 12) / 100} Lux (màu) / 0 Lux (IR)`],
      ]},
      { section: '📡 Kết nối', rows: [
        ['WiFi', isHigh ? 'Dual-band Wi-Fi 6 (2.4 + 5GHz)' : 'Wi-Fi 4 (802.11b/g/n) 2.4GHz'],
        ...(is4G ? [['4G LTE', 'Nano SIM, hỗ trợ mạng Viettel, Vinaphone, Mobifone']] : []),
        ['LAN (RJ45)', isOutdoor ? '10/100 Mbps PoE' : 'Không'],
        ['PoE', isOutdoor || isHigh ? 'IEEE 802.3af (15.4W)' : 'Hãng không công bố'],
        ['ONVIF', 'Profile S, G, T'],
      ]},
      { section: '💾 Lưu trữ & Âm thanh', rows: [
        ['Khe MicroSD', `Tối đa ${rng(pid, 128, 256, 13)} GB`],
        ['Lưu trữ đám mây', 'Hỗ trợ (có phí / miễn phí gói cơ bản)'],
        ['NVR / NAS', 'Hỗ trợ kết nối NVR qua ONVIF'],
        ['Âm thanh 2 chiều', 'Loa + Microphone tích hợp'],
      ]},
      { section: '🤖 AI & Thông số vật lý', rows: [
        ['Phát hiện người / xe', 'Có (AI Deep Learning)'],
        ['Phát hiện chuyển động', 'Có (PIR + AI, giảm báo động giả)'],
        ...(isDoorbell ? [['Nhận diện khuôn mặt', 'Có (Face Recognition)']] : []),
        ...(isSolar ? [['Nguồn điện', 'Pin mặt trời (5W) + Pin lithium dự phòng']] : [['Nguồn điện', 'DC 12V / PoE IEEE 802.3af']]),
        ['Chuẩn kháng bụi / nước', isOutdoor ? pick(pid, ['IP67', 'IP68', 'IP66']) : 'IP65'],
        ['Nhiệt độ hoạt động', isOutdoor ? '-30°C đến +60°C' : '-10°C đến +50°C'],
        ['Ứng dụng', name.includes('hikvision') ? 'Hik-Connect / iVMS-4500' : name.includes('imou') ? 'Imou Life' : name.includes('ezviz') ? 'EZVIZ App' : 'Ứng dụng đi kèm'],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '24 tháng chính hãng'],
      ]},
    ];
  }

  // ── LOA (SPEAKER) ─────────────────────────────────────────────
  if (cat === 'cat-av-speaker' || name.includes('loa') || name.includes('speaker')) {
    return [
      { section: '🔊 Âm thanh', rows: [
        ['Công suất RMS', isHigh ? pick(pid, ['80W RMS', '100W RMS']) : isMid ? pick(pid, ['30W RMS', '40W RMS', '50W RMS']) : pick(pid, ['10W RMS', '15W RMS', '20W RMS'])],
        ['Driver', `${rng(pid, 1, 2, 1)}x Woofer ${rng(pid, 50, 90, 2)}mm + Tweeter`],
        ['Dải tần số', `${rng(pid, 40, 80, 3)}Hz – 20kHz`],
        ['Hiệu ứng âm thanh', name.includes('360') ? 'Âm thanh vòm 360°' : 'Stereo + Bass Boost EQ'],
        ['Hi-Res Audio', isHigh ? 'Có' : 'Hãng không công bố'],
      ]},
      { section: '📡 Kết nối', rows: [
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : '5.0'}`],
        ['Jack AUX 3.5mm', 'Có'],
        ['USB', 'USB-A nghe nhạc (FAT32/NTFS)'],
        ['TWS Stereo Pair', 'Có — ghép 2 loa thành stereo'],
        ['Kháng nước', isHigh ? 'IP67' : isMid ? 'IPX5' : 'IPX4'],
      ]},
      { section: '🔋 Pin & Kích thước', rows: [
        ['Thời lượng pin', isHigh ? pick(pid, ['20 giờ', '24 giờ'], 6) : isMid ? pick(pid, ['12 giờ', '15 giờ'], 6) : pick(pid, ['6 giờ', '8 giờ'], 6)],
        ['Cổng sạc', 'USB-C'],
        ['Kích thước', `${rng(pid, 80, 200, 8)} x ${rng(pid, 80, 120, 9)} x ${rng(pid, 80, 120, 10)} mm`],
        ['Trọng lượng', `${rng(pid, 500, 2000, 11)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Nhật Bản', 'Trung Quốc'], 12)],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── MICRO (MICROPHONE) ────────────────────────────────────────
  if (cat === 'cat-av-mic' || name.includes('micro') || name.includes('microphone')) {
    const isCondenser = name.includes('condenser') || isHigh;
    const isUSB = !name.includes('xlr');
    return [
      { section: '🎙️ Âm thanh', rows: [
        ['Loại cảm biến', isCondenser ? 'Condenser (tụ điện)' : 'Dynamic (điện từ)'],
        ['Khoảng tần số', `${rng(pid, 20, 80, 1)}Hz – 20kHz`],
        ['Độ nhạy', `-${rng(pid, 36, 48, 2)} dBV/Pa`],
        ['Tỉ lệ S/N', `${rng(pid, 70, 90, 3)} dB`],
        ['Mẫu thu âm', pick(pid, ['Cardioid (tim – trước)', 'Omnidirectional', 'Super Cardioid', 'Bidirectional'])],
        ['Tần số lấy mẫu', isHigh ? '192kHz / 32-bit' : '48kHz / 24-bit'],
      ]},
      { section: '🔌 Kết nối & Nguồn', rows: [
        ['Kết nối', isUSB ? 'USB-A / USB-C (Plug & Play)' : 'XLR 3-pin (cần audio interface)'],
        ['Phantom Power', isCondenser && !isUSB ? 'Cần 48V Phantom Power' : 'Không cần (USB powered)'],
        ['Headphone Monitor', isHigh ? 'Có (jack 3.5mm, zero latency)' : 'Hãng không công bố'],
        ['Tương thích', 'Windows, macOS, iOS, Android, PS4/PS5'],
      ]},
      { section: 'ℹ️ Thông số vật lý', rows: [
        ['Khối lượng', `${rng(pid, 200, 600, 8)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Đức', 'Trung Quốc', 'Nhật Bản'], 9)],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── MÁY CHIẾU (PROJECTOR) ─────────────────────────────────────
  if (cat === 'cat-av-projector' || name.includes('máy chiếu') || name.includes('projector')) {
    const isMini = name.includes('mini') || !isHigh;
    const is4K = name.includes('4k') || isHigh;
    return [
      { section: '🖥️ Hình ảnh', rows: [
        ['Công nghệ', pick(pid, ['DLP (Digital Light Processing)', 'LCD', 'LCoS'])],
        ['Độ phân giải gốc', is4K ? '3840 x 2160 (4K UHD)' : isMini ? '1920 x 1080 (FHD)' : '1280 x 720 (HD)'],
        ['Độ sáng (ANSI Lumens)', is4K ? `${rng(pid, 2500, 4000, 2)} ANSI lm` : isMini ? `${rng(pid, 300, 800, 3)} ANSI lm` : `${rng(pid, 1000, 2000, 4)} ANSI lm`],
        ['Tỉ lệ tương phản', is4K ? '2,000,000 : 1' : `${rng(pid, 10000, 100000, 5)} : 1`],
        ['Kích thước màn (ném)', isMini ? '30" – 120"' : '60" – 300"'],
        ['Khoảng cách ném', isMini ? '0.5m – 3m' : '1m – 7m'],
      ]},
      { section: '🔌 Kết nối', rows: [
        ['HDMI', `${rng(pid, 1, 2, 7)}x HDMI 2.0`],
        ['USB', '1x USB-A (đọc USB)'],
        ['Bluetooth', isMini ? 'Bluetooth 5.0' : 'Hãng không công bố'],
        ['WiFi', isMini ? 'Dual-band Wi-Fi 6' : 'Wi-Fi 5'],
        ['Âm thanh', `Loa tích hợp ${rng(pid, 5, 20, 8)}W`],
        ['Hỗ trợ', 'Miracast / AirPlay / Chromecast'],
      ]},
      { section: '🔦 Nguồn sáng & Thông số', rows: [
        ['Loại nguồn sáng', pick(pid, ['LED (30,000h)', 'Laser (25,000h)', 'Đèn UHP (5,000h)'])],
        ['Hệ điều hành', isMini ? 'Android TV 11' : 'Không (cần nguồn HDMI)'],
        ['Keystone', 'Keystone ±40° tự động'],
        ['Tiêu thụ điện', `${rng(pid, 50, 400, 9)} W`],
        ['Kích thước', `${rng(pid, 150, 350, 10)} x ${rng(pid, 120, 250, 11)} x ${rng(pid, 60, 150, 12)} mm`],
        ['Trọng lượng', `${(rng(pid, 8, 40, 13) / 10).toFixed(1)} kg`],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── KÍNH THÔNG MINH ───────────────────────────────────────────
  if (cat === 'cat-av-smartglass' || name.includes('kính thông minh') || name.includes('smart glass')) {
    return [
      { section: '👓 Màn hình & Quang học', rows: [
        ['Camera tích hợp', `${pick(pid, ['12MP', '8MP', '5MP'])} (chụp ảnh, quay phim)`],
        ['Quay phim', '4K @30fps / 1080p @60fps'],
        ['FOV (Trường nhìn)', `${rng(pid, 30, 60, 1)}°`],
      ]},
      { section: '📡 Kết nối & Âm thanh', rows: [
        ['Bluetooth', 'Bluetooth 5.2'],
        ['WiFi', 'Wi-Fi 6 (802.11ax)'],
        ['Loa', 'Open-ear Spatial Audio'],
        ['Microphone', 'Dual microphone (khử ồn AI)'],
        ['Điều khiển', 'Cảm ứng cạnh kính, giọng nói, nút vật lý'],
        ['Tương thích', 'iOS / Android (Bluetooth)'],
      ]},
      { section: '🔋 Pin & Thông số khác', rows: [
        ['Thời lượng pin', `${rng(pid, 3, 8, 7)} giờ`],
        ['Cổng sạc', 'USB-C Magnetic'],
        ['Trọng lượng', `${rng(pid, 50, 120, 8)} g`],
        ['IP chuẩn', 'IPX4 (chống bắn nước)'],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── Ổ CỨNG (HDD/SSD) ─────────────────────────────────────────
  if (cat === 'cat-av-hdd' || name.includes('ổ cứng') || name.includes('hdd') || name.includes('ssd')) {
    const isSSD = name.includes('ssd') || isHigh || isMid;
    return [
      { section: '💾 Thông số lưu trữ', rows: [
        ['Loại ổ', isSSD ? 'SSD (Solid State Drive)' : 'HDD (Hard Disk Drive)'],
        ['Dung lượng', pick(pid, isSSD ? ['256GB', '512GB', '1TB', '2TB'] : ['500GB', '1TB', '2TB', '4TB'])],
        ['Giao tiếp', isSSD ? (isHigh ? 'USB-C 3.2 Gen 2x2 (20Gbps)' : 'USB-C 3.2 Gen 2 (10Gbps)') : 'USB 3.0 / USB-C'],
        ['Tốc độ đọc tối đa', isSSD ? `${rng(pid, 500, 2000, 3)} MB/s` : `${rng(pid, 100, 160, 4)} MB/s`],
        ['Tốc độ ghi tối đa', isSSD ? `${rng(pid, 400, 1800, 5)} MB/s` : `${rng(pid, 80, 140, 6)} MB/s`],
        ...(!isSSD ? [['Tốc độ vòng quay', `${pick(pid, [5400, 7200])} RPM`]] : []),
      ]},
      { section: '🔌 Kết nối & Thiết kế', rows: [
        ['Cáp đi kèm', 'USB-C to USB-C + USB-C to USB-A'],
        ['Hệ file', 'exFAT (Windows, Mac, Android)'],
        ['Chống sốc', `Chịu rơi từ ${rng(pid, 1, 3, 9)} m`],
        ['Kích thước', `${rng(pid, 85, 120, 10)} x ${rng(pid, 55, 70, 11)} x ${rng(pid, 8, 15, 12)} mm`],
        ['Trọng lượng', `${rng(pid, 60, 200, 13)} g`],
        ['Bảo hành', '3 năm chính hãng'],
      ]},
    ];
  }

  // ── THẺ NHỚ ───────────────────────────────────────────────────
  if (cat === 'cat-av-sdcard' || name.includes('thẻ nhớ') || name.includes('sd card') || name.includes('microsd')) {
    return [
      { section: '💾 Thông số thẻ nhớ', rows: [
        ['Loại thẻ', name.includes('microsd') ? 'MicroSDXC / MicroSDHC' : 'SDXC / SDHC'],
        ['Dung lượng', `${pick(pid, [32, 64, 128, 256, 512])} GB`],
        ['Chuẩn tốc độ', pick(pid, isHigh ? ['V90 (90MB/s write)', 'UHS-II U3'] : ['V30 (30MB/s write)', 'UHS-I U3 A2'])],
        ['Tốc độ đọc tối đa', `${rng(pid, 90, 200, 3)} MB/s`],
        ['Tốc độ ghi tối đa', `${rng(pid, 30, 130, 4)} MB/s`],
        ['Chuẩn ứng dụng', pick(pid, ['A1 (500 IOPS)', 'A2 (4000 IOPS)'])],
        ['Tương thích', 'Camera, Máy tính bảng, Smartphone, Drone, Dashcam'],
        ['Bảo hành', '10 năm chính hãng'],
      ]},
    ];
  }

  // ── USB FLASH DRIVE ───────────────────────────────────────────
  if (cat === 'cat-av-usb' || (name.includes('usb') && (name.includes('flash') || name.includes('gb')))) {
    return [
      { section: '💿 Thông số USB', rows: [
        ['Dung lượng', `${pick(pid, [16, 32, 64, 128, 256])} GB`],
        ['Chuẩn USB', pick(pid, ['USB 3.2 Gen 1 (5Gbps)', 'USB 3.2 Gen 2 (10Gbps)', 'USB 2.0'])],
        ['Tốc độ đọc tối đa', `${rng(pid, 50, 400, 2)} MB/s`],
        ['Tốc độ ghi tối đa', `${rng(pid, 20, 200, 3)} MB/s`],
        ['Chất liệu vỏ', pick(pid, ['Vỏ kim loại hợp kim', 'Nhựa ABS cao cấp', 'Vỏ nhôm'])],
        ['Tương thích', 'Windows, macOS, Linux, Smart TV, Car Audio'],
        ['Trọng lượng', `${rng(pid, 8, 20, 9)} g`],
        ['Bảo hành', '5 năm chính hãng'],
      ]},
    ];
  }

  // ── CHUỘT MÁY TÍNH ────────────────────────────────────────────
  if (cat === 'cat-laptop-acc-mouse' || name.includes('chuột') || name.includes('mouse')) {
    const isWireless = name.includes('không dây') || name.includes('wireless') || name.includes('bluetooth');
    const isBT = name.includes('bluetooth');
    const isGaming = name.includes('gaming') || isHigh;
    return [
      { section: '🖱️ Loại & Kết nối', rows: [
        ['Không dây / Có dây', isWireless ? (isBT ? 'Không dây Bluetooth' : 'Không dây USB Receiver (2.4GHz)') : 'Có dây (USB-A)'],
        ['Tương thích', 'macOS (MacBook, iMac), Windows, ChromeOS'],
        ['Cách kết nối', isWireless ? (isBT ? 'Bluetooth 5.0 / 5.1' : 'Đầu thu USB Receiver 2.4GHz') : 'Dây cắm USB-A'],
        ['Khoảng cách kết nối', isWireless ? `${rng(pid, 8, 15, 1)} m` : 'Không áp dụng'],
        ['Độ dài dây', isWireless ? 'Không dây' : `${(rng(pid, 14, 18, 1) / 10).toFixed(1)} m`],
      ]},
      { section: '🎯 Cảm biến & Hiệu năng', rows: [
        ['Cảm biến', isGaming ? pick(pid, ['PixArt PAW3395 Optical', 'Hero 25K Optical', 'Focus Pro 26K']) : 'Hãng không công bố'],
        ['Độ phân giải tối đa', `${rng(pid, isGaming ? 16000 : 1200, isGaming ? 30000 : 10000, 2)} DPI`],
        ['Polling Rate', isGaming ? pick(pid, ['1000 Hz', '4000 Hz', '8000 Hz']) : 'Hãng không công bố'],
        ['Switch', isGaming ? pick(pid, ['Omron D2FC-F-7N (50M clicks)', 'Huano Blue Shell', 'Kailh GM 4.0']) : 'Hãng không công bố'],
        ['Feet (chân chuột)', isGaming ? 'PTFE 100% (Teflon)' : 'Hãng không công bố'],
      ]},
      { section: '💡 Thiết kế & Tính năng', rows: [
        ['Số nút bấm', `${rng(pid, 3, 7, 7)} nút`],
        ['Đèn LED', isGaming ? 'RGB 16.8 triệu màu' : pick(pid, ['RGB', 'Không', 'Hãng không công bố'])],
        ['Ứng dụng điều khiển', isGaming ? pick(pid, ['iCUE', 'Logitech G Hub', 'Razer Synapse 3', 'SteelSeries GG']) : 'Hãng không công bố'],
        ['Thiết kế', pick(pid, ['Đối xứng (2 tay)', 'Nghiêng phải (tay phải)', 'Ergonomic thẳng đứng'])],
      ]},
      { section: '🔋 Pin (nếu không dây)', rows: isWireless ? [
        ['Loại pin', 'Pin sạc Li-ion tích hợp'],
        ['Thời gian dùng', `${rng(pid, 40, 100, 8)} giờ`],
        ['Cổng sạc', pick(pid, ['USB-C', 'Micro USB'])],
      ] : [['Pin', 'Không cần (cắm dây)']],
      },
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Khối lượng', `${rng(pid, 70, 150, 10)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Trung Quốc', 'Đài Loan'], 11)],
        ['Sản xuất tại', 'Trung Quốc'],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── BÀN PHÍM ─────────────────────────────────────────────────
  if (cat === 'cat-laptop-acc-keyboard' || name.includes('bàn phím') || name.includes('keyboard')) {
    const isMechanical = name.includes('cơ') || name.includes('mechanical') || isHigh;
    const isWireless = name.includes('không dây') || name.includes('wireless') || name.includes('bluetooth');
    return [
      { section: '⌨️ Cơ chế & Loại', rows: [
        ['Loại bàn phím', isMechanical ? 'Cơ học (Mechanical)' : 'Màng (Membrane) / Scissor'],
        ['Switch', isMechanical ? pick(pid, ['Red (Linear, 45g)', 'Blue (Clicky, 50g)', 'Brown (Tactile, 45g)', 'Speed Silver (Linear, 40g)']) : 'Membrane'],
        ['Số lần nhấn', isMechanical ? '50-100 triệu lần/phím' : 'Hãng không công bố'],
        ['Layout', pick(pid, ['Full-size (108 phím)', 'TKL (87 phím)', '75% (84 phím)', '65% (67 phím)'])],
        ['Kết nối', isWireless ? 'Bluetooth 5.0 / 2.4GHz Wireless / USB-C (3 chế độ)' : 'USB-C có dây'],
      ]},
      { section: '💡 LED & Tùy chỉnh', rows: [
        ['Đèn nền', isHigh ? 'RGB per-key (16.8M màu)' : isMid ? 'RGB backlit' : 'Trắng / không đèn'],
        ['Phần mềm', isHigh ? pick(pid, ['iCUE', 'Logitech G Hub', 'Razer Synapse 3']) : 'Hãng không công bố'],
        ['N-Key Rollover (NKRO)', isMechanical ? 'Có' : 'Hãng không công bố'],
      ]},
      { section: '🔋 Pin & Thông số', rows: [
        ...(isWireless ? [
          ['Pin', `${rng(pid, 2000, 6000, 7)} mAh Li-polymer`],
          ['Thời lượng', `${rng(pid, 40, 200, 8)} giờ (LED tắt)`],
        ] : [['Nguồn', 'Cáp USB-C (không dùng pin)']]),
        ['Keycap', pick(pid, ['PBT Double-shot', 'ABS Double-shot', 'POM'])],
        ['Kích thước', `${rng(pid, 350, 450, 9)} x ${rng(pid, 130, 150, 10)} x ${rng(pid, 30, 45, 11)} mm`],
        ['Trọng lượng', `${rng(pid, 600, 1200, 12)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Trung Quốc', 'Đài Loan', 'Hàn Quốc'], 13)],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── ROUTER & THIẾT BỊ MẠNG ───────────────────────────────────
  if (cat === 'cat-laptop-acc-router' || name.includes('router') || name.includes('wifi') || name.includes('mesh')) {
    const isWifi6 = name.includes('wifi 6') || name.includes('ax') || isHigh;
    return [
      { section: '📡 Chuẩn Wifi', rows: [
        ['Chuẩn WiFi', isWifi6 ? 'Wi-Fi 6E (802.11ax)' : isMid ? 'Wi-Fi 6 (802.11ax)' : 'Wi-Fi 5 (802.11ac)'],
        ['Băng tần', isWifi6 ? 'Tri-band: 2.4GHz + 5GHz + 6GHz' : 'Dual-band: 2.4GHz + 5GHz'],
        ['Tốc độ tổng hợp', isHigh ? 'Lên đến 10,756 Mbps' : isMid ? 'Lên đến 3,600 Mbps' : 'Lên đến 1,200 Mbps'],
        ['Chuẩn bảo mật', 'WPA3 / WPA2 / WPA'],
        ['MU-MIMO', `${pick(pid, [4, 8, 12])}x MU-MIMO`],
        ['Tầm phủ sóng', isHigh ? 'Lên đến 300 m²' : isMid ? 'Lên đến 200 m²' : 'Lên đến 120 m²'],
      ]},
      { section: '🔌 Cổng kết nối', rows: [
        ['WAN', '1x Gigabit WAN (RJ45)'],
        ['LAN', `${rng(pid, 3, 4, 5)}x Gigabit LAN (RJ45)`],
        ['USB', isHigh ? '1x USB 3.0 (chia sẻ file/máy in)' : 'Không'],
        ['CPU', pick(pid, ['Quad-core 1.8GHz', 'Dual-core 1.5GHz', 'Quad-core 2.0GHz'])],
        ['RAM', `${pick(pid, [256, 512, 1024])} MB`],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Mesh hệ thống', isHigh || isMid ? 'Có (tự mở rộng mạng)' : 'Không'],
        ['Quản lý từ xa', 'Ứng dụng iOS / Android / Web Browser'],
        ['Hãng', name.split(' ')[0]],
        ['Thương hiệu của', pick(pid, ['Mỹ', 'Trung Quốc', 'Đài Loan'], 11)],
        ['Bảo hành', '24 tháng chính hãng'],
      ]},
    ];
  }

  // ── HUB & CÁP CHUYỂN ─────────────────────────────────────────
  if (cat === 'cat-laptop-acc-hub' || name.includes('hub') || name.includes('cáp chuyển') || name.includes('adapter')) {
    return [
      { section: '🔌 Cổng kết nối', rows: [
        ['Cổng vào (input)', 'USB-C 3.2 Gen 2 / Thunderbolt 3/4'],
        ['USB-A 3.0', `${rng(pid, 3, 5, 1)} cổng USB-A 3.0 (5Gbps)`],
        ['HDMI', `${rng(pid, 1, 2, 3)}x HDMI 2.0 (4K@60Hz)`],
        ['SD / TF Card', 'SD 4.0 + TF/MicroSD'],
        ['Jack 3.5mm', 'Có (tai nghe + mic)'],
        ['RJ45 LAN', 'Gigabit Ethernet 10/100/1000 Mbps'],
        ['Power Delivery (PD)', `${rng(pid, 60, 100, 7)}W PD pass-through`],
      ]},
      { section: 'ℹ️ Thông số', rows: [
        ['Băng thông tối đa', '40 Gbps (Thunderbolt 4)'],
        ['Tương thích', 'MacBook, Windows, iPad Pro, Android'],
        ['Vật liệu', pick(pid, ['Vỏ nhôm nguyên khối', 'Nhựa ABS chống cháy', 'Nhôm + ABS'])],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── BALO, TÚI CHỐNG SỐC ──────────────────────────────────────
  if (cat === 'cat-laptop-acc-bag' || name.includes('balo') || name.includes('túi chống sốc') || (name.includes('túi') && name.includes('laptop'))) {
    return [
      { section: '🎒 Thông số kích thước', rows: [
        ['Loại', name.includes('túi') ? 'Túi laptop chống sốc' : 'Balo laptop'],
        ['Dung tích', `${rng(pid, 20, 35, 1)} lít`],
        ['Phù hợp laptop', pick(pid, ['Đến 13.3"', 'Đến 14"', 'Đến 15.6"', 'Đến 17"'])],
        ['Kích thước ngoài', `${rng(pid, 30, 50, 2)} x ${rng(pid, 15, 30, 3)} x ${rng(pid, 10, 20, 4)} cm`],
        ['Trọng lượng', `${rng(pid, 500, 1500, 5)} g`],
      ]},
      { section: '🔧 Vật liệu & Tính năng', rows: [
        ['Vật liệu ngoài', pick(pid, ['Polyester 600D chống thấm nước', 'Nylon 1680D', 'Vải canvas phủ PU'])],
        ['Đệm laptop', 'Lớp foam EVA chống sốc dày 10mm'],
        ['Ngăn chứa', `${rng(pid, 3, 8, 6)} ngăn`],
        ['Chống nước', 'Phủ PU + khóa kéo chống nước'],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng'],
      ]},
    ];
  }

  // ── MIẾNG LÓT CHUỘT ──────────────────────────────────────────
  if (cat === 'cat-laptop-acc-mousepad' || name.includes('lót chuột') || name.includes('mousepad')) {
    return [
      { section: '🖱️ Thông số miếng lót', rows: [
        ['Kích thước', pick(pid, ['250 x 210 x 3mm (S)', '350 x 300 x 3mm (M)', '450 x 400 x 3mm (L)', '900 x 400 x 4mm (XL Extended)'])],
        ['Bề mặt', pick(pid, ['Vải dệt vi sợi mật độ cao', 'Micro-weave coarse texture', 'Silk smooth surface'])],
        ['Đế', 'Cao su thiên nhiên chống trượt'],
        ['Tốc độ di chuyển', pick(pid, ['Tốc độ (Speed)', 'Kiểm soát (Control)', 'Cân bằng (Balanced)'])],
        ['Viền bọc', 'Viền khâu chống sờn (stitched edge)'],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '6 tháng'],
      ]},
    ];
  }

  // ── BẢNG VẼ ĐIỆN TỬ ──────────────────────────────────────────
  if (cat === 'cat-laptop-acc-drawing' || name.includes('bảng vẽ') || name.includes('drawing') || name.includes('wacom')) {
    return [
      { section: '✏️ Vùng vẽ & Cảm ứng', rows: [
        ['Vùng hoạt động', pick(pid, ['A6 (148 x 93 mm)', 'A5 (210 x 148 mm)', 'A4 (310 x 195 mm)'])],
        ['Độ phân giải', `${rng(pid, 2540, 5080, 2)} LPI`],
        ['Mức độ nhạy lực bút', `${pick(pid, [4096, 8192])} mức`],
        ['Tốc độ ghi nhận', `${rng(pid, 200, 266, 3)} PPS`],
        ['Bút stylus', 'Bút không pin, không cần sạc (EMR)'],
        ['Tilt support', 'Có (±60°)'],
      ]},
      { section: '🔌 Kết nối & Tương thích', rows: [
        ['Kết nối', 'USB-C (cáp USB-C to USB-A đi kèm)'],
        ['Tương thích OS', 'Windows 7+, macOS 10.12+, Android 6.0+'],
        ['Phần mềm', 'Clip Studio Paint, Photoshop, SAI, Illustrator...'],
        ['Nút Express Key', `${rng(pid, 6, 12, 6)} phím tùy chỉnh`],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── PHỦ PHÍM LAPTOP ───────────────────────────────────────────
  if (cat === 'cat-laptop-acc-keyboard-cover' || name.includes('phủ phím')) {
    return [
      { section: 'ℹ️ Thông số', rows: [
        ['Chất liệu', pick(pid, ['Silicone siêu mỏng 0.1mm', 'TPU trong suốt', 'Silicone TPE'])],
        ['Chống bụi / nước', 'Có'],
        ['Tương thích', pick(pid, ['MacBook Air/Pro 13"/14"/15"/16"', 'Dell XPS 13/15', 'Asus ZenBook / VivoBook'])],
        ['Bảo hành', '3 tháng'],
      ]},
    ];
  }

  // ── PHẦN MỀM ──────────────────────────────────────────────────
  if (cat === 'cat-laptop-acc-software' || name.includes('phần mềm') || name.includes('office') || name.includes('antivirus')) {
    return [
      { section: '💿 Thông tin phần mềm', rows: [
        ['Loại giấy phép', pick(pid, ['License key vĩnh viễn', 'Subscription 1 năm', 'Subscription 3 năm'])],
        ['Số thiết bị', `${pick(pid, [1, 3, 5])} thiết bị / giấy phép`],
        ['Hệ điều hành', pick(pid, ['Windows 10/11', 'macOS 11+', 'Windows + macOS'])],
        ['Phiên bản', pick(pid, ['Home', 'Professional', 'Business', 'Enterprise'])],
        ['Kích hoạt', 'Online activation (qua email)'],
        ['Hỗ trợ', 'Chat / Email / Hotline 24/7'],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', 'Theo giấy phép'],
      ]},
    ];
  }

  // ── GIÁ ĐỠ / GIÁ TREO MÀN HÌNH ──────────────────────────────
  if (cat === 'cat-laptop-acc-monitor-stand' || name.includes('giá treo') || (name.includes('giá đỡ') && !name.includes('điện thoại'))) {
    return [
      { section: '🖥️ Thông số giá đỡ', rows: [
        ['Loại', pick(pid, ['Giá đỡ màn hình cánh tay đơn', 'Giá đỡ 2 màn hình', 'Giá kẹp bàn'])],
        ['Tải trọng tối đa', `${rng(pid, 5, 15, 1)} kg`],
        ['Cỡ màn hình hỗ trợ', pick(pid, ['17" – 32"', '24" – 49"', '13" – 27"'])],
        ['Lỗ VESA', '75 x 75mm / 100 x 100mm'],
        ['Điều chỉnh', 'Tilt ±45° / Swivel 360° / Height ±15cm / Rotation 90°'],
        ['Vật liệu', pick(pid, ['Thép sơn tĩnh điện', 'Nhôm cao cấp', 'Thép + ABS'])],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng'],
      ]},
    ];
  }

  // ── TÚI ĐỰNG PHỤ KIỆN ────────────────────────────────────────
  if (cat === 'cat-laptop-acc-pouch' || (name.includes('túi đựng') && name.includes('phụ kiện'))) {
    return [
      { section: 'ℹ️ Thông số', rows: [
        ['Chất liệu', pick(pid, ['Vải oxford 600D chống nước', 'Da PU tổng hợp', 'Nylon cao cấp'])],
        ['Kích thước', `${rng(pid, 18, 30, 1)} x ${rng(pid, 12, 20, 2)} x ${rng(pid, 5, 10, 3)} cm`],
        ['Ngăn chia', `${rng(pid, 3, 8, 4)} ngăn + lưới mesh`],
        ['Khóa kéo', 'YKK chống nước'],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '6 tháng'],
      ]},
    ];
  }

  // ── SẠC DỰ PHÒNG (POWERBANK) ─────────────────────────────────
  if (cat === 'cat-mobile-acc-powerbank' || name.includes('sạc dự phòng') || name.includes('powerbank')) {
    const cap = pick(pid, [5000, 10000, 12000, 15000, 20000, 25000, 30000]);
    return [
      { section: '🔋 Thông số pin', rows: [
        ['Dung lượng thực tế', `${cap} mAh`],
        ['Công suất sạc ra', isHigh ? '65W PD (sạc laptop)' : isMid ? '22.5W VOOC / 18W PD' : '10W'],
        ['Cổng ra', `${rng(pid, 1, 2, 2)}x USB-A + ${rng(pid, 1, 2, 3)}x USB-C`],
        ['Sạc vào', isHigh ? '65W USB-C PD' : isMid ? '18W USB-C PD' : 'Micro USB 10W'],
        ['Sạc không dây', isHigh ? `${rng(pid, 10, 15, 4)}W Qi` : 'Không'],
        ['Màn hình LED', isHigh || isMid ? 'LCD hiển thị % pin' : 'LED 4 chấm'],
        ['Sạc đồng thời', `${rng(pid, 2, 4, 5)} thiết bị`],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Chứng nhận', 'CE, FCC, RoHS, BSMI'],
        ['Kích thước', `${rng(pid, 100, 165, 6)} x ${rng(pid, 60, 80, 7)} x ${rng(pid, 12, 22, 8)} mm`],
        ['Trọng lượng', `${rng(pid, 200, 500, 9)} g`],
        ['Vật liệu vỏ', pick(pid, ['Nhôm hàng không', 'Nhựa ABS + mặt nhôm'])],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── SẠC, CÁP ─────────────────────────────────────────────────
  if (cat === 'cat-mobile-acc-charger' || name.includes('sạc') || name.includes('cáp') || name.includes('charger') || name.includes('cable')) {
    const isCable = name.includes('cáp') || name.includes('cable');
    if (isCable) return [
      { section: '🔌 Thông số cáp', rows: [
        ['Đầu kết nối', pick(pid, ['USB-C to USB-C', 'USB-A to USB-C', 'USB-C to Lightning', 'USB-A to Lightning'])],
        ['Chuẩn sạc nhanh', pick(pid, ['PD 60W', 'PD 100W', 'PD 20W', '5A 100W'])],
        ['Tốc độ truyền dữ liệu', pick(pid, ['USB 3.2 Gen 2 (10Gbps)', 'USB 3.2 Gen 1 (5Gbps)', 'USB 2.0 (480Mbps)'])],
        ['Chiều dài', pick(pid, ['0.3m', '1m', '1.5m', '2m'])],
        ['Vật liệu bọc ngoài', pick(pid, ['Dù bện chịu lực', 'Silicon dẻo uốn 180°', 'Nylon bện 3 lớp'])],
        ['Bảo hành', '12 tháng'],
      ]},
    ];
    return [
      { section: '⚡ Thông số củ sạc', rows: [
        ['Công suất tối đa', isHigh ? '140W GaN' : isMid ? '65W GaN' : '20W'],
        ['Số cổng', `${rng(pid, 1, 4, 1)} cổng (USB-C + USB-A)`],
        ['Giao thức sạc nhanh', isHigh ? 'PD 3.1 / PPS / AFC / SCP' : isMid ? 'PD 3.0 / QC 4.0' : 'PD 3.0 / QC 3.0'],
        ['Công nghệ GaN', name.includes('gan') || isHigh ? 'Chip GaN III — nhỏ gọn, ít tỏa nhiệt' : 'Hãng không công bố'],
        ['Chuẩn an toàn', 'CE / FCC / RoHS'],
        ['Kích thước', `${rng(pid, 30, 65, 5)} x ${rng(pid, 30, 50, 6)} x ${rng(pid, 25, 40, 7)} mm`],
        ['Trọng lượng', `${rng(pid, 45, 200, 8)} g`],
        ['Hãng', name.split(' ')[0]],
        ['Bảo hành', '12 tháng chính hãng'],
      ]},
    ];
  }

  // ── ỐP LƯNG / BAO DA ─────────────────────────────────────────
  if (cat === 'cat-mobile-acc-case-phone' || cat === 'cat-mobile-acc-case-tablet' ||
      name.includes('ốp lưng') || name.includes('bao da') || name.includes('case')) {
    return [
      { section: '📱 Thông số ốp lưng', rows: [
        ['Chất liệu', pick(pid, ['TPU dẻo cao cấp', 'PC cứng + TPU viền mềm', 'Da PU tổng hợp', 'Silicone lỏng'])],
        ['Độ dày', `${rng(pid, 8, 18, 1) / 10} mm`],
        ['Chuẩn chống va đập', pick(pid, ['MIL-STD-810H (rơi 1.8m)', 'Airbag 4 góc', 'Chống rơi 1.5m'])],
        ['Chống ố vàng', 'Có (kháng tia UV)'],
        ['Tính năng', 'Tương thích sạc không dây / NFC xuyên ốp'],
        ['Trọng lượng', `${rng(pid, 20, 55, 2)} g`],
        ['Bảo hành', '3 tháng'],
      ]},
    ];
  }

  // ── MIẾNG DÁN MÀN HÌNH / CAMERA ─────────────────────────────
  if (cat === 'cat-mobile-acc-screen' || cat === 'cat-mobile-acc-cam-cover' ||
      name.includes('miếng dán') || name.includes('kính cường lực')) {
    const isGlass = name.includes('kính') || name.includes('glass') || isHigh;
    return [
      { section: '🛡️ Thông số miếng dán', rows: [
        ['Loại', isGlass ? 'Kính cường lực (Tempered Glass)' : 'Màng PPF (Polyurethane Film)'],
        ['Độ cứng', isGlass ? `${pick(pid, [9, 10])}H` : '4H (dẻo, tự phục hồi trầy xước)'],
        ['Độ dày', isGlass ? `${rng(pid, 2, 4, 1) / 10} mm` : `${rng(pid, 1, 2, 2) / 10} mm`],
        ['Tỉ lệ truyền sáng', `${rng(pid, 95, 99, 3)}%`],
        ['Chống vân tay', 'Phủ kị dầu (Oleophobic coating)'],
        ['Cạnh viền', pick(pid, ['2.5D cong mép', '3D cong đầy đủ', 'Phẳng'])],
        ['Bảo hành', '6 tháng'],
      ]},
    ];
  }

  // ── PHỤ KIỆN KHÁC (quạt mini, bút tablet, giá đỡ, dây đeo, ống kính, túi airpods) ─
  if (cat === 'cat-mobile-acc-fan' || name.includes('quạt mini')) {
    return [{ section: '💨 Thông số quạt', rows: [
      ['Loại', pick(pid, ['Quạt USB để bàn', 'Quạt cầm tay có pin', 'Quạt cổ đeo'])],
      ['Nguồn điện', pick(pid, ['USB-C / USB-A 5V-1A', 'Pin sạc 2000mAh tích hợp'])],
      ['Tốc độ gió', `${rng(pid, 3, 5, 2)} cấp độ`],
      ['Thời lượng pin', `${rng(pid, 4, 12, 4)} giờ`],
      ['Hãng', name.split(' ')[0]], ['Bảo hành', '6 tháng'],
    ]}];
  }
  if (cat === 'cat-mobile-acc-pen' || name.includes('bút') || name.includes('stylus') || name.includes('pencil')) {
    return [{ section: '✏️ Thông số bút', rows: [
      ['Công nghệ', pick(pid, ['Active Stylus (AES)', 'EMR (không cần pin)', 'Điện dung'])],
      ['Mức độ nhạy lực', `${pick(pid, [1024, 4096, 8192])} mức`],
      ['Tilt support', `±${rng(pid, 45, 70, 3)}°`],
      ['Tương thích', pick(pid, ['iPad Pro / Air / Mini', 'Samsung Galaxy Tab S', 'Android / iOS'])],
      ['Hãng', name.split(' ')[0]], ['Bảo hành', '6 tháng'],
    ]}];
  }
  if (cat === 'cat-mobile-acc-stand' || (name.includes('giá đỡ') && name.includes('điện thoại'))) {
    return [{ section: '📐 Thông số giá đỡ', rows: [
      ['Vật liệu', pick(pid, ['Nhôm hàng không nguyên khối', 'Nhựa ABS cao cấp'])],
      ['Điều chỉnh góc', pick(pid, ['0° – 70° liên tục', '360° xoay'])],
      ['Tải trọng', `Đến ${rng(pid, 1, 5, 2)} kg`],
      ['Gấp gọn', 'Có'], ['Hãng', name.split(' ')[0]], ['Bảo hành', '6 tháng'],
    ]}];
  }
  if (cat === 'cat-mobile-acc-strap' || name.includes('dây đeo') || name.includes('strap')) {
    return [{ section: 'ℹ️ Thông số', rows: [
      ['Chất liệu dây', pick(pid, ['Da thật Nappa', 'Dù bện paracord', 'Silicone dẻo'])],
      ['Chiều dài', `${rng(pid, 40, 80, 1)} cm (có thể điều chỉnh)`],
      ['Đầu kẹp', pick(pid, ['Kẹp ốp lưng universal', 'Khuyên gắn jack tai nghe', 'Móc carabiner'])],
      ['Hãng', name.split(' ')[0]], ['Bảo hành', '3 tháng'],
    ]}];
  }
  if (cat === 'cat-mobile-acc-lens' || name.includes('ống kính') || name.includes('lens') || name.includes('fisheye')) {
    return [{ section: '🔭 Thông số ống kính', rows: [
      ['Loại ống kính', pick(pid, ['Wide Angle 0.45x', 'Macro 10x', 'Fisheye 198°', 'Telephoto 2x'])],
      ['Lớp phủ', pick(pid, ['Multi-coated glass 7 lớp', 'HD Nano glass'])],
      ['Gắn', 'Kẹp clip universal (mọi smartphone)'],
      ['Hãng', name.split(' ')[0]], ['Bảo hành', '6 tháng'],
    ]}];
  }
  if (cat === 'cat-mobile-acc-airpods-case' || name.includes('túi đựng airpods') || name.includes('airpods case')) {
    return [{ section: 'ℹ️ Thông số', rows: [
      ['Chất liệu', pick(pid, ['Silicone lỏng mềm mịn', 'Da PU cao cấp', 'PC cứng + TPU viền'])],
      ['Tương thích', pick(pid, ['AirPods 1/2, AirPods Pro 1/2, AirPods 3', 'AirPods Pro 2 (USB-C / Lightning)'])],
      ['Móc khóa', 'Có vòng khóa nhôm đi kèm'],
      ['Sạc không dây', 'Tương thích sạc không dây'],
      ['Bảo hành', '3 tháng'],
    ]}];
  }

  // ── FALLBACK ─────────────────────────────────────────────────
  return [
    { section: 'ℹ️ Thông tin sản phẩm', rows: [
      ['Thương hiệu', (product.brand_id || '').replace('br-', '').replace(/-/g, ' ').toUpperCase() || 'N/A'],
      ['Danh mục', product.category_id || 'N/A'],
      ['Chất liệu', pick(pid, ['Nhôm cao cấp', 'Nhựa ABS', 'Hợp kim kẽm'])],
      ['Xuất xứ', pick(pid, ['Việt Nam', 'Hàn Quốc', 'Nhật Bản', 'Mỹ', 'Trung Quốc'])],
      ['Bảo hành', '12 tháng chính hãng'],
    ]},
  ];
}
