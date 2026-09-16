"""
============================================================
MLOps Fine-tuning Script — Getshopy Intent Classifier
File: server/src/scripts/train_mlops.py
============================================================

Script này thực hiện việc Fine-tune model Hugging Face
(mDeBERTa-v3-base-mnli-xnli) với dữ liệu chat thực tế
của Getshopy được Admin gán nhãn trên Admin Panel.

Cách chạy:
  python train_mlops.py \\
    --dataset training_dataset.jsonl \\
    --base-model MoritzLaurer/mDeBERTa-v3-base-mnli-xnli \\
    --output-dir ./fine-tuned-model \\
    --epochs 3

Hoặc test nhanh trên local (không cần GPU):
  python train_mlops.py --demo
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# ── Import thư viện (có fallback graceful) ────────────────────────────────────
try:
    import torch
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer,
        DataCollatorWithPadding,
    )
    from datasets import Dataset
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, f1_score
    HAS_DEPS = True
except ImportError as e:
    print(f"[WARNING] Thiếu thư viện: {e}")
    print("[INFO] Chạy: pip install transformers torch datasets scikit-learn accelerate")
    HAS_DEPS = False

# ── Danh sách 49 Intent Labels (khớp với huggingface.js) ─────────────────────
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

LABEL2ID = {label: idx for idx, label in enumerate(INTENT_LABELS)}
ID2LABEL = {idx: label for label, idx in LABEL2ID.items()}


def load_dataset_from_file(path: str):
    """Tải dataset từ file JSONL (mỗi dòng: {"text": "...", "label": "INTENT"})"""
    data = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                if 'text' in row and 'label' in row and row['label'] in LABEL2ID:
                    data.append({'text': row['text'], 'label': LABEL2ID[row['label']]})
            except json.JSONDecodeError:
                continue
    print(f"[DataLoad] Tải được {len(data)} mẫu từ {path}")
    return data


def get_demo_dataset():
    """Dataset mẫu nhỏ để test script (không cần DB)"""
    return [
        {"text": "Xin chào shop", "label": LABEL2ID["GREETING"]},
        {"text": "Hello, bên shop có bán iPhone 15 không?", "label": LABEL2ID["SEARCH_PRODUCT"]},
        {"text": "Giá iPhone 15 bao nhiêu tiền?", "label": LABEL2ID["ASK_PRICE"]},
        {"text": "Laptop Dell XPS cấu hình như nào?", "label": LABEL2ID["ASK_SPECS"]},
        {"text": "Ship hàng về Đà Nẵng mất bao lâu?", "label": LABEL2ID["ASK_DELIVERY"]},
        {"text": "Đổi trả hàng trong bao nhiêu ngày?", "label": LABEL2ID["ASK_RETURN"]},
        {"text": "Có flashsale không shop?", "label": LABEL2ID["ASK_PROMO"]},
        {"text": "Thanh toán bằng MoMo được không?", "label": LABEL2ID["ASK_PAYMENT"]},
        {"text": "iPhone 15 vs Samsung S24 cái nào tốt hơn?", "label": LABEL2ID["COMPARE_PRODUCT"]},
        {"text": "Còn hàng AirPods Pro không shop?", "label": LABEL2ID["CHECK_STOCK"]},
        {"text": "Cho mình hủy đơn hàng được không?", "label": LABEL2ID["CANCEL_ORDER"]},
        {"text": "Theo dõi đơn hàng của mình ở đâu?", "label": LABEL2ID["TRACK_ORDER"]},
        {"text": "Mua số lượng lớn có được chiết khấu không?", "label": LABEL2ID["BULK_ORDER"]},
        {"text": "Mình cần giao ngay hôm nay được không?", "label": LABEL2ID["URGENT_NEED"]},
        {"text": "Giá này cao quá, có giảm không?", "label": LABEL2ID["PRICE_COMPLAINT"]},
        {"text": "Cảm ơn shop, dịch vụ tốt lắm!", "label": LABEL2ID["FEEDBACK_POSITIVE"]},
        {"text": "Laptop này chơi game được không?", "label": LABEL2ID["ASK_GAMING"]},
        {"text": "iPhone 15 Pro Max pin dùng được mấy tiếng?", "label": LABEL2ID["ASK_BATTERY"]},
        {"text": "Gợi ý cho mình laptop tầm 20 triệu", "label": LABEL2ID["ASK_RECOMMEND"]},
        {"text": "Đặt trước iPhone 16 được không?", "label": LABEL2ID["ASK_PREORDER"]},
    ] * 5  # Nhân 5 để có đủ data demo


def compute_metrics(eval_pred):
    """Tính accuracy và F1-score sau mỗi epoch"""
    predictions, labels = eval_pred
    predictions = predictions.argmax(axis=-1)
    acc = accuracy_score(labels, predictions)
    f1  = f1_score(labels, predictions, average='weighted', zero_division=0)
    print(f"\n📊 Accuracy: {acc:.3f} | F1-Score: {f1:.3f}")
    return {"accuracy": acc, "f1": f1}


def train(args):
    """Hàm Fine-tuning chính"""
    if not HAS_DEPS:
        print("[ERROR] Thiếu dependencies. Chạy: pip install transformers torch datasets scikit-learn")
        sys.exit(1)

    print("=" * 60)
    print("🤖 Getshopy MLOps — Intent Classifier Fine-tuning")
    print("=" * 60)
    print(f"📦 Base Model  : {args.base_model}")
    print(f"📁 Dataset     : {args.dataset}")
    print(f"📂 Output Dir  : {args.output_dir}")
    print(f"🔄 Epochs      : {args.epochs}")
    print(f"📦 Batch Size  : {args.batch_size}")
    print(f"💡 Device      : {'CUDA (GPU)' if torch.cuda.is_available() else 'CPU'}")
    print("=" * 60)

    # ── 1. Tải Dataset ─────────────────────────────────────────
    if args.demo:
        print("\n[Demo Mode] Dùng dataset mẫu tích hợp (không cần DB)")
        all_data = get_demo_dataset()
    else:
        all_data = load_dataset_from_file(args.dataset)

    if len(all_data) < 10:
        print(f"[ERROR] Cần ít nhất 10 mẫu dữ liệu, chỉ có {len(all_data)}.")
        sys.exit(1)

    # Train/Validation split 80/20
    train_data, val_data = train_test_split(all_data, test_size=0.2, random_state=42, stratify=None)
    print(f"\n✅ Train: {len(train_data)} mẫu | Validation: {len(val_data)} mẫu")

    # ── 2. Tải Tokenizer và Model gốc ─────────────────────────
    print(f"\n⬇️  Đang tải model từ Hugging Face: {args.base_model} ...")
    start_time = time.time()

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    model     = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        num_labels=len(INTENT_LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        ignore_mismatched_sizes=True,
    )
    print(f"✅ Model tải xong! ({time.time() - start_time:.1f}s)")

    # ── 3. Tokenize Dataset ────────────────────────────────────
    def tokenize(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=128,
            padding=False,
        )

    train_ds = Dataset.from_list(train_data).map(tokenize, batched=True)
    val_ds   = Dataset.from_list(val_data).map(tokenize, batched=True)

    # ── 4. Cấu hình Training ───────────────────────────────────
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        warmup_ratio=0.1,
        weight_decay=0.01,
        logging_dir=f"{args.output_dir}/logs",
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        push_to_hub=False,
        report_to="none",
        fp16=torch.cuda.is_available(),  # Dùng FP16 nếu có GPU
    )

    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    # ── 5. Bắt đầu Training ────────────────────────────────────
    print("\n🏋️  Bắt đầu Fine-tuning...\n")
    trainer.train()

    # ── 6. Lưu model xuống local ───────────────────────────────
    print(f"\n💾 Lưu model vào {args.output_dir}...")
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    # Lưu intent labels để dùng về sau
    with open(f"{args.output_dir}/intent_labels.json", 'w') as f:
        json.dump(INTENT_LABELS, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("✅ Fine-tuning hoàn thành!")
    print(f"📁 Model đã lưu tại: {args.output_dir}")
    print(f"🚀 Bước tiếp theo: Chạy push_to_hub.py để upload lên Hugging Face Hub")
    print("=" * 60)


def push_to_hub(model_dir: str, repo_id: str, hf_token: str, commit_message: str = "Auto-trained by MLOps"):
    """Push model lên Hugging Face Hub"""
    try:
        from huggingface_hub import HfApi
        api = HfApi(token=hf_token)
        api.create_repo(repo_id=repo_id, exist_ok=True, private=False)
        api.upload_folder(
            folder_path=model_dir,
            repo_id=repo_id,
            commit_message=commit_message,
        )
        print(f"✅ Model đã được push lên: https://huggingface.co/{repo_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Push to Hub failed: {e}")
        return False


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Getshopy MLOps — Intent Classifier Fine-tuning')
    parser.add_argument('--dataset',    default='training_dataset.jsonl', help='Đường dẫn tới file JSONL')
    parser.add_argument('--base-model', default='MoritzLaurer/mDeBERTa-v3-base-mnli-xnli', help='Model gốc')
    parser.add_argument('--output-dir', default='./fine-tuned-model', help='Thư mục lưu model')
    parser.add_argument('--epochs',     type=int, default=3, help='Số epochs')
    parser.add_argument('--batch-size', type=int, default=16, help='Batch size')
    parser.add_argument('--demo',       action='store_true', help='Chạy với dataset demo (không cần DB)')
    parser.add_argument('--push-hub',   action='store_true', help='Push lên HF Hub sau khi train xong')
    parser.add_argument('--hub-repo',   default='', help='HF repo ID (e.g. username/model-name)')
    args = parser.parse_args()

    train(args)

    if args.push_hub and args.hub_repo:
        hf_token = os.environ.get('HF_TOKEN', '')
        if not hf_token:
            print("[ERROR] Cần biến môi trường HF_TOKEN để push lên Hub")
        else:
            push_to_hub(
                model_dir=args.output_dir,
                repo_id=args.hub_repo,
                hf_token=hf_token,
            )
