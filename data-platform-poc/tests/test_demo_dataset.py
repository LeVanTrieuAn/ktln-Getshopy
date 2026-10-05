"""Test logic của demo_dataset.py trên catalog giả trong RAM — không cần Postgres.

Chạy trong image seed (có numpy):
    docker compose --profile seed run --rm seed-data -m unittest discover -s tests -v

Kiểm các bất biến mà dữ liệu sai sẽ làm vỡ pipeline ÂM THẦM: dbt chỉ lấy đơn PAID và không
CANCELLED, so tiền theo total = subTotal + ship − discount, nạp bằng mã đơn duy nhất.
"""

import json
import os
import re
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import demo_dataset as dd  # noqa: E402

PARENTS = ["cat-phone", "cat-tablet", "cat-watch", "cat-laptop", "cat-camera",
           "cat-mobile-acc", "cat-laptop-acc", "cat-av"]
BRANDS = ["br-apple", "br-samsung", "br-anker"]
PRICES = [2_000_000, 9_000_000, 20_000_000, 35_000_000]


def fake_items(per_combo=3):
    items, pid = [], 1000
    for parent in PARENTS:
        for brand in BRANDS:
            for price in PRICES:
                for k in range(per_combo):
                    pid += 1
                    rows = [("v1", "", price), ("v2", "", price + 1_000_000)] if k % 2 else [("", "", price)]
                    items.append({"pid": pid, "parent": parent, "child": parent + "-leaf", "brand_id": brand,
                                  "band": dd.price_band(price), "name": f"SP {pid}", "stock_rows": rows})
    return items


def make(argv=()):
    a = dd.parse_args(["--customers", "40", "--orders", "1600", "--days", "120",
                       "--end", "2026-10-01T00:00:00", *argv])
    uni = dd.build_universe(fake_items(), a.seed, a.latent_dim, a.pop_sigma)
    start, end = dd.window(a)
    return a, uni, start, end


def generate(a, uni, start, end):
    profiles = [dd.draw_profile(i, uni, a, start, end) for i in range(a.customers)]
    for k, p in enumerate(profiles):
        p.customer_id = 10_000 + k
    alloc = dd.allocate_orders(np.array([p.lam * (end - p.signup) for p in profiles]), a.orders, a.seed)
    ids = dd.OrderIds()
    orders, items = [], []
    for p, n in zip(profiles, alloc):
        o, i, _ = dd.customer_orders(p, int(n), uni, a, start, end, ids)
        orders += o
        items += i
    return profiles, alloc, orders, items


class PureHelpers(unittest.TestCase):
    def test_price_band_matches_dbt_thresholds(self):
        cases = {0: "lt5", 4_999_999: "lt5", 5_000_000: "5to15", 14_999_999: "5to15",
                 15_000_000: "15to30", 29_999_999: "15to30", 30_000_000: "gt30", 99_000_000: "gt30"}
        for price, band in cases.items():
            self.assertEqual(dd.price_band(price), band, price)

    def test_allocation_is_exact_and_deterministic(self):
        w = np.array([1.0, 0.0, 3.5, 2.0, 0.25])
        a1 = dd.allocate_orders(w, 10_000, 7)
        self.assertEqual(int(a1.sum()), 10_000)
        self.assertEqual(int(a1[1]), 0)                      # trọng số 0 → không có đơn
        self.assertTrue(np.array_equal(a1, dd.allocate_orders(w, 10_000, 7)))
        self.assertEqual(int(dd.allocate_orders(w, 0, 7).sum()), 0)

    def test_universe_sampling_is_stratified_and_stable(self):
        meta = [(i, PARENTS[i % 3], BRANDS[i % 2], "lt5") for i in range(300)]
        s1 = dd.sample_universe(meta, 5, 42)
        self.assertEqual(s1, dd.sample_universe(meta, 5, 42))
        cells = {}
        for i in s1:
            cells.setdefault(meta[i][1:], []).append(i)
        self.assertEqual(len(cells), 6)
        self.assertTrue(all(len(v) == 5 for v in cells.values()))

    def test_copy_sql_keeps_empty_strings_and_quotes_camel_case(self):
        sql = dd.copy_sql("OrderItem", dd.ITEM_COLUMNS, dd.ITEM_FORCE_NOT_NULL)
        self.assertIn('FORCE_NOT_NULL ("branch_id", "variant_id")', sql)
        self.assertIn('"shippingFee"', dd.copy_sql("Order", dd.ORDER_COLUMNS))
        self.assertIn('"subTotal"', dd.copy_sql("Order", dd.ORDER_COLUMNS))


class Orders(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a, cls.uni, cls.start, cls.end = make()
        cls.profiles, cls.alloc, cls.orders, cls.items = generate(cls.a, cls.uni, cls.start, cls.end)
        cls.col = {c: k for k, c in enumerate(dd.ORDER_COLUMNS)}
        cls.icol = {c: k for k, c in enumerate(dd.ITEM_COLUMNS)}

    def test_total_order_count_is_exact(self):
        self.assertEqual(len(self.orders), self.a.orders)

    def test_ids_unique_and_well_formed(self):
        ids = [o[self.col["id"]] for o in self.orders]
        self.assertEqual(len(ids), len(set(ids)))
        for oid in ids:
            self.assertRegex(oid, r"^(ORD-\d{20}|POS-\d{10}-\d{7})$")

    def test_money_adds_up(self):
        lines = {}
        for it in self.items:
            self.assertEqual(it[self.icol["net_amount"]], it[self.icol["unit_price"]] * it[self.icol["quantity"]])
            lines.setdefault(it[0], []).append(it[self.icol["net_amount"]])
        for o in self.orders:
            c = self.col
            self.assertEqual(o[c["subTotal"]], sum(lines[o[c["id"]]]))
            self.assertEqual(o[c["total"]], o[c["subTotal"]] + o[c["shippingFee"]] - o[c["discount"]])
            if o[c["id"]].startswith("POS-"):
                self.assertEqual(o[c["shippingFee"]], 0)
            else:
                expect = dd.SHIPPING_FEE.get(o[c["province"]], dd.SHIPPING_FEE_DEFAULT)
                self.assertEqual(o[c["shippingFee"]], expect)

    def test_status_and_payment_are_consistent(self):
        c = self.col
        for o in self.orders:
            self.assertIn(o[c["status"]], dd.ORDER_STATUSES)
            self.assertIn(o[c["payment_status"]], dd.PAYMENT_STATUSES)
            paid = o[c["payment_status"]] == "PAID"
            self.assertEqual(paid, o[c["paid_at"]] is not None)
            self.assertEqual(o[c["paid_amount"]], o[c["total"]] if paid else None)
            if paid:
                self.assertGreaterEqual(o[c["paid_at"]], o[c["date"]])
            if o[c["id"]].startswith("POS-"):
                self.assertEqual((o[c["status"]], o[c["payment_status"]]), ("COMPLETED", "PAID"))
            if o[c["status"]] == "CANCELLED":
                self.assertFalse(paid)
        statuses = {o[c["status"]] for o in self.orders}
        self.assertTrue({"DELIVERED", "COMPLETED", "CANCELLED"} <= statuses)

    def test_dates_inside_window_and_after_signup(self):
        c = self.col
        lo, hi = dd.ts(self.start), dd.ts(self.end)
        signup = {p.customer_id: dd.ts(p.signup) for p in self.profiles}
        for o in self.orders:
            self.assertTrue(lo <= o[c["date"]] <= hi)
            self.assertGreaterEqual(o[c["date"]], signup[o[c["customer_id"]]][:13])

    def test_snapshot_carries_seed_marker(self):
        c = self.col
        for o in self.orders[:500]:
            snap = json.loads(o[c["customer"]])
            self.assertEqual(snap["_seed"], dd.SEED_TAG)
            if o[c["id"]].startswith("ORD-"):
                self.assertEqual(snap["province"], o[c["province"]])
                self.assertTrue({"full_name", "phone", "email", "address"} <= set(snap))

    def test_items_reference_universe(self):
        pids = set(int(p) for p in self.uni.pid)
        ic = self.icol
        for it in self.items:
            self.assertIn(it[ic["product_id"]], pids)
            self.assertIn(it[ic["variant_id"]], ("", "v1", "v2"))
            self.assertEqual(it[ic["branch_id"]], "")

    def test_same_seed_same_dataset(self):
        _, _, orders2, items2 = generate(self.a, self.uni, self.start, self.end)
        self.assertEqual(self.orders, orders2)
        self.assertEqual(self.items, items2)

    def test_onboarding_answers_are_valid_choices(self):
        bands = {b for b, _ in dd.PRICE_BANDS}
        seen = 0
        for p in self.profiles:
            if p.onboarding is None:
                continue
            seen += 1
            o = p.onboarding
            self.assertTrue(set(o["liked_categories"]) <= set(self.uni.cats))
            self.assertTrue(set(o["liked_brands"]) <= set(self.uni.brands))
            self.assertIn(o["price_band"], bands)
            self.assertFalse(set(o["disliked_categories"]) & set(o["liked_categories"]))
        self.assertGreater(seen, 0)


class Bundles(unittest.TestCase):
    def test_device_lines_pull_an_accessory_when_prob_is_one(self):
        a, uni, start, end = make(["--bundle-prob", "1.0"])
        p = dd.draw_profile(0, uni, a, start, end)
        p.customer_id = 1
        orders, items, stats = dd.customer_orders(p, 200, uni, a, start, end, dd.OrderIds())
        parent_of = {int(pid): uni.cats[int(c)] for pid, c in zip(uni.pid, uni.c_of)}
        by_order = {}
        for it in items:
            by_order.setdefault(it[0], []).append(parent_of[it[1]])
        for parents in by_order.values():
            for dev, acc in dd.DEVICE_ACCESSORY.items():
                if dev in parents:
                    self.assertIn(acc, parents)
        self.assertGreater(stats.bundle_lines, 0)


class Persona(unittest.TestCase):
    def test_test_account_buys_mostly_its_brand(self):
        a, uni, start, end = make()
        acct = {"id": 5, "name": "Khách Test", "email": "test@getshopy.vn", "phone": "0900000000"}
        prof = dd.persona_profile(uni, {"apple": "br-apple"}, start, end, acct)
        _, items, _ = dd.customer_orders(prof, 200, uni, a, start, end, dd.OrderIds())
        brands = [it[dd.ITEM_COLUMNS.index("brand_id")] for it in items]
        self.assertEqual(max(set(brands), key=brands.count), "br-apple")


if __name__ == "__main__":
    unittest.main()
