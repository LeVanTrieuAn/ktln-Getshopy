# AI Recommendation System

Hệ thống gợi ý sản phẩm thương mại điện tử sử dụng mô hình **Item-Based Collaborative Filtering (CF)** hiệu năng cao, tối ưu hóa ma trận thưa (Sparse CSR) và phục vụ qua giao diện dòng lệnh (**CLI**) cùng **FastAPI REST API**.

---

## Cấu trúc thư mục

```text
.
├── api/                              # Dịch vụ FastAPI, schemas và endpoints
│   ├── main.py                       # Khởi tạo FastAPI app và cấu hình CORS/routes
│   ├── schemas.py                    # Pydantic schemas cho request/response
│   └── service.py                    # CFModelService quản lý vòng đời và cache model
├── config.py                         # Cấu hình đường dẫn dữ liệu và output dùng chung
├── data/                             # Thư mục chứa dữ liệu
│   └── raw/                          # Dữ liệu nguồn thương mại điện tử
│       ├── customers.csv             # Hồ sơ khách hàng (CustomerID, phân khúc, ngân sách)
│       ├── orders.csv                # Lịch sử đơn hàng (InvoiceNo, CustomerID, ProductID, Quantity,...)
│       └── products.csv              # Danh mục sản phẩm (ProductID, tên, category, brand, giá)
├── doc/                              # Tài liệu phân tích kỹ thuật và toán học chi tiết
├── models/                           # Module thuật toán AI Recommendation
│   ├── __init__.py
│   └── cf_recommendation.py          # Item-based Collaborative Filtering (Sparse CSR & Cosine Similarity)
├── output/                           # Thư mục lưu trữ mô hình sau khi huấn luyện
│   └── cf/                           # File mô hình đã nén (item_cf.joblib)
├── tests/                            # Bộ kiểm thử tự động (Unit & Integration Tests)
│   ├── test_api.py                   # Kiểm thử tích hợp toàn diện các endpoint FastAPI
│   └── test_recommender.py           # Kiểm thử đơn vị quy trình huấn luyện và gợi ý
├── Dockerfile                        # Đóng gói ứng dụng vào Docker container
├── docker-compose.yml                # Cấu hình khởi chạy nhanh qua Docker Compose
├── main.py                           # Điểm khởi chạy CLI (huấn luyện, tra cứu & gợi ý tương tác)
├── pyproject.toml                    # Metadata cấu hình dự án
├── requirements.txt                  # Danh sách thư viện phụ thuộc của dự án
└── README.md                         # Tài liệu hướng dẫn sử dụng và kiến trúc hệ thống
```

---

## Cài đặt môi trường

Yêu cầu Python 3.11–3.14. Khuyến nghị sử dụng Python 3.11 hoặc 3.12:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

---

## Dữ liệu đầu vào

Mô hình đọc dữ liệu từ thư mục `data/raw/` bao gồm 3 tệp chính:

1. **`data/raw/orders.csv`** (Dữ liệu giao dịch đơn hàng):
   ```csv
   InvoiceNo,CustomerID,CustomerName,ProductID,ProductName,Category,Subcategory,Brand,UnitPrice,Quantity,InvoiceDate
   INV183830,CUST_145340,Võ Anh Dũng,PROD_29955,Luma Máy lọc không khí...,Gia dụng,Chăm sóc không khí,Luma,2400000.0,2,2026-01-01 00:00:03
   ```
2. **`data/raw/products.csv`** (Danh mục sản phẩm):
   ```csv
   ProductID,ProductName,Category,Subcategory,Brand,ProductType,ProductDescription,FeatureTags,UnitPrice
   PROD_00001,iPhone 15 Pro Max 256GB...,Điện thoại,Sản phẩm tiêu biểu,iPhone,Điện thoại,...,31990000.0
   ```
3. **`data/raw/customers.csv`** (Hồ sơ khách hàng):
   ```csv
   CustomerID,CustomerName,CustomerSegment,ShoppingNeed,PreferredCategories,BudgetTier,PurchasePropensity
   CUST_00001,Lâm Thanh Vy,Người dùng di động,Nâng cấp điện thoại...,Điện thoại|Phụ kiện|Âm thanh,Cao cấp,1.25
   ```

---

## Huấn luyện mô hình (Training)

Mô hình tự động nạp dữ liệu giao dịch từ `data/raw/orders.csv` kết hợp thông tin sản phẩm từ `products.csv` và khách hàng từ `customers.csv`. Sau khi huấn luyện xong, toàn bộ trọng số và ma trận thưa sẽ được lưu tại `output/cf/item_cf.joblib`.

### 1. Lệnh huấn luyện (Train Command)

* **Huấn luyện mô hình từ đầu (ghi đè kết quả cũ nếu có):**
  ```bash
  python main.py --retrain
  ```

* **Huấn luyện mô hình và in ngay gợi ý mẫu cho khách hàng:**
  ```bash
  python main.py --retrain --customer-id CUST_00001 --top-k 5
  ```

* **Huấn luyện trực tiếp bằng Python Code:**
  ```python
  from models import CollaborativeFiltering

  # Khởi tạo và huấn luyện
  model = CollaborativeFiltering()
  model.train()         # Đọc tự động data/raw/ và tính toán ma trận thưa

  # Lưu mô hình vào output/cf/item_cf.joblib
  saved_path = model.save_model()
  print(f"Mô hình đã được lưu tại: {saved_path}")

  # Xem thống kê ma trận sau khi train
  print(model.summary())
  # {'customers': 600000, 'products': 50000, 'interactions': 1999846}
  ```

---

## Gợi ý sản phẩm (Recommendation / Inference)

### 1. Lệnh gợi ý (Recommend Commands - CLI)

Khi chạy gợi ý, hệ thống mặc định nạp mô hình từ `output/cf/item_cf.joblib` (nếu chưa có model sẽ tự động huấn luyện trước):

* **Gợi ý Top-K theo mã khách hàng (`CustomerID`):**
  ```bash
  python main.py --customer-id CUST_00001 --top-k 5
  ```
  *(Thêm cờ `--load-model` nếu chỉ muốn nạp model từ đĩa: `python main.py --load-model --customer-id CUST_00001 --top-k 5`)*

* **Tra cứu hóa đơn và gợi ý sản phẩm theo mã đơn (`InvoiceNo`):**
  ```bash
  python main.py --invoice-id INV183830 --top-k 5
  ```

* **Chạy phiên gợi ý tương tác liên tục (Interactive Mode):**
  ```bash
  python main.py --load-model
  ```
  *(Model chỉ nạp vào RAM một lần duy nhất, terminal sẽ chờ bạn nhập liên tục CustomerID hoặc InvoiceNo để xem kết quả. Gõ `quit` hoặc `exit` để thoát).*

### 2. Gợi ý bằng Python Code

```python
from models import CollaborativeFiltering

# Nạp mô hình đã train sẵn từ output/cf/item_cf.joblib
model = CollaborativeFiltering().load_model()

# 1. Lấy danh sách gợi ý cho CustomerID (trả về danh sách (product_id, score))
recommendations = model.recommend("CUST_00001", top_k=5)
for product_id, score in recommendations:
    details = model.product_details(product_id)
    print(f"- [{product_id}] {details.get('ProductName')}: Score {score:.4f}")

# 2. Tra cứu đơn hàng và gợi ý theo InvoiceNo
order_info, recommendations = model.recommend_by_invoice("INV183830", top_k=5)
print(f"Đơn hàng của khách: {order_info['customer_id']}, Tổng tiền: {order_info['total_amount']:,.0f} VNĐ")
```

### 3. Gợi ý qua Web Service (FastAPI)

* **Khởi động server API:**
  ```bash
  uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
  ```
  Tài liệu Swagger UI kiểm thử trực tiếp tại: `http://localhost:8000/docs`.

* **Lệnh gọi API lấy gợi ý (cURL):**
  ```bash
  curl -X GET "http://localhost:8000/api/v1/recommend/customer/CUST_00001?top_k=5"
  *Response trả về JSON chứa mã khách hàng và danh sách gợi ý `product_id`:*
  ```json
  {
    "customer_id": "CUST_00001",
    "recommendations": [
      { "product_id": "PROD_34017" },
      { "product_id": "PROD_40808" }
    ]
  }
  ```


* **Bảng các endpoints hỗ trợ:**

  | Phương thức | Endpoint | Chức năng |
  | :--- | :--- | :--- |
  | `GET` | `/health` | Kiểm tra trạng thái hệ thống, model loaded và thống kê ma trận |
  | `GET` | `/api/v1/recommend/customer/{customer_id}?top_k=10` | Gợi ý sản phẩm cá nhân hóa cho khách hàng |


---

## Kiến trúc thuật toán & Cơ chế hoạt động

Mô hình Item-based CF tại [`models/cf_recommendation.py`](models/cf_recommendation.py) áp dụng giải thuật **Item-Item Cosine Similarity** được tối ưu hóa cho dữ liệu lớn:

1. **Ma trận thưa Sparse CSR (`SparseUserItemMatrix`)**:
   - Chuyển đổi lịch sử tương tác thành ma trận `scipy.sparse.csr_matrix` ($600,000 \times 50,000$), chỉ tiêu tốn **~18 MB RAM** thay vì ma trận đặc (dense) tiêu tốn 240 GB RAM.
2. **Tính Cosine Similarity tức thời (`ItemSimilarityMatrix`)**:
   - Vector mỗi sản phẩm được chuẩn hóa L2-norm: $\mathbf{v}_i = \frac{\mathbf{r}_i}{\|\mathbf{r}_i\|_2}$.
   - Khi gợi ý cho khách hàng có tập sản phẩm đã mua $P$ với trọng số $W$, điểm số cho tất cả sản phẩm ứng viên được tính bằng một phép nhân ma trận - vector thưa:
     $$\mathbf{Score} = \mathbf{V} \cdot \left( \sum_{p \in P} w_p \mathbf{v}_p \right)$$
   - Tốc độ tính toán chỉ mất **~7 mili-giây**, không cần lưu trước bảng tương đồng $50,000 \times 50,000$ (tiết kiệm 20 GB RAM).
3. **Cơ chế Cold-Start Fallback**:
   - Đối với khách hàng mới chưa có lịch sử mua hàng, hệ thống tự động gợi ý các sản phẩm có độ phổ biến cao nhất (`popular_items`) tính theo tổng sản lượng bán ra.

---

## Kiểm thử tự động (Testing)

Chạy toàn bộ unit tests và integration tests:

```bash
python -m unittest discover tests
```

Tất cả các bài test kiểm tra tính toàn vẹn của thuật toán, nạp/lưu model và các endpoint FastAPI.

---

## Chạy với Docker

Khởi chạy ứng dụng nhanh chóng bằng Docker Compose (đã mount sẵn `output/` và `data/`):

```bash
docker-compose up --build
```
Dịch vụ sẽ sẵn sàng phục vụ tại `http://localhost:8000`.
