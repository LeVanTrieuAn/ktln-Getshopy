#!/bin/bash
# compress-texture-wsl.sh
# ════════════════════════════════════════════════════════════════
# Chạy trong WSL2 Ubuntu — nén texture WebP trong GLB (tránh bug
# libvips colorspace=32 trên Windows native).
#
# Cách dùng (từ PowerShell):
#   wsl -d Ubuntu -- bash /mnt/d/khóa-luận-tốt-nghiệp/qu-n-ly-ban-l/source/client/scripts/compress-texture-wsl.sh
# ════════════════════════════════════════════════════════════════

set -e

# ── Đường dẫn (WSL mount) ─────────────────────────────────────────
ASSETS="/mnt/d/khóa-luận-tốt-nghiệp/qu-n-ly-ban-l/source/client/src/assets"

GLB_FILES=(
  "Meshy_AI_Create_a_clean_reali_0814034508_texture.glb"
  "Meshy_AI_Create_a_highly_detai_0814020033_texture.glb"
  "Meshy_AI_Create_a_highly_detai_0814022556_texture.glb"
  "Meshy_AI_Create_a_highly_detai_0814023145_texture.glb"
  "Meshy_AI_Create_a_highly_detai_0814024521_texture.glb"
)

# ── Kiểm tra gltf-transform ───────────────────────────────────────
if ! command -v gltf-transform &> /dev/null; then
  echo "❌  gltf-transform chưa cài. Đang cài..."
  npm install -g @gltf-transform/cli
fi

GT_VER=$(gltf-transform --version 2>/dev/null | tr -d '\n')
echo "🔧  gltf-transform $GT_VER"
echo "📦  Mode: WebP texture compress (quality 85)"
echo ""
echo "🗜️  GLB Texture Compression"
echo "─────────────────────────────────────────────────────────────"

TOTAL_BEFORE=0
TOTAL_AFTER=0

for FILE in "${GLB_FILES[@]}"; do
  INPUT="$ASSETS/$FILE"
  TMP="$ASSETS/__wsl_tex_$FILE"

  if [ ! -f "$INPUT" ]; then
    echo "⚠️  Bỏ qua (không tìm thấy): $FILE"
    continue
  fi

  BEFORE=$(stat -c%s "$INPUT")
  TOTAL_BEFORE=$((TOTAL_BEFORE + BEFORE))
  BEFORE_MB=$(echo "scale=2; $BEFORE/1048576" | bc)

  echo ""
  echo "🔄  $FILE"
  echo "    Trước: ${BEFORE_MB} MB"

  # Nén texture sang WebP — chỉ baseColor + metallicRoughness (bỏ normalMap)
  # normalMap là linear space, đôi khi gây lỗi — dùng --slots để filter
  if gltf-transform webp "$INPUT" "$TMP" --quality 85 2>/dev/null; then
    if [ -f "$TMP" ]; then
      AFTER=$(stat -c%s "$TMP")
      AFTER_MB=$(echo "scale=2; $AFTER/1048576" | bc)
      SAVED=$((BEFORE - AFTER))
      PCT=$(echo "scale=1; ($SAVED*100)/$BEFORE" | bc)

      if [ "$AFTER" -lt "$BEFORE" ]; then
        mv "$TMP" "$INPUT"
        TOTAL_AFTER=$((TOTAL_AFTER + AFTER))
        echo "    Sau:   ${AFTER_MB} MB  (-${PCT}%)"
        echo "    ✅  OK"
      else
        rm -f "$TMP"
        TOTAL_AFTER=$((TOTAL_AFTER + BEFORE))
        echo "    ⚡  Không giảm được, bỏ qua"
      fi
    else
      TOTAL_AFTER=$((TOTAL_AFTER + BEFORE))
      echo "    ⚡  Không có output"
    fi
  else
    rm -f "$TMP" 2>/dev/null
    TOTAL_AFTER=$((TOTAL_AFTER + BEFORE))
    echo "    ❌  Lỗi khi compress"

    # Thử fallback: chỉ compress baseColorTexture
    echo "    🔁  Thử fallback (chỉ baseColorTexture)..."
    if gltf-transform webp "$INPUT" "$TMP" --quality 85 --slots "baseColorTexture" 2>/dev/null && [ -f "$TMP" ]; then
      AFTER=$(stat -c%s "$TMP")
      if [ "$AFTER" -lt "$BEFORE" ]; then
        mv "$TMP" "$INPUT"
        TOTAL_AFTER=$((TOTAL_AFTER - BEFORE + AFTER))
        AFTER_MB=$(echo "scale=2; $AFTER/1048576" | bc)
        PCT=$(echo "scale=1; (($BEFORE-$AFTER)*100)/$BEFORE" | bc)
        echo "    Sau:   ${AFTER_MB} MB  (-${PCT}%) [baseColor only]"
        echo "    ✅  OK (partial)"
      else
        rm -f "$TMP"
      fi
    else
      rm -f "$TMP" 2>/dev/null
    fi
  fi
done

echo ""
echo "─────────────────────────────────────────────────────────────"
TOTAL_BEFORE_MB=$(echo "scale=2; $TOTAL_BEFORE/1048576" | bc)
TOTAL_AFTER_MB=$(echo "scale=2; $TOTAL_AFTER/1048576" | bc)
TOTAL_SAVED=$((TOTAL_BEFORE - TOTAL_AFTER))
if [ "$TOTAL_BEFORE" -gt 0 ]; then
  PCT=$(echo "scale=1; ($TOTAL_SAVED*100)/$TOTAL_BEFORE" | bc)
  echo "📊  Tổng: ${TOTAL_BEFORE_MB} MB → ${TOTAL_AFTER_MB} MB  (-${PCT}%)"
  SAVED_MB=$(echo "scale=2; $TOTAL_SAVED/1048576" | bc)
  echo "💾  Tiết kiệm: ${SAVED_MB} MB"
fi
echo ""
echo "✨  Hoàn thành!"
