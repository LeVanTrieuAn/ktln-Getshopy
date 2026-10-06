-- Một giá trị không được vừa "thích" vừa "không quan tâm" với cùng một khách
-- (luật làm sạch số 3 trong customer_preference_signals). Nếu lọt, AI-Rec vừa
-- cộng điểm vừa lọc cứng cùng một món — kết quả phụ thuộc thứ tự xử lý.
--
-- Test trả về dòng nào là dòng đó VI PHẠM (quy ước test đơn của dbt).
SELECT
    CustomerID,
    Dimension,
    Value,
    groupArray(Polarity) AS polarities
FROM {{ ref('customer_preference_signals') }}
GROUP BY CustomerID, Dimension, Value
HAVING uniqExact(Polarity) > 1
