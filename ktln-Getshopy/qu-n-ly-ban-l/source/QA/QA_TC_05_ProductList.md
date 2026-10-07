# Kịch Bản Kiểm Thử Chuyên Sâu - Module Danh Sách Sản Phẩm (Product List)

Tài liệu này định nghĩa siêu ma trận **300 Test Cases** vét cạn toàn bộ luồng hiển thị danh sách sản phẩm, đặc biệt tập trung vào **Khả năng phân trang khối lượng lớn (25,000 trang)**, **Bộ lọc đa luồng**, **SessionStorage** và **Fallback Ảnh AI**.

---

## Nhóm 1: Routing, Query Params & Trạng thái SessionStorage (TC_PL_001 - TC_PL_030)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_001 | Nhận diện Category rỗng | Truy cập thẳng `/shop` | Hệ thống lấy mặc định `categoryFilter = 'ALL'`. |
| TC_PL_002 | Nhận diện Category Param | Truy cập `/shop?category=cat-laptop` | Component đọc param, render SP Laptop, sáng nút Pill Laptop. |
| TC_PL_003 | Nhận diện Search Param | Truy cập `/shop?search=iphone` | Component đọc param `search`, gọi API lọc Tên SP chứa "iphone". |
| TC_PL_004 | Lưu SessionStorage | Ở trang `/shop`, chuyển sang trang 2, lọc Giá 5tr, sau đó bấm vào xem chi tiết 1 SP. | React gọi `saveFilterState()` lưu cục object vào SessionStorage trình duyệt trước khi Navigate. |
| TC_PL_005 | Phục hồi State (Back lại) | Đang xem chi tiết SP, ấn nút Back trình duyệt về lại `/shop` | State (Trang 2, giá 5tr) được khôi phục, khách không bị bực mình vì mất mốc đang lướt dở. |
| TC_PL_006 | Chống rò rỉ State | Xem chi tiết, nhưng thoát ra Trang chủ, rồi mới vào lại `/shop` | Khớp URL param không giống State lưu -> Khởi tạo lại trắng trơn. |
| TC_PL_007 | Xoá rác SessionStorage | Vừa khôi phục State xong ở lần Load đầu tiên | Dòng code `sessionStorage.removeItem('productListFilters')` chạy ngầm xoá rác. |
| TC_PL_008 | Đổi Category Reset Search | Đang search "Dell", bấm chọn danh mục "Điện thoại" | Ô Search bị xoá về rỗng, đảm bảo logic không bị khoá cứng 2 bên. |
| TC_PL_009 | Bấm nút Xoá Bộ Lọc | Bấm nút "Bỏ chọn tất cả" | `setMinPrice(0)`, `maxPrice(100M)`, xoá mảng Brands, Page quay về 1. |
| TC_PL_010 | Trigger FilterKey | Bấm "Áp dụng" ở bộ lọc Giá 2 lần liên tiếp cùng số tiền | Biến `filterKey` tăng làm `useEffect` luôn gọi lại API ép Server cấp lại data. |
| TC_PL_011 | Nút Back History API | Bấm nút Filter Giá, đổi Page 3 -> Bấm Back trình duyệt | Lùi lại Page 2, State đồng bộ chính xác. |
| TC_PL_012 | URL Injection | Sửa Param URL `?category=xxx` (ID ảo) | API trả về mảng rỗng `[]`, không bị crash App. |
| TC_PL_013 | Giữ Category Param | F5 tải lại trang `/shop?category=cat-tablet` | Data Tablet giữ nguyên, không load nhầm hàng ALL. |
| TC_PL_014 - TC_PL_030 | Thử nghiệm Session State Edge Cases | Tắt trình duyệt mở lại có giữ state không (SessionStorage khác LocalStorage -> Mất state); Mở tab mới copy link sang có giữ state không (Không giữ); Mở tab Private (Ẩn danh) có bị lỗi cấp phát Memory SessionStorage không (Pass). Thử gõ trực tiếp Session bằng tay vào F12 Console. | Bộ lọc chạy chính xác, luồng chuyển đổi mượt mà. Không bị Loop Render do `useEffect` dependency chuẩn. |

## Nhóm 2: Bộ lọc Danh Mục - Pill Tabs & Popover (TC_PL_031 - TC_PL_060)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_031 | Sticky Tab Bar | Cuộn dọc trang | Thanh ngang chứa nút "Tất cả" & "Danh mục" được neo cố định (Sticky) trên đầu trang với kính mờ. |
| TC_PL_032 | Pill Active State | Đang xem Tất cả | Nút "Tất cả" có nền Inverted (Đen/Trắng), chữ Inverted. |
| TC_PL_033 | Mở Popover Danh Mục | Hover vào nút có icon 4 ô vuông "Danh mục" | Khối Popover to chứa Grid danh mục trổ xuống (`trigger="hover"`). |
| TC_PL_034 | Overlay Popover | Rê chuột ra khỏi khối Popover | Khối đóng lại. |
| TC_PL_035 | Render Grid Danh Mục | Mở Popover | Liệt kê đủ tất cả Danh mục Cha thành các khối card viền. |
| TC_PL_036 | Category Icon Map | Kiểm tra Icon của "Laptop" | Dùng đúng component `<LaptopOutlined />` từ `CAT_ICON_MAP`. |
| TC_PL_037 | Category Icon Map (Ngoại lệ) | Danh mục DB tên lạ "Máy cày" chưa có map | Load icon fallback `<InboxOutlined />`. |
| TC_PL_038 | Click Danh Mục Cha | Bấm vào khung to chứa icon "Laptop" | Đóng Popover, Navigate tới `?category=cat-laptop`. |
| TC_PL_039 | Click Danh Mục Con | Bấm vào nút bo tròn (Pill) "Bàn phím" bên dưới khối Laptop | Navigate tới `?category=cat-keyboard`. Khối Cha không bị trigger click lan (stopPropagation). |
| TC_PL_040 | Hierarchy Data Rendering| Xử lý mảng `categories` bốc từ API | Component đệ quy gộp đúng các Category có `parent_id` tương ứng vào mảng `children`. |
| TC_PL_041 | Category Popover Search | Trong Popover, gõ thanh Input: "Chuột" | Lọc ra ngay danh mục con Chuột và giữ lại khối Cha Laptop bao bọc bên ngoài. |
| TC_PL_042 | Chống ngập DOM | API trả 100 danh mục | Khối Popover có `maxHeight: '60vh'` và thanh cuộn dọc (ScrollY), không chọc thủng đáy màn hình. |
| TC_PL_043 | Giao diện Dark Mode Popover | Đổi Dark Mode | Popover nền `#0f172a`, viền sáng `rgba(255,255,255,0.1)`. |
| TC_PL_044 - TC_PL_060 | Click liên hoàn | Mở popover gõ loạn phím; bấm phím Tab điều hướng; Chạm trên mobile (Hover biến thành Tap mở Popover); Click ra ngoài tắt. | UI/UX phải đạt mức ngang ngửa các sàn Ecom lớn, không giật cục. |

## Nhóm 3: Bộ lọc Thương hiệu (Brand Filter Sidebar) (TC_PL_061 - TC_PL_090)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_061 | Load danh sách Hãng | Cột Sidebar trái | Đổ đủ các Hãng từ API (Apple, Samsung, Asus...). |
| TC_PL_062 | Toggle 1 Hãng | Check ô "Apple" | Biến state mảng `brands` nhận ID `["br-apple"]`, gọi API tải lại SP. |
| TC_PL_063 | Bỏ Toggle 1 Hãng | Uncheck ô "Apple" | Biến state cắt bỏ ID. API chạy lại tải toàn bộ. |
| TC_PL_064 | Toggle Đa Hãng | Check "Apple", "Samsung", "Xiaomi" | Array nhận 3 ID. SP trả về thuộc 1 trong 3 hãng này (Toán tử IN). |
| TC_PL_065 | Reset Page khi lọc | Đang lướt ở Page 50, bấm tick hãng Dell | `setCurrentPage(1)`. Chống lỗi "Page 50 của list lọc không tồn tại". |
| TC_PL_066 | Search Hãng trong Sidebar | Có khoảng 200 hãng, gõ chữ "Lenovo" vào Input "Tìm thương hiệu" | Khối Checkbox xổ xuống chỉ còn chữ "Lenovo". |
| TC_PL_067 | Không có Hãng khớp | Gõ "Hãng Rác" | Hiện dòng chữ Empty ở góc dưới. |
| TC_PL_068 | Giữ tick Hãng khi search | Tick "Dell", sau đó Search "Apple" tick tiếp | Array giữ cả 2 ID, không bị mất Dell chỉ vì Dell đang bị filter ẩn đi. |
| TC_PL_069 | Limit Render Hãng | Có 1000 hãng | (Nếu có logic) Có nút "Xem thêm", hoặc cuộn dọc mượt. |
| TC_PL_070 | Hãng theo Danh Mục | Sidebar Hãng có đồng bộ Danh Mục đang chọn? | API nên đổ Hãng dựa trên biến `activeCategories` để không gợi ý hãng Nệm Kymdan khi lướt Laptop. |
| TC_PL_071 - TC_PL_090 | Checkbox AntD Event | Tắt/Mở checkbox chớp nhoáng; Xoá chữ trong ô Search hãng; Click thẳng vào tên Hãng thay vì cái ô vuông bé xíu (Label linked to Input). | Đảm bảo thao tác nhanh gọn lẹ, UX cho ngón tay chạm cảm ứng. |

## Nhóm 4: Bộ lọc Giá & Thanh tìm kiếm chính (TC_PL_091 - TC_PL_120)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_091 | Ô Input Giá (Từ/Đến) | Nhập "5000000" vào ô Min | Input tự động format số (nếu dùng `InputNumber` AntD) hoặc giữ nguyên. State `minPrice` nhận số. |
| TC_PL_092 | Range Slider kéo | Kéo thanh trượt Slider ở giữa | Kéo 2 đầu chốt, ô số thay đổi tương ứng. |
| TC_PL_093 | Giá Min lớn hơn Max | Nhập Min = 10tr, Max = 5tr | Khi blur hoặc bấm "Áp dụng", code sẽ báo lỗi hoặc tự động đảo ngược vị trí (Swap) 2 số. |
| TC_PL_094 | Nút Áp Dụng Giá | Bấm Nút "Áp dụng" | `appliedMinPrice` được gán, `currentPage=1`, API bắn param tiền. |
| TC_PL_095 | Nhập giá âm | Nhập `-1000` | InputNumber tự chặn lại mức 0. |
| TC_PL_096 | Nhập chữ vào ô giá | Nhập "abc" | InputNumber bỏ qua, không ăn chữ. |
| TC_PL_097 | Nút Reset Bộ lọc | Góc có nút "Xoá tất cả" | Ô giá biến về 0 -> max, mảng hãng về rỗng. API bung xoã hết giới hạn. |
| TC_PL_098 | Search Header Input | Gõ chữ "Macbook" vào ô Search chính | API nối param `?search=macbook`. |
| TC_PL_099 | Tương tác AI Smart Search | Search ra 0 kết quả SP thường | Khối code AI kích hoạt `api.ai.smartSearch(searchQuery)`, trả về SP semantic, hiển thị text "Kết quả gợi ý từ AI". |
| TC_PL_100 | Logic chớp loading AI | Test Loading | Khi AI đang nghĩ, chữ `isAiLoading=true` hiện thanh loading báo hiệu AI đang tìm. |
| TC_PL_101 - TC_PL_120 | Edge Cases Cực đoan | Giá Max = 100 Tỷ đồng (Data type Overflow trong Backend); Lọc giá 0 -> 0; Dán mã script `XSS` vào ô search; Lọc theo mức giá của sản phẩm đang sale. | Bắt buộc Backend phải truy vấn cột `price` (giá sau sale) thay vì `original_price` để khớp với con số Khách nhìn thấy. |

## Nhóm 5: Thử tải Phân Trang 25,000 Trang (TC_PL_121 - TC_PL_150)
*Mục tiêu:* Đánh giá sự sống còn của Hệ thống khi tải khối lượng >600,000 sản phẩm.
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_121 | Giao diện AntD Pagination | DB bơm 600,000 SP. Limit=24/trang | Component `<Pagination total={600000} pageSize={24} />` vẽ ra `25,000` trang. |
| TC_PL_122 | Click Trang Cuối Cùng | Bấm thẳng nhảy tới trang 25000 | Frontend tính OFFSET = `(25000-1) * 24` = `599,976`. API SQL `LIMIT 24 OFFSET 599976`. DB không được chết timeout (Cần Cache hoặc Index ID). |
| TC_PL_123 | Bấm Next (Tiếp theo) | Đang ở trang 1, bấm `>` | Current Page thành 2. Tải SP 25-48. |
| TC_PL_124 | Bấm Previous | Đang ở trang 2, bấm `<` | Về trang 1. |
| TC_PL_125 | Trạng thái Disabled | Đang ở trang 1 | Nút Previous `<` bị mờ (disabled), không bấm lùi về trang 0 được. |
| TC_PL_126 | Quick Jumper (Nhảy trang nhanh) | AntD có ô "Go to page X", gõ `1500` -> Enter | `setCurrentPage(1500)`. Tải ra chính xác nhóm SP đó. |
| TC_PL_127 | Nhập số trang > Total | Gõ vào ô jumper số `99999` | Component Pagination tự động bẻ về trang Max là `25000`. |
| TC_PL_128 | Layout Phân trang Mobile | Co màn hình điện thoại dọc | Thanh số trang tự thu gọn (chỉ hiện mũi tên và số hiện tại `Page 2 / 25000`) không đẩy vỡ layout màn hình. |
| TC_PL_129 | Trượt scroll lên đỉnh | Bấm chuyển trang | React tự động bắt lệnh `window.scrollTo(0,0)` cuộn màn hình lên nóc để xem hàng mới thay vì kẹt ở cuối chân trang. |
| TC_PL_130 | State Total Products | Theo dõi dòng chữ "Tìm thấy XYZ sản phẩm" | Nếu DB trả `totalProducts = 600000`, Format ra chữ `600.000`. |
| TC_PL_131 - TC_PL_150 | Các biến thể Database | API trả `total` = 0 (Ẩn cả thanh phân trang); DB lỗi trả `total` kiểu String `"20"`; Thử bấm qua lại trang 1-2-1-2 với tốc độ 10 lần/giây. | Trạng thái `setLoading(true)` có bóng mờ Spin đè lên danh sách cũ, tránh Khách bấm nhầm thêm SP trang cũ vào Giỏ hàng lúc Loading. |

## Nhóm 6: Tổ Hợp Lọc Chéo & Sắp Xếp (Sort) (TC_PL_151 - TC_PL_180)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_151 | Sort Dropdown (Sắp xếp) | Chọn "Bán chạy nhất" (best_selling) | Biến `sort` đổi. API gán `order_by=sold`. Trả về iPhone 15 Promax đầu tiên. |
| TC_PL_152 | Sort Mới nhất | Chọn "newest" | API gán `order_by=created_at DESC`. Ra hàng vừa nhập DB. |
| TC_PL_153 | Sort Giá Tăng/Giảm | Chọn "price_asc" / "price_desc" | Sắp xếp theo cột Giá tiền tệ. |
| TC_PL_154 | Giữ Sort khi chuyển trang | Sort "Giá giảm dần" -> Bấm qua Page 2 | Page 2 VẪN PHẢI LÀ giá giảm dần (Các SP thấp hơn Page 1). |
| TC_PL_155 | URL Search Param Sync | Bấm Sort = bestseller | Nhìn thanh Address Bar có gắn `?sort=bestseller` không (Logic: nếu có, khi copy gửi bạn bè họ sẽ thấy y hệt). |
| TC_PL_156 | Tổ hợp: Hãng + Giá | Tick Apple + Kéo giá 20tr - 30tr | Chỉ ra iPhone 13/14, không ra iPhone 15 Pro Max (35tr). |
| TC_PL_157 | Tổ hợp: Hãng + Giá + Danh mục | Apple + 20tr-30tr + Danh mục Laptop | Không ra iPhone, chỉ ra Macbook đời cũ vừa khung giá. |
| TC_PL_158 | Tổ hợp: Search + Sort | Tìm "Airpod" + Sort Giá tăng dần | Ra Airpod fake 50k đầu tiên, sau đó đến Airpod 2, Airpod Pro. |
| TC_PL_159 | Logic "Hoặc" của Hãng | Tick Apple VÀ Samsung | Trả ra kết quả của CẢ HAI hãng (Apple OR Samsung), array không bị mâu thuẫn triệt tiêu nhau. |
| TC_PL_160 | Cạnh tranh API | Vừa bấm Giá, tay nhấp liền nút Hãng | Request Promise Race Condition. Chặn việc kết quả cũ đè lên kết quả mới (Tuỳ thuộc kiến trúc CancelToken hoặc biến cờ ignore). |
| TC_PL_161 - TC_PL_180 | UX/UI Layout Sắp xếp | Layout dạng "Danh sách" thay vì "Lưới"; Trạng thái Sidebar ẩn/hiện bằng nút Hamburger để tạo không gian rộng lướt đồ; Animation thay đổi dữ liệu mượt, không chớp gắt. | Hoàn hảo. |

## Nhóm 7: Component Card SP, Thêm Giỏ Hàng & Mua Ngay (TC_PL_181 - TC_PL_210)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_181 | Render Thẻ SP | Trực quan 1 thẻ SP | Cấu trúc: Icon Yêu thích (Tim), Nhãn Giảm giá/Top Item (Góc trái), Ảnh bự ở giữa, Tên Danh mục (Mờ), Tên SP (2 dòng), Giá Tiền + Nút Add. |
| TC_PL_182 | Label Discount | Original Price = 20tr, Price = 15tr | Công thức tính % giảm: `((20-15)/20) * 100` = `25%`. Hiện Badge Đỏ `-25%`. |
| TC_PL_183 | Label Top Item | DB có cột `sold` > 40 hoặc cờ `is_featured = true` | Xuất hiện Badge Vàng `Top item`. Bị Badge Đỏ đè/hoặc xuất hiện thế chỗ. |
| TC_PL_184 | Text Truncation Tên SP | SP tên "Apple Macbook Pro M3 Max 16-core CPU 40-core GPU 48GB 1TB" dài loằng ngoằng. | Cắt cụt bằng `...` ở cuối dòng thứ 2 (WebkitLineClamp: 2). Card không lồi lõm rách nát. |
| TC_PL_185 | Quick Add to Cart Button | Nút Giá tròn góc phải dưới thẻ SP | Hover đổi nền Đen/Trắng ngược theme. |
| TC_PL_186 | Click Add to Cart | Bấm nút đó | Component chặn sự kiện (`e.stopPropagation()`). Lệnh `addToCart(product, 1, false)` gọi thẳng vào Context. |
| TC_PL_187 | Visual Feedback Cart | Sau khi bấm | Nút đổi nền Xanh Lục `#10b981`, đổi icon Thành Dấu Tick `✓`, chữ "Đã thêm" thay thế Giá tiền. Kéo dài 1.8 giây rồi nhả lại bình thường. |
| TC_PL_188 | Thêm nhiều SP cùng lúc | Bấm đúp liên tiếp 2 SP khác nhau | Biến state lưu độc lập (Bản mới dùng biến useState riêng trên từng Component Card). Mọi thứ đều xanh. |
| TC_PL_189 | Tim Yêu Thích | Bấm Nút Tim chưa Login | Hiện Modal Popup Đăng nhập chèn ngang. |
| TC_PL_190 | Bấm Tim có Login | Bấm Tim góc phải | Tim chuyển sang Màu Đỏ `<HeartFilled />`. Message AntD thả bong bóng: "Đã thêm vào danh sách yêu thích". |
| TC_PL_191 - TC_PL_210 | Toàn vẹn CSS Card | Đổi Theme tối, Box-shadow hover hiện bóng đen dày hơn `rgba(0,0,0,0.5)`; Image scale 1.06 nhưng `overflow: hidden` của Box mẹ ôm gọn; Card Height đạt độ cao tiêu chuẩn (h=100%). | Thẻ SP nằm sát lề, đều đặn tăm tắp, không bị rỗng ở cột cuối. |

## Nhóm 8: Fallback Ảnh Dựa Theo Logic AI (TC_PL_211 - TC_PL_240)
*Đây là bộ tính năng cực kỳ đắt giá - Xử lý Dữ liệu Rác trong Hệ thống lớn:*
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_211 | Nhận diện Ảnh chết (Null) | Server gửi cột `image` = null | Gọi hàm `getSafeImageUrl(url, categoryId)`. |
| TC_PL_212 | Nhận diện Path Cũ | `url = "/assets/speaker.jpg"` (Cấu trúc rác hệ thống cũ) | Hàm từ chối (Do không bắt đầu bằng HTTP), đá sang Fallback. |
| TC_PL_213 | Fallback Category: Điện Thoại | `category_id = "cat-phone"` | Load ảnh Unsplash cái Điện Thoại. |
| TC_PL_214 | Fallback Category: Laptop | `category_id = "cat-laptop"` | Load ảnh Unsplash Laptop. |
| TC_PL_215 | Fallback Thuật Toán Nhận Diện | Danh mục không tồn tại ID (`null`), nhưng Tên SP có chữ "earphone" | (Hàm `getFallback` soi chữ earphone) -> Cấp ảnh Unsplash Audio (Tai nghe/Loa). Trí tuệ mềm. |
| TC_PL_216 | Fallback Default | Khớp rỗng toàn bộ | Cấp phát ảnh Laptop Unsplash mặc định. |
| TC_PL_217 | Lỗi HTTP (404/403 Ảnh) | Server gửi HTTP URL nhưng File ảnh chết (404 Not found). Ảnh không render được bị rách viền. | Thuộc tính `onError` trên thẻ `<img>` của React kích hoạt. Vứt hình chết đi, thay ngay cái Fallback vào. |
| TC_PL_218 | Vòng Lặp Vô Tận (Infinite Loop Error) | Ảnh Fallback Unsplash CŨNG BỊ CHẾT (Lỗi Github, Unsplash chặn tải) | Sự kiện `onError` gọi lệnh `e.target.onerror = null` -> Huỷ diệt đệ quy. Bỏ trống khoảng ảnh rỗng (Alt text) thay vì bắn 1 tỷ Request gây sập máy. |
| TC_PL_219 | Image Scale | Màn hình cực bự | Ảnh Fallback Unsplash (400x400) kéo giãn ra không bị vỡ hạt do có `objectFit: 'contain'`. |
| TC_PL_220 - TC_PL_240 | Chế độ Mix-Blend-Mode | Nền thẻ màu Xám nhạt (`#f5f5f7`). Ảnh sản phẩm thật nền Màu Trắng tinh (JPEG). | Khách hàng văng tục vì viền trắng lồi ra cực gắt. Dùng thuộc tính CSS Webkit `mix-blend-mode: multiply` (Theme Light), màu trắng của ảnh tự bốc hơi, sản phẩm tan chảy ôm sát vào nền Xám nhạt. Khách hàng WOW! Đạt tiêu chuẩn Production. |

## Nhóm 9 & 10: Xử lý State Loading & Dark Mode Hoàn Mỹ (TC_PL_241 - TC_PL_300)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PL_241 | Skeleton Loader | F5 lại Trang | Trong 1 giây chờ API, không hiện trống trơn, Hiện 24 Cục Xương `SkeletonCard`. |
| TC_PL_242 | Skeleton Animation | Nhìn Skeleton | Các sọc xám trượt ngang liên tục (`animation: shimmer 1.5s infinite`). |
| TC_PL_243 | Skeleton Dark Mode | Bật Dark Theme khi đang load | Cục sọc xám chuyển thành Sọc Đen phản quang trắng. |
| TC_PL_244 | Tốc độ Component React | Cuộn chuột dọc 1 trang chứa 24 SP cấu trúc phức tạp. | Bật Profiler, Render Time < 16ms -> Frame Rate đạt > 60FPS. Không giật lag trình duyệt. |
| TC_PL_245 | Component Mount/Unmount Memory Leak | Bấm qua lại Trang Chủ / Trang Sản Phẩm liên thanh 50 lần. | App không bị văng, Task manager RAM Chrome không tăng thêm 2GB. |
| TC_PL_246 - TC_PL_300 | Giao diện Tổng Hợp | Tất cả Nút bấm, Ô chọn, Dropdown AntD, Sidebar cuộn riêng biệt không ảnh hưởng content chính; Font Chữ không bị méo; Responsive Grid đổ từ 4 cột (Màn 1400px) xuống 3 cột, 2 cột (iPad), và 1 Cột (Điện thoại bé 320px). Đảm bảo một Trang Liệt Kê Sản phẩm 25000 trang chạy lướt mượt mà như hệ thống lõi Shopee / Amazon. | Đạt Chuẩn Xuất Sắc. |

---
**Tổng kết:** Khối lượng 300 kịch bản test này đảm bảo module **Trang Sản Phẩm & Lọc Đa Luồng** chịu tải được mọi bài toán kinh điển nhất của thương mại điện tử cấp độ Doanh nghiệp.
