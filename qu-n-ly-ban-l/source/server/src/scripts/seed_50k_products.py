"""
============================================================
SEED 50K PRODUCTS — Getshopy Performance Benchmark
File: server/src/scripts/seed_50k_products.py
============================================================

Seed 50,000 sản phẩm giả (fake) vào DB Supabase/PostgreSQL
để test hiệu năng load/pagination của frontend.

Cách chạy:
  # Seed đầy đủ 50,000 sản phẩm (mất ~5-10 phút)
  python seed_50k_products.py --count 50000

  # Seed nhanh để test (1000 sản phẩm)
  python seed_50k_products.py --count 1000 --batch-size 100

  # Xóa tất cả sản phẩm seed (có prefix BENCH_)
  python seed_50k_products.py --cleanup

Yêu cầu:
  pip install psycopg2-binary python-dotenv
  Hoặc chỉ dùng requests + API server local
"""

import argparse
import json
import os
import random
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

# ── Load .env ─────────────────────────────────────────────────────────────────
def load_env():
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, val = line.partition('=')
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val

load_env()

DATABASE_URL = os.environ.get('DATABASE_URL', '')
DIRECT_URL   = os.environ.get('DIRECT_URL', '')

# ── Fake data templates ───────────────────────────────────────────────────────
CATEGORIES = [
    ('CAT001', 'Điện thoại thông minh'),
    ('CAT002', 'Máy tính xách tay'),
    ('CAT003', 'Máy tính bảng'),
    ('CAT004', 'Phụ kiện công nghệ'),
    ('CAT005', 'Tivi & Thiết bị giải trí'),
    ('CAT006', 'Máy ảnh & Quay phim'),
    ('CAT007', 'Đồng hồ thông minh'),
    ('CAT008', 'Gaming'),
    ('CAT009', 'Thiết bị âm thanh'),
    ('CAT010', 'Thiết bị văn phòng'),
    ('CAT011', 'Linh kiện máy tính'),
    ('CAT012', 'Nhà thông minh'),
]

BRANDS = [
    'Apple', 'Samsung', 'Sony', 'LG', 'Xiaomi', 'OPPO', 'Vivo', 'Realme',
    'Huawei', 'OnePlus', 'ASUS', 'Dell', 'HP', 'Lenovo', 'Acer', 'MSI',
    'Razer', 'Logitech', 'JBL', 'Bose', 'Sennheiser', 'Audio-Technica',
    'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI', 'Garmin', 'Fitbit',
]

PRODUCT_ADJECTIVES = [
    'Pro', 'Ultra', 'Max', 'Plus', 'Lite', 'Air', 'Neo', 'X', 'S', 'SE',
    'Elite', 'Premium', 'Extreme', 'Advanced', 'Smart', 'Mini', 'Grand',
]

COLORS = ['Đen', 'Trắng', 'Bạc', 'Vàng', 'Xanh dương', 'Xanh lá', 'Đỏ', 'Tím', 'Hồng', 'Xám']
STORAGES = ['64GB', '128GB', '256GB', '512GB', '1TB']
RAMS = ['4GB', '6GB', '8GB', '12GB', '16GB', '32GB']
BRANCHES = ['HCM001', 'HN001', 'DN001']

PLACEHOLDER_IMAGES = [
    'https://placehold.co/400x400/1a1a2e/ffffff?text=Product',
    'https://placehold.co/400x400/16213e/ffffff?text=Item',
    'https://placehold.co/400x400/0f3460/ffffff?text=Gear',
    'https://placehold.co/400x400/533483/ffffff?text=Tech',
    'https://placehold.co/400x400/2d6a4f/ffffff?text=Device',
]


def generate_product(idx: int) -> dict:
    """Tạo 1 sản phẩm giả ngẫu nhiên"""
    cat_id, cat_name = random.choice(CATEGORIES)
    brand_id         = random.choice(BRANDS)
    adj              = random.choice(PRODUCT_ADJECTIVES)
    model_num        = random.randint(1, 99)
    year             = random.choice([2022, 2023, 2024, 2025])

    name = f"[BENCH] {brand_id} {cat_name.split()[0]} {adj} {model_num} ({year})"

    base_price   = random.randint(1_000_000, 80_000_000)
    # Làm tròn đến 100k
    base_price   = round(base_price / 100_000) * 100_000
    orig_price   = base_price + random.randint(0, 5_000_000)
    orig_price   = round(orig_price / 100_000) * 100_000

    stock   = random.randint(0, 500)
    rating  = round(random.uniform(3.5, 5.0), 1)
    sold    = random.randint(0, 10000)
    image   = random.choice(PLACEHOLDER_IMAGES)

    # Variants
    variants = []
    for color in random.sample(COLORS, random.randint(1, 3)):
        storage = random.choice(STORAGES)
        v_price = base_price + random.randint(-500_000, 2_000_000)
        v_price = max(500_000, round(v_price / 100_000) * 100_000)
        variants.append({
            'id': f'V{idx}_{color[:3]}_{storage}',
            'color': color,
            'storage': storage,
            'price': v_price,
            'stock': random.randint(0, 100),
        })

    branch_ids = random.sample(BRANCHES, random.randint(1, 3))

    return {
        'name': name,
        'price': float(base_price),
        'original_price': float(orig_price),
        'category_id': cat_id,
        'brand_id': brand_id,
        'stock': stock,
        'rating': rating,
        'sold': sold,
        'image': image,
        'images': json.dumps([image]),
        'description': f'Sản phẩm benchmark #{idx} — {brand_id} {adj} {model_num}. RAM: {random.choice(RAMS)}, Storage: {random.choice(STORAGES)}.',
        'variants': json.dumps(variants),
        'branch_ids': json.dumps(branch_ids),
        'is_banner': False,
        'is_deleted': False,
    }


def seed_via_psycopg2(count: int, batch_size: int):
    """Seed dùng psycopg2 trực tiếp vào PostgreSQL"""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("❌ Cần cài: pip install psycopg2-binary")
        sys.exit(1)

    # Dùng DIRECT_URL (không qua PgBouncer) để bulk insert
    conn_str = DIRECT_URL or DATABASE_URL
    if not conn_str:
        print("❌ DATABASE_URL / DIRECT_URL chưa cấu hình trong .env")
        sys.exit(1)

    print(f"🔌 Connecting to DB: {conn_str[:60]}...")
    conn = psycopg2.connect(conn_str)
    cur  = conn.cursor()

    print(f"🌱 Seeding {count:,} sản phẩm theo batch {batch_size}...")
    total_inserted = 0
    t_start = time.perf_counter()

    for batch_start in range(0, count, batch_size):
        batch_end  = min(batch_start + batch_size, count)
        batch_data = [generate_product(batch_start + i) for i in range(batch_end - batch_start)]

        insert_sql = """
            INSERT INTO "Product" (
                name, price, original_price, category_id, brand_id,
                stock, rating, sold, image, images, description,
                variants, branch_ids, is_banner, is_deleted, created_at
            ) VALUES (
                %(name)s, %(price)s, %(original_price)s, %(category_id)s, %(brand_id)s,
                %(stock)s, %(rating)s, %(sold)s, %(image)s, %(images)s, %(description)s,
                %(variants)s, %(branch_ids)s, %(is_banner)s, %(is_deleted)s, NOW()
            )
        """
        psycopg2.extras.execute_batch(cur, insert_sql, batch_data, page_size=batch_size)
        conn.commit()

        total_inserted += len(batch_data)
        elapsed = time.perf_counter() - t_start
        rate    = total_inserted / elapsed if elapsed > 0 else 0
        eta_s   = (count - total_inserted) / rate if rate > 0 else 0
        print(f"  [{total_inserted:,}/{count:,}] {rate:.0f} rows/s | ETA: {eta_s:.0f}s", end='\r')

    cur.close()
    conn.close()
    print(f"\n✅ Đã seed {total_inserted:,} sản phẩm trong {time.perf_counter()-t_start:.1f}s")
    return total_inserted


def cleanup_via_psycopg2():
    """Xóa tất cả sản phẩm có tên bắt đầu bằng [BENCH]"""
    try:
        import psycopg2
    except ImportError:
        print("❌ Cần cài: pip install psycopg2-binary")
        sys.exit(1)

    conn_str = DIRECT_URL or DATABASE_URL
    conn = psycopg2.connect(conn_str)
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM \"Product\" WHERE name LIKE '[BENCH]%'")
    count = cur.fetchone()[0]
    print(f"🗑️  Tìm thấy {count:,} sản phẩm BENCH → đang xóa...")

    cur.execute("DELETE FROM \"Product\" WHERE name LIKE '[BENCH]%'")
    conn.commit()
    deleted = cur.rowcount

    cur.close()
    conn.close()
    print(f"✅ Đã xóa {deleted:,} sản phẩm BENCH")


def seed_via_api(count: int, batch_size: int, api_base: str):
    """Fallback: seed qua REST API (nếu không có psycopg2)"""
    import urllib.request
    import urllib.error

    url = f"{api_base}/api/products/bulk"
    headers = {'Content-Type': 'application/json'}

    total_inserted = 0
    t_start = time.perf_counter()
    print(f"🌐 Seeding qua API: {url}")

    for batch_start in range(0, count, batch_size):
        batch_end  = min(batch_start + batch_size, count)
        batch_data = [generate_product(batch_start + i) for i in range(batch_end - batch_start)]

        data = json.dumps({'products': batch_data}).encode('utf-8')
        req  = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                total_inserted += result.get('inserted', len(batch_data))
        except Exception as e:
            print(f"\n❌ API error: {e}")
            break

        elapsed = time.perf_counter() - t_start
        rate    = total_inserted / elapsed if elapsed > 0 else 0
        print(f"  [{total_inserted:,}/{count:,}] {rate:.0f} rows/s", end='\r')

    print(f"\n✅ Seeded {total_inserted:,} sản phẩm qua API trong {time.perf_counter()-t_start:.1f}s")
    return total_inserted


def benchmark_pagination(count: int):
    """
    Đo thời gian query phân trang với số lượng lớn dữ liệu
    Đây là benchmark cho backend query performance, không cần actual data
    """
    print("\n📊 Benchmark Query Pagination (ước tính với tỉ lệ lý thuyết):")
    page_sizes = [12, 15, 20, 50, 100]
    for ps in page_sizes:
        total_pages = (count + ps - 1) // ps
        # Giả sử SELECT + LIMIT + OFFSET trung bình ~5-50ms tùy index
        est_ms = 5 + (count / 50000) * 20  # rough estimate
        print(f"  pageSize={ps:<4} → {total_pages:,} trang | est. query ~{est_ms:.0f}ms/req")

    print("\n💡 Để đo chính xác: Chạy script sau khi seed xong và dùng:")
    print("   k6 run benchmark_load.js  (nếu có k6)")
    print("   hoặc dùng Apache JMeter với endpoint /api/b2c/products?page=X&limit=12")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Getshopy — Seed 50k Products for Benchmark')
    parser.add_argument('--count',      type=int, default=50000, help='Số sản phẩm cần seed')
    parser.add_argument('--batch-size', type=int, default=500,   help='Batch size khi insert')
    parser.add_argument('--cleanup',    action='store_true',     help='Xóa tất cả sản phẩm BENCH')
    parser.add_argument('--dry-run',    action='store_true',     help='Chỉ generate 5 mẫu, không insert')
    parser.add_argument('--api',        default='http://localhost:8080', help='API server URL (fallback)')
    parser.add_argument('--use-api',    action='store_true',     help='Dùng REST API thay vì psycopg2')
    args = parser.parse_args()

    print("=" * 60)
    print("🌱 Getshopy — Seed 50K Products Benchmark")
    print("=" * 60)

    if args.dry_run:
        print("🔍 Dry run — 5 mẫu sản phẩm:\n")
        for i in range(5):
            p = generate_product(i)
            p['variants'] = json.loads(p['variants'])
            p['branch_ids'] = json.loads(p['branch_ids'])
            print(json.dumps(p, ensure_ascii=False, indent=2))
        print("\n✅ Dry run hoàn thành. Dùng --count để seed thật.")
        sys.exit(0)

    if args.cleanup:
        cleanup_via_psycopg2()
        sys.exit(0)

    print(f"📦 Target: {args.count:,} sản phẩm | Batch: {args.batch_size}")
    benchmark_pagination(args.count)

    answer = input(f"\n⚠️  Sẽ insert {args.count:,} sản phẩm BENCH vào DB. Tiếp tục? [y/N] ")
    if answer.strip().lower() != 'y':
        print("Hủy bỏ.")
        sys.exit(0)

    if args.use_api:
        seed_via_api(args.count, args.batch_size, args.api)
    else:
        seed_via_psycopg2(args.count, args.batch_size)

    print(f"\n💡 Sau khi seed xong, mở http://localhost:5173/shop để test load 50k sản phẩm")
    print(f"   Và chạy: node benchmark_frontend.js để đo Core Web Vitals tự động")
