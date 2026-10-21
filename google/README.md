# 我的名片：Google 個人版

此版只供 sq087786789@gmail.com 本人使用，沿用既有私人 Drive 資料夾與 Sheets，不搬移或刪除現有名片。Google 負責登入，App 不再建立第二組登入流程或保存登入 token。

## 建置與驗證

node google/test.mjs
node google/build.mjs

建置使用 google/build-personal.mjs，沿用 v2 的拍照、裁切、欄位校正與備份程式，產生忽略於 Git 的 google/Index.html。部署 Code.gs、Index.html、appsscript.json。

## 必須維持的存取設定

Apps Script Web App 執行身分為管理員，誰可以存取必須選「只有我自己」。後端另外在 doGet 與每一項 API 檢查 Session.getActiveUser().getEmail() 精確等於固定本人帳號；空身分或別人的帳號一律拒絕，不使用 execute-as-owner 的 EffectiveUser 當作訪客，也不接受舊自訂 session token 作為替代。成員管理 API 關閉。

GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 等先前設定可保留以便回復舊版，目前程式不再使用。GEMINI_API_KEY、GEMINI_MODEL、DATABASE_ID、FOLDER_ID 繼續使用原本設定，不得放進程式碼或文件。原本四項 Google 資料權限不擴大。

## 簡化與載入優化

- 首頁只顯示拍名片、搜尋及名片清單；備份／匯入與回收筒放入「更多」。
- bootstrap 一次回傳身分、設定與名片，不再先登入再額外讀一次清單。
- 同一次請求只開啟並讀取 Sheets 一次，寫入後同步更新該次請求的記憶體資料，鎖內完成 flush 再釋放。
- 儲存名片時直接回傳最新清單，前端不再多送一次讀取；單人使用取消每 30 秒輪詢。
- 文字先顯示；只有接近可視範圍的照片才讀取，最多兩張並行。編輯時先顯示欄位，再載入照片。
- 不在瀏覽器永久儲存名片或憑證；既有 Google Drive 圖片仍維持私人。

11 項隔離測試包含：其他或空 Google 身分拒絕、舊 token 無法繞過、一次 Sheets 讀取、儲存與操作紀錄一致、照片檔頭驗證、版本衝突、台灣電話去重、可復原回收筒、辨識 schema／空結果防護，以及個人版沒有第二次登入、沒有輪詢、照片延遲載入。

## 辨識與實機驗收界線

繼續使用已核准的 gen-lang-client-0257505168 免費專案獨立金鑰及 gemini-3.5-flash-lite。沒有啟用付費帳務。免費辨識目前仍僅授權虛構名片：上傳後不自動辨識，必須勾選虛構照片確認，再按辨識。真實名片可先私人保存與手動填寫。

先前已驗證：虛構名片的私人照片保存、App 顯示、姓名／公司／手機／Email 辨識並存回。第 5 版已部署，平台設定為只有我自己；新分頁已直接進入、不需舊 token，既有名片與照片可讀取，新增虛構名片已成功保存並顯示於清單。iPhone 拍照／HEIC 與多 Google 帳號情況仍需實機驗收；不以單人模式承諾 Google 主機秒開，或把減少雲端請求次數當成已量測的速度倍數。

## 回復

個人版切換前的共用版 GitHub 版本為 8b345aadbfc08216f1f94008a6c6b0a0ab223fcf，Apps Script 第 4 版。回復共用版前須重新確認要開放的帳號與權限，不能只把平台入口擴大後略過後端身分驗證。
