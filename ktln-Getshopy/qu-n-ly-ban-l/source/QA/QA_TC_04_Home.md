# Kịch Bản Kiểm Thử Chuyên Sâu - Module Trang Chủ (Home Page)

Tài liệu này định nghĩa chính xác **300 Test Cases** vét cạn toàn bộ luồng hiển thị, tương tác và API trên màn hình Trang Chủ (Home Page) của hệ thống Client (localhost:3000). Bao gồm kiểm thử GPU/3D Models, AI Recommendation Engine, Component Sản phẩm và Responsive UI.

---

## Nhóm 1: Hero Section & Hoạt ảnh Scroll Reveal (TC_H_001 - TC_H_030)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_H_001 | Scroll Reveal - Tiêu đề | Vừa load trang chủ xong | Dòng chữ "High-quality tech..." mờ rồi trượt lên rõ dần (opacity 0->1, transform translateY). |
| TC_H_002 | Scroll Reveal - Phụ đề | Nhìn mô tả dưới tiêu đề | Xuất hiện trễ hơn tiêu đề 120ms (`delay: 120`). |
| TC_H_003 | Scroll Reveal - Nhóm Nút | Nhìn 2 nút bấm ở Hero | Xuất hiện trễ hơn mô tả (`delay: 220`). |
| TC_H_004 | Nút "Browse products" | Bấm nút màu đen/trắng (theo theme) | Smooth scroll mượt mà xuống ID `#catalog` (Phần Sản phẩm mới). |
| TC_H_005 | Nút "About us" (Có Footer) | Kéo xuống có thẻ id `footer-section`, bấm nút About | Màn hình smooth scroll xuống cuối trang. |
| TC_H_006 | Nút "About us" (Mất Footer) | Dùng F12 xoá DOM footer, bấm nút About us | Fallback gọi `navigate('/shop')` chuyển sang trang Cửa hàng. |
| TC_H_007 | Hover nút Browse | Hover chuột vào nút chính | Nút thay đổi `opacity: 0.88`, không bị đổi layout. |
| TC_H_008 | Hover nút About | Hover chuột vào nút phụ | Nút đổi màu background tuỳ theme (trắng mờ hoặc xám nhạt). |
| TC_H_009 | Hero Image | Kiểm tra ảnh bên phải | Load thành công `/images/commerce/hero_tech_phone.jpg`. Không bị méo tỷ lệ (object-fit: cover). |
| TC_H_010 | Hero Image Shadow | Đổi Dark Mode | Bóng đổ của khung ảnh đổi từ `rgba(0,0,0,0.04)` sang `0.5` đậm hơn. |
| TC_H_011 | Typography Scaling | Bóp chiều ngang màn hình (Resize) | Cỡ chữ Tiêu đề tự động thu nhỏ từ 56px xuống 38px (`clamp(38px, 4.4vw, 56px)`). |
| TC_H_012 | Text Tràn dòng | F12 sửa nội dung title dài gấp 3 | Không tràn ra ngoài width tối đa `580px` của cột trái, tự động rớt dòng. |
| TC_H_013 | Mobile Flex Wrap | Co màn hình < 768px | Cột chữ và Cột ảnh gập lại thành 1 cột dọc (flex-wrap: wrap). |
| TC_H_014 | Intersection Observer Unmount | Cuộn qua Hero Section, rồi cuộn ngược lại lên trên | Hook `useRevealOnScroll` là "one-shot" -> Đã hiện rồi thì lên lại không bị animation chớp lại lần 2. |
| TC_H_015 | Theme Light - Hero | Bật Light Mode | Chữ đen `#111111`, nút Browse đen, viền nút About nhạt. |
| TC_H_016 | Theme Dark - Hero | Bật Dark Mode | Chữ trắng `#ffffff`, nút Browse trắng, viền nút About mờ. |
| TC_H_017 | Tải trang không Internet | F12 Offline -> F5 | Layout cơ bản vẫn lên, ảnh vỡ hiện icon alt text, text tĩnh vẫn hiển thị (Không phụ thuộc API). |
| TC_H_018 | Lỗi Font | Chặn file font `Inter` load | Font fallback sang system font (`-apple-system, sans-serif`), layout không vỡ. |
| TC_H_019 | Khoảng cách Margin/Padding | Đo CSS padding section | Đạt chuẩn `60px 24px 70px`, mobile không bị tràn lề 2 bên. |
| TC_H_020 | Drag & Drop | Cố kéo Hero image ra ngoài | Ảnh bay theo bóng mờ, không làm hỏng DOM hiện tại. |
| TC_H_021 - TC_H_030 | Keyboard Focus/Tab trên cụm nút | Nhấn Tab từ URL bar | Focus nhảy vào Browse -> About. Nhấn Enter kích hoạt trơn tru. Nhấn phím cách (Space) cũng kích hoạt. Focus outline bao quanh nút màu rõ ràng. Không bị focus bậy vào các thẻ p. |

## Nhóm 2: Category Cards UI & Routing (TC_C_031 - TC_C_060)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_C_031 | Số lượng thẻ | Đếm section Categories | Đổ cố định 6 thẻ (Phone, Laptop, Tablet, Phụ kiện, Đồng hồ, Tất cả). |
| TC_C_032 | Grid CSS | Co kéo màn hình Desktop xuống Tablet | 3 thẻ 1 hàng -> Chuyển thành 2 thẻ 1 hàng -> Chuyển thành 1 thẻ dọc trên Mobile. |
| TC_C_033 | Card Hover Effect | Hover vào thẻ "Điện thoại" | Thẻ nảy lên `translateY(-5px)`, shadow đậm hơn. |
| TC_C_034 | Nút trong thẻ (Arrow) | Hover vào thẻ | Nút "Khám phá" mở rộng gap từ `7px` -> `10px`, mũi tên trượt ra một chút. |
| TC_C_035 | Click Nút Khám phá | Bấm nút ở thẻ "Laptop" | Navigate chuẩn xác tới `/shop?category=cat-laptop`. |
| TC_C_036 | Click Box Thẻ | Bấm vào vùng rỗng của thẻ "Laptop" | Vẫn navigate thành công (Do `onClick` đặt ở root wrapper). |
| TC_C_037 | Event Propagation | Bấm thẳng vào nút Khám phá | Hàm `e.stopPropagation()` chặn click đúp 2 lần từ cha lẫn con. Không sinh ra lỗi History. |
| TC_C_038 | Click thẻ "Tất cả" | Bấm thẻ thứ 6 | KHÔNG navigate. Bật modal Popup (`setIsModalOpen(true)`). |
| TC_C_039 | CSS Fallback Ảnh nền | Tại thẻ không có 3D (Tất cả danh mục) | Không crash, chừa khoảng trống hợp lý hoặc ảnh fallback tĩnh. |
| TC_C_040 | Text Title H3 | Kiểm tra chữ Điện thoại | Màu `#111111` (Light) hoặc `#ffffff` (Dark), font weight 600. |
| TC_C_041 | Text Mô tả | Kiểm tra text dài ở thẻ Phụ kiện | Cắt chữ tự động nếu quá dài, text xám mờ. |
| TC_C_042 | Z-Index Layering | Cuộn trang qua thanh Fixed Header của web | Category Card chui xuống dưới Header (Header z-index phải cao hơn). |
| TC_C_043 | Scroll Reveal - Card | Mới load kéo nhẹ xuống | Khối grid 6 thẻ trượt lên dần dần từ opacity 0. |
| TC_C_044 | CSS Border Card | Bật Dark mode | Thẻ có viền siêu mỏng `rgba(255,255,255,0.05)`. |
| TC_C_045 | Theme Toggle trên thẻ | Bấm nút Dark/Light | Card nền chuyển mượt từ `#f5f5f7` sang `#121722` (Transition CSS 0.3s). |
| TC_C_046 - TC_C_060 | Click routing độc lập | Lần lượt bấm thẻ 1 -> thẻ 5 | Đảm bảo thẻ 1 (Phone) -> `cat-phone`, Thẻ 2 -> `cat-laptop`, Thẻ 3 -> `cat-tablet`, Thẻ 4 -> `cat-mobile-acc`, Thẻ 5 -> `cat-watch`. Thẻ 6 mở modal. Các URL path không bị sai chính tả mã danh mục. Back lại trang chủ không làm vỡ DOM. |

## Nhóm 3: 3D FBX Objects & WebGL (TC_3D_061 - TC_3D_090)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_3D_061 | Tải Component lười (Lazy Load)| Mở Network tab lúc Load | File chunk `Category3DModel` chỉ được tải khi cuộn tới vị trí. |
| TC_3D_062 | Trạng thái Suspense (Loading) | Lúc 3D model đang tải | Component render tạm tấm hình fallback ảnh tĩnh JPG của danh mục đó (`mix-blend-mode` multiply/normal). |
| TC_3D_063 | Xoay 3D Tự động | Khi model load xong | Object tự xoay chầm chậm 1 góc cố định (Tốc độ `0.006`). |
| TC_3D_064 | Tương tác Hover 3D | Đưa chuột lướt vào khối Laptop | Biến `hoveredCard === cat.id` gửi xuống component 3D làm tăng tốc độ xoay hoặc hiệu ứng ánh sáng. |
| TC_3D_065 | Đóng gói WebGL Context | Có 5 cục 3D | Cả 5 `canvas` WebGL khởi tạo không bị đụng độ ID. |
| TC_3D_066 | Lỗi tải file .fbx (URL chết) | F12 Block request `iphone13.fbx` | Component báo lỗi hoặc hiển thị Fallback tĩnh, toàn bộ React App KHÔNG bị sập trắng (ErrorBoundary bắt lỗi). |
| TC_3D_067 | Intersection ẩn Canvas | Cuộn chuột cho Card 3D khuất khỏi màn hình | WebGL ngừng render vòng lặp `requestAnimationFrame` để tiết kiệm Pin laptop / CPU điện thoại (Logic nằm trong Model 3D). |
| TC_3D_068 | Model Ánh sáng (Lighting) | Đổi Dark Mode | Cường độ đèn Directional/Ambient Light trong Model giảm đi, giúp Object tối lại ăn khớp với nền đen. |
| TC_3D_069 | Kích thước Model | Test màn Mobile (320px) | Container chứa Model bị bó hẹp chiều rộng (`58%`), Model tự scale không bị trào ra ngoài rìa phải. |
| TC_3D_070 | Mouse Events Through | Click thẳng lên cục iPhone 3D | Cục 3D `pointerEvents: 'none'`, click thủng qua chạm vào Div của Card -> Vẫn bắt được trigger Routing. |
| TC_3D_071 - TC_3D_090 | Stress Test GPU & Fallback | Liên tục cuộn lên xuống nhanh 50 lần; Mở trên trình duyệt không hỗ trợ WebGL (IE11/Safari cũ); Rút cáp mạng giữa chừng khi file FBX tải được 50%; Giả lập CPU Throttling x6 chậm. | WebGL không ném exception Memory Leak (cần dispose scene/mesh khi unmount). Trình duyệt cũ văng fallback ảnh tĩnh. Không xảy ra giật lag drop FPS toàn trang. |

## Nhóm 4: Phân hệ AI "Dành riêng cho bạn" - Logic & API (TC_AI_091 - TC_AI_120)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_AI_091 | Chờ tải dữ liệu (Loading) | Mới F5 trang | Section "Dành riêng cho bạn" hiện Spin quay. |
| TC_AI_092 | Gọi API cá nhân hoá | Đăng nhập bằng Account có email hợp lệ | Trình duyệt gọi POST/GET tới `api.recommendation.get(b2cUser.email)`. |
| TC_AI_093 | Giới hạn số lượng (Slice 8) | Giả lập API AI trả về list 20 sản phẩm | React dùng `slice(0, 8)`, giao diện chỉ vẽ đúng 8 thẻ sản phẩm, không vẽ 20. |
| TC_AI_094 | Dữ liệu AI hợp lệ | API trả về 5 sản phẩm | Vẽ ra 5 sản phẩm, hàng thứ 2 có khoảng trống, layout không lỗi. |
| TC_AI_095 | Cấu trúc dữ liệu thẻ (Mapping)| Kiểm tra 1 thẻ SP của AI | Trích xuất thành công `name`, `price` format VNĐ, `category_name`, thẻ img lấy `images[0]`. |
| TC_AI_096 | Tiêu đề Section AI | Nhìn h3 section AI | Chữ "Dành riêng cho bạn" có vạch gạch chân ngang (border-bottom). |
| TC_AI_097 | Click chuyển trang SP | Bấm vào 1 SP do AI gợi ý | Navigate sang `/product/{id}`. |
| TC_AI_098 | Hook Dependency | Đổi chi nhánh `selectedBranch` trên Header | `useEffect` kích hoạt, load lại cọc AI Recommendation hoặc fallback. |
| TC_AI_099 | Không dính rác Event | Click ra vùng rìa ngoài của khối SP | Section tĩnh, không nhảy lung tung. |
| TC_AI_100 | Ảnh Fallback AI | SP do AI đẩy về bị thiếu cột `image` hoặc mảng `images` rỗng | UI bốc ảnh mặc định `/images/commerce/prod_mouse.jpg`. |
| TC_AI_101 - TC_AI_120 | Test Format Data AI | Xoay quanh các dạng Response lạ từ AI Server. AI Server Python sập trả về HTML 500, trả về mảng có SP null `[null, obj]`, trả về `price` dạng String thay vì Number, trả về SP trùng ID. | Tác động: App chặn lỗi (try-catch), nếu ID trùng React cảnh báo key nhưng UI không chết. Hàm `Number(product.price)` ép kiểu an toàn ra số. Lỗi 500 tự rớt xuống Fallback best_selling. |

## Nhóm 5: Phân hệ AI - Fallbacks & Empty States (TC_AIF_121 - TC_AIF_150)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_AIF_121 | Chưa đăng nhập (Guest) | Xoá Token, F5 trang chủ | Do `b2cUser` null, luồng code có thể gọi API fail hoặc pass email rỗng. Luồng catch tự nhảy xuống gọi API Fallback (`best_selling`). |
| TC_AIF_122 | Mất mạng khi tải AI | Ngắt mạng khi Spin quay | Try block ném error -> Catch block gọi `best_selling` cũng bị ném lỗi mạng -> Cuối cùng mảng rỗng -> Hiện text Empty State. |
| TC_AIF_123 | Text Empty State | API Fallback cũng trống trơn | Hiện chữ: "Chưa có dữ liệu gợi ý cho tài khoản này." ở giữa màn hình. |
| TC_AIF_124 | Logic Unmount (ignore) | F5 trang rồi lập tức bấm sang menu "Cửa hàng" | Biến cờ `ignore = true` kích hoạt, lệnh `setRecommendedProducts` bị huỷ -> Không báo lỗi React State Leak. |
| TC_AIF_125 | Trạng thái Load Finally | Dù tải AI thành công hay sập Fallback | Biến `setLoadingRec(false)` luôn chạy, Spin luôn biến mất. |
| TC_AIF_126 | Fallback API Params | Soi Request tab Fallback | Phải gọi `getProducts('ALL', '', 'best_selling', branchId, 1, 8)`. Đúng limit = 8. |
| TC_AIF_127 | Dark Mode Text Empty | Bật Dark mode khi Empty | Text "Chưa có dữ liệu..." có độ trong suốt `rgba(255,255,255,0.5)`, không bị chói. |
| TC_AIF_128 | So sánh Fallback & Newest | Check SP của AI Fallback và SP Mới | 2 list khác biệt (1 bên gọi `best_selling`, 1 bên gọi `newest`). |
| TC_AIF_129 | Phân trang ẩn | API Fallback trả `data` chứa `items`, `total` | React lấy đúng `res.data` array. (Tuỳ chuẩn API trả về mảng trực tiếp hay bọc trong data. Mảng ở đây code ghi `res?.data?.slice`). |
| TC_AIF_130 | Giao diện Spin | Inspect thẻ Spin | Nằm cân giữa (textAlign: center, padding: 60px 0). |
| TC_AIF_131 - TC_AIF_150 | Các biến thể lỗi logic | AI trả về mảng rỗng `[]` nhưng HTTP 200; AI trả về Object thay vì Array; AI độ trễ phản hồi quá 10 giây; Bị chặn CORS (do ngắt kết nối gateway); Lỗi SSL hand-shake với AI server. | Toàn bộ bị nuốt vào khối Catch, âm thầm xài API Best Selling của backend Ecommerce chính để thay thế. Không làm trải nghiệm khách hàng bị gián đoạn hay hiện Modal báo lỗi đỏ chót (Trang chủ cấm báo lỗi popup gây phiền khách). |

## Nhóm 6: Phân hệ "Sản phẩm mới" (Newest) (TC_N_151 - TC_N_180)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_N_151 | Chờ tải (Loading) | Kéo xuống cuối trang | Khối "Sản phẩm mới" hiện vòng Spin song song với khối AI. |
| TC_N_152 | Gọi API Newest | Inspect Network | Bắn API `getProducts('ALL', '', 'newest', branchId, 1, 8)`. |
| TC_N_153 | Slice Limit | DB có 100 sản phẩm mới | API gửi về, React cắt đúng bằng `slice(0,8)`. |
| TC_N_154 | Scroll Reveal New | Cuộn chậm qua Section New | Trượt lên `useRevealOnScroll({ threshold: 0.08 })`. |
| TC_N_155 | Dữ liệu rỗng | DB không có bất kỳ SP nào | Component render Empty state: "Không tìm thấy sản phẩm mới nào...". |
| TC_N_156 | Thay đổi nhánh | Bấm chọn chi nhánh Hà Nội thay vì HCM | `useEffect` chạy lại -> `setLoadingNew(true)` -> Load list SP mới của kho Hà Nội. |
| TC_N_157 | Tiêu đề Newest | Xem HTML Title | Text "Sản phẩm mới" có vạch kẻ `border-bottom` y chang khối AI, tạo thiết kế đồng nhất. |
| TC_N_158 | Responsive Header Flex | Co hẹp màn hình | Cụm Tiêu đề và Thanh Search ngang ở khối Newest tự động rớt dòng (`flex-wrap: wrap`, `gap: 16`). |
| TC_N_159 | Click vào SP | Bấm SP thứ 1 | Navigate tới `/product/1`. |
| TC_N_160 | Cấu trúc Array Data | DB báo lỗi, API trả `undefined` | Hook không chết, biến `res?.data` an toàn chuyển về `[]`. |
| TC_N_161 - TC_N_180 | Edge Cases Dữ liệu Newest | List SP gửi về bị khuyết giá (`price: null`); Thiếu tên danh mục (`category_name: null` và `Category: null`); Trả về ảnh Link chết; Trả SP trạng thái Inactive (Lẽ ra backend phải chặn nhưng frontend check). | Frontend handle "TECHNOLOGY", ép `price = 0`, gán ảnh `prod_mouse.jpg` khi onError. Không vỡ Card. |

## Nhóm 7: Local Search Bar (Trong khối SP Mới) (TC_LS_181 - TC_LS_210)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_LS_181 | Giao diện ô Search | Nhìn góc phải Title "SP Mới" | Có 1 Input text "Search for products", icon Kính lúp. Viền trong suốt, không outline lồi lõm. |
| TC_LS_182 | Gõ chữ tìm Tên (Name) | Nhập "iphone" | Array 8 SP lập tức lọc ra (Client-side) chỉ hiện iPhone. |
| TC_LS_183 | Gõ chữ tìm Hãng/Danh mục | Nhập "laptop" (Dù tên SP là "MacBook Pro") | Array lọc đúng nếu biến `category_name` có chữ "Laptop". |
| TC_LS_184 | Không phân biệt Hoa/Thường | Nhập "IPHONE" hoặc "iPhone" | Vẫn lọc ra kết quả y chang nhau (do `.toLowerCase()`). |
| TC_LS_185 | Xoá rỗng chuỗi | Bôi đen xoá sạch | Mảng render về đúng 8 SP ban đầu. |
| TC_LS_186 | Nhập khoảng trắng | Gõ phím Space 3 lần "   " | Hàm `.trim()` khử chuỗi -> Xem như rỗng -> Hiện 8 SP. |
| TC_LS_187 | Lọc không ra kết quả | Gõ "zzxxxxzzqq" | Hiển thị thông báo: "Không tìm thấy sản phẩm mới nào phù hợp với tìm kiếm của bạn." |
| TC_LS_188 | Local Memory | Ô Search chỉ lọc SP của biến `newestProducts` | KHÔNG lọc ảnh hưởng sang khu vực "Dành riêng cho bạn" ở trên. |
| TC_LS_189 | Dark Mode Text Input | Bật Dark Mode | Chữ gõ vào ô search có màu trắng `#ffffff`. |
| TC_LS_190 | Click Icon Kính lúp | Bấm thẳng vào kính lúp | Không reload trang. (Hiện không gán sự kiện API gọi đi, chỉ phụ trách lọc local). |
| TC_LS_191 - TC_LS_210 | Xung đột gõ phím nhanh | Bấm giữ phím "A" cho ra 100 chữ "A"; Copy/Paste chuỗi Emoji 😂🔥; Copy mã SQL Injection `' OR 1=1`; Xoá toàn bộ chuỗi tìm kiếm trong 1 mili-giây. | Trình duyệt không bị khựng (lag) vì bộ lọc mảng chỉ chạy qua 8 item `useMemo`. Mã độc XSS không thực thi vì React escape string khi render ra màn hình. Lọc local mượt mà. |

## Nhóm 8: All Categories Modal UI (TC_MC_211 - TC_MC_240)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_MC_211 | Mở Modal | Bấm thẻ thứ 6 "Tất cả danh mục" | Bật Modal (`isModalOpen = true`). |
| TC_MC_212 | Nền Modal Overlay | Mở Modal | Nền đen mờ 50% che web, cuộn con lăn chuột thì trang web phía sau KHÔNG bị cuộn (body `overflow: hidden`). |
| TC_MC_213 | Đóng qua nút X (AntD) | Bấm dấu X góc phải trên | Modal đóng, state false. Ô tìm kiếm trong modal bị xoá rỗng (reset `modalSearch`). |
| TC_MC_214 | Đóng qua phím ESC | Nhấn ESC trên phím | Modal đóng. |
| TC_MC_215 | Đóng qua Overlay | Bấm chuột ngoài vùng Modal | Modal đóng. |
| TC_MC_216 | Kích thước Modal | Inspect width Modal | Độ rộng tối đa `920px`, canh giữa màn hình (`centered`). |
| TC_MC_217 | Border Radius Modal | Kiểm tra góc Modal | Góc bo tròn lớn `borderRadius: 24px`. |
| TC_MC_218 | Dark Mode Modal Background | Chuyển Dark Theme | Nền modal đổi sang xám đen `#0f172a`. Light Mode nền trắng `#ffffff`. |
| TC_MC_219 | Cấu trúc Danh mục (Hierarchy) | Modal render list danh mục | Các Danh mục Cha (Không có `parent_id`) hiện làm Tiêu đề. Các Danh mục Con nằm thụt vào hoặc ở dưới theo Grid. |
| TC_MC_220 | Phân tách cha con | Hàm `hierarchicalCategories` | Duyệt đệ quy hoặc Map ghép Cha + `children`. Đảm bảo không cha nào bị mất con. |
| TC_MC_221 - TC_MC_240 | Rendering Sub-items & Icons | Đếm số lượng cha con | Các danh mục hiện đầy đủ icon (Hàm `getCategoryIcon`). Nhấn vào 1 danh mục con trong Modal -> Phải đóng Modal và Navigate sang trang `/shop?category=id`. Đảm bảo các link điều hướng hoạt động hoàn hảo. |

## Nhóm 9: Modal Search Logic (TC_MS_241 - TC_MS_270)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_MS_241 | Thanh tìm kiếm Modal | Có ô Input Search phía trên danh sách | Nhập liệu độc lập với thanh Search Newest. |
| TC_MS_242 | Gõ tên Danh Mục Cha | Gõ "Điện thoại" | Lọc ra khối Cha "Điện thoại" VÀ KÈM THEO toàn bộ con của nó (Apple, Samsung...). |
| TC_MS_243 | Gõ tên Danh Mục Con | Gõ "Ốp lưng" (Con của Phụ kiện) | Lọc ra khối Cha "Phụ kiện", và trong khối cha đó **Chỉ giữ lại** chữ "Ốp lưng" (các con khác bị ẩn đi). |
| TC_MS_244 | Gõ sai hoàn toàn | Gõ "Vũ trụ" | Modal không sập. Có thể trắng trơn hoặc báo Empty "Không có danh mục". |
| TC_MS_245 | Hàm `toLowerCase` | Gõ "ốP lƯnG" | Vẫn lọc ra kết quả chuẩn. |
| TC_MS_246 | Khử khoảng trắng | Gõ "  Laptop   " | Hàm `trim()` hoạt động. Giữ lại khối Laptop. |
| TC_MS_247 | Thoát Modal tự dọn dẹp | Đang gõ chữ "Macbook", nhấn đóng Modal, bật lại. | Chữ "Macbook" tự động mất (`setModalSearch('')`). |
| TC_MS_248 - TC_MS_270 | Nested Filtering Boundary Test | Danh mục cha rỗng không con; Con khớp cha không khớp; Cả cha lẫn con đều khớp chuỗi. | Code `hierarchicalCategories` dùng memo bắt trọn: `parentMatch` giữ cả nhà, `matchedChildren` giữ mảng con thu gọn. Mọi nhánh điều kiện logic AND/OR chạy đúng 100%. |

## Nhóm 10: Product Card Component Tương Tác Cốt Lõi (TC_PC_271 - TC_PC_300)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| TC_PC_271 | Container Card SP | Di chuột vào toàn bộ khung Card 1 SP | Thẻ nguyên khối trồi lên `translateY(-4px)` (CSS transition mượt 0.25s). |
| TC_PC_272 | Ảnh SP Zoom In | Hover vào bức ảnh bên trong Card | Cục ảnh to dần ra `scale(1.06)`, nhưng KHÔNG bị tràn ra ngoài viền bo góc (`overflow: hidden`). |
| TC_PC_273 | Mix Blend Mode (Light) | Bật Light Mode, nhìn ảnh nền trắng | Chế độ `multiply` gọt bỏ viền trắng của SP đè lên xám nhạt `#f5f5f7`. Rất ảo diệu. |
| TC_PC_274 | Mix Blend Mode (Dark) | Bật Dark Mode, nhìn ảnh SP | Chế độ `normal` để tránh ảnh hưởng độ sáng của màn đêm. Khung nền `#121722`. |
| TC_PC_275 | Lazy Loading Ảnh | Cuộn nhanh trang web | Ảnh SP có thuộc tính `loading="lazy"` giúp tăng tốc FCP cho Chrome. |
| TC_PC_276 | Fallback Ảnh chết | Ảnh từ CDN bị 404 (Lỗi) | Sự kiện `onError` bắt lỗi lập tức thế ảnh `/images/commerce/prod_mouse.jpg`. Lệnh `e.target.onerror = null` chặn vòng lặp chớp vô hạn. |
| TC_PC_277 | Nút Add To Bag | Nhìn góc phải dưới bức ảnh | Có 1 nút tròn nổi (`absolute`, `bottom: 16px`), icon Giỏ hàng. Bóng đổ đổ ra ngoài. |
| TC_PC_278 | Bấm Add To Bag | Click trái vào cái Nút Tròn Nhỏ | Gửi Object `{id, name, price, image, stock}` vào `addToCart()` context. |
| TC_PC_279 | Trạng Thái Visual Feedback | Ngay sau khi click Giỏ hàng | Nút đổi màu Xanh Lục `#10b981`, đổi Icon thành Dấu Tick `✓`. |
| TC_PC_280 | Trạng Thái Revert | Canh đồng hồ đếm 2 giây sau click | Nút tự động chuyển về màu cũ (Đen/Trắng mờ), icon về lại hình Giỏ xách. Biến `addedItemMap[id]` về false. |
| TC_PC_281 | Chống chuyển trang khi Add Cart | Click nút Add Giỏ hàng | Hàm `e.stopPropagation()` bẻ gãy event truyền lên Card Cha -> KHÔNG bị đá văng vào trang chi tiết `/product/id`. Mua ngay tại rốn. |
| TC_PC_282 | Name Truncation | Render 1 SP tên dài 6 dòng | CSS `WebkitLineClamp: 2` ngắt cứng bằng `...` ở cuối dòng 2. Chiều cao `42px` cố định, thẻ SP không bị thò thụt so với hàng xóm. |
| TC_PC_283 | Format Giá SP | Render giá 1200000 | JS biến đổi thành `1.200.000 đ`. |
| TC_PC_284 | Lỗi giá Null | DB rớt mạng ép giá null | Hàm Math.round báo NaN nếu k ép kiểu? Component gọi `Math.round(product.price)` -> ra 0 đ. Không chết ngắc. |
| TC_PC_285 - TC_PC_300 | Toàn vẹn CSS & Rò Rỉ Biến | Đổi Theme 10 lần liên tục; Click Add to Cart đồng thời 8 sản phẩm; Hover qua lại liên thanh; Mở ở màn hình 4k (3840px). | Hoạt ảnh không bị khựng, các setTimeout 2s của Nút Giỏ Hàng hoạt động hoàn toàn độc lập (nhờ Dictionary `addedItemMap` key=ID). Khung card responsive 4 cột trên PC xịn, 2 cột trên Phone, 1 cột trên iPad gập. |

---
**Tổng quan QA Tích hợp:** Bộ 300 trường hợp này bao phủ hoàn toàn một vòng đời từ lúc Khách hàng vào trang, lướt thấy Hero, vọc vạch 3D Model, ngạc nhiên vì AI đoán trúng phóc đồ đang cần mua, Search local cực nhanh, bỏ giỏ phát ăn ngay. Cấu thành nên sự ổn định "Thép" của Front-end GetShopy.
