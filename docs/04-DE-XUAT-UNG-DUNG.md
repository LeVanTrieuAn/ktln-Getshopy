# ĐỀ XUẤT CÁC ỨNG DỤNG KHÁC TRÊN NỀN TẢNG DỮ LIỆU

Tài liệu này liệt kê các ứng dụng có thể xây dựng trên nền tảng dữ liệu, ngoài bốn module đã chốt trong [03-AI-INTEGRATION.md](03-AI-INTEGRATION.md). Mục đích: (1) có sẵn phương án khi GVHD muốn thêm hướng ứng dụng, (2) làm nội dung cho chương "hướng phát triển", (3) chứng minh nền tảng là **hạ tầng dùng chung** — mỗi ứng dụng mới chỉ cần thêm mô hình dữ liệu, không phải xây lại đường ống.

Cột **Chi phí** đánh giá theo công sức triển khai thêm; **Giá trị demo** đánh giá theo mức độ thuyết phục khi bảo vệ.

---

## 1. Bảng tổng hợp

| # | Ứng dụng | Chi phí | Giá trị demo | Dữ liệu cần thêm |
|---|---|---|---|---|
| A1 | Phát hiện bất thường doanh thu / vận hành | Thấp | Cao | Không |
| A2 | Cảnh báo hết hàng & đề xuất bổ hàng | Thấp | Cao | Không (dùng AI-2) |
| A3 | Dự báo và cảnh báo khách rời bỏ (churn) | Thấp | Trung bình | Không |
| A4 | Định giá động và phân tích độ co giãn theo giá | Trung bình | Cao | Lịch sử thay đổi giá |
| A5 | Phân tích giỏ hàng & tối ưu bố trí gian hàng | Thấp | Trung bình | Không |
| A6 | Phát hiện gian lận đơn hàng / lạm dụng voucher | Trung bình | Cao | Nhãn nghi vấn (có thể mô phỏng) |
| A7 | Phân tích phễu chuyển đổi và hành trình khách hàng | Trung bình | Cao | Sự kiện hành vi đầy đủ hơn |
| A8 | Dự báo tài chính & phân tích lợi nhuận đa chiều | Trung bình | Trung bình | Dữ liệu giá vốn, chi phí |
| A9 | Trung tâm quan sát SLA dữ liệu cho người nghiệp vụ | Thấp | Rất cao | Không (dùng lớp `audit`) |
| A10 | Hệ thống báo cáo tự động và bản tin định kỳ | Thấp | Trung bình | Không |
| A11 | Tìm kiếm ngữ nghĩa và tìm kiếm bằng hình ảnh | Cao | Cao | Véc-tơ nhúng sản phẩm |
| A12 | Tối ưu lộ trình giao hàng | Cao | Trung bình | Dữ liệu địa lý, đội xe |
| A13 | Tính điểm và phân hạng nhà cung cấp | Trung bình | Thấp | Dữ liệu nhập hàng |
| A14 | Phân tích hiệu quả nhân viên và ca làm việc | Thấp | Thấp | Dữ liệu ca làm |

---

## 2. Chi tiết các ứng dụng đáng cân nhắc nhất

### A9 — Trung tâm quan sát SLA dữ liệu cho người nghiệp vụ ⭐ *khuyến nghị làm*
**Vì sao đáng làm:** chi phí gần như bằng không (dữ liệu đã có ở lớp `audit`) nhưng thể hiện trực tiếp điểm nhấn học thuật của đề tài. Thay vì để trạng thái đối soát nằm trong dashboard kỹ thuật, đưa nó thành một màn hình cho người dùng nghiệp vụ: "số liệu bạn đang xem đã được đối soát tới 14:00, khớp 100% với hệ thống nguồn" — kèm dòng thời gian trạng thái đối soát, lịch sử sự cố và thời gian phục hồi.
**Cách làm:** một màn hình đọc `audit.checksum_*`, cộng một dải trạng thái nhỏ gắn trên mỗi biểu đồ báo cáo.
**Điểm mạnh khi bảo vệ:** trả lời được câu hỏi khó nhất mà hội đồng thường đặt ra — "làm sao bạn biết số liệu này đúng?"

### A1 — Phát hiện bất thường doanh thu và vận hành ⭐ *khuyến nghị làm*
**Nội dung:** so số liệu thực tế theo giờ/ngày với khoảng dự báo của AI-2; vượt ngưỡng thì phát cảnh báo kèm phân tích đóng góp theo chiều (bất thường đến từ cửa hàng nào, danh mục nào, kênh nào).
**Phương pháp:** khoảng dự báo từ mô hình đã có, hoặc thống kê đơn giản (điểm z, phân vị) trên chuỗi có yếu tố mùa vụ — không cần mô hình mới.
**Chi phí:** thấp, vì tái sử dụng AI-2 và màn hình Alerts đã có trong ứng dụng.

### A2 — Cảnh báo hết hàng và đề xuất bổ hàng ⭐ *khuyến nghị làm*
**Nội dung:** với mỗi (sản phẩm, cửa hàng), so nhu cầu dự báo trong thời gian bổ hàng với tồn kho khả dụng → xếp hạng mức độ cấp thiết; đề xuất số lượng đặt theo mức phục vụ mong muốn.
**Vì sao đáng làm:** cho phần dự báo một đầu ra nghiệp vụ rõ ràng, thay vì chỉ hiển thị đường dự báo. Đây là câu trả lời cho câu hỏi "dự báo xong rồi dùng để làm gì?"

### A6 — Phát hiện gian lận đơn hàng và lạm dụng voucher
**Nội dung:** phát hiện các mẫu bất thường: nhiều tài khoản dùng chung địa chỉ/thẻ, tỉ lệ hoàn đơn bất thường, dùng voucher hàng loạt trong thời gian ngắn, đơn giá trị lớn ngay sau khi tạo tài khoản.
**Phương pháp:** hệ luật cho các mẫu rõ ràng + phát hiện điểm dị biệt không giám sát (Isolation Forest) + 🔹phân tích đồ thị quan hệ tài khoản.
**Vì sao đáng cân nhắc:** gắn rất chặt với dữ liệu voucher/campaign mà đề tài đã có; bộ sinh dữ liệu có thể chèn sẵn một số mẫu gian lận để đánh giá được độ chính xác.

### A7 — Phân tích phễu chuyển đổi và hành trình khách hàng
**Nội dung:** phễu xem → thêm giỏ → thanh toán → hoàn tất, tách theo phân khúc, thiết bị, kênh; phân tích giỏ hàng bị bỏ; phân tích theo nhóm khách theo tháng đầu mua (cohort) để đo tỉ lệ giữ chân.
**Cần thêm:** thu sự kiện hành vi chi tiết hơn — nhưng đây cũng là dữ liệu mà AI-1 cần, nên chi phí biên thấp.
**Điểm kỹ thuật đáng nói:** đây là dạng dữ liệu dòng sự kiện (event stream) khối lượng lớn, ghi thêm liên tục — tương phản rõ với dữ liệu đơn hàng nhiều cập nhật, nên minh hoạ tốt việc chọn engine và chiến lược phân vùng khác nhau cho hai loại tải khác nhau.

### A4 — Định giá động và phân tích độ co giãn theo giá
**Nội dung:** ước lượng độ co giãn của cầu theo giá cho từng danh mục và phân khúc; đề xuất khoảng giá tối ưu theo mục tiêu (doanh thu hoặc lợi nhuận gộp).
**Cần thêm:** bảng lịch sử thay đổi giá (bộ sinh dữ liệu tạo được).
**Lưu ý:** phần này cần trung thực về mặt phương pháp — dữ liệu quan sát không cho phép kết luận nhân quả về giá; nên trình bày như phân tích tương quan có kiểm soát, kèm nêu rõ hạn chế.

### A11 — Tìm kiếm ngữ nghĩa và tìm kiếm bằng hình ảnh
**Nội dung:** nhúng mô tả sản phẩm (và ảnh) thành véc-tơ, tìm kiếm theo độ tương đồng; hỗ trợ truy vấn kiểu "điện thoại pin khoẻ dưới 8 triệu".
**Chi phí:** cao (cần mô hình nhúng, cần lưu và tìm kiếm véc-tơ — ClickHouse có hỗ trợ tìm kiếm véc-tơ nhưng cần thiết lập thêm).
**Ghi chú:** hấp dẫn khi demo, nhưng lệch khỏi trọng tâm nền tảng dữ liệu; nên xếp vào hướng phát triển.

---

## 3. Ba ứng dụng nên bổ sung nếu GVHD muốn thêm

Nếu cần thêm phần ứng dụng mà không muốn phình phạm vi, ba lựa chọn sau có tỉ lệ giá trị/chi phí tốt nhất và **không cần thêm dữ liệu nguồn mới**:

1. **A9 Trung tâm quan sát SLA dữ liệu** — tăng trực tiếp sức nặng học thuật của đề tài, chi phí gần bằng không.
2. **A2 Cảnh báo hết hàng và đề xuất bổ hàng** — biến dự báo thành quyết định nghiệp vụ.
3. **A1 Phát hiện bất thường** — dùng lại đúng mô hình dự báo, cho ra một tính năng khác hẳn về mặt trải nghiệm.

Cả ba đều tái sử dụng dữ liệu và mô hình đã có, tổng công sức thêm khoảng một tuần, và mỗi cái đều bổ sung một mục nghiệm thu rõ ràng cho luận văn.

---

## 4. Lập luận kiến trúc rút ra từ danh sách này

Điều đáng nhấn mạnh khi bảo vệ: **mười bốn ứng dụng ở trên dùng chung một đường ống dữ liệu duy nhất.** Không ứng dụng nào cần thu nhận lại từ nguồn, không ứng dụng nào truy vấn trực tiếp hệ thống tác nghiệp. Ứng dụng mới chỉ cần thêm mô hình dbt và một bảng kết quả.

Đó chính là định nghĩa của một *nền tảng* (platform) so với một *đường ống báo cáo* (reporting pipeline), và là lý do phần lõi của đề tài — thu nhận, mô hình hoá, đối soát, giám sát — được đặt làm trọng tâm thay vì các tính năng ứng dụng phía trên.
