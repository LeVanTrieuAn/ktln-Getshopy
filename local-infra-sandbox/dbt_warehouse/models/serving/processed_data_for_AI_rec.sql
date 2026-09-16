{{ config(
        materialized         = 'incremental',
        incremental_strategy = 'append',
        schema               = 'serving',
        engine               = 'ReplacingMergeTree(updated_at)',
        order_by             = '(CustomerID, ProductID)'
) }}

-- =====================================================================
-- Dữ liệu train cho AI Recommendation (item-based collaborative filtering).
-- Contract: docs/implement-phase/implement-plan/data-contract-warehouse.md
--
-- Model bên AI-rec gom groupby(["CustomerID","ProductID"])["Quantity"].sum()
-- nên TÊN CỘT viết hoa đúng như dưới đây, không được đổi.
--
-- Grain: MỘT dòng cho mỗi cặp (khách, sản phẩm).
--
-- ── ĐỌC BẢNG NÀY PHẢI DÙNG `FINAL` ──────────────────────────────────
--     SELECT CustomerID, ProductID, Quantity
--     FROM serving.processed_data_for_AI_rec FINAL
--
-- Bảng là append-only: mỗi lần một cặp đổi số lượng thì GHI THÊM một
-- dòng mới với `updated_at` mới, không sửa dòng cũ. ReplacingMergeTree
-- giữ lại bản có `updated_at` lớn nhất theo ORDER BY key — nhưng việc
-- gộp chỉ xảy ra trong nền, không biết trước lúc nào. Quên `FINAL` là
-- đọc phải cả phiên bản cũ lẫn mới, và một cặp xuất hiện nhiều lần với
-- số lượng khác nhau. Lỗi này KHÔNG báo ra gì cả, chỉ là model train
-- trên dữ liệu sai.
--
-- ── VÌ SAO APPEND-ONLY THAY VÌ DỰNG LẠI CẢ BẢNG ─────────────────────
-- Bản trước dùng materialized='table': mỗi lần dbt chạy là DROP rồi
-- CREATE lại toàn bộ. Với chu kỳ 5 phút thì có một khoảng bảng không
-- tồn tại hoặc rỗng — AI-Rec fetch đúng lúc đó sẽ train trên bảng
-- trống và xoá sạch model đang tốt. Append-only không bao giờ có
-- khoảng trống đó.
-- =====================================================================

WITH

{% if is_incremental() %}
-- Các cặp (khách, sản phẩm) có ít nhất một dòng fact được nạp sau lần
-- chạy trước. Chỉ những cặp này cần tính lại.
touched AS (
    SELECT DISTINCT
        toString(customer_id) AS CustomerID,
        toString(product_id)  AS ProductID
    FROM {{ ref('fact_orders_detail') }}
    -- Bảng rỗng thì max() trả về mốc 0, mọi dòng đều lớn hơn -> tính lại tất cả.
    WHERE _loaded_at > (SELECT ifNull(max(updated_at), toDateTime('1970-01-01 00:00:00')) FROM {{ this }})
      AND customer_id != 0
      AND product_id  != 0
),
{% endif %}

-- Tính lại tổng số lượng trên TOÀN BỘ lịch sử của cặp đó, không phải chỉ
-- phần mới. Cộng dồn phần mới vào giá trị cũ là sai: một dòng fact bị sửa
-- (đơn chuyển sang huỷ, số lượng thay đổi) sẽ bị cộng hai lần.
recomputed AS (
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
    {% if is_incremental() %}
      AND (toString(f.customer_id), toString(f.product_id))
          IN (SELECT CustomerID, ProductID FROM touched)
    {% endif %}
    GROUP BY CustomerID, ProductID
)

{% if is_incremental() %}
-- LEFT JOIN chứ không phải INNER: một cặp vừa bị thay đổi có thể KHÔNG
-- còn thoả điều kiện nữa (đơn chuyển sang CANCELLED, sản phẩm ngừng bán).
-- Lúc đó `recomputed` không có dòng cho nó, và nếu bỏ qua thì dòng cũ nằm
-- lại vĩnh viễn — model vẫn học một tương tác đã bị huỷ.
--
-- Ghi Quantity = 0 làm bia mộ mềm: đúng quy ước "không có thông tin số
-- lượng -> xem như 0" trong contract, và `fit()` bên AI-rec lọc
-- `Quantity > 0` nên dòng đó tự bị loại khỏi tập train.
SELECT
    t.CustomerID,
    t.ProductID,
    ifNull(r.Quantity, 0) AS Quantity,
    now()                 AS updated_at
FROM touched AS t
LEFT JOIN recomputed AS r USING (CustomerID, ProductID)
{% else %}
SELECT
    CustomerID,
    ProductID,
    Quantity,
    now() AS updated_at
FROM recomputed
{% endif %}
