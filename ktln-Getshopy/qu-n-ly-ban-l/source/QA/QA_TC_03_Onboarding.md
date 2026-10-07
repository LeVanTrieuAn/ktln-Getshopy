# Kịch Bản Kiểm Thử Chuyên Sâu - Module AI Onboarding (Khảo sát sở thích)

Tài liệu này định nghĩa chính xác **150 Test Cases** vét cạn toàn bộ luồng khảo sát thu thập dữ liệu lạnh (Cold-start data) cho hệ thống AI Recommendation. Luồng gồm 4 bước: Danh mục -> Hãng -> Tầm giá -> Không quan tâm.

---

## Nhóm 1: Routing & Khởi tạo (TC_OB_001 - TC_OB_010)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_001** | Chưa đăng nhập vào thẳng link `/onboarding` | Khách vãng lai gõ URL `/onboarding` | Redirect ngay về `/` (Trang chủ), không cho làm khảo sát. |
| **TC_OB_002** | Khách đã làm khảo sát vào lại link | User cũ có data pref gõ `/onboarding` | Vẫn vào được để sửa lại (hoặc tuỳ rule business có thể chặn). Hiện tại code cho vào. |
| **TC_OB_003** | Khách đăng nhập qua Google lần đầu | Login xong bằng Google API | Chuyển hướng tự động vào `/onboarding` do API báo chưa có pref. |
| **TC_OB_004** | Khách đăng nhập bằng Mật khẩu lần đầu | Login xong bằng Password | Chuyển hướng tự động vào `/onboarding`. |
| **TC_OB_005** | API Options bị lỗi | F12 chặn request `getOnboardingOptions` | Văng thông báo lỗi "Không tải được lựa chọn" và Redirect về `/`. |
| **TC_OB_006** | API Options rớt mạng (Timeout) | Giả lập mạng chậm/mất mạng | Cùng kết quả như TC_OB_005. Không bị treo Loading mãi mãi. |
| **TC_OB_007** | Trạng thái Loading ban đầu | Reload trang `/onboarding` | Hiện biểu tượng vòng xoay `<Spin>` ở giữa màn hình trước khi có data. |
| **TC_OB_008** | Payload API chuẩn | Check network response của `options` | Chứa đủ `categories`, `brandsByCategory`, `priceBands`. |
| **TC_OB_009** | Nút Back trình duyệt khi đang load | Bấm Back lúc Spin đang quay | Rời khỏi trang an toàn, không có lỗi Unmounted Component. |
| **TC_OB_010** | Hiển thị lời chào đúng tên | Đăng nhập tài khoản tên "Nguyễn Văn A" | Kicker ghi: `Chào A 👋` (Tách từ cuối của Full name). |

## Nhóm 2: Giao diện chung & Text (TC_OB_011 - TC_OB_020)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_011** | Tiêu đề chính | Nhìn vào thẻ h1 | Hiện "Giúp chúng tôi gợi ý đúng ý bạn". |
| **TC_OB_012** | Mô tả (Subtitle) | Nhìn vào subtitle | Hiện "Mất chừng 30 giây. Bỏ qua được...". |
| **TC_OB_013** | Hiển thị Steps Bar | Nhìn vào thanh trên cùng | Có đủ 4 cục: Danh mục, Hãng, Tầm giá, Không quan tâm. |
| **TC_OB_014** | Trạng thái Step hiện tại | Đang ở bước 0 | Nút "Danh mục" sáng lên, các nút khác mờ. |
| **TC_OB_015** | Trạng thái Step đã qua | Sang bước 1 | Cục "Danh mục" đổi thành dấu tick `✓`, cục "Hãng" sáng lên. |
| **TC_OB_016** | Nút Bỏ qua (Skip) | Tìm nút Bỏ qua ở Footer | Luôn xuất hiện ở góc trái dưới, kiểu dáng link gạch chân. |
| **TC_OB_017** | Nút Quay lại (Back) | Ở bước 0 (Danh mục) | **Không** hiển thị nút Quay lại. |
| **TC_OB_018** | Nút Tiếp (Next) | Ở bước 0 | Hiển thị nút "Tiếp". |
| **TC_OB_019** | Trạng thái Disable nút Tiếp | Ở bước 0, chưa chọn gì | Nút "Tiếp" bị mờ (Disabled), không bấm được. |
| **TC_OB_020** | Responsive Card | Co màn hình < 480px | Layout paddings giảm, text của 4 steps ẩn đi, chỉ hiện số 1,2,3,4. |

## Nhóm 3: Bước 0 - Chọn Danh Mục (TC_OB_021 - TC_OB_030)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_021** | Hiển thị danh mục | Load bước 0 | Đổ đủ các thẻ Chip danh mục từ API (Phone, Laptop...). |
| **TC_OB_022** | Click chọn 1 danh mục | Bấm "Điện thoại" | Thẻ Chip chuyển màu đậm, xuất hiện dấu `✓`. Nút "Tiếp" sáng lên. |
| **TC_OB_023** | Click bỏ chọn (Toggle off) | Bấm lại "Điện thoại" | Thẻ Chip mất dấu tick, màu trở về mặc định. Nút "Tiếp" bị mờ lại. |
| **TC_OB_024** | Chọn nhiều danh mục | Bấm "Điện thoại", "Laptop", "Tablet" | Cả 3 thẻ đều sáng. List state lưu 3 ID. |
| **TC_OB_025** | Cố tình Next khi chưa chọn | Xoá `disabled` bằng F12 rồi bấm Tiếp | Component State `canNext` chặn lại hoặc API chặn lúc cuối. (Trong React, disabled chặn click event). |
| **TC_OB_026** | Chọn tất cả danh mục | Bấm hết tất cả các thẻ Chip | Bấm được hết, không có giới hạn số lượng max. |
| **TC_OB_027** | Chuyển Step sau khi chọn | Chọn "Laptop", bấm "Tiếp" | UI trượt sang Bước 1 mượt mà. |
| **TC_OB_028** | Quay lại sau khi đã chọn | Ở bước 1 bấm Quay lại Bước 0 | Tuỳ chọn "Laptop" vẫn đang được tick (Giữ State). |
| **TC_OB_029** | Layout Grid danh mục | Kiểm tra CSS | Hiển thị dạng lưới tự động ngắt dòng nếu nhiều item (grid-template-columns). |
| **TC_OB_030** | Rê chuột (Hover) danh mục | Hover chuột vào một nút chưa tick | Đổi màu border mờ báo hiệu có thể click. |

## Nhóm 4: Bước 1 - Chọn Hãng (Brands) (TC_OB_031 - TC_OB_040)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_031** | Hiển thị Hãng theo Danh mục | Bước 0 chọn "Điện thoại", sang Bước 1 | Chỉ hiển thị hãng của Điện thoại (Apple, Samsung...). KHÔNG hiện hãng Laptop (Dell, Asus). |
| **TC_OB_032** | Hiển thị Hãng (Nhiều danh mục) | Bước 0 chọn Phone + Laptop, sang Bước 1 | Hiện Hãng của cả 2. Nếu Apple bán cả Phone và Laptop, thẻ Apple **không bị lặp lại 2 lần**. (Hàm `brandsForLiked` đã dedup). |
| **TC_OB_033** | Trạng thái rỗng | Nếu API trả về Danh mục không có hãng nào | Hiện dòng chữ: "Chưa có hãng nào trong các nhóm này." |
| **TC_OB_034** | Không bắt buộc chọn | Không tick hãng nào, bấm "Tiếp" | Vẫn qua được Bước 2 (Vì hãng là không bắt buộc). |
| **TC_OB_035** | Chọn nhiều hãng | Bấm chọn Apple, Samsung | Cả 2 đều đánh dấu `✓`. |
| **TC_OB_036** | Bỏ chọn hãng | Bấm Apple lần 2 | Mất dấu tick. |
| **TC_OB_037** | Logic tự dọn rác (Deselect Category) | Bước 1 chọn hãng Dell. Trở về B0 bỏ tick Laptop. Sang lại B1 | Hãng Dell hoàn toàn biến mất. (Tránh lưu hãng của danh mục không thích). |
| **TC_OB_038** | Text Câu hỏi Bước 1 | Nhìn title Bước 1 | Ghi: "Bạn hay dùng hãng nào?" và Hint "không bắt buộc". |
| **TC_OB_039** | Thứ tự xuất hiện hãng | Nhìn danh sách hãng | Sắp xếp theo thứ tự trả về từ Server. |
| **TC_OB_040** | Lỗi Duplicate ID | Kiểm tra Key của React | Mở Console F12 không có cảnh báo Warning Duplicate Key ở vòng lặp Map. |

## Nhóm 5: Bước 2 - Chọn Tầm Giá (TC_OB_041 - TC_OB_050)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_041** | Hiển thị Dải giá | Tới Bước 2 | API đổ ra các Option (Dưới 5tr, 5-10tr, Trên 20tr...). |
| **TC_OB_042** | Tính chất Single Select | Bấm "Dưới 5tr", rồi bấm "Trên 20tr" | Mất tick ở 5tr, chỉ giữ tick ở 20tr. (Biến state lưu string, không phải array). |
| **TC_OB_043** | Huỷ chọn (Toggle Off) | Đang tick "Trên 20tr", bấm lại nó | Mất tick luôn, state thành `null`. |
| **TC_OB_044** | Không bắt buộc | Không tick dải giá nào, bấm "Tiếp" | Vẫn qua Bước 3. |
| **TC_OB_045** | Giao diện Grid lớn | Nhìn CSS của Bước 2 | Dùng class `ob-grid-2` (width to hơn thẻ bình thường) để text giá không bị rớt dòng. |
| **TC_OB_046** | Lưu State tầm giá | Bấm "5-10tr", qua B3, Back lại B2 | Vẫn còn tick ở "5-10tr". |
| **TC_OB_047** | Thử hack Multi-select | Cố bấm 2 nút dải giá cùng lúc | Do React state là scalar, không thể giữ 2 giá trị. |
| **TC_OB_048** | Text Title B2 | Nhìn Title | Hiện "Tầm giá bạn thường mua?". |
| **TC_OB_049** | Text Hint B2 | Nhìn Hint | Hiện "Chọn một · bấm lại để bỏ chọn". |
| **TC_OB_050** | CSS Chip on | Bấm vào nút dải giá | Nền thẻ chuyển màu đen/trắng (inverted) theo Theme. |

## Nhóm 6: Bước 3 - Không quan tâm (Danh mục) (TC_OB_051 - TC_OB_060)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_051** | Tiêu đề Bước 3 | Nhìn thẻ h2 | Hiện "Có gì bạn KHÔNG muốn thấy?". |
| **TC_OB_052** | Lọc danh mục để ghét | Bước 0 tick "Laptop". Tới Bước 3 | "Laptop" **không được xuất hiện** trong danh sách có thể ghét. (Tránh logic chọi nhau: Vừa thích vừa ghét). |
| **TC_OB_053** | Tick chọn danh mục ghét | Bấm vào thẻ "Đồng hồ" (Chưa thích ở B0) | Thẻ chuyển màu Đỏ nhạt, hiện dấu X thay vì dấu V (`✕`). |
| **TC_OB_054** | Huỷ danh mục ghét | Bấm lại thẻ "Đồng hồ" | Mất màu đỏ, mất dấu X. |
| **TC_OB_055** | Dọn rác khi thay đổi B0 | B3 tick ghét "Đồng hồ". Back về B0 tick thích "Đồng hồ". Sang B3 | "Đồng hồ" biến mất khỏi B3, mảng `dislikedCats` ngầm bị xoá đi id này. |
| **TC_OB_056** | Chọn nhiều danh mục ghét | Tick ghét 3 danh mục khác nhau | Array nhận đủ 3 ID. |
| **TC_OB_057** | Giao diện nút Ghét | Hover chuột vào nút ghét | Border màu đỏ (`var(--no)`). |
| **TC_OB_058** | Trạng thái rỗng B3 Cat | Nếu B0 tick HẾT toàn bộ Danh mục | Dòng "Nhóm hàng" ở B3 hoàn toàn biến mất (Không còn gì để ghét). |
| **TC_OB_059** | Cấu trúc Header | Nhìn dòng group | Chữ "Nhóm hàng" hiển thị dạng Uppercase, mờ nhỏ ở trên. |
| **TC_OB_060** | Khả năng bỏ qua B3 | B3 không tick gì | Nút "Hoàn tất" vẫn bấm được. |

## Nhóm 7: Bước 3 - Không quan tâm (Hãng) (TC_OB_061 - TC_OB_070)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_061** | Lọc Hãng để ghét | B0 chọn "Điện thoại". B1 chọn thích "Apple" | Ở B3, hãng Apple **không hiện ra** để ghét. Hãng "Samsung" (thuộc Phone nhưng chưa thích ở B1) sẽ hiện ra để ghét. |
| **TC_OB_062** | Chỉ hiện hãng của DM thích | B0 chọn "Phone", KHÔNG chọn "Laptop". Tới B3 | Các hãng của Laptop (Dell, Asus) **Tuyệt đối không hiện** ở mục Hãng ghét. (Server không cần biết user ghét Dell vì họ đã không chọn Laptop từ B0). |
| **TC_OB_063** | Tick chọn Hãng ghét | Bấm tick ghét Samsung | Thẻ Samsung lên màu Đỏ, có dấu X. |
| **TC_OB_064** | Gỡ bỏ hãng ghét | Bấm lại Samsung | Mất màu đỏ. |
| **TC_OB_065** | Trạng thái rỗng B3 Brand | Nếu ở B1 tick hết tất cả các Hãng của danh mục | Mục "Hãng" ở B3 hoàn toàn biến mất vì không còn hãng thừa nào. |
| **TC_OB_066** | Đổi ý từ B1 | B3 tick ghét Samsung. Về B1 tick Thích Samsung. Trở lại B3 | Samsung biến mất ở B3, mảng `dislikedBrands` tự dọn rác. |
| **TC_OB_067** | Text Subgroup | Nhìn Title nhóm Hãng | Ghi: "Hãng — trong những nhóm bạn quan tâm". |
| **TC_OB_068** | Thay đổi Danh mục B0 | B3 đang ghét "Samsung". Về B0 xoá "Điện thoại". Quay lại B3 | Samsung biến mất luôn khỏi list Hãng ghét vì Danh mục cha của nó không còn được theo dõi. |
| **TC_OB_069** | Giao diện Không bắt buộc | Không tick hãng ghét nào | Vẫn Submit được bằng nút Hoàn tất. |
| **TC_OB_070** | Khối lượng thẻ lớn | API đổ 50 hãng chưa thích ra | Thẻ dàn theo Grid, scroll dọc trang web tự động dài ra, không vỡ card. |

## Nhóm 8: Quá trình Lưu dữ liệu (Submit) (TC_OB_071 - TC_OB_080)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_071** | Bấm Hoàn tất | Bấm nút "Hoàn tất" ở cuối B3 | Nút đổi tên thành "Đang lưu…", bị disabled chặn click đúp. |
| **TC_OB_072** | Lưu thành công | Fake API response HTTP 200 | Hiện message xanh: "Đã lưu sở thích...", tự động redirect về trang chủ `/`. |
| **TC_OB_073** | Lưu thất bại (Lỗi Server 500) | Fake API response HTTP 500 | Hiện message đỏ: "Không lưu được". Nút "Đang lưu..." trở về "Hoàn tất" và sáng lên lại. |
| **TC_OB_074** | Lưu thất bại (Rớt mạng) | F12 Tắt Wifi -> Bấm Hoàn tất | Bắt được try/catch, báo lỗi, không kẹt trạng thái Loading vĩnh viễn. |
| **TC_OB_075** | Block điều hướng | Trong 1 giây chữ "Đang lưu...", bấm Back trên menu | (Tuỳ logic) nhưng Component Unmount sẽ không văng lỗi Memory Leak. |
| **TC_OB_076** | Component unmount an toàn | Bấm Hoàn tất rồi vội vàng gõ URL tay sang trang khác | React không bắn lỗi `Can't perform a React state update on an unmounted component` (Do không set `setSaving(false)` nếu đã unmount). |
| **TC_OB_077** | Message Toast | Check góc phải trên màn hình | Popup Message của AntD hiện đủ thời gian rồi lặn. |
| **TC_OB_078** | Refresh sau khi lưu | Sau khi redirect về Home, F5 lại trang | Không còn bị đẩy ngược vào Onboarding nữa. |
| **TC_OB_079** | Spam click | Nhấp chuột 10 lần cực nhanh vào nút Hoàn tất | Chỉ có duy nhất 1 API `POST /preferences` bắn lên Network. |
| **TC_OB_080** | Nút Bỏ qua trong lúc lưu | Bấm Hoàn tất rồi bấm Bỏ qua | Nút Bỏ qua có thể bị vô hiệu hoặc API skip đè lên API save (Cần test kỹ Race condition). |

## Nhóm 9: Payload Dữ liệu chuẩn xác (Data Integrity) (TC_OB_081 - TC_OB_090)
Mục tiêu: Soi Network Payload gửi lên Server đảm bảo Backend không dính "rác".

| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_081** | `liked_categories` | Chỉ tick Phone, Laptop | Payload gửi lên mảng chứa đúng 2 chuỗi ID. |
| **TC_OB_082** | `liked_brands` dọn rác | Hack React devtools nhét ID hãng Dell vào `likedBrands` dù không chọn Laptop. Bấm Save. | Hàm `finish()` dùng `allowed` filter cắt bỏ Dell trước khi gửi. Mảng gửi lên không có Dell. |
| **TC_OB_083** | `price_band` rỗng | Không chọn giá | Gửi lên `price_band: null`. |
| **TC_OB_084** | `price_band` có data | Chọn dải giá ID=2 | Gửi lên `price_band: 2` (Số hoặc chuỗi tuỳ DB). |
| **TC_OB_085** | `disliked_categories` dọn rác | Hack State nhét ID Phone vào mảng Ghét (Dù Phone đang ở mảng Thích). Bấm Save. | Hàm `finish()` tự filter cắt ID Phone ra khỏi mảng Ghét. Mảng gửi lên sạch. |
| **TC_OB_086** | `disliked_brands` dọn rác 1 | Hack nhét ID Apple vào Ghét (Dù Apple đang ở Thích). | Bị filter loại bỏ khỏi mảng gửi đi. |
| **TC_OB_087** | `disliked_brands` dọn rác 2 | Hack nhét ID Dell (Hãng của Laptop) vào Ghét (Dù không tick thích Laptop). | Bị filter loại bỏ khỏi mảng gửi đi (Vì không nằm trong `allowed`). |
| **TC_OB_088** | Kiểu dữ liệu | Kiểm tra Content-Type HTTP | Bắn lên `application/json`, cấu trúc đúng JSON Object. |
| **TC_OB_089** | Security Token | Check Header HTTP | Bắn lên kèm Header `Authorization: Bearer <Token>`. |
| **TC_OB_090** | Response Data | Server phản hồi | Trả về Status code 200/201 kèm JSON Object thông tin lưu thành công. |

## Nhóm 10: Nút Bỏ qua (Skip) & Navigation (TC_OB_091 - TC_OB_100)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_091** | Nút Bỏ qua bước 0 | Bấm Bỏ qua ngay khi vừa vào trang | API `skipOnboarding()` được gọi, redirect thẳng về `/`. Không cản trở mua sắm. |
| **TC_OB_092** | Nút Bỏ qua bước 3 | Đi đến B3 rồi đổi ý bấm Bỏ qua | Vẫn skip thành công, không lưu data dang dở. |
| **TC_OB_093** | Lỗi API Skip | Fake API `skipOnboarding` bị sập 500 | Giao diện **Vẫn redirect** về `/` (Code ghi `catch { /* bỏ qua lỗi */ }`). Trải nghiệm người dùng là trên hết. |
| **TC_OB_094** | Quên ấn Hoàn tất | Khách đang làm khảo sát giữa chừng thì tắt trình duyệt | Mọi thao tác mất hết. Lần tới đăng nhập lại bị đẩy vào trang Onboarding. |
| **TC_OB_095** | Rê chuột nút Skip | Hover vào "Bỏ qua" | Text gạch chân mượt, không đổi màu lố. |
| **TC_OB_096** | Nút Quay lại B1 | Ở B1 bấm Quay lại | Về B0, state không mất. |
| **TC_OB_097** | Đóng gói URL | Copy link `/onboarding` gửi bạn bè | Bạn bè chưa login, bấm vào văng về Trang chủ (Guard component hoạt động). |
| **TC_OB_098** | Nút Next khi đang Save | Nút Next ẩn đi ở Step cuối (Đổi thành Hoàn tất) | Đảm bảo không tồn tại cùng lúc 2 nút Tiến và Hoàn tất. |
| **TC_OB_099** | Flow Button | Kiểm tra vị trí cụm Nút "Tiến", "Lùi" | Luôn cố định bên góc Phải dưới (Gần tay cầm chuột / ngón cái đt nhất). |
| **TC_OB_100** | Lịch sử trình duyệt | Khách bấm Next Next, rồi bấm Nút Back CỦA TRÌNH DUYỆT | Sẽ văng ra khỏi `/onboarding` hoàn toàn (Vì các Step React không lưu vào History API HTML5). |

## Nhóm 11: Dark Mode & Theming (TC_OB_101 - TC_OB_110)
Mục tiêu: Thử nghiệm Object hằng số `T` (Theme).

| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_101** | Background Light | Bật Light Mode | Nền sau Card màu xám nhạt `#f4f4f5`, Card màu trắng `#fff`. |
| **TC_OB_102** | Background Dark | Bật Dark Mode | Nền sau màu đen `#0b0b0d`, Card màu xám đen `#141417`. |
| **TC_OB_103** | Chữ Text chính (Foreground)| Nhìn Tiêu đề | Light -> Đen (`#0a0a0a`), Dark -> Trắng (`#fafafa`). |
| **TC_OB_104** | Text phụ (Subtitle) | Nhìn các chữ nhạt | Dùng mã màu xám `#71717a` hoặc `#8f8f99` tuỳ theme. Đảm bảo tỷ lệ WCAG contrast > 4.5. |
| **TC_OB_105** | Border và Line | Nhìn đường phân cách dưới Header | Nét kẻ mỏng, màu viền nhẹ nhàng, không chói. |
| **TC_OB_106** | Chip lúc Tắt | Nhìn Card thẻ chưa chọn | Background là màu thẻ `#card`, viền màu đường Line. |
| **TC_OB_107** | Chip lúc Bật (Invert) | Tick chọn Card | Theme Light -> Card biến thành màu Đen. Theme Dark -> Card biến thành màu Trắng. Giúp thị giác cực kỳ nổi bật (Biến `--inv`). |
| **TC_OB_108** | Nút Tiếp/Hoàn tất | Nhìn CSS Nút chính | Cũng dùng biến `--inv` (Màu đảo ngược) hệt như Chip để đồng bộ ngôn ngữ thiết kế. |
| **TC_OB_109** | Chip màu Đỏ (Ghét) | Ở Bước 3, tick ghét | Background rỗng, nhưng viền và chữ chuyển Đỏ `#no`. |
| **TC_OB_110** | Trạng thái Disabled | Nút Tiếp bị mờ | Có CSS `opacity: 0.35` và cursor cấm (`not-allowed`). |

## Nhóm 12: Trợ năng (Accessibility & Keyboard) (TC_OB_111 - TC_OB_120)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_111** | Thẻ Button Chip | Inspect element thẻ Chip | Các tuỳ chọn dùng thẻ `<button>` thay vì `<div>` (Có sẵn tính năng keyboard). |
| **TC_OB_112** | `aria-pressed` | Inspect thẻ Chip đang tick | Phải có thuộc tính `aria-pressed="true"`. |
| **TC_OB_113** | Phím Tab qua các Chip | Nhấn phím `Tab` | Vòng focus ring bao quanh lần lượt các Chip từ trái sang phải, trên xuống dưới. |
| **TC_OB_114** | Phím Spacebar để Tick | Đang focus vào "Laptop", nhấn Space | Chip "Laptop" chuyển sang trạng thái đã chọn. |
| **TC_OB_115** | Phím Enter để Tick | Đang focus vào Chip, nhấn Enter | Tương đương Spacebar, toggle bật/tắt. |
| **TC_OB_116** | Bỏ qua Nav Keyboard | Tab tới nút "Bỏ qua", nhấn Enter | Đóng form, nhảy về trang chủ. |
| **TC_OB_117** | Tab Order | Nhấn Tab từ đầu trang tới cuối | Thứ tự nhảy: Nút Bỏ qua -> Nút Quay Lại -> Các Chip chọn -> Nút Tiếp. Phải hợp logic từ trên xuống. |
| **TC_OB_118** | Đọc Tooltip Screen Reader | Bật VoiceOver | Trình đọc đọc đúng "Bước 1 trên 4, Chọn danh mục...". |
| **TC_OB_119** | Dấu X và V trên Chip | Ký tự `✓` và `✕` | Các ký hiệu dùng mã ASCII hoặc icon font, không ảnh hưởng text chính, tránh bị đọc là "dấu x ích xì...". |
| **TC_OB_120** | Focus Trap | Có giam focus lại trong popup không? | Đây là Full page, không phải Modal nên focus cứ nhảy hết HTML là được. |

## Nhóm 13: Edge Cases & Kịch bản dị thường (TC_OB_121 - TC_OB_130)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_121** | Hack đổi ID DOM | F12 sửa ID danh mục từ `cat-phone` thành `cat-fake`. Bấm chọn. | React map data array chứ không bốc từ DOM, nên không lưu ID `fake` vào state được. |
| **TC_OB_122** | Màn hình cực hẹp | Bóp cửa sổ trình duyệt xuống < 280px (Galaxy Fold cover screen) | Component thu hẹp, các chữ trong chip có thể rớt dòng nhưng không tràn ra ngoài viền Card. |
| **TC_OB_123** | Màn hình siêu dài | Test trên Tivi dọc | Khối `<div class="ob-card">` nằm cân giữa màn hình theo cả chiều dọc lẫn ngang (Nhờ flex/grid center). |
| **TC_OB_124** | Dữ liệu rác từ DB | API trả về danh mục tên cực dài (1000 chữ) | Thẻ Chip tự động phình to, text tự xuống dòng, hoặc cắt bằng ellipsis tuỳ CSS. |
| **TC_OB_125** | DB trả về mảng `null` | Mock response API sửa `categories: null` | JS map văng lỗi `Cannot read properties of null (reading 'map')`. Component sập trắng. (Nên bắt Fallback ErrorBoundary). |
| **TC_OB_126** | User Name siêu dài | Account tên "Công Tằng Tôn Nữ abcxyz siêu dài" | Kicker "Chào dài 👋" vẫn nằm gọn trên 1 dòng. |
| **TC_OB_127** | Double click nút Tiếp | Nhấp đúp chuột siêu nhanh nút Tiếp ở Bước 0 | Chỉ nhảy sang Bước 1. Tránh bug nhảy vọt lố lên Bước 2. |
| **TC_OB_128** | Cookie Session bị xoá | Xoá JWT Token trong LocalStorage khi đang ở Bước 2. Bấm "Tiếp" | Giao diện vẫn cho qua B3 (vì React chạy local), nhưng khi Submit "Hoàn tất", API sẽ ném lỗi 401 Unauthorized. |
| **TC_OB_129** | API Option chậm 10 giây | Throttling tốc độ mạng xuống 1kbps | Cửa sổ load vòng xoay `Spin` đủ 10 giây. Không timeout sớm. |
| **TC_OB_130** | Data Brand không map | Danh mục không khớp ID Brand trong `brandsByCategory` | Ứng dụng chạy bth, trả về mảng rỗng và hiển thị "Chưa có hãng nào...". |

## Nhóm 14: Ảnh hưởng ngầm tới AI System (Data Validation) (TC_OB_131 - TC_OB_140)
Mục tiêu: Đảm bảo Data thu thập được thực sự có ích cho LakeHouse & AI Model.
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_131** | User Profile Update | Kiểm tra Database | Cột `preferences` trong bảng User được cập nhật cục JSON thay vì Null. |
| **TC_OB_132** | AI Retrain Trigger | Nếu Kafka/ClickHouse có lắng nghe sự kiện | Sự kiện `PREFERENCE_UPDATED` bắn vào Kafka topic `user-events`. |
| **TC_OB_133** | Xung đột Weight AI | Xem kết quả list mảng Ghét (Dislike) | Đảm bảo mảng Dislike không bao giờ đè lên mảng Like, giúp vector embedding không bị bối rối khi tính Cosine Similarity. |
| **TC_OB_134** | Price Band Embedding | Lưu ID Price Band | AI script có thể map ID này (vd: `id: 1` = `< 5tr`) vào khoảng số thực (0-5,000,000) để filter. |
| **TC_OB_135** | Mức độ đa dạng | User chọn quá 10 danh mục | (Nếu hệ thống không giới hạn) thì AI sẽ gặp nhiễu (noise) -> Đề xuất nên giới hạn max 5 danh mục nếu AI thấy cần. Hiện tại cho phép thả phanh. |
| **TC_OB_136** | Hành vi "Skip" (Bỏ qua) | Lưu status `is_onboarded = true` nhưng `preferences = null` | Tránh việc vòng lặp bắt user nhập mãi. AI buộc phải fallback về thuật toán "Best Seller" hoặc "Trending". |
| **TC_OB_137** | Cập nhật lần 2 | Về trang Profile ấn nút sửa sở thích. Lưu lại lần 2. | Cục JSON cũ trong DB bị chép đè. Ngày `updated_at` nhảy số mới. |
| **TC_OB_138** | Data Typo (Lỗi chính tả ID) | Gửi lên 1 mảng ID không nằm trong list API cung cấp | DB Postgres vẫn lưu chuỗi string bình thường (JSONB), nhưng AI Python query sẽ không join được với bảng thật -> Bỏ qua rác an toàn. |
| **TC_OB_139** | Brand lặp lặp | Gửi mảng `["apple", "apple"]` | DB có thể lưu lặp. Tuy code frontend đã khử trùng, nhưng nên test nếu POST thẳng qua Postman. |
| **TC_OB_140** | Thời gian phản hồi DB | Thời gian lưu 1 cục JSONB vào Postgres | Phải < 50ms, cực nhanh do không ràng buộc khoá ngoại phức tạp. |

## Nhóm 15: Sau Khảo sát & Thay đổi Real-time (TC_OB_141 - TC_OB_150)
| ID | Kịch bản kiểm thử | Hành động | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **TC_OB_141** | Redirect về Trang chủ | Lưu xong, redirect về `/` | Giao diện Trang chủ hiện ra ngay. |
| **TC_OB_142** | Gợi ý Thay đổi tức thời (Cold-start AI) | Khảo sát chọn "Laptop" & "Dell". Xem dải sản phẩm "Gợi ý cho bạn" ở Home. | Danh sách SP đổ ra tràn ngập Laptop Dell, đá đít bọn Ốp lưng ra rìa. AI Hybrid phát huy tác dụng. |
| **TC_OB_143** | Kiểm tra SP bị Ghét | Ở khảo sát đánh dấu ghét "Đồng hồ" | Tuyệt nhiên không thấy "Apple Watch" nào xuất hiện ở trang chủ. |
| **TC_OB_144** | Gợi ý Sai Tầm giá | Ở khảo sát chọn giá "< 5 triệu". Xem sản phẩm. | Vẫn có rải rác vài SP 6 triệu (do AI tính sai số lân cận - tuỳ model), nhưng tuyệt đối không đẩy iPhone 30 triệu lên đầu. |
| **TC_OB_145** | Khách không thấy nút Đăng xuất do Onboarding đè | Đang ở `/onboarding`, muốn thoát acc | Trong trang onboarding không có Header. Buộc phải "Bỏ qua" để ra ngoài mới có nút Logout. |
| **TC_OB_146** | Dấu vết ở Admin | Tài khoản Admin soi User này | Admin sẽ thấy profile user này ghi nhận đã "Completed Onboarding". |
| **TC_OB_147** | Refresh Browser ngay trang chủ | F5 trang chủ `/` | AI Recommendation API được gọi lại với `user_id` hiện tại, lấy ra kết quả gợi ý mới nhất. |
| **TC_OB_148** | Xoá toàn bộ Sở thích từ Profile | Khách vào Profile xoá sạch checkbox | JSON cập nhật mảng rỗng `[]`. |
| **TC_OB_149** | Fallback Gợi ý sau khi Xoá | Ra lại Trang chủ | "Gợi ý cho bạn" đổ về hàng "Bán chạy nhất" hoặc "Mới nhất". |
| **TC_OB_150** | Cache Clickhouse (Trễ dữ liệu) | Nếu AI Service dùng Redis cache 10 phút | Khách sẽ chưa thấy kết quả đổi ngay lập tức ở Trang Chủ (Cần kiểm tra xem Cache Invalidate có được gọi khi bắn API `saveMyPreferences` không). |

---
**Tóm tắt:** 
150 Test Cases này vét sạch sành sanh mọi góc nhìn từ: *Khách hàng lóng ngóng (UI/UX) -> Kẻ tấn công sửa data (Security Payload) -> Kiến trúc sư AI (Lakehouse Data Integrity).*
