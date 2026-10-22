# 我的名片：Google 個人版

[開啟名片網站](https://sq087786789-lgtm.github.io/card-app/) · [直接進入私人名片庫](https://script.google.com/macros/s/AKfycbxW7uPyY5JyhaTZHYGPrg9z_OKdDaNAPYlXqPADlS95al-1PKyuP5YZZ7JS_2XW91qU/exec)

目前使用 Google Apps Script 第 6 版，僅供管理員本人使用。Google 直接登入；Sheets 保存名片欄位，私人 Drive 保存正反面照片，Cloud Vision 讀取文字。使用方式：拍照或選圖 → 按辨識 → 核對欄位 → 儲存。

GitHub Pages 提供新版入口；私人資料與辨識 API 在 Google 執行，不在公開網站存放。完整 App 程式在 [google/](google/README.md)，憑證只在私人 Script Properties，沒有提交 GitHub。程式碼變更仍須另外部署 Apps Script，合併 GitHub 不會自動修改 Google 後端。

## 舊版撤下與資料保留

舊版名片介面、人工 OCR 腳本、舊伺服器及公開 cards.json／images 已從目前版本撤下。舊 Git 版本可回復，沒有清除 Git 歷史。

原手機瀏覽器的 IndexedDB 名片不會被刪除。若尚未搬移，請在原手機開啟 [舊資料匯出](https://sq087786789-lgtm.github.io/card-app/data-recovery.html)，下載 JSON，再到 Google 版「更多 → 備份與匯入」匯入。匯出工具只讀本機資料及本 App 圖片快取，不上傳、同步或呼叫 OCR。沒有快取的舊網址照片需重新補上。

sw.js 撤換舊快取優先程式，只刷新此名片網站，不清除 IndexedDB 或照片快取，也不影響同帳號的裝車助手等其他工具。舊手機主畫面圖示若仍顯示舊頁，連網重新開啟後會更新。

## 辨識及用量

Cloud Vision 的獨立金鑰只允許此 API，不回退 Gemini。App 採 900 張圖片／滾動 32 天上限，先持久預扣，失敗不自動重試；相同照片重用結果。此上限只管本 App，不涵蓋帳務內其他使用。沒有升級現有 Google Cloud 免費試用帳戶。詳見 [Vision 設定及驗證](google/VISION.md)。

## 維護與驗證

- `node google/test.mjs`：Google 個人版及 Vision 行為測試。
- `node scripts/check-pages.mjs`：舊資料唯讀匯出與 Service Worker 更新範圍。
- `node google/build.mjs`：由 v2/public 的共用介面元件建置 google/Index.html；此產物不進 Git。
- v2/ 保留為建置來源及歷史實作，沒有新版網站入口。GitHub Pages 由 .github/workflows/pages.yml 發布；scripts/build-pages.mjs 僅打包入口、唯讀匯出頁、更新腳本與圖示，不發布 google/、v2/ 或資料檔。_config.yml 另保留分支發布時的排除設定。
- iPhone 相機／HEIC 及多 Google 帳號仍需實機驗收。不要將私人聯絡資料、照片備份或金鑰提交公開儲存庫。

MIT
