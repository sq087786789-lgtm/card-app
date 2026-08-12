# 名片管家 CardApp

拍照 → 自動 OCR 讀取 → 搜尋 → 匯出 vCard 的極簡名片管理 PWA。

## 三種 OCR 模式

### 🅰️ Tesseract（純前端，離線，預設）
- 免費，中文 60-70%，首次需網路下載 10MB 語言包

### 🅱️ LLM Vision API（最準，需後端）
- 需部署 `server/` 到 Railway/Render
- 設定裡填 API URL 即可

### 🅲️ 人工 OCR（M3 幫你讀，最準又免費）
1. 把拍好的名片圖丟到 `inbox/` 資料夾
2. 跟 M3 說「OCR 這幾張」
3. M3 產出 `card-XXX.json`（結構化）+ `card-XXX.vcf`（vCard）+ `card-XXX.txt`（OCR 原文）
4. PWA 設定 → 「📥 匯入 OCR 結果」→ 選 .json 檔 → 一鍵存進名片庫

## 功能

- 📷 拍照 / 上傳 → 自動 OCR
- 🧠 自動解析欄位（姓名/公司/職稱/電話/Email/網站/地址）
- ✏️ 手動校正 + 儲存
- 🔍 全文搜尋（命中 highlight）
- 📥📤 vCard (.vcf) 匯入匯出，與手機通訊錄互通
- 📱 PWA：可加到 iOS/Android 主畫面
- 🔒 純前端，資料存 IndexedDB

## 本地開發

```bash
python3 -m http.server 8765
# 開 http://localhost:8765
```

## 部署

GitHub Pages：`Settings → Pages → Source: main / root`
網址：https://sq087786789-lgtm.github.io/card-app

## License

MIT