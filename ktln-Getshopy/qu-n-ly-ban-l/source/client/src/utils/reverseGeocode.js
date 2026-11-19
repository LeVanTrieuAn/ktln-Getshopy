// ── Tra địa chỉ từ toạ độ (reverse geocoding) — Nominatim / OpenStreetMap, gọi từ trình duyệt ──
// 19/11/2026. Bấm "Dùng vị trí hiện tại" / chạm bản đồ trước đây chỉ ghi "Toạ độ: …" vào ô địa chỉ;
// nay điền luôn Tỉnh/Thành, Phường/Xã, tên đường. Khách vẫn sửa được — dữ liệu OSM do cộng đồng nhập.
//
// Từ 1/7/2025 Việt Nam bỏ cấp huyện: địa chỉ còn tỉnh/thành phố + phường/xã/đặc khu. Dữ liệu OSM đã
// theo ở chỗ đã thử (19/11/2026: toạ độ chợ Bến Thành -> "Phường Bến Thành, Thành phố Hồ Chí Minh",
// không còn "Quận 1"). Nơi OSM chưa cập nhật có thể còn quận/huyện — KHÔNG lấy cấp đó.
//
// Chính sách dùng Nominatim công cộng (https://operations.osmfoundation.org/policies/nominatim/):
// tối đa 1 request/giây, nhận diện được ứng dụng (trình duyệt tự gửi Referer), ghi công OSM (bản đồ
// đã ghi). Mỗi lần khách định vị / chạm bản đồ gửi một request; ở đây giãn tối thiểu 1,1 s.

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const MIN_GAP_MS = 1100;
const TIMEOUT_MS = 8000;
let lastCallAt = 0;

// Mã ISO 3166-2 cấp tỉnh (Nominatim trả trong address['ISO3166-2-lvl4']) -> giá trị ô Tỉnh/Thành
// của Checkout (phí ship theo 3 thành phố này). Tỉnh khác -> 'OTHER'.
const PROVINCE_CODE = { 'VN-SG': 'HCM', 'VN-HN': 'HN', 'VN-DN': 'DN' };
const PROVINCE_BY_NAME = [
  [/hồ chí minh/i, 'HCM'],
  [/hà nội/i, 'HN'],
  [/đà nẵng/i, 'DN'],
];

const WARD_RE = /^(Phường|Xã|Đặc khu)\s/i;

/** Nominatim (format=jsonv2, addressdetails=1) -> { provinceName, provinceCode, ward, street }. */
export function parseNominatimAddress(data) {
  const a = (data && typeof data.address === 'object' && data.address) || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  // Cấp tỉnh: tỉnh nằm ở `state` ("Tỉnh Đồng Nai"); thành phố trực thuộc trung ương không có `state`,
  // tên nằm ở `city` ("Thành phố Hồ Chí Minh"). `state` trước: `city` của một tỉnh có thể là tên
  // thành phố cấp huyện cũ còn sót trong OSM.
  const provinceName = text(a.state) || text(a.province) || text(a.city);

  let provinceCode = PROVINCE_CODE[text(a['ISO3166-2-lvl4'])] || '';
  if (!provinceCode && provinceName) {
    const hit = PROVINCE_BY_NAME.find(([re]) => re.test(provinceName));
    provinceCode = hit ? hit[1] : 'OTHER';
  }

  // Phường / xã / đặc khu: chỉ nhận giá trị mở đầu đúng như vậy (OSM để ở suburb / quarter / village /
  // town tuỳ nơi). Không đoán: không khớp thì để trống cho khách nhập.
  const ward = Object.values(a).map(text).find((v) => WARD_RE.test(v)) || '';

  const street = [text(a.house_number), text(a.road)].filter(Boolean).join(' ')
    || text(a.neighbourhood) || text(a.hamlet);

  return { provinceName, provinceCode, ward, street };
}

/**
 * Toạ độ -> địa chỉ (parseNominatimAddress). Ném lỗi khi mạng hỏng / Nominatim từ chối / quá 8 s —
 * nơi gọi giữ hành vi cũ (ghi toạ độ) và báo khách tự nhập.
 */
export async function reverseGeocode(lat, lng) {
  const wait = lastCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCallAt = Date.now();

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
    'accept-language': 'vi',
    lat: String(lat),
    lon: String(lng),
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Nominatim trả ${res.status}`);
    const data = await res.json();
    if (data && data.error) throw new Error(String(data.error));
    return parseNominatimAddress(data);
  } finally {
    clearTimeout(timer);
  }
}
