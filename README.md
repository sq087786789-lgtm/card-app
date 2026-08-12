# 名片管家 CardApp

拍照 → 自動 OCR 讀取 → 搜尋 → 匯出 vCard 的極簡名片管理 PWA。

## 功能

- 📷 拍照 / 上傳名片圖片，自動 OCR 辨識（中文 + 英文）
- 🧠 自動解析欄位：姓名 / 公司 / 職稱 / 電話 / Email / 網站 / 地址
- ✏️ OCR 結果可手動校正後儲存
- 🔍 全文搜尋（搜全部欄位 + OCR 原文，命中會 highlight）
- 📥📤 vCard (.vcf) 匯入匯出，與手機通訊錄互通
- 📱 PWA：可加到 iOS / Android 主畫面像 APP 一樣用
- 🔒 純前端，資料存 IndexedDB（不上雲、不外傳）

## 技術

- 單檔 HTML + CSS + 原生 JS
- [Tesseract.js](https://tesseract.projectnaptha.com/) 5.x（瀏覽器內 OCR）
- IndexedDB 本地儲存
- Service Worker 離線可用

## 本地開發

```bash
python3 -m http.server 8765 --bind 0.0.0.0
# 開 http://localhost:8765
```

## 部署

GitHub Pages：`Settings → Pages → Source: main / root`

## 已知限制

- Tesseract 中文辨識率約 60-70%，模糊的話 OCR 完可手動校正
- 首次使用會下載約 10MB 中文語言包，需網路一次，之後離線可用
- OCR 在瀏覽器主執行緒，會卡 1-3 秒（手機慢一點）

## License

MIT