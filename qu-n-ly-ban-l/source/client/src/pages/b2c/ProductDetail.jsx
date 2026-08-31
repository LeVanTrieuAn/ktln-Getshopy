import { useState, useEffect, useRef } from 'react';
import { Row, Col, Typography, Button, Spin, Breadcrumb, Tabs, Divider, Tag, Rate, Avatar, List, Card, Input, message, Carousel } from 'antd';
import { ShoppingCartOutlined, ThunderboltOutlined, CheckCircleOutlined, SafetyCertificateOutlined, UserOutlined, RobotOutlined, HeartOutlined, HeartFilled, SwapOutlined, GiftOutlined, CarOutlined, ReloadOutlined, PhoneOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

const { Title, Text } = Typography;

// ── Deterministic seed helper ─────────────────────────────────────
function seed(id, idx = 0) {
  const n = Number(BigInt(id) % BigInt(999983)) + idx * 31337;
  return ((n * 1664525 + 1013904223) & 0x7fffffff);
}
function pick(id, arr, idx = 0) { return arr[seed(id, idx) % arr.length]; }
function rng(id, min, max, idx = 0) { return min + (seed(id, idx) % (max - min + 1)); }

// ══════════════════════════════════════════════════════════════════
// SPEC GENERATOR — dựa vào category + name + price + id
// ══════════════════════════════════════════════════════════════════
function generateSpecs(product) {
  const cat  = product.category_id || '';
  const name = (product.name || '').toLowerCase();
  const pid  = product.id;
  const price = product.price || 0;
  const isMid  = price >= 5_000_000 && price < 15_000_000;
  const isHigh = price >= 15_000_000;

  // ── PHONE ──────────────────────────────────────────────────────
  if (cat === 'cat-phone' || name.includes('điện thoại') || name.includes('iphone') ||
      name.includes('galaxy') || name.includes('smartphone')) {

    const isApple   = name.includes('apple') || name.includes('iphone');
    const isSamsung = name.includes('samsung') || name.includes('galaxy');
    const isXiaomi  = name.includes('xiaomi') || name.includes('redmi') || name.includes('poco');

    const chipsets = isApple
      ? ['Apple A16 Bionic', 'Apple A17 Pro', 'Apple A18', 'Apple A15 Bionic']
      : isSamsung
        ? (isHigh ? ['Snapdragon 8 Gen 3', 'Exynos 2400'] : isMid ? ['Exynos 1380', 'Snapdragon 6 Gen 1'] : ['Exynos 850', 'Snapdragon 4 Gen 2'])
        : isXiaomi
          ? (isHigh ? ['Snapdragon 8 Gen 3'] : isMid ? ['Dimensity 8200', 'Snapdragon 7s Gen 2'] : ['Dimensity 6080', 'Helio G99'])
          : (isHigh ? ['Snapdragon 8 Gen 3', 'Dimensity 9300'] : isMid ? ['Dimensity 7050', 'Snapdragon 6 Gen 1'] : ['Helio G85', 'Dimensity 6100+']);

    const screens   = ['6.1"', '6.4"', '6.5"', '6.6"', '6.7"', '6.8"'];
    const panelTypes= isApple ? ['Super Retina XDR (OLED)'] : isHigh ? ['Dynamic AMOLED 2X', 'LTPO OLED'] : isMid ? ['AMOLED', 'Super AMOLED'] : ['IPS LCD', 'TFT LCD'];
    const resolutions = isApple ? ['2556 x 1179 px (460ppi)', '2796 x 1290 px (460ppi)'] : isHigh ? ['3088 x 1440 px (QHD+)', '2772 x 1260 px (FHD+)'] : ['2400 x 1080 px (FHD+)', '2340 x 1080 px (FHD+)'];
    const refreshRates= isHigh ? ['120Hz (adaptive)'] : isMid ? ['90Hz', '120Hz'] : ['60Hz', '90Hz'];
    const rams      = isHigh ? [12, 16] : isMid ? [6, 8, 12] : [4, 6, 8];
    const storages  = isHigh ? [256, 512] : isMid ? [128, 256] : [64, 128];
    const mainCams  = isHigh ? ['200MP + 10MP + 10MP', '50MP + 50MP + 10MP', '48MP + 12MP + 12MP'] : isMid ? ['64MP + 8MP + 5MP', '50MP + 8MP + 2MP'] : ['48MP + 2MP', '13MP + 2MP + 2MP'];
    const selfies   = isHigh ? ['32MP', '12MP'] : isMid ? ['16MP', '13MP'] : ['8MP', '5MP'];
    const batteries = isHigh ? [4700, 5000, 5100] : isMid ? [4500, 4800, 5000] : [4000, 4500, 5000];
    const chargings = isHigh ? ['45W có dây, 15W không dây', '65W có dây, 15W không dây', '120W có dây, 50W không dây'] : isMid ? ['25W có dây', '33W có dây'] : ['15W có dây', '10W có dây'];
    const os        = isApple ? 'iOS 18' : 'Android 14';
    const sims      = isApple ? 'Nano SIM + eSIM' : 'Nano SIM + Nano SIM (Dual SIM)';

    const screenSize = pick(pid, screens);
    const ram        = pick(pid, rams, 1);
    const storage    = pick(pid, storages, 2);
    const battery    = pick(pid, batteries, 3);

    return [
      { section: '📱 Màn hình', rows: [
        ['Kích thước', `${screenSize}`],
        ['Công nghệ', pick(pid, panelTypes, 4)],
        ['Độ phân giải', pick(pid, resolutions, 5)],
        ['Tần số quét', pick(pid, refreshRates, 6)],
        ['Độ sáng tối đa', `${rng(pid, 600, 2000, 7)} nits`],
      ]},
      { section: '⚡ Hiệu năng', rows: [
        ['Chipset', pick(pid, chipsets)],
        ['RAM', `${ram} GB`],
        ['Bộ nhớ trong', `${storage} GB`],
        ['Thẻ nhớ ngoài', isApple ? 'Không hỗ trợ' : 'MicroSD (lên đến 1TB)'],
      ]},
      { section: '📷 Camera', rows: [
        ['Camera sau', pick(pid, mainCams, 8)],
        ['Camera trước', pick(pid, selfies, 9)],
        ['Quay phim', isHigh ? '8K @30fps, 4K @60fps' : isMid ? '4K @30fps, 1080p @60fps' : '1080p @30fps'],
        ['Tính năng', 'OIS, AI Camera, Chụp đêm, Zoom quang học'],
      ]},
      { section: '🔋 Pin & Sạc', rows: [
        ['Dung lượng pin', `${battery} mAh`],
        ['Công nghệ sạc', pick(pid, chargings, 10)],
        ['Thời lượng', `${rng(pid, 10, 20, 11)} giờ sử dụng liên tục`],
      ]},
      { section: '📡 Kết nối', rows: [
        ['Mạng di động', isHigh || isMid ? '5G / 4G LTE' : '4G LTE / 3G'],
        ['WiFi', isHigh ? 'Wi-Fi 6E (802.11ax)' : 'Wi-Fi 5 (802.11ac)'],
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : isMid ? '5.2' : '5.1'}`],
        ['NFC', isApple || isMid || isHigh ? 'Có' : 'Không'],
        ['GPS', 'GPS, GLONASS, BeiDou, Galileo'],
        ['Cổng kết nối', isApple ? 'USB-C (USB 3)' : 'USB Type-C'],
        ['SIM', sims],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Hệ điều hành', os],
        ['Kháng nước', isHigh ? 'IP68 — Chống nước 6m/30 phút' : isMid ? 'IP67' : 'Chống nước cơ bản'],
        ['Cảm biến bảo mật', isApple ? 'Face ID' : isHigh ? 'Vân tay dưới màn hình + Nhận diện khuôn mặt' : 'Vân tay cạnh máy'],
        ['Kích thước', `${rng(pid, 145, 165, 12)} x ${rng(pid, 70, 77, 13)} x ${rng(pid, 75, 90, 14) / 10} mm`],
        ['Trọng lượng', `${rng(pid, 170, 230, 15)} g`],
      ]},
    ];
  }

  // ── LAPTOP ─────────────────────────────────────────────────────
  if (cat === 'cat-laptop' || name.includes('laptop') || name.includes('macbook') ||
      name.includes('notebook') || name.includes('vivobook') || name.includes('thinkpad')) {

    const isApple   = name.includes('apple') || name.includes('macbook');
    const isGaming  = name.includes('rog') || name.includes('gaming') || name.includes('razer') ||
                      name.includes('msi') || name.includes('nitro') || name.includes('tuf');

    const cpus = isApple
      ? ['Apple M3', 'Apple M3 Pro', 'Apple M4', 'Apple M2 Pro']
      : isGaming
        ? ['Intel Core i9-14900HX', 'AMD Ryzen 9 7945HX', 'Intel Core i7-14700HX', 'AMD Ryzen 7 7745HX']
        : isHigh
          ? ['Intel Core Ultra 7 165H', 'AMD Ryzen 7 8845HS', 'Intel Core i7-1360P']
          : isMid
            ? ['Intel Core i5-1335U', 'AMD Ryzen 5 7530U', 'Intel Core i5-13500H']
            : ['Intel Core i3-1215U', 'AMD Ryzen 5 5625U', 'Celeron N5100'];

    const gpus = isApple
      ? ['Apple GPU 16-core', 'Apple GPU 18-core', 'Apple GPU 30-core']
      : isGaming
        ? ['NVIDIA GeForce RTX 4080 16GB', 'NVIDIA GeForce RTX 4070 8GB', 'NVIDIA GeForce RTX 4060 8GB']
        : isHigh
          ? ['NVIDIA GeForce RTX 4050 6GB', 'Intel Arc Graphics', 'AMD Radeon 780M']
          : ['Intel Iris Xe Graphics', 'AMD Radeon Graphics', 'Intel UHD Graphics'];

    const screens    = isGaming ? ['15.6"', '16"', '17.3"'] : ['13.3"', '14"', '15.6"', '16"'];
    const resolutions= isHigh || isGaming ? ['2560 x 1600 (QHD+)', '1920 x 1200 (FHD+)', '2560 x 1440 (QHD)'] : ['1920 x 1080 (FHD)', '1920 x 1200 (FHD+)'];
    const refreshRates = isGaming ? ['144Hz', '165Hz', '240Hz', '300Hz'] : ['60Hz', '90Hz', '120Hz'];
    const rams       = isHigh || isGaming ? [16, 32, 64] : isMid ? [8, 16] : [8];
    const ssds       = isHigh || isGaming ? [512, 1024, 2048] : isMid ? [256, 512] : [256];
    const batteries  = isApple ? ['70Wh, ~18 giờ'] : isGaming ? ['90Wh, ~4-6 giờ', '99Wh, ~5-7 giờ'] : ['50Wh, ~8-10 giờ', '65Wh, ~10-12 giờ'];

    const ram = pick(pid, rams, 1);
    const ssd = pick(pid, ssds, 2);

    return [
      { section: '💻 Màn hình', rows: [
        ['Kích thước', pick(pid, screens)],
        ['Độ phân giải', pick(pid, resolutions, 4)],
        ['Tần số quét', pick(pid, refreshRates, 5)],
        ['Công nghệ', isApple ? 'Liquid Retina XDR (Mini-LED)' : isHigh ? 'IPS-level OLED' : isGaming ? 'IPS 300nits' : 'IPS Anti-glare'],
        ['Cảm ứng', isHigh ? 'Có' : 'Không'],
      ]},
      { section: '⚡ Hiệu năng', rows: [
        ['CPU', pick(pid, cpus)],
        ['RAM', `${ram} GB DDR${isHigh || isGaming ? '5' : '4'}`],
        ['Tốc độ RAM', `${isHigh ? '5600' : '4800'} MHz`],
        ['Ổ cứng', `${ssd} GB SSD NVMe PCIe ${isHigh ? '4.0' : '3.0'}`],
        ['Card đồ họa', pick(pid, gpus, 6)],
      ]},
      { section: '🔋 Pin & Sạc', rows: [
        ['Pin', pick(pid, batteries, 7)],
        ['Bộ sạc đi kèm', isGaming ? '200W' : isHigh ? '96W USB-C' : '65W USB-C'],
        ['Sạc nhanh', 'Có'],
      ]},
      { section: '🔌 Cổng kết nối', rows: [
        ['USB-A', isApple ? 'Không' : `${rng(pid, 1, 3, 8)}x USB-A 3.2`],
        ['USB-C / Thunderbolt', isApple ? '2x Thunderbolt 4 (USB-C)' : isHigh ? '1x Thunderbolt 4 + 1x USB-C' : '1x USB-C'],
        ['HDMI', isApple ? 'HDMI 2.1' : isGaming ? '2x HDMI 2.1' : '1x HDMI 1.4'],
        ['Đọc thẻ nhớ', isApple ? 'SD card' : isGaming ? 'SD card' : 'Không'],
        ['Jack tai nghe', '3.5mm combo'],
      ]},
      { section: '📡 Không dây', rows: [
        ['WiFi', isHigh || isGaming ? 'Wi-Fi 6E (802.11ax)' : 'Wi-Fi 5 (802.11ac)'],
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : '5.0'}`],
        ['Webcam', '1080p FHD, IR (nhận diện khuôn mặt)'],
      ]},
      { section: 'ℹ️ Thông tin khác', rows: [
        ['Hệ điều hành', isApple ? 'macOS Sequoia' : isGaming ? 'Windows 11 Home' : 'Windows 11 Home'],
        ['Kích thước', `${rng(pid, 304, 360, 9)} x ${rng(pid, 210, 245, 10)} x ${rng(pid, 14, 22, 11)} mm`],
        ['Trọng lượng', `${(rng(pid, 12, 25, 12) / 10).toFixed(1)} kg`],
        ['Vật liệu', isApple ? 'Nhôm nguyên khối' : isHigh ? 'Nhôm + Magie' : 'Nhựa ABS cao cấp'],
        ['Bảo mật', 'Vân tay tích hợp phím nguồn' + (isApple || isHigh ? ' + Face ID/IR camera' : '')],
      ]},
    ];
  }

  // ── TABLET ─────────────────────────────────────────────────────
  if (cat === 'cat-tablet' || name.includes('ipad') || name.includes('tablet') || name.includes('máy tính bảng')) {
    const isApple = name.includes('ipad') || name.includes('apple');
    const screens  = ['10.2"', '10.9"', '11"', '12.9"', '13"'];
    const chips    = isApple ? ['Apple M2', 'Apple M4', 'Apple A16', 'Apple A15'] : ['Snapdragon 870', 'Dimensity 9000', 'Exynos 1380', 'Dimensity 7050'];
    const rams     = isHigh ? [8, 16] : isMid ? [4, 6, 8] : [4, 6];
    const storages = isHigh ? [256, 512, 1024] : isMid ? [128, 256] : [64, 128];
    const batteries= ['7606mAh', '8557mAh', '10090mAh', '11200mAh'];

    return [
      { section: '📱 Màn hình', rows: [
        ['Kích thước', pick(pid, screens)],
        ['Công nghệ', isApple ? 'Liquid Retina (IPS)' : isHigh ? 'AMOLED' : 'IPS LCD'],
        ['Độ phân giải', isApple ? '2732 x 2048 px' : '2560 x 1600 px'],
        ['Cảm ứng', 'Đa điểm, hỗ trợ bút stylus'],
      ]},
      { section: '⚡ Hiệu năng', rows: [
        ['Chipset', pick(pid, chips)],
        ['RAM', `${pick(pid, rams, 1)} GB`],
        ['Bộ nhớ', `${pick(pid, storages, 2)} GB`],
        ['Hỗ trợ 5G/4G', isHigh ? 'Có (5G + WiFi)' : 'WiFi only'],
      ]},
      { section: '🔋 Pin', rows: [
        ['Pin', pick(pid, batteries, 3)],
        ['Thời lượng', `${rng(pid, 8, 12, 4)} giờ`],
        ['Sạc', isApple ? '20W USB-C' : '18W USB-C'],
      ]},
      { section: '📡 Kết nối', rows: [
        ['WiFi', 'Wi-Fi 6 (802.11ax)'],
        ['Bluetooth', 'Bluetooth 5.3'],
        ['Cổng', isApple ? 'USB-C / Thunderbolt 4' : 'USB-C 3.1'],
        ['Camera sau', `${rng(pid, 8, 12, 5)} MP`],
        ['Camera trước', `${rng(pid, 7, 12, 6)} MP`],
      ]},
    ];
  }

  // ── SMARTWATCH ─────────────────────────────────────────────────
  if (cat === 'cat-watch' || name.includes('watch') || name.includes('đồng hồ')) {
    const isApple   = name.includes('apple');
    const isSamsung = name.includes('samsung') || name.includes('galaxy watch');
    const isGarmin  = name.includes('garmin');

    const panels = isApple ? ['LTPO OLED, Always-On'] : isSamsung ? ['Dynamic AMOLED 2X, Always-On'] : isGarmin ? ['MIP Transflective'] : ['AMOLED'];
    const sizes  = ['1.4"', '1.6"', '1.7"', '1.8"', '1.9"'];
    const batteryDays = isApple ? ['18 giờ', '36 giờ (tiết kiệm)'] : isSamsung ? ['40 giờ', '3-4 ngày'] : isGarmin ? ['14 ngày', '21 ngày', '28 ngày'] : ['5-7 ngày', '10-14 ngày'];
    const waterResistances = isApple ? ['50m (WR50M)'] : ['5ATM (50m)', '10ATM (100m)', 'IP68'];

    return [
      { section: '⌚ Màn hình', rows: [
        ['Kích thước', pick(pid, sizes)],
        ['Công nghệ', pick(pid, panels)],
        ['Độ phân giải', `${rng(pid, 360, 480, 1)} x ${rng(pid, 360, 480, 2)} px`],
        ['Mật độ điểm ảnh', `${rng(pid, 326, 450, 3)} ppi`],
      ]},
      { section: '❤️ Cảm biến sức khỏe', rows: [
        ['Đo nhịp tim', 'Liên tục 24/7'],
        ['Đo SpO2', 'Có'],
        ['ECG', isApple || isSamsung ? 'Có' : 'Không'],
        ['Theo dõi giấc ngủ', 'Có'],
        ['GPS', isApple || isGarmin ? 'GPS + GLONASS + Galileo' : 'GPS'],
        ['Cảm biến khác', 'Gia tốc, con quay hồi chuyển, la bàn, nhiệt độ da'],
      ]},
      { section: '🔋 Pin', rows: [
        ['Thời lượng', pick(pid, batteryDays, 4)],
        ['Sạc', isApple ? 'MagSafe 18W' : 'Sạc không dây 10W'],
      ]},
      { section: '📡 Kết nối', rows: [
        ['Bluetooth', `Bluetooth ${rng(pid, 50, 53, 5) / 10}`],
        ['WiFi', 'Wi-Fi 802.11b/g/n'],
        ['NFC', isApple || isSamsung ? 'Có (thanh toán)' : 'Không'],
        ['Kháng nước', pick(pid, waterResistances, 6)],
      ]},
    ];
  }

  // ── HEADPHONE / EARPHONE ───────────────────────────────────────
  if (cat.includes('earphone') || cat.includes('headphone') || cat === 'cat-av-bt-earphone' ||
      cat === 'cat-av-headphone' || cat === 'cat-av-wire-earphone' || cat === 'cat-av-sport-earphone' ||
      name.includes('tai nghe') || name.includes('headphone') || name.includes('earhook') ||
      name.includes('airpods')) {

    const isWireless  = !name.includes('dây') && (name.includes('bluetooth') || name.includes('bt') || name.includes('airpods') || name.includes('tws') || name.includes('wireless') || cat.includes('bt'));
    const isANC       = name.includes('anc') || name.includes('noise cancel') || name.includes('xm5') || name.includes('xm4');
    const isOverEar   = cat === 'cat-av-headphone' || name.includes('chụp tai') || name.includes('over-ear');

    const drivers     = isOverEar ? ['40mm', '42mm', '45mm'] : ['6mm', '8mm', '10mm', '12mm'];
    const freqResponse= ['20Hz – 20kHz', '5Hz – 40kHz', '10Hz – 40kHz'];
    const batteries   = isOverEar ? ['30h ANC On, 40h ANC Off'] : isWireless ? ['6h (tai) + 24h (hộp)', '8h (tai) + 32h (hộp)', '5h (tai) + 20h (hộp)'] : [];
    const codecs      = isWireless ? (isHigh ? ['AAC, aptX HD, LDAC, LC3'] : ['AAC, SBC, aptX']) : [];

    const rows_connection = isWireless
      ? [['Bluetooth', `Bluetooth ${isHigh ? '5.3' : '5.2'}`], ['Codec', pick(pid, codecs, 1)], ['Kết nối đồng thời', '2 thiết bị']]
      : [['Cổng kết nối', '3.5mm Jack'], ['Dây cáp', `${rng(pid, 12, 15, 1) / 10} m`]];

    return [
      { section: '🎵 Âm thanh', rows: [
        ['Driver', pick(pid, drivers)],
        ['Dải tần', pick(pid, freqResponse, 2)],
        ['Impedance', `${pick(pid, [16, 32, 150, 300])} Ω`],
        ['Độ nhạy', `${rng(pid, 95, 110, 3)} dB`],
        ['Chống ồn chủ động (ANC)', isANC ? 'Có, giảm đến -40dB' : 'Không'],
        ['Chế độ xuyên âm (Transparency)', isANC && isHigh ? 'Có' : 'Không'],
      ]},
      { section: '📡 Kết nối', rows: rows_connection },
      ...(batteries.length ? [{ section: '🔋 Pin', rows: [
        ['Thời lượng', pick(pid, batteries, 4)],
        ['Sạc nhanh', isHigh ? '5 phút sạc = 1 giờ nghe' : '10 phút sạc = 1 giờ nghe'],
        ['Sạc', 'USB-C / Wireless Qi'],
      ]}] : []),
      { section: 'ℹ️ Khác', rows: [
        ['Chống nước', isHigh ? 'IPX4 – Chống nước tiêu chuẩn' : isWireless ? 'IPX4' : 'Không'],
        ['Micro', 'Có (thông minh, lọc tiếng ồn)'],
        ['Điều khiển', 'Cảm ứng / Nút nhấn'],
        ['Trọng lượng', `${rng(pid, isOverEar ? 200 : 4, isOverEar ? 350 : 8, 5)} g`],
      ]},
    ];
  }

  // ── CAMERA ─────────────────────────────────────────────────────
  if (cat.startsWith('cat-cam') || name.includes('camera') || name.includes('cam ') ||
      name.includes('giám sát') || name.includes('webcam')) {

    const isOutdoor   = name.includes('ngoài trời') || name.includes('outdoor') || cat === 'cat-cam-outdoor' || cat === 'cat-cam-4g' || cat === 'cat-cam-solar';
    const is4G        = name.includes('4g') || cat === 'cat-cam-4g';
    const isSolar     = name.includes('năng lượng') || cat === 'cat-cam-solar';
    const resolutions = ['2MP (1080p)', '4MP (2K)', '8MP (4K)', '5MP (3K)'];
    const ips         = isOutdoor ? ['IP67', 'IP68', 'IK10'] : ['IP65', 'IP66'];
    const visions     = ['20m hồng ngoại', '30m hồng ngoại', '50m Starlight', '40m Full Color'];

    return [
      { section: '📷 Camera', rows: [
        ['Độ phân giải', pick(pid, resolutions)],
        ['Cảm biến', `1/2.7" Progressive CMOS`],
        ['Góc nhìn', `${rng(pid, 90, 130, 1)}°`],
        ['Tốc độ chụp', `${rng(pid, 15, 30, 2)} hình/giây`],
        ['WDR/HDR', `${rng(pid, 100, 130, 3)}dB`],
      ]},
      { section: '🌙 Ban đêm', rows: [
        ['Tầm nhìn đêm', pick(pid, visions, 4)],
        ['Chế độ ban đêm', 'Full Color (ánh sáng thấp) + Hồng ngoại'],
        ['Độ sáng tối thiểu', `${rng(pid, 0, 2, 5) / 100} Lux (màu)`],
      ]},
      { section: '🔌 Kết nối', rows: [
        ['WiFi', '802.11b/g/n 2.4GHz' + (isHigh ? ' + 5GHz' : '')],
        ...(is4G ? [['4G LTE', 'Nano SIM, hỗ trợ mọi mạng']] : []),
        ...(isSolar ? [['Năng lượng', 'Pin mặt trời + Pin Li-ion dự phòng']] : []),
        ['PoE', isOutdoor && isHigh ? 'IEEE 802.3af' : 'Không'],
        ['Cổng', 'RJ45 Ethernet'],
      ]},
      { section: '💾 Lưu trữ', rows: [
        ['MicroSD', 'Tối đa 256GB'],
        ['Lưu trữ đám mây', 'Hỗ trợ Hikvision/IMOU/EZVIZ Cloud'],
        ['NAS/NVR', 'Hỗ trợ qua giao thức ONVIF'],
      ]},
      { section: 'ℹ️ Khác', rows: [
        ['Chuẩn kháng bụi/nước', pick(pid, ips, 6)],
        ['Nhiệt độ hoạt động', isOutdoor ? `-30°C đến +60°C` : `-10°C đến +50°C`],
        ['Nguồn điện', is4G || isSolar ? 'DC 12V hoặc PoE' : 'DC 12V / PoE'],
        ['Âm thanh 2 chiều', name.includes('two-way') || name.includes('2-way') ? 'Có (loa + micro)' : 'Loa 1 chiều'],
        ['Phát hiện chuyển động', 'AI PIR – Giảm cảnh báo giả'],
      ]},
    ];
  }

  // ── SPEAKER ────────────────────────────────────────────────────
  if (cat === 'cat-av-speaker' || name.includes('loa') || name.includes('speaker')) {
    const powers = isHigh ? ['50W', '60W', '80W', '100W'] : isMid ? ['20W', '30W', '40W'] : ['5W', '10W', '15W'];
    const batteries = isHigh ? ['20h', '24h'] : isMid ? ['12h', '15h', '18h'] : ['6h', '8h', '10h'];

    return [
      { section: '🔊 Âm thanh', rows: [
        ['Công suất', pick(pid, powers)],
        ['Driver', `${rng(pid, 2, 4, 1)}x woofer + tweeter`],
        ['Dải tần', `${rng(pid, 40, 80, 2)}Hz – 20kHz`],
        ['Hiệu ứng', name.includes('360') ? 'Âm thanh 360°' : 'Stereo / Bass Boost'],
      ]},
      { section: '🔋 Pin & Sạc', rows: [
        ['Thời lượng pin', pick(pid, batteries, 3)],
        ['Sạc', 'USB-C / DC Adapter'],
        ['Sạc nhanh', isHigh ? 'Có' : 'Không'],
      ]},
      { section: '📡 Kết nối', rows: [
        ['Bluetooth', `Bluetooth ${isHigh ? '5.3' : '5.0'}`],
        ['Jack 3.5mm', 'Có'],
        ['MicroSD', isHigh ? 'Có (lên đến 256GB)' : 'Có (lên đến 128GB)'],
        ['TWS (ghép đôi)', 'Có — ghép 2 loa Stereo'],
        ['Kháng nước', isHigh ? 'IP67' : isMid ? 'IPX5' : 'IPX4'],
      ]},
    ];
  }

  // ── ACCESSORIES ────────────────────────────────────────────────
  if (cat.startsWith('cat-mobile-acc') || cat.startsWith('cat-laptop-acc')) {
    const specs = [];

    if (name.includes('sạc') || name.includes('charger') || cat === 'cat-mobile-acc-charger') {
      const watts = isHigh ? [65, 100, 120] : isMid ? [25, 45, 65] : [10, 15, 20];
      specs.push(
        { section: '⚡ Thông số', rows: [
          ['Công suất tối đa', `${pick(pid, watts)}W GaN`],
          ['Cổng ra', `${rng(pid, 1, 3, 1)}x USB-C + ${rng(pid, 0, 2, 2)}x USB-A`],
          ['Điện áp vào', '100–240V (toàn cầu)'],
          ['Chuẩn sạc', isHigh ? 'USB-PD 3.1, QC 5.0, PPS' : 'USB-PD, QC 3.0'],
          ['Kích thước', `${rng(pid, 50, 80, 3)} x ${rng(pid, 30, 50, 4)} x ${rng(pid, 25, 35, 5)} mm`],
          ['Trọng lượng', `${rng(pid, 80, 200, 6)} g`],
        ]},
      );
    } else if (name.includes('pin dự phòng') || name.includes('powerbank') || cat === 'cat-mobile-acc-powerbank') {
      const caps = isHigh ? [20000, 25000, 30000] : isMid ? [10000, 15000, 20000] : [5000, 10000];
      specs.push(
        { section: '🔋 Thông số', rows: [
          ['Dung lượng pin', `${pick(pid, caps)} mAh`],
          ['Công suất sạc ra', isHigh ? '65W PD' : isMid ? '22.5W' : '10W'],
          ['Cổng ra', `2x USB-A + 1x USB-C`],
          ['Sạc vào', 'USB-C PD'],
          ['Sạc không dây', isHigh ? `${rng(pid, 10, 15, 1)}W Qi` : 'Không'],
          ['Màn hình LED', isHigh || isMid ? 'Hiển thị % pin' : 'LED 4 chấm'],
          ['Trọng lượng', `${rng(pid, 200, 500, 2)} g`],
        ]},
      );
    } else if (name.includes('ốp lưng') || name.includes('case') || cat === 'cat-mobile-acc-case-phone') {
      specs.push(
        { section: '📱 Thông tin', rows: [
          ['Chất liệu', pick(pid, ['TPU cao cấp', 'Silicone mềm', 'PC cứng + TPU', 'Da PU tổng hợp'])],
          ['Độ dày', `${rng(pid, 8, 15, 1) / 10} mm`],
          ['Chuẩn chống va đập', pick(pid, ['MIL-STD-810H', 'Chống rơi 1.5m', 'Chống va đập 4 góc', 'Airbag 4 góc'])],
          ['Kháng vàng bạc', 'Chống ố vàng, chống trầy'],
          ['Tính năng', 'Hỗ trợ sạc không dây, NFC xuyên ốp'],
          ['Trọng lượng', `${rng(pid, 25, 60, 2)} g`],
        ]},
      );
    } else {
      // Generic accessory
      specs.push(
        { section: 'ℹ️ Thông số', rows: [
          ['Chất liệu', pick(pid, ['Nhôm cao cấp', 'Nhựa ABS', 'Hợp kim kẽm', 'PC + TPU'])],
          ['Kích thước', `${rng(pid, 10, 30, 1)} x ${rng(pid, 5, 15, 2)} x ${rng(pid, 2, 8, 3)} cm`],
          ['Trọng lượng', `${rng(pid, 50, 500, 4)} g`],
          ['Bảo hành', '12 tháng'],
        ]},
      );
    }
    return specs;
  }

  // ── DEFAULT fallback ────────────────────────────────────────────
  return [
    { section: 'ℹ️ Thông tin sản phẩm', rows: [
      ['Thương hiệu', product.brand_id?.replace('br-', '').toUpperCase() || 'N/A'],
      ['Danh mục', product.category_id || 'N/A'],
      ['Bảo hành', '12 tháng chính hãng'],
      ['Xuất xứ', pick(pid, ['Việt Nam', 'Hàn Quốc', 'Nhật Bản', 'Mỹ', 'Trung Quốc'])],
    ]},
  ];
}

// ── Generate product highlights (max 4) ─────────────────────────
function generateHighlights(product) {
  const cat  = product.category_id || '';
  const name = (product.name || '').toLowerCase();
  const pid  = product.id;
  const price = product.price || 0;
  const isHigh = price >= 15_000_000;
  const isMid  = price >= 5_000_000;

  if (cat === 'cat-phone' || name.includes('iphone') || name.includes('galaxy') || name.includes('điện thoại')) {
    return [
      { icon: '📱', text: `Màn hình ${pick(pid, ['AMOLED', 'OLED', 'Super AMOLED'])} ${pick(pid, ['6.4"', '6.6"', '6.7"'])}` },
      { icon: '⚡', text: `Chip ${isHigh ? 'Flagship' : isMid ? 'Tầm trung' : 'Phổ thông'} mạnh mẽ` },
      { icon: '🔋', text: `Pin ${pick(pid, ['4500', '5000', '4700'], 1)} mAh, sạc nhanh` },
      { icon: isHigh ? '🌊' : '📸', text: isHigh ? 'Kháng nước IP67/IP68' : `Camera ${pick(pid, ['64MP', '50MP', '108MP'], 2)} AI` },
    ];
  }
  if (cat === 'cat-laptop' || name.includes('laptop') || name.includes('macbook')) {
    const isGaming = name.includes('rog') || name.includes('gaming') || name.includes('msi');
    return [
      { icon: '⚡', text: `CPU ${pick(pid, ['Intel Core i7', 'AMD Ryzen 7', 'Intel Core i9'])} Gen mới nhất` },
      { icon: '💾', text: `RAM ${pick(pid, [8, 16, 32], 1)}GB + SSD ${pick(pid, [256, 512, 1024], 2)}GB` },
      { icon: '🖥️', text: `Màn hình ${pick(pid, ['Full HD', 'QHD', '2K'], 3)} ${isGaming ? '144Hz' : 'IPS'}` },
      { icon: '🔋', text: `Pin ${pick(pid, [8, 10, 12], 4)} giờ — ${isGaming ? 'Sạc 200W' : 'Sạc USB-C 65W'}` },
    ];
  }
  if (cat === 'cat-watch' || name.includes('watch') || name.includes('đồng hồ')) {
    return [
      { icon: '❤️', text: 'Theo dõi sức khỏe 24/7 — Nhịp tim, SpO2, ECG' },
      { icon: '🏃', text: `${pick(pid, ['40+', '80+', '100+'])} chế độ tập luyện` },
      { icon: '🔋', text: `Pin ${pick(pid, ['3-5', '7-10', '14'], 1)} ngày liên tục` },
      { icon: '🌊', text: `Kháng nước ${pick(pid, ['5ATM', 'IP68', '10ATM'], 2)}` },
    ];
  }
  if (cat.startsWith('cat-av') || name.includes('tai nghe') || name.includes('loa')) {
    const isANC = name.includes('anc') || name.includes('noise cancel');
    return [
      { icon: '🎵', text: `Driver ${pick(pid, ['10mm', '12mm', '40mm'])} cho âm thanh đỉnh cao` },
      { icon: '🔋', text: `Pin ${pick(pid, ['8h', '24h', '30h'], 1)} liên tục` },
      { icon: '📡', text: `Bluetooth ${pick(pid, ['5.2', '5.3'], 2)} — Ghép nối tức thì` },
      { icon: isANC ? '🔇' : '💧', text: isANC ? 'Chống ồn chủ động (ANC)' : 'Kháng nước IPX4/IPX5' },
    ];
  }
  return [
    { icon: '✅', text: 'Chính hãng 100% — Bảo hành chính hãng' },
    { icon: '🚚', text: 'Giao hàng toàn quốc trong 2–4 giờ' },
    { icon: '↩️', text: 'Đổi trả miễn phí 30 ngày' },
    { icon: '💳', text: 'Trả góp 0% lãi suất qua thẻ tín dụng' },
  ];
}

// ── Generate product description ────────────────────────────────
function generateDescription(product) {
  const cat   = product.category_id || '';
  const name  = product.name || '';
  const brand = name.split(' ')[0];
  const price = product.price || 0;
  const tier  = price >= 15_000_000 ? 'cao cấp' : price >= 5_000_000 ? 'tầm trung' : 'phổ thông';

  if (cat === 'cat-phone' || cat.includes('phone')) {
    return `${name} là chiếc điện thoại ${tier} nổi bật từ ${brand}, được trang bị những công nghệ tiên tiến nhất trong phân khúc. Với thiết kế sang trọng, hiệu năng mạnh mẽ và hệ thống camera ấn tượng, sản phẩm đáp ứng mọi nhu cầu làm việc và giải trí của người dùng hiện đại.`;
  }
  if (cat === 'cat-laptop' || cat.includes('laptop')) {
    const isGaming = name.toLowerCase().includes('rog') || name.toLowerCase().includes('gaming');
    return `${name} là ${isGaming ? 'laptop gaming' : 'laptop'} ${tier} từ ${brand}. ${isGaming ? 'Được thiết kế dành riêng cho game thủ với hiệu năng đỉnh cao, tản nhiệt hiệu quả và màn hình tần số cao.' : 'Lý tưởng cho công việc và học tập với hiệu năng mạnh, pin bền và thiết kế mỏng nhẹ.'} Xử lý mượt mà các tác vụ nặng từ lập trình, thiết kế đồ họa đến gaming.`;
  }
  if (cat.startsWith('cat-cam')) {
    return `${name} là giải pháp giám sát thông minh từ ${brand}, phù hợp với nhu cầu bảo vệ gia đình và doanh nghiệp. Tích hợp AI phát hiện chuyển động, camera hồng ngoại ban đêm và kết nối từ xa qua smartphone, mang lại sự an tâm tuyệt đối.`;
  }
  return `${name} là sản phẩm ${tier} chất lượng cao từ thương hiệu ${brand} uy tín. Với thiết kế tinh tế và công nghệ hiện đại, sản phẩm mang lại trải nghiệm vượt trội cho người dùng.`;
}

// ══════════════════════════════════════════════════════════════════
// SPEC TABLE component
// ══════════════════════════════════════════════════════════════════
function SpecTable({ specs, isDark }) {
  return (
    <div style={{ padding: '24px 0' }}>
      {specs.map((section, si) => (
        <div key={si} style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 15, fontWeight: 700,
            color: isDark ? '#10b981' : '#047857',
            background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
            padding: '8px 16px', borderRadius: 8, marginBottom: 2,
            borderLeft: '3px solid #10b981',
          }}>
            {section.section}
          </div>
          {section.rows.map(([label, value], ri) => (
            <div key={ri} style={{
              display: 'flex', padding: '11px 16px',
              background: ri % 2 === 0
                ? (isDark ? 'rgba(255,255,255,0.02)' : '#fafafa')
                : (isDark ? 'transparent' : '#fff'),
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f3f4f6',
            }}>
              <span style={{
                width: '40%', color: isDark ? '#888' : '#666',
                fontSize: 14, fontWeight: 500, flexShrink: 0,
              }}>{label}</span>
              <span style={{
                flex: 1, color: isDark ? '#e5e7eb' : '#1a1a1a',
                fontSize: 14, fontWeight: 500,
              }}>{value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const carouselRef = useRef(null);
  const { addToCart } = useCart();
  const { isDark, t, wishlist, toggleWishlist, compareList, toggleCompare, recentlyViewed, addRecentlyViewed } = useApp();
  const navigate = useNavigate();

  const [zoomScale, setZoomScale] = useState(1);
  const [transformOrigin, setTransformOrigin] = useState('center center');

  // Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Category-aware fallback
  function getFallback(categoryId) {
    const c = categoryId || '';
    if (c === 'cat-phone') return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80&auto=format';
    if (c === 'cat-laptop') return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format';
    if (c === 'cat-tablet') return 'https://images.unsplash.com/photo-1544244015-0df4512b8c72?w=400&h=400&fit=crop&q=80&auto=format';
    if (c === 'cat-watch') return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop&q=80&auto=format';
    if (c.startsWith('cat-av') || c.includes('earphone') || c.includes('headphone') || c.includes('speaker')) return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&q=80&auto=format';
    if (c.startsWith('cat-cam')) return 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=400&fit=crop&q=80&auto=format';
    if (c.startsWith('cat-mobile-acc')) return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80&auto=format';
    if (c.startsWith('cat-laptop-acc')) return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format';
    return 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop&q=80&auto=format';
  }

  useEffect(() => {
    async function load() {
      try {
        const data = await api.b2c.getProductDetails(id);
        setProduct(data);
        if (data.image) setMainImage(data.image);
        else if (data.images && data.images.length > 0) setMainImage(data.images[0]);
        if (data.variants && data.variants.length > 0) setSelectedVariantId(data.variants[0].id);
        addRecentlyViewed(data);
        const allProds = await api.b2c.getProducts(data.category_id);
        setRelatedProducts(allProds.filter(p => p.id != id).slice(0, 4));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:8080`;
    const ws = new WebSocket(wsHost);
    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'STOCK_UPDATE') {
          const data = await api.b2c.getProductDetails(id);
          setProduct(data);
        }
      } catch (err) {}
    };
    ws.onerror = () => {};
    return () => { if (ws.readyState === 1) ws.close(); };
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>;
  if (!product) return <div style={{ textAlign: 'center', marginTop: 100, color: '#fff' }}>Sản phẩm không tồn tại</div>;

  const activeVariant = product?.variants?.find(v => v.id === selectedVariantId);
  const currentPrice  = activeVariant?.price || product?.price;
  const currentStock  = activeVariant?.stock ?? product?.stock;
  const isWished      = wishlist?.some(p => p.id === product.id);
  const isCompared    = compareList?.some(p => p.id === product.id);
  const allImages     = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];

  // Generate rich specs
  const specs       = generateSpecs(product);
  const highlights  = generateHighlights(product);
  const description = generateDescription(product);

  const discountPct = product.original_price > currentPrice
    ? Math.round(100 - (currentPrice / product.original_price) * 100) : 0;

  const getProductToAdd = () => {
    const p = { ...product };
    if (selectedVariantId) {
      const variant = product.variants.find(v => v.id === selectedVariantId);
      if (variant) { p.selectedVariant = variant; p.price = variant.price; }
    }
    return p;
  };

  const handleAddToCart = () => addToCart(getProductToAdd(), 1);
  const handleBuyNow = () => { addToCart(getProductToAdd(), 1); navigate('/checkout'); };

  const submitReview = async () => {
    if (!reviewComment.trim()) return message.error('Vui lòng nhập nội dung đánh giá!');
    try {
      setSubmittingReview(true);
      const res = await api.b2c.addReview(id, { rating: reviewRating, comment: reviewComment });
      if (res.success) {
        message.success('Đánh giá của bạn đã được gửi thành công!');
        setProduct({ ...product, reviews: [res.review, ...(product.reviews || [])] });
        setReviewComment(''); setReviewRating(5);
      }
    } catch (err) { message.error('Lỗi khi gửi đánh giá'); }
    finally { setSubmittingReview(false); }
  };

  const handleMouseEnter = () => setZoomScale(2.5);
  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    setTransformOrigin(`${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`);
  };
  const handleMouseLeave = () => { setZoomScale(1); setTransformOrigin('center center'); };

  return (
    <div style={{ padding: '100px 48px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <Breadcrumb style={{ marginBottom: 24, fontSize: 14 }} items={[
        { title: <span onClick={() => navigate('/')} style={{ cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>{t('nav.home')}</span> },
        { title: <span style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>{t(`home.category_${product.category_id}`)}</span> },
        { title: <span style={{ color: isDark ? '#fff' : '#000' }}>{product.name}</span> }
      ]} />

      {/* ── MAIN PANEL ─────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: 48, borderRadius: 24, marginBottom: 24 }}>
        <Row gutter={[48, 48]} align="top">
          {/* IMAGE */}
          <Col xs={24} md={11}>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9', borderRadius: 24, padding: 40, marginBottom: 16 }}>
              <Carousel ref={carouselRef} dots={false} effect="scrollx"
                beforeChange={(from, to) => { setMainImage(allImages[to]); setZoomScale(1); }}>
                {allImages.map((img, idx) => (
                  <div key={idx}>
                    <div onMouseEnter={handleMouseEnter} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
                      style={{ display: 'flex', justifyContent: 'center', width: '100%', height: 400, overflow: 'hidden', cursor: 'zoom-in' }}>
                      <img src={img} alt={`${product.name} - ${idx}`} width={400} height={400}
                        style={{ width: '100%', maxWidth: 400, height: '100%', objectFit: 'contain',
                          transform: `scale(${zoomScale})`, transformOrigin,
                          transition: zoomScale === 1 ? 'transform 0.3s ease' : 'none' }}
                        onError={(e) => { e.target.onerror = null; e.target.src = getFallback(product.category_id); }} />
                    </div>
                  </div>
                ))}
              </Carousel>
            </div>
            {allImages.length > 1 && (
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {allImages.map((img, idx) => (
                  <div key={idx} onClick={() => { setMainImage(img); if (carouselRef.current) carouselRef.current.goTo(idx); }}
                    style={{ width: 80, height: 80, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                      border: mainImage === img ? '2px solid #10b981' : (isDark ? '2px solid #333' : '2px solid #eee'),
                      padding: 8, background: isDark ? '#111' : '#fff' }}>
                    <img src={img} width={64} height={64} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="thumb"
                      onError={(e) => { e.target.onerror = null; e.target.src = getFallback(product.category_id); }} />
                  </div>
                ))}
              </div>
            )}
            {/* Trust badges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
              {[
                { icon: <SafetyCertificateOutlined />, text: 'BH chính hãng 12 tháng' },
                { icon: <CarOutlined />, text: 'Giao nhanh 2-4 giờ' },
                { icon: <ReloadOutlined />, text: 'Đổi trả 30 ngày' },
                { icon: <PhoneOutlined />, text: 'Hỗ trợ 24/7' },
              ].map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
                  background: isDark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.06)',
                  border: isDark ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(16,185,129,0.15)',
                  fontSize: 12, color: isDark ? '#10b981' : '#047857', fontWeight: 500,
                }}>
                  <span style={{ fontSize: 16 }}>{b.icon}</span> {b.text}
                </div>
              ))}
            </div>
          </Col>

          {/* PRODUCT INFO */}
          <Col xs={24} md={13}>
            {/* Brand + Category */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                {product.brand_id?.replace('br-', '').replace('b1', 'Apple').replace('b2', 'Samsung').replace('b3', 'Asus').replace('b4', 'Sony').replace('b5', 'Xiaomi').toUpperCase() || 'BRAND'}
              </Tag>
              <Tag color="green" style={{ borderRadius: 6 }}>
                {t(`home.category_${product.category_id}`) || product.category_id}
              </Tag>
              {discountPct > 0 && <Tag color="red" style={{ borderRadius: 6, fontWeight: 700 }}>-{discountPct}%</Tag>}
            </div>

            <Title level={1} style={{ color: isDark ? '#fff' : '#111', fontSize: 28, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>
              {product.name}
            </Title>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Rate disabled defaultValue={product.rating} style={{ fontSize: 14, color: '#facc15' }} />
              <span style={{ color: isDark ? '#aaa' : '#666', fontSize: 13 }}>({product.reviews?.length || 0} đánh giá)</span>
              <Divider type="vertical" />
              <span style={{ color: isDark ? '#aaa' : '#666', fontSize: 13 }}>Đã bán: <strong>{product.sold?.toLocaleString('vi-VN')}</strong></span>
            </div>

            {/* Price */}
            <div style={{
              background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16,
              padding: '16px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16
            }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#10b981' }}>
                {currentPrice.toLocaleString('vi-VN')} đ
              </span>
              {product.original_price > currentPrice && (
                <div>
                  <div style={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,0.4)' : '#999', textDecoration: 'line-through' }}>
                    {product.original_price.toLocaleString('vi-VN')} đ
                  </div>
                  <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                    Tiết kiệm {(product.original_price - currentPrice).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              )}
            </div>

            {/* Highlights bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
              {highlights.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f9f9f9',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f0',
                  fontSize: 13, color: isDark ? '#ddd' : '#333',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{h.icon}</span>
                  <span style={{ lineHeight: 1.4 }}>{h.text}</span>
                </div>
              ))}
            </div>

            {/* Quick specs from first section */}
            {specs[0] && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#888' : '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Thông số chính
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {specs[0].rows.slice(0, 4).map(([k, v], i) => (
                    <div key={i} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 13,
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                      color: isDark ? '#ccc' : '#444',
                    }}>
                      <span style={{ color: isDark ? '#666' : '#999' }}>{k}: </span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: isDark ? '#ccc' : '#555', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
                  {t('product.choose_variant')}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {product.variants.map(v => (
                    <Button key={v.id} size="large" onClick={() => setSelectedVariantId(v.id)}
                      style={{
                        height: 'auto', padding: '8px 16px', borderRadius: 10,
                        borderColor: selectedVariantId === v.id ? '#10b981' : (isDark ? '#444' : '#d9d9d9'),
                        color: selectedVariantId === v.id ? '#10b981' : (isDark ? '#fff' : '#000'),
                        background: selectedVariantId === v.id ? 'rgba(16,185,129,0.1)' : 'transparent',
                        fontWeight: selectedVariantId === v.id ? 700 : 400,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      }}>
                      <span style={{ fontSize: 14 }}>{v.color} {v.storage ? `- ${v.storage}` : ''}</span>
                      <span style={{ fontSize: 12, fontWeight: 'normal', opacity: 0.8 }}>
                        {(v.price ?? product.price ?? 0).toLocaleString('vi-VN')}đ
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: isDark ? '#ccc' : '#555', fontSize: 14 }}>
                <CheckCircleOutlined style={{ color: '#10b981' }} />
                {t('product.in_stock')}: <strong>{currentStock}</strong> {t('product.items')}
              </div>
            </div>

            <Divider style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#eee', margin: '0 0 24px 0' }} />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Button type="default" size="large"
                icon={isWished ? <HeartFilled style={{ color: '#ef4444' }} /> : <HeartOutlined />}
                onClick={() => { toggleWishlist(product); message.success(isWished ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích'); }}
                style={{ height: 56, width: 56, borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isWished ? '#ef4444' : (isDark ? '#444' : '#d9d9d9') }} />
              <Button type="default" size="large"
                icon={<SwapOutlined style={{ color: isCompared ? '#8b5cf6' : undefined }} />}
                onClick={() => { try { toggleCompare(product); message.success(isCompared ? 'Đã bỏ so sánh' : 'Đã thêm vào so sánh'); } catch (e) { message.error(e.message); } }}
                style={{ height: 56, width: 56, borderRadius: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isCompared ? '#8b5cf6' : (isDark ? '#444' : '#d9d9d9') }} />
              <Button type="primary" size="large" icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart} disabled={currentStock <= 0}
                style={{ height: 56, borderRadius: 16, fontSize: 15, fontWeight: 600, flex: 1, background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6', color: isDark ? '#fff' : '#000', border: 'none' }}>
                {t('product.add_to_cart')}
              </Button>
              <Button type="primary" size="large" icon={<ThunderboltOutlined />}
                onClick={handleBuyNow} disabled={currentStock <= 0}
                style={{ height: 56, borderRadius: 16, fontSize: 15, fontWeight: 700, flex: 1, background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none' }}>
                {t('product.buy_now')}
              </Button>
            </div>
          </Col>
        </Row>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ borderRadius: 24, overflow: 'hidden' }}>
        <Tabs
          defaultActiveKey="specs"
          size="large"
          style={{ padding: '0 40px' }}
          tabBarStyle={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #eee', marginBottom: 0 }}
          items={[
            {
              key: 'info',
              label: <span style={{ fontSize: 15, fontWeight: 600, padding: '0 8px' }}>📋 Thông tin SP</span>,
              children: (
                <div style={{ padding: '32px 0' }}>
                  {/* Description */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9',
                    borderRadius: 16, padding: '24px 28px', marginBottom: 28,
                    border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #eee',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: isDark ? '#fff' : '#111' }}>
                      Giới thiệu sản phẩm
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: isDark ? '#bbb' : '#444', margin: 0 }}>
                      {product.description?.trim() || description}
                    </p>
                  </div>

                  {/* Highlights */}
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isDark ? '#fff' : '#111' }}>
                    ✨ Điểm nổi bật
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 28 }}>
                    {highlights.map((h, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderRadius: 12,
                        background: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.05)',
                        border: isDark ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(16,185,129,0.15)',
                      }}>
                        <span style={{ fontSize: 24 }}>{h.icon}</span>
                        <span style={{ fontSize: 14, color: isDark ? '#ddd' : '#333', lineHeight: 1.5, fontWeight: 500 }}>{h.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Policies */}
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isDark ? '#fff' : '#111' }}>
                    🛡️ Chính sách mua hàng
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    {[
                      { icon: <SafetyCertificateOutlined style={{ color: '#10b981', fontSize: 20 }} />, title: 'Bảo hành chính hãng', desc: '12–24 tháng tại hệ thống' },
                      { icon: <ReloadOutlined style={{ color: '#3b82f6', fontSize: 20 }} />, title: 'Đổi trả miễn phí', desc: '30 ngày nếu lỗi nhà sản xuất' },
                      { icon: <CarOutlined style={{ color: '#f59e0b', fontSize: 20 }} />, title: 'Giao hàng nhanh', desc: 'Giao trong 2–4 giờ nội thành' },
                      { icon: <GiftOutlined style={{ color: '#8b5cf6', fontSize: 20 }} />, title: 'Quà tặng kèm', desc: 'Phụ kiện chính hãng, hộp đẹp' },
                    ].map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderRadius: 12,
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #eee',
                      }}>
                        {p.icon}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#fff' : '#111', marginBottom: 4 }}>{p.title}</div>
                          <div style={{ fontSize: 13, color: isDark ? '#888' : '#666' }}>{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              key: 'specs',
              label: <span style={{ fontSize: 15, fontWeight: 600, padding: '0 8px' }}>⚙️ Thông số kỹ thuật</span>,
              children: <SpecTable specs={specs} isDark={isDark} />,
            },
            {
              key: 'reviews',
              label: <span style={{ fontSize: 15, fontWeight: 600, padding: '0 8px' }}>⭐ Đánh giá ({product.reviews?.length || 0})</span>,
              children: (
                <div style={{ padding: '32px 0' }}>
                  {/* Rating summary */}
                  <div style={{
                    display: 'flex', gap: 32, alignItems: 'center', padding: '24px 28px', borderRadius: 16, marginBottom: 28,
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9',
                    border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #eee',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 56, fontWeight: 800, color: '#facc15', lineHeight: 1 }}>{product.rating?.toFixed(1)}</div>
                      <Rate disabled defaultValue={product.rating} style={{ fontSize: 16, color: '#facc15' }} />
                      <div style={{ fontSize: 13, color: isDark ? '#888' : '#666', marginTop: 4 }}>({product.reviews?.length || 0} đánh giá)</div>
                    </div>
                    <Divider type="vertical" style={{ height: 80, borderColor: isDark ? '#333' : '#eee' }} />
                    {/* AI Summary */}
                    {product.reviews && product.reviews.length > 0 && (
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Avatar icon={<RobotOutlined />} style={{ background: '#10b981' }} size="small" />
                          <span style={{ fontWeight: 700, color: '#10b981', fontSize: 14 }}>AI tóm tắt đánh giá</span>
                          <Tag color="green" style={{ margin: 0, borderRadius: 8, fontSize: 11 }}>Beta</Tag>
                        </div>
                        <div style={{ fontSize: 14, color: isDark ? '#bbb' : '#555', lineHeight: 1.6 }}>
                          Phần lớn khách hàng <strong style={{ color: '#10b981' }}>rất hài lòng</strong>. 
                          Ưu điểm: hiệu năng mạnh, thiết kế đẹp, pin bền. 
                          Đa số đánh giá <strong>{product.rating?.toFixed(1)}/5 ★</strong> và sẽ giới thiệu cho bạn bè.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Review form */}
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9', padding: 24, borderRadius: 16, marginBottom: 28 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, color: isDark ? '#fff' : '#000' }}>Viết đánh giá của bạn</div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <Avatar icon={<UserOutlined />} />
                      <div style={{ flex: 1 }}>
                        <Rate value={reviewRating} onChange={setReviewRating} style={{ marginBottom: 12, color: '#10b981' }} />
                        <Input.TextArea rows={3} placeholder="Chia sẻ cảm nhận của bạn về sản phẩm này..." value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          style={{ borderRadius: 12, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#333' : '#d9d9d9' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                          <Button type="primary" loading={submittingReview} onClick={submitReview}
                            style={{ background: '#10b981', borderColor: '#10b981', borderRadius: 8, fontWeight: 600 }}>
                            Gửi đánh giá
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Review list */}
                  {product.reviews && product.reviews.length > 0 ? (
                    <List itemLayout="horizontal" dataSource={product.reviews}
                      renderItem={item => (
                        <List.Item style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0', padding: '20px 0' }}>
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} style={{ background: '#10b981' }} />}
                            title={<span style={{ color: isDark ? '#fff' : '#000', fontWeight: 600 }}>{item.reviewer || 'Khách hàng ẩn danh'}</span>}
                            description={
                              <div>
                                <Rate disabled value={item.rating} style={{ fontSize: 12, color: '#facc15' }} />
                                <div style={{ color: isDark ? '#bbb' : '#444', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>{item.comment}</div>
                                <div style={{ color: isDark ? '#555' : '#999', fontSize: 12, marginTop: 6 }}>
                                  {new Date(item.date).toLocaleString('vi-VN')}
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )} />
                  ) : (
                    <div style={{ color: '#888', textAlign: 'center', padding: '40px 0', fontSize: 15 }}>
                      Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này!
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── RELATED PRODUCTS ─────────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Title level={3} style={{ color: isDark ? '#fff' : '#111', fontWeight: 800, margin: 0 }}>Thường được mua cùng nhau</Title>
            <Tag color="purple" icon={<RobotOutlined />} style={{ borderRadius: 12, padding: '4px 12px', fontSize: 14, fontWeight: 600 }}>AI Đề xuất</Tag>
          </div>
          <Row gutter={[24, 24]}>
            {relatedProducts.map(p => (
              <Col xs={24} sm={12} md={6} key={p.id}>
                <Card hoverable className="product-card"
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}
                  cover={
                    <div style={{ position: 'relative' }}>
                      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                        <img alt={p.name} src={p.image} width={160} height={160}
                          style={{ height: 160, objectFit: 'contain' }}
                          onError={(e) => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }} />
                      </div>
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <Button type="text"
                          icon={wishlist?.some(w => w.id === p.id) ? <HeartFilled style={{ color: '#ef4444', fontSize: 18 }} /> : <HeartOutlined style={{ fontSize: 18 }} />}
                          onClick={(e) => { e.stopPropagation(); toggleWishlist(p); message.success(wishlist?.some(w => w.id === p.id) ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích'); }} />
                      </div>
                    </div>
                  }>
                  <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? '#fff' : '#1a1a1a', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ color: '#10b981', fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{p.price.toLocaleString('vi-VN')} đ</div>
                  <Button type="primary" style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #047857)', border: 'none', borderRadius: 8 }}
                    onClick={(e) => { e.stopPropagation(); const pToAdd = { ...p }; if (p.variants?.[0]) { pToAdd.selectedVariant = p.variants[0]; pToAdd.price = p.variants[0].price; } addToCart(pToAdd, 1); message.success('Đã thêm vào giỏ'); }}>
                    Thêm vào giỏ
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* ── RECENTLY VIEWED ───────────────────────────────────────── */}
      {recentlyViewed && recentlyViewed.filter(p => p.id !== product.id).length > 0 && (
        <div style={{ marginTop: 64 }}>
          <Title level={3} style={{ color: isDark ? '#fff' : '#000', marginBottom: 24 }}>Sản phẩm bạn vừa xem</Title>
          <Row gutter={[24, 24]}>
            {recentlyViewed.filter(p => p.id !== product.id).slice(0, 4).map(p => (
              <Col xs={12} md={6} key={p.id}>
                <Card hoverable onClick={() => navigate(`/product/${p.id}`)}
                  style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}
                  cover={
                    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                      <img alt={p.name} src={p.image || (p.images && p.images[0])} width={140} height={140}
                        style={{ height: 140, objectFit: 'contain' }}
                        onError={(e) => { e.target.onerror = null; e.target.src = getFallback(p.category_id); }} />
                    </div>
                  }>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#fff' : '#1a1a1a', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ color: '#10b981', fontSize: 16, fontWeight: 800 }}>{p.price?.toLocaleString('vi-VN')} đ</div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}
