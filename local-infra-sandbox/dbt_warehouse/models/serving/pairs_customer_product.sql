{{ config(
        materialized         = 'incremental',
        incremental_strategy = 'append',
        schema               = 'serving',
        engine               = 'ReplacingMergeTree(updated_at)',
        order_by             = '(CustomerID, ProductID)'
) }}

-- =====================================================================
-- Bảng CƠ SỞ: mọi cặp (khách, sản phẩm) — không lọc gì thêm.
--
-- AI-Rec KHÔNG đọc bảng này mà đọc view serving.processed_data_for_AI_rec
-- dựng trên nó. Tách hai tầng vì ngưỡng "sản phẩm phải có >= N người mua"
-- KHÔNG đặt được trong một bảng incremental:
--
--   P có 2 người mua  -> dưới ngưỡng, bị loại.
--   Người thứ 3 mua   -> P đủ ngưỡng. Nhưng chỉ người thứ ba sinh dòng fact
--                        mới, nên chỉ cặp của người đó được ghi; hai cặp cũ
--                        không nằm trong tập "vừa đụng tới" và thiếu VĨNH VIỄN.
--
-- Đặt ngưỡng ở view thì nó tính lại trên toàn bộ dữ liệu mỗi lần đọc.
--
-- Grain: MỘT dòng cho mỗi cặp (khách, sản phẩm).
-- Append-only: mỗi lần một cặp đổi thì GHI THÊM dòng mới với updated_at mới.
-- =====================================================================

WITH

{% if is_incremental() %}
-- Các cặp có ít nhất một dòng fact nạp sau lần chạy trước.
touched AS (
    SELECT DISTINCT
        toString(customer_id) AS CustomerID,
        toString(product_id)  AS ProductID
    FROM {{ ref('fact_orders_detail') }}
    WHERE _loaded_at > (SELECT ifNull(max(updated_at), toDateTime('1970-01-01 00:00:00')) FROM {{ this }})
      AND customer_id != 0
      AND product_id  != 0
),
{% endif %}

-- Tính lại trên TOÀN BỘ lịch sử của cặp đó, không cộng dồn phần mới: một dòng
-- fact bị sửa (đơn chuyển sang huỷ, số lượng đổi) sẽ bị tính hai lần.
recomputed AS (
    SELECT
        toString(f.customer_id) AS CustomerID,
        toString(f.product_id)  AS ProductID,
        -- Thiếu số lượng -> 0 = "chưa tương tác", KHÔNG loại bỏ dòng
        toInt32(sum(ifNull(f.quantity, 0))) AS Quantity,
        -- Lần mua GẦN NHẤT. AI-Rec dùng để giảm trọng số món mua lâu rồi:
        -- Quantity cộng dồn cả lịch sử nên đơn 3 tháng trước nặng ngang đơn
        -- hôm qua, gợi ý không theo kịp sở thích thay đổi.
        max(f.order_date) AS LastPurchasedAt
    FROM {{ ref('fact_orders_detail') }} AS f FINAL
    -- Sản phẩm ngừng bán không được gợi ý. Lọc ở đây vì AI-rec không biết cờ này.
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
-- LEFT JOIN: cặp vừa đổi có thể KHÔNG còn thoả điều kiện (đơn chuyển sang
-- CANCELLED, sản phẩm ngừng bán). Bỏ qua thì dòng cũ nằm lại vĩnh viễn và
-- model vẫn học một tương tác đã bị huỷ. Quantity = 0 làm bia mộ mềm.
SELECT
    t.CustomerID,
    t.ProductID,
    ifNull(r.Quantity, 0) AS Quantity,
    ifNull(r.LastPurchasedAt, toDateTime64('1970-01-01 00:00:00', 3)) AS LastPurchasedAt,
    now()                 AS updated_at
FROM touched AS t
LEFT JOIN recomputed AS r USING (CustomerID, ProductID)
{% else %}
SELECT
    CustomerID,
    ProductID,
    Quantity,
    LastPurchasedAt,
    now() AS updated_at
FROM recomputed
{% endif %}
