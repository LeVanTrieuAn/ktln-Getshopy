# Kịch Bản Kiểm Thử Chi Tiết - Module Authentication (Đăng Nhập/Đăng Ký)

Tài liệu này định nghĩa ít nhất 50 Test Cases tiêu chuẩn chuyên sâu dành riêng cho tính năng **Xác thực người dùng (Authentication)** trên cả 2 cổng B2C (Client) và B2B (Admin).

## A. Kiểm thử Giao diện & Form Validation (14 TCs)
| ID | Kịch bản kiểm thử (Test Scenario) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC_AUTH_01** | Bỏ trống Email & Password | Bấm nút Đăng nhập mà không nhập gì | Form báo lỗi: "Vui lòng nhập Email và Mật khẩu" |
| **TC_AUTH_02** | Chỉ bỏ trống Email | Nhập MK, bỏ trống Email, bấm Đăng nhập | Form focus vào Email, báo "Email không được để trống" |
| **TC_AUTH_03** | Chỉ bỏ trống Password | Nhập Email, bỏ trống MK, bấm Đăng nhập | Form focus vào MK, báo "Mật khẩu không được để trống" |
| **TC_AUTH_04** | Email sai định dạng (Thiếu `@`) | Nhập `nguyenvangmail.com` | Cảnh báo HTML5 / JS: "Email không hợp lệ" |
| **TC_AUTH_05** | Email sai định dạng (Thiếu domain) | Nhập `nguyenvan@` | Cảnh báo: "Email không hợp lệ" |
| **TC_AUTH_06** | Email sai định dạng (Thiếu TLD) | Nhập `nguyenvan@gmail` | Cảnh báo: "Email không hợp lệ" |
| **TC_AUTH_07** | Tự động xoá khoảng trắng (Trim) | Nhập `  nguyenvan@gmail.com  ` | Hệ thống tự động trim khoảng trắng và gửi đi hợp lệ |
| **TC_AUTH_08** | Email không phân biệt hoa/thường | Nhập `NguyenVan@Gmail.com` | Hệ thống tự chuyển lowercase và đăng nhập thành công |
| **TC_AUTH_09** | Mật khẩu quá ngắn | Nhập MK có 3 ký tự (vd: `123`) | Cảnh báo: "Mật khẩu phải có ít nhất 6 ký tự" |
| **TC_AUTH_10** | Mật khẩu quá dài (Chống Buffer Overflow)| Nhập MK > 255 ký tự | Cảnh báo độ dài vượt quá giới hạn hoặc cắt chuỗi hợp lý |
| **TC_AUTH_11** | Kiểm tra XSS trên trường Email | Nhập `<script>alert(1)</script>` | Form chặn ký tự đặc biệt hoặc backend escape data, không thực thi script |
| **TC_AUTH_12** | Kiểm tra SQL Injection | Nhập `' OR 1=1 --` vào Email | Prisma/ORM tự động parameterized query, trả về sai tài khoản |
| **TC_AUTH_13** | Tính năng Ẩn/Hiện mật khẩu | Click vào icon con mắt ở ô MK | Text chuyển từ dấu `*` sang ký tự thường và ngược lại |
| **TC_AUTH_14** | Nhấn phím Enter để Submit | Nhập đủ thông tin, nhấn phím `Enter` | Form tự động submit gọi API Đăng nhập |

## B. Luồng Xác thực Email/Mật khẩu Truyền thống (10 TCs)
| ID | Kịch bản kiểm thử (Test Scenario) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC_AUTH_15** | Đăng nhập thành công | Nhập đúng Email và MK tồn tại | Đăng nhập thành công, lưu Token, chuyển hướng về trang chủ |
| **TC_AUTH_16** | Sai mật khẩu (Lần 1) | Nhập đúng Email, sai MK | Báo lỗi: "Email hoặc mật khẩu không chính xác" (Không nói rõ sai cái nào) |
| **TC_AUTH_17** | Brute-force: Sai mật khẩu 5 lần | Nhập sai MK liên tục 5 lần | Hệ thống khoá IP/Account tạm thời hoặc hiển thị Captcha/Rate Limit |
| **TC_AUTH_18** | Đăng nhập tài khoản không tồn tại | Nhập Email chưa từng đăng ký | Báo lỗi: "Email hoặc mật khẩu không chính xác" |
| **TC_AUTH_19** | Đăng nhập tài khoản bị Khoá (Banned) | Dùng DB set `status = BANNED` cho user -> Login | Báo lỗi: "Tài khoản của bạn đã bị khoá" |
| **TC_AUTH_20** | Đăng nhập tài khoản bị Xoá | Dùng DB set `is_deleted = true` -> Login | Báo lỗi như tài khoản không tồn tại |
| **TC_AUTH_21** | Sai phân quyền (B2C vào B2B) | Lấy tài khoản KH (Role: USER) login vào trang Admin | Báo lỗi: "Bạn không có quyền truy cập hệ thống này" |
| **TC_AUTH_22** | Sai phân quyền (B2B vào B2C) | Lấy tài khoản Admin login vào mua hàng | Có thể được phép hoặc báo lỗi (Tuỳ logic business đã set) |
| **TC_AUTH_23** | Login Email với acc chỉ có Google | Acc tạo bằng Google, chưa set mật khẩu -> Login bằng Password | Báo lỗi "Vui lòng đăng nhập qua Google hoặc thiết lập mật khẩu" |
| **TC_AUTH_24** | Phân biệt khoảng trắng trong MK | MK là `abc 123` -> Login bằng `abc123` | Báo sai mật khẩu (Khoảng trắng trong mật khẩu là có ý nghĩa) |

## C. Luồng Xác thực Google OAuth2 (9 TCs)
| ID | Kịch bản kiểm thử (Test Scenario) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC_AUTH_25** | Chuyển hướng Google Consent | Bấm "Đăng nhập với Google" | Chuyển hướng sang `accounts.google.com` với đúng Client ID |
| **TC_AUTH_26** | User huỷ đăng nhập Google | Tại trang Google, tắt popup hoặc bấm Huỷ | Quay lại web, không báo lỗi sập, hiện popup "Đã huỷ đăng nhập" |
| **TC_AUTH_27** | Google Login (Lần đầu - New User) | Chọn 1 Gmail chưa từng có trong DB | DB tạo bản ghi User mới, provider = `google`. Login thành công |
| **TC_AUTH_28** | Google Login (User cũ) | Chọn Gmail đã đăng nhập hôm trước | Không tạo User mới, trả về Token của User cũ, login thành công |
| **TC_AUTH_29** | Google Login (Email đã đăng ký tay) | Gmail trùng với 1 acc đã tạo bằng Password trước đó | Tự động link (merge) provider Google vào account cũ. |
| **TC_AUTH_30** | Đổi tên trên Google | Đổi tên bên Gmail, sau đó login lại | DB cập nhật `full_name` mới nhất hoặc giữ nguyên (Tuỳ design) |
| **TC_AUTH_31** | Thu hồi quyền từ Google | Vào Google Security xoá App Getshopy -> Login lại | Google đòi cấp quyền (Consent) lại từ đầu. |
| **TC_AUTH_32** | Lỗi Network khi gọi Google API | F12 ngắt mạng lúc Google redirect về server | Server văng lỗi 500/Timeout xử lý mượt mà, không sập Node.js |
| **TC_AUTH_33** | Cố tình sửa Code `code` | Đổi tham số `?code=abc` trên URL callback | Server check Google trả về Invalid Grant, văng lỗi 401 |

## D. Phiên đăng nhập, JWT & Bảo mật (10 TCs)
| ID | Kịch bản kiểm thử (Test Scenario) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC_AUTH_34** | Truy cập không có Token | Xoá Token ở LocalStorage/Cookie -> Vào `/account` | Bị văng ra trang `/login` hoặc mở Modal Login |
| **TC_AUTH_35** | Truy cập với Token bị sửa | Sửa đổi 1 ký tự trong JWT -> Gọi API | Server check Signature thất bại -> 401 Unauthorized |
| **TC_AUTH_36** | Hết hạn Access Token | Sửa thời gian sống của Token = 1s, chờ 2s -> Gọi API | API trả về 401. Client dùng Refresh Token để xin lại Access Token |
| **TC_AUTH_37** | Cấp lại Token thành công | Client gửi Refresh Token lên `/refresh` | Nhận Access Token mới và thực hiện tiếp API đang dang dở |
| **TC_AUTH_38** | Hết hạn Refresh Token | Cả Access và Refresh đều hết hạn | Văng hẳn ra ngoài, bắt đăng nhập lại từ đầu |
| **TC_AUTH_39** | Đăng xuất (Logout) | Bấm nút Đăng xuất | Xoá Token khỏi Client, xoá Session Redis trên Server. Chuyển về Home |
| **TC_AUTH_40** | Dùng Token cũ sau Đăng xuất | Lấy JWT cũ bắn qua Postman sau khi đã Đăng xuất | API báo 401 do Token đã bị đưa vào Blacklist / Redis xoá mất |
| **TC_AUTH_41** | Concurrent Logins | Đăng nhập trên Chrome, sau đó đăng nhập trên Edge | Cả 2 đều dùng được (hoặc Chrome bị văng - tuỳ chính sách thiết lập) |
| **TC_AUTH_42** | Đổi mật khẩu thì văng thiết bị cũ | Đổi mật khẩu trên ĐT | Trình duyệt PC tự động bị đăng xuất (Do phiên/Token cũ bị huỷ) |
| **TC_AUTH_43** | XSS chiếm JWT | Nếu lưu Token ở LocalStorage -> Dùng js `localStorage.getItem` | Có thể lấy được. (Khuyến nghị lưu HTTPOnly Cookie nếu làm hệ thống ngân hàng) |

## E. Quản lý Mật Khẩu & Bổ sung thông tin (7 TCs)
| ID | Kịch bản kiểm thử (Test Scenario) | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected Result) |
| :--- | :--- | :--- | :--- |
| **TC_AUTH_44** | Thiết lập mật khẩu (Acc Google) | Từ trang Hồ sơ, bấm "Thiết lập mật khẩu", nhập hợp lệ | Cập nhật DB: `has_password = true`, mã hoá Bcrypt |
| **TC_AUTH_45** | Mật khẩu xác nhận không khớp | Nhập MK mới `123456`, Xác nhận `1234567` | Báo lỗi: "Hai mật khẩu không khớp" ngay trên giao diện |
| **TC_AUTH_46** | Đăng nhập lại sau thiết lập | Đăng xuất. Gõ Email Google và MK vừa tạo | Đăng nhập thành công mà không cần qua Google Auth |
| **TC_AUTH_47** | Đổi mật khẩu (Acc thường) | Nhập sai mật khẩu cũ | Báo lỗi: "Mật khẩu cũ không chính xác" |
| **TC_AUTH_48** | Đổi mật khẩu thành công | Nhập đúng MK cũ, MK mới hợp lệ | Đổi thành công, yêu cầu đăng nhập lại |
| **TC_AUTH_49** | Nút Liên kết Google bị ẩn | Acc đã link Google sẵn | Giao diện hiện "Đã liên kết Google" thay vì nút bấm |
| **TC_AUTH_50** | Click Liên kết Google (Khi chưa link)| Đăng nhập bằng tay, ấn "Liên kết Google" | Đi qua Google Auth, sau đó ghép `provider_id` vào tài khoản hiện tại |

---
**Ghi chú cho QA:** 
Đây là 50 kịch bản test riêng biệt **chỉ dành cho tính năng Authentication**. Bạn nên dùng công cụ **Postman** (để test mục C, D) kết hợp thao tác trực tiếp trên trình duyệt (để test mục A, B, E). 
Đối với TCs liên quan đến Database (như khoá tài khoản, tài khoản bị xoá), hãy mở DBeaver/DataGrip kết nối vào bảng `User` để thao tác dữ liệu.
