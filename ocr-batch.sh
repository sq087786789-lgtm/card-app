#!/bin/bash
# 名片 OCR 批次處理
# 用法：
#   ./ocr-batch.sh                    # 處理 inbox/ 所有圖
#   ./ocr-batch.sh image1.jpg image2  # 處理指定檔
#
# 輸出（在 inbox/ 同目錄下）：
#   card-001.json  結構化欄位
#   card-001.vcf   vCard 格式（可直接匯入通訊錄）
#   card-001.txt   OCR 原始文字

set -e
INBOX="/opt/data/workspace/card-app/inbox"
mkdir -p "$INBOX"

# 收集要處理的圖
if [ $# -eq 0 ]; then
    cd "$INBOX"
    IMAGES=(*.jpg *.jpeg *.png *.JPG *.PNG 2>/dev/null)
    # 去重 + 過濾不存在的 glob
    IMAGES=($(printf "%s\n" "${IMAGES[@]}" | sort -u | grep -v '^\*\.' || true))
else
    IMAGES=("$@")
fi

if [ ${#IMAGES[@]} -eq 0 ]; then
    echo "inbox/ 沒有圖片可處理"
    exit 0
fi

echo "準備處理 ${#IMAGES[@]} 張圖："
printf '  %s\n' "${IMAGES[@]}"
echo ""
echo "⚠️  此腳本只是輔助說明。實際 OCR 請在 Discord 對話中跟 M3 說「OCR 這幾張」。"
echo ""
ls -la "$INBOX/"