import { useEffect, useState } from 'react';

/**
 * true khi media query khớp; tự cập nhật lúc xoay máy / đổi cỡ cửa sổ.
 * Đọc đồng bộ ngay lần render đầu để không nháy layout desktop trên điện thoại.
 *
 * Mốc dùng trong gian hàng: (max-width: 768px) = điện thoại (khớp chỗ StoreLayout
 * ẩn sidebar và hiện nút ☰), (max-width: 991px) = máy tính bảng trở xuống.
 */
export default function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
