{{ config(materialized='table', schema='serving', engine='MergeTree()',
          order_by='(CustomerID, ProductID)') }}

-- =====================================================================
-- Dữ liệu train cho AI Recommendation (item-based collaborative filtering).
-- Contract: docs/implement-phase/implement-plan/data-contract-warehouse.md
--
-- Model bên AI-rec gom groupby(["CustomerID","ProductID"])["Quantity"].sum()
-- nên TÊN CỘT viết hoa đúng như dưới đây, không được đổi.
--
-- Grain: MỘT dòng cho mỗi cặp (khách, sản phẩm).
-- =====================================================================
SELECT
    toString(f.customer_id) AS CustomerID,
    toString(f.product_id)  AS ProductID,
    -- Thiếu số lượng -> 0 = "chưa tương tác", KHÔNG loại bỏ dòng
    toInt32(sum(ifNull(f.quantity, 0))) AS Quantity
FROM {{ ref('fact_orders_detail') }} AS f FINAL
-- Sản phẩm ngừng bán không được gợi ý. Lọc Ở ĐÂY vì AI-rec không biết cờ này.
INNER JOIN {{ ref('dim_products') }} p
        ON p.product_id = toString(f.product_id) AND p.is_deleted = 0
WHERE f._is_deleted = 0
  AND f.customer_id != 0             -- không có thông tin khách  -> loại
  AND f.product_id  != 0             -- không có thông tin sản phẩm -> loại
  AND f.order_status  != 'CANCELLED' -- đơn huỷ không phản ánh sở thích
  AND f.payment_status = 'PAID'      -- chỉ tính giao dịch thật
GROUP BY CustomerID, ProductID
