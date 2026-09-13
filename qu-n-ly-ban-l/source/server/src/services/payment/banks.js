/**
 * Bảng tra mã BIN ngân hàng -> tên hiển thị.
 *
 * Dùng để hiện "VietinBank" thay vì "BIN 970415" trên màn thanh toán —
 * khách cần biết chuyển vào ngân hàng nào, mã BIN không nói lên điều gì.
 *
 * Nguồn: https://api.vietqr.io/v2/banks (danh sách của VietQR/Napas).
 * Chỉ gồm các ngân hàng hỗ trợ chuyển khoản qua QR.
 * Bảng tĩnh, không gọi API lúc chạy: dữ liệu gần như không đổi, và sinh QR
 * thì không được phụ thuộc một dịch vụ bên ngoài.
 */

const BANKS = {
  '422589': { short: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam', code: 'CIMB' },
  '546034': { short: 'CAKE', name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank', code: 'CAKE' },
  '546035': { short: 'Ubank', name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank', code: 'Ubank' },
  '668888': { short: 'KBank', name: 'Ngân hàng Đại chúng TNHH Kasikornbank', code: 'KBank' },
  '963388': { short: 'Timo', name: 'Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)', code: 'TIMO' },
  '970400': { short: 'SaigonBank', name: 'Ngân hàng TMCP Sài Gòn Công Thương', code: 'SGICB' },
  '970403': { short: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', code: 'STB' },
  '970405': { short: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', code: 'VBA' },
  '970407': { short: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', code: 'TCB' },
  '970409': { short: 'BacABank', name: 'Ngân hàng TMCP Bắc Á', code: 'BAB' },
  '970412': { short: 'PVcomBank', name: 'Ngân hàng TMCP Đại Chúng Việt Nam', code: 'PVCB' },
  '970414': { short: 'MBV', name: 'Ngân hàng TNHH MTV Việt Nam Hiện Đại', code: 'MBV' },
  '970415': { short: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam', code: 'ICB' },
  '970416': { short: 'ACB', name: 'Ngân hàng TMCP Á Châu', code: 'ACB' },
  '970418': { short: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', code: 'BIDV' },
  '970419': { short: 'NCB', name: 'Ngân hàng TMCP Quốc Dân', code: 'NCB' },
  '970422': { short: 'MBBank', name: 'Ngân hàng TMCP Quân đội', code: 'MB' },
  '970423': { short: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong', code: 'TPB' },
  '970424': { short: 'ShinhanBank', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam', code: 'SHBVN' },
  '970425': { short: 'ABBANK', name: 'Ngân hàng TMCP An Bình', code: 'ABB' },
  '970426': { short: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam', code: 'MSB' },
  '970427': { short: 'VietABank', name: 'Ngân hàng TMCP Việt Á', code: 'VAB' },
  '970428': { short: 'NamABank', name: 'Ngân hàng TMCP Nam Á', code: 'NAB' },
  '970429': { short: 'SCB', name: 'Ngân hàng TMCP Sài Gòn', code: 'SCB' },
  '970430': { short: 'PGBank', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển', code: 'PGB' },
  '970431': { short: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam', code: 'EIB' },
  '970432': { short: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', code: 'VPB' },
  '970433': { short: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín', code: 'VIETBANK' },
  '970436': { short: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', code: 'VCB' },
  '970437': { short: 'HDBank', name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh', code: 'HDB' },
  '970438': { short: 'BaoVietBank', name: 'Ngân hàng TMCP Bảo Việt', code: 'BVB' },
  '970440': { short: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á', code: 'SEAB' },
  '970441': { short: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', code: 'VIB' },
  '970443': { short: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', code: 'SHB' },
  '970446': { short: 'COOPBANK', name: 'Ngân hàng Hợp tác xã Việt Nam', code: 'COOPBANK' },
  '970448': { short: 'OCB', name: 'Ngân hàng TMCP Phương Đông', code: 'OCB' },
  '970449': { short: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam', code: 'LPB' },
  '970452': { short: 'KienLongBank', name: 'Ngân hàng TMCP Kiên Long', code: 'KLB' },
  '970454': { short: 'VietCapitalBank', name: 'Ngân hàng TMCP Bản Việt', code: 'VCCB' },
  '970457': { short: 'Woori', name: 'Ngân hàng TNHH MTV Woori Việt Nam', code: 'WVN' },
  '971025': { short: 'MoMo', name: 'CTCP Dịch Vụ Di Động Trực Tuyến', code: 'momo' },
  '971133': { short: 'PVcomBank Pay', name: 'Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số', code: 'PVDB' },
};

/** Tên ngắn của ngân hàng theo BIN, trả về null nếu không biết. */
function bankNameByBin(bin) {
  const b = BANKS[String(bin || "").trim()];
  return b ? b.short : null;
}

module.exports = { BANKS, bankNameByBin };
