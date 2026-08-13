#!/bin/bash
# OCR 一張圖並自動產出配套檔案
# 用法：./ocr-one.sh <image-filename>
# 範例：./ocr-one.sh S__12345.jpg
#
# 此腳本是輔助說明文件。實際 OCR 由 M3 在 Discord 對話中處理：
#   1. 你丟圖到 inbox/
#   2. 說「OCR <檔名>」
#   3. M3 讀圖、產 card-XXX.json + 複製圖到 images/
#   4. M3 更新 cards.json、push 到 GitHub
#   5. 你手機 PWA 開啟自動看到新名片

set -e
INBOX="/opt/data/workspace/card-app/inbox"
IMAGES="/opt/data/workspace/card-app/images"

if [ $# -ne 1 ]; then
    echo "用法: $0 <image-filename>"
    echo "例如: $0 S__12345.jpg"
    exit 1
fi

SRC="$INBOX/$1"
if [ ! -f "$SRC" ]; then
    echo "❌ 找不到 $SRC"
    exit 1
fi

# 找下一個編號
NEXT=$(ls "$IMAGES"/card-*.jpg 2>/dev/null | sed 's/.*card-0*\([0-9]*\)\.jpg/\1/' | sort -n | tail -1)
NEXT=${NEXT:-0}
NEXT=$((NEXT + 1))
NEWID=$(printf "card-%03d" $NEXT)

echo "將 $1 → $NEWID"
echo "  圖：$IMAGES/$NEWID.jpg"
echo "  json：$INBOX/$NEWID.json"
echo ""
echo "下一步："
echo "  1. 跟 M3 說「OCR $1」讓它讀圖"
echo "  2. M3 會產 $NEWID.json 並複製圖到 images/"
echo "  3. M3 更新 cards.json、push GitHub"