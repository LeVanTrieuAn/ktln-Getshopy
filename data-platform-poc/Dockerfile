# Image cho bộ sinh dữ liệu demo (demo_dataset.py) — service `seed-data`, profile `seed`.
#
# Chạy trong container để máy nào (kể cả Windows) cũng chỉ cần Docker: không cài Python,
# numpy hay thư viện Postgres lên máy thật.
#
# COPY TƯỜNG MINH từng file chứ không `COPY . .`: thư mục này có .env chứa mật khẩu thật
# (bản POC cũ). Chép cả thư mục là đóng gói luôn bí mật vào image. .dockerignore chặn thêm một lớp.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY taste_simulator.py demo_dataset.py pos_simulator.py ./
COPY tests/ ./tests/

ENTRYPOINT ["python"]
CMD ["demo_dataset.py"]
