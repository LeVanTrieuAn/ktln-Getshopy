# Kịch Bản Kiểm Thử (QA Test Plan) - Hệ Thống Getshopy

## Tổng Quan Kiến Trúc Hệ Thống
Hệ thống Getshopy được chia làm 3 phân hệ chính yếu (chạy trên các môi trường độc lập):

### 1. Phân hệ Web & Hệ thống quản lý (B2C & B2B Dashboard)
Đây là trái tim của hệ thống giao dịch, bao gồm Frontend React và Backend Node.js. Phần Frontend được chia làm 2 portal với tổng cộng **19 trang chính**:
*   **Web B2C (Dành cho Khách hàng - 8 trang):**
    *   `Home` (Trang chủ)
    *   `ProductList` (Danh mục & Tìm kiếm sản phẩm)
    *   `ProductDetail` (Chi tiết sản phẩm)
    *   `Compare` (So sánh sản phẩm)
    *   `Checkout` (Thanh toán & Đặt hàng)
    *   `Account` (Hồ sơ người dùng & Lịch sử đơn hàng)
    *   `Onboarding` (Khảo sát sở thích khách hàng mới)
    *   `About` (Giới thiệu cửa hàng)
*   **Web B2B Admin (Dành cho Quản trị viên/LakeHouse - 11 trang):**
    *   `Dashboard` (Tổng quan KPI thời gian thực)
    *   `GeneralManagement` (Quản lý Master data: Sản phẩm, User)
    *   `Reconciliation` (Đối soát tự động giao dịch thanh toán)
    *   `Financial` (Quản lý thu chi tài chính)
    *   `Fulfillment` (Kiểm soát giao vận & SLA)
    *   `BehaviorAnalytics` (Phân tích hành vi mua sắm từ Data Lake)
    *   `DataLakeDemo` (Truy vấn dữ liệu lớn)
    *   `Alerts` (Cảnh báo lỗi toàn hệ thống)
    *   `ChatbotManagement` (Gán nhãn NLP & MLOps)
    *   `Reviews` (Quản lý đánh giá)
    *   `Login` (Đăng nhập quản trị)

### 2. Phân hệ AI Recommendation (AI-Rec)
Được phát triển độc lập bằng Python & FastAPI.
*   **Chức năng:** Cung cấp hệ thống gợi ý lai (Hybrid) gồm Collaborative Filtering và Content-based.
*   **Đặc điểm:** Hoạt động độc lập, tự động lấy dữ liệu đã qua xử lý từ ClickHouse để huấn luyện định kỳ (`Background Training Loop`), không làm nghẽn luồng xử lý của web.

### 3. Phân hệ AI Chatbot & Smart Search (AI-Bot)
Được phát triển bằng Node.js chuyên biệt.
*   **Chức năng:** Tích hợp mô hình AI LLM tư vấn khách hàng, nhận diện ý định (Intent) và tìm kiếm bằng hình ảnh/văn bản thông minh.
*   **Đặc điểm:** Tương tác với hệ thống MLOps trên B2B để Admin gán nhãn câu hỏi lạ và tự động kích hoạt quá trình retraining lại mô hình NLP (qua Github Actions).

---
## Chi tiết Kịch bản Kiểm thử

Dưới đây là kịch bản kiểm thử chi tiết cho dự án Getshopy, tập trung vào các luồng nghiệp vụ phức tạp, các tiến trình ngầm (background jobs), cơ chế đồng bộ kho, xử lý thanh toán bất đồng bộ và các mô hình AI.

---

## 1. Module Thanh Toán & Quản Lý Đơn Hàng (Order & Payment Lifecycle)

Đây là module xương sống của hệ thống, đòi hỏi sự chính xác tuyệt đối về số liệu, tồn kho và trạng thái giao dịch.

### 1.1. Luồng Tạo Đơn Hàng (Checkout)
*   **Test Case 1.1.1: Tạo đơn thành công (Chuyển khoản)**
    *   **Action:** Khách hàng (đã đăng nhập) thêm sản phẩm vào giỏ, chọn tỉnh thành, áp voucher (nếu có), dùng điểm thưởng (nếu có), chọn Thanh toán chuyển khoản.
    *   **Expected:**
        *   Server tự tính lại tổng tiền từ Database (bỏ qua `total` client gửi lên).
        *   Tạo đơn hàng trạng thái `PENDING_PAYMENT`, sinh mã đối soát (ví dụ: `GS...`), sinh mã QR động chứa đúng mã đối soát và số tiền.
        *   Hệ thống khóa chỗ (reserve) số lượng tồn kho của các sản phẩm tương ứng. Không trừ thẳng vào `on_hand`.
        *   Voucher và điểm thưởng chuyển sang trạng thái `HELD`.
*   **Test Case 1.1.2: Chống Spam giữ chỗ kho (Advisory Lock)**
    *   **Action:** Đặt giới hạn `MAX_PENDING_ORDERS_PER_CUSTOMER=3`. Một khách hàng tạo liên tục 4 đơn hàng chuyển khoản mà chưa thanh toán.
    *   **Expected:** Đơn thứ 4 bị từ chối với lỗi `TOO_MANY_PENDING_ORDERS`. (Đảm bảo lock hoạt động khi test bằng cách call API đồng thời).
*   **Test Case 1.1.3: Cạnh tranh tồn kho (Concurrency Check-then-Act)**
    *   **Action:** Sản phẩm A còn đúng 1 tồn kho (`on_hand - reserved = 1`). Mở 2 terminal gọi API checkout mua sản phẩm A cùng một mili-giây.
    *   **Expected:** Chỉ 1 request thành công. Request còn lại văng lỗi `OUT_OF_STOCK` thay vì làm âm tồn kho.
*   **Test Case 1.1.4: Client sửa giá tiền (Security)**
    *   **Action:** Dùng DevTools (hoặc Postman) sửa `total` trong payload request thành 1000đ.
    *   **Expected:** API vẫn tính đúng giá DB. Trả về cảnh báo `price_mismatch` trong response (client: 1000, server: giá thật). Mã QR sinh ra đúng giá DB.

### 1.2. Luồng Webhook SePay (Ẩn)
*   **Test Case 1.2.1: Xác thực Webhook**
    *   **Action:** Gửi POST request giả mạo tới `/api/payment/webhook/sepay` không có HMAC/API Key hoặc chữ ký sai.
    *   **Expected:** Server trả 401. Log ghi nhận `auth-failed`.
*   **Test Case 1.2.2: Thanh toán khớp hoàn toàn (Happy Case)**
    *   **Action:** Bắn webhook SePay giả lập số tiền ĐÚNG với `total` đơn hàng, nội dung chứa đúng mã đối soát `GS...`.
    *   **Expected:**
        *   Đơn hàng chuyển `payment_status = PAID`, `status = CONFIRMED`.
        *   Tồn kho chuyển từ `reserved` sang trừ thẳng `on_hand` (commit).
        *   Voucher, điểm thưởng chuyển từ `HELD` sang `COMMITTED`. (Chưa được cộng điểm tích luỹ mới).
        *   Giao dịch lưu vào `PaymentTransaction` với `match_status = MATCHED`.
*   **Test Case 1.2.3: Idempotency (Trùng webhook)**
    *   **Action:** Bắn lại đúng payload của Test Case 1.2.2 (cùng `providerTxnId`).
    *   **Expected:** Server vẫn trả 200 (để SePay không retry) nhưng bỏ qua không xử lý lại, trả status `MATCHED`, báo `duplicate: true`. Đơn hàng không bị trừ kho 2 lần.
*   **Test Case 1.2.4: Khách chuyển dư / thiếu tiền**
    *   **Action:** Đơn hàng giá 100k, khách chuyển 10k (hoặc 110k) với đúng mã `GS...`.
    *   **Expected:** Đơn hàng giữ nguyên trạng thái `PENDING`. Giao dịch lưu vào `PaymentTransaction` với `match_status = REFUND_REQUIRED` (cần admin xử lý).
*   **Test Case 1.2.5: Tiền vào đúng đơn nhưng đơn đã hết hạn (Late Match)**
    *   **Action:** Chỉnh sửa DB cho đơn hàng hết hạn (quá `expires_at` nhưng khách vẫn chuyển tiền). Tồn kho vẫn còn đủ để bán.
    *   **Expected:** Giao dịch lưu `match_status = LATE_MATCHED`. Hệ thống giữ chỗ lại kho cho đơn và chuyển đơn thành `PAID` / `CONFIRMED`.
*   **Test Case 1.2.6: Chuyển khoản 2 lần cho 1 đơn (Tiền thừa)**
    *   **Action:** Đơn đã PAID. Khách ngớ ngẩn quét mã chuyển thêm 1 lần nữa (Tạo webhook với `providerTxnId` khác, nhưng cùng mã đối soát).
    *   **Expected:** Giao dịch mới lưu `match_status = DUPLICATE`. Cần hoàn tiền (Refund).

### 1.3. Luồng Đóng Đơn & Hủy Đơn (Ẩn / Khách hàng / Admin)
*   **Test Case 1.3.1: Scheduler dọn đơn quá hạn (Expire Job)**
    *   **Action:** Set `expires_at` của một đơn PENDING về ngày hôm qua. Đợi Scheduler chạy (mặc định 60s).
    *   **Expected:**
        *   Đơn chuyển sang `EXPIRED` / `CANCELLED`.
        *   Tồn kho đang giữ (`reserved`) được nhả ra (`releaseReservations`). Tồn khả dụng tăng lên.
        *   VoucherUsage và LoyaltyTransaction chuyển sang `RELEASED`, số lượt dùng voucher (`used_count`) và điểm của khách được hoàn lại.
*   **Test Case 1.3.2: Khách tự huỷ đơn**
    *   **Action:** Khách gọi `/b2c/orders/:id/cancel`. Đơn đang `PENDING_PAYMENT` hoặc COD `CONFIRMED`.
    *   **Expected:** Huỷ đơn thành công. Nếu COD đã trừ kho (`COMMITTED`), hàng được cộng lại `on_hand`. Voucher và điểm hoàn về tài khoản.
*   **Test Case 1.3.3: Lỗ hổng Tích Điểm -> Tiêu -> Hủy**
    *   **Action:** Đặt đơn COD giá trị lớn -> Trạng thái `CONFIRMED`. Kiểm tra điểm khách hàng. Dùng điểm đó mua đơn khác. Hủy đơn COD ban đầu.
    *   **Expected:** Đơn COD vừa tạo **KHÔNG ĐƯỢC TÍCH ĐIỂM NGAY**. Điểm chỉ tích khi Admin chuyển trạng thái sang `DELIVERED`. Do đó lỗ hổng này không thể khai thác.
*   **Test Case 1.3.4: Admin hoàn tiền (Refund)**
    *   **Action:** Vào B2B, tìm giao dịch `REFUND_REQUIRED`, gọi API `/b2b/payments/:id/refund` với số tiền hoàn.
    *   **Expected:** `match_status` chuyển thành `REFUNDED`. Đơn hàng nếu đang kẹt cũng được giải phóng. Trạng thái refund lưu vết người xử lý.

---

## 2. Mô Hình AI Recommendations & Behavior

Mô hình nâng cấp v4 sử dụng cả Content-based, Collaborative Filtering, Hành vi người dùng (Behavior) và cấu hình lai (Hybrid).

### 2.1. Luồng Lấy Gợi Ý (AI Recommendation)
*   **Test Case 2.1.1: Khách hàng mới (Cold-start - Không Behavior)**
    *   **Action:** Vào trang chủ ẩn danh (không login, không có history/session).
    *   **Expected:** AI Rec trả về fallback rules: Top bán chạy (Top sellers) + Sản phẩm mới nhất.
*   **Test Case 2.1.2: Khách hàng Onboarding (Explicit Preferences)**
    *   **Action:** Login B2C. Vào màn hình Onboarding chọn thích danh mục A, hãng B. Gọi `/api/b2c/recommendations`.
    *   **Expected:** Recommendation Profile sẽ ưu tiên hiển thị Danh mục A và Hãng B (User Preference Profile).
*   **Test Case 2.1.3: Conflict Preference Check**
    *   **Action:** Truyền payload onboarding vừa "thích" Hãng X, vừa "không thích" Hãng X.
    *   **Expected:** API `/me/preferences` trả 400 Bad Request chống dữ liệu rác vào model.
*   **Test Case 2.1.4: Recently Viewed / Cart Behavior (Implicit)**
    *   **Action:** Dùng user thật, click xem liên tục 5 sản phẩm của Hãng Samsung. Đợi một lúc để Kafka/Debezium/DBT đồng bộ sang Lakehouse (nếu real-time). Gọi API recommendations.
    *   **Expected:** Trả về ít nhất 2 sản phẩm "Recently Viewed" và các gợi ý "Similar users bought" (Collaborative Filtering) thông qua HTTP call tới AI Container `ai-rec`.
*   **Test Case 2.1.5: Flash Sale Overlay**
    *   **Action:** Tạo chương trình Flash Sale cho sản phẩm Y. Gọi API Recommend.
    *   **Expected:** Sản phẩm Y nếu nằm trong gợi ý phải bị ghi đè giá (`price`) bằng `discount_price` của Flash Sale.
*   **Test Case 2.1.6: Hybrid Recommendation (CF + CB + Repeat)**
    *   **Action:** Đăng nhập với User đã từng mua Sản phẩm Z cách đây vài tuần.
    *   **Expected:** Nếu `HYBRID_ALLOW_REPEAT = 1`, Sản phẩm Z có thể xuất hiện lại với label `REASON_REPEAT`. Điểm của Sản phẩm Z phụ thuộc vào half-life time decay.

### 2.2. Tiến Trình Huấn Luyện (Model Lifecycle)
*   **Test Case 2.2.1: Background Training Loop**
    *   **Action:** Theo dõi log của container `ai-rec`.
    *   **Expected:** Cứ mỗi `TRAIN_INTERVAL_SECONDS` (vd 300s), hệ thống query ClickHouse `serving.processed_data_for_AI_rec`, build ma trận mới. Không làm block API phục vụ, và swap phiên bản `ModelBundle` mượt mà qua phép gán atomic.
*   **Test Case 2.2.2: Precompute Caching**
    *   **Action:** Đợi model train xong. Xem logs.
    *   **Expected:** Hệ thống tự động tính sẵn gợi ý (`_precompute`) cho top users và cache vào dictionary. Khi gọi API `recommend_for_customer`, kết quả trả về tức thì từ cache, tránh nhân ma trận.
*   **Test Case 2.2.3: Graceful Degradation (ClickHouse sập)**
    *   **Action:** Tắt container ClickHouse. Đợi đến chu kỳ train tiếp theo của `ai-rec`.
    *   **Expected:** Log báo "Warehouse không sẵn sàng". Hệ thống giữ nguyên model đang phục vụ (không chết app). API Health báo lỗi nguồn cấp, nhưng vẫn `model_loaded = True`.

---

## 3. MLOps: AI Chatbot Admin (Phân tích NLP)

Luồng Chatbot để MLOps Pipeline huấn luyện lại Intent.

### 3.1. Phân loại & Gán nhãn (Data Annotation)
*   **Test Case 3.1.1: Xem log chat**
    *   **Action:** Dùng account Admin vào B2B. Gọi `/api/b2b/chat-logs`.
    *   **Expected:** Lấy ra danh sách chat. Các câu bot không hiểu (Intent: `UNKNOWN`) được đánh dấu đỏ.
*   **Test Case 3.1.2: Admin Gán nhãn (Annotate)**
    *   **Action:** Chọn một câu chat `UNKNOWN`. Gọi `/chat-logs/:id/annotate` sửa thành Intent `ASK_PRICE`.
    *   **Expected:** Record chuyển sang `is_annotated = true`, `corrected_intent = ASK_PRICE`.

### 3.2. Trigger Training Pipeline
*   **Test Case 3.2.1: Chặn trigger khi thiếu data**
    *   **Action:** Khi số câu `is_annotated: true, is_trained: false` < 10. Admin bấm nút "Train AI".
    *   **Expected:** API từ chối (400) "Cần ít nhất 10 câu". Tránh overfit và tốn resource.
*   **Test Case 3.2.2: Kích hoạt Github Actions (MLOps)**
    *   **Action:** Gán đủ 10 câu. Gọi `/api/b2b/trigger-ai-train`.
    *   **Expected:** Gửi request POST tới Github API Workflow Dispatch. Nếu thành công, toàn bộ 10 câu chuyển sang `is_trained = true`.

---

## 4. Hệ Thống Dashboard & BigData (B2B Admin)

### 4.1. Cache Analytics & Circuit Breaker
*   **Test Case 4.1.1: Cache & Invalidate**
    *   **Action:** Dashboard gọi `/api/dashboard/kpis`. API tạo 1 Simulated Sale. Gọi lại `/kpis`.
    *   **Expected:** Sau khi tạo sale, cache (Redis pattern `kpi:*`, `revHour:*`) bị xoá (`invalidateAnalyticsCache`). Lần gọi thứ 2 sẽ hit ClickHouse để có số liệu real-time.
*   **Test Case 4.1.2: Circuit Breaker quá tải**
    *   **Action:** Giả lập bắn tải cực lớn (hoặc tắt DB) làm ClickHouse phản hồi chậm > 5s liên tục.
    *   **Expected:** Circuit Breaker `chBreaker` (Opossum) mở. API trả lỗi 503 "Hệ thống dữ liệu đang quá tải". Không làm sập Node.js.
*   **Test Case 4.1.3: Data Lake Mock Pagination**
    *   **Action:** Gọi `/api/analytics/orders` (Test 1M records demo). Thử truyền `cursor`.
    *   **Expected:** Trả về mock data mô phỏng tốc độ phân trang có nextCursor.

### 4.2. Quản Trị Danh Mục & Phân Trang Lớn (Master Data)
*   **Test Case 4.2.1: Bảng Product tránh OOM (Out Of Memory)**
    *   **Action:** Giả lập chèn 600,000 products vào DB. Gọi `/api/b2b/products`.
    *   **Expected:** API bắt buộc phân trang `page`, `limit` (max 100), KHÔNG load toàn bộ mảng. Memory không bị spike dẫn đến sập tiến trình (Tiêu chuẩn kỹ thuật đã ghi chú).

---
## Lời khuyên khi QA:
1. **Kiểm tra Tunnel SePay:** Hãy chắc chắn `cloudflared tunnel` đang sống và khớp với URL khai báo trên dashboard SePay (Đọc file `AGENTS.md`).
2. **Kiểm tra Log:** Luồng thanh toán là bất đồng bộ và ẩn, hãy theo dõi cẩn thận console server (`[payment-webhook]`, `[expire-job]`, `[cancel-order]`) để nắm trạng thái.
3. **Đồng hồ Server vs Client:** Khi test thời gian giữ chỗ thanh toán, lưu ý thời gian hiển thị đếm ngược (Display TTL) sẽ **ngắn hơn** thời gian thực sự server giữ kho (Reservation TTL) nhằm bù trừ trễ ngân hàng. Mở Database kiểm tra `expires_at` để thấy rõ điều này.

---

# Phần 2: Hướng Dẫn Thực Hành Test Tay Bằng UI/Postman

Dưới đây là các bước thực hành chi tiết (dành cho người test tay):

## 1. Kiểm thử Hệ thống Quản lý Đơn hàng Toàn Diện (Order Management)

Luồng kiểm thử này đi từ phía khách hàng (Tạo tài khoản, mua sắm) đến phía Admin (Xử lý đơn, đối soát, giao vận).

### 1.1. Phía Khách Hàng (B2C Client)

**A. Trải nghiệm Điều hướng Sidebar & Giao diện chung**
*(Áp dụng cho tất cả các nút: Trang chủ, Cửa hàng, Sản phẩm, Trang, So sánh, Bán chạy, Tài khoản, Liên hệ, Về chúng tôi).*
*Xem trọn bộ **50 Test Cases tiêu chuẩn UI/UX** cho một nút bấm tại file [QA_TC_02_Sidebar_Navigation.md](./QA_TC_02_Sidebar_Navigation.md)*

**B. Đăng ký, Quản lý Hồ sơ & Đăng nhập (Authentication)**
*(Phần này yêu cầu test rất gắt gao. Xem trọn bộ **50 Test Cases** chuyên sâu tại file [QA_TC_01_Authentication.md](./QA_TC_01_Authentication.md))*
*   **Bước 1:** Click nút "Đăng nhập" ở Client. Thử luồng **Đăng nhập với Google**. -> Kết quả: Đăng nhập thành công, tự động cấp một tài khoản User.
*   **Bước 2:** Vào màn hình **Hồ sơ cá nhân**. Chọn chức năng **Thiết lập mật khẩu**. -> Kết quả: Lần sau có thể dùng Email vừa liên kết + Mật khẩu để đăng nhập trực tiếp (Local Auth).
*   **Bước 3:** Chuyển sang tab **Sổ địa chỉ**. Nhấn "Thêm địa chỉ mới", điền Tỉnh/Thành, check ô "Làm địa chỉ mặc định". -> Kết quả: Địa chỉ được lưu và đánh dấu sao vàng.

**C. Trải nghiệm Trang Chủ (Hero, 3D Models, AI Recommendation & Newest)**
*(Màn hình có khối lượng tương tác phức tạp nhất với luồng kết nối Data Science. Xem toàn bộ ma trận **300 Test Cases** siêu chi tiết tại file [QA_TC_04_Home.md](./QA_TC_04_Home.md))*
*   **Bước 1:** Test tải ảnh 3D `.fbx` (Khối Category) qua WebGL, kiểm tra logic ngắt GPU khi scroll khuất tầm nhìn.
*   **Bước 2:** Test hệ gợi ý AI "Dành riêng cho bạn" bám sát hồ sơ Onboarding. Test bộ lọc tĩnh `best_selling` khi AI rớt mạng.
*   **Bước 3:** Test hiệu ứng Thêm vào giỏ hàng (Visual Feedback 2 giây), Mix-Blend-Mode và Text Truncation của Component Sản phẩm.

**D. Trang Danh sách Sản phẩm (25,000 Trang Phân Trang & Bộ Lọc Tích Hợp)**
*(Màn hình chịu tải nặng nhất của hệ thống, đòi hỏi xử lý Session và State cực mạnh. Xem ma trận **300 Test Cases** siêu việt tại [QA_TC_05_ProductList.md](./QA_TC_05_ProductList.md))*
*   **Bước 1:** Test logic phân trang khối lượng cực lớn (Limit & Offset 600,000 dòng dữ liệu).
*   **Bước 2:** Test tổ hợp Đa bộ lọc (Danh mục mẹ con + Hãng + Tầm giá + Ký tự tìm kiếm AI).
*   **Bước 3:** Test khả năng lưu trữ trạng thái vào SessionStorage, bấm vào xem chi tiết SP rồi Back lại không bị mất vị trí và bộ lọc cũ. Cấu hình tự động thế Fallback Ảnh AI khi link ảnh DB bị chết.

**E. Chế Độ Top Bán Chạy Nhất (Bestseller Hero Mode)**
*(Tính năng đòn bẩy kích cầu mua sắm. Xem toàn bộ **100 Test Cases** chuyên biệt tại [QA_TC_06_Bestseller.md](./QA_TC_06_Bestseller.md))*
*   **Bước 1:** Test giao diện Hero Banner (Light/Dark mode) xuất hiện động khi param url đổi thành `?sort=bestseller`.
*   **Bước 2:** Test độ chính xác của Backend Database sắp xếp theo chuẩn cột `sold` giảm dần, xử lý các trường hợp đồng hạng.
*   **Bước 3:** Tổ hợp chéo: Lọc Hàng Bán chạy + Theo Hãng Apple + Theo mức giá -> Đảm bảo luồng Query logic không đụng độ.

**F. Chi Tiết Sản Phẩm & Trải Nghiệm Mua Sắm (Product Detail)**
*(Khu vực trọng điểm quyết định chuyển đổi đơn hàng. Đã hoàn thiện siêu ma trận **1200 Test Cases** vét cạn biến thể tại [QA_TC_07_ProductDetail.md](./QA_TC_07_ProductDetail.md))*
*   **Bước 1:** Test Bộ sinh thông số kỹ thuật (Spec Generator) tự động khớp với 49 ngành hàng.
*   **Bước 2:** Test luồng tương tác Variant (Phiên bản màu sắc/dung lượng) đồng bộ thời gian thực với Tồn Kho (Stock) và Giỏ Hàng.
*   **Bước 3:** Test Component Phân trang bình luận, Rate 5 Sao, Add To Cart, Mua Ngay và Tim Yêu Thích.

**G. Công Cụ So Sánh Thiết Bị (Device Compare)**
*(Tính năng giúp khách hàng ra quyết định kỹ thuật. Xem chi tiết **200 Test Cases** tại [QA_TC_08_Compare.md](./QA_TC_08_Compare.md))*
*   **Bước 1:** Test logic LocalStorage lưu trữ mảng so sánh tối đa n thiết bị, tự động điền 2 thiết bị vào cột khi vừa mở trang.
*   **Bước 2:** Test bộ thuật toán Alignment tự động gióng hàng ngang các thông số kỹ thuật giống nhau (ví dụ: Cùng là "Dung lượng pin").
*   **Bước 3:** Test logic Highlight tự động bôi đậm các điểm khác biệt giữa 2 thiết bị. Mua ngay trên bảng so sánh.

**H. Trang Hồ Sơ Cá Nhân & Quản Lý Đơn Hàng (Account / Order)**
*(Phân hệ hậu mãi và tích điểm thành viên. Đã hoàn thiện **500 Test Cases** vét cạn biến thể tại [QA_TC_09_Account.md](./QA_TC_09_Account.md))*
*   **Bước 1:** Test luồng khách vãng lai tra cứu đơn hàng bằng Email mà không cần tạo tài khoản.
*   **Bước 2:** Test thuật toán bóc tách trạng thái Thanh Toán (PAID/COD) độc lập với trạng thái Vận Chuyển (PENDING/SHIPPING). Huỷ đơn an toàn.
*   **Bước 3:** Test component Sổ Địa Chỉ kết hợp Bản đồ Tọa Độ Leaflet Map; Test thư viện html2pdf.js xuất File PDF hóa đơn động; Test hệ thống phân hạng Kim Cương/Vàng.

**I. Thanh Toán, Bản Đồ Giao Hàng & Thuật Toán Trừ Tiền (Checkout)**
*(Chốt chặn sinh tử quyết định doanh thu. Đã hoàn thiện **500 Test Cases** tại [QA_TC_10_Checkout.md](./QA_TC_10_Checkout.md))*
*   **Bước 1:** Test sự kiện Leaflet Map Click lấy tọa độ giao hàng chính xác tuyệt đối đổ vào form.
*   **Bước 2:** Test thuật toán trừ Voucher kết hợp trừ Điểm thưởng Thành viên; Tính phí vận chuyển tự động theo Tỉnh/Thành phố.
*   **Bước 3:** Test luồng Phương thức thanh toán (COD vs BANK_TRANSFER). Đóng băng Giỏ hàng không được xoá nếu khách chọn Quét mã QR mà lỡ tắt Popup ngang chừng.

**J. Hệ thống AI Chatbot & Smart Search (NLP & Computer Vision)**
*(Trái tim thông minh của hệ thống. Đã sinh **Siêu Ma Trận 10,000 Test Cases** khổng lồ tại [QA_TC_11_AIChatBot.md](./QA_TC_11_AIChatBot.md))*
*   **Bước 1:** Test Chatbot tư vấn: Gõ câu lệnh hỏi mua thiết bị dựa trên cấu hình (Pin trâu, chơi game, giá 10 triệu...).
*   **Bước 2:** Test Visual Search (Tìm bằng hình ảnh): Upload ảnh chụp thẳng vào cửa sổ Chatbot và cắt ảnh (Crop) trên thanh Toolbar.
*   **Bước 3:** Semantic Search & Fallback: Test gõ sai chính tả tồi tệ ("Laptopp", "Ai phôn"). Test truy vấn sản phẩm hết hàng (Out of stock) để Bot gợi ý sản phẩm thay thế.

**K. Kiểm Thử Hành Trình Xuyên Suốt (E2E User Journey)**
*(Mô phỏng 100 luồng khách hàng thực tế mượt mà từ đầu chí cuối tại [QA_TC_12_E2E_Journey.md](./QA_TC_12_E2E_Journey.md))*
*   **Bước 1:** Đăng ký mới -> Khảo sát Onboarding -> Hệ thống lưu hồ sơ cá nhân.
*   **Bước 2:** Đi dạo xem sản phẩm -> Thêm vào bảng So sánh -> Đẩy từ So sánh vào Giỏ hàng -> Checkout áp mã Voucher.
*   **Bước 3:** Quản lý đơn -> Xem bản đồ giao hàng -> Tải PDF -> Ấn nút "Hủy Đơn" -> Ấn nút "Mua Lại" tái tạo giỏ hàng.

**C. Khảo sát Sở thích Khách hàng (AI Onboarding Cold-start)**
*(Luồng thu thập dữ liệu quan trọng nhất cho hệ AI Recommendation. Xem toàn bộ ma trận **150 Test Cases** chuyên sâu tại file [QA_TC_03_Onboarding.md](./QA_TC_03_Onboarding.md))*
*   **Bước 1:** Khách vừa đăng nhập lần đầu tiên sẽ bị chuyển hướng ép vào màn hình `/onboarding`.
*   **Bước 2:** Khách chọn Sở thích (Thích Nhóm, Thích Hãng, Tầm giá) và Không Thích (Ghét Nhóm, Ghét Hãng).
*   **Bước 3:** Bấm Hoàn tất, quay về trang chủ. AI sẽ lập tức dùng dữ liệu này để cấu hình thuật toán gợi ý dải sản phẩm tương ứng.

**B. Giỏ hàng, Áp dụng Khuyến mãi & Checkout**
*   **Bước 1:** Thêm 2 sản phẩm bất kỳ vào giỏ hàng. Nhấn nút "Thanh toán".
*   **Bước 2:** Tại màn hình Checkout, kiểm tra hệ thống tự động tải Địa chỉ mặc định.
*   **Bước 3 (Test Voucher & Điểm):** Gõ một mã Voucher hợp lệ. Nếu có Điểm thưởng, nhập số điểm muốn dùng (Tối đa bằng số tiền đơn). 
*   **Kết quả kỳ vọng:** Số tiền `Giảm giá` và `Thành tiền` tự động nhảy số trừ đi chính xác. Nếu f12 sửa giá trị tiền thì khi Submit, Server vẫn tính lại từ DB.
*   **Bước 4 (Test Giữ kho):** Chọn "Chuyển khoản" và bấm "Đặt hàng".
*   **Kết quả kỳ vọng:** Ra mã QR SePay. Mở DB kiểm tra bảng `Inventory`: số `on_hand` giữ nguyên, số `reserved` tăng lên đúng bằng số lượng vừa mua.

**C. Quản lý Đơn hàng cá nhân & Tự Huỷ đơn**
*   **Bước 1:** Quay lại trang **Quản lý đơn hàng** của Khách. Tìm đơn vừa tạo (đang `Chờ thanh toán`).
*   **Bước 2:** Bấm nút **Huỷ đơn** màu đỏ.
*   **Kết quả kỳ vọng:** Đơn chuyển sang `Đã huỷ`. Mở DB: Tồn kho (`reserved`) được trả lại. Số lượt dùng Voucher được cộng lại. Điểm thưởng hoàn về tài khoản.

### 1.2. Phía Quản Trị Viên (B2B Admin & BigData)

**A. Quản lý Đơn hàng chung (General Management)**
*   **Bước 1:** Tạo một đơn hàng COD mới bên Client. Đăng nhập Admin bằng tài khoản Quản trị.
*   **Bước 2:** Vào menu **Quản lý Đơn hàng**, tìm đơn hàng COD vừa tạo. 
*   **Bước 3:** Cập nhật trạng thái sang `Đã đóng gói` rồi `Đang giao hàng`.
*   **Kết quả kỳ vọng:** Sang trình duyệt bên Client (B2C), thấy trạng thái nhảy tương ứng theo thời gian thực (qua WebSocket).

**B. Giao vận & Cam kết thời gian (Fulfillment SLA)**
*   **Bước 1:** Vào menu **Giao vận (Fulfillment)** bên giao diện Admin.
*   **Bước 2:** Hệ thống tự động tính khoảng thời gian từ lúc Khách đặt đến lúc Admin sinh Phiếu xuất kho.
*   **Kết quả kỳ vọng:** Nếu thời gian < 24h, cột SLA báo `ON_TIME`. Nếu quá 24h báo `BREACHED` (Vi phạm). Nếu đơn mới chưa xử lý báo `PENDING`. 

**C. Đối soát thanh toán (Reconciliation)**
*   **Bước 1:** Dành cho các đơn chuyển khoản. Vào menu **Đối soát thanh toán**.
*   **Bước 2:** Hệ thống sẽ tự động ghép Đơn hàng (Bảng SaleOrder) với Giao dịch Ngân hàng (Bảng InputVoucher) dựa vào mã đối soát.
*   **Kết quả kỳ vọng:**
    *   Đơn 1tr, chuyển đúng 1tr -> Hệ thống báo `MATCHED` (Khớp).
    *   Đơn 1tr, chuyển 1.1tr -> Hệ thống báo `MISMATCH` (Lệch). Admin có nút xử lý Hoàn tiền phần chênh lệch.

### 1.3. Test Bảo mật & Cạnh tranh kho (Hệ thống ngầm)

Mục tiêu: Đảm bảo khách hàng không lách luật được bằng Code/Tool.

**A. Bắt lỗi sửa tiền thanh toán**
*   **Bước 1:** Ở bước bấm nút Đặt Hàng, bật F12 chặn Request, sửa tham số `"total": 1000` rồi ép gửi đi.
*   **Kết quả kỳ vọng:** Mã QR hiện ra vẫn đòi số tiền thực tế (VD: 500,000đ). Backend Getshopy không tin tưởng dữ liệu tổng tiền từ Client.

**B. Giữ chỗ tồn kho cạnh tranh (Race Condition)**
*   **Bước 1:** Set tồn kho thực tế của 1 món hàng về 1 cái.
*   **Bước 2:** Dùng Postman bắn 2 Request mua món đó **cùng một mili-giây** (2 tài khoản khác nhau).
*   **Kết quả kỳ vọng:** Chỉ 1 Request ăn. Request còn lại bị văng lỗi `OUT_OF_STOCK`. Không bao giờ có chuyện kho báo âm `-1`.

**C. Khoá Spam tạo đơn rác**
*   **Bước 1:** Tạo liên tục 4 đơn hàng chọn Chuyển khoản ngân hàng (Nhưng không quét mã trả tiền).
*   **Kết quả kỳ vọng:** Đến đơn thứ 4, hệ thống chặn đứng với mã lỗi `TOO_MANY_PENDING_ORDERS`. Đảm bảo kho không bị 1 người chiếm dụng ảo.

---

## 2. Kiểm thử Webhook SePay (Test Ẩn)

Mục tiêu: Bắn Webhook giả lập tiền vào tài khoản để test hệ thống xử lý bất đồng bộ.
*   **Công cụ chuẩn bị:** Postman hoặc curl. Lấy mã đối soát của đơn hàng bạn vừa đặt thành công ở mục 1 (VD: `GS12345678`).

### 2.1. Thanh toán đúng và đủ
*   **Bước 1:** Mở Postman, chọn method `POST`, nhập URL của tunnel (`https://<tunnel-id>.trycloudflare.com/api/payment/webhook/sepay`).
*   **Bước 2:** Vào tab **Headers**, thêm Header bảo mật:
    *   `Authorization`: `Apikey <Mã SEPAY_WEBHOOK_API_KEY trong file .env của server>`
*   **Bước 3:** Vào tab **Body**, chọn raw `JSON`, dán payload sau (Sửa `GS...` và `transferAmount` đúng với đơn):
\`\`\`json
{
  "id": 99999,
  "gateway": "SePay",
  "transactionDate": "2026-10-07 10:00:00",
  "accountNumber": "123456789",
  "transferAmount": 500000,
  "transferType": "in",
  "content": "Nguyen Van A CK don GS12345678",
  "accumulated": 500000
}
\`\`\`
*   **Bước 4:** Bấm Send.
*   **Kết quả kỳ vọng:** Trả về HTTP 200 `{"success":true}`. Mở Database bảng `SaleOrder`, thấy trạng thái đơn hàng tự nhảy thành `CONFIRMED`, `payment_status` thành `PAID`. Bảng `Inventory` nhảy `on_hand` bị trừ đi.

### 2.2. Trùng giao dịch (Idempotency)
*   **Bước 1:** Ngay sau khi xong Bước 2.1, bạn giữ nguyên Postman và bấm Send lại payload trên một lần nữa (mọi id giao dịch giống hệt).
*   **Kết quả kỳ vọng:** API vẫn báo HTTP 200, nhưng DB không ghi đúp giao dịch, số lượng hàng hoá không bị trừ thêm. (Server nhận biết đây là giao dịch trùng).

### 2.3. Khách thanh toán thiếu tiền
*   **Bước 1:** Tạo 1 đơn hàng mới giá 1,000,000đ. Lấy mã đối soát `GS888888`.
*   **Bước 2:** Dùng Postman bắn payload tương tự, nhưng sửa `"transferAmount": 100000` (Khách chuyển thiếu). Đổi id giao dịch (VD: `id: 88888`).
*   **Kết quả kỳ vọng:** Đơn hàng vẫn giữ trạng thái `PENDING_PAYMENT` (Chưa đổi sang PAID). Bảng `PaymentTransaction` lưu lại dòng này với trạng thái `REFUND_REQUIRED` (Cần xử lý bù trừ).

---

## 3. Kiểm thử Job tự động Huỷ Đơn & Nhả Tồn Kho

Mục tiêu: Đơn hàng kẹt do không thanh toán phải được huỷ và trả lại hàng vào kho.
*   **Bước 1:** Tạo 1 đơn thanh toán chuyển khoản. Lưu lại số tồn kho hiện tại (VD: `on_hand: 10, reserved: 2`).
*   **Bước 2:** Mở DataGrip hoặc DBeaver, can thiệp vào bảng `SaleOrder`. Tìm đơn hàng vừa tạo, chỉnh sửa cột `expires_at` thành một giờ của **ngày hôm qua** (để ép đơn hết hạn). Commit thay đổi DB.
*   **Bước 3:** Chờ khoảng 60 giây (Khoảng thời gian Job `expireScheduler` tự chạy ngầm trên Server).
*   **Kết quả kỳ vọng:** F5 bảng `SaleOrder` -> trạng thái đổi từ `PENDING_PAYMENT` thành `CANCELLED`. F5 bảng `Inventory` -> Tồn kho được nhả lại (VD: `on_hand: 10, reserved: 0`). Nếu có dùng Voucher, F5 bảng VoucherUsage thấy được trả lại.

---

## 4. Kiểm thử AI Recommendation (Gợi ý)

Mục tiêu: Thử nghiệm xem AI có bắt hành vi thời gian thực không.
*   **Bước 1:** Tạo 1 user mới (hoặc dùng chế độ ẩn danh).
*   **Bước 2:** Tại trang `ProductList`, bấm vào xem chi tiết liên tục 4-5 sản phẩm của **chỉ một thương hiệu** (VD: Apple) hoặc **một danh mục** (VD: Điện thoại).
*   **Bước 3:** Trở về trang Chủ hoặc trang Sản phẩm chi tiết bất kỳ, xem mục **"Có thể bạn sẽ thích"** hoặc **"Gợi ý cho bạn"**.
*   **Kết quả kỳ vọng:** Trang sẽ tự động đổ ra thêm các sản phẩm Apple khác hoặc Điện thoại khác dựa trên lịch sử bạn vừa click (Real-time Behavior Track). (Lưu ý: ClickHouse/Kafka phải đang chạy để bắt log).

---

## 5. Kiểm thử MLOps Chatbot (Gán nhãn & Retrain)

Mục tiêu: Dạy AI học từ câu hỏi nó không hiểu.
*   **Bước 1:** Đăng nhập B2C, mở cửa sổ Chatbot.
*   **Bước 2:** Chat một câu tiếng lóng hoặc sai chính tả cực lạ mà AI không hiểu: `"shop ới, tui muốn coi quả táo cắn dở bao tiền"` (Apple iPhone).
*   **Bước 3:** AI trả lời không khớp hoặc Intent báo `UNKNOWN`.
*   **Bước 4:** Đăng nhập vào hệ thống Admin B2B. Vào menu **Chatbot Management** -> Mở tab **Chat Logs / Chưa phân loại**.
*   **Bước 5:** Tìm câu chat `"quả táo cắn dở"`, nhấn nút **Gán Nhãn (Annotate)**, chọn Intent đúng là `ASK_PRICE` và Entity tương ứng. Nhấn Lưu.
*   **Kết quả kỳ vọng:** Dữ liệu được gán nhãn lại thành công. Nếu bạn dán nhãn đủ 10 câu (tuỳ giới hạn config), nút **Train AI** sẽ sáng lên để bạn kích hoạt quy trình huấn luyện lại mô hình qua Github Actions.
