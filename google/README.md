# 我的名片：Google 個人版

此版只供 sq087786789@gmail.com 本人使用，沿用既有私人 Drive 資料夾與 Sheets，不搬移或刪除現有名片。Google 負責登入，App 不再建立第二組登入流程或保存登入 token。

## 建置與驗證

node google/test.mjs
node google/build.mjs

建置使用 google/build-personal.mjs，沿用 v2 的拍照、裁切、欄位校正與備份程式，產生忽略於 Git 的 google/Index.html。部署 Code.gs、Index.html、appsscript.json。

## 必須維持的存取設定

Apps Script Web App 執行身分為管理員，登入入口目前依使用者授權設為「所有已登入 Google 帳戶的使用者」，僅為測試多帳號瀏覽器的開啟問題；不代表其他帳號可讀取名片，一般 Chrome 多帳號仍有開啟錯誤。後端另外在 doGet 與每一項 API 檢查 Session.getActiveUser().getEmail() 精確等於固定本人帳號；空身分或別人的帳號一律拒絕，不使用 execute-as-owner 的 EffectiveUser 當作訪客，也不接受舊自訂 session token 作為替代。成員管理 API 關閉。

GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GEMINI_API_KEY、GEMINI_MODEL 等先前設定保留以便回復，目前不再使用。辨識使用僅限 Cloud Vision API 的 VISION_API_KEY，開關 VISION_ENABLED=true；只保存在 Script Properties。DATABASE_ID、FOLDER_ID 沿用，不得放機密進程式碼或文件。原本四項 Google 資料權限不擴大。

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
