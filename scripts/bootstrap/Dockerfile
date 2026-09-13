# Image chạy một lần để khởi tạo hệ BigData.
#
# Cần ba thứ mà không image sẵn có nào gộp đủ:
#   curl     — gọi ClickHouse HTTP và Kafka Connect REST
#   envsubst — thay ${VAR} trong connector config, để bí mật không nằm trong git
#   mc       — tạo bucket MinIO (dùng S3 API trực tiếp thì phải tự ký AWS SigV4)
FROM alpine:3.20

RUN apk add --no-cache curl gettext

# Lấy mc từ image chính thức thay vì tải lúc chạy — build một lần, chạy nhanh
COPY --from=quay.io/minio/mc:latest /usr/bin/mc /usr/bin/mc

ENTRYPOINT ["/bin/sh"]
