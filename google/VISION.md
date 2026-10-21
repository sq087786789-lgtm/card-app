# Cloud Vision 接法與免費用量保護

狀態：程式已完成，16 項本機測試通過。Cloud 專案 card-library-sq087-20261021 的 Cloud Vision API 已啟用，獨立金鑰限制只允許此 API，安全保存在此 App 的 Script Properties。帳務頁為既有免費試用帳戶，沒有升級付費。使用者已明確同意處理真實名片。已用虛構照片實際呼叫 Vision，欄位辨識、保存／讀回、相同照片重用及測試名片移入回收筒成功，用量 1／900。部署版本詳見 deployment.json。

## 啟用

1. 在既有專案建立獨立 API 金鑰，API restrictions 只允許 Cloud Vision API；不擴大既有 Gemini 金鑰權限。
2. 金鑰僅存入此 Apps Script 的 Script Properties：VISION_API_KEY。完成限制與確認既有帳務後再設 VISION_ENABLED=true。不增加 Apps Script OAuth scopes。
3. 部署 Code.gs、node google/build.mjs 產生的 Index.html、既有 appsscript.json；平台仍為只有我自己，後端 ActiveUser 固定本人驗證保持。
4. 先用虛構名片進行真實 Vision 呼叫，核對文字、欄位及用量；不能只以 mock 測試宣稱雲端接線成功。保留第 5 版可回復。

## 用量

Google 官方文字辨識每月前 1,000 單位免費；每張圖片只要求 DOCUMENT_TEXT_DETECTION 一項功能。正反面是兩張圖片。超額目前為每千單位 US$1.50（第一級付費區間），以官方即時定價為準。

程式採較保守的「任意連續 32 天最多 900 張圖片」保護，不以日曆月份重設；剩餘不足兩張時整批拒絕，不只送一面。用量先在鎖內寫入既有 Sheets，flush 後才送 Google；中斷、失敗、無文字仍保留預扣，不自動重試或退款。以影像內容雜湊快取成功文字，相同照片重用結果，不新增單位。

此上限只管本 App 發出的請求，不控制同帳務其他專案／金鑰的使用量，不能保證整個 Google 帳單為零。不要把 Google 預算通知當成硬性停用。Google 試用期限及其他服務費用依帳務頁為準，不擅自升級或建立訂閱。

## 資料與整理方式

名片照片以伺服器端 API 傳到 https://vision.googleapis.com/v1/images:annotate，金鑰放 x-goog-api-key 標頭，不出現在網址、前端、聊天、Git 或 Drive 文件。只用 Vision 同步文字辨識，不使用 Gemini 作第二階段整理，不回退免費 Gemini。原圖仍存既有私人 Drive。

程式在 App 端以規則整理姓名、公司、手機、電話、分機、傳真、Email、網址、LINE 與地址；保留 rawText，姓名／公司等推定欄位標示需人工核對。若有兩個姓名候選不任選一個。Vision 是文字辨識，不保證能理解每張名片的職稱、姓名或排版；可人工修正後儲存，不把結果自動視為已確認。

辨識需要本人按按鈕，拍照後不自動送出；移除虛構名片勾選框，改成清楚說明送往 Cloud Vision。真實資料僅在服務切換及使用者確認後處理。

## 驗證

node google/test.mjs：16 項通過，包括私人身分驗證、儲存／照片、單次 Sheets 讀取、版本衝突、回收筒、禁用 Gemini 回退、單一 Vision 功能、內容快取、900 上限／兩面批次原子拒絕、跨月 32 天窗口、失敗預扣、台灣欄位與模糊姓名、同列姓名／公司，以及產出前端沒有虛構勾選框。

## 官方來源

- https://cloud.google.com/vision/pricing
- https://cloud.google.com/vision/docs/setup
- https://cloud.google.com/vision/docs/data-usage
- https://cloud.google.com/vision/docs/reference/rest/v1/images/annotate

Google 表示內容僅用來提供 Vision，不用來訓練或改善模型；同步圖片在記憶體處理，但仍有服務中繼資料紀錄。這不是整個服務完全不留任何紀錄的宣稱。
