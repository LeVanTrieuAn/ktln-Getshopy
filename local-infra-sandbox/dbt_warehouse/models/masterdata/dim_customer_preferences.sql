{{ config(materialized='table', schema='masterdata', engine='MergeTree()', order_by='customer_id') }}

-- Câu trả lời onboarding của khách (bảng CustomerPreference ở Postgres).
-- Kéo thẳng như các dim khác: Postgres là nguồn sự thật, ClickHouse chỉ giữ ảnh
-- chụp mới nhất để AI-Rec đọc. Không đi qua CDC vì không cần lịch sử — khách
-- sửa sở thích thì bản mới thay bản cũ.
--
-- postgresql() đọc TEXT[] thành Array(Nullable(String)). Lọc NULL rồi ép về
-- Array(String) ngay tại đây để tầng sau không phải xử lý Nullable trong mảng.
SELECT
    toInt64(customer_id)                                                           AS customer_id,
    status,
    CAST(arrayFilter(x -> x IS NOT NULL, liked_categories)    AS Array(String))   AS liked_categories,
    CAST(arrayFilter(x -> x IS NOT NULL, liked_brands)        AS Array(String))   AS liked_brands,
    CAST(arrayFilter(x -> x IS NOT NULL, disliked_categories) AS Array(String))   AS disliked_categories,
    CAST(arrayFilter(x -> x IS NOT NULL, disliked_brands)     AS Array(String))   AS disliked_brands,
    ifNull(price_band, '')                                                         AS price_band,
    updated_at,
    now()                                                                          AS _synced_at
FROM postgresql(
    '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
    '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
    'CustomerPreference',
    '{{ env_var("PG_SOURCE_USER") }}',
    '{{ env_var("PG_SOURCE_PASSWORD") }}'
)
