# Hướng Dẫn Test API GetShopy Bằng cURL / Postman

Đây là tổng hợp các lệnh cURL được soạn sẵn dành riêng cho các API lõi của hệ thống, bao gồm luồng Khách hàng (B2C) và luồng thanh toán (SePay Webhook). Bạn có thể copy các lệnh này dán thẳng vào Terminal, hoặc dùng tính năng **Import -> Raw Text** trong **Postman** để biến chúng thành Collection nhanh chóng.

⚠️ **LƯU Ý QUAN TRỌNG VỀ CỔNG (PORT)**:
Do hệ thống chạy bằng Docker Compose, Backend (8080) không mở port trực tiếp ra Windows. Mọi API phải đi qua Nginx Proxy ở cổng **3000**. Tất cả URL bên dưới đã được chỉnh định tuyến đúng chuẩn `http://localhost:3000/api/...`.

---

## 1. Xác thực (Authentication)

*Đăng nhập để lấy `token` cho các API yêu cầu Auth (Checkout, User Profile).*

```bash
curl --location 'http://localhost:3000/api/b2c/auth/login' \
--header 'Content-Type: application/json' \
--data '{
    "email": "user@example.com",
    "password": "password123"
}'
```

*Lưu ý: Copy giá trị `token` trả về để gắn vào Header `Authorization: Bearer <TOKEN>` cho các Request bên dưới.*

---

## 2. Lấy Danh Sách Sản Phẩm (Product List)

*Kiểm tra danh sách sản phẩm hiển thị trên trang Cửa Hàng (Shop).*

```bash
curl --location 'http://localhost:3000/api/b2c/products?page=1&limit=10&sort=newest' \
--header 'Accept: application/json'
```

---

## 3. Lên Đơn Hàng (Checkout)

*Tạo đơn hàng mới (Order) và sinh mã QR thanh toán. (Yêu cầu Token)*

```bash
curl --location 'http://localhost:3000/api/b2c/checkout' \
--header 'Authorization: Bearer <NHAP_TOKEN_CUA_BAN_VAO_DAY>' \
--header 'Content-Type: application/json' \
--data '{
    "items": [
        {
            "id": 599994,
            "variant_id": "v1",
            "quantity": 1,
            "price": 1469000
        }
    ],
    "customer_info": {
        "fullName": "Nguyen Van A",
        "phone": "0901234567",
        "email": "nguyenvana@gmail.com",
        "province": "HCM",
        "address": "123 Đường B, Quận 1",
        "note": "Giao hàng giờ hành chính"
    },
    "payment_method": "transfer",
    "subTotal": 25990000,
    "shippingFee": 30000,
    "discount": 0,
    "total": 26020000
}'
```

*Hệ thống sẽ trả về `order.id` (ví dụ `ord_abc123`) và `paymentRef` (mã đối soát ví dụ `DH_1234`). Dùng mã đối soát này cho bước Webhook bên dưới.*

---

## 4. Bắn Webhook Thanh Toán (SePay)

*Giả lập việc Ngân hàng trả biến động số dư về hệ thống SePay, và SePay bắn Webhook gọi vào Backend GetShopy. Việc này sẽ kích hoạt đổi trạng thái đơn hàng sang "Đã Thanh Toán".*

**Cấu hình bắt buộc:**

- `provider`: `sepay`
- Header `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>` (Lấy từ file `.env` của server, biến `SEPAY_WEBHOOK_API_KEY`).
- Trong `content`: Phải chứa mã đối soát `paymentRef` được sinh ra từ bước Checkout.

```bash
curl --location 'http://localhost:3000/api/payment/webhook/sepay' \
--header 'Authorization: Apikey <NHAP_API_KEY_TU_ENV>' \
--header 'Content-Type: application/json' \
--data '{
    "gateway": "MBBank",
    "transactionDate": "2026-10-08 12:00:00",
    "accountNumber": "123456789",
    "subAccount": null,
    "transferType": "in",
    "transferAmount": 26020000,
    "accumulated": 50000000,
    "id": "REF_SEPAY_9999",
    "referenceCode": "FT261008123456",
    "content": "DH_1234 THANH TOAN DON HANG",
    "description": "DH_1234 THANH TOAN DON HANG"
}'
```

---

## 5. Trợ lý ảo AI Chatbot

*Gửi tin nhắn cho AI Bot để được tư vấn (không cần token).*

```bash
curl --location 'http://localhost:3000/api/b2c/chat' \
--header 'Content-Type: application/json' \
--data '{
    "message": "Tư vấn cho tôi điện thoại Samsung tầm 15 triệu chụp ảnh đẹp",
    "history": []
}'
```

---

## 6. Tìm kiếm thông minh (Smart Search AI)

*Tìm kiếm bằng ngôn ngữ tự nhiên, AI sẽ bóc tách Intent để lọc sản phẩm.*

```bash
curl --location 'http://localhost:3000/api/ai/smart-search' \
--header 'Content-Type: application/json' \
--data '{
    "query": "điện thoại pin trâu dưới 10 triệu"
}'
```

---

## 7. Tìm kiếm bằng Hình ảnh (Visual Search)

*Tìm kiếm sản phẩm bằng cách gửi ảnh (Base64).*

```bash
curl --location 'http://localhost:3000/api/b2c/visual-search' \
--header 'Content-Type: application/json' \
--data '{
    "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}'
```

---

## 8. Quản lý Orders (Dành cho Admin)

*Kiểm tra hiện tại hệ thống (Database thật) đang có tổng cộng bao nhiêu đơn hàng.*

**Bước 1: Đăng nhập quyền Admin để lấy Token**

```bash
curl --location 'http://localhost:3000/api/auth/login' \
--header 'Content-Type: application/json' \
--data '{
    "email": "admin@getshopy.com",
    "password": "password"
}'
```

**Bước 2: Gọi API Đếm số lượng Đơn Hàng**

```bash
curl --location 'http://localhost:3000/api/b2b/orders/count' \
--header 'Authorization: Bearer <NHAP_TOKEN_ADMIN_CUA_BAN_VAO_DAY>'
```

**Bước 3: Gọi API Đếm số lượng Users**

```bash
curl --location 'http://localhost:3000/api/b2b/users/count' \
--header 'Authorization: Bearer <NHAP_TOKEN_ADMIN_CUA_BAN_VAO_DAY>'
```

---

## 9. Test phân trang dữ liệu khổng lồ (Dành cho Admin Frontend)

*API Get Danh sách sản phẩm của Admin, dùng để kiểm tra việc load danh mục hơn 600.000 sản phẩm không bị sập (Nhờ cơ chế Pagination).*

```bash
curl --location 'http://localhost:3000/api/b2b/products?page=1&limit=50' \
--header 'Authorization: Bearer <NHAP_TOKEN_ADMIN_CUA_BAN_VAO_DAY>'
```

*Kết quả sẽ trả về mảng `data` chứa 50 sản phẩm đầu tiên và biến `total` hiển thị tổng số hàng trăm nghìn sản phẩm hiện có.*

---

## 10. AI Recommendation (Gợi ý Cá nhân hóa)

*Hệ thống AI sẽ gợi ý sản phẩm dựa trên hành vi mua hàng và lịch sử tương tác của người dùng. Bắt buộc truyền Token của Customer (B2C) vào Header để định danh người dùng. Nếu không có Token, hệ thống sẽ rớt về (fallback) gợi ý sản phẩm chung chung.*

```bash
curl --location 'http://localhost:3000/api/b2c/recommendations' \
--header 'Authorization: Bearer <NHAP_TOKEN_CUA_BAN_VAO_DAY>'
```

*Kết quả trả về danh sách các sản phẩm (products) được xếp hạng theo mô hình AI cá nhân hóa của riêng user đó.*

---

### Mẹo: Import vào Postman nhanh

1. Mở Postman.
2. Nhấn nút **Import** (hoặc `Ctrl/Cmd + O`).
3. Chọn tab **Raw text**.
4. Paste toàn bộ dòng lệnh cURL phía trên vào.
5. Nhấn **Continue** và **Import**. Postman sẽ tự động biến chuỗi cURL thành Request cực kỳ chuẩn chỉ!
