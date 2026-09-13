# Thư mục này cố ý để trống

Plugin Kafka Connect (Debezium Postgres + S3 Sink) **không** được commit vào
git — xem `kafka-connect/Dockerfile` để biết lý do và phiên bản đang ghim.

Image tự tải plugin lúc build:

```bash
docker compose build kafka-connect
```

Nếu vì lý do nào đó cần tải tay, đặt JAR vào đây rồi thêm `/data/connectors`
vào `CONNECT_PLUGIN_PATH`.
