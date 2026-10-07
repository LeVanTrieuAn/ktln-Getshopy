# Kịch Bản Kiểm Thử Chuyên Sâu - Module Bán Chạy Nhất (Bestseller)

Tài liệu này cung cấp ma trận **100 Test Cases** chuyên biệt dành riêng cho tính năng/màn hình **Top Bán Chạy Nhất** (Bestseller). Đây là phân hệ kích thích nhu cầu mua sắm lớn nhất của người dùng, yêu cầu độ chính xác dữ liệu tuyệt đối (dựa trên trường `sold`).

---

## Nhóm 1: Điều hướng & Khởi tạo State (TC_BS_001 - TC_BS_020)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_BS_001 | Truy cập qua Sidebar Menu | Bấm nút "Bán chạy nhất" (Top thiết bị mua nhiều nhất) ở StoreLayout | URL cập nhật thành `/shop?sort=bestseller`. |
| TC_BS_002 | Component nhận diện URL | Xem React state khi vừa chuyển trang | `useEffect` đọc params `sort=bestseller`, set State `sort` thành `'best_selling'`. |
| TC_BS_003 | Khởi tạo qua URL trực tiếp | Nhập thẳng `http://localhost:3000/shop?sort=bestseller` vào thanh địa chỉ, ấn Enter. | Render chính xác màn hình Bestseller, không bị rớt về Newest. |
| TC_BS_004 | Khởi tạo qua Dropdown Sort | Ở trang cửa hàng bình thường, ấn vào thanh Dropdown "Sắp xếp" -> Chọn "Bán chạy nhất" | URL tự cập nhật, UI chuyển mode Bestseller lập tức. |
| TC_BS_005 | Lưu SessionStorage | Đang ở Bestseller, bấm vào một SP để xem chi tiết | SessionStorage ghi đè param `sort: 'best_selling'`. |
| TC_BS_006 | Phục hồi SessionStorage | Ấn nút Back của trình duyệt quay lại trang Bestseller | Vẫn giữ nguyên banner Top Bán Chạy Nhất. |
| TC_BS_007 | Xung đột Category | Bấm "Bán chạy nhất", sau đó ấn nút Danh mục "Điện thoại" | URL `?category=cat-phone&sort=bestseller`. Giao diện giữ nguyên cờ Bestseller. |
| TC_BS_008 | Bỏ Bestseller qua Dropdown | Chọn lại dropdown "Sắp xếp theo: Mới nhất" | Cờ `sort` đổi thành `newest`. Banner Hero Bestseller tự động biến mất. |
| TC_BS_009 | Bỏ Bestseller qua URL | F12 xoá chuỗi `sort=bestseller` trong Address bar rồi F5 | Trở về trang Danh sách SP mặc định. |
| TC_BS_010 - TC_BS_020 | Giao diện cơ bản | Trạng thái nút Sidebar (Phải Active màu đen/trắng nền); Text Dropdown sắp xếp (Hiện "Bán chạy nhất"); Focus outline; Responsive khi co URL bar trên Mobile. | Chuyển đổi trơn tru, không lag, không flash 2 lần UI. |

## Nhóm 2: UI Hero Banner Bestseller (TC_BS_021 - TC_BS_040)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_BS_021 | Kích hoạt Banner | `sort === 'best_selling'` | Vẽ ra nguyên một khối banner to (full width) nằm trên list sản phẩm. |
| TC_BS_022 | Nền Banner (Light Mode) | Ở chế độ sáng | Nền màu trắng `#ffffff`, viền xám nhạt `1px solid #e4e4e7`, bóng đổ nhẹ `rgba(0,0,0,0.08)`. |
| TC_BS_023 | Nền Banner (Dark Mode) | Chuyển sang Dark Theme | Đổi màu Gradient cực ngầu: `linear-gradient(135deg, #18181b 0%, #27272a 60%, #1c1917 100%)`, viền sáng bóng. |
| TC_BS_024 | Hoạ tiết trang trí Dark Mode | Bật Dark Theme | Banner render thêm 2 vòng tròn cách điệu `borderRadius: 50%` ở góc trên bên phải (`top: -60`, `right: -60`) tạo chiều sâu. |
| TC_BS_025 | Icon Chiếc Cúp (Trophy) | Góc trái banner | Hiển thị `<TrophyOutlined />` màu vàng cam `#f59e0b`. |
| TC_BS_026 | Khối nền của Cúp | Nhìn viền bao quanh cúp | Bo góc `borderRadius: 16`, có nền vàng trong suốt `rgba(251,191,36,0.1)`. |
| TC_BS_027 | Dòng Text Phụ (Sub-title) | Xem chữ phía trên tiêu đề | Dòng chữ "DỰA TRÊN DỮ LIỆU BÁN HÀNG THỰC TẾ" (chữ hoa toàn bộ do CSS, có icon mọc lên `<RiseOutlined />`). |
| TC_BS_028 | Text Tiêu Đề Chính | Xem chữ to nhất | Chữ "Top Bán Chạy Nhất" font to 22px, in đậm béo `fontWeight: 800`. |
| TC_BS_029 | Dòng Text Explain | Xem chữ dưới cùng | Có icon túi xách, và chữ "Xếp hạng theo trường `sold` giảm dần...". |
| TC_BS_030 | Responsive Banner | Co màn hình lại (Mobile) | Flex wrap làm cụm chữ rơi xuống hoặc co hẹp lại, Banner không bị trào ra lề hai bên do `boxSizing: 'border-box'`. |
| TC_BS_031 - TC_BS_040 | Pixel-perfect Checks | Test khoảng cách padding; Test Hover Banner (không hiệu ứng hover); Test sự cố Font chữ; Test z-index đè lên thanh Toolbar; Cân chỉnh Flex center. | Đúng tỉ lệ 24px 28px. Text không chệch cột. |

## Nhóm 3: Logic API & Độ Chính Xác Dữ Liệu (TC_BS_041 - TC_BS_060)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_BS_041 | Request API Payload | F5 trang, inspect tab Network | API `getProducts` bắn đi param `sort=best_selling`. |
| TC_BS_042 | Dữ liệu Sắp Xếp (DB Backend)| Xem mảng `products` trả về | Thằng đứng TOP 1 phải có số cột `sold` lớn nhất trong toàn DB. (VD: `sold` = 999). |
| TC_BS_043 | Đồng hạng (Tie-breaker) | Có 2 sản phẩm A và B cùng `sold` = 50 | Thuật toán SQL ở Backend phải phân giải ổn định (ví dụ: cùng `sold` thì ưu tiên xếp theo `created_at` mới hơn). UI vẽ ra A rồi tới B. |
| TC_BS_044 | Hiển thị Badge "Top item" | Trên thẻ sản phẩm | Bất kỳ sản phẩm nào có `sold > 40` sẽ hiện thẻ vàng "Top item" ở góc ảnh (Logic Component Card). |
| TC_BS_045 | Sản phẩm Zero Sales | Tới trang phân trang cuối cùng | Vẫn hiển thị các sản phẩm có `sold` = 0 (tồn tại nhưng chưa bán được), xếp chót bảng. |
| TC_BS_046 | Lọc Hàng Tồn (Inactive) | Dữ liệu `sold` cao nhưng kho đã ẩn `status=0` | Sản phẩm đó KHÔNG ĐƯỢC PHÉP xuất hiện trên trang Bán chạy nhất. |
| TC_BS_047 | Dữ liệu bán hàng ảo (Negative) | DB bị hack, cột `sold` = -5 | Nằm ở đáy cùng (nếu sql order desc). |
| TC_BS_048 | Data Type Overflow | Một sản phẩm bị bơm ảo `sold` = 1,000,000,000 | Vẫn lên Top 1, không sập hàm parse JSON. |
| TC_BS_049 | Thay đổi nhánh chi nhánh | Đổi từ CN Hồ Chí Minh sang Hà Nội | Gọi API mới với `branch_id`. List Bestseller của Hà Nội có thể khác HCM. |
| TC_BS_050 - TC_BS_060 | Stress Test & Thao túng API | Sửa thẳng Response body từ Network gán `sold` bằng chữ "Vô Cực"; Chặn API trả về Array rỗng `[]`; Chỉnh limit=24. | React không bể thẻ, báo Empty Data. Backend order đúng rule `ORDER BY sold DESC`. |

## Nhóm 4: Tương tác & Tổ Hợp Bộ Lọc Tích Hợp (TC_BS_061 - TC_BS_080)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_BS_061 | Bestseller + Tìm kiếm Hãng | Tick chọn hãng "Samsung" | Kết quả trả ra: "Top điện thoại Samsung bán chạy nhất". Banner vẫn giữ nguyên. |
| TC_BS_062 | Bestseller + Tìm theo Giá | Lọc giá từ `5,000,000` đến `10,000,000` | Kết quả: "Top sản phẩm tầm trung bán chạy nhất". |
| TC_BS_063 | Bestseller + Từ khoá (AI Search) | Gõ "Tai nghe chống ồn" | Kết quả: "Top tai nghe bán chạy nhất". Nếu k ra, AI gợi ý list semantic bù vào. |
| TC_BS_064 | Bestseller + Đổi Danh Mục | Bấm sang danh mục Phụ Kiện | URL cập nhật, kết quả đổ lại Top Phụ kiện bán chạy nhất. |
| TC_BS_065 | Xoá toàn bộ bộ lọc trong Bestseller | Bấm "Xoá tất cả" bên cột trái | Đưa về Bestseller của "ALL" toàn sàn. State của `sort` KHÔNG BỊ XOÁ, vẫn giữ `best_selling`. |
| TC_BS_066 | Lọc chéo 4 điều kiện | Bestseller + Apple + Tablet + Dưới 20 triệu. | Lọc ra iPad Gen 9 / Gen 10 theo thứ tự con nào bán nhiều hơn đứng trước. |
| TC_BS_067 | Lọc không có kết quả | Bestseller + Điện thoại Nokia + Giá trên 50 triệu | Báo "Không tìm thấy dữ liệu". |
| TC_BS_068 | Phân trang trong Bestseller | Cuộn xuống bấm Trang 2 | `offset = 24`. Lấy list sản phẩm bán chạy top 25 -> 48. |
| TC_BS_069 | Phân trang + Thay đổi Sort | Đang ở Trang 5 của Bestseller, bấm chọn Sort "Mới Nhất" | Mất banner Bestseller. Page BẮT BUỘC tự reset về `setCurrentPage(1)` để không bị lỗi "out of range". |
| TC_BS_070 - TC_BS_080 | Tương tác Component Card | Bấm Heart để thả tim ngay tại list; Bấm "Thêm giỏ hàng"; Click đi thẳng vào trang Chi tiết; Mix-blend-mode ảnh. | Toàn bộ tính năng UX Product Card đều chạy trơn tru, thừa hưởng sức mạnh cốt lõi. |

## Nhóm 5: Edge Cases, Performance & Tính Bất Thường (TC_BS_081 - TC_BS_100)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_BS_081 | Vượt giới hạn trang (Pagination Limit) | Gõ nhảy thẳng tới trang 99999 | Database xử lý Query Limit 24 Offset khổng lồ. Test xem MySQL có bị Full Table Scan gây treo máy không. (Nếu Timeout -> Lỗi Backend). |
| TC_BS_082 | Refresh nhiều lần liên tục | Nhấn F5 bằng búa 10 lần/giây | Browser cache state/ Cờ setLoading ngăn lặp request, Banner Bestseller không bị chớp nháy. |
| TC_BS_083 | Fallback ảnh trong list Bestseller | Top 1 Bán chạy lại là 1 sản phẩm bị xoá mất Link ảnh Cũ (`/assets/...`) | Thuật toán nhận dạng ảnh tĩnh AI chêm ngay ảnh Fallback đẹp vào. Không để thủng cái lỗ trên đỉnh vinh quang. |
| TC_BS_084 | Rò rỉ Skeleton | Đổi qua đổi lại liên tục Bestseller -> Newest -> Bestseller | Card Skeleton không bị rò rỉ bộ nhớ lặp vô tận. |
| TC_BS_085 | Giỏ hàng cạnh tranh | Top 1 Bán chạy chỉ còn `stock=1`. Mở 2 trình duyệt cùng ấn Add to Bag. | Backend Database Row-locking. 1 bên ăn, 1 bên báo rỗng. UI cập nhật. |
| TC_BS_086 - TC_BS_100 | Visual Defect (Lỗi thị giác) | Xoá toàn bộ CSS Font của máy khách; Nhập HTML Tags vào từ khoá Search; Mô phỏng đường truyền 3G cực chậm. | Vòng xoay Spin loading hiện trơn tru; XSS bị chặn bởi React; Icon Cúp vàng vẫn hiện đẹp đẽ không vỡ nét nhờ AntD vector SVG. |

---
**Tổng quan:** 100 test case cho riêng mục `Bestseller` khẳng định sự sắc bén của hệ thống trong việc tận dụng chung (Reusability) bộ lõi Component `ProductList` kết hợp tuỳ biến động linh hoạt (Dynamic Rendering) cho giao diện Hero Banner.
