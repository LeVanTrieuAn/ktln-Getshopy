# Image chạy một lần để khởi tạo hệ BigData.
#
# Cần hai thứ mà không image sẵn có nào gộp đủ:
#   curl     — gọi ClickHouse HTTP, Kafka Connect REST và S3 API của MinIO
#              (--aws-sigv4 tự ký AWS SigV4, có từ curl 7.75)
#   envsubst — thay ${VAR} trong connector config, để bí mật không nằm trong git
#
# Trước 04/10/2026 tạo bucket bằng `mc` chép từ image quay.io/minio/mc. Image đó
# không còn kéo được (MinIO ngừng phát hành bản cộng đồng dựng sẵn — xem
# local-infra-sandbox/minio/Dockerfile), nên build bootstrap trên máy mới hỏng theo.
FROM alpine:3.20

RUN apk add --no-cache curl gettext

ENTRYPOINT ["/bin/sh"]
