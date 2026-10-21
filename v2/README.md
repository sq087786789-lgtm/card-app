# 名片共用庫 v2

新版以「管理員與員工共用同一份名片庫」為正式目標。舊版根目錄、GitHub Pages、cards.json 與照片保持原樣；新版集中在 v2/，尚未取代舊服務。

## 已完成與目前界線

- 可操作：正反面照片、裁切旋轉、欄位校正、待補資料、分類搜尋、重複提醒、VCF 匯入匯出、完整 JSON 照片備份與匯入、回收筒、操作紀錄。
- 正式伺服器程式：Google OAuth 登入、帳號核准／停用、SQLite 共用資料、修改版本衝突檢查、管理員權限、Google Drive 照片同步、Gemini 圖片辨識。
- 目前提供的私人網站是**瀏覽器試用版**，文字、照片都只存在使用者當前瀏覽器 IndexedDB，不會跨裝置同步。私人網站的登入門檻是 Sites 的存取保護，並不代表正式 Google 登入已完成。
- Google 登入、Drive、Gemini 目前僅以模擬服務驗證程式，**尚未取得真實帳號授權或測試真實名片準確率**。

## 本機試用（Node.js 24+，無第三方套件）

另提供可直接以 Chrome／Edge 開啟的「名片共用庫-本機試用.html」，沒有伺服器依賴；資料保存在該瀏覽器，移動檔案或換瀏覽器可能無法讀取原資料，請先下載完整備份。可執行 `node build-local.mjs` 重新產生單檔版本（輸出於 v2/dist/）。

```powershell
cd v2
npm run demo
```

開啟 http://localhost:8787 。只監聽 127.0.0.1，免登入，以本機試用者操作。資料寫入 v2/data/demo.sqlite，與正式資料分開。第一次沒有資料，可按「試試範例名片」；範例為虛構資料，不會自行帶入真實名片。

## 正式架構

手機／電腦 → HTTPS Node.js 服務 → SQLite 共用資料庫（包含照片暫存）

管理員個人 Gmail Drive ← 管理員授權後，按「同步待上傳照片」保存照片

圖片辨識：伺服器 → Gemini API → 欄位草稿 → 人工確認

所有同事的照片都由同一個管理員 Drive 授權存入管理員的「公司名片庫」資料夾，員工不需知道管理員密碼或登入其 Google 帳號。以 drive.file 權限管理 App 建立的檔案，預設不設公開連結。員工經 App 的已授權 API 讀取照片。

這版 Drive 是**照片保存副本**，不是文字資料庫，也不是自動的完整資料備份；先保存於伺服器的照片可在授權後重試同步。手動同步採檔案 appProperties 去重，避免網路中斷後重傳相同照片。名片照片同步不會自動刪除 Drive 的檔案。管理員應定期下載完整 JSON 備份，以及備份伺服器 data/（含加密後的 Drive 授權）。

## 啟用正式模式

需要一個支援 Node.js 24 與持久磁碟的 HTTPS 主機。GitHub Pages 只能放靜態畫面，無法執行本專案的共用 API。這版 Node 正式服務獨立於 Sites 試用網站，不使用 Sites 身分標頭或 OAuth 路由。

1. 複製 .env.example 為 .env；此檔已列入忽略，不上傳 GitHub。
2. 建立 Google Cloud 專案，啟用 Google Drive API，設定 Google OAuth 同意畫面，建立 Web application OAuth client。
3. OAuth redirect URI 必須精確設為 `https://你的網域/auth/callback`。將管理員與員工帳號納入測試使用者；若要長期使用，依 Google 當時要求完成同意畫面的發布／驗證。測試模式的離線授權可能過期，失效時須重新連接。
4. 設定 APP_ORIGIN 為 HTTPS 正式網域、OWNER_EMAIL 為管理員要登入的 Gmail，以及 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET。
5. 在本機產生 32-byte 加密金鑰（hex 64 字元），填 TOKEN_ENCRYPTION_KEY；保管這把金鑰，遺失會無法解密既有 Drive 授權。不要在聊天中提供密鑰。
6. 選用：設定 GEMINI_API_KEY 與該 Google 專案可用的 GEMINI_MODEL。未設定時辨識按鈕會顯示未啟用，照片仍可儲存。辨識會把正反面照片送至 Google Gemini，應依組織需求確認服務費用與資料處理條款。
7. 將 DATA_DIR 指向持久磁碟（預設 ./data）。執行 `npm start`，反向代理只轉送到此服務並終結 HTTPS。正式模式不接受缺少安全設定的啟動。
8. 管理員登入 →「成員與權限」核准員工 Google Email →「連線與備份」連接管理員 Google Drive → 同步待上傳照片。
9. 用管理員及員工兩個真實帳號測試登入、照片讀取、修改衝突、停用、備份還原，再用 10–20 張實際名片檢查各欄位辨識正確率，通過後才作為正式共用名片庫。

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm start
```

Google 官方參考：
- OAuth Web Server：https://developers.google.com/identity/protocols/oauth2/web-server
- Drive 權限：https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Gemini 圖片辨識：https://ai.google.dev/gemini-api/docs/generate-content/image-understanding
- 結構化輸出：https://ai.google.dev/gemini-api/docs/generate-content/structured-output

## 權限與一致性

| 操作 | 管理員 | 員工 |
|---|---|---|
| 新增、查看、修改名片與照片 | 可 | 可 |
| 匯入、匯出通訊錄 | 可 | 可 |
| 移至回收筒、還原、完整備份 | 可 | 不可 |
| 核准／停用帳號、查閱操作紀錄 | 可 | 不可 |
| 授權與同步管理員 Drive | 可 | 不可 |

管理員由環境變數指定，第一位訪客不會自動成為管理員。每次請求都重新檢查成員啟用狀態。停用後既有 session 立即失效。HTTP-only、SameSite cookies、OAuth state + PKCE、CSRF token、伺服器端權限與圖片格式檢查都由後端執行。Drive refresh token 以 AES-256-GCM 加密後存於 SQLite；API key、Client secret 留在伺服器環境。共享資料庫以 revision 避免同事互相覆蓋修改，寫入與操作紀錄採交易。

這是單一公司、單一伺服器 SQLite 的初版，非多租戶 SaaS；水平擴充前需改用適合的共用資料庫。照片保留在 SQLite 以供還原與失敗重試，因此仍須配置伺服器持久磁碟容量。

## 舊資料搬移與還原

1. 先從舊 App 匯出 VCF，或準備舊 cards.json；舊 App 瀏覽器裡的 IndexedDB 無法直接由新版不同網域讀取。
2. 新版按「匯入」，支援 VCF、單張 JSON、cards 陣列與 v2 完整備份。
3. 舊版相對路徑／公開網址照片不會被自動下載；不完整照片會標示待確認並在備註說明。請另外加入原圖。JSON 內嵌 data URL 或 v2 備份照片可帶入。
4. 匯入是「合併新增」，不會清空或覆寫既有資料，重複電話／Email 會略過。匯入失敗會列出原因，已匯入資料保留。回收筒名片在管理員完整備份匯入時仍移至回收筒。
5. 備份不包含 Google token、成員名單、完整操作紀錄或 OAuth sessions；完整營運復原另需伺服器 data/ 與環境設定的受保護備份。

## 驗證

```powershell
npm test
```

自動測試涵蓋：台灣電話去重、欄位／網址校驗、VCF 特殊字元及多電話、修改衝突、回收筒與還原、照片格式、未登入與員工權限、CSRF、停用 session、OAuth state／未核准帳號、圖片辨識未啟用時保留照片、完整照片備份。整合測試只呼叫本機 HTTP，外部 Google 服務使用模擬回應，不花 API 費用。
