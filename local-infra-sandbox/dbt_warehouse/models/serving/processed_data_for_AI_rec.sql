{{
    config(
        materialized = 'table',
        database = 'serving',
        engine = 'MergeTree()',
        order_by = '(CustomerID, ProductID)'
    )
}}

-- =====================================================================
-- Dữ liệu train cho hệ AI Recommendation (item-based collaborative filtering)
--
-- Contract: docs/implement-phase/implement-plan/data-contract-warehouse.md
--
-- Model bên AI-rec gom: groupby(["CustomerID","ProductID"])["Quantity"].sum()
-- nên TÊN CỘT phải viết hoa đúng như dưới đây, không được đổi.
--
-- Grain: MỘT dòng cho mỗi cặp (khách, sản phẩm). Khách mua cùng sản phẩm ở
-- nhiều đơn -> gộp lại, Quantity cộng dồn.
-- =====================================================================

WITH cleaned AS (
    SELECT
        f.customer_id,
        f.product_id,
        -- Thiếu số lượng KHÔNG loại bỏ dòng: 0 nghĩa là "người dùng chưa tương
        -- tác với sản phẩm". Giữ lại để phân biệt với trường hợp cặp (khách,
        -- sản phẩm) không hề tồn tại, và để checksum truy được đơn thiếu dữ liệu.
        COALESCE(f.quantity, 0) AS quantity
    FROM {{ ref('fact_orders_detail') }} f

    -- Sản phẩm không còn bán thì không được gợi ý. Phải lọc Ở ĐÂY, trước khi
    -- đưa sang AI — bên đó không biết sản phẩm nào đã ngừng kinh doanh.
    INNER JOIN {{ ref('dim_products') }} p
        ON p.product_id = f.product_id
       AND p.is_deleted = 0

    WHERE
        -- Không có thông tin khách -> loại bỏ: không gán tương tác cho ai được
        f.customer_id IS NOT NULL
        AND toString(f.customer_id) != ''
        -- Không có thông tin sản phẩm -> loại bỏ: không biết gợi ý cái gì
        AND f.product_id IS NOT NULL
        AND toString(f.product_id) != ''
        -- Đơn huỷ và đơn chưa trả tiền là nhiễu, không phản ánh sở thích thật
        AND f.order_status != 'CANCELLED'
        AND f.payment_status = 'PAID'
)

SELECT
    -- toString để pandas đọc thành chuỗi, không mất số 0 ở đầu id
    toString(customer_id) AS CustomerID,
    toString(product_id)  AS ProductID,
    toInt32(sum(quantity)) AS Quantity
FROM cleaned
GROUP BY CustomerID, ProductID
