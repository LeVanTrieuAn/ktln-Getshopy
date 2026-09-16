'use strict';
/**
 * ============================================================
 * PRODUCT SPECS CACHE — Getshopy AI Specs Engine v1.0
 * services/ProductSpecsCache.js
 * ============================================================
 *
 * Trích xuất & cache thông số kỹ thuật từ 600K sản phẩm.
 *
 * 2 nguồn dữ liệu:
 *   1. Parse HTML description (có <table> specs)
 *   2. Suy luận từ tên sản phẩm (category-aware templates)
 *
 * Cache: LRU ~10K entries, TTL 10 phút, lazy load.
 *
 * @module ProductSpecsCache
 */

const { prisma } = require('../db');
const { removeDiacritics } = require('../ai/huggingface');

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY SPEC TEMPLATES — mỗi category biết cần extract gì từ tên SP
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_SPEC_TEMPLATES = {
  // ── Điện thoại ──────────────────────────────────────────────────────────
  'cat-phone': {
    htmlFields: ['Màn hình', 'Chip', 'RAM', 'Camera', 'Pin', 'Hệ điều hành', 'Bộ nhớ trong'],
    namePatterns: [
      { field: 'storage', regex: /(\d+)\s*TB/i, transform: (m) => m[1] + 'TB' },
      { field: 'storage', regex: /(\d+)\s*GB(?!.*RAM)/i, transform: (m) => m[1] + 'GB' },
      { field: 'ram', regex: /(\d+)\s*GB\s*(?:RAM|\/)/i, transform: (m) => m[1] + 'GB' },
      { field: 'connectivity', regex: /\b(5G)\b/i, transform: (m) => m[1] },
    ],
    priority: ['screen', 'chip', 'ram', 'camera', 'battery'],
  },

  // ── Laptop ──────────────────────────────────────────────────────────────
  'cat-laptop': {
    htmlFields: ['Màn hình', 'Chip', 'RAM', 'Ổ cứng', 'Card đồ họa', 'Pin', 'Hệ điều hành', 'Khối lượng'],
    namePatterns: [
      { field: 'ram', regex: /(\d+)\s*GB(?:\s*RAM)?/i, transform: (m) => m[1] + 'GB' },
      { field: 'storage', regex: /(\d+)\s*TB\s*SSD/i, transform: (m) => m[1] + 'TB SSD' },
      { field: 'storage', regex: /(\d+)\s*GB\s*SSD/i, transform: (m) => m[1] + 'GB SSD' },
      { field: 'chip', regex: /(Core\s*(?:i[3579]|Ultra\s*\d+)|Ryzen\s*[3579]\s*\w+|M[1-5]\s*(?:Pro|Max|Ultra)?|Snapdragon\s*\w+)/i, transform: (m) => m[1] },
      { field: 'screen', regex: /(\d{2}(?:\.\d)?)\s*(?:inch|")/i, transform: (m) => m[1] + ' inch' },
      { field: 'gpu', regex: /(RTX\s*\d{4}\w*|GTX\s*\d{4}\w*|Radeon\s*\w+)/i, transform: (m) => m[1] },
    ],
    priority: ['screen', 'chip', 'ram', 'storage', 'gpu'],
  },

  // ── Tablet ──────────────────────────────────────────────────────────────
  'cat-tablet': {
    htmlFields: ['Màn hình', 'Chip', 'RAM', 'Bộ nhớ trong', 'Camera', 'Pin', 'Hệ điều hành'],
    namePatterns: [
      { field: 'storage', regex: /(\d+)\s*TB/i, transform: (m) => m[1] + 'TB' },
      { field: 'storage', regex: /(\d+)\s*GB(?!.*RAM)/i, transform: (m) => m[1] + 'GB' },
      { field: 'ram', regex: /(\d+)\s*GB\s*RAM/i, transform: (m) => m[1] + 'GB' },
      { field: 'connectivity', regex: /\b(5G|WiFi|LTE|Cellular)\b/i, transform: (m) => m[1] },
      { field: 'screen', regex: /(\d{1,2}(?:\.\d{1,2})?)\s*(?:inch|")/i, transform: (m) => m[1] + ' inch' },
      { field: 'chip', regex: /(M[1-5]\s*(?:Pro|Max|Ultra)?|A\d{2}\s*(?:Pro|Bionic)?|Snapdragon\s*\w+)/i, transform: (m) => m[1] },
    ],
    priority: ['screen', 'chip', 'ram', 'storage', 'connectivity'],
  },

  // ── Smartwatch ──────────────────────────────────────────────────────────
  'cat-watch': {
    htmlFields: ['Màn hình', 'Pin', 'Chống nước', 'Kết nối', 'Cảm biến'],
    namePatterns: [
      { field: 'size', regex: /(\d{2})\s*mm/i, transform: (m) => m[1] + 'mm' },
      { field: 'connectivity', regex: /\b(GPS|LTE|4G|Bluetooth|WiFi)\b/i, transform: (m) => m[1] },
      { field: 'material', regex: /(Titanium|Thép|Nhôm|Ceramic)/i, transform: (m) => m[1] },
    ],
    priority: ['screen', 'battery', 'waterproof', 'connectivity', 'size'],
  },

  // ── Sạc dự phòng ───────────────────────────────────────────────────────
  'cat-mobile-acc-powerbank': {
    htmlFields: ['Dung lượng', 'Công suất', 'Cổng sạc', 'Khối lượng'],
    namePatterns: [
      { field: 'capacity', regex: /(\d{4,6})\s*mAh/i, transform: (m) => m[1] + 'mAh' },
      { field: 'wattage', regex: /(\d+)\s*W\b/i, transform: (m) => m[1] + 'W' },
      { field: 'ports', regex: /(Type[- ]C|USB[- ]C|Lightning|USB[- ]A)/gi, transform: (m) => m[1] },
    ],
    priority: ['capacity', 'wattage', 'ports'],
  },

  // ── Sạc / Cáp sạc ──────────────────────────────────────────────────────
  'cat-mobile-acc-charger': {
    htmlFields: ['Công suất', 'Cổng sạc', 'Công nghệ sạc'],
    namePatterns: [
      { field: 'wattage', regex: /(\d+)\s*W\b/i, transform: (m) => m[1] + 'W' },
      { field: 'ports', regex: /(Type[- ]C|USB[- ]C|Lightning|USB[- ]A)/gi, transform: (m) => m[1] },
      { field: 'protocol', regex: /(PD|QC\s*\d\.?\d?|IQ\d?|GaN|Magsafe|MagSafe)/i, transform: (m) => m[1] },
      { field: 'length', regex: /(\d(?:\.\d)?)\s*m\b/i, transform: (m) => m[1] + 'm' },
    ],
    priority: ['wattage', 'ports', 'protocol'],
  },

  // ── Ốp lưng điện thoại ─────────────────────────────────────────────────
  'cat-mobile-acc-case-phone': {
    htmlFields: ['Chất liệu', 'Tương thích'],
    namePatterns: [
      { field: 'compatibility', regex: /(iPhone\s*\d{1,2}\s*(?:Pro\s*Max|Pro|Plus|mini)?|Galaxy\s*\w+|Pixel\s*\w+)/i, transform: (m) => m[1] },
      { field: 'material', regex: /(Silicon|Silicone|Nhựa cứng|Da|Vải|Carbon|MagSafe|Magsafe)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility', 'material'],
  },

  // ── Ốp lưng tablet ─────────────────────────────────────────────────────
  'cat-mobile-acc-case-tablet': {
    htmlFields: ['Chất liệu', 'Tương thích'],
    namePatterns: [
      { field: 'compatibility', regex: /(iPad\s*(?:Pro|Air|mini)?\s*(?:M[1-5])?\s*\d{1,2}(?:\.\d)?\s*inch|Galaxy\s*Tab\s*\w+)/i, transform: (m) => m[1] },
      { field: 'type', regex: /(Smart Folio|Bao da|Nắp gập|Clear Case)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility', 'type', 'material'],
  },

  // ── Miếng dán cường lực ─────────────────────────────────────────────────
  'cat-mobile-acc-screen': {
    htmlFields: ['Chất liệu', 'Tương thích', 'Độ cứng'],
    namePatterns: [
      { field: 'compatibility', regex: /(iPhone\s*\d{1,2}\s*(?:Pro\s*Max|Pro|Plus|mini)?|Galaxy\s*\w+|iPad\s*\w+)/i, transform: (m) => m[1] },
      { field: 'feature', regex: /(chống nhìn trộm|mờ|trong suốt|full màn|anti[- ]glare)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility', 'feature'],
  },

  // ── Miếng dán camera ────────────────────────────────────────────────────
  'cat-mobile-acc-cam-cover': {
    htmlFields: ['Tương thích', 'Chất liệu'],
    namePatterns: [
      { field: 'compatibility', regex: /(iPhone\s*\d{1,2}\s*(?:Pro\s*Max|Pro|Plus|mini)?|Galaxy\s*\w+)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility'],
  },

  // ── Case AirPods ────────────────────────────────────────────────────────
  'cat-mobile-acc-airpods-case': {
    htmlFields: ['Tương thích', 'Chất liệu'],
    namePatterns: [
      { field: 'compatibility', regex: /(AirPods\s*(?:Pro\s*\d?|Max|\d)?|Galaxy\s*Buds\s*\w+)/i, transform: (m) => m[1] },
      { field: 'material', regex: /(Silicon|Silicone|Nhựa|Da|Vải)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility', 'material'],
  },

  // ── Quạt mini ───────────────────────────────────────────────────────────
  'cat-mobile-acc-fan': {
    htmlFields: ['Dung lượng pin', 'Tốc độ gió', 'Khối lượng'],
    namePatterns: [
      { field: 'capacity', regex: /(\d{3,5})\s*mAh/i, transform: (m) => m[1] + 'mAh' },
      { field: 'type', regex: /(cầm tay|kẹp|để bàn|đeo cổ|clip)/i, transform: (m) => m[1] },
    ],
    priority: ['capacity', 'type'],
  },

  // ── Bút tablet ──────────────────────────────────────────────────────────
  'cat-mobile-acc-pen': {
    htmlFields: ['Tương thích', 'Kết nối', 'Pin'],
    namePatterns: [
      { field: 'compatibility', regex: /(iPad|Galaxy\s*Tab|Apple\s*Pencil\s*\d?|Surface)/i, transform: (m) => m[1] },
      { field: 'generation', regex: /(Pencil\s*\d|Gen\s*\d|USB[- ]C)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility', 'generation'],
  },

  // ── Giá đỡ ──────────────────────────────────────────────────────────────
  'cat-mobile-acc-stand': {
    htmlFields: ['Chất liệu', 'Tương thích', 'Khối lượng'],
    namePatterns: [
      { field: 'type', regex: /(Magnetic|MagSafe|Magsafe|gấp gọn|Tripod|kẹp|hít|xoay\s*360)/i, transform: (m) => m[1] },
      { field: 'material', regex: /(Nhôm|Hợp kim|Nhựa|Silicone)/i, transform: (m) => m[1] },
    ],
    priority: ['type', 'material'],
  },

  // ── Dây đeo điện thoại ──────────────────────────────────────────────────
  'cat-mobile-acc-strap': {
    htmlFields: ['Chất liệu', 'Chiều dài'],
    namePatterns: [
      { field: 'material', regex: /(Dù|Vải|Da|Nylon|Silicon)/i, transform: (m) => m[1] },
      { field: 'type', regex: /(đeo cổ|đeo tay|crossbody|wrist)/i, transform: (m) => m[1] },
    ],
    priority: ['material', 'type'],
  },

  // ── Ống kính điện thoại ─────────────────────────────────────────────────
  'cat-mobile-acc-lens': {
    htmlFields: ['Tiêu cự', 'Góc rộng', 'Tương thích'],
    namePatterns: [
      { field: 'type', regex: /(Wide|Macro|Fisheye|Telephoto|Anamorphic|góc rộng|macro)/i, transform: (m) => m[1] },
      { field: 'magnification', regex: /(\d+)[xX]/i, transform: (m) => m[1] + 'x' },
    ],
    priority: ['type', 'magnification'],
  },

  // ── Hub / Adapter ───────────────────────────────────────────────────────
  'cat-laptop-acc-hub': {
    htmlFields: ['Cổng kết nối', 'Công suất', 'Tương thích'],
    namePatterns: [
      { field: 'ports', regex: /(\d+)\s*(?:in|cổng)/i, transform: (m) => m[1] + ' cổng' },
      { field: 'interface', regex: /(USB[- ]C|Thunderbolt\s*\d?|HDMI|DisplayPort)/i, transform: (m) => m[1] },
      { field: 'features', regex: /(4K|8K|100W|PD|ethernet)/i, transform: (m) => m[1] },
    ],
    priority: ['ports', 'interface', 'features'],
  },

  // ── Chuột ───────────────────────────────────────────────────────────────
  'cat-laptop-acc-mouse': {
    htmlFields: ['Kết nối', 'Cảm biến', 'DPI', 'Pin'],
    namePatterns: [
      { field: 'connectivity', regex: /(Bluetooth|không dây|wireless|có dây|2\.4G)/i, transform: (m) => m[1] },
      { field: 'dpi', regex: /(\d{3,5})\s*DPI/i, transform: (m) => m[1] + ' DPI' },
      { field: 'type', regex: /(gaming|ergonomic|vertical|silent|pin sạc)/i, transform: (m) => m[1] },
    ],
    priority: ['connectivity', 'dpi', 'type'],
  },

  // ── Bàn phím ────────────────────────────────────────────────────────────
  'cat-laptop-acc-keyboard': {
    htmlFields: ['Kết nối', 'Switch', 'Layout', 'Pin'],
    namePatterns: [
      { field: 'connectivity', regex: /(Bluetooth|không dây|wireless|có dây|2\.4G|tri[- ]mode)/i, transform: (m) => m[1] },
      { field: 'switch', regex: /(Red|Blue|Brown|Linear|Tactile|Clicky|Hot[- ]swap)/i, transform: (m) => m[1] },
      { field: 'layout', regex: /(TKL|Full[- ]size|65%|75%|60%|\d{2,3}\s*phím)/i, transform: (m) => m[1] },
      { field: 'type', regex: /(cơ|membrane|gaming|low[- ]profile)/i, transform: (m) => m[1] },
    ],
    priority: ['connectivity', 'switch', 'layout', 'type'],
  },

  // ── Router / WiFi ───────────────────────────────────────────────────────
  'cat-laptop-acc-router': {
    htmlFields: ['Chuẩn WiFi', 'Tốc độ', 'Băng tần', 'Cổng'],
    namePatterns: [
      { field: 'wifi_standard', regex: /(WiFi\s*[67]|Wi-Fi\s*[67]|AX\d{4}|BE\d{4,5}|AC\d{3,4})/i, transform: (m) => m[1] },
      { field: 'speed', regex: /(\d{3,4})\s*Mbps|(\d+(?:\.\d)?)\s*Gbps/i, transform: (m) => m[1] ? m[1]+'Mbps' : m[2]+'Gbps' },
      { field: 'type', regex: /(Mesh|Router|Repeater|Access\s*Point|Extender)/i, transform: (m) => m[1] },
    ],
    priority: ['wifi_standard', 'speed', 'type'],
  },

  // ── Balo / Túi laptop ───────────────────────────────────────────────────
  'cat-laptop-acc-bag': {
    htmlFields: ['Kích thước', 'Chất liệu', 'Tương thích'],
    namePatterns: [
      { field: 'laptop_size', regex: /(\d{2}(?:\.\d)?)\s*(?:inch|")/i, transform: (m) => m[1] + ' inch' },
      { field: 'type', regex: /(Balo|Túi chống sốc|Túi xách|Cặp|Túi đeo)/i, transform: (m) => m[1] },
      { field: 'material', regex: /(Polyester|Nylon|Da|Canvas|chống nước)/i, transform: (m) => m[1] },
    ],
    priority: ['laptop_size', 'type', 'material'],
  },

  // ── Túi phụ kiện ────────────────────────────────────────────────────────
  'cat-laptop-acc-pouch': {
    htmlFields: ['Kích thước', 'Chất liệu'],
    namePatterns: [
      { field: 'type', regex: /(Tech pouch|Túi đựng|Organizer)/i, transform: (m) => m[1] },
    ],
    priority: ['type'],
  },

  // ── Phủ phím ────────────────────────────────────────────────────────────
  'cat-laptop-acc-keyboard-cover': {
    htmlFields: ['Tương thích'],
    namePatterns: [
      { field: 'compatibility', regex: /(MacBook\s*(?:Air|Pro)\s*(?:M[1-5])?\s*\d{2}|Surface\s*\w+)/i, transform: (m) => m[1] },
    ],
    priority: ['compatibility'],
  },

  // ── Phần mềm ───────────────────────────────────────────────────────────
  'cat-laptop-acc-software': {
    htmlFields: ['Loại', 'Thời hạn', 'Số thiết bị'],
    namePatterns: [
      { field: 'product', regex: /(Office\s*\d{4}|Microsoft\s*365|Windows\s*\d{2}|McAfee|Norton|AutoCAD)/i, transform: (m) => m[1] },
      { field: 'duration', regex: /(\d+)\s*(?:năm|year|tháng|month)/i, transform: (m) => m[1] + (m[0].includes('năm') || m[0].includes('year') ? ' năm' : ' tháng') },
    ],
    priority: ['product', 'duration'],
  },

  // ── Giá treo màn hình ───────────────────────────────────────────────────
  'cat-laptop-acc-monitor-stand': {
    htmlFields: ['Kích thước hỗ trợ', 'Tải trọng', 'Chất liệu'],
    namePatterns: [
      { field: 'max_size', regex: /(\d{2})\s*(?:inch|")/i, transform: (m) => 'Tối đa ' + m[1] + ' inch' },
      { field: 'arms', regex: /(đơn|đôi|single|dual|2\s*màn)/i, transform: (m) => m[1] },
    ],
    priority: ['max_size', 'arms'],
  },

  // ── Lót chuột ───────────────────────────────────────────────────────────
  'cat-laptop-acc-mousepad': {
    htmlFields: ['Kích thước', 'Chất liệu'],
    namePatterns: [
      { field: 'size', regex: /(\d{2,3})\s*[xX×]\s*(\d{2,3})/i, transform: (m) => m[1] + 'x' + m[2] + 'cm' },
      { field: 'feature', regex: /(RGB|LED|sạc không dây|wireless charging)/i, transform: (m) => m[1] },
    ],
    priority: ['size', 'feature'],
  },

  // ── Bảng vẽ điện tử ────────────────────────────────────────────────────
  'cat-laptop-acc-drawing': {
    htmlFields: ['Kích thước', 'Độ nhạy bút', 'Kết nối'],
    namePatterns: [
      { field: 'brand_model', regex: /(Wacom\s*\w+|XP-Pen\s*\w+|Huion\s*\w+)/i, transform: (m) => m[1] },
      { field: 'size', regex: /(Small|Medium|Large|S|M|L)\b/i, transform: (m) => m[1] },
      { field: 'pressure', regex: /(\d{4,5})\s*(?:mức|level)/i, transform: (m) => m[1] + ' mức nhạy' },
    ],
    priority: ['brand_model', 'size', 'pressure'],
  },

  // ── Tai nghe Bluetooth ──────────────────────────────────────────────────
  'cat-av-bt-earphone': {
    htmlFields: ['Kết nối', 'Pin', 'Chống nước', 'Codec', 'Driver'],
    namePatterns: [
      { field: 'feature', regex: /(ANC|chống ồn|noise\s*cancel|ENC)/i, transform: (m) => m[1] },
      { field: 'battery', regex: /(\d{1,2})\s*(?:giờ|h)\b/i, transform: (m) => m[1] + ' giờ' },
      { field: 'connectivity', regex: /(Bluetooth\s*\d\.?\d?|BT\s*\d\.?\d?)/i, transform: (m) => m[1] },
      { field: 'type', regex: /(True Wireless|TWS|In-ear|Earbuds|Chụp Tai)/i, transform: (m) => m[1] },
      // Fallback: bất kỳ SP nào có tên chứa 'Bluetooth' đều là tai nghe BT
      { field: 'connectivity', regex: /(Bluetooth)/i, transform: () => 'Bluetooth' },
      // Brand model patterns — JBL, Sony, Samsung, Anker...
      { field: 'brand_model', regex: /(JBL\s+[\w\s]+\d|Sony\s+WF-?[\w]+|Sony\s+WH-?[\w]+|Galaxy\s+Buds\s*\w*|AirPods\s*\w*|Soundcore\s+[\w\s]+)/i, transform: (m) => m[1].trim() },
    ],
    priority: ['feature', 'battery', 'type', 'connectivity', 'brand_model'],
  },

  // ── Tai nghe có dây ─────────────────────────────────────────────────────
  'cat-av-wire-earphone': {
    htmlFields: ['Kết nối', 'Driver', 'Tần số đáp ứng'],
    namePatterns: [
      { field: 'connector', regex: /(3\.5mm|Type[- ]C|Lightning|USB[- ]C)/i, transform: (m) => m[1] },
      { field: 'feature', regex: /(micro|mic|có mic)/i, transform: (m) => 'Có mic' },
    ],
    priority: ['connector', 'feature'],
  },

  // ── Tai nghe chụp tai ───────────────────────────────────────────────────
  'cat-av-headphone': {
    htmlFields: ['Kết nối', 'Pin', 'Chống ồn', 'Driver', 'Tần số đáp ứng'],
    namePatterns: [
      { field: 'feature', regex: /(ANC|chống ồn|noise\s*cancel|LDAC|Hi-Res)/i, transform: (m) => m[1] },
      { field: 'battery', regex: /(\d{1,3})\s*(?:giờ|h)\b/i, transform: (m) => m[1] + ' giờ' },
      { field: 'connectivity', regex: /(Bluetooth|không dây|wireless|có dây)/i, transform: (m) => m[1] },
      { field: 'type', regex: /(Chụp Tai|Over-ear|On-ear|Gaming)/i, transform: (m) => m[1] },
      { field: 'brand_model', regex: /(JBL\s+[\w\s]+\d|Sony\s+WH-?[\w]+|Marshall\s+\w+|Razer\s+\w+)/i, transform: (m) => m[1].trim() },
    ],
    priority: ['feature', 'battery', 'connectivity', 'type'],
  },

  // ── Tai nghe thể thao ───────────────────────────────────────────────────
  'cat-av-sport-earphone': {
    htmlFields: ['Kết nối', 'Pin', 'Chống nước'],
    namePatterns: [
      { field: 'waterproof', regex: /(IP\d{2}|IPX\d)/i, transform: (m) => m[1] },
      { field: 'type', regex: /(bone conduction|open ear|clip|kẹp tai)/i, transform: (m) => m[1] },
      { field: 'battery', regex: /(\d{1,2})\s*(?:giờ|h)\b/i, transform: (m) => m[1] + ' giờ' },
    ],
    priority: ['waterproof', 'type', 'battery'],
  },

  // ── Loa bluetooth ───────────────────────────────────────────────────────
  'cat-av-speaker': {
    htmlFields: ['Công suất', 'Pin', 'Chống nước', 'Kết nối'],
    namePatterns: [
      { field: 'wattage', regex: /(\d+)\s*W\b/i, transform: (m) => m[1] + 'W' },
      { field: 'waterproof', regex: /(IP\d{2}|IPX\d)/i, transform: (m) => m[1] },
      { field: 'battery', regex: /(\d{1,3})\s*(?:giờ|h)\b/i, transform: (m) => m[1] + ' giờ' },
      { field: 'feature', regex: /(PartyBoost|Mega Bass|stereo|360|portable|Charge)/i, transform: (m) => m[1] },
      // Fallback brand model
      { field: 'brand_model', regex: /(JBL\s+(?:Flip|Charge|Xtreme|Go|Clip|Boombox|Pulse|PartyBox)\s*\w*|Marshall\s+\w+|Harman\s+\w+|Sony\s+SRS-?\w+)/i, transform: (m) => m[1].trim() },
      // Fallback type
      { field: 'type', regex: /(Bluetooth|Lòa|loa|portable|di động)/i, transform: () => 'Loa Bluetooth' },
    ],
    priority: ['wattage', 'waterproof', 'battery', 'brand_model'],
  },

  // ── Micro / Mic ─────────────────────────────────────────────────────────
  'cat-av-mic': {
    htmlFields: ['Loại', 'Kết nối', 'Tần số đáp ứng', 'Hướng thu'],
    namePatterns: [
      { field: 'type', regex: /(condenser|dynamic|lavalier|shotgun|USB|clip-on|thu âm|kẹp áo)/i, transform: (m) => m[1] },
      { field: 'connectivity', regex: /(USB|USB[- ]C|3\.5mm|XLR|wireless|không dây)/i, transform: (m) => m[1] },
    ],
    priority: ['type', 'connectivity'],
  },

  // ── Máy chiếu ───────────────────────────────────────────────────────────
  'cat-av-projector': {
    htmlFields: ['Độ phân giải', 'Độ sáng', 'Kết nối', 'Nguồn sáng'],
    namePatterns: [
      { field: 'resolution', regex: /(4K|1080p|Full\s*HD|HD|720p)/i, transform: (m) => m[1] },
      { field: 'brightness', regex: /(\d{2,4})\s*(?:ANSI|lumen)/i, transform: (m) => m[1] + ' ANSI Lumens' },
    ],
    priority: ['resolution', 'brightness'],
  },

  // ── Kính thông minh ─────────────────────────────────────────────────────
  'cat-av-smartglass': {
    htmlFields: ['Màn hình', 'Pin', 'Kết nối'],
    namePatterns: [
      { field: 'feature', regex: /(AR|VR|XR|Meta|Ray-Ban)/i, transform: (m) => m[1] },
    ],
    priority: ['feature'],
  },

  // ── Ổ cứng ──────────────────────────────────────────────────────────────
  'cat-av-hdd': {
    htmlFields: ['Dung lượng', 'Tốc độ', 'Chuẩn kết nối'],
    namePatterns: [
      { field: 'capacity', regex: /(\d+)\s*TB/i, transform: (m) => m[1] + 'TB' },
      { field: 'capacity', regex: /(\d{3,4})\s*GB/i, transform: (m) => m[1] + 'GB' },
      { field: 'type', regex: /(SSD|HDD|NVMe|SATA|M\.2|di động|portable|external)/i, transform: (m) => m[1] },
      { field: 'speed', regex: /(\d{3,4})\s*MB\/s/i, transform: (m) => m[1] + ' MB/s' },
    ],
    priority: ['capacity', 'type', 'speed'],
  },

  // ── Thẻ nhớ ─────────────────────────────────────────────────────────────
  'cat-av-sdcard': {
    htmlFields: ['Dung lượng', 'Tốc độ', 'Loại'],
    namePatterns: [
      { field: 'capacity', regex: /(\d+)\s*GB/i, transform: (m) => m[1] + 'GB' },
      { field: 'capacity', regex: /(\d+)\s*TB/i, transform: (m) => m[1] + 'TB' },
      { field: 'type', regex: /(microSD|SD|CF Express)/i, transform: (m) => m[1] },
      { field: 'speed_class', regex: /(U[13]|V\d{2}|A[12]|C\d{1,2})/i, transform: (m) => m[1] },
    ],
    priority: ['capacity', 'type', 'speed_class'],
  },

  // ── USB Flash ───────────────────────────────────────────────────────────
  'cat-av-usb': {
    htmlFields: ['Dung lượng', 'Tốc độ', 'Chuẩn USB'],
    namePatterns: [
      { field: 'capacity', regex: /(\d+)\s*GB/i, transform: (m) => m[1] + 'GB' },
      { field: 'capacity', regex: /(\d+)\s*TB/i, transform: (m) => m[1] + 'TB' },
      { field: 'usb_standard', regex: /(USB\s*3\.\d|USB\s*2\.0|Type[- ]C|Lightning)/i, transform: (m) => m[1] },
    ],
    priority: ['capacity', 'usb_standard'],
  },

  // ── Camera giám sát (chung) ─────────────────────────────────────────────
  'cat-camera': {
    htmlFields: ['Độ phân giải', 'Kết nối', 'Tầm nhìn', 'Lưu trữ'],
    namePatterns: [
      { field: 'resolution', regex: /(\d+)\s*MP/i, transform: (m) => m[1] + 'MP' },
      { field: 'resolution', regex: /(2K|4K|1080p|Full\s*HD|5MP|3MP|4MP)/i, transform: (m) => m[1] },
      { field: 'feature', regex: /(360|PTZ|xoay|cố định|ngoài trời|trong nhà|solar|4G)/i, transform: (m) => m[1] },
      { field: 'connectivity', regex: /(WiFi|Ethernet|PoE|4G|LTE)/i, transform: (m) => m[1] },
    ],
    priority: ['resolution', 'feature', 'connectivity'],
  },

  // ── Webcam ──────────────────────────────────────────────────────────────
  'cat-cam-webcam': {
    htmlFields: ['Độ phân giải', 'FPS', 'Góc nhìn', 'Micro'],
    namePatterns: [
      { field: 'resolution', regex: /(4K|2K|1080p|Full\s*HD|720p|HD)/i, transform: (m) => m[1] },
      { field: 'fps', regex: /(\d{2,3})\s*fps/i, transform: (m) => m[1] + 'fps' },
      { field: 'feature', regex: /(Auto[- ]?focus|Stereo|AI|HDR|USB[- ]C)/i, transform: (m) => m[1] },
    ],
    priority: ['resolution', 'fps', 'feature'],
  },
};

// Alias cho camera subcategories → dùng chung template camera
['cat-cam-security', 'cat-cam-indoor', 'cat-cam-outdoor', 'cat-cam-solar', 'cat-cam-4g', 'cat-cam-doorbell'].forEach(id => {
  CATEGORY_SPEC_TEMPLATES[id] = CATEGORY_SPEC_TEMPLATES['cat-camera'];
});

// ─────────────────────────────────────────────────────────────────────────────
// CACHE STATE
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_MAX  = 10_000;
const CACHE_TTL  = 10 * 60 * 1000; // 10 phút

const _cache     = new Map();  // productId → { specs, ts }
const _accessOrder = [];       // LRU tracking

function _evictIfNeeded() {
  while (_cache.size > CACHE_MAX && _accessOrder.length > 0) {
    const oldest = _accessOrder.shift();
    _cache.delete(oldest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE SPECS FROM HTML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse bảng <table> specs trong HTML description → object.
 * VD: <tr><td>Màn hình</td><td>6.7 inch AMOLED</td></tr>
 *   → { screen: "6.7 inch AMOLED" }
 */
function parseSpecsFromHTML(html) {
  if (!html || typeof html !== 'string') return null;
  if (!html.includes('<table>') && !html.includes('<table ')) return null;

  const specs = {};
  const fieldMap = {
    'Màn hình': 'screen', 'Man hinh': 'screen', 'Display': 'screen',
    'Chip': 'chip', 'CPU': 'chip', 'Bộ xử lý': 'chip', 'Vi xử lý': 'chip',
    'RAM': 'ram',
    'Bộ nhớ trong': 'storage', 'Ổ cứng': 'storage', 'SSD': 'storage', 'ROM': 'storage', 'Dung lượng': 'storage',
    'Camera': 'camera', 'Camera sau': 'camera', 'Camera trước': 'front_camera',
    'Pin': 'battery', 'Dung lượng pin': 'battery',
    'Hệ điều hành': 'os', 'OS': 'os',
    'Khối lượng': 'weight', 'Trọng lượng': 'weight',
    'Card đồ họa': 'gpu', 'GPU': 'gpu', 'VGA': 'gpu',
    'Kết nối': 'connectivity', 'Cổng kết nối': 'ports',
    'Chống nước': 'waterproof',
    'Cảm biến': 'sensors',
    'Công suất': 'wattage',
    'Cổng sạc': 'ports',
    'Chất liệu': 'material',
    'Tương thích': 'compatibility',
    'Tốc độ': 'speed',
    'Chuẩn WiFi': 'wifi_standard',
    'Độ phân giải': 'resolution',
    'Độ sáng': 'brightness',
    'FPS': 'fps',
    'Góc nhìn': 'fov',
    'Driver': 'driver',
    'Codec': 'codec',
    'Switch': 'switch',
    'DPI': 'dpi',
    'Hướng thu': 'polar_pattern',
    'Tần số đáp ứng': 'frequency_response',
  };

  // Extract <tr><td>KEY</td><td>VALUE</td></tr>
  const trRegex = /<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gi;
  let match;
  while ((match = trRegex.exec(html)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (!value || value === '-' || value === 'N/A') continue;

    const normalizedKey = fieldMap[key];
    if (normalizedKey) {
      specs[normalizedKey] = value;
    } else {
      // Try partial match
      const partial = Object.keys(fieldMap).find(k =>
        removeDiacritics(key).toLowerCase().includes(removeDiacritics(k).toLowerCase())
      );
      if (partial) specs[fieldMap[partial]] = value;
    }
  }

  return Object.keys(specs).length > 0 ? specs : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE SPECS FROM NAME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suy luận specs từ tên sản phẩm dựa trên category template.
 * VD: "Adapter sạc nhanh Type C IQ3 45W Anker" → { wattage: "45W", ports: "Type C", protocol: "IQ3" }
 */
function generateSpecsFromName(name, categoryId) {
  if (!name || !categoryId) return null;

  const template = CATEGORY_SPEC_TEMPLATES[categoryId];
  if (!template || !template.namePatterns) return null;

  const specs = {};
  for (const pattern of template.namePatterns) {
    if (specs[pattern.field]) continue; // đã có → skip
    const match = name.match(pattern.regex);
    if (match) {
      specs[pattern.field] = pattern.transform(match);
    }
  }

  return Object.keys(specs).length > 0 ? specs : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy specs cho 1 product (cache-aware).
 * Ưu tiên: HTML parsed specs > Name-generated specs
 */
function getProductSpecs(product) {
  if (!product) return null;
  const pid = Number(product.id);

  // Check cache
  const cached = _cache.get(pid);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.specs;
  }

  // Parse from HTML description
  let specs = parseSpecsFromHTML(product.description);

  // Fallback: generate from name
  if (!specs) {
    specs = generateSpecsFromName(product.name, product.category_id);
  }

  // Cache
  if (specs) {
    _cache.set(pid, { specs, ts: Date.now() });
    _accessOrder.push(pid);
    _evictIfNeeded();
  }

  return specs;
}

/**
 * Lấy specs cho nhiều products (batch).
 */
function getMultipleSpecs(products) {
  if (!Array.isArray(products)) return [];
  return products.map(p => ({
    id: Number(p.id),
    specs: getProductSpecs(p),
  }));
}

/**
 * Lấy top N specs quan trọng nhất cho product (dùng cho payload FE).
 * Trả về object chỉ gồm top N fields theo priority order.
 */
function getTopSpecs(product, n = 3) {
  const specs = getProductSpecs(product);
  if (!specs) return null;

  const template = CATEGORY_SPEC_TEMPLATES[product.category_id];
  const priority = template?.priority || Object.keys(specs);

  const result = {};
  let count = 0;
  for (const field of priority) {
    if (specs[field] && count < n) {
      result[field] = specs[field];
      count++;
    }
  }

  // Nếu priority chưa đủ → lấy thêm từ specs
  if (count < n) {
    for (const [k, v] of Object.entries(specs)) {
      if (!result[k] && count < n) {
        result[k] = v;
        count++;
      }
    }
  }

  return count > 0 ? result : null;
}

/**
 * Format specs thành text ngắn cho LLM prompt (không gửi HTML).
 * VD: "Chip A18 Pro, 8GB RAM, Camera 48MP, Pin 4685mAh"
 */
function formatSpecsForLLM(specs) {
  if (!specs || typeof specs !== 'object') return '';
  const fieldLabels = {
    screen: 'Màn hình', chip: 'Chip', ram: 'RAM', storage: 'Bộ nhớ',
    camera: 'Camera', front_camera: 'Camera trước', battery: 'Pin',
    os: 'OS', weight: 'Nặng', gpu: 'GPU', connectivity: 'Kết nối',
    waterproof: 'Chống nước', wattage: 'Công suất', capacity: 'Dung lượng',
    ports: 'Cổng', protocol: 'Chuẩn sạc', resolution: 'Độ phân giải',
    fps: 'FPS', feature: 'Tính năng', compatibility: 'Tương thích',
    type: 'Loại', material: 'Chất liệu', size: 'Kích thước',
    dpi: 'DPI', switch: 'Switch', layout: 'Layout',
    wifi_standard: 'WiFi', speed: 'Tốc độ', brightness: 'Độ sáng',
  };

  return Object.entries(specs)
    .map(([k, v]) => `${fieldLabels[k] || k}: ${v}`)
    .join(', ');
}

/**
 * Format danh sách products + specs cho LLM prompt.
 */
function getSpecsSummaryForLLM(products) {
  if (!Array.isArray(products) || products.length === 0) return '';

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  return products.map(p => {
    const specs = getProductSpecs(p);
    const specsText = specs ? ` | ${formatSpecsForLLM(specs)}` : '';
    return `- ${p.name}: ${fmt(Number(p.price))}${specsText}`;
  }).join('\n');
}

/**
 * Kiểm tra product có specs match keyword không.
 * Dùng cho search filter: "laptop 16GB RAM" → chỉ trả SP có RAM match.
 */
function specsMatchKeyword(product, keyword) {
  const specs = getProductSpecs(product);
  if (!specs) return false;

  const norm = removeDiacritics(keyword).toLowerCase();
  return Object.values(specs).some(v =>
    removeDiacritics(String(v)).toLowerCase().includes(norm)
  );
}

/**
 * Tính specs similarity score giữa 2 products.
 * Dùng cho Recommendation.
 */
function getSpecsSimilarity(product1, product2) {
  const specs1 = getProductSpecs(product1);
  const specs2 = getProductSpecs(product2);
  if (!specs1 || !specs2) return 0;

  let score = 0;
  const allKeys = new Set([...Object.keys(specs1), ...Object.keys(specs2)]);
  for (const key of allKeys) {
    if (specs1[key] && specs2[key]) {
      const v1 = removeDiacritics(String(specs1[key])).toLowerCase();
      const v2 = removeDiacritics(String(specs2[key])).toLowerCase();
      if (v1 === v2) score += 5;
      else if (v1.includes(v2) || v2.includes(v1)) score += 3;
    }
  }
  return score;
}

/**
 * Lấy template cho category.
 */
function getCategorySpecTemplate(categoryId) {
  return CATEGORY_SPEC_TEMPLATES[categoryId] || null;
}

/** Clear cache */
function clearCache() {
  _cache.clear();
  _accessOrder.length = 0;
}

module.exports = {
  parseSpecsFromHTML,
  generateSpecsFromName,
  getProductSpecs,
  getMultipleSpecs,
  getTopSpecs,
  formatSpecsForLLM,
  getSpecsSummaryForLLM,
  specsMatchKeyword,
  getSpecsSimilarity,
  getCategorySpecTemplate,
  clearCache,
  CATEGORY_SPEC_TEMPLATES,
};
