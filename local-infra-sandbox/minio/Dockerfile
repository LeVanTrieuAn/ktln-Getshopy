# MinIO build từ mã nguồn chính thức, ghim đúng bản hệ đang chạy.
#
# Vì sao phải tự build: MinIO đã ngừng phát hành bản cộng đồng dựng sẵn. Kiểm ngày
# 04/10/2026: minio/minio trên Docker Hub trả "denied", quay.io/minio/minio trả
# "no such manifest", binary trên dl.min.io trả HTTP 410. README chính thức ghi
# "The MinIO community edition is now distributed as source code only" và repo đã
# archive (chỉ đọc) từ 25/04/2026 — https://github.com/minio/minio
# Máy nào còn image cũ trong cache thì vẫn chạy, máy mới clone thì hỏng ngay ở bước pull.
#
# Vì sao ghim RELEASE.2025-09-07T16-13-09Z: đúng bản trong image quay.io mà volume
# minio_data đang dùng — dữ liệu cũ đọc được nguyên trạng. Toolchain cũng ghim
# go1.24.6, đúng bản đã biên dịch binary chính thức (`minio --version` của image cũ).
#
# Hạn chế: bản cộng đồng không còn nhận bản vá bảo mật. Chấp nhận được cho môi
# trường dev cục bộ của khoá luận; triển khai thật cần kho S3 còn được bảo trì.
#
# Lần build đầu CHẬM: đo 04/10/2026 mất ~20 phút ở bước `go build` (Docker 10 CPU,
# 8 GB — tải module Go + biên dịch). Mỗi máy chỉ tốn một lần; các lần sau dùng cache.
# Kiểm chứng: `docker run --rm kltn-minio --version` phải in đúng
#   RELEASE.2025-09-07T16-13-09Z (commit-id=07c3a429…), Runtime: go1.24.6
# — trùng từng chữ với binary chính thức trong image quay.io cũ.
FROM golang:1.24.6-alpine AS build

ARG MINIO_RELEASE_TAG=RELEASE.2025-09-07T16-13-09Z
# Commit của tag trên. Kiểm lại sau khi clone: tag có bị dời thì build hỏng chứ
# không lặng lẽ ra một bản khác.
ARG MINIO_COMMIT=07c3a429bfed433e49018cb0f78a52145d4bedeb

RUN apk add --no-cache git

WORKDIR /src
RUN git clone --depth 1 --branch "${MINIO_RELEASE_TAG}" https://github.com/minio/minio.git . \
 && test "$(git rev-parse HEAD)" = "${MINIO_COMMIT}"

# Đúng lệnh của target `build` trong Makefile của MinIO. MINIO_RELEASE=RELEASE để
# gen-ldflags ghi phiên bản dạng RELEASE.<giờ commit> như bản phát hành, thay vì
# DEVELOPMENT.<...>.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -tags kqueue -trimpath \
        --ldflags "$(MINIO_RELEASE=RELEASE go run buildscripts/gen-ldflags.go)" \
        -o /out/minio

FROM alpine:3.20

# curl cho healthcheck (/minio/health/ready) — image chính thức dùng `mc ready`,
# nhưng mc cũng không còn bản dựng sẵn
RUN apk add --no-cache ca-certificates curl

COPY --from=build /out/minio /usr/bin/minio

EXPOSE 9000 9001
VOLUME ["/data"]
ENTRYPOINT ["minio"]
CMD ["server", "/data"]
