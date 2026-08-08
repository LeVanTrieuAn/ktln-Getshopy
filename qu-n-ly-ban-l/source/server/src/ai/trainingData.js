/**
 * BỘ DỮ LIỆU HUẤN LUYỆN TOÀN BỘ (ALL TRAINING DATA)
 * @description Tất cả mẫu câu đại diện cho 50+ nhóm Ý định thực tế.
 * Bao gồm cả dữ liệu tĩnh (GREETING, HELP, CONTACT...) và dữ liệu mở rộng.
 * File này được import vào train.js để giữ train.js gọn gàng.
 */

module.exports = function registerAllIntents(ai) {

  // ════════════════════════════════════════════════
  // PHẦN 1: DỮ LIỆU TĨNH CƠ BẢN
  // ════════════════════════════════════════════════

  // ── GREETING: Chào hỏi
  [
    'xin chào', 'hello', 'hi shop', 'chào bạn', 'có ai ở đó không', 'alo', 'chào',
    'cho hỏi', 'shop ơi', 'em ơi', 'hi', 'hey shop', 'chào shop', 'hello shop',
    'có ai không ạ', 'alo shop', 'bắt đầu nào', 'mình muốn hỏi',
    'hỏi thăm chút', 'chào buổi sáng', 'chào buổi chiều', 'chào buổi tối',
  ].forEach(s => ai.addDocument(s, 'GREETING'));

  // ── HELP: Hỏi về dịch vụ
  [
    'giúp tôi với', 'hỗ trợ tôi', 'tôi cần tư vấn', 'bạn có thể làm gì',
    'hướng dẫn tôi', 'bạn biết gì', 'shop hỗ trợ những gì'
  ].forEach(s => ai.addDocument(s, 'HELP'));

  // ── CONTACT: Địa chỉ, cửa hàng
  [
    'địa chỉ shop', 'cửa hàng ở đâu', 'chi nhánh', 'cho xin địa chỉ', 'tới mua trực tiếp',
    'showroom ở đâu', 'có chi nhánh quận mấy không', 'cửa hàng mới nhất'
  ].forEach(s => ai.addDocument(s, 'CONTACT'));

  // ── ASK_PROMO: Hỏi khuyến mãi
  [
    'có khuyến mãi không', 'hôm nay có sale không', 'flash sale khi nào',
    'có giảm giá không', 'voucher ở đâu', 'coupon code', 'mua có được quà không',
    'có chương trình ưu đãi không', 'đang có deal gì không', 'mua nhiều có rẻ hơn không'
  ].forEach(s => ai.addDocument(s, 'ASK_PROMO'));

  // ── ASK_DELIVERY: Hỏi giao hàng
  [
    'giao hàng bao lâu', 'ship mấy ngày', 'phí ship bao nhiêu',
    'có giao hàng nhanh không', 'mua online giao được không', 'ship toàn quốc không',
    'bao lâu nhận được hàng', 'giao trong ngày được không', 'freeship không',
    'đặt hàng rồi bao giờ nhận'
  ].forEach(s => ai.addDocument(s, 'ASK_DELIVERY'));

  // ── ASK_RETURN: Hỏi đổi trả bảo hành
  [
    'đổi trả như thế nào', 'bảo hành bao lâu', 'mua về không vừa ý đổi được không',
    'chính sách đổi trả', 'bị lỗi đổi máy mới không', 'bảo hành ở đâu',
    'hàng bị hỏng thì sao', 'đổi máy trong 7 ngày không', 'quy trình đổi trả',
    'mua rồi trả lại được không'
  ].forEach(s => ai.addDocument(s, 'ASK_RETURN'));

  // ── ASK_PAYMENT: Hỏi thanh toán
  [
    'có trả góp không', 'trả góp 0 lãi suất', 'thanh toán momo được không',
    'thanh toán cod không', 'quẹt thẻ được không', 'có hỗ trợ vnpay không',
    'zalopay được không', 'trả bằng thẻ tín dụng', 'chia nhỏ thanh toán không',
    'trả góp mấy tháng'
  ].forEach(s => ai.addDocument(s, 'ASK_PAYMENT'));

  // ── ASK_REVIEW: Hỏi đánh giá
  [
    'con này dùng tốt không', 'nên mua không', 'có hay bị phàn nàn không',
    'review dùm mình với', 'đánh giá thực tế', 'khách mua về thấy thế nào',
    'có bị lỗi nhiều không', 'đáng mua không shop', 'chất lượng sao',
    'ai dùng rồi review giúp'
  ].forEach(s => ai.addDocument(s, 'ASK_REVIEW'));

  // ── COMPARE_PRODUCT: So sánh sản phẩm
  [
    'iphone hay samsung cái nào ngon hơn', 'macbook air hay pro nên mua',
    'airpods hay sony cái nào tốt hơn', 'android hay ios dùng tốt hơn',
    'hai cái này khác nhau ở điểm gì', 'cái nào đáng tiền hơn',
    'so sánh cho mình với', 'loại nào bền hơn'
  ].forEach(s => ai.addDocument(s, 'COMPARE_PRODUCT'));

  // ── COMPARE_SPECS: So sánh cấu hình kỹ thuật
  [
    'so sánh cấu hình', 'so chíp ram màn hình', 'cấu hình cái nào mạnh hơn',
    'cái nào ram nhiều hơn', 'cái nào chip mạnh hơn', 'pin cái nào trâu hơn',
    'màn hình cái nào đẹp hơn', 'thông số kỹ thuật so sánh', 'cái nào hiệu năng tốt hơn',
    'benchmark cái nào cao hơn', 'fps game cái nào chạy tốt hơn',
    'cái nào phù hợp gaming hơn', 'cái nào chụp ảnh đẹp hơn'
  ].forEach(s => ai.addDocument(s, 'COMPARE_SPECS'));

  // ── COMPARE_ACCESSORIES: So sánh phụ kiện đi kèm
  [
    'mua cái nào được tặng nhiều phụ kiện hơn', 'hộp cái nào có nhiều thứ hơn',
    'cái nào tặng kèm tai nghe', 'cái nào có củ sạc nhanh không',
    'phụ kiện kèm theo cái nào nhiều hơn', 'mua cái nào lấy combo tốt hơn',
    'sản phẩm nào có nhiều option màu hơn', 'biến thể màu nào đang có',
    'có màu gì', 'có mấy loại dung lượng'
  ].forEach(s => ai.addDocument(s, 'COMPARE_ACCESSORIES'));

  // ── ASK_RECOMMEND: Gợi ý theo nhu cầu
  [
    'khoảng 10 triệu nên mua gì', 'tầm 5 triệu mua điện thoại gì',
    'mua laptop tặng sinh nhật', 'laptop cho học sinh sinh viên',
    'điện thoại chụp ảnh đẹp giá rẻ', 'máy nào pin khỏe nhất',
    'best seller của shop là gì', 'đang hot cái gì',
    'mua điện thoại tặng ba mẹ', 'laptop gaming tốt nhất tầm 20 triệu',
    'tai nghe chống ồn tốt', 'máy nào bền nhất hiện tại'
  ].forEach(s => ai.addDocument(s, 'ASK_RECOMMEND'));

  // ── CHECK_STOCK: Kiểm tra tồn kho
  [
    'còn hàng không', 'hết hàng rồi à', 'bao giờ có hàng lại',
    'có sẵn hàng không', 'cần gấp còn không', 'ship ngay hôm nay được không'
  ].forEach(s => ai.addDocument(s, 'CHECK_STOCK'));

  // ── PRICE_COMPLAINT: Chê mắc, mặc cả, hỏi hàng rẻ
  [
    'mắc quá', 'đắt thế', 'giá cao vậy', 'không có rẻ hơn không',
    'bớt chút được không', 'giảm giá thêm không', 'nơi khác rẻ hơn',
    'ngân sách không đủ', 'không có tầm tiền đó', 'quá tầm tài chính',
    'có cái rẻ hơn không', 'giá hơi cao so với nhu cầu', 'budget ít hơn',
    'shop bớt thêm không', 'deal thêm được không', 'nego giá được không',
    // Hỏi hàng giá phải chăng
    'giá cả phải chăng', 'giá phải chăng nhất', 'giá cả phải chăng nhất',
    'tìm hàng giá rẻ', 'cần hàng giá rẻ', 'sản phẩm giá rẻ nào tốt',
    'cho xem hàng rẻ', 'hàng giá tốt', 'hàng hợp lý', 'giá bình dân',
    'tầm giá thấp', 'trong tầm giá', 'giá ok không quá đắt',
    'tiết kiệm mà vẫn tốt', 'mua được không đắt', 'giá vừa phải',
    'affordable', 'giá sinh viên', 'rẻ mà chất lượng', 'rẻ nhất shop',
  ].forEach(s => ai.addDocument(s, 'PRICE_COMPLAINT'));

  // ── CHANGE_PRODUCT: Muốn đổi mặt hàng
  [
    'thôi đổi cái khác đi', 'có cái nào khác không', 'xem thêm mẫu khác',
    'không thích cái này', 'muốn xem mẫu khác', 'gợi ý mẫu khác đi',
    'cái khác có không', 'không hợp lắm', 'tìm cái khác xem',
    'không phải loại này', 'thay thế cái khác', 'options khác đâu'
  ].forEach(s => ai.addDocument(s, 'CHANGE_PRODUCT'));

  // ── TRACK_ORDER: Theo dõi đơn hàng
  [
    'đơn hàng của tôi đâu', 'đặt hàng rồi chưa thấy', 'bao giờ giao hàng',
    'kiểm tra đơn hàng', 'trạng thái đơn hàng', 'đơn hàng đang ở đâu',
    'tôi đặt hàng rồi sao chưa thấy', 'theo dõi đơn', 'order đang xử lý không',
    'hàng đang giao chưa', 'shipper gọi chưa'
  ].forEach(s => ai.addDocument(s, 'TRACK_ORDER'));

  // ── CANCEL_ORDER: Hủy đơn hàng
  [
    'hủy đơn hàng', 'tôi muốn hủy', 'không mua nữa', 'cancel đơn',
    'đổi ý rồi', 'thôi không mua nữa', 'hủy giúp mình', 'bỏ đơn được không',
    'huỷ order', 'xóa đơn hàng'
  ].forEach(s => ai.addDocument(s, 'CANCEL_ORDER'));

  // ── ASK_GIFT: Hỏi quà tặng kèm
  [
    'mua có tặng gì không', 'kèm theo phụ kiện gì', 'có quà tặng không',
    'mua laptop có tặng chuột không', 'mua điện thoại có tặng ốp không',
    'freegift là gì', 'tặng kèm gì', 'có tặng tai nghe không',
    'combo mua kèm có gì', 'phụ kiện trong hộp gồm những gì'
  ].forEach(s => ai.addDocument(s, 'ASK_GIFT'));

  // ── COMPLAINT: Phàn nàn, khiếu nại
  [
    'hàng bị lỗi', 'sản phẩm không như mô tả', 'mua về bị hỏng',
    'chất lượng kém', 'không hài lòng', 'muốn khiếu nại', 'dịch vụ tệ',
    'giao hàng trễ', 'ship lâu quá', 'thái độ nhân viên không tốt',
    'bị lừa rồi', 'hàng giả không', 'sản phẩm lỗi', 'bị đánh tráo hàng'
  ].forEach(s => ai.addDocument(s, 'COMPLAINT'));

  // ════════════════════════════════════════════════
  // PHẦN 2: DỮ LIỆU MỞ RỘNG (30+ INTENT THỰC TẾ)
  // ════════════════════════════════════════════════


  // ── ASK_TRADE_IN: Đổi máy cũ lấy máy mới (Trade-in)
  [
    'đổi máy cũ lấy tiền được không', 'trade in được không', 'thu mua máy cũ không',
    'mình có máy cũ muốn đổi', 'máy cũ còn giá trị không', 'đổi iphone cũ lấy iphone mới',
    'bán máy cũ cho shop được không', 'thu cũ đổi mới', 'giá thu máy cũ bao nhiêu',
    'còn bảo hành mà muốn đổi máy khác', 'lên đời điện thoại được không',
    'định giá máy cũ cho mình', 'có nhận máy hư không', 'đổi máy lỗi lấy tiền',
  ].forEach(s => ai.addDocument(s, 'ASK_TRADE_IN'));

  // ── ASK_AUTHENTIC: Hỏi hàng chính hãng, xuất xứ, chống hàng giả
  [
    'hàng chính hãng không', 'hàng xách tay hay chính hãng', 'có giấy tờ xuất xứ không',
    'hàng fake không', 'hàng công ty hay hàng nhái', 'hàng lock hay quốc tế',
    'bảo hành apple care hay bảo hành shop', 'iphone mỹ hay iphone việt nam',
    'samsung chính hãng samsung vina', 'có seal chưa bóc không', 'hàng nguyên seal không',
    'kiểm tra imei được không', 'làm sao biết hàng thật', 'có hóa đơn xuất hàng không'
  ].forEach(s => ai.addDocument(s, 'ASK_AUTHENTIC'));

  // ── ASK_DISCOUNT_SPECIAL: Giảm giá đặc biệt, giá sỉ, sinh viên
  [
    'có giảm giá sinh viên không', 'sinh viên mua có ưu đãi không', 'thẻ sinh viên giảm được không',
    'nhân viên công ty mua có giá đặc biệt không', 'đặt hàng số lượng nhiều có rẻ không',
    'mua 2 cái có giảm giá không', 'giá sỉ bao nhiêu', 'mua 10 cái giá sao',
    'có chương trình khách hàng thân thiết không', 'mua lần đầu có giảm không',
    'giới thiệu bạn bè mua có tiền không', 'thành viên vip có ưu đãi gì',
  ].forEach(s => ai.addDocument(s, 'ASK_DISCOUNT_SPECIAL'));

  // ── ASK_REPAIR: Sửa chữa, bảo trì
  [
    'sửa điện thoại được không', 'thay màn hình ở đâu', 'thay pin điện thoại chỗ nào',
    'điện thoại bị vỡ màn sửa bao nhiêu', 'laptop không lên nguồn sửa ở đâu',
    'bàn phím laptop hỏng sửa được không', 'loa điện thoại bị hỏng',
    'camera bị mờ sửa được không', 'điện thoại vào nước cứu được không',
    'pin phồng có nguy hiểm không', 'máy bị chậm phải làm sao',
    'điện thoại bị treo không tắt được', 'reset máy có mất dữ liệu không'
  ].forEach(s => ai.addDocument(s, 'ASK_REPAIR'));

  // ── ASK_CAMERA: Camera, chụp ảnh, quay phim
  [
    'điện thoại nào chụp ảnh đẹp nhất', 'camera trước hay camera sau',
    'bao nhiêu megapixel', 'có quay 4k không', 'chụp ảnh ban đêm tốt không',
    'có chế độ portrait không', 'camera có optical zoom không', 'wide angle lens không',
    'quay vlog điện thoại nào tốt', 'chụp ảnh thiếu sáng cái nào ngon hơn',
    'camera selfie bao nhiêu mp', 'có ois chống rung không',
    'dùng tiktok quay video nào đẹp nhất', 'điện thoại nào màu sắc đẹp nhất'
  ].forEach(s => ai.addDocument(s, 'ASK_CAMERA'));

  // ── ASK_BATTERY: Pin, sạc nhanh, sạc không dây
  [
    'pin bao nhiêu mah', 'dùng được bao lâu một lần sạc', 'sạc nhanh bao nhiêu watt',
    'có sạc không dây không', 'có sạc ngược không', 'pin hao nhanh không',
    'chơi game pin tụt nhanh không', 'cục sạc bao nhiêu watt kèm theo',
    'có magsafe không', 'sạc đầy mất bao lâu', 'pin có tháo rời không',
    'dùng airpods pin được mấy tiếng', 'pin laptop bảo hành riêng không',
    'pin phình bảo hành không', 'sạc qua đêm có hỏng pin không'
  ].forEach(s => ai.addDocument(s, 'ASK_BATTERY'));

  // ── ASK_DISPLAY: Màn hình, tần số quét, độ phân giải
  [
    'màn hình bao nhiêu inch', 'độ phân giải bao nhiêu', 'màn hình amoled hay ips',
    'tần số quét bao nhiêu hz', 'có màn 120hz không', 'màn hình có hdr không',
    'màn hình ngoài trời có nhìn thấy không', 'màn hình cong hay phẳng',
    'màn hình oled hay lcd', 'có chế độ night mode không',
    'màn laptop có cảm ứng không', 'màn laptop bao nhiêu hz',
    'màn retina display không', 'tỉ lệ màn hình bao nhiêu', 'có notch không'
  ].forEach(s => ai.addDocument(s, 'ASK_DISPLAY'));

  // ── ASK_STORAGE: Bộ nhớ, dung lượng, thẻ nhớ
  [
    'dung lượng bộ nhớ bao nhiêu', 'có thể cắm thẻ nhớ không', 'bộ nhớ trong bao nhiêu gb',
    'ram bao nhiêu', 'có thể nâng cấp ram không', 'dung lượng đám mây bao nhiêu',
    'có icloud không', 'có google one không', '64gb đủ dùng không', '128gb đủ không',
    'có ổ ssd không', 'tốc độ đọc ghi bao nhiêu', 'hết bộ nhớ phải làm sao',
    'xóa app có lấy lại bộ nhớ không', 'ảnh video tốn bộ nhớ nhiều không'
  ].forEach(s => ai.addDocument(s, 'ASK_STORAGE'));

  // ── ASK_CONNECTIVITY: 5G, WiFi, Bluetooth, NFC, cổng kết nối
  [
    'có 5g không', 'hỗ trợ 5g không', 'wifi 6 không', 'bluetooth bao nhiêu',
    'có nfc không', 'nfc thanh toán được không', 'có usb c không', 'thunderbolt 4 không',
    'kết nối tai nghe 3.5mm không', 'có thể kết nối tv không', 'airdrop được không',
    'hotspot được không', 'hai sim không', 'có esim không', 'kết nối điện thoại với laptop',
    'có hdmi không', 'có lightning không'
  ].forEach(s => ai.addDocument(s, 'ASK_CONNECTIVITY'));

  // ── ASK_GAMING: Gaming, chơi game, hiệu năng
  [
    'chơi game có lag không', 'chơi liên quân ổn không', 'chơi pubg mobile tốt không',
    'chơi genshin impact được không', 'fps cao không khi chơi game', 'có chế độ gaming không',
    'tản nhiệt có tốt không', 'laptop gaming dưới 20 triệu', 'có card đồ họa rời không',
    'vga card gì', 'rtx hay gtx', 'chơi game lâu có nóng không', 'xung nhịp cpu bao nhiêu',
    'có thể chơi valorant không', 'chơi free fire mượt không', 'gpu bao nhiêu vram'
  ].forEach(s => ai.addDocument(s, 'ASK_GAMING'));

  // ── ASK_NEW_ARRIVAL: Hàng mới về, sản phẩm mới nhất
  [
    'có hàng mới về không', 'sản phẩm mới nhất là gì', 'iphone mới nhất là gì',
    'samsung mới nhất model nào', 'mới ra mắt cái nào', 'có hàng pre order không',
    'khi nào có hàng', 'bao giờ ra mắt', 'đang chờ hàng về',
    'có thông tin về iphone 16 không', 'pixel mới nhất là gì', 'surface pro mới ra chưa'
  ].forEach(s => ai.addDocument(s, 'ASK_NEW_ARRIVAL'));

  // ── ASK_BEST_SELLER: Bán chạy, phổ biến, được đánh giá cao
  [
    'điện thoại bán chạy nhất', 'laptop hot nhất hiện tại', 'tai nghe bán chạy',
    'đang hot cái gì', 'mọi người hay mua cái nào', 'sản phẩm được đánh giá cao nhất',
    'review tốt nhất là gì', 'khách hàng ưa chuộng nhất là gì', 'top bán chạy',
    'điện thoại phổ biến nhất', 'laptop được mua nhiều nhất', 'đồng hồ thông minh nào bán chạy'
  ].forEach(s => ai.addDocument(s, 'ASK_BEST_SELLER'));

  // ── ASK_PREORDER: Đặt trước, pre-order
  [
    'đặt trước được không', 'pre order được không', 'đặt cọc trước không',
    'bao giờ có hàng chính thức', 'ngày ra mắt là khi nào', 'đặt trước cần trả bao nhiêu',
    'đặt trước có được giá ưu đãi không', 'sản phẩm chưa ra mắt đặt được không',
    'iphone 17 đặt trước được chưa', 'galaxy s25 ra chưa', 'đăng ký thông báo khi có hàng'
  ].forEach(s => ai.addDocument(s, 'ASK_PREORDER'));

  // ── ASK_INVOICE: Hóa đơn VAT, hóa đơn điện tử
  [
    'có xuất hóa đơn vat không', 'hóa đơn đỏ được không', 'cần hóa đơn tài chính',
    'mua cho công ty có xuất hóa đơn không', 'hóa đơn điện tử được không',
    'thuế vat bao nhiêu', 'giá đã bao gồm vat chưa', 'xuất hóa đơn theo tên công ty',
    'có phiếu bảo hành không', 'giấy tờ mua hàng gồm những gì'
  ].forEach(s => ai.addDocument(s, 'ASK_INVOICE'));

  // ── ASK_GIFT_WRAP: Gói quà, đóng gói đặc biệt
  [
    'gói quà được không', 'có dịch vụ gói quà không', 'mua tặng người yêu có gói quà không',
    'hộp quà đẹp không', 'khắc tên lên sản phẩm được không', 'in tên lên ốp lưng',
    'thiệp chúc mừng đính kèm được không', 'mua tặng sinh nhật đóng gói như thế nào',
    'giao tận nơi kèm hoa được không', 'surprise delivery được không'
  ].forEach(s => ai.addDocument(s, 'ASK_GIFT_WRAP'));

  // ── BULK_ORDER: Mua sỉ, số lượng lớn
  [
    'mua số lượng lớn có giá sỉ không', 'mua 10 cái giá bao nhiêu', 'giá đại lý bao nhiêu',
    'mua cho cơ quan có chiết khấu không', 'đặt hàng 50 chiếc laptop', 'mua theo lô',
    'hợp tác kinh doanh được không', 'trở thành đại lý được không', 'nhượng quyền phân phối',
    'mua hàng trả dần cho nhân viên công ty', 'mua ipad cho cả lớp học'
  ].forEach(s => ai.addDocument(s, 'BULK_ORDER'));

  // ── ASK_COMPATIBILITY: Tương thích phụ kiện, thiết bị ngoại vi
  [
    'cáp này cắm được không', 'sạc samsung dùng cho iphone được không',
    'tai nghe có dây cắm được không', 'ốp lưng iphone 14 dùng cho 15 được không',
    'bộ nhớ ngoài dùng cho iphone được không', 'chuột bluetooth kết nối ipad được không',
    'bàn phím apple magic dùng cho macbook m2 được không', 'màn hình ngoài kết nối laptop thế nào',
    'đồng hồ apple watch dùng cho android được không', 'airpods dùng cho samsung được không',
    'hub usb c có hỗ trợ không', 'dock sạc có dùng cho pixel không'
  ].forEach(s => ai.addDocument(s, 'ASK_COMPATIBILITY'));

  // ── INSTALLATION_HELP: Cài đặt, setup ban đầu, chuyển dữ liệu
  [
    'mua về cần làm gì đầu tiên', 'cách cài đặt ban đầu', 'chuyển dữ liệu từ máy cũ sang máy mới',
    'backup dữ liệu như thế nào', 'cài app gì cho máy mới', 'setup iphone lần đầu',
    'cách đăng nhập apple id', 'kích hoạt bảo hành online', 'đăng ký thành viên',
    'hướng dẫn sử dụng ở đâu', 'có video hướng dẫn không', 'cài windows cho laptop',
    'cài office được không', 'cần mật khẩu gì để kích hoạt máy'
  ].forEach(s => ai.addDocument(s, 'INSTALLATION_HELP'));

  // ── ASK_DESIGN: Thiết kế, màu sắc, kích thước, trọng lượng
  [
    'kích thước bao nhiêu', 'nặng bao nhiêu gram', 'mỏng bao nhiêu', 'dày bao nhiêu mm',
    'cầm vừa tay không', 'màn 6.7 inch có to không', 'laptop 14 inch có nhỏ gọn không',
    'đút túi quần được không', 'có màu đen không', 'thiết kế có đẹp không',
    'chất liệu vỏ máy làm bằng gì', 'có titan không', 'viền màn hình mỏng không',
    'có nút home không', 'nhận dạng khuôn mặt được không', 'máy có màu nào'
  ].forEach(s => ai.addDocument(s, 'ASK_DESIGN'));

  // ── ASK_WATERPROOF: Chống nước, chống bụi, chuẩn IP
  [
    'chống nước không', 'ip68 không', 'chống bụi không', 'rớt nước có hỏng không',
    'bơi lội được không', 'có thể chụp ảnh dưới nước không', 'bao nhiêu mét nước',
    'ip67 là gì', 'mưa có sao không', 'chống thấm tốt không', 'dùng ngoài trời được không',
    'bị ướt có bảo hành không', 'máy bị ngấm nước thì sao'
  ].forEach(s => ai.addDocument(s, 'ASK_WATERPROOF'));

  // ── ASK_OS: Hệ điều hành, phần mềm, update
  [
    'chạy android hay ios', 'android bao nhiêu', 'có update lên android mới nhất không',
    'ios bao nhiêu', 'bao lâu được update', 'hỗ trợ cập nhật mấy năm', 'chạy macos không',
    'có windows 11 không', 'chạy linux được không', 'có ms office không',
    'có bản quyền windows không', 'máy có cài sẵn app gì', 'bloatware nhiều không',
    'có thể xóa app hệ thống không', 'root được không', 'jailbreak được không'
  ].forEach(s => ai.addDocument(s, 'ASK_OS'));

  // ── ASK_LOYALTY: Điểm thưởng, thành viên VIP, tích điểm
  [
    'có tích điểm không', 'điểm thưởng đổi được gì', 'thành viên vip là gì',
    'đăng ký thành viên ở đâu', 'cách tích điểm', 'điểm có hết hạn không',
    'thành viên gold là gì', 'quyền lợi thành viên thường niên', 'mua bao nhiêu tiền lên hạng',
    'có ứng dụng tích điểm không', 'điểm quy đổi thành tiền được không'
  ].forEach(s => ai.addDocument(s, 'ASK_LOYALTY'));

  // ── SMALLTALK: Chit chat, tạm biệt, cảm ơn, thắc mắc linh tinh
  [
    'hôm nay đẹp trời nhỉ', 'em tên gì', 'mày là ai', 'ai tạo ra mày',
    'bạn là robot không', 'em có thật không', 'cảm ơn bạn nhiều',
    'thanks shop', 'cảm ơn đã tư vấn', 'bye', 'chào tạm biệt', 'hẹn gặp lại',
    'ok mình hiểu rồi', 'cảm ơn nhé ạ', 'tuyệt vời', 'được rồi nhé',
    'thôi không hỏi nữa', 'mình quyết định rồi', 'tôi muốn hỏi điều khác'
  ].forEach(s => ai.addDocument(s, 'SMALLTALK'));

  // ── FEEDBACK_POSITIVE: Khách hài lòng, khen ngợi
  [
    'sản phẩm tốt lắm', 'hài lòng lắm shop', 'mua về ổn lắm', 'dùng tốt lắm',
    'giao hàng nhanh', 'nhân viên nhiệt tình', 'shop uy tín', 'sẽ mua lần nữa',
    'giới thiệu bạn bè mua', 'quá tốt luôn', 'đúng như mô tả', 'xuất sắc',
    '5 sao cho shop', 'hàng chất lượng', 'shop làm tốt lắm', 'rất hài lòng'
  ].forEach(s => ai.addDocument(s, 'FEEDBACK_POSITIVE'));

  // ── ASK_WORKING_HOURS: Giờ mở cửa, giờ làm việc
  [
    'mấy giờ mở cửa', 'đến mấy giờ thì đóng', 'thứ 7 có mở không', 'chủ nhật mở cửa không',
    'ngày lễ có làm không', 'giờ làm việc', 'buổi tối có mở không', 'bao giờ đóng cửa',
    'có hỗ trợ 24/7 không', 'chat lúc nào có người trả lời'
  ].forEach(s => ai.addDocument(s, 'ASK_WORKING_HOURS'));

  // ── ASK_WARRANTY_DETAIL: Chi tiết bảo hành từng hãng, điều kiện bảo hành
  [
    'bảo hành apple care là gì', 'samsung care plus', 'bảo hành 1 đổi 1 là gì',
    'bảo hành tại nhà được không', 'bảo hành toàn cầu không',
    'du lịch nước ngoài bị hỏng bảo hành không', 'bảo hành bao gồm những gì',
    'bảo hành không bao gồm trường hợp nào', 'màn hình bị lỗi có bảo hành không',
    'vỡ màn do rớt có bảo hành không', 'mua bảo hành mở rộng được không',
    'bảo hành 2 năm hay 1 năm', 'pin có bảo hành riêng không'
  ].forEach(s => ai.addDocument(s, 'ASK_WARRANTY_DETAIL'));

  // ── ASK_INSTALLMENT_DETAIL: Chi tiết trả góp, điều kiện, giấy tờ
  [
    'trả góp lãi suất bao nhiêu', 'trả góp 12 tháng bao nhiêu một tháng',
    'điều kiện trả góp là gì', 'cần giấy tờ gì để trả góp', 'chứng minh thu nhập không',
    'không có thẻ tín dụng trả góp được không', 'trả góp qua hdbank', 'fecredit trả góp được không',
    'home credit được không', 'trả góp lương thấp vẫn được không', 'cần cmnd và gì nữa',
    'trả góp online được không', 'trả trước bao nhiêu phần trăm'
  ].forEach(s => ai.addDocument(s, 'ASK_INSTALLMENT_DETAIL'));

  // ── URGENT_NEED: Cần gấp, giao hỏa tốc, ngay trong ngày
  [
    'cần gấp lắm', 'hôm nay có hàng không', 'ship hỏa tốc được không',
    'giao trong 2 tiếng được không', 'cần ngay bây giờ', 'khẩn cấp cần mua',
    'mai đi công tác cần máy ngay', 'tặng sinh nhật ngày mai', 'đặt hàng giờ giao lúc nào',
    'nếu đặt bây giờ bao giờ nhận được', '1 tiếng nữa giao được không'
  ].forEach(s => ai.addDocument(s, 'URGENT_NEED'));

  // ── ASK_SECOND_HAND: Hàng cũ, refurbished, like new, trưng bày
  [
    'có bán hàng cũ không', 'điện thoại refurbished', 'hàng like new là gì',
    'máy qua sử dụng có đảm bảo không', 'hàng trưng bày có bán không',
    'iphone cũ giá bao nhiêu', 'macbook cũ có bán không', 'có bảo hành hàng cũ không',
    'hàng tân trang', 'certified refurbished là gì', 'mua máy cũ chỗ nào uy tín',
    'hàng demo là gì', 'máy cũ 99 là sao'
  ].forEach(s => ai.addDocument(s, 'ASK_SECOND_HAND'));

  // ── ASK_ACCESSORIES: Phụ kiện riêng lẻ, ốp lưng, cáp, sạc
  [
    'có bán ốp lưng không', 'cáp sạc loại c có không', 'sạc nhanh 65w có bán không',
    'cường lực dán màn hình', 'tai nghe có dây giá rẻ', 'bao da ipad',
    'bàn phím bluetooth cho ipad', 'chuột không dây', 'tay cầm chơi game',
    'loa bluetooth giá rẻ', 'pin dự phòng bao nhiêu mah', 'đế sạc không dây',
    'giá đỡ điện thoại', 'tripod quay phim', 'lens chụp ảnh gắn điện thoại',
    // Tai nghe
    'tôi muốn mua tai nghe', 'cần mua tai nghe', 'cho xem tai nghe',
    'tai nghe không dây nào tốt', 'tai nghe bluetooth loại nào hay',
    'tai nghe có dây nào ngon', 'tai nghe gaming tốt', 'tai nghe chống ồn',
    'tai nghe sony', 'tai nghe samsung', 'tai nghe jbl', 'tai nghe bose',
    'airpods giá bao nhiêu', 'airpods pro hay airpods thường', 'airpods 4 hay không',
    'tai nghe sennheiser', 'tai nghe jabra', 'tai nghe anker soundcore',
    'tai nghe in ear', 'tai nghe over ear', 'tai nghe true wireless',
    // Đồng hồ thông minh
    'tôi muốn mua đồng hồ thông minh', 'cần mua smartwatch', 'cho xem đồng hồ',
    'đồng hồ thông minh loại nào tốt', 'smartwatch nào đáng mua',
    'apple watch giá bao nhiêu', 'apple watch series mới nhất',
    'samsung galaxy watch', 'garmin forerunner', 'amazfit gtr',
    'đồng hồ đo sức khỏe', 'đồng hồ theo dõi nhịp tim', 'đồng hồ đo giấc ngủ',
    // Micro, loa
    'micro thu âm', 'micro karaoke', 'micro không dây', 'micro có dây',
    'loa bluetooth portable', 'loa jbl', 'loa bose', 'loa sony',
    'loa mini', 'loa nghe nhạc phòng', 'loa kéo bluetooth',
  ].forEach(s => ai.addDocument(s, 'ASK_ACCESSORIES'));

  // ── ASK_PRICE_HISTORY: Lịch sử giá, xu hướng giá, thời điểm tốt để mua
  [
    'giá này có rẻ không so với trước', 'giá có giảm không', 'tháng sau giá có giảm không',
    'có nên chờ mua không', 'sau tết giá có rẻ hơn không', 'lịch sử giá của sản phẩm này',
    'hồi năm ngoái giá bao nhiêu', 'xuống giá chưa', 'khi nào giảm giá mạnh nhất',
    'black friday có sale không', 'tết có giảm giá nhiều không', '11/11 có sale không',
    '12/12 có giảm không', 'ngày độc thân có sale không'
  ].forEach(s => ai.addDocument(s, 'ASK_PRICE_HISTORY'));

  // ── ASK_SOCIAL_PROOF: Review từ người dùng khác, youtuber, influencer
  [
    'youtuber review cái này chưa', 'có trên tiktok không', 'influencer nào đang dùng',
    'video review tiếng việt ở đâu', 'đánh giá trên youtube như thế nào',
    'bình thường đánh giá 4 sao 5 sao', 'có nhiều người mua không', 'khách review tốt không',
    'báo điện tử đánh giá thế nào', 'thế giới di động đánh giá sao', 'mkbhd review chưa'
  ].forEach(s => ai.addDocument(s, 'ASK_SOCIAL_PROOF'));

  // ── ASK_TRY_BEFORE_BUY: Trải nghiệm, dùng thử trước khi mua
  [
    'có thể đến thử máy trước không', 'dùng thử trước khi mua được không',
    'có phòng trưng bày không', 'cho xem demo không', 'cho thử chụp ảnh thử được không',
    'return policy như thế nào nếu không hài lòng', 'mua về dùng 7 ngày không thích trả lại được không',
    'có thể mượn dùng thử không'
  ].forEach(s => ai.addDocument(s, 'ASK_TRY_BEFORE_BUY'));

  // ── MULTI_QUESTION: Hỏi nhiều thứ trong một tin nhắn
  [
    'giá bao nhiêu và giao hàng mấy ngày', 'còn hàng không và bảo hành bao lâu',
    'có trả góp không và giá bao nhiêu', 'cấu hình thế nào và pin được mấy tiếng',
    'có màu đen không và còn hàng không', 'ship nhanh không và phí bao nhiêu',
    'chính hãng không và bảo hành bao lâu'
  ].forEach(s => ai.addDocument(s, 'MULTI_QUESTION'));

};
