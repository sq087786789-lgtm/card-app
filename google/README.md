# 我的名片：Google 個人版

此版只供 sq087786789@gmail.com 本人使用，沿用既有私人 Drive 資料夾與 Sheets，不搬移或刪除現有名片。正常 Google 本人工作階段可直接開啟；多帳號瀏覽器改用既有 Google OAuth 憑證明確選帳號。只有經 Google 驗證的 sq087786789@gmail.com 能建立本人登入。

## 建置與驗證

node google/test.mjs
node google/build.mjs

建置使用 google/build-personal.mjs，沿用 v2 的拍照、裁切、欄位校正與備份程式，產生忽略於 Git 的 google/Index.html。建置同時合併 Code.gs 與 Login.gs 為忽略於 Git 的 Deploy.gs；將 Deploy.gs 放入線上「程式碼.gs」，並部署 Index.html、appsscript.json。不可同時部署 Deploy.gs 與兩個原始後端檔案，以免重複宣告。

## 必須維持的存取設定

Apps Script Web App 執行身分為管理員，新的登入修正需在使用者明確同意後，將登入空殼設為「所有人（包含未登入者）」，以避開 Google 平台多帳號入口；原名片 API 不可公開。未完成部署驗證前，不可聲稱已修復。後端另外在 doGet 與每一項 API 檢查 Session.getActiveUser().getEmail() 精確等於固定本人帳號；空身分或別人的帳號一律拒絕，不使用 execute-as-owner 的 EffectiveUser 當作訪客，也不接受舊共用版 session token。新登入使用 personalFlow／personalSession 獨立命名，經 Google authorization code + PKCE 與 userinfo 驗證本人後才發登入工作階段；其他帳號或未驗證 Email 一律拒絕。成員管理 API 關閉。

GOOGLE_CLIENT_ID 與 GOOGLE_CLIENT_SECRET 沿用原有私人設定以提供登入備援，僅要求 openid email。GEMINI_API_KEY、GEMINI_MODEL 保留但不使用。辨識使用僅限 Cloud Vision API 的 VISION_API_KEY，開關 VISION_ENABLED=true；只保存在 Script Properties。DATABASE_ID、FOLDER_ID 沿用，不得放機密進程式碼或文件。原本四項 Google 資料權限不擴大。

## 簡化與載入優化

- 首頁只顯示拍名片、搜尋及名片清單；備份／匯入與回收筒放入「更多」。
- bootstrap 一次回傳身分、設定與名片，不再先登入再額外讀一次清單。
- 同一次請求只開啟並讀取 Sheets 一次，寫入後同步更新該次請求的記憶體資料，鎖內完成 flush 再釋放。
- 儲存名片時直接回傳最新清單，前端不再多送一次讀取；單人使用取消每 30 秒輪詢。
- 文字先顯示；只有接近可視範圍的照片才讀取，最多兩張並行。編輯時先顯示欄位，再載入照片。
- 不在瀏覽器永久儲存名片或憑證；既有 Google Drive 圖片仍維持私人。

16 項隔離測試包含：其他或空 Google 身分拒絕、舊 token 無法繞過、一次 Sheets 讀取、儲存與操作紀錄一致、照片檔頭驗證、版本衝突、台灣電話去重、可復原回收筒、Vision 空結果／錯誤處理、持久用量預扣與上限、相同照片快取、台灣欄位整理，以及個人版沒有第二次登入、沒有輪詢、照片延遲載入。

## 辨識與實機驗收界線

辨識已改為 card-library-sq087-20261021 專案的 Cloud Vision，使用者明確同意按辨識時處理真實名片。照片上傳後不自動辨識，不再出現虛構名片勾選框。只送 Google Vision，不回退免費 Gemini。既有帳務為 Google Cloud 免費試用帳戶，未升級付費；Vision 每月前 1,000 圖片單位免費。App 限制任意連續 32 天 900 張，達上限停止，單張成功結果按內容快取。這只控制此 App，不能保證同帳務其他使用量為零。完整設定與界線見 VISION.md。

Cloud Vision 真實 API 整合驗證成功：虛構照片讀出王小明、測試公司、0900-000-001、demo@example.com；保存與讀回成功；相同圖片再次辨識用量維持 1，剩餘 899。測試名片已移至可還原回收筒，暫時驗證函式已移除。個人版直接登入、私人照片及原資料保留。iPhone 拍照／HEIC 與多 Google 帳號仍需實機驗收，不承諾秒開或未量測的速度倍數。

## 回復

個人版切換前的共用版 GitHub 版本為 8b345aadbfc08216f1f94008a6c6b0a0ab223fcf，Apps Script 第 4 版。回復共用版前須重新確認要開放的帳號與權限，不能只把平台入口擴大後略過後端身分驗證。

## 統編欄位

新增選填的 8 位數統編（taxId），以文字保存前導 0，支援新增、編輯、搜尋、JSON 備份及 vCard 自訂欄位 X-TAX-ID。OCR 只從有「統編／統一編號／Tax ID」標示的文字擷取，仍需人工核對；不驗證稅籍或登記狀態。舊名片沒有此欄位時顯示空白，不需資料搬移。

## 多帳號登入修正

Google 平台要求登入的入口在一般 Chrome 可重現 /macros/u/1/ 的 Drive「無法開啟檔案」，無痕單一帳號可用。修正提供不含資料的登入空殼及本人 OAuth 備援，不擴大資料讀取者。回呼固定原 /exec 網址；state 單次、5 分鐘到期；PKCE verifier 只在伺服器；輪詢另驗證 secret，成功只交付一次。Google access token 不回傳瀏覽器。App token 以 hash 索引保存在 Script Properties，7 天硬到期，前端只存目前分頁 sessionStorage；關閉該分頁或過期可能須再選帳號。原有 Google 直接身分檢查保留。
