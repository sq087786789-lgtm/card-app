# 名片管家 CardApp

> 新版「管理員與員工共用名片庫」位於 [v2/](v2/README.md)。新版包含可操作試用介面及 Google 登入／Drive／圖片辨識的伺服器程式；外部服務需完成設定與實測後才可正式使用。此處舊版繼續保留。

拍照 → 自動 OCR 讀取 → 搜尋 → 匯出 vCard 的極簡名片管理 PWA。

## OCR 流程

由 M3 在雲端人工處理：
1. 把拍好的名片圖丟到 `inbox/` 資料夾
2. 跟 M3 說「OCR 這幾張」
3. M3 產出 `card-XXX.json`（結構化）+ 複製圖到 `images/`
4. M3 更新 `cards.json` + push 到 GitHub
5. PWA 開啟時自動從 GitHub 同步

> 已移除 Tesseract.js 與 LLM Vision API 兩種自動引擎，純粹 M3 人工 OCR，準度最高、不用花 API 錢。

## 功能

- 📷 拍照 / 上傳（圖存手機，OCR 由雲端 M3 處理）
- ✏️ 手動校正 + 儲存（任何時候都能編輯欄位）
- 🔍 全文搜尋（命中 highlight）
- 📥📤 vCard (.vcf) 匯入匯出，與手機通訊錄互通
- 📱 PWA：可加到 iOS/Android 主畫面
- 🔒 純前端，名片資料存 IndexedDB + GitHub 公開 cards.json

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
