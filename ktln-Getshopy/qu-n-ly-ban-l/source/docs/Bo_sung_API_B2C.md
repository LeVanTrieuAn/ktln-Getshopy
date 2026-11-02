# Bổ sung báo cáo: Cập nhật phần API B2C (Phụ lục A và các mục liên quan)

Tài liệu này dành cho file `DACNTT + KLTN .docx`. Nội dung đối chiếu **Phụ lục A** của báo cáo với mã nguồn hiện tại ở phần `/api/b2c` và các tuyến liên quan phía khách. Không có thay đổi mã nguồn nào đi kèm. Phần quản trị (`/api/b2b`) và các tuyến báo cáo nằm trong tệp `Bo_sung_Ra_soat_Xac_thuc_API.md`.

Phương pháp: đọc tĩnh các tệp `routes/b2c.js`, `routes/tracking.js`, `routes/onboarding.js`, `routes/recommendation.js`, `routes/payment.js`, `middleware/authB2C.js`, `index.js` và `client/src/services/api.js`. Chưa gửi yêu cầu tới hệ thống đang chạy, nên các nhận xét về hành vi ở §3 là suy ra từ mã, chưa phải kết quả thử nghiệm.

## 0. Bảng chỉ dẫn vị trí chèn

| STT | Vị trí trong docx | Thao tác | Nội dung |
|---|---|---|---|
| 1 | Bảng A.1 | Thêm 1 dòng | §1.1 |
| 2 | Bảng A.2 | Sửa 2 dòng, thêm tham số lọc giá | §1.2 |
| 3 | Bảng A.3 | Sửa 2 dòng | §1.3 |
| 4 | Bảng A.4 | Sửa 1 dòng | §1.4 |
| 5 | Bảng A.5 | Thêm 1 dòng và sửa câu dẫn "Bốn tuyến dưới đây…" thành "Năm tuyến dưới đây…" | §1.5 |
| 6 | Câu mở đầu Phụ lục A ("đủ 89 endpoint") | Kiểm tra lại con số (xem §5) | §5 |
| 7 | A.12.3 Danh sách sản phẩm | Thêm tham số `min_price`, `max_price` và các giá trị `sort` | §2.1 |
| 8 | A.12.12 Trợ lý hội thoại | Sửa thời gian chờ và mã lỗi | §2.2 |
| 9 | A.12.5 Đặt hàng, và A.12.6 | Thêm một đoạn ghi chú về tuyến huỷ đơn | §2.3 |
| 10 | §5.1.2, cuối mục | Thêm đoạn mô tả xác thực phía khách | §3.1 |
| 11 | §7.4 Hạn chế | Thêm 1 gạch đầu dòng "Độ chặt của API khách" (đặt cạnh gạch đầu dòng "Bảo mật") | §3.2 |
| 12 | Bảng 2.2 (Tác nhân) và §2.5 | Không cần sửa | – |

## 1. Cập nhật các bảng của Phụ lục A

### 1.1. Bảng A.1. Thêm tuyến còn thiếu

Báo cáo hiện chưa liệt kê tuyến đặt mật khẩu cho tài khoản tạo bằng Google. Mã nguồn có tuyến này tại `routes/b2c.js` và client gọi qua `api.b2c.setPassword`.

| Phương thức | Đường dẫn | Xác thực | Chức năng |
|---|---|---|---|
| POST | `/api/b2c/auth/set-password` | Khách | Đặt hoặc đổi mật khẩu cho tài khoản đang đăng nhập (`new_password`); thêm `local` vào danh sách nhà cung cấp đăng nhập của tài khoản |

Các dòng còn lại của A.1 giữ nguyên.

### 1.2. Bảng A.2. Sửa hai dòng

| Dòng hiện tại | Sửa thành |
|---|---|
| `GET /api/b2c/products`, chức năng: "Danh sách sản phẩm; lọc category_id, brand_ids, search, branch_id; sắp xếp sort; phân trang page, limit" | "Danh sách sản phẩm; lọc `category_id`, `brand_ids`, `search`, `branch_id`, `min_price`, `max_price`; sắp xếp `sort`; phân trang `page`, `limit` (chưa có trần cho `limit`)" |
| `POST /api/b2c/products/:id/reviews`, xác thực "Không" | Giữ "Không" cho đúng hiện trạng, đổi chức năng thành: "Gửi đánh giá (`rating`, `comment`; `reviewer` do người gọi tự khai). **Không yêu cầu đăng nhập**; chưa giới hạn `rating` trong khoảng 1–5" |

### 1.3. Bảng A.3. Sửa hai dòng

| Dòng hiện tại | Sửa thành |
|---|---|
| `POST /api/b2c/cart/apply-voucher`, "Kiểm tra mã voucher với tổng giỏ hàng" | "Xem trước mức giảm của một mã (`code`, `cart_total`). `cart_total` do client gửi nên kết quả chỉ để hiển thị; mức giảm thật được tính lại ở bước đặt hàng. Công khai, không cần đăng nhập" |
| `POST /api/b2c/orders/:id/cancel`, "Khách tự huỷ đơn của mình…" | "Khách tự huỷ đơn của mình; các dòng hàng được trả lại tồn kho. Trả 404 nếu mã đơn không tồn tại, **403 nếu đơn tồn tại nhưng thuộc khách khác**" |

### 1.4. Bảng A.4. Sửa một dòng

| Dòng hiện tại | Sửa thành |
|---|---|
| `GET /api/b2c/behavior/stats`, xác thực "Không", "Thống kê sự kiện hành vi, dùng để gỡ lỗi" | Giữ "Không" nhưng thêm ghi chú: "Tuyến gỡ lỗi, chưa có xác thực; không phải API dành cho khách" |

### 1.5. Bảng A.5. Thêm tuyến còn thiếu

Máy chủ chuyển tiếp **năm** tuyến sang ai-bot (`index.js`), báo cáo chỉ liệt kê bốn. Tuyến còn thiếu là chuyển giọng nói thành chữ.

| Phương thức | Đường dẫn | Xác thực | Chức năng |
|---|---|---|---|
| POST | `/api/ai/transcribe` | Không | Chuyển giọng nói thành chữ (`audioBase64`, `mimeType`); trả `{ text }`, `text` rỗng nghĩa là không nghe rõ |

## 2. Sửa các ví dụ ở A.12

### 2.1. A.12.3 (danh sách sản phẩm)

Thêm vào đoạn mô tả tham số: `min_price` và `max_price` (lọc theo khoảng giá). Giá trị `sort` hợp lệ gồm `price_asc`, `price_desc`, `newest`, và ba tên đồng nghĩa cho "bán chạy" là `best_selling`, `bestseller`, `sold_desc`. Giá trị lạ được xem như `newest`.

### 2.2. A.12.12 (trợ lý hội thoại)

Báo cáo ghi thời gian chờ **120 giây**. Trong `index.js` (hàm `forwardToAiBot`) hằng số `AI_BOT_TIMEOUT_MS` là **30 giây**. Cần sửa thành 30 giây, hoặc kiểm tra lại cấu hình thực tế trước khi giữ 120 giây.

Mã lỗi: ngoài 502 khi ai-bot không phản hồi, máy chủ trả **504** với `{"error":"AI timeout", …}` khi quá thời gian chờ. Thêm vào danh sách "Lỗi thường gặp".

Thêm một câu: máy chủ chỉ chuyển tiếp `Content-Type` và thân yêu cầu, **không chuyển tiếp header `Authorization`** sang ai-bot. Vì vậy ai-bot không nhận được token của khách qua đường này.

### 2.3. A.12.5 và A.12.6 (đơn hàng)

Thêm vào cuối A.12.6 một đoạn ngắn:

> Tuyến huỷ đơn `POST /api/b2c/orders/:id/cancel` không dùng cùng quy tắc che giấu như tuyến trạng thái thanh toán: khi đơn tồn tại nhưng không thuộc khách gọi, tuyến trả 403 kèm thông báo "Đơn hàng này không thuộc về bạn", còn khi không có đơn trả 404. Sự khác biệt này cho phép dò xem một mã đơn có tồn tại hay không.

## 3. Đoạn văn cho §5.1.2 và §7.4

### 3.1. Đoạn thêm vào cuối §5.1.2

> Về phía khách, các tuyến được phân làm ba loại. Loại thứ nhất yêu cầu token (`authB2C`): đặt hàng, đơn của tôi, trạng thái thanh toán, huỷ đơn, sở thích, bỏ qua onboarding, danh sách yêu thích và đặt mật khẩu. Loại thứ hai nhận token tuỳ chọn (`optionalAuthB2C`): ghi sự kiện hành vi, sản phẩm xem gần đây và gợi ý "Dành riêng cho bạn"; token hợp lệ thì cá nhân hoá, token sai hoặc thiếu thì xử lý như khách vãng lai. Loại thứ ba công khai hoàn toàn: danh mục, hãng, sản phẩm, flash sale, sản phẩm tương tự, xu hướng, lựa chọn onboarding, kiểm tra voucher, đăng ký, đăng nhập, đăng nhập Google, gửi đánh giá và các tuyến trợ lý, tìm kiếm. Token khách có hạn 7 ngày và mang `role = customer`; middleware `authB2C` từ chối token mang vai trò khác. Hệ thống không có refresh token và không có cơ chế thu hồi token trước hạn.

### 3.2. Gạch đầu dòng thêm vào §7.4

> **Độ chặt của API khách.** Qua đọc mã, nhóm ghi nhận các điểm chưa chặt ở phía khách: (a) gửi đánh giá không yêu cầu đăng nhập, tên người đánh giá tự khai, điểm `rating` chưa bị giới hạn trong 1–5 và nội dung chưa giới hạn độ dài; (b) đăng ký chưa kiểm tra định dạng email, độ dài mật khẩu, và lưu email đúng như người dùng gõ trong khi đăng nhập Google chuyển sang chữ thường, nên cùng một địa chỉ viết khác hoa thường có thể tạo hai tài khoản; (c) đăng nhập trả mã 400 riêng cho tài khoản chỉ có Google, cho phép biết một email đã đăng ký hay chưa; (d) tuyến huỷ đơn trả 403 thay vì 404 khi đơn thuộc khách khác; (e) một số tuyến dùng `BigInt` trên tham số đường dẫn (`/products/:id`, `/products/:id/reviews`, `/orders/:id`) nên giá trị không phải số có thể gây lỗi 500 thay vì 400; (f) tuyến kiểm tra voucher thiếu tham số `code` trả 500 thay vì 400. Các điểm này chưa được tái hiện bằng kiểm thử trên hệ thống chạy.

## 4. Những điều đã đối chiếu và khớp với báo cáo

Để báo cáo không bị sửa thừa, các mục sau **đã khớp** với mã:

- Bảng A.3: `checkout`, `orders/me`, `payment-status` yêu cầu token khách, `customer_id` lấy từ token, `payment-status` trả 404 khi đơn không thuộc khách.
- Bảng A.4: `me/preferences` (GET, PUT, skip) và `wishlist` yêu cầu token; `track`, `recently-viewed`, `recommendations` nhận token tuỳ chọn; `trending` công khai.
- A.12.1: đăng nhập trả 401 khi sai mật khẩu và 400 khi tài khoản chỉ có Google.
- §5.1.2: đăng nhập Google xác thực ID token phía máy chủ, kiểm tra `audience` và `email_verified`.
- §7.4: câu "API danh sách sản phẩm chưa đặt trần tham số limit" đúng với `/api/b2c/products`.

## 5. Điều chưa xác nhận, cần nhóm tự kiểm

- **Số endpoint.** Báo cáo ghi 89. Nếu thêm `set-password` và `transcribe` vào bảng thì tổng sẽ tăng 2, nhưng nhóm cần tự đếm lại toàn bộ trước khi đổi. Tôi chưa đếm lại phần ai-rec và ai-bot.
- **Commit.** Báo cáo ghi commit `f2522c7`. Tôi chưa chạy `git rev-parse` nên chưa đối chiếu được mã đã đọc với commit này.
- **Hành vi thực tế.** Các nhận xét ở §3.2 và §2.3 suy ra từ đọc mã. Muốn đưa vào báo cáo như kết quả đo, cần chạy thử bằng `curl` rồi ghi lại kết quả.
