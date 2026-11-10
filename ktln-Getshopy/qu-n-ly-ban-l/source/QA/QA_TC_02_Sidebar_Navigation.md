# Kịch Bản Kiểm Thử Chi Tiết - Module Sidebar Navigation

Tài liệu này định nghĩa **50 Test Cases tiêu chuẩn siêu chi tiết** áp dụng cho **mỗi nút bấm (button)** trên Sidebar (Trang chủ, Cửa hàng, Sản phẩm, Trang, So sánh, Bán chạy, Tài khoản, Liên hệ, Về chúng tôi) tại màn hình Client (localhost:3000).

*Lưu ý: Bộ test này chỉ tập trung vào hành vi tương tác với chính nút Sidebar, độ mượt, UX/UI, Routing và Edge Cases (Chưa tính việc test nội dung bên trong của cái trang đó).*

## A. Tương tác chuột & Trạng thái UI (Mouse & UI States) - 10 TCs
| ID | Kịch bản kiểm thử | Hành động (Action) | Kết quả kỳ vọng (Expected) |
| :--- | :--- | :--- | :--- |
| **TC_SIDE_01** | Trạng thái Hover (Collapsed) | Sidebar thu gọn. Rê chuột vào Icon của nút | Hiện Tooltip chứa tên nút để người dùng biết chức năng. |
| **TC_SIDE_02** | Trạng thái Hover (Expanded) | Sidebar mở rộng. Rê chuột vào một nút | Nền nút chuyển màu sáng hơn/tối hơn (hover state) mượt mà. |
| **TC_SIDE_03** | Trạng thái Mouse Leave | Đưa chuột ra khỏi nút vừa hover | Trở về trạng thái màu sắc mặc định, không bị dính màu. |
| **TC_SIDE_04** | Trạng thái Active (Chính xác) | Đang đứng ở trang `/shop`. Nhìn vào nút "Cửa hàng" | Nút phải sáng lên (Text trắng, background xám đậm). Các nút khác xỉn màu. |
| **TC_SIDE_05** | Trạng thái Active (Child Route) | Đang đứng ở `/product/123`. Nhìn vào nút "Cửa hàng" | Nút "Cửa hàng" hoặc "Sản phẩm" vẫn phải sáng lên để biết đang ở nhánh nào. |
| **TC_SIDE_06** | Chuột trái (Left Click) | Click chuột trái 1 lần vào nút | Router điều hướng lập tức sang URL tương ứng. |
| **TC_SIDE_07** | Chuột giữa (Middle Click) | Click chuột giữa (con lăn) vào nút | Mở trang đó ở một Tab mới (Cần bọc thẻ `<a>` hoặc handle `window.open`). |
| **TC_SIDE_08** | Chuột phải (Right Click) | Click chuột phải vào nút | Hiện Context Menu chuẩn của trình duyệt (Open link in new tab, Copy link...). |
| **TC_SIDE_09** | Double Click | Click chuột trái 2 lần cực nhanh vào nút | Chỉ tính 1 lần chuyển trang. Không sinh ra 2 history states trong trình duyệt. |
| **TC_SIDE_10** | Chế độ Tối (Dark Mode) | Bật công tắc Dark Mode. Nhìn vào các nút | Toàn bộ Text, Icon và màu Hover tự động đảo ngược tỷ lệ tương phản để dễ đọc. |

## B. Điều hướng & Router (Navigation) - 10 TCs
| ID | Kịch bản kiểm thử | Hành động (Action) | Kết quả kỳ vọng (Expected) |
| :--- | :--- | :--- | :--- |
| **TC_SIDE_11** | Chuyển trang SPA | Click từ "Trang chủ" sang "Cửa hàng" | Trang mới xuất hiện không bị chớp trắng (No full-page reload). |
| **TC_SIDE_12** | Load lại dữ liệu rác | Đang ở "Cửa hàng", bấm lại nút "Cửa hàng" | Không gọi lại API tốn tài nguyên, giữ nguyên trạng thái scroll hiện tại. |
| **TC_SIDE_13** | Nút Back trình duyệt | Từ Cửa hàng -> Tài khoản. Bấm phím Back `<` | Trở về trang Cửa hàng. Nút "Cửa hàng" trên Sidebar tự động sáng lên lại. |
| **TC_SIDE_14** | Nút Forward trình duyệt | Bấm Back `<` rồi bấm Forward `>` | Chuyển lại trang Tài khoản. Nút Sidebar tương ứng sáng lên. |
| **TC_SIDE_15** | Kéo thả nút (Drag & Drop) | Click giữ chuột vào text của nút và kéo ra ngoài | Layout Sidebar không bị vỡ. Link hoặc text bay theo bóng mờ. |
| **TC_SIDE_16** | Loading Bar | Bật Slow 3G, click vào một trang nặng | Phải có vệt sáng loading ở trên cùng màn hình (Top Progress Bar). |
| **TC_SIDE_17** | Cuộn trang mượt (Anchor link)| Click vào nút "Liên hệ" (Gọi anchor `#footer`) | Màn hình tự động cuộn mượt (smooth scroll) xuống cuối trang thay vì giật cục. |
| **TC_SIDE_18** | Đóng/Mở Dropdown (Mega) | Click vào nút "Sản phẩm" có biểu tượng mũi tên | Mở thả xuống (Mega Dropdown) chứa các danh mục. Mũi tên xoay 180 độ. |
| **TC_SIDE_19** | Đóng Dropdown tự động | Đang mở menu "Sản phẩm", click vào nút "Trang chủ" | Menu "Sản phẩm" tự động đóng lại, chuyển sang trang chủ. |
| **TC_SIDE_20** | Click ngoài vùng Dropdown | Đang mở menu "Trang", click chuột ra vùng xám | Menu tự động đóng lại (Handle click outside). |

## C. Di động & Responsive (Mobile Experience) - 10 TCs
| ID | Kịch bản kiểm thử | Hành động (Action) | Kết quả kỳ vọng (Expected) |
| :--- | :--- | :--- | :--- |
| **TC_SIDE_21** | Tự động đóng (Auto-close) | Dùng Mobile, mở Hamburger menu, bấm nút "Cửa hàng"| Chuyển trang xong, cái Sidebar Drawer phải tự động thụt vào (Đóng). |
| **TC_SIDE_22** | Độ trễ cảm ứng (Touch Delay) | Tap vào nút trên điện thoại thực tế | Chuyển trang ngay lập tức. Không bị delay 300ms do trình duyệt chờ double-tap. |
| **TC_SIDE_23** | Vuốt trượt dọc (Scroll) | Vuốt ngón tay lên xuống trên Sidebar di động | Các nút trượt mượt mà. Không bị kẹt hay chạm nhầm (Accidental click). |
| **TC_SIDE_24** | Chế độ iPad (Tablet mode) | Co màn hình xuống kích thước 768px | Sidebar tự động thu gọn về dạng Icon (Collapsed) để tiết kiệm diện tích. |
| **TC_SIDE_25** | Vùng bấm (Touch Target) | Thử click vào rìa viền của nút | Đảm bảo nút đủ lớn (cao tối thiểu 44px) để ngón tay to không bấm nhầm nút trên/dưới. |
| **TC_SIDE_26** | Xoay ngang màn hình (Landscape)| Đang mở Sidebar Mobile, xoay ngang điện thoại | Sidebar tính toán lại chiều cao, thanh cuộn tự động xuất hiện nếu số nút quá dài. |
| **TC_SIDE_27** | Bàn phím ảo | Bấm thanh search ảo cho bàn phím trồi lên, sau đó bấm 1 nút Sidebar | Bàn phím tự động ẩn đi, quá trình chuyển trang diễn ra bình thường. |
| **TC_SIDE_28** | Cử chỉ Zoom (Pinch) | Zoom to màn hình bằng 2 ngón tay rồi bấm nút | Giao diện nút và icon không bị vỡ hoặc che khuất nhau. |
| **TC_SIDE_29** | Dropdown trên Mobile | Bấm "Sản phẩm" trên màn Mobile | Trổ xuống dạng Accordion dọc (đẩy các nút bên dưới xuống), không dùng tooltip đè. |
| **TC_SIDE_30** | Margin/Padding rỗng | Click vào khoảng trống 2px giữa 2 nút | Không xảy ra hiện tượng click lan hay lỗi logic. Trình duyệt bỏ qua. |

## D. Bàn phím & Trợ năng (Accessibility - a11y) - 10 TCs
| ID | Kịch bản kiểm thử | Hành động (Action) | Kết quả kỳ vọng (Expected) |
| :--- | :--- | :--- | :--- |
| **TC_SIDE_31** | Phím Tab điều hướng | Nhấn phím `Tab` liên tục trên bàn phím | Focus nhảy tuần tự qua từng nút trên Sidebar từ trên xuống dưới. |
| **TC_SIDE_32** | Phím Enter kích hoạt | Khi ô focus đang ở nút "Trang chủ", nhấn `Enter` | Route chuyển về Trang chủ hệt như khi click chuột trái. |
| **TC_SIDE_33** | Phím Spacebar | Focus vào nút "Sản phẩm", nhấn `Space` | Thả xuống Mega Dropdown danh mục. Nhấn Space lần nữa để thu lại. |
| **TC_SIDE_34** | Focus Outline | Dùng phím `Tab` để nhảy vào 1 nút | Phải có viền màu xanh (Outline ring) bao quanh nút để người dùng nhận diện vị trí. |
| **TC_SIDE_35** | aria-label cho Screen Reader | Bật VoiceOver/Narrator, hover vào một nút icon | Máy đọc đúng: "Nút chuyển đến Cửa hàng" thay vì đọc tên file ảnh. |
| **TC_SIDE_36** | aria-current | Dùng công cụ inspect element | Nút đang Active phải có cờ `aria-current="page"` để báo cho người khiếm thị. |
| **TC_SIDE_37** | Phím Esc | Bấm mũi tên mở Dropdown "Trang", sau đó nhấn `Esc` | Dropdown đóng lại ngay lập tức. |
| **TC_SIDE_38** | tabindex="0" | Kiểm tra mã HTML | Mọi nút tương tác (nếu không dùng `<a>`) đều phải có `tabindex=0`. |
| **TC_SIDE_39** | Mũi tên Up/Down | Mở Dropdown Sản phẩm, dùng phím Mũi tên Lên/Xuống | Nhảy qua lại giữa các mặt hàng trong menu con. |
| **TC_SIDE_40** | Focus Trap trên Mobile | Mở Sidebar di động, dùng phím `Tab` | Focus không được lọt ra ngoài vùng xám (body nền), chỉ quẩn quanh trong Sidebar. |

## E. Logic bảo mật, Dữ liệu & Hiệu năng (Logic & Performance) - 10 TCs
| ID | Kịch bản kiểm thử | Hành động (Action) | Kết quả kỳ vọng (Expected) |
| :--- | :--- | :--- | :--- |
| **TC_SIDE_41** | Chặn quyền "Đơn hàng" (Auth Guard) | Đang là tài khoản Khách, bấm nút "Đơn hàng và tài khoản" | Không cho chuyển trang. Pop-up Modal Đăng nhập hiện ra ngay lập tức. |
| **TC_SIDE_42** | Mở Modal xong quay lại | Ở Modal Đăng nhập, bấm nút "Trang chủ" | Modal tự động ẩn, chuyển về Trang chủ. |
| **TC_SIDE_43** | Đăng nhập xong bấm lại nút | Login xong, bấm "Đơn hàng và tài khoản" | Cho qua, vào trang Dashboard của Khách bình thường. |
| **TC_SIDE_44** | Rò rỉ RAM (Memory Leak) | Spam bấm qua lại "Cửa hàng" và "Trang chủ" 100 lần | Kiểm tra Task Manager Chrome. RAM không được phình to (DOM Node không tăng vô hạn). |
| **TC_SIDE_45** | Mất mạng (Offline) | Tắt WiFi. Bấm vào một nút Sidebar chưa từng load | Thanh loading chạy rồi hiện trang báo lỗi: "Vui lòng kiểm tra kết nối mạng". |
| **TC_SIDE_46** | Ngôn ngữ (i18n) | Click chuyển đổi ngôn ngữ EN/VI (nếu có) | Text trên nút lập tức đổi theo (VD: Trang chủ -> Home), không cần F5. |
| **TC_SIDE_47** | Phản hồi mở đồng thời | Đang mở menu "Sản phẩm", tay bấm mở tiếp "Trang" | Menu "Sản phẩm" đóng lại, Menu "Trang" mở ra. Không cho phép mở 2 cái cùng lúc đè lên nhau. |
| **TC_SIDE_48** | Lazy loading JS Bundle | Mở tab Network F12. Click "So sánh thiết bị" lần đầu | Trình duyệt tải 1 file `chunk-compare.js` nhỏ về. Lần sau bấm lại không tải nữa (Cache). |
| **TC_SIDE_49** | Token hết hạn | Bấm nút "Tài khoản" khi Token đăng nhập vừa chết | Hệ thống gọi `/refresh` ngầm. Nếu thành công thì cho vào, nếu fail thì đẩy ra báo Đăng nhập lại. |
| **TC_SIDE_50** | Resize trơn tru (Smooth transition)| Thu hẹp cửa sổ trình duyệt từ từ | Thanh Sidebar co hẹp chiều rộng bằng CSS Transition, chữ biến mất mượt, không giật lóa mắt. |

---
**Tổng kết:** Bất kỳ một Component Nút (Button) nào trên Sidebar khi được Code/Design đều phải thoả mãn 50 tiêu chí khắt khe này mới được coi là một sản phẩm đạt tiêu chuẩn UX/UI mức Production. Đem 50 trường hợp này áp dụng nhân lên với 8 nút trên Sidebar = **400 trường hợp kiểm thử**.
