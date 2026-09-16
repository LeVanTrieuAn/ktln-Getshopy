# ==============================================================================
# Multi-stage/Optimized Production Dockerfile for Recommendation API
# ==============================================================================
FROM python:3.11-slim

# Thiết lập các biến môi trường chuẩn cho Python container
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

# Cài đặt curl phục vụ container HEALTHCHECK và các công cụ hệ thống tối thiểu
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Tạo user không có đặc quyền root (Non-root user) để tăng tính bảo mật
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 --create-home appuser

# Copy danh sách thư viện và cài đặt trước để tận dụng Docker layer caching
COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn của dự án
COPY api/ ./api/
COPY models/ ./models/
# data_source/ chứa tầng đọc warehouse ClickHouse. Thiếu dòng này thì image
# build thành công nhưng container chết ngay lúc import — lỗi chỉ lộ ra lúc chạy.
COPY data_source/ ./data_source/
COPY config.py main.py ./

# Tạo sẵn hai thư mục là điểm gắn volume, TRƯỚC khi chown.
#
# Docker chỉ sao chép quyền sở hữu từ image sang volume lúc volume còn RỖNG.
# Thư mục chưa tồn tại trong image thì Docker tự tạo và gán cho root, còn tiến
# trình chạy bằng appuser -> ghi model ra đĩa báo "Permission denied". Lỗi đó
# không làm chết service (bản trong bộ nhớ vẫn dùng được) nên rất dễ bỏ sót:
# nó chỉ hiện ra ở lần khởi động sau, khi không có gì để nạp lại.
RUN mkdir -p /app/output/cf /app/data/raw

# Phân quyền cho appuser trên toàn bộ thư mục /app
RUN chown -R appuser:appgroup /app

# Chuyển sang quyền appuser
USER appuser

# Mở cổng giao tiếp
EXPOSE 8000

# Kiểm tra trạng thái sức khỏe định kỳ của container
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Lệnh khởi chạy ứng dụng FastAPI bằng Uvicorn server
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
