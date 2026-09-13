/**
 * Bảng màu đơn sắc cho khu quản trị (/admin).
 *
 * Vì sao tách riêng chứ không sửa ConfigProvider ở App.jsx: token ở đó dùng
 * chung cho CẢ gian hàng B2C. Đổi colorPrimary ở gốc thì toàn bộ nút, link,
 * badge phía khách hàng cũng mất màu theo — ngoài phạm vi yêu cầu. AppLayout
 * bọc thêm một ConfigProvider lồng bên trong nên chỉ /admin đổi tông.
 *
 * Nguyên tắc: phân cấp thị giác bằng ĐỘ TƯƠNG PHẢN và KHOẢNG TRẮNG, không
 * bằng sắc độ. Số quan trọng → đen đậm; nhãn phụ → xám; nhấn mạnh → đảo nền.
 * Giữ lại đúng một màu: đỏ cho lỗi/huỷ. Mất hẳn tín hiệu đỏ thì thao tác xoá
 * và thao tác thường nhìn giống hệt nhau — đó là rủi ro vận hành, không phải
 * lựa chọn thẩm mỹ.
 */

export const MONO_LIGHT = {
  layout:  '#f4f4f5',   // nền trang
  surface: '#ffffff',   // nền thẻ
  soft:    '#fafafa',   // nền khối phụ bên trong thẻ
  line:    '#e4e4e7',
  lineSoft:'#f0f0f1',
  fg:      '#0a0a0a',
  sub:     '#71717a',
  mute:    '#a1a1aa',
  inv:     '#0a0a0a',   // nền khi đảo màu
  invFg:   '#ffffff',
  danger:  '#dc2626',
};

export const MONO_DARK = {
  layout:  '#0b0b0d',
  surface: '#141417',
  soft:    '#1b1b1f',
  line:    '#2a2a2e',
  lineSoft:'#1f1f23',
  fg:      '#fafafa',
  sub:     '#8f8f99',
  mute:    '#6b6b74',
  inv:     '#fafafa',
  invFg:   '#0b0b0d',
  danger:  '#f87171',
};

export const mono = isDark => (isDark ? MONO_DARK : MONO_LIGHT);

/**
 * Thang xám cho biểu đồ. Bảy bậc — quá bảy thì mắt không phân biệt nổi hai
 * bậc kề nhau, lúc đó biểu đồ tròn cần chú thích chứ không dựa vào màu nữa.
 */
export const chartRamp = isDark => (isDark
  ? ['#fafafa', '#d4d4d8', '#a1a1aa', '#7c7c85', '#5c5c64', '#444449', '#323236']
  : ['#0a0a0a', '#3f3f46', '#5f5f68', '#83838c', '#a8a8b0', '#c8c8cd', '#e0e0e3']);

/** Token antd cho ConfigProvider lồng ở AppLayout. */
export const antdMonoTokens = isDark => {
  const c = mono(isDark);
  return {
    // Nút primary: đen chữ trắng ở sáng, trắng chữ đen ở tối.
    // colorTextLightSolid là màu chữ antd đặt lên nền primary — không set thì
    // chế độ tối cho ra chữ trắng trên nền trắng.
    colorPrimary: c.inv,
    colorTextLightSolid: c.invFg,
    colorInfo: c.inv,
    colorLink: c.fg,
    colorLinkHover: c.sub,
    colorSuccess: c.fg,
    colorWarning: c.sub,
    colorError: c.danger,
    colorBgContainer: c.surface,
    colorBgLayout: c.layout,
    colorBgElevated: c.surface,
    colorBorder: c.line,
    colorBorderSecondary: c.lineSoft,
    colorText: c.fg,
    colorTextSecondary: c.sub,
    colorTextTertiary: c.mute,
    colorTextDescription: c.sub,
    borderRadius: 10,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  };
};
