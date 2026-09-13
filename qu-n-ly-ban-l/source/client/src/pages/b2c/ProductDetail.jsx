import { useState, useEffect, useRef } from 'react';
import { Row, Col, Typography, Button, Spin, Breadcrumb, Tabs, Divider, Tag, Rate, Avatar, List, Card, Input, message, Carousel } from 'antd';
import {
  ShoppingCartOutlined, ThunderboltOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  UserOutlined, RobotOutlined, HeartOutlined, HeartFilled, SwapOutlined, GiftOutlined,
  CarOutlined, ReloadOutlined, PhoneOutlined,
  MobileOutlined, LaptopOutlined, TabletOutlined,
  WifiOutlined, ApiOutlined, CameraOutlined, CustomerServiceOutlined,
  HddOutlined, CloudOutlined, ToolOutlined, DatabaseOutlined,
  SettingOutlined, InfoCircleOutlined, FireOutlined, BulbOutlined,
  DashboardOutlined, SoundOutlined, EyeOutlined, GlobalOutlined,
  UnorderedListOutlined, ControlOutlined, FundOutlined, AlertOutlined,
  ThunderboltFilled, StarOutlined, AppstoreOutlined,
  ExperimentOutlined, ClockCircleOutlined, AimOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';
import { useProductViewTracker, useTracking } from '../../hooks/useTracking';

const { Title, Text } = Typography;

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
function generateSpecs(product) {
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
      { icon: <EyeOutlined />,           text: `Màn hình ${pick(pid, ['AMOLED', 'OLED', 'Super AMOLED'])} ${pick(pid, ['6.4"', '6.6"', '6.7"'])}` },
      { icon: <DashboardOutlined />,     text: `Chip ${isHigh ? 'Flagship' : isMid ? 'Tầm trung' : 'Phổ thông'} mạnh mẽ` },
      { icon: <ThunderboltOutlined />,   text: `Pin ${pick(pid, ['4500', '5000', '4700'], 1)} mAh, sạc nhanh` },
      { icon: isHigh ? <SafetyCertificateOutlined /> : <CameraOutlined />, text: isHigh ? 'Kháng nước IP67/IP68' : `Camera ${pick(pid, ['64MP', '50MP', '108MP'], 2)} AI` },
    ];
  }
  if (cat === 'cat-laptop' || name.includes('laptop') || name.includes('macbook')) {
    const isGaming = name.includes('rog') || name.includes('gaming') || name.includes('msi');
    return [
      { icon: <DashboardOutlined />,   text: `CPU ${pick(pid, ['Intel Core i7', 'AMD Ryzen 7', 'Intel Core i9'])} Gen mới nhất` },
      { icon: <HddOutlined />,         text: `RAM ${pick(pid, [8, 16, 32], 1)}GB + SSD ${pick(pid, [256, 512, 1024], 2)}GB` },
      { icon: <EyeOutlined />,         text: `Màn hình ${pick(pid, ['Full HD', 'QHD', '2K'], 3)} ${isGaming ? '144Hz' : 'IPS'}` },
      { icon: <ThunderboltOutlined />, text: `Pin ${pick(pid, [8, 10, 12], 4)} giờ — ${isGaming ? 'Sạc 200W' : 'Sạc USB-C 65W'}` },
    ];
  }
  if (cat === 'cat-watch' || name.includes('watch') || name.includes('đồng hồ')) {
    return [
      { icon: <AlertOutlined />,           text: 'Theo dõi sức khỏe 24/7 — Nhịp tim, SpO2, ECG' },
      { icon: <AimOutlined />,             text: `${pick(pid, ['40+', '80+', '100+'])} chế độ tập luyện` },
      { icon: <ThunderboltOutlined />,     text: `Pin ${pick(pid, ['3-5', '7-10', '14'], 1)} ngày liên tục` },
      { icon: <SafetyCertificateOutlined />, text: `Kháng nước ${pick(pid, ['5ATM', 'IP68', '10ATM'], 2)}` },
    ];
  }
  if (cat.startsWith('cat-av') || name.includes('tai nghe') || name.includes('loa')) {
    const isANC = name.includes('anc') || name.includes('noise cancel');
    return [
      { icon: <SoundOutlined />,       text: `Driver ${pick(pid, ['10mm', '12mm', '40mm'])} cho âm thanh đỉnh cao` },
      { icon: <ThunderboltOutlined />, text: `Pin ${pick(pid, ['8h', '24h', '30h'], 1)} liên tục` },
      { icon: <WifiOutlined />,        text: `Bluetooth ${pick(pid, ['5.2', '5.3'], 2)} — Ghép nối tức thì` },
      { icon: isANC ? <ControlOutlined /> : <SafetyCertificateOutlined />, text: isANC ? 'Chống ồn chủ động (ANC)' : 'Kháng nước IPX4/IPX5' },
    ];
  }
  return [
    { icon: <SafetyCertificateOutlined />, text: 'Chính hãng 100% — Bảo hành chính hãng' },
    { icon: <CarOutlined />,               text: 'Giao hàng toàn quốc trong 2–4 giờ' },
    { icon: <ReloadOutlined />,            text: 'Đổi trả miễn phí 30 ngày' },
    { icon: <GiftOutlined />,              text: 'Trả góp 0% lãi suất qua thẻ tín dụng' },
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
// ICON MAP — ánh xạ từ khóa trong tên section → Ant Design icon
// ══════════════════════════════════════════════════════════════════
const SECTION_ICONS = [
  { keys: ['màn hình', 'display', 'screen'],         icon: <EyeOutlined /> },
  { keys: ['bộ xử lý', 'cpu', 'chip', 'processor', 'ram'], icon: <DashboardOutlined /> },
  { keys: ['camera', 'hình ảnh', 'video'],           icon: <CameraOutlined /> },
  { keys: ['pin', 'sạc', 'battery', 'charge'],       icon: <ThunderboltOutlined /> },
  { keys: ['kết nối', 'không dây', 'wifi', 'mạng', 'cổng', 'bluetooth', 'network'], icon: <WifiOutlined /> },
  { keys: ['âm thanh', 'audio', 'loa', 'speaker', 'sound'], icon: <SoundOutlined /> },
  { keys: ['thiết kế', 'vật lý', 'kích thước', 'trọng lượng'], icon: <AppstoreOutlined /> },
  { keys: ['sức khỏe', 'cảm biến', 'health', 'sensor'], icon: <AlertOutlined /> },
  { keys: ['lưu trữ', 'storage', 'hdd', 'ssd', 'thẻ nhớ'], icon: <HddOutlined /> },
  { keys: ['bảo mật', 'security'],                  icon: <SafetyCertificateOutlined /> },
  { keys: ['ai', 'thông minh', 'smart', 'deep learning'], icon: <ExperimentOutlined /> },
  { keys: ['chế độ ban đêm', 'night', 'hồng ngoại'], icon: <BulbOutlined /> },
  { keys: ['ứng dụng', 'phần mềm', 'app', 'software'], icon: <GlobalOutlined /> },
  { keys: ['tính năng', 'feature'],                 icon: <ControlOutlined /> },
  { keys: ['router', 'mesh', 'chuẩn wifi'],         icon: <ApiOutlined /> },
  { keys: ['bàn phím', 'keyboard'],                 icon: <ToolOutlined /> },
  { keys: ['thông số kỹ thuật', 'thông số', 'spec'], icon: <SettingOutlined /> },
  { keys: ['thông tin', 'info', 'khác', 'other'],   icon: <InfoCircleOutlined /> },
];

function getSectionIcon(sectionTitle) {
  const lower = sectionTitle.toLowerCase().replace(/[📱⚡🔋📷📡🎵🔊🎙️💾🖥️💻⌚❤️🏃🌊🎒🔭🤖📲🎥🌙🔌💡🔦🖱️⌨️🎧✏️📐🛡️💨🏷️ℹ️]/gu, '').trim();
  const match = SECTION_ICONS.find(m => m.keys.some(k => lower.includes(k)));
  return match ? match.icon : <UnorderedListOutlined />;
}

// ══════════════════════════════════════════════════════════════════
// SPEC TABLE component — redesigned với icon chuyên nghiệp
// ══════════════════════════════════════════════════════════════════
function SpecTable({ specs, isDark }) {
  const [openSections, setOpenSections] = useState(() => new Set(specs.map((_, i) => i)));

  const toggleSection = (i) => {
    setOpenSections(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  };

  // Strip emoji prefix to get clean text label
  const cleanLabel = (str) => str.replace(/^[\p{Emoji}\s]+/gu, '').trim();

  return (
    <div style={{ padding: '24px 0' }}>
      {specs.map((section, si) => {
        const isOpen = openSections.has(si);
        const icon = getSectionIcon(section.section);
        const label = cleanLabel(section.section);
        return (
          <div key={si} style={{
            marginBottom: 16,
            borderRadius: 16,
            overflow: 'hidden',
            border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e5e7eb',
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {/* Section header — clickable accordion */}
            <div
              onClick={() => toggleSection(si)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px', cursor: 'pointer',
                background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
                borderBottom: isOpen ? (isDark ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(16,185,129,0.15)') : 'none',
                transition: 'background 0.2s',
                userSelect: 'none',
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981, #047857)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, flexShrink: 0,
              }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: isDark ? '#10b981' : '#047857' }}>
                {label}
              </span>
              <span style={{
                fontSize: 12, color: isDark ? '#666' : '#aaa',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}>▼</span>
            </div>

            {/* Rows */}
            {isOpen && (
              <div>
                {section.rows.map(([label, value], ri) => (
                  <div key={ri} style={{
                    display: 'flex', padding: '12px 20px', alignItems: 'center',
                    background: ri % 2 === 0
                      ? (isDark ? 'rgba(255,255,255,0.02)' : '#fafafa')
                      : (isDark ? 'transparent' : '#fff'),
                    borderBottom: ri < section.rows.length - 1
                      ? (isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f3f4f6')
                      : 'none',
                  }}>
                    <span style={{
                      width: '38%', color: isDark ? '#94a3b8' : '#64748b',
                      fontSize: 13.5, fontWeight: 500, flexShrink: 0,
                    }}>{label}</span>
                    <span style={{
                      flex: 1, color: isDark ? '#e2e8f0' : '#1e293b',
                      fontSize: 13.5, fontWeight: 600,
                    }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PRODUCT TABS — custom animated tab system
// ══════════════════════════════════════════════════════════════════
function ProductTabs({ product, specs, highlights, description, isDark,
  reviewRating, setReviewRating, reviewComment, setReviewComment,
  submittingReview, submitReview }) {

  const [activeTab, setActiveTab] = useState('specs');
  const [displayTab, setDisplayTab] = useState('specs');
  const [animating, setAnimating] = useState(false);

  const switchTab = (key) => {
    if (key === activeTab || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setDisplayTab(key);
      setActiveTab(key);
      setTimeout(() => setAnimating(false), 20);
    }, 180);
  };

  const tabDefs = [
    { key: 'info',    icon: <InfoCircleOutlined />,  label: 'Thông tin SP' },
    { key: 'specs',   icon: <SettingOutlined />,     label: 'Thông số kỹ thuật' },
    { key: 'reviews', icon: <StarOutlined />,        label: `Đánh giá (${product.reviews?.length || 0})` },
  ];

  return (
    <div className="glass-panel" style={{ borderRadius: 24, overflow: 'hidden' }}>

      {/* ── Custom Tab Bar */}
      <div style={{
        display: 'flex', padding: '0 32px',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e5e7eb',
        background: isDark ? 'rgba(255,255,255,0.01)' : '#fff',
        gap: 4, overflowX: 'auto',
      }}>
        {tabDefs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => switchTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '18px 20px', border: 'none', cursor: 'pointer',
              background: 'transparent', position: 'relative', outline: 'none',
              fontSize: 14.5, fontWeight: isActive ? 700 : 500,
              color: isActive ? '#10b981' : (isDark ? '#94a3b8' : '#64748b'),
              transition: 'color 0.25s ease', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 8,
                background: isActive ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: isActive ? '#10b981' : 'inherit', fontSize: 13,
                transition: 'all 0.25s ease',
              }}>{tab.icon}</span>
              {tab.label}
              <span style={{
                position: 'absolute', bottom: 0, left: 16, right: 16, height: 2,
                borderRadius: '2px 2px 0 0',
                background: isActive ? 'linear-gradient(90deg, #10b981, #047857)' : 'transparent',
                transition: 'transform 0.3s ease, background 0.3s ease',
                transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
              }} />
            </button>
          );
        })}
      </div>

      {/* ── Tab Content with Fade+Slide animation */}
      <div style={{
        padding: '36px 40px 48px',
        opacity: animating ? 0 : 1,
        transform: animating ? 'translateY(10px)' : 'translateY(0)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
      }}>

        {/* ═ TAB: THÔNG TIN SẢN PHẨM */}
        {displayTab === 'info' && (
          <div>
            {/* Description */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.025)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
              borderRadius: 20, padding: '28px 32px', marginBottom: 32,
              border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #10b981, #047857)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16,
                }}><AppstoreOutlined /></span>
                <span style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>Giới thiệu sản phẩm</span>
              </div>
              <div
                style={{ fontSize: 15, lineHeight: 1.9, color: isDark ? '#94a3b8' : '#475569', margin: 0 }}
                dangerouslySetInnerHTML={{ __html: product.description?.trim() || description }}
              />
            </div>

            {/* Highlights */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16,
              }}><StarOutlined /></span>
              <span style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>Điểm nổi bật</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 36 }}>
              {highlights.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderRadius: 16,
                  background: isDark ? 'rgba(16,185,129,0.06)' : 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(4,120,87,0.04))',
                  border: `1px solid ${isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.2)'}`,
                  transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <span style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #10b981, #047857)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 18, boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                  }}>{h.icon}</span>
                  <span style={{ fontSize: 14, color: isDark ? '#cbd5e1' : '#334155', lineHeight: 1.5, fontWeight: 500 }}>{h.text}</span>
                </div>
              ))}
            </div>

            {/* Policies */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16,
              }}><SafetyCertificateOutlined /></span>
              <span style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>Chính sách mua hàng</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {[
                { icon: <SafetyCertificateOutlined />, color: '#10b981', bg: 'rgba(16,185,129,0.1)',  title: 'Bảo hành chính hãng', desc: '12–24 tháng tại hệ thống' },
                { icon: <ReloadOutlined />,            color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  title: 'Đổi trả miễn phí',   desc: '30 ngày nếu lỗi nhà sản xuất' },
                { icon: <CarOutlined />,               color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', title: 'Giao hàng nhanh',     desc: 'Giao trong 2–4 giờ nội thành' },
                { icon: <GiftOutlined />,              color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', title: 'Quà tặng kèm',        desc: 'Phụ kiện chính hãng, hộp đẹp' },
              ].map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', borderRadius: 16,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0',
                  boxShadow: isDark ? 'none' : '0 1px 6px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? 'none' : '0 1px 6px rgba(0,0,0,0.05)'; }}
                >
                  <span style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: p.bg, color: p.color, fontSize: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a', marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8' }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═ TAB: THÔNG SỐ KỸ THUẬT */}
        {displayTab === 'specs' && <SpecTable specs={specs} isDark={isDark} />}

        {/* ═ TAB: ĐÁNH GIÁ */}
        {displayTab === 'reviews' && (
          <div>
            {/* Rating hero */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '28px 32px', borderRadius: 20, marginBottom: 28,
              background: isDark ? 'rgba(250,204,21,0.04)' : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
              border: isDark ? '1px solid rgba(250,204,21,0.12)' : '1px solid #fde68a',
              flexWrap: 'wrap', gap: 24,
            }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 64, fontWeight: 900, color: '#f59e0b', lineHeight: 1, textShadow: '0 2px 8px rgba(245,158,11,0.3)' }}>
                  {(product?.reviews?.length > 0 ? (product.reviews.reduce((a,c) => a + c.rating, 0) / product.reviews.length) : (product?.rating || 5)).toFixed(1)}
                </div>
                <Rate disabled value={product?.reviews?.length > 0 ? (product.reviews.reduce((a,c) => a + c.rating, 0) / product.reviews.length) : (product?.rating || 5)} style={{ fontSize: 18, color: '#f59e0b' }} />
                <div style={{ fontSize: 13, color: isDark ? '#78716c' : '#92400e', marginTop: 6, fontWeight: 500 }}>
                  {product.reviews?.length || 0} đánh giá
                </div>
              </div>
            </div>

            {/* Write review */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.025)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
              padding: '24px 28px', borderRadius: 20, marginBottom: 32,
              border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontWeight: 700, fontSize: 15, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14,
                }}><UserOutlined /></span>
                Viết đánh giá của bạn
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <Avatar icon={<UserOutlined />} size={40}
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 8 }}>Chọn số sao:</div>
                    <Rate value={reviewRating} onChange={setReviewRating} style={{ fontSize: 24, color: '#f59e0b' }} />
                  </div>
                  <Input.TextArea rows={3} placeholder="Chia sẻ cảm nhận của bạn về sản phẩm này..."
                    value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                    style={{
                      borderRadius: 12, resize: 'none', fontSize: 14,
                      background: isDark ? 'rgba(0,0,0,0.3)' : '#fff',
                      color: isDark ? '#e2e8f0' : '#1e293b',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                    }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <Button type="primary" loading={submittingReview} onClick={submitReview}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #047857)',
                        borderColor: 'transparent', borderRadius: 10,
                        fontWeight: 600, height: 38, paddingInline: 24,
                      }}>
                      Gửi đánh giá
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Review list */}
            {product.reviews && product.reviews.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {product.reviews.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', gap: 16, padding: '20px 24px', borderRadius: 16,
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb',
                    boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                  >
                    <Avatar icon={<UserOutlined />} size={44}
                      style={{ background: `hsl(${(idx * 47 + 120) % 360}, 65%, 55%)`, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a', fontSize: 14 }}>
                          {item.reviewer || 'Khách hàng ẩn danh'}
                        </span>
                        <Rate disabled value={item.rating} style={{ fontSize: 13, color: '#f59e0b' }} />
                      </div>
                      <div style={{ color: isDark ? '#94a3b8' : '#475569', fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
                        {item.comment}
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#475569' : '#94a3b8' }}>
                        {new Date(item.date).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0', color: isDark ? '#475569' : '#94a3b8' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Chưa có đánh giá nào</div>
                <div style={{ fontSize: 14 }}>Hãy là người đầu tiên đánh giá sản phẩm này!</div>
              </div>
            )}
          </div>
        )}

      </div>
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
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState(null);
  const carouselRef = useRef(null);
  const { addToCart, toggleSelectAll } = useCart();
  const { isDark, t, wishlist, toggleWishlist, compareList, toggleCompare, recentlyViewed, addRecentlyViewed, b2cUser, openAuthModal } = useApp();
  const navigate = useNavigate();
  const { trackAddToCart, trackAddToWishlist, trackReviewSubmit } = useTracking();

  // Auto-track product view with dwell time + scroll depth
  useProductViewTracker(product);

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
    // Safely parse JSON fields that may be double-encoded strings from DB
    const safeArr = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
      return [];
    };

    async function load() {
      try {
        const data = await api.b2c.getProductDetails(id);
        // Fix double-encoded JSON fields from seed data
        data.images   = safeArr(data.images);
        data.variants = safeArr(data.variants).map((v, i) => ({ ...v, id: v.id || `var-${i}` }));
        data.reviews  = safeArr(data.reviews);
        data.branch_ids = safeArr(data.branch_ids);
        setProduct(data);
        if (data.image) setMainImage(data.image);
        else if (data.images && data.images.length > 0) setMainImage(data.images[0]);
        if (data.variants && data.variants.length > 0) setSelectedVariantId(data.variants[0].id);
        addRecentlyViewed(data);
        const allProds = await api.b2c.getProducts(data.category_id);
        const list = Array.isArray(allProds) ? allProds : (allProds?.data || []);
        setRelatedProducts(list.filter(p => p.id != id).slice(0, 4));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!import.meta.env.VITE_WS_URL) return;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:8080`;
    let ws;
    try {
      ws = new WebSocket(wsHost);
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
    } catch (err) {}
    return () => { if (ws && ws.readyState === 1) ws.close(); };
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: 100 }}><Spin size="large" /></div>;
  if (!product) return <div style={{ textAlign: 'center', marginTop: 100, color: '#fff' }}>Sản phẩm không tồn tại</div>;

  const activeVariant = product?.variants?.find(v => v.id === selectedVariantId);
  const currentPrice  = activeVariant?.price || product?.price;
  const currentStock  = activeVariant?.stock ?? product?.stock;
  const isWished      = Array.isArray(wishlist) && wishlist.some(p => p.id === product.id);
  const isCompared    = Array.isArray(compareList) && compareList.some(p => p.id === product.id);
  const safeRecentlyViewed = Array.isArray(recentlyViewed) ? recentlyViewed : [];
  const allImages     = [...new Set([product.image, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean))];

  // Generate rich specs
  const specs       = generateSpecs(product);
  const highlights  = generateHighlights(product);
  const description = generateDescription(product);

  const discountPct = product.original_price > currentPrice
    ? Math.round(100 - (currentPrice / product.original_price) * 100) : 0;

  const getProductToAdd = () => {
    const p = { ...product };
    if (selectedVariantId && product.variants?.length) {
      const variant = product.variants.find(v => v.id === selectedVariantId);
      if (variant) {
        p.selectedVariant = variant;
        const vPrice = Number(variant.price);
        p.price = !isNaN(vPrice) && vPrice > 0 ? vPrice : Number(product.price || 0);
      } else {
        p.price = Number(product.price || 0);
      }
    } else {
      p.price = Number(product.price || 0);
    }
    return p;
  };

  const handleAddToCart = () => {
    const pToAdd = getProductToAdd();
    addToCart(pToAdd, quantity, true);
    trackAddToCart(product, quantity);
  };
  const handleBuyNow = () => {
    const pToAdd = getProductToAdd();
    addToCart(pToAdd, quantity, false);
    toggleSelectAll(true);
    trackAddToCart(product, quantity);

    if (!b2cUser && !localStorage.getItem('b2c_token')) {
      message.warning('Vui lòng đăng nhập để thực hiện mua hàng');
      if (typeof openAuthModal === 'function') {
        openAuthModal(() => {
          navigate('/checkout');
        });
      }
      return;
    }
    navigate('/checkout');
  };

  const submitReview = async () => {
    if (!reviewComment.trim()) return message.error('Vui lòng nhập nội dung đánh giá!');
    try {
      setSubmittingReview(true);
      const res = await api.b2c.addReview(id, { rating: reviewRating, comment: reviewComment });
      if (res.success) {
        message.success('Đánh giá của bạn đã được gửi thành công!');
        trackReviewSubmit(Number(id), reviewRating);
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
              <Rate disabled value={product?.reviews?.length > 0 ? (product.reviews.reduce((a,c) => a + c.rating, 0) / product.reviews.length) : (product?.rating || 5)} style={{ fontSize: 14, color: '#facc15' }} />
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

            {/* Quantity Selector & Stock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>
                  Số lượng:
                </span>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb'}`,
                  borderRadius: 12,
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                  padding: 2,
                }}>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    style={{
                      width: 34,
                      height: 34,
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: quantity <= 1 ? (isDark ? '#555' : '#ccc') : (isDark ? '#fff' : '#18181b'),
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={currentStock || 999}
                    value={quantity}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 1) setQuantity(1);
                      else if (currentStock && val > currentStock) setQuantity(currentStock);
                      else setQuantity(val);
                    }}
                    style={{
                      width: 48,
                      height: 34,
                      border: 'none',
                      background: 'transparent',
                      color: isDark ? '#fff' : '#18181b',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: 15,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(currentStock || 999, q + 1))}
                    disabled={currentStock > 0 && quantity >= currentStock}
                    style={{
                      width: 34,
                      height: 34,
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: (currentStock > 0 && quantity >= currentStock) ? (isDark ? '#555' : '#ccc') : (isDark ? '#fff' : '#18181b'),
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: (currentStock > 0 && quantity >= currentStock) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

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
      <ProductTabs
        product={product}
        specs={specs}
        highlights={highlights}
        description={description}
        isDark={isDark}
        reviewRating={reviewRating}
        setReviewRating={setReviewRating}
        reviewComment={reviewComment}
        setReviewComment={setReviewComment}
        submittingReview={submittingReview}
        submitReview={submitReview}
      />
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
                    onClick={(e) => {
                      e.stopPropagation();
                      const pToAdd = { ...p };
                      if (p.variants?.[0]) {
                        pToAdd.selectedVariant = p.variants[0];
                        const vP = Number(p.variants[0].price);
                        pToAdd.price = !isNaN(vP) && vP > 0 ? vP : Number(p.price || 0);
                      } else {
                        pToAdd.price = Number(p.price || 0);
                      }
                      addToCart(pToAdd, 1, true);
                    }}>
                    Thêm vào giỏ
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* ── RECENTLY VIEWED ───────────────────────────────────────── */}
      {safeRecentlyViewed.filter(p => p.id !== product.id).length > 0 && (
        <div style={{ marginTop: 64 }}>
          <Title level={3} style={{ color: isDark ? '#fff' : '#000', marginBottom: 24 }}>Sản phẩm bạn vừa xem</Title>
          <Row gutter={[24, 24]}>
            {safeRecentlyViewed.filter(p => p.id !== product.id).slice(0, 4).map(p => (
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
