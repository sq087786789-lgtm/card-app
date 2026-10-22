# Google 私人名片庫：部署與接手

正式 App：https://sq087786789-lgtm.github.io/card-app/library.html
管理員：sq087786789@gmail.com
Google 後端：Apps Script 第 10 版，部署 ID AKfycbxW7uPyY5JyhaTZHYGPrg9z_OKdDaNAPYlXqPADlS95al-1PKyuP5YZZ7JS_2XW91qU。

## 登入方式與資料邊界

一般 Chrome 的多帳號 Cookie 會讓 Google /exec 先 302 到 /macros/u/1/，再 404，App 根本不執行。2026-10-22 已改成 GitHub 前端以 credentials:omit、text/plain 簡單 POST 存取 Google ContentService 後端；實測能完成 Google 選帳號、同頁驗證並讀到 6 張原名片。

登入空殼與 API 入口設為「所有人」，但 doPost 的資料 API 必須帶有效 personalSession token；它不接受 Google 執行身分或空 token 作替代。Google 直接介面仍可供既有本人 Google 工作階段使用；正式推薦 GitHub App 網址。

Google OAuth 使用既有 Script Properties 的 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET，只要求 openid email。回呼固定為 https://sq087786789-lgtm.github.io/card-app/oauth-callback.html；保留 Google 舊 /exec 回呼以便回復。Google Console 已儲存新 URI。回呼先清除網址中的 code，只傳給固定 Google 後端；Google token 不傳回瀏覽器。

state 5 分鐘單次、PKCE verifier 留伺服器、poll 另需 secret。userinfo 必須有 sub、email_verified=true、email 精確等於本人，才能核發 personalSession；不查成員名單、不接受原共用版 session。每個資料 API 再查 token 與期限，7 天硬到期。前端 token 和短暫 flow secret 只存在目前分頁 sessionStorage。其他／空 Email、偽造、過期、重放的登入一律拒絕。原 Sheets、Drive 和照片不搬移、不公開。

## 建置與發布

1. `node google/test.mjs`：23 項測試。
2. `node google/build.mjs`：產生 Index.html 及 Deploy.gs（Code.gs + Login.gs），兩者忽略於 Git。
3. 線上「程式碼.gs」使用 Deploy.gs 全文，線上 Index.html 使用 Index.html 全文；不要同時放入合併檔和兩份來源檔。
4. 更新原部署的新版本，執行身分為管理員、入口為所有人。不得將 ScriptApp OAuth token 或密鑰放前端。
5. `node google/build-web.mjs` 另產生 Library.html；Pages 工作流程把它發布為 library.html，並發布 oauth-callback.html / oauth-callback.js。
6. Github 和 Apps Script 分開部署，任何一方更新都不代表另一方已更新。

資料庫及照片 ID 沿用私人 Script Properties；不要重跑建立新資料庫的程式或清除既有設定。VISION_API_KEY / VISION_ENABLED 沿用；不啟用 Gemini、不改帳務。統編 taxId 是選填 8 位數文字，保留前導 0；支援編輯、搜尋、備份及有標示的 OCR 擷取，不檢驗稅籍。

## 驗收與限制

23 項 Google 測試包含：原本人 Google 身分、新 OAuth 本人、其他帳號拒絕、API 無 token 拒絕、回呼重放、PKCE、過期、session 登出撤銷、無 Cookie 傳輸、Sheets 效能、統編與 Vision 用量保護。v2 共用元件及 Pages 遷移測試亦通過 CI。一般 Chrome 完整登入及既有名片讀取已實測；iPhone 相機／HEIC 仍需實機確認。不可聲稱所有瀏覽器均已測試。

回復時可選第 7 版並還原對應 Git，但會恢復 Google 直接入口的多帳號錯誤；需同步評估前端、登入設定與原資料，不能將資料 API 改成未驗證可讀。
