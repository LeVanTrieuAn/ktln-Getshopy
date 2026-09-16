#!/usr/bin/env python3
"""Máy POS giả lập — bắn đơn hàng tại quầy vào Postgres của hệ Getshopy.

VÌ SAO GHI THẲNG VÀO DB CHỨ KHÔNG GỌI API CHECKOUT
--------------------------------------------------
/api/b2c/checkout là đường của gian hàng ONLINE: giữ chỗ tồn kho, sinh mã QR,
chờ webhook ngân hàng xác nhận. Máy POS tại quầy không có bước nào trong số đó
— khách trả tiền mặt hoặc quẹt thẻ rồi cầm hàng đi luôn, hoá đơn ghi nhận một
giao dịch ĐÃ HOÀN TẤT.

Quan trọng hơn: mục đích của POC này là chứng minh CDC bắt được thay đổi từ
một hệ thống KHÁC ghi vào cùng database. Đi qua API của chính hệ Getshopy thì
không còn chứng minh được điều đó nữa.

BA RÀNG BUỘC PHẢI TÔN TRỌNG, NẾU KHÔNG DỮ LIỆU RƠI HẾT Ở GIỮA ĐƯỜNG
-------------------------------------------------------------------
Đơn chỉ tới được `serving.processed_data_for_AI_rec` nếu qua đủ bộ lọc của dbt:

  1. `product_id` phải có thật trong `"Product"` và `is_deleted = false`
     -> dbt INNER JOIN `dim_products`, sai khoá là mất dòng, KHÔNG có lỗi nào.
  2. `customer_id` phải khác 0 và có thật trong `"B2CCustomer"`.
  3. `payment_status = 'PAID'` và `status != 'CANCELLED'`.

Bản POC cũ bịa `product_id` trong khoảng 101–602 nên không dòng nào sống sót.

CÒN MỘT ĐIỀU NỮA: PHẢI CÓ CHỒNG LẤN GIỮA CÁC KHÁCH
---------------------------------------------------
Collaborative filtering học từ việc "những người mua X cũng mua Y". Nếu mỗi
khách mua một rổ hàng ngẫu nhiên độc lập thì không có tín hiệu nào để học, và
mô hình chỉ trả về danh sách bán chạy. Vì vậy script gán cho mỗi khách một
"gu" (vài nhóm hàng) và rút sản phẩm chủ yếu từ đó — chồng lấn xuất hiện tự
nhiên giữa những khách cùng gu.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import execute_values

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ── Kết nối ──────────────────────────────────────────────────────────────
# Mặc định trỏ vào stack hợp nhất ở gốc repo (docker-compose.yml). Biến
# POSTGRES_SOURCE_* của bản POC cũ vẫn được chấp nhận để khỏi phải sửa .env cũ.
def db_config() -> dict:
    return {
        "host": os.getenv("POS_DB_HOST") or os.getenv("POSTGRES_SOURCE_HOST") or "localhost",
        "port": os.getenv("POS_DB_PORT") or os.getenv("POSTGRES_PORT") or "5432",
        "user": os.getenv("POS_DB_USER") or os.getenv("POSTGRES_USER") or "getshopy",
        "password": os.getenv("POS_DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD") or "",
        "dbname": os.getenv("POS_DB_NAME") or os.getenv("POSTGRES_DB") or "getshopy",
    }


PAYMENT_METHODS = [("CASH", 70), ("CARD", 30)]   # tại quầy chỉ có hai cách này
PROVINCES = ["HCM", "HN", "DN"]


def load_catalog(cur, size: int) -> list[dict]:
    """Lấy hàng bán được TỪ BẢNG TỒN KHO, không phải từ bảng sản phẩm.

    Tồn kho khoá theo bộ ba (product_id, variant_id, branch_id). Chọn hàng từ
    `"Product"` rồi đoán variant là cách chắc chắn bán phải thứ không có tồn —
    y như lỗi gặp khi thử đặt hàng qua API mà quên chọn biến thể.
    """
    cur.execute(
        """
        SELECT i.product_id, i.variant_id, i.branch_id, i.on_hand,
               p.name, p.category_id, p.brand_id, p.price
        FROM "Inventory" i
        JOIN "Product" p ON p.id = i.product_id
        WHERE p.is_deleted = false
          AND p.price > 0
          AND i.on_hand - i.reserved > 0
        ORDER BY i.product_id, i.variant_id
        LIMIT %s
        """,
        (size,),
    )
    return [
        {
            "product_id": r[0], "variant_id": r[1] or "", "branch_id": r[2] or "",
            "on_hand": r[3], "name": r[4], "category_id": r[5] or "",
            "brand_id": r[6] or "", "price": int(r[7]),
        }
        for r in cur.fetchall()
    ]


def load_customers(cur, limit: int) -> list[dict]:
    cur.execute(
        """SELECT id, full_name, email, phone FROM "B2CCustomer"
           WHERE email IS NOT NULL ORDER BY id LIMIT %s""",
        (limit,),
    )
    return [{"id": r[0], "name": r[1] or "Khách lẻ", "email": r[2], "phone": r[3] or ""}
            for r in cur.fetchall()]


def build_orders(rng, catalog, customers, count, days, groups):
    """Sinh đơn có chồng lấn theo 'gu' của từng khách."""
    if not catalog or not customers:
        return []

    # Chia hàng thành các nhóm sở thích. Nhóm là lát cắt liên tiếp của danh mục
    # đã sắp theo product_id, nên hàng cùng nhóm thường cùng loại — giống cách
    # một cửa hàng thật bày kệ.
    groups = max(1, min(groups, len(catalog)))
    chunk = max(1, len(catalog) // groups)
    buckets = [catalog[i:i + chunk] for i in range(0, len(catalog), chunk)] or [catalog]

    # Mỗi khách theo 1–2 nhóm. Đây chính là nguồn chồng lấn cho CF.
    taste = {c["id"]: rng.sample(range(len(buckets)), k=min(len(buckets), rng.choice([1, 1, 2])))
             for c in customers}

    now = datetime.now()
    orders = []
    for n in range(count):
        cust = rng.choice(customers)
        when = now - timedelta(
            days=rng.randint(0, max(0, days - 1)),
            hours=rng.randint(0, 12), minutes=rng.randint(0, 59), seconds=rng.randint(0, 59),
        )
        # Giờ mở cửa 9h–21h: dữ liệu theo giờ mới giống cửa hàng thật
        when = when.replace(hour=rng.randint(9, 21))

        pool = [p for g in taste[cust["id"]] for p in buckets[g]] or catalog
        n_lines = rng.choices([1, 2, 3, 4], weights=[45, 30, 17, 8])[0]
        # 15% số dòng rút ngoài gu — khách nào cũng có lúc mua thứ lạ, và đó là
        # thứ tạo cầu nối giữa các nhóm để CF có gì đó để khám phá.
        picks, seen = [], set()
        for _ in range(n_lines):
            src = catalog if rng.random() < 0.15 else pool
            item = rng.choice(src)
            key = (item["product_id"], item["variant_id"], item["branch_id"])
            if key not in seen:
                seen.add(key)
                picks.append(item)
        if not picks:
            continue

        lines, sub_total = [], 0
        for item in picks:
            qty = rng.choices([1, 2, 3], weights=[85, 12, 3])[0]
            qty = min(qty, max(1, item["on_hand"]))
            net = item["price"] * qty
            sub_total += net
            lines.append({**item, "quantity": qty, "net_amount": net})

        method = rng.choices([m for m, _ in PAYMENT_METHODS],
                             weights=[w for _, w in PAYMENT_METHODS])[0]
        orders.append({
            # Tiền tố POS- để phân biệt với đơn online (ORD-) khi soi dữ liệu
            "id": f"POS-{int(when.timestamp())}-{n:06d}",
            "customer": cust, "date": when, "lines": lines,
            "sub_total": sub_total,
            # Mua tại quầy, khách cầm hàng về — không có phí giao
            "shipping_fee": 0,
            "total": sub_total,
            "payment_method": method,
            "province": rng.choice(PROVINCES),
        })
    return orders


def insert_orders(conn, cur, orders, batch_size, update_inventory):
    written = 0
    for i in range(0, len(orders), batch_size):
        batch = orders[i:i + batch_size]

        execute_values(cur, """
            INSERT INTO "Order"
              (id, customer, customer_id, total, discount, "shippingFee", "subTotal",
               status, date, payment_method, payment_status, paid_at, paid_amount, province)
            VALUES %s
            ON CONFLICT (id) DO NOTHING
        """, [(
            o["id"],
            json.dumps({"name": o["customer"]["name"], "email": o["customer"]["email"],
                        "phone": o["customer"]["phone"]}, ensure_ascii=False),
            o["customer"]["id"], o["total"], 0, o["shipping_fee"], o["sub_total"],
            # Bán tại quầy là xong ngay: COMPLETED + PAID. Đây cũng đúng điều
            # kiện dbt cần để dòng chảy được tới AI-Rec.
            "COMPLETED", o["date"], o["payment_method"], "PAID", o["date"], o["total"],
            o["province"],
        ) for o in batch])

        execute_values(cur, """
            INSERT INTO "OrderItem"
              (order_id, product_id, product_name, category_id, brand_id, branch_id,
               variant_id, quantity, unit_price, discount, net_amount)
            VALUES %s
        """, [(
            o["id"], ln["product_id"], ln["name"], ln["category_id"], ln["brand_id"],
            ln["branch_id"], ln["variant_id"], ln["quantity"], ln["price"], 0, ln["net_amount"],
        ) for o in batch for ln in o["lines"]])

        if update_inventory:
            # Trừ tồn có điều kiện ngay trong UPDATE, không đọc-rồi-ghi. Máy POS
            # chạy song song với gian hàng online nên vẫn phải chống tranh chấp.
            execute_values(cur, """
                UPDATE "Inventory" AS inv SET on_hand = inv.on_hand - v.qty, updated_at = NOW()
                FROM (VALUES %s) AS v(pid, vid, bid, qty)
                WHERE inv.product_id = v.pid::bigint
                  AND inv.variant_id = v.vid AND inv.branch_id = v.bid
                  AND inv.on_hand - inv.reserved >= v.qty
            """, [(ln["product_id"], ln["variant_id"], ln["branch_id"], ln["quantity"])
                  for o in batch for ln in o["lines"]])

        conn.commit()
        written += len(batch)
        print(f"  đã ghi {written}/{len(orders)} đơn", flush=True)
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description="Máy POS giả lập bắn đơn vào Postgres của Getshopy")
    ap.add_argument("--orders", type=int, default=200, help="số đơn cần sinh (mặc định 200)")
    ap.add_argument("--customers", type=int, default=20, help="số khách lấy từ DB (mặc định 20)")
    ap.add_argument("--catalog", type=int, default=80, help="số mặt hàng đưa vào quầy (mặc định 80)")
    ap.add_argument("--groups", type=int, default=8, help="số nhóm sở thích (mặc định 8)")
    ap.add_argument("--days", type=int, default=7, help="rải đơn trong bao nhiêu ngày gần đây")
    ap.add_argument("--batch-size", type=int, default=500)
    ap.add_argument("--seed", type=int, default=20260101,
                    help="hạt giống ngẫu nhiên — cùng seed cho ra cùng bộ đơn")
    ap.add_argument("--no-inventory", action="store_true", help="không trừ tồn kho")
    ap.add_argument("--stream", action="store_true",
                    help="chế độ liên tục: bắn đều tay để xem độ trễ CDC")
    ap.add_argument("--rate", type=float, default=6.0, help="đơn/phút khi --stream")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    cfg = db_config()
    print(f"kết nối {cfg['user']}@{cfg['host']}:{cfg['port']}/{cfg['dbname']}")

    try:
        conn = psycopg2.connect(**cfg)
    except psycopg2.Error as exc:
        print(f"không kết nối được: {exc}", file=sys.stderr)
        return 1

    conn.autocommit = False
    cur = conn.cursor()

    catalog = load_catalog(cur, args.catalog)
    customers = load_customers(cur, args.customers)
    print(f"quầy hàng: {len(catalog)} mặt hàng (lấy từ tồn kho) · {len(customers)} khách")

    if not catalog:
        print("Không có mặt hàng nào còn tồn. Chạy seed trước.", file=sys.stderr)
        return 1
    if not customers:
        print('Không có khách nào trong "B2CCustomer". Chạy seed-demo.js trước.', file=sys.stderr)
        return 1
    if len(customers) < 3:
        # Không phải lỗi, nhưng nói trước còn hơn để người dùng tự hỏi vì sao
        # gợi ý toàn hàng bán chạy.
        print(f"  ! chỉ có {len(customers)} khách — collaborative filtering cần vài khách "
              "mua chồng lấn nhau mới có gì để học.")

    try:
        if args.stream:
            gap = 60.0 / max(args.rate, 0.1)
            print(f"chế độ liên tục: ~{args.rate} đơn/phút, Ctrl-C để dừng")
            n = 0
            while True:
                one = build_orders(rng, catalog, customers, 1, 1, args.groups)
                if one:
                    insert_orders(conn, cur, one, 1, not args.no_inventory)
                    n += 1
                    print(f"  [{datetime.now():%H:%M:%S}] đơn {one[0]['id']} "
                          f"· {one[0]['total']:,}đ · {len(one[0]['lines'])} dòng (tổng {n})")
                time.sleep(gap)
        else:
            orders = build_orders(rng, catalog, customers, args.orders, args.days, args.groups)
            lines = sum(len(o["lines"]) for o in orders)
            print(f"sinh {len(orders)} đơn / {lines} dòng hàng, rải trong {args.days} ngày")
            written = insert_orders(conn, cur, orders, args.batch_size, not args.no_inventory)
            revenue = sum(o["total"] for o in orders)
            print(f"\nxong: {written} đơn · {lines} dòng · doanh thu {revenue:,}đ")
            print("CDC sẽ đẩy sang Kafka trong vài giây; dbt chạy theo lịch 5 phút.")
    except KeyboardInterrupt:
        print("\ndừng theo yêu cầu.")
    except psycopg2.Error as exc:
        conn.rollback()
        print(f"lỗi CSDL, đã rollback mẻ đang dở: {exc}", file=sys.stderr)
        return 1
    finally:
        cur.close()
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
