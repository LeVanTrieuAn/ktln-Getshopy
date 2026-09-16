-- Sau FINAL, mỗi cặp (CustomerID, ProductID) phải xuất hiện đúng MỘT lần.
--
-- Đây là bất biến mà hệ AI-Rec dựa vào: nó gom groupby(CustomerID, ProductID)
-- và cộng Quantity. Nếu FINAL vẫn trả ra cặp trùng thì model cộng dồn nhiều
-- phiên bản của cùng một cặp — số lượng bị thổi lên, và không có lỗi nào báo ra.
--
-- Test trả về dòng nào là dòng đó VI PHẠM (quy ước test đơn của dbt).
SELECT
    CustomerID,
    ProductID,
    count() AS versions
FROM {{ ref('processed_data_for_AI_rec') }} FINAL
GROUP BY CustomerID, ProductID
HAVING count() > 1
