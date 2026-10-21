# 公司名片庫：全 Google 後端

此目錄以 Google Apps Script 執行網站、Google Sheets 保存共用紀錄、Google Drive 保存私人照片。既有 Node v2 保留，兩個版本不共用資料庫。

## 狀態

後端與介面已實作，10 項隔離測試通過。2026-10-21 已取得管理員授權、初始化私人 Drive 資料夾與 Sheets、部署 Google Web App、完成真實管理員 OAuth 登入及名片寫入讀回。虛構照片已從管理員編輯器保存至 Drive，後端及 App 都能讀回；Gemini 成功辨識姓名「王小明」、公司「測試公司」、手機「0900-000-001」、Email「demo@example.com」，並保存至共用資料表。內建瀏覽器的選檔視窗未回應自動測試；iPhone 拍照及跨員工帳號仍待實機驗收。

Google 新名片專案的辨識呼叫回覆 402 預付額度不足，未啟用付款。經管理員明確核准，驗證改用既有 `gen-lang-client-0257505168`（Free tier）新增的名片 App 獨立金鑰；保留原有金鑰不變。模型為 `gemini-3.5-flash-lite`。免費內容可能用於服務改善，因此目前僅授權虛構名片辨識驗證；介面取消上傳後自動辨識，按辨識前需確認。實際客戶名片可先私人保存、手動填寫，正式自動辨識的資料使用方案仍需另行決定。沒有開啟訂閱、預付或付費帳務。

已修正實測發現的登入畫面 DOM 遺失、Apps Script 內嵌頁面自行 reload 空白、模型將單筆名片回傳陣列等問題。現在保留表單與事件處理器，登入後直接載入資料；辨識要求固定 JSON 物件結構、兼容單筆陣列，並拒絕空結果及多筆名片。

## 本機驗證及建置

```text
node google/test.mjs
node google/build.mjs
```

建置會產生 `google/Index.html`，由既有 v2 操作介面轉接 Google 的 `google.script.run`，不在瀏覽器保存名片資料副本。登入憑證是隨機、可撤銷的 session token，僅存 sessionStorage；每次請求從管理員的 Sheets 檢查成員是否啟用。

## Google 專案設定

1. 在管理員 sq087786789@gmail.com 建立 Apps Script 專案。放入 Code.gs、Index.html、appsscript.json，啟用 manifest 宣告的 Drive v3 進階服務。
2. manifest 要求 drive.file、spreadsheets、script.external_request、userinfo.email。Drive 檔案權限限此 App 建立／開啟的檔案；試算表服務的授權範圍較廣，但程式只使用設定中的 DATABASE_ID。由管理員確認 Google 授權。
3. 從編輯器執行 initialize。它另檢查呼叫者的 ActiveUser 是固定管理員，再呼叫私有 setup_ 建立「公司名片庫」資料夾及試算表；再次執行沿用既有 ID。不把 execute-as-owner 的 EffectiveUser 當成訪客。`setup_` 和所有帶底線的 helper 都不能透過 google.script.run 呼叫。
4. 以管理員身分執行 Web App；網頁入口需要可接收 Google OAuth 回呼。所有名片 API 另檢查 session 與成員名單，不將公開登入頁等同開放名片資料。
5. 在已建立的 Google Cloud 專案 card-library-sq087-20261021 建立 Web OAuth client。redirect URI 必須精確等於部署得到的 Apps Script `/exec` URL，登入只要求 openid email。測試階段加入管理員及實際測試員工，長期使用再依 Google 政策發布。
6. 在 Apps Script 專案設定的「指令碼屬性」設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GEMINI_API_KEY、GEMINI_MODEL。機密不放進 Code.gs、Index.html 或 GitHub。FOLDER_ID、DATABASE_ID 由 setup_ 寫入，勿任意覆蓋。
7. 測試管理員登入、新增照片及儲存、重啟頁面、另一裝置讀取、員工新增與修改、停用既有 session、回收筒、衝突、完整備份還原與真實圖片辨識。員工不需取得管理員 Drive 密碼。

## 資料及權限

- 所有欄位以 JSON 字串保存到同一張 Sheets 的 type/id/json 三欄，避免將聯絡欄位解讀成公式。
- mutation 使用 ScriptLock 並檢查 revision；圖片先存私人 Drive，再儲存關聯。Drive 或 Sheets 錯誤會回報，不以瀏覽器假資料代替成功。
- 員工可查看、新增及修改名片；完整備份、回收筒及成員管理限管理員。
- 名片 photoId 由後端映射實際 Drive fileId，API 不接受任意雲端檔案 ID。圖片透過驗證後的 RPC 傳送，不建立公開分享連結。
- Google OAuth 使用 state、PKCE、5 分鐘有效期和一次性結果；回呼只把結果保存在伺服器，原 App 以登入流程的隨機 secret 輪詢領取。OAuth code、session 及 API key 不放入 App 網址。
- Apps Script、Sheets 與 Gemini 有配額。本版適合小團隊先驗證；完整備份包含照片，資料較多時可能超過單次執行限制，應在驗收時量測並分批。
- 尚未設定定期備份或無人排程。GitHub 與 Drive 的接手規則見既有專案資料庫，不能把前一版快照當成此目錄的最新版本。

官方依據：
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/identity/protocols/oauth2/web-server
