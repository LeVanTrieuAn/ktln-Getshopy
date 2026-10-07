{{ config(materialized='table', schema='serving', engine='MergeTree()',
          order_by='(CustomerID, ProductID, OrderedAt)') }}

-- =====================================================================
-- Lịch sử mua theo TỪNG ĐƠN cho kênh mua lại của AI-Rec (ai-rec/models/repeat.py).
--
-- Vì sao cần bảng này khi đã có processed_data_for_AI_rec: view đó gom theo cặp
-- (khách, món) — tổng số lượng và lần mua CUỐI. Kênh mua lại cần biết khách mua
-- món đó bao nhiêu LẦN và mỗi lần cách đây bao lâu: ba đơn lẻ gần đây là tín
-- hiệu mua lại mạnh hơn một đơn sỉ 5 cái (Anderson et al., 2014). Half-life nằm
-- phía AI-Rec (tinh chỉnh trên validation), nên ở đây chỉ trả ngày đặt, KHÔNG
-- tính sẵn trọng số.
--
-- BẢNG chứ không phải view: view thường của ClickHouse kiểm quyền trên bảng gốc
-- theo người gọi — tài khoản ai_rec chỉ có SELECT trên `serving`, đọc view trỏ
-- vào `warehouse` sẽ bị Code 497 (cùng lý do customer_preference_signals là bảng).
--
-- Cùng định nghĩa "một lần mua" với pairs_customer_product: đọc FINAL, bỏ bản
-- ghi xoá, bỏ đơn huỷ, chỉ đơn đã thanh toán, sản phẩm còn bán. Lệch định nghĩa
-- là hai kênh của cùng một model học trên hai tập đơn khác nhau.
--
-- KHÔNG lọc ngưỡng số người mua: ngưỡng đó chống cosine bị thổi lên ở món ít
-- người mua (processed_data_for_AI_rec), còn điểm mua lại chỉ dựa vào lịch sử của
-- chính khách.
--
-- Grain: MỘT dòng cho mỗi (khách, món, đơn). Hai dòng hàng cùng món trong một
-- đơn là một lần mua.
--
-- Dựng lại toàn bộ mỗi lượt dbt: dữ liệu nhỏ. Khi số đơn lớn thì chuyển sang
-- incremental theo đơn có biến động, như fact_orders_detail.
-- =====================================================================

SELECT
    toString(f.customer_id)              AS CustomerID,
    toString(f.product_id)               AS ProductID,
    toString(f.order_id)                 AS OrderID,
    min(f.order_date)                    AS OrderedAt,
    toInt32(sum(ifNull(f.quantity, 0)))  AS Quantity
FROM {{ ref('fact_orders_detail') }} AS f FINAL
INNER JOIN {{ ref('dim_products') }} AS p
        ON p.product_id = toString(f.product_id) AND p.is_deleted = 0
WHERE f._is_deleted = 0
  AND f.customer_id != 0
  AND f.product_id  != 0
  AND f.order_status  != 'CANCELLED'
  AND f.payment_status = 'PAID'
GROUP BY CustomerID, ProductID, OrderID
HAVING Quantity > 0
