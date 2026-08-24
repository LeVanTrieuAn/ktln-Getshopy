"""
============================================================
BENCHMARK AI — Getshopy 3 AI Models
File: server/src/scripts/benchmark_ai.py
============================================================

Đo hiệu năng 3 AI model của Getshopy:
  1. mDeBERTa Intent Classifier (HuggingFace zero-shot)
  2. Qwen2.5-7B LLM Chat Response (featherless-ai)
  3. Gemini 2.5 Flash Visual Search (Google AI)

Cách chạy:
  # Đo tất cả
  python benchmark_ai.py --all

  # Đo từng model
  python benchmark_ai.py --test-intent
  python benchmark_ai.py --test-llm
  python benchmark_ai.py --test-vision

  # Đo nhanh (không cần API key) — chỉ rule-based
  python benchmark_ai.py --test-intent --offline
"""

import argparse
import json
import os
import sys
import time
import statistics
from pathlib import Path
from datetime import datetime

# ── Load .env thủ công ────────────────────────────────────────────────────────
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

HF_API_KEY    = os.environ.get('HF_API_KEY', '')
GOOGLE_AI_KEY = os.environ.get('GOOGLE_AI_KEY', '')
HF_MODEL      = os.environ.get('HF_MODEL', 'MoritzLaurer/mDeBERTa-v3-base-mnli-xnli')
HF_LLM_MODEL  = os.environ.get('HF_LLM_MODEL', 'Qwen/Qwen2.5-7B-Instruct')
GEMINI_MODEL  = 'gemini-2.5-flash-lite'  # flash-lite: miễn phí, nhanh hơn

SCRIPT_DIR = Path(__file__).parent

# ── Import thư viện ───────────────────────────────────────────────────────────
try:
    import urllib.request
    import urllib.error
    import unicodedata
    import re
    HAS_STDLIB = True
except ImportError:
    HAS_STDLIB = False

# ─────────────────────────────────────────────────────────────────────────────
# INTENT LABELS (49 labels — khớp với huggingface.js)
# ─────────────────────────────────────────────────────────────────────────────
INTENT_LABELS = [
    'GREETING', 'HELP', 'CONTACT', 'SMALLTALK', 'FEEDBACK_POSITIVE',
    'SEARCH_PRODUCT', 'SEARCH_CATEGORY', 'ASK_PRICE', 'ASK_SPECS', 'ASK_ACCESSORIES',
    'ASK_RECOMMEND', 'ASK_BEST_SELLER', 'ASK_NEW_ARRIVAL', 'ASK_PREORDER',
    'ASK_CAMERA', 'ASK_BATTERY', 'ASK_DISPLAY', 'ASK_STORAGE', 'ASK_CONNECTIVITY',
    'ASK_GAMING', 'ASK_WATERPROOF', 'ASK_OS', 'ASK_DESIGN', 'ASK_COMPATIBILITY',
    'ASK_PROMO', 'ASK_DELIVERY', 'ASK_RETURN', 'ASK_PAYMENT', 'ASK_REVIEW',
    'ASK_INVOICE', 'ASK_GIFT', 'ASK_GIFT_WRAP', 'ASK_LOYALTY',
    'ASK_SECOND_HAND', 'ASK_AUTHENTIC', 'ASK_TRADE_IN', 'ASK_REPAIR',
    'COMPARE_PRODUCT', 'COMPARE_SPECS', 'COMPARE_ACCESSORIES',
    'CHECK_STOCK', 'TRACK_ORDER', 'CANCEL_ORDER', 'CHANGE_PRODUCT',
    'PRICE_COMPLAINT', 'COMPLAINT', 'BULK_ORDER', 'URGENT_NEED', 'UNKNOWN',
]

# ─────────────────────────────────────────────────────────────────────────────
# RULE-BASED PRE-CLASSIFIER (mirror của huggingface.js)
# ─────────────────────────────────────────────────────────────────────────────
def remove_diacritics(s):
    """Bỏ dấu tiếng Việt để so sánh pattern"""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('đ', 'd').replace('Đ', 'D')
    return s

def pre_classify(message):
    """Rule-based classifier — mirror logic từ huggingface.js"""
    norm = remove_diacritics(message).lower().strip()

    # GREETING
    if re.match(r'^(xin chao|hello|hi|hey|alo|chao|chao ban|chao shop|shop oi|em oi|co ai khong|alo shop|good morning|good evening|chao em|ban oi)[!.,?\s]*$', norm):
        return {'intent': 'GREETING', 'score': 1.0, 'source': 'rule'}

    # Ngân sách + danh mục
    if re.search(r'(dien thoai|smartphone|iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|dong ho|may tinh bang|tablet|airpods|loa)', norm) and \
       re.search(r'(duoi|tam|khoang|tu|den|gia|trieu|k\b|nghin|budget|bao nhieu)', norm):
        return {'intent': 'SEARCH_PRODUCT', 'score': 0.92, 'source': 'rule'}

    # Mua sản phẩm
    if re.search(r'(muon mua|can mua|tim mua|mua ngay|mua|order|dat mua|chot mua|cho minh xem).{0,30}(iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|airpods|android|ios|dien thoai|smartphone|tablet|dong ho|loa)', norm) or \
       re.search(r'(iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|airpods|dien thoai).{0,30}(muon mua|can mua|tim mua|mua ngay|mua)', norm):
        return {'intent': 'SEARCH_PRODUCT', 'score': 0.92, 'source': 'rule'}

    # Có sản phẩm không
    if re.search(r'co\s+.{2,30}\s+(khong|nao|gi)', norm) or \
       re.search(r'(tim|can mua|muon mua|dang can|can tim|cho minh|ban co|shop co|shop ban|cho xem|minh xem).{2,40}(khong|duoc khong|ko|k\b|iphone|samsung|dien thoai|laptop|may tinh|tai nghe|airpods|tablet|dong ho|smartphone)', norm):
        return {'intent': 'SEARCH_PRODUCT', 'score': 0.88, 'source': 'rule'}

    # Giao hàng (đặt TRƯỚC giá)
    if re.search(r'(giao hang|ship|van chuyen|free ship|phi ship|delivery|shipping|bao lau giao|bao lau|khi nao nhan|nhan hang|giao nhanh|giao hom nay|express|hoa toc)', norm):
        return {'intent': 'ASK_DELIVERY', 'score': 0.92, 'source': 'rule'}

    # Giá
    if re.search(r'(bao nhieu tien|bao nhieu|cost|price|how much)', norm) or re.search(r'\bgia\b', norm):
        return {'intent': 'ASK_PRICE', 'score': 0.88, 'source': 'rule'}

    # Gợi ý
    if re.search(r'(tu van|goi y|nen mua|mua gi|chon gi|recommend|suggest|gioi thieu|ban nghi|chon con nao|con nao tot|nen chon|may nao tot|may nao phu hop)', norm):
        return {'intent': 'ASK_RECOMMEND', 'score': 0.90, 'source': 'rule'}

    # So sánh
    if re.search(r'(so sanh|khac nhau|khac gi|hay la|vs\b|versus|con nao hon|cai nao hon|between|hay|hoac)', norm) and \
       re.search(r'(dien thoai|laptop|may tinh|iphone|samsung|tai nghe|may tinh bang|may anh)', norm):
        return {'intent': 'COMPARE_PRODUCT', 'score': 0.90, 'source': 'rule'}

    # Bán chạy / mới nhất
    if re.search(r'(ban chay|pho bien|hot nhat|ban nhieu|bestseller|best seller|nhieu nguoi mua|moi nhat|moi ve|hang moi|san pham moi|new arrival|vua ra|moi ra mat)', norm):
        if re.search(r'moi|new|vua ra|moi ra', norm):
            return {'intent': 'ASK_NEW_ARRIVAL', 'score': 0.90, 'source': 'rule'}
        return {'intent': 'ASK_BEST_SELLER', 'score': 0.90, 'source': 'rule'}

    # Tồn kho
    if re.search(r'(con hang|con khong|con may cai|het hang|out of stock|in stock|ton kho|con san pham|con do khong|available)', norm):
        return {'intent': 'CHECK_STOCK', 'score': 0.92, 'source': 'rule'}

    # Theo dõi đơn
    if re.search(r'(don hang|tra hang|kiem tra don|trang thai don|order cua|theo doi don|don cua toi|don cua minh|track order|where is my order)', norm):
        return {'intent': 'TRACK_ORDER', 'score': 0.95, 'source': 'rule'}

    # Hủy đơn
    if re.search(r'huy don|cancel order|khong muon mua nua|huy mua', norm):
        return {'intent': 'CANCEL_ORDER', 'score': 0.95, 'source': 'rule'}

    # Thanh toán
    if re.search(r'(thanh toan|chuyen khoan|tra gop|installment|momo|vnpay|zalopay|atm|visa|mastercard|cod|tien mat|cash|payment|tra truoc)', norm):
        return {'intent': 'ASK_PAYMENT', 'score': 0.92, 'source': 'rule'}

    # Bảo hành / đổi trả
    if re.search(r'(bao hanh|doi tra|tra hang|loi may|hong may|repair|warranty|loi|bi loi|bi hong|khong dung|kem chat luong)', norm):
        return {'intent': 'ASK_RETURN', 'score': 0.90, 'source': 'rule'}

    # Khuyến mãi
    if re.search(r'(khuyen mai|flash sale|giam gia|sale|coupon|voucher|ma giam|uu dai|deal|promo|discount|co sale khong)', norm):
        return {'intent': 'ASK_PROMO', 'score': 0.90, 'source': 'rule'}

    # Camera
    if re.search(r'(camera|chup anh|chup hinh|photo|megapixel|quay phim|quay video|selfie|lens|ong kinh|chup dep)', norm):
        return {'intent': 'ASK_CAMERA', 'score': 0.90, 'source': 'rule'}

    # Pin
    if re.search(r'(pin|sac|battery|mah|dung luong pin|sac nhanh|sac khong day|wireless charging|tai sao het pin|pin lau|pin trau)', norm):
        return {'intent': 'ASK_BATTERY', 'score': 0.90, 'source': 'rule'}

    # Màn hình
    if re.search(r'(man hinh|display|screen|inch|resolution|oled|amoled|lcd|refresh rate|hz|do sang|do phan giai)', norm):
        return {'intent': 'ASK_DISPLAY', 'score': 0.90, 'source': 'rule'}

    # RAM / bộ nhớ
    if re.search(r'(bo nho|ram|rom|storage|gb|tb|dung luong|the nho|nang cap bo nho|internal|external)', norm):
        return {'intent': 'ASK_STORAGE', 'score': 0.90, 'source': 'rule'}

    # Gaming
    if re.search(r'(game|choi game|gaming|pubg|lien quan|free fire|genshin|ping|fps|lag|giat|do hoa|phan cung choi game)', norm):
        return {'intent': 'ASK_GAMING', 'score': 0.90, 'source': 'rule'}

    # Kết nối
    if re.search(r'(5g|wifi|bluetooth|usb|type-c|lightning|nfc|sim|esim|ket noi|hotspot|mang)', norm):
        return {'intent': 'ASK_CONNECTIVITY', 'score': 0.88, 'source': 'rule'}

    # Chống nước
    if re.search(r'(chong nuoc|waterproof|water resistant|ip67|ip68|kha nang chiu nuoc)', norm):
        return {'intent': 'ASK_WATERPROOF', 'score': 0.92, 'source': 'rule'}

    # Thiết kế
    if re.search(r'(thiet ke|mau sac|color|mau|dep khong|nang bao nhieu|trong luong|material|chat lieu|kim loai|kinh|nhua|mau gi)', norm):
        return {'intent': 'ASK_DESIGN', 'score': 0.85, 'source': 'rule'}

    # Chính hãng
    if re.search(r'(chinh hang|hang chinh|authentic|nguon goc|xuat xu|bao dam|cam ket|fake|hang nhai|gia mao)', norm):
        return {'intent': 'ASK_AUTHENTIC', 'score': 0.92, 'source': 'rule'}

    # Thu cũ
    if re.search(r'(thu cu|doi cu|trade in|trade-in|cu doi moi|ban may cu|gia thu cu)', norm):
        return {'intent': 'ASK_TRADE_IN', 'score': 0.92, 'source': 'rule'}

    # Đặt trước
    if re.search(r'(dat truoc|pre-order|preorder|khi nao ra|sap ra mat|ngay ra mat|cho dat truoc)', norm):
        return {'intent': 'ASK_PREORDER', 'score': 0.90, 'source': 'rule'}

    # Sỉ
    if re.search(r'(si|so luong lon|bulk|nhieu cai|100 cai|gia si|mua si|mua nhieu|gia tot cho so luong)', norm):
        return {'intent': 'BULK_ORDER', 'score': 0.90, 'source': 'rule'}

    # Gấp
    if re.search(r'(gap|khan cap|hom nay|chieu nay|ngay bay gio|luon|can ngay|urgent|nhanh nhat)', norm):
        return {'intent': 'URGENT_NEED', 'score': 0.88, 'source': 'rule'}

    # Mặc cả
    if re.search(r'(dat qua|mac qua|giam them|bot duoc khong|mac ca|thuong luong|gia tot hon|giam gia cho|roi gia chua|gia nhu vay|qua mac)', norm):
        return {'intent': 'PRICE_COMPLAINT', 'score': 0.90, 'source': 'rule'}

    # Phàn nàn
    if re.search(r'(phan nan|khieu nai|that vong|qua te|kem chat luong|bi lua|bi gian|toi te|complaint|dich vu kem|khong hai long|sai san pham|sai mau|thieu)', norm):
        return {'intent': 'COMPLAINT', 'score': 0.90, 'source': 'rule'}

    # Khen
    if re.search(r'(cam on|tuyet voi|rat tot|dich vu tot|5 sao|hai long|ung y|shop tot|nhanh that|giao nhanh that|than thien|nhiet tinh|pro|chuyen nghiep)', norm):
        return {'intent': 'FEEDBACK_POSITIVE', 'score': 0.90, 'source': 'rule'}

    # Liên hệ
    if re.search(r'(lien he|dia chi|so dien thoai|hotline|email|facebook|zalo|trang web|website|cua hang|showroom|o dau|o cho nao)', norm):
        return {'intent': 'CONTACT', 'score': 0.90, 'source': 'rule'}

    # Tích điểm
    if re.search(r'(tich diem|diem thuong|thanh vien|loyalty|member|uu tien|doi diem|su dung diem)', norm):
        return {'intent': 'ASK_LOYALTY', 'score': 0.90, 'source': 'rule'}

    # Quà tặng
    if re.search(r'(qua tang|tang kem|bao bi|goi qua|hop qua|gift|present|tang|nhan qua)', norm):
        return {'intent': 'ASK_GIFT', 'score': 0.88, 'source': 'rule'}

    # Hóa đơn VAT
    if re.search(r'(hoa don|vat|invoice|xuat hoa don|bill|receipt|phieu mua hang)', norm):
        return {'intent': 'ASK_INVOICE', 'score': 0.92, 'source': 'rule'}

    # Sửa chữa
    if re.search(r'(sua chua|sua may|bao duong|sua|sua phone|sua laptop|trung tam bao hanh|dich vu sua)', norm):
        return {'intent': 'ASK_REPAIR', 'score': 0.90, 'source': 'rule'}

    # Hàng cũ
    if re.search(r'(hang cu|may cu|second hand|cu like new|con cu|refurbished|qua su dung)', norm):
        return {'intent': 'ASK_SECOND_HAND', 'score': 0.90, 'source': 'rule'}

    return None


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS: HTTP request (stdlib, không cần requests)
# ─────────────────────────────────────────────────────────────────────────────
def http_post(url, headers, body_dict, timeout=30):
    """POST JSON bằng urllib thuần, trả về (status_code, response_dict)"""
    data = json.dumps(body_dict).encode('utf-8')
    req  = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode('utf-8'))
        except Exception:
            body = {}
        return e.code, body
    except Exception as e:
        return 0, {'error': str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# BENCHMARK 1: mDeBERTa Intent Classifier
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_intent(dataset_path, offline=False, max_samples=None, verbose=False):
    """
    Đo hiệu năng Intent Classifier:
    - Rule-based coverage và accuracy
    - HuggingFace API latency và accuracy (nếu không offline)
    """
    print("\n" + "="*60)
    print("📊 BENCHMARK 1: mDeBERTa Intent Classifier")
    print("="*60)

    # Load dataset
    samples = []
    with open(dataset_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    samples.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    if max_samples:
        samples = samples[:max_samples]

    print(f"📦 Dataset: {len(samples)} mẫu từ {dataset_path}")
    print(f"🔧 Mode: {'Offline (rule-based only)' if offline else 'Full (rule + HF API)'}")

    # ── Bước 1: Rule-based evaluation ────────────────────────────────────────
    print("\n🔍 Bước 1: Đánh giá Rule-based Classifier...")
    rule_results = []
    rule_correct = 0
    rule_covered = 0
    rule_latencies = []

    for s in samples:
        text = s['text']
        gt   = s['label']
        t0   = time.perf_counter()
        res  = pre_classify(text)
        lat  = (time.perf_counter() - t0) * 1000  # ms
        rule_latencies.append(lat)

        if res is not None:
            rule_covered += 1
            predicted = res['intent']
            correct   = predicted == gt
            if correct:
                rule_correct += 1
            rule_results.append({
                'text': text, 'gt': gt, 'predicted': predicted,
                'correct': correct, 'latency_ms': lat, 'source': 'rule'
            })
        else:
            rule_results.append({
                'text': text, 'gt': gt, 'predicted': None,
                'correct': False, 'latency_ms': lat, 'source': 'fallback'
            })

    coverage     = rule_covered / len(samples) * 100
    rule_acc     = rule_correct / rule_covered * 100 if rule_covered > 0 else 0
    avg_rule_lat = statistics.mean(rule_latencies)

    print(f"  ✅ Coverage (rule xử lý được): {rule_covered}/{len(samples)} = {coverage:.1f}%")
    print(f"  ✅ Accuracy (rule đúng/rule có KQ): {rule_correct}/{rule_covered} = {rule_acc:.1f}%")
    print(f"  ⚡ Latency rule: avg={avg_rule_lat:.3f}ms (gần như 0ms — pure Python regex)")

    # ── Bước 2: HuggingFace API evaluation ───────────────────────────────────
    api_results = []
    if not offline:
        if not HF_API_KEY or not HF_API_KEY.startswith('hf_'):
            print(f"\n⚠️  HF_API_KEY chưa cấu hình — bỏ qua API benchmark")
        else:
            # Lấy những câu mà rule KHÔNG xử lý được (cần gọi API)
            needs_api = [s for s, r in zip(samples, rule_results) if r['predicted'] is None]
            if not needs_api:
                print(f"\nℹ️  Tất cả {len(samples)} câu đều được rule xử lý — không cần gọi API")
            else:
                print(f"\n🌐 Bước 2: Gọi HuggingFace API cho {len(needs_api)} câu (rule không xử lý)...")
                api_url     = f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}"
                api_headers = {
                    'Authorization': f'Bearer {HF_API_KEY}',
                    'Content-Type': 'application/json',
                }
                api_correct  = 0
                api_latencies = []

                for i, s in enumerate(needs_api):
                    text = s['text']
                    gt   = s['label']
                    print(f"  [{i+1}/{len(needs_api)}] '{text[:50]}...' → ", end='', flush=True)
                    t0  = time.perf_counter()
                    status, resp = http_post(api_url, api_headers, {
                        'inputs': text,
                        'parameters': {
                            'candidate_labels': INTENT_LABELS,
                            'multi_label': False,
                        }
                    }, timeout=15)
                    lat = (time.perf_counter() - t0) * 1000

                    if status != 200:
                        print(f"❌ HTTP {status}")
                        api_results.append({'text': text, 'gt': gt, 'predicted': None, 'correct': False, 'latency_ms': lat, 'source': 'api_error'})
                        continue

                    # Parse response
                    labels, scores = [], []
                    if isinstance(resp, list):
                        labels = [r['label'] for r in resp]
                        scores = [r['score'] for r in resp]
                    elif 'labels' in resp:
                        labels = resp['labels']
                        scores = resp['scores']

                    predicted = labels[0] if labels else 'UNKNOWN'
                    score     = scores[0] if scores else 0
                    if score < 0.35:
                        predicted = 'UNKNOWN'

                    correct = predicted == gt
                    if correct:
                        api_correct += 1
                    api_latencies.append(lat)

                    print(f"{predicted} {'✓' if correct else '✗'} ({score:.2f}) {lat:.0f}ms")

                    api_results.append({
                        'text': text, 'gt': gt, 'predicted': predicted,
                        'correct': correct, 'latency_ms': lat, 'source': 'api',
                        'score': score
                    })
                    time.sleep(0.2)  # Rate limit

                if api_latencies:
                    api_acc = api_correct / len(needs_api) * 100
                    api_lat_sorted = sorted(api_latencies)
                    p50 = api_lat_sorted[len(api_lat_sorted)//2]
                    p90 = api_lat_sorted[int(len(api_lat_sorted)*0.9)]
                    p99 = api_lat_sorted[int(len(api_lat_sorted)*0.99)] if len(api_lat_sorted) >= 100 else api_lat_sorted[-1]

                    print(f"\n  🌐 API Accuracy: {api_correct}/{len(needs_api)} = {api_acc:.1f}%")
                    print(f"  ⚡ API Latency: p50={p50:.0f}ms | p90={p90:.0f}ms | p99={p99:.0f}ms")
                    print(f"  ⚡ API Latency avg: {statistics.mean(api_latencies):.0f}ms")

    # ── Tổng hợp kết quả ─────────────────────────────────────────────────────
    # Tính overall accuracy (rule đúng + API đúng) / tổng có kết quả
    all_with_result = [r for r in rule_results if r['predicted'] is not None] + api_results
    overall_correct = sum(1 for r in all_with_result if r['correct'])
    overall_acc = overall_correct / len(samples) * 100 if samples else 0

    # F1 per-class (simplified weighted)
    from collections import defaultdict
    tp_map = defaultdict(int)
    fp_map = defaultdict(int)
    fn_map = defaultdict(int)
    for r in all_with_result:
        gt, pred = r['gt'], r['predicted']
        if gt == pred:
            tp_map[gt] += 1
        else:
            fp_map[pred] += 1
            fn_map[gt]  += 1

    f1_scores = {}
    for label in INTENT_LABELS:
        tp = tp_map[label]
        fp = fp_map[label]
        fn = fn_map[label]
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0
        rec  = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1   = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
        f1_scores[label] = f1

    # Weighted F1
    label_counts = defaultdict(int)
    for s in samples:
        label_counts[s['label']] += 1
    total = sum(label_counts.values())
    weighted_f1 = sum(f1_scores[l] * label_counts[l] / total for l in INTENT_LABELS if total > 0)

    print("\n" + "─"*60)
    print("📊 KẾT QUẢ TỔNG HỢP — Intent Classifier")
    print("─"*60)
    intent_summary = {
        'model': HF_MODEL,
        'total_samples': len(samples),
        'rule_coverage_pct': round(coverage, 2),
        'rule_accuracy_pct': round(rule_acc, 2),
        'rule_avg_latency_ms': round(avg_rule_lat, 4),
        'overall_accuracy_pct': round(overall_acc, 2),
        'weighted_f1': round(weighted_f1, 4),
    }
    if api_results and api_latencies:
        intent_summary['api_accuracy_pct']  = round(api_acc, 2)
        intent_summary['api_p50_ms']        = round(p50, 1)
        intent_summary['api_p90_ms']        = round(p90, 1)
        intent_summary['api_avg_latency_ms']= round(statistics.mean(api_latencies), 1)

    for k, v in intent_summary.items():
        print(f"  {k:<35} = {v}")

    # Per-class F1 (chỉ in những class có data)
    if verbose:
        print("\n📊 Per-class F1-Score:")
        for label in INTENT_LABELS:
            count = label_counts[label]
            if count > 0:
                print(f"  {label:<30} F1={f1_scores[label]:.3f} (n={count})")

    return intent_summary, rule_results + api_results


# ─────────────────────────────────────────────────────────────────────────────
# BENCHMARK 2: Qwen2.5-7B LLM
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_llm(num_requests=10):
    """
    Đo hiệu năng Qwen2.5-7B-Instruct:
    - Latency (TTFT — time to first token approximation, end-to-end)
    - Success rate
    - Token count trung bình
    - Tỉ lệ phản hồi tiếng Việt (không bị tiếng Trung)
    """
    print("\n" + "="*60)
    print("📊 BENCHMARK 2: Qwen2.5-7B-Instruct LLM")
    print("="*60)

    if not HF_API_KEY or not HF_API_KEY.startswith('hf_'):
        print("⚠️  HF_API_KEY chưa cấu hình — bỏ qua LLM benchmark")
        return None, []

    # Test prompts đa dạng (intent + context)
    test_cases = [
        {
            'intent': 'ASK_PRICE',
            'message': 'iPhone 15 Pro Max giá bao nhiêu?',
            'context_products': [
                {'name': 'iPhone 15 Pro Max 256GB', 'price': 34990000, 'stock': 15, 'rating': 4.8, 'sold': 234},
                {'name': 'iPhone 15 Pro Max 512GB', 'price': 39990000, 'stock': 8, 'rating': 4.9, 'sold': 89},
            ]
        },
        {
            'intent': 'ASK_RECOMMEND',
            'message': 'Tư vấn cho mình laptop gaming tầm 25 triệu',
            'context_products': [
                {'name': 'ASUS ROG Strix G16', 'price': 24990000, 'stock': 5, 'rating': 4.7, 'sold': 67},
                {'name': 'Lenovo LOQ 15', 'price': 22990000, 'stock': 12, 'rating': 4.5, 'sold': 123},
            ]
        },
        {
            'intent': 'COMPARE_PRODUCT',
            'message': 'Samsung S24 Ultra với iPhone 15 Pro Max cái nào tốt hơn?',
            'context_products': [
                {'name': 'Samsung Galaxy S24 Ultra', 'price': 31990000, 'stock': 20, 'rating': 4.8},
                {'name': 'iPhone 15 Pro Max 256GB', 'price': 34990000, 'stock': 15, 'rating': 4.8},
            ]
        },
        {
            'intent': 'ASK_DELIVERY',
            'message': 'Ship hàng về Đà Nẵng mất mấy ngày và phí là bao nhiêu?',
            'context_products': []
        },
        {
            'intent': 'COMPLAINT',
            'message': 'Máy mình mua 3 ngày trước bị lỗi màn hình rồi, phải làm sao?',
            'context_products': []
        },
        {
            'intent': 'ASK_PROMO',
            'message': 'Tháng này có flash sale gì hot không shop?',
            'context_products': [
                {'name': 'AirPods Pro 2nd Gen', 'price': 5990000, 'stock': 30, 'rating': 4.9},
            ]
        },
        {
            'intent': 'BULK_ORDER',
            'message': 'Công ty mình muốn mua 50 laptop, có giá sỉ không?',
            'context_products': []
        },
        {
            'intent': 'ASK_CAMERA',
            'message': 'Điện thoại nào chụp ảnh đêm đẹp nhất trong tầm 15 triệu?',
            'context_products': [
                {'name': 'Samsung Galaxy A55', 'price': 11990000, 'stock': 25, 'rating': 4.6},
                {'name': 'Oppo Find X7 Lite', 'price': 14990000, 'stock': 10, 'rating': 4.7},
            ]
        },
        {
            'intent': 'GREETING',
            'message': 'Xin chào shop, mình cần tư vấn sản phẩm',
            'context_products': []
        },
        {
            'intent': 'TRACK_ORDER',
            'message': 'Mình đặt hàng 3 ngày trước, bao giờ giao vậy shop?',
            'context_products': []
        },
    ][:num_requests]

    url     = 'https://router.huggingface.co/featherless-ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {HF_API_KEY}',
        'Content-Type': 'application/json',
    }

    fmt = lambda n: f"{n:,.0f}đ"

    results    = []
    latencies  = []
    token_counts = []
    success_count = 0
    vi_count    = 0

    for i, tc in enumerate(test_cases):
        msg  = tc['message']
        products = tc.get('context_products', [])
        intent = tc['intent']

        # Build system prompt (bản rút gọn)
        prod_lines = '\n'.join(
            f"- {p['name']}: {fmt(p['price'])}"
            + (f", tồn {p['stock']}" if 'stock' in p else '')
            + (f", ⭐{p['rating']}" if 'rating' in p else '')
            for p in products
        )
        system_prompt = (
            "Bạn là trợ lý AI mua sắm của Getshopy — cửa hàng điện tử tại TP.HCM.\n"
            "!!! NGÔN NGỮ BẮT BUỘC: CHỈ DÙNG TIẾNG VIỆT. Xưng 'em', gọi khách 'anh/chị'. !!!\n"
            "PHONG CÁCH: Nhiệt tình, ngắn gọn (2–3 câu), dùng emoji vừa phải.\n"
            + (f"\nSẢN PHẨM LIÊN QUAN:\n{prod_lines}\n" if prod_lines else "")
            + "\nCHÍNH SÁCH: Giao hàng 2–4h nội thành, bảo hành 12 tháng, đổi trả 7 ngày."
        )

        print(f"  [{i+1}/{len(test_cases)}] intent={intent} | '{msg[:45]}...' → ", end='', flush=True)

        t0 = time.perf_counter()
        status, resp = http_post(url, headers, {
            'model': HF_LLM_MODEL,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': msg},
            ],
            'temperature': 0.7,
            'max_tokens': 300,
            'top_p': 0.9,
            'stream': False,
        }, timeout=60)
        lat = (time.perf_counter() - t0) * 1000

        content       = None
        total_tokens  = 0
        is_vietnamese = False

        if status == 200:
            content = resp.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
            total_tokens = resp.get('usage', {}).get('total_tokens', 0)
            # Kiểm tra tiếng Việt (không có CJK)
            has_cjk = bool(re.search(r'[\u4e00-\u9fff\u3400-\u4dbf]', content or ''))
            is_vietnamese = bool(content) and not has_cjk
            if content:
                success_count += 1
                if is_vietnamese:
                    vi_count += 1

        latencies.append(lat)
        if total_tokens:
            token_counts.append(total_tokens)

        status_icon = '✓' if content and is_vietnamese else ('⚠' if content else '✗')
        lang_note   = '' if is_vietnamese else ' [non-VI!]'
        print(f"{status_icon} {lat:.0f}ms | tokens={total_tokens}{lang_note}")
        if content:
            print(f"       → {content[:80]}...")

        results.append({
            'intent': intent,
            'message': msg,
            'latency_ms': lat,
            'http_status': status,
            'content': content,
            'total_tokens': total_tokens,
            'is_vietnamese': is_vietnamese,
            'success': bool(content),
        })
        time.sleep(1)  # Rate limit

    # Tổng hợp
    lat_sorted   = sorted(latencies)
    n            = len(lat_sorted)
    p50          = lat_sorted[n//2]
    p90          = lat_sorted[int(n*0.9)]
    success_rate = success_count / len(test_cases) * 100
    vi_rate      = vi_count / success_count * 100 if success_count > 0 else 0
    avg_tokens   = statistics.mean(token_counts) if token_counts else 0

    print("\n" + "─"*60)
    print("📊 KẾT QUẢ TỔNG HỢP — Qwen2.5-7B LLM")
    print("─"*60)
    llm_summary = {
        'model': HF_LLM_MODEL,
        'total_requests': len(test_cases),
        'success_rate_pct': round(success_rate, 1),
        'vietnamese_rate_pct': round(vi_rate, 1),
        'avg_latency_ms': round(statistics.mean(latencies), 0),
        'p50_latency_ms': round(p50, 0),
        'p90_latency_ms': round(p90, 0),
        'avg_tokens_per_req': round(avg_tokens, 1),
    }
    for k, v in llm_summary.items():
        print(f"  {k:<35} = {v}")

    return llm_summary, results


# ─────────────────────────────────────────────────────────────────────────────
# BENCHMARK 3: Gemini 2.5 Flash Visual Search
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_vision():
    """
    Đo hiệu năng Gemini Vision:
    - Latency per request
    - Success rate (parse JSON thành công)
    - Field completeness (có category, brand, keywords không)
    - Accuracy: Dùng ảnh test có nhãn sẵn
    Lưu ý: Do không có ảnh binary sẵn, sẽ dùng ảnh placeholder (URL → base64)
    """
    print("\n" + "="*60)
    print("📊 BENCHMARK 3: Gemini 2.5 Flash Vision (Visual Search)")
    print("="*60)

    if not GOOGLE_AI_KEY:
        print("⚠️  GOOGLE_AI_KEY chưa cấu hình — bỏ qua Vision benchmark")
        return None, []

    GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

    # ── Tạo synthetic image data để test ─────────────────────────────────────
    # Dùng các ảnh product từ URLs phổ biến (fetch + encode base64)
    import base64
    import urllib.request as ureq

    test_images = [
        {
            'label': 'iPhone (Điện thoại thông minh)',
            'url': 'https://placehold.co/400x400/1a1a2e/ffffff?text=iPhone+15+Pro',
            'expected_category': 'Điện thoại thông minh',
        },
        {
            'label': 'Laptop (Máy tính xách tay)',
            'url': 'https://placehold.co/400x400/16213e/ffffff?text=MacBook+Pro',
            'expected_category': 'Máy tính xách tay',
        },
        {
            'label': 'Tai nghe (Thiết bị âm thanh)',
            'url': 'https://placehold.co/400x400/0f3460/ffffff?text=AirPods+Pro',
            'expected_category': 'Thiết bị âm thanh',
        },
    ]

    prompt = """Bạn là AI phân tích sản phẩm điện tử cho cửa hàng Getshopy Việt Nam.
Nhìn vào ảnh và xác định thông tin sản phẩm điện tử.

Danh mục hợp lệ:
- Điện thoại thông minh
- Máy tính xách tay
- Máy tính bảng
- Phụ kiện công nghệ
- Tivi & Thiết bị giải trí
- Máy ảnh & Quay phim
- Đồng hồ thông minh
- Gaming
- Thiết bị âm thanh
- Thiết bị văn phòng
- Linh kiện máy tính
- Nhà thông minh

Trả về JSON với các field: caption, category, brand, color, keywords (mảng 3-5 từ), description_vi"""

    results  = []
    latencies = []
    success_count = 0
    complete_count = 0

    for i, tc in enumerate(test_images):
        print(f"  [{i+1}/{len(test_images)}] {tc['label']} → ", end='', flush=True)

        # Fetch ảnh và encode base64
        try:
            with ureq.urlopen(tc['url'], timeout=10) as r:
                img_bytes = r.read()
            img_b64   = base64.b64encode(img_bytes).decode()
            mime_type = 'image/png'
        except Exception as e:
            print(f"❌ Fetch image failed: {e}")
            results.append({'label': tc['label'], 'success': False, 'error': str(e)})
            latencies.append(0)
            continue

        req_body = {
            'contents': [{'parts': [
                {'text': prompt},
                {'inline_data': {'mime_type': mime_type, 'data': img_b64}},
            ]}],
            'generationConfig': {
                'temperature': 0.1,
                'maxOutputTokens': 512,
                'responseMimeType': 'application/json',
            },
        }

        url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent?key={GOOGLE_AI_KEY}"
        headers = {'Content-Type': 'application/json'}

        t0     = time.perf_counter()
        status, resp = http_post(url, headers, req_body, timeout=30)
        lat    = (time.perf_counter() - t0) * 1000

        latencies.append(lat)
        content_text = None
        parsed = None

        if status == 200:
            content_text = (resp.get('candidates', [{}])[0]
                               .get('content', {})
                               .get('parts', [{}])[0]
                               .get('text', ''))
            # Parse JSON
            try:
                raw = content_text.strip()
                fence = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
                if fence:
                    raw = fence.group(1).strip()
                j_start = raw.find('{')
                if j_start >= 0:
                    raw = raw[j_start:]
                    if not raw.rstrip().endswith('}'):
                        raw = re.sub(r',?\s*$', '', raw) + '}'
                    parsed = json.loads(raw)
                    success_count += 1
                    # Kiểm tra completeness
                    has_all = all(k in parsed and parsed[k] for k in ['category', 'brand', 'keywords'])
                    if has_all:
                        complete_count += 1
            except json.JSONDecodeError:
                pass

        ok = parsed is not None
        cat = parsed.get('category', '?') if parsed else '?'
        brand = parsed.get('brand', '?') if parsed else '?'
        kws   = ', '.join(parsed.get('keywords', [])) if parsed else '?'
        print(f"{'✓' if ok else '✗'} {lat:.0f}ms | cat={cat} | brand={brand} | kws=[{kws[:40]}]")

        results.append({
            'label': tc['label'],
            'latency_ms': lat,
            'http_status': status,
            'success': ok,
            'category': cat,
            'brand': brand,
            'expected_category': tc['expected_category'],
            'correct_category': cat == tc['expected_category'] if ok else False,
        })
        time.sleep(1)

    # Tổng hợp
    valid_lat = [l for l in latencies if l > 0]
    lat_sorted = sorted(valid_lat) if valid_lat else [0]
    n = len(lat_sorted)
    success_rate   = success_count / len(test_images) * 100
    complete_rate  = complete_count / success_count * 100 if success_count else 0
    cat_correct    = sum(1 for r in results if r.get('correct_category'))
    cat_acc        = cat_correct / len([r for r in results if r['success']]) * 100 if success_count else 0

    print("\n" + "─"*60)
    print("📊 KẾT QUẢ TỔNG HỢP — Gemini Vision")
    print("─"*60)
    vision_summary = {
        'model': GEMINI_MODEL,
        'total_images': len(test_images),
        'success_rate_pct': round(success_rate, 1),
        'json_complete_rate_pct': round(complete_rate, 1),
        'category_accuracy_pct': round(cat_acc, 1),
        'avg_latency_ms': round(statistics.mean(valid_lat) if valid_lat else 0, 0),
        'p50_latency_ms': round(lat_sorted[n//2], 0),
        'p90_latency_ms': round(lat_sorted[int(n*0.9)], 0),
    }
    for k, v in vision_summary.items():
        print(f"  {k:<35} = {v}")

    return vision_summary, results


# ─────────────────────────────────────────────────────────────────────────────
# SAVE REPORT
# ─────────────────────────────────────────────────────────────────────────────
def save_report(intent_summary, llm_summary, vision_summary, all_results):
    """Lưu kết quả benchmark ra JSON + Markdown"""
    ts       = datetime.now().strftime('%Y%m%d_%H%M%S')
    out_dir  = SCRIPT_DIR
    json_out = out_dir / f'benchmark_results_{ts}.json'
    md_out   = out_dir / 'benchmark_report.md'

    report = {
        'timestamp': datetime.now().isoformat(),
        'models': {
            'intent_classifier': intent_summary,
            'llm_qwen': llm_summary,
            'gemini_vision': vision_summary,
        },
        'raw_results': all_results,
    }

    with open(json_out, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Kết quả JSON: {json_out}")

    # Markdown report
    lines = [
        "# Benchmark Report — Getshopy AI Models",
        f"\n**Ngày đo:** {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}",
        "\n---\n",
        "## 1. Intent Classifier (mDeBERTa)",
    ]
    if intent_summary:
        lines += [
            f"| Metric | Giá trị |",
            f"|--------|---------|",
        ]
        for k, v in intent_summary.items():
            lines.append(f"| {k} | {v} |")

    lines += ["\n## 2. LLM Chat Response (Qwen2.5-7B)"]
    if llm_summary:
        lines += ["| Metric | Giá trị |", "|--------|---------|"]
        for k, v in llm_summary.items():
            lines.append(f"| {k} | {v} |")

    lines += ["\n## 3. Visual Search (Gemini 2.5 Flash)"]
    if vision_summary:
        lines += ["| Metric | Giá trị |", "|--------|---------|"]
        for k, v in vision_summary.items():
            lines.append(f"| {k} | {v} |")

    lines += [
        "\n---",
        "\n## So sánh Latency (ms)",
        "| Model | p50 | p90 | avg |",
        "|-------|-----|-----|-----|",
    ]
    if intent_summary and 'api_p50_ms' in intent_summary:
        lines.append(f"| mDeBERTa (API) | {intent_summary.get('api_p50_ms','-')} | {intent_summary.get('api_p90_ms','-')} | {intent_summary.get('api_avg_latency_ms','-')} |")
    lines.append(f"| mDeBERTa (rule) | ≈0 | ≈0 | {intent_summary.get('rule_avg_latency_ms','-') if intent_summary else '-'} |")
    if llm_summary:
        lines.append(f"| Qwen2.5-7B | {llm_summary.get('p50_latency_ms','-')} | {llm_summary.get('p90_latency_ms','-')} | {llm_summary.get('avg_latency_ms','-')} |")
    if vision_summary:
        lines.append(f"| Gemini Vision | {vision_summary.get('p50_latency_ms','-')} | {vision_summary.get('p90_latency_ms','-')} | {vision_summary.get('avg_latency_ms','-')} |")

    with open(md_out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"📄 Báo cáo Markdown: {md_out}")

    return json_out, md_out


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Getshopy — AI Benchmark Suite')
    parser.add_argument('--all',          action='store_true', help='Chạy tất cả benchmark')
    parser.add_argument('--test-intent',  action='store_true', help='Benchmark Intent Classifier')
    parser.add_argument('--test-llm',     action='store_true', help='Benchmark Qwen LLM')
    parser.add_argument('--test-vision',  action='store_true', help='Benchmark Gemini Vision')
    parser.add_argument('--offline',      action='store_true', help='Chỉ đo rule-based (không cần API key)')
    parser.add_argument('--verbose',      action='store_true', help='In chi tiết per-class F1')
    parser.add_argument('--max-samples',  type=int, default=None, help='Giới hạn số mẫu (intent benchmark)')
    parser.add_argument('--llm-requests', type=int, default=10, help='Số requests cho LLM benchmark')
    parser.add_argument('--dataset',      default=str(SCRIPT_DIR / 'benchmark_dataset.jsonl'),
                        help='Đường dẫn đến file JSONL dataset')
    args = parser.parse_args()

    run_intent = args.all or args.test_intent
    run_llm    = args.all or args.test_llm
    run_vision = args.all or args.test_vision

    if not any([run_intent, run_llm, run_vision]):
        parser.print_help()
        print("\n💡 Ví dụ: python benchmark_ai.py --all")
        print("          python benchmark_ai.py --test-intent --offline")
        sys.exit(0)

    print("=" * 60)
    print("🤖 Getshopy — AI Benchmark Suite")
    print("=" * 60)
    print(f"⏰ Bắt đầu: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"🔑 HF_API_KEY:    {'✓ Có' if HF_API_KEY.startswith('hf_') else '✗ Thiếu'}")
    print(f"🔑 GOOGLE_AI_KEY: {'✓ Có' if GOOGLE_AI_KEY else '✗ Thiếu'}")

    intent_summary = llm_summary = vision_summary = None
    all_results = []

    if run_intent:
        intent_summary, intent_results = benchmark_intent(
            dataset_path=args.dataset,
            offline=args.offline,
            max_samples=args.max_samples,
            verbose=args.verbose,
        )
        all_results.extend(intent_results)

    if run_llm:
        llm_summary, llm_results = benchmark_llm(num_requests=args.llm_requests)
        all_results.extend(llm_results)

    if run_vision:
        vision_summary, vision_results = benchmark_vision()
        all_results.extend(vision_results)

    if any([intent_summary, llm_summary, vision_summary]):
        save_report(intent_summary, llm_summary, vision_summary, all_results)

    print("\n✅ Benchmark hoàn thành!")
    elapsed = time.perf_counter()
    print(f"⏱️  Kết thúc: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
