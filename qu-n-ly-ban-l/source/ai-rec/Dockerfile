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
COPY config.py main.py ./

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
