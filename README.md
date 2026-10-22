# 我的名片：Google 私人名片庫

[開啟名片 App](https://sq087786789-lgtm.github.io/card-app/library.html) · [原網站入口](https://sq087786789-lgtm.github.io/card-app/) · [舊裝置資料匯出](https://sq087786789-lgtm.github.io/card-app/data-recovery.html)

僅供 sq087786789@gmail.com 本人使用。操作介面由 GitHub Pages 提供，Google Apps Script 第 10 版處理登入驗證、名片與照片；私人 Sheets 保存欄位、私人 Drive 保存照片，Cloud Vision 辨識文字。支援統編、正反面照片、搜尋、JSON 備份及 vCard 匯出。

## 登入修正（2026-10-22）

已在原本失敗的一般 Chrome 完成 Google 選帳號、驗證、同分頁回到 App，成功讀取 6 張既有名片。直接導覽 Google /exec 仍可能被多帳號 Cookie 轉到 /macros/u/1/ 後回傳 404，因此正式使用上方 GitHub App 網址。前端對後端的簡單 POST 一律 credentials:omit，不帶 Google 多帳號 Cookie；任何讀取或寫入都需要新的本人登入 token。

OAuth 沿用既有私人憑證，只要求 openid email。Google 授權碼回呼固定為 https://sq087786789-lgtm.github.io/card-app/oauth-callback.html；立即清除網址中的授權碼，再交由 Google 後端驗證。後端精確核對 Google 已驗證的本人 Email；其他帳號、過期或偽造 token 不能讀取名片或照片。原共用版 session 不適用。

App 登入 token 只存目前分頁 sessionStorage，伺服器用 hash 索引且 7 天硬到期；關閉分頁、過期或瀏覽器清除儲存空間可能需要再選帳號。密鑰、Google access token、名片資料與照片均不提交公開 GitHub。

## 部署與維護

- `node google/test.mjs`：23 項本人存取、OAuth、PKCE、回呼重放、無 Cookie 傳輸、統編、照片與 Vision 測試。
- `node scripts/check-pages.mjs`：6 項舊資料唯讀匯出及 Service Worker 更新範圍測試。
- `node google/build-web.mjs`：由共用前端生成忽略於 Git 的 Google/網頁介面及後端合併檔，詳見 [Google 部署說明](google/README.md)。
- Google 正式更新：把 google/Deploy.gs 放到線上「程式碼.gs」，google/Index.html 放到線上 Index.html，建立新版本並更新原部署。GitHub 合併不會自動更新 Google 後端。
- GitHub Pages 由 .github/workflows/pages.yml 建置，只發布介面、登入回呼、舊資料匯出頁、更新腳本與圖示；不發布後端原始碼、憑證或私人資料。

## 舊資料保留與辨識

舊介面、舊伺服器及公開 cards.json／images 已從目前版本撤下，沒有清除 Git 歷史。本機 IndexedDB 和照片快取保留，可在原裝置匯出後匯入新版；沒有快取的照片需重新補上。Service Worker 不刪除資料，也不影響同帳號其他工具。

Cloud Vision 只在按辨識時處理照片，不使用 Gemini。App 設有 900 張圖片／滾動 32 天上限、持久預扣及相同照片快取；帳務內其他服務用量另計。沒有升級 Google Cloud 免費試用帳戶。詳見 [Vision 說明](google/VISION.md)。iPhone 拍照／HEIC 仍需實機驗收。

MIT
