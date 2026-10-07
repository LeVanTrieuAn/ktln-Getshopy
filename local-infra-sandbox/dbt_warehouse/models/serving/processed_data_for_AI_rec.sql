{{ config(materialized='view', schema='serving') }}

-- =====================================================================
-- Tập train cho AI Recommendation — ĐÂY là thứ AI-Rec đọc.
-- Contract: docs/implement-phase/implement-plan/data-contract-warehouse.md
--
-- Tên cột viết HOA đúng như dưới đây, bên AI-rec gom
-- groupby(["CustomerID","ProductID"])["Quantity"].sum() theo đúng tên này.
--
-- View chứ không phải bảng, và nó lo luôn hai việc bên kia hay quên:
--
--   1. FINAL — bảng cơ sở là ReplacingMergeTree append-only. Đọc thiếu FINAL
--      thì một cặp hiện nhiều lần với số lượng khác nhau, model cộng dồn các
--      phiên bản và số lượng bị thổi lên. Không có lỗi nào báo ra.
--
--   2. Ngưỡng số người mua — xem bên dưới.
-- =====================================================================

WITH popular_enough AS (
    -- Sản phẩm phải có đủ số người mua KHÁC NHAU mới được đưa vào tập train.
    --
    -- VÌ SAO: cosine giữa hai sản phẩm tính trên vector có SỐ CHIỀU BẰNG SỐ
    -- KHÁCH. Món chỉ một người mua có vector gần như một chiều, nên cosine của
    -- nó với mọi món người đó cũng mua đều bị thổi lên, và nó leo thẳng lên
    -- đầu danh sách gợi ý dù không ai khác quan tâm.
    --
    -- Đã xảy ra thật: 5 sản phẩm sinh ra từ vài đơn test chiếm gần hết top gợi
    -- ý của một khách, chỉ vì tài khoản test đó mua trùng nhiều thứ với khách.
    --
    -- Tính ở view nên ngưỡng luôn dựa trên TOÀN BỘ dữ liệu hiện tại.
    SELECT ProductID
    FROM {{ ref('pairs_customer_product') }} FINAL
    WHERE Quantity > 0
    GROUP BY ProductID
    HAVING uniqExact(CustomerID) >= {{ var('min_buyers_per_product', 3) }}
)

SELECT
    p.CustomerID      AS CustomerID,
    p.ProductID       AS ProductID,
    p.Quantity        AS Quantity,
    p.LastPurchasedAt AS LastPurchasedAt
FROM {{ ref('pairs_customer_product') }} AS p FINAL
INNER JOIN popular_enough AS pe ON pe.ProductID = p.ProductID
WHERE p.Quantity > 0
