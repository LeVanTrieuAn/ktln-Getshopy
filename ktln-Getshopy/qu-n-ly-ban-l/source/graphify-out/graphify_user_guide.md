# Tài liệu sử dụng Graphify Knowledge Graph Viewer
> **Phiên bản Enhanced** — `graph_enhanced.html`  
> Dự án: Khoá luận tốt nghiệp — Getshopy Ecommerce System  
> Codebase: 1.421 nodes · 2.416 edges · 90 communities

---

## Mục lục
1. [Tổng quan](#1-tổng-quan)
2. [Khởi động viewer](#2-khởi-động-viewer)
3. [Điều hướng 3D](#3-điều-hướng-3d)
4. [Thanh công cụ trên (Topbar)](#4-thanh-công-cụ-trên-topbar)
5. [Sidebar trái — Search & Node Info](#5-sidebar-trái--search--node-info)
6. [Sidebar phải — Communities & Edge Filter](#6-sidebar-phải--communities--edge-filter)
7. [Hiểu đồ thị: Nodes, Edges, Màu sắc](#7-hiểu-đồ-thị-nodes-edges-màu-sắc)
8. [Tính năng nâng cao](#8-tính-năng-nâng-cao)
9. [Tối ưu hiệu suất](#9-tối-ưu-hiệu-suất)
10. [Ứng dụng cho Khoá luận](#10-ứng-dụng-cho-khoá-luận)

---

## 1. Tổng quan

**Graphify** là công cụ phân tích codebase bằng đồ thị tri thức (Knowledge Graph). Nó dùng AST (Abstract Syntax Tree) để:
- Trích xuất toàn bộ **hàm, class, module** từ source code
- Xây dựng **mạng quan hệ** giữa chúng (calls, imports, inherits, v.v.)
- Phát hiện **cộng đồng** (community = nhóm code liên quan chặt)
- Tìm ra **God Nodes** — các node trung tâm có nhiều kết nối nhất

### Cấu trúc dự án Getshopy trong graph

| Layer | Prefix | Màu | Mô tả |
|---|---|---|---|
| **Frontend** | `client/` | 🔵 Xanh dương | React app — pages, components, hooks, contexts |
| **Backend** | `server/` | 🟠 Cam | Express API — routes, services, middleware |
| **AI Rec** | `ai-rec/` | 🟢 Xanh lá | Collaborative Filtering recommendation service |
| **AI Bot** | `ai-bot/` | 🟢 Xanh nhạt | Chatbot NLP handlers (Hugging Face) |
| **Scripts** | *khác* | 🩷 Hồng | Config files, benchmarks, utilities |

---

## 2. Khởi động viewer

### Yêu cầu
- Python 3.x (đã cài sẵn trên máy)
- Trình duyệt Chrome/Edge/Firefox hiện đại

### Các bước

**Bước 1:** Mở terminal trong thư mục `graphify-out/`
```powershell
cd d:\khóa-luận-tốt-nghiệp\ktln-Getshopy\qu-n-ly-ban-l\source\graphify-out
py -m http.server 8080
```

**Bước 2:** Mở trình duyệt và truy cập
```
http://localhost:8080/graph_enhanced.html
```

**Bước 3:** Đợi loading screen biến mất (khoảng 3–8 giây tuỳ cấu hình máy)

> [!NOTE]
> Không được mở file `graph_enhanced.html` trực tiếp bằng cách double-click. Trình duyệt sẽ chặn `fetch()` do CORS policy. Phải dùng HTTP server.

> [!TIP]
> Giữ terminal mở khi dùng. Để tắt server nhấn `Ctrl+C`.

---

## 3. Điều hướng 3D

| Thao tác | Hành động |
|---|---|
| **Drag trái** (trên nền) | Xoay toàn bộ đồ thị |
| **Scroll wheel** | Zoom in/out |
| **Drag phải** | Pan (dịch chuyển) |
| **Click node** | Mở Node Info ở sidebar trái |
| **Hover node** | Hiện tooltip (tên, file, community, degree) |
| **Click nền** | Bỏ chọn node hiện tại |
| **Drag node** | Kéo node đến vị trí khác |

> [!IMPORTANT]
> Sau khi physics simulation **tự dừng** (~10–15 giây), bạn vẫn drag/zoom/xoay bình thường. Nút `▶` trên topbar xác nhận physics đã dừng.

---

## 4. Thanh công cụ trên (Topbar)

### 4.1 Layer Filter (Lọc theo tầng kiến trúc)

```
[ All ] [ 🖥 Frontend ] [ ⚙ Backend ] [ 🤖 AI ] [ 📜 Scripts ]
```

- Nhấn **một** nút để chỉ hiện nodes của tầng đó
- Nhấn **All** để hiện toàn bộ
- Layer filter **không xoá** graph, chỉ ẩn tạm — chuyển lại All là mọi thứ hiện ra

**Dùng khi nào:**
- Muốn focus vào Backend mà không bị frontend/AI làm nhiễu
- Kiểm tra xem AI module có phụ thuộc vào frontend không (nếu có edge từ ai-rec ra client → bất thường)

---

### 4.2 Detail Level (Mức độ chi tiết)

```
[ ⚡ Fast ] [ Normal ] [ 🔍 Full ]
```

| Mode | Nodes hiển thị | Edges ẩn | Số node ước tính |
|---|---|---|---|
| **⚡ Fast** | degree ≥ 2 | contains, rationale_for, indirect_call | ~938 |
| **Normal** | degree ≥ 1 | rationale_for | ~1.350 |
| **🔍 Full** | Tất cả | Không ẩn gì | 1.421 |

> [!TIP]
> Mặc định là **Fast** để đảm bảo hiệu suất. Chuyển sang **Full** khi cần kiểm tra isolated nodes (nodes không kết nối với ai) hoặc xem `contains` relationships.

---

### 4.3 Path Finder (Tìm đường ngắn nhất)

```
Path: [From node…] → [To node…] [Find] [✕]
```

**Cách dùng:**
1. Gõ tên node vào ô **From** (hỗ trợ autocomplete)
2. Gõ tên node vào ô **To**
3. Nhấn **Find**
4. Đường ngắn nhất sẽ được highlight màu **vàng gold** trên đồ thị
5. Kết quả hiện bên trên canvas: `Path (N hops): A → B → C → ...`
6. Nhấn **✕** để xoá highlight

**Ví dụ thực tế:**
```
From: CartContext  →  To: CFModelService
```
→ Tìm xem Cart context liên quan thế nào đến AI recommendation

```
From: CollaborativeFiltering  →  To: checkPaymentConfig
```
→ Xem có path nào nối AI Rec sang Payment module không

> [!NOTE]
> Path Finder dùng thuật toán **BFS (Breadth-First Search)** trên đồ thị vô hướng. Nếu không tìm thấy path, hai nodes đó hoàn toàn tách rời.

---

### 4.4 Physics Controls

| Nút | Chức năng |
|---|---|
| **⏸ / ▶** | Pause/Resume physics simulation |
| **⊡** | Fit All — zoom về để nhìn toàn bộ graph |
| **☰** | Toggle/đóng Community panel bên phải |

> [!TIP]
> Nhấn **⊡ Fit All** bất cứ lúc nào nếu bạn bị lạc khi zoom quá sâu.

---

## 5. Sidebar trái — Search & Node Info

### 5.1 Tab Search

**Tìm kiếm node:**
- Gõ tên hàm, class hoặc file path
- Kết quả hiện ngay theo realtime (max 25 kết quả)
- Click kết quả → camera tự động fly đến node đó trên đồ thị
- Mỗi kết quả hiện: `● Tên node` + `tên file`

**Tips tìm kiếm:**
- Tìm `useCart` → tìm hook
- Tìm `payment` → tìm tất cả functions liên quan payment
- Tìm `ai-rec/api` → tìm tất cả nodes trong file đó

---

### 5.2 Tab Node Info

Hiện sau khi **click một node** trên đồ thị (hoặc click kết quả search).

**Thông tin hiển thị:**

| Trường | Ý nghĩa |
|---|---|
| **Tên node** | Tên hàm/class/module (monospace) |
| **Layer badge** | Tầng kiến trúc (client/server/ai-rec...) |
| **Community badge** | Nhóm cộng đồng (#ID + tên) |
| **File** | Đường dẫn file nguồn + nút ⧉ copy |
| **Line** | Dòng trong file (ví dụ: `L245`) |
| **Degree** | Số lượng kết nối trực tiếp |
| **Connections** | Danh sách các nodes kết nối, kèm chiều (`→`/`←`) và loại quan hệ |

**Nút ⧉ Copy path:**
- Nhấn ⧉ bên cạnh đường dẫn file để copy vào clipboard
- Dùng để mở file trong VS Code: `Ctrl+P` → paste path

**Danh sách Connections:**
- `→ TênNode [calls]` — node này gọi TênNode
- `← TênNode [imports]` — TênNode import node này
- Click vào connection → camera fly đến node đó

---

## 6. Sidebar phải — Communities & Edge Filter

### 6.1 Community Panel

**90 communities** được phát hiện tự động bằng thuật toán **Louvain modularity clustering**.

**Các thao tác:**
- **Tìm community:** Gõ vào ô tìm kiếm phía trên
- **Show All / Hide All:** Hiện hoặc ẩn toàn bộ communities
- **Click từng community:** Toggle hiện/ẩn community đó
- Số bên phải mỗi community = số nodes trong community đó

**Giải thích community:**
- Nodes cùng màu = cùng community
- Community tên theo file/class trung tâm nhất của nhóm (ví dụ: `CFModelService`, `CartContext`)
- Community lớn (nhiều nodes) = module phức tạp

> [!TIP]
> Ẩn tất cả communities rồi bật từng cái để xem từng module riêng biệt. Đây là cách tốt nhất để hiểu kiến trúc module-by-module.

---

### 6.2 Edge Filter (Lọc loại quan hệ)

Ẩn/hiện từng loại quan hệ giữa các nodes:

| Loại edge | Màu | Ý nghĩa |
|---|---|---|
| `calls` | ⬜ Trắng đậm | Hàm A gọi hàm B trực tiếp |
| `imports` | 🔵 Xanh dương | File A import module/class từ file B |
| `imports_from` | 🔵 Xanh nhạt | `import { X } from 'B'` |
| `inherits` | 🩷 Hồng đậm | Class A kế thừa class B |
| `uses` | 🟠 Cam | A sử dụng/tham chiếu B (lỏng hơn calls) |
| `references` | 🟣 Tím | A tham chiếu tên B (không gọi trực tiếp) |
| `contains` | ⬜ Trắng mờ | File/class chứa hàm/method |
| `rationale_for` | ⬚ Xám mờ | Mối quan hệ rationale (từ LLM) |
| `method` | 🩷 Hồng nhạt | B là method của class A |
| `indirect_call` | ⬜ Trắng rất mờ | Gọi gián tiếp qua callback/event |
| `dynamic_import` | 🔵 Xanh rất nhạt | `import()` dynamic |
| `re_exports` | 🔵 Xanh rất nhạt | `export { X } from 'B'` |

**Mặc định ẩn:** `contains`, `rationale_for`, `indirect_call` (để giảm nhiễu và lag)

**Khi nào bật contains:**
- Muốn xem cấu trúc internal của một file/class
- Hiểu file nào chứa những hàm nào

---

## 7. Hiểu đồ thị: Nodes, Edges, Màu sắc

### Nodes (Điểm)

| Kích thước | Ý nghĩa |
|---|---|
| **Lớn** | Degree cao — node này có nhiều kết nối = quan trọng |
| **Nhỏ** | Degree thấp — utility function hoặc isolated |
| **Màu trắng** | Node đang được chọn (click) |
| **Màu vàng** | Node trong path highlight |
| **Màu tối** | Node ngoài path (khi đang highlight path) |

### God Nodes (Nodes quan trọng nhất)

Đây là các nodes có degree rất cao, thể hiện sự phụ thuộc trung tâm:

| Node | Degree | Layer | Vai trò |
|---|---|---|---|
| `CollaborativeFiltering` | ~35 | AI-Rec | Toàn bộ CF model xoay quanh class này |
| `CFModelService` | ~25 | AI-Rec | Service layer của AI recommendation |
| `removeDiacritics()` | ~20 | Server | Dùng xử lý tiếng Việt khắp nơi |
| `.push()` | ~20 | Server | ConversationQueue method |
| `CartContext` | ~18 | Client | Context chứa toàn bộ state giỏ hàng |

### Edges (Cạnh)

- **Mũi tên** chỉ chiều (`calls`, `imports`, `inherits`) — có nghĩa quan trọng
- **Không mũi tên** — quan hệ symmetric hoặc ít quan trọng
- **Độ dày** edge = mức độ trọng số của quan hệ
- **Vàng gold** = đường path highlight

---

## 8. Tính năng nâng cao

### 8.1 Workflow phân tích kiến trúc

**Kịch bản: Tôi muốn hiểu luồng đặt hàng**

1. Mở Search → gõ `order`
2. Xem các nodes liên quan: `placeOrder`, `handleCancelOrder`, `OrderService`, v.v.
3. Click `placeOrder` → xem Node Info → xem Connections
4. Dùng Path Finder: `CartContext → checkPaymentConfig` → xem full flow
5. Filter Layer = `server` → chỉ xem backend của luồng này

---

**Kịch bản: Tôi muốn hiểu AI Recommendation**

1. Filter Layer = `🤖 AI`
2. Nhìn tổng quan: 2 clusters chính — `ai-rec` (CF model) và `ai-bot` (chatbot)
3. Click `CollaborativeFiltering` → xem 35 connections
4. Path Finder: `SparseUserItemMatrix → CFModelService`
5. Bật Edge `inherits` → xem class hierarchy của CF model

---

**Kịch bản: Tìm circular dependency**

1. Detail Level → `🔍 Full`
2. Edge Filter → chỉ bật `imports` và `imports_from`
3. Tìm node nào vừa có `→` vừa có `←` từ cùng một file

---

### 8.2 Minimap (Góc dưới phải)

- Hiện vị trí tất cả nodes theo 2D projection
- Màu = layer của node
- Cập nhật theo Community/Layer filter
- Dùng để định hướng khi đang zoom sâu vào 1 cluster

### 8.3 Physics Controls nâng cao

- **⏸ Pause:** Dừng physics, giảm CPU. Drag/xoay vẫn hoạt động
- **▶ Resume:** Khởi động lại physics (nodes tiếp tục settle)
- Physics tự dừng sau ~10–15 giây → nút đổi sang `▶`

> [!NOTE]
> Sau khi physics dừng, graph ở trạng thái "frozen". Nếu bạn drag một node, nó sẽ di chuyển nhưng không kéo các nodes khác. Nhấn `▶` nếu muốn layout tự điều chỉnh lại.

---

## 9. Tối ưu hiệu suất

| Vấn đề | Giải pháp |
|---|---|
| Lag khi mới mở | Đợi 10–15s cho physics settle. Graph sẽ mượt hơn |
| Lag khi xoay | Dùng mode **⚡ Fast** (ít nodes hơn) |
| Muốn xem nhanh | Hide communities không liên quan qua panel phải |
| FPS thấp | Tắt Edge type `contains` (nhiều nhất, ít thông tin nhất) |
| Graph quá lộn xộn | Filter 1 Layer + 1–2 Communities + chỉ bật `calls`+`imports` |

**Hardware recommendations:**
- Chrome/Edge trên Windows với hardware acceleration = tốt nhất
- RAM ≥ 8GB (graph.json ~2MB, cần parse và render)
- Không dùng browser extension nặng (AdBlock heavy có thể ảnh hưởng WebGL)

---

## 10. Ứng dụng cho Khoá luận

### Sơ đồ kiến trúc

Dùng graph để **chụp màn hình** các views sau cho báo cáo:

1. **Tổng quan hệ thống:** All layers, Fast mode, Fit All → screenshot toàn bộ
2. **Frontend architecture:** Filter `Frontend`, zoom vào cluster lớn nhất
3. **Backend service diagram:** Filter `Backend`, chỉ bật `calls`+`imports`
4. **AI module:** Filter `AI`, Full detail, bật `inherits` để thấy class hierarchy
5. **Payment flow:** Path từ `CartContext` → `checkPaymentConfig`

### Viết báo cáo

**Trích dẫn từ graph (có nguồn):**
- Graphify sử dụng tree-sitter cho AST parsing — nguồn: [tree-sitter](https://tree-sitter.github.io/)
- Community detection: Louvain algorithm — nguồn: Blondel et al. (2008)
- Force-directed layout: d3-force — nguồn: Bostock et al.
- 3D rendering: 3d-force-graph (Three.js) — nguồn: [vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph)

**Những claim có thể viết trong báo cáo dựa trên graph:**

> "Hệ thống Getshopy bao gồm 1.421 symbol được trích xuất từ source code, tạo thành 90 cộng đồng phụ thuộc. God nodes chính là `CollaborativeFiltering` (35 connections) và `CFModelService` (25 connections), phản ánh vai trò trung tâm của module AI Recommendation trong kiến trúc tổng thể."

> "Phân tích dependency graph cho thấy module `ai-rec` hoạt động độc lập với frontend client — không có direct edge nào từ `client/` sang `ai-rec/`, toàn bộ giao tiếp đi qua REST API của `server/`."

### Cập nhật graph sau khi sửa code

```powershell
# Chạy lại graphify để cập nhật graph.json
cd d:\khóa-luận-tốt-nghiệp\ktln-Getshopy\qu-n-ly-ban-l\source
graphify update .

# Rồi reload lại graph_enhanced.html trong browser
```

---

## Phím tắt nhanh

| Thao tác | Cách |
|---|---|
| Reset view | Nhấn **⊡** trên topbar |
| Tìm node | Tab Search → gõ tên |
| Xem info node | Click node trên graph |
| Tìm đường | Topbar Path → From/To → Find |
| Ẩn layer | Nhấn layer button (client/server/ai/scripts) |
| Ẩn community | Sidebar phải → uncheck |
| Copy file path | Node Info → nhấn ⧉ |
| Dừng physics | Nhấn ⏸ |
| Fit toàn bộ | Nhấn ⊡ |

---

*Tài liệu này được tạo cho phiên bản `graph_enhanced.html` — Enhanced Graphify Viewer*  
*Cập nhật: 2026-09-26*
