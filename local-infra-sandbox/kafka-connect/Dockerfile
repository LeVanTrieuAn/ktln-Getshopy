# Kafka Connect kèm sẵn plugin Debezium (CDC Postgres) và S3 Sink (ghi parquet
# lên MinIO).
#
# Vì sao build image thay vì commit JAR vào git:
#   - Hai plugin nặng ~50MB. Git lưu binary thì không diff được, và mỗi lần
#     nâng phiên bản lại cộng thêm 50MB vào lịch sử — vĩnh viễn, kể cả sau khi
#     xoá file.
#   - Phiên bản plugin ghim ở đây, ai build cũng ra đúng một thứ. Mount thư mục
#     JAR tải tay thì mỗi máy một kiểu, và không ai biết bản nào đang chạy.
#
# Nâng phiên bản: sửa hai dòng ARG rồi `docker compose build kafka-connect`.
FROM confluentinc/cp-kafka-connect-base:7.4.0

ARG S3_SINK_VERSION=10.5.13
ARG DEBEZIUM_VERSION=2.5.4

ENV CONNECT_PLUGIN_PATH="/usr/share/java,/usr/share/confluent-hub-components"

RUN confluent-hub install --no-prompt \
        confluentinc/kafka-connect-s3:${S3_SINK_VERSION} \
 && confluent-hub install --no-prompt \
        debezium/debezium-connector-postgresql:${DEBEZIUM_VERSION}
