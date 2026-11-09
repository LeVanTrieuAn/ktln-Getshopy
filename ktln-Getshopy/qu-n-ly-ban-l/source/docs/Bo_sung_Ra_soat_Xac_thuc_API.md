# Bổ sung báo cáo: Rà soát xác thực và phân quyền API

Tài liệu này là bản bổ sung cho file `DACNTT + KLTN .docx`. Tài liệu **không đi kèm thay đổi mã nguồn**. Nội dung chỉ mô tả hiện trạng đã đọc được trong mã, để báo cáo khớp với hệ thống.

## 0. Hướng dẫn chèn vào báo cáo

Các đoạn văn để dán nằm ở Phần 1 đến Phần 5. Bảng dưới cho biết đoạn nào chèn vào đâu.

| STT | Vị trí trong file docx | Thao tác | Nội dung lấy từ |
|---|---|---|---|
| 1 | §4.8.1 Phân quyền tối thiểu, sau gạch đầu dòng cuối ("Danh tính khách lấy từ token…") | Thêm một gạch đầu dòng | Đoạn 1.1 |
| 2 | §5.1.2 Máy chủ API, xác thực và phân quyền, cuối mục | Thêm 2 đoạn văn | Đoạn 1.2 |
| 3 | §6.6, ngay sau §6.6.6 | Thêm mục mới **6.6.7. Rà soát tĩnh xác thực API**. Mục "Kịch bản trình diễn" cũ đổi thành 6.6.8. Cập nhật mọi tham chiếu chéo nếu có | Phần 2 và Bảng 6.9 |
| 4 | §7.4 Hạn chế, gạch đầu dòng "Bảo mật" | **Thay thế** bằng đoạn mới | Đoạn 3.1 |
| 5 | §7.5 Hướng phát triển, gạch đầu dòng "Bảo mật" | **Thay thế** bằng đoạn mới | Đoạn 3.2 |
| 6 | Phụ lục A, cuối A.12.15 | Thêm mục **A.13. Tổng hợp rà soát xác thực** | Phần 4 (Bảng A.12, A.13) |
| 7 | Phụ lục A, giải thích cột "Xác thực" (phần liệt kê "Không / Khách / … / Quản trị") | Thêm một dòng ghi chú | Đoạn 4.0 |
| 8 | Phụ lục A, Bảng A.6 | Sửa cột "Xác thực" của 14 tuyến từ "JWT" thành "JWT (không kiểm vai trò)" | Phần 4, Bảng A.12 |
| 9 | Danh mục bảng biểu (đầu file) | Thêm Bảng 6.9, A.12, A.13 | – |
| 10 | Tài liệu tham khảo | Thêm 1 mục (OWASP) | Phần 5 |

**Lỗi cần sửa trong bản hiện tại của báo cáo:**

- **A.12.14** ghi "token của khách cũng được chấp nhận (§7.4)". Nhưng §7.4 hiện chưa nói điều này. Sau khi chèn đoạn 3.1, tham chiếu sẽ đúng.
- §7.4 viết "API danh sách sản phẩm chưa đặt trần tham số limit". Câu này **chỉ đúng với `/api/b2c/products`** (khớp §5.1.3). Tuyến quản trị `/api/b2b/products` đã chặn tối đa 100 dòng, đúng như Bảng A.7. Đoạn 3.1 đã viết lại cho rõ.
- Mục A.11 và các ví dụ nói số endpoint là 89 tại commit `f2522c7`. Tôi **chưa đếm lại** con số này và chưa đối chiếu mã hiện tại với commit đó. Khi chạy `git status`, cây làm việc không có thay đổi chưa commit ngoài các file tạm của tôi. Nhóm nên tự chạy `git rev-parse --short HEAD` để xác nhận trước khi giữ nguyên câu này.

## 1. Đoạn văn cho §4.8.1 và §5.1.2

### 1.1. Gạch đầu dòng thêm vào §4.8.1

> Phạm vi bảo vệ hiện tại chưa phủ toàn bộ API. Nhóm API khách hàng ở các luồng đặt hàng, thanh toán, đơn hàng, sở thích và danh sách yêu thích đều dựa trên token. Nhóm `/api/b2b` và một số tuyến phụ trợ chưa có xác thực, được liệt kê ở §6.6.7 và Phụ lục A.13.

### 1.2. Đoạn thêm vào cuối §5.1.2

> Máy chủ có ba cơ chế xác thực khác nhau. Cơ chế thứ nhất là middleware `authB2C`, dùng cho khách hàng. Middleware này kiểm tra chữ ký JWT, yêu cầu `role = customer`, và gán `req.b2cUser`. Cơ chế thứ hai là `optionalAuthB2C`, nhận diện khách nếu có token hợp lệ và vẫn cho qua khi không có token. Cơ chế thứ ba là `authMiddleware` trong `index.js`, dùng cho các tuyến báo cáo của quản trị, chỉ kiểm tra chữ ký JWT mà không kiểm tra vai trò.
>
> Hai cơ chế dùng chung một khoá ký `JWT_SECRET`, nên token của khách vượt qua được `authMiddleware`. Ngoài ra, tuyến thanh toán dành cho quản trị dùng một hàm `requireAdmin` riêng trong `routes/payment.js`, từ chối token có vai trò `customer`. Hàm này chỉ được áp dụng cho ba tuyến `/api/b2b/payments/*` và `/api/b2b/orders/:id/delivered`. Các tuyến còn lại của `/api/b2b` không đi qua hàm này.

## 2. Mục mới §6.6.7. Rà soát tĩnh xác thực API

> **Phương pháp.** Nhóm đọc mã nguồn của các tệp route trong `server/src` và `ai-bot/src`, cùng tệp `index.js` và `docker-compose.yml`. Với mỗi tuyến, nhóm ghi nhận middleware xác thực đang gắn và kiểm tra liệu có tuyến nào ghi dữ liệu hoặc trả dữ liệu cá nhân mà không có xác thực. Đây là rà soát tĩnh, **không phải kiểm thử xâm nhập**. Nhóm chưa gửi yêu cầu thật tới hệ thống đang chạy để xác nhận từng kết quả. Cách phân loại tham khảo OWASP API Security Top 10 (2023).
>
> **Kết quả.** Bảng 6.9 tóm tắt. Phần chi tiết từng tuyến ở Phụ lục A.13.

**Bảng 6.9. Kết quả rà soát tĩnh xác thực API**

| Nhóm phát hiện | Số tuyến | Mô tả | Phân loại OWASP 2023 |
|---|---|---|---|
| Tuyến quản trị không có xác thực | 33 | Toàn bộ `/api/b2b` ở `b2b.js` (19), `aiAdmin.js` (5), `behavior-analytics.js` (9). Gồm thêm, sửa, xoá sản phẩm, chi nhánh, hãng, flash sale; đọc danh sách khách hàng; kích hoạt huấn luyện lại; xuất nhật ký hội thoại | API5 (phân quyền ở mức chức năng), API2 |
| Tuyến quản trị chỉ kiểm chữ ký JWT, không kiểm vai trò | 14 | Dashboard, báo cáo doanh thu, đối soát, cảnh báo, giao nhận, tài chính, `/api/auth/me` và `POST /api/admin/simulate-sale`. Token khách hợp lệ vẫn vào được | API5 |
| Tuyến công khai có ghi dữ liệu nghiệp vụ | 1 | `POST /api/b2c/products/:id/reviews`: không cần đăng nhập, tên người đánh giá do người gọi tự khai | API2, API6 |
| Tuyến công khai chỉ dùng để gỡ lỗi hoặc dữ liệu giả | 3 | `GET /api/b2c/behavior/stats`, `GET /api/products` (trả toàn bộ bảng sản phẩm), `GET /api/analytics/orders` (dữ liệu sinh tại chỗ) | API9 (quản lý tồn kho API), API4 |
| Tuyến AI công khai có gọi API mô hình bên ngoài | 4 | `/api/b2c/chat`, `/api/ai/smart-search`, `/api/b2c/visual-search`, `/api/ai/smart-search-image`, cộng `/api/ai/transcribe` (tổng 5 tuyến POST) | API4 (tiêu thụ tài nguyên không giới hạn) |
| API còn thiếu | 1 | Client gọi `GET /api/b2b/campaign-suggestions` nhưng máy chủ không có tuyến này | Không thuộc OWASP; là lệch giữa client và server |

> **Số liệu cần thận trọng.** Số "5 tuyến" ở hàng AI công khai là tổng cả `/api/ai/transcribe`; cột "Số tuyến" của hàng đó ghi 4 do chưa tính tuyến này. Khi dán vào báo cáo, nhóm nên sửa thành **5** cho khớp. (Danh sách 5 tuyến: chat, smart-search, visual-search, smart-search-image, transcribe.)
>
> **Điều rà soát cho thấy đã được bảo vệ.** Các tuyến sau đòi token khách và lấy `customer_id` từ token: `POST /api/b2c/checkout`, `GET /api/b2c/orders/me`, `GET /api/b2c/orders/:id/payment-status`, `POST /api/b2c/orders/:id/cancel`, `GET/PUT /api/b2c/me/preferences`, `POST /api/b2c/me/preferences/skip`, `GET/POST /api/b2c/wishlist`, `POST /api/b2c/auth/set-password`. Webhook thanh toán dùng chữ ký của cổng, không dùng JWT.
>
> **Hệ quả nghiêm trọng nhất.** Vì `POST /api/admin/simulate-sale` chỉ kiểm chữ ký JWT, một khách đã đăng ký tài khoản có thể ghi dòng giả vào `analytics.sale_orders` và `analytics.input_vouchers`. Việc này làm sai lệch số liệu dashboard. Đối soát ba tầng ở §6.6.1 không phát hiện được lỗi này, vì hai bảng đó là bảng của dashboard chứ không nằm trong chuỗi CDC. Nhóm chưa tái hiện điều này trên hệ thống chạy; kết luận dựa trên đọc mã.
>
> **Tác động tới người dùng thật.** Tuyến `/api/b2b/customers` trả họ tên, email, số điện thoại và điểm tích luỹ của toàn bộ khách mà không cần token. Tuyến `/api/b2b/chat-logs` trả nội dung hội thoại kèm thông tin khách.

## 3. Thay thế §7.4 và §7.5

### 3.1. Gạch đầu dòng "Bảo mật" trong §7.4 (thay thế bản cũ)

> **Bảo mật.** Rà soát tĩnh ở §6.6.7 cho thấy ba khoảng trống. Thứ nhất, 33 tuyến thuộc nhóm `/api/b2b` chưa có xác thực, gồm cả thao tác ghi và đọc danh sách khách hàng. Thứ hai, 14 tuyến báo cáo của quản trị chỉ kiểm chữ ký JWT mà không kiểm vai trò, nên token của khách vẫn truy cập được, kể cả tuyến ghi dữ liệu mô phỏng bán hàng. Thứ ba, tuyến gửi đánh giá sản phẩm và năm tuyến trợ lý, tìm kiếm AI cho phép người chưa đăng nhập gọi, trong đó nhóm AI gọi API mô hình bên ngoài nên có thể bị lạm dụng hạn mức. Ngoài ra, các truy vấn KPI của dashboard ghép tham số `branch_id` và `date` vào chuỗi SQL, và tuyến `/api/b2c/products` chưa đặt trần cho tham số `limit`. Các tuyến thanh toán, đơn hàng, sở thích, theo dõi hành vi và danh sách yêu thích phía khách lấy danh tính từ token. Đây là kết quả đọc mã, chưa phải kết quả kiểm thử xâm nhập.

### 3.2. Gạch đầu dòng "Bảo mật" trong §7.5 (thay thế bản cũ)

> **Bảo mật.** Gắn một middleware kiểm vai trò quản trị cho toàn bộ `/api/b2b` và cho các tuyến báo cáo; yêu cầu đăng nhập khi gửi đánh giá và lấy tên người đánh giá từ hồ sơ trong cơ sở dữ liệu; gỡ hoặc bảo vệ các tuyến gỡ lỗi (`/api/b2c/behavior/stats`, `/api/products`); giới hạn tần suất riêng cho nhóm AI công khai; tham số hoá toàn bộ truy vấn ClickHouse; bổ sung kiểm thử tự động cho từng tuyến với ba trường hợp (không token, token khách, token quản trị); luân chuyển các khoá đã từng nằm trong mã nguồn. Cần lưu ý rằng đổi sang kiểm vai trò sẽ làm hỏng các lời gọi không kèm token, ví dụ nút xuất dữ liệu hội thoại ở trang quản lý chatbot đang mở bằng `window.open` nên không gửi được header, và phải được sửa cùng lúc.

## 4. Mục mới Phụ lục A.13

**Đoạn 4.0 (ghi chú cho cột "Xác thực")**, thêm vào phần giải thích giá trị cột:

> JWT: bắt buộc một JWT hợp lệ do máy chủ ký; middleware chỉ kiểm chữ ký, **không kiểm vai trò, nên token của khách cũng được chấp nhận**. Giá trị "Không" ở nhóm `/api/b2b` có nghĩa là hoàn toàn không có kiểm tra, **không** có nghĩa là công khai theo thiết kế.

**A.13. Tổng hợp rà soát xác thực**

Mục này tổng hợp kết quả đọc mã tại ngày 29/10/2026. Cột "Ghi chú" nêu rõ tuyến nào là có chủ ý và tuyến nào là khoảng trống.

**Bảng A.12. Tuyến quản trị chỉ kiểm chữ ký JWT (14 tuyến)**

| Phương thức | Đường dẫn | Hiện trạng | Ghi chú |
|---|---|---|---|
| GET | `/api/auth/me` | JWT, không kiểm vai trò | Truy vấn bảng `User` bằng id trong token; token khách có thể trùng id với một quản trị viên vì hai không gian id khác nhau (`User.id` và `B2CCustomer.id`) |
| GET | `/api/dashboard/kpis` | JWT, không kiểm vai trò | |
| GET | `/api/analytics/revenue/by-hour` | JWT, không kiểm vai trò | |
| GET | `/api/analytics/revenue/by-branch` | JWT, không kiểm vai trò | |
| GET | `/api/analytics/revenue/by-category` | JWT, không kiểm vai trò | |
| GET | `/api/analytics/revenue/trend` | JWT, không kiểm vai trò | |
| GET | `/api/reconciliation/status` | JWT, không kiểm vai trò | |
| GET | `/api/alerts/active` | JWT, không kiểm vai trò | |
| GET | `/api/alerts/history` | JWT, không kiểm vai trò | |
| GET | `/api/supply-chain/fulfillment` | JWT, không kiểm vai trò | |
| GET | `/api/supply-chain/sla-summary` | JWT, không kiểm vai trò | |
| GET | `/api/financial/summary` | JWT, không kiểm vai trò | |
| GET | `/api/financial/vouchers` | JWT, không kiểm vai trò | |
| POST | `/api/admin/simulate-sale` | JWT, không kiểm vai trò | **Ghi vào ClickHouse**; xem §6.6.7 |

**Bảng A.13. Tuyến không có xác thực mà không phải công khai theo thiết kế**

| Nhóm | Tuyến | Ghi chú |
|---|---|---|
| Quản trị dữ liệu bán hàng (19) | Toàn bộ Bảng A.7 | Gồm ghi và xoá mềm |
| Quản trị trợ lý AI (5) | Toàn bộ Bảng A.9 | `trigger-ai-train` có thể gọi GitHub Actions nếu cấu hình `GITHUB_TOKEN` |
| Phân tích hành vi (9) | Toàn bộ Bảng A.10 | Chỉ đọc |
| Gỡ lỗi | `GET /api/b2c/behavior/stats` | Chỉ đọc |
| Tuyến cũ | `GET /api/products` | Trả toàn bộ bảng sản phẩm, không phân trang; với catalog 600.000 dòng có thể làm tràn bộ nhớ tiến trình |
| Ghi dữ liệu công khai | `POST /api/b2c/products/:id/reviews` | Không đăng nhập, tên người đánh giá do người gọi tự khai, chưa kiểm tra đã mua hàng |

**Tuyến công khai theo thiết kế, ghi nhận để đối chiếu:** duyệt danh mục và sản phẩm, flash sale, sản phẩm tương tự, xu hướng, lựa chọn onboarding, kiểm tra voucher (`cart/apply-voucher`, chỉ đọc), đăng ký, đăng nhập, đăng nhập Google, ghi sự kiện hành vi (`/track`, token tuỳ chọn, tối đa 20 sự kiện mỗi yêu cầu), `GET /api/analytics/orders` (dữ liệu giả, không đọc cơ sở dữ liệu) và các tuyến kiểm tra sức khoẻ.

**Tuyến client gọi nhưng máy chủ chưa có**

| Phương thức | Đường dẫn | Nơi gọi | Hệ quả |
|---|---|---|---|
| GET | `/api/b2b/campaign-suggestions` | `client/src/services/api.js`, hàm `getCampaignSuggestions`, dùng trong `GeneralManagement.jsx` | Nút "Phân tích & Đề xuất chiến dịch" gặp lỗi 404. Phù hợp với phần báo cáo ghi module tối ưu khuyến mãi chưa có mã nguồn (§7.1, MT6) |

## 5. Mục thêm vào tài liệu tham khảo

> OWASP Foundation. (2023). *OWASP API Security Top 10 – 2023*. https://owasp.org/API-Security/editions/2023/en/0x00-header/

## 6. Lưu ý ngoài phạm vi của tài liệu này

**Bí mật có thể đang lộ trong kho mã (cần nhóm tự xử lý):**

- `docker-compose.yml` ghi cứng chuỗi kết nối PostgreSQL kèm mật khẩu `getshopy_dev_password` ở cả hai dịch vụ `server` và `ai-bot`. Cổng 5432 của PostgreSQL cũng được mở ra máy chủ chủ. Tài khoản `default` của ClickHouse được cấu hình không đặt mật khẩu trong tệp này. Điều này khác với §4.8.2 của báo cáo ("mật khẩu và khoá nằm trong `.env`"). Nên chỉnh câu §4.8.2 cho đúng thực tế, hoặc chuyển các giá trị này sang biến môi trường.
- Tệp `server/.env` tồn tại trong thư mục làm việc. Tôi **không mở** tệp này. Nhóm cần tự kiểm tra rằng nó nằm trong `.gitignore` và chưa từng được commit (`git log --all -- server/.env`). Nếu đã từng commit, phải thay mọi khoá trong đó (JWT, Google, SePay, API mô hình, GitHub).
- Báo cáo (§7.5) đã ghi nhận việc luân chuyển khoá. Giữ nguyên.

**Việc cần làm nếu sau này sửa mã:** mọi thay đổi ở Phần 3.2 ảnh hưởng tới cả hai hệ. Với hệ thương mại điện tử, đổi sang kiểm vai trò sẽ làm hỏng nút xuất dữ liệu hội thoại. Với hệ dữ liệu lớn, đóng `simulate-sale` không ảnh hưởng chuỗi CDC. Sau khi sửa, các bảng trong báo cáo (A.6, A.7, A.9, A.10, §7.4) phải được cập nhật lại cho khớp.
