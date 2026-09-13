-- =====================================================================
-- Tài khoản ClickHouse cho hệ AI Recommendation — CHỈ ĐỌC
--
-- AI-rec tự gọi lấy dữ liệu theo lịch của họ (xem data-contract-warehouse.md
-- §4). Không dùng chung tài khoản admin: hệ khác chỉ được đọc đúng bảng nó
-- cần, và không được phép chạy truy vấn nặng làm nghẽn dashboard.
--
-- Mật khẩu đặt qua biến môi trường AI_REC_CH_PASSWORD, không hardcode.
-- =====================================================================

CREATE ROLE IF NOT EXISTS ai_rec_reader;

-- Chỉ đúng một bảng. Thêm bảng khác phải GRANT tường minh.
GRANT SELECT ON serving.processed_data_for_AI_rec TO ai_rec_reader;

CREATE USER IF NOT EXISTS ai_rec
    IDENTIFIED BY '${AI_REC_CH_PASSWORD}'
    DEFAULT ROLE ai_rec_reader;

GRANT ai_rec_reader TO ai_rec;

-- Giới hạn tài nguyên: AI-rec quét toàn bảng mỗi lần train, không được để nó
-- chiếm hết bộ nhớ của cluster.
CREATE SETTINGS PROFILE IF NOT EXISTS ai_rec_profile SETTINGS
    max_execution_time = 60,
    max_memory_usage = 2000000000,
    readonly = 1;

ALTER USER ai_rec SETTINGS PROFILE ai_rec_profile;
