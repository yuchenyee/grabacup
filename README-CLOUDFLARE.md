# GRAB A CUP — Cloudflare Pages + Functions 部署版

這一版已將原本 Express 的企業登入 / 企業價格 / 綠界結帳 API 改為 Cloudflare Pages Functions。

## 1. GitHub
把 `web` 資料夾內的內容推到 GitHub Repository。

## 2. Cloudflare Pages
Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git。

如果 Repository 根目錄就是本資料夾：
- Framework preset：None
- Build command：留空
- Build output directory：`.`

如果你把整個 `web` 資料夾放在 Repository 裡：
- Root directory：`web`
- Build command：留空
- Build output directory：`.`

Cloudflare 會自動辨識 `functions/api/[[path]].js`。

## 3. 必須設定的企業 Secrets
Cloudflare Pages 專案 → Settings → Variables and Secrets。

Production 請新增：

- `ENTERPRISE_CODES`：例如 `GRAB2026`
- `ENTERPRISE_SECRET`：請自行產生一組至少 32 字元的隨機字串

若有多個企業代號：
`GRAB2026,COMPANY-A,COMPANY-B`

注意：不要把真正企業代號寫進 GitHub 的 `wrangler.toml`。

## 4. 綠界 Stage 測試
目前 `wrangler.toml`：
`ECPAY_MODE = "stage"`

Stage 會使用綠界官方測試 Merchant 設定。

## 5. 綠界正式上線
正式環境請在 Cloudflare Secrets 設定：

- `ECPAY_MODE` = `prod`
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `PUBLIC_BASE_URL` = 你的正式 HTTPS 網址，例如 `https://你的網域`

金鑰必須使用 Secret，不要提交到 GitHub。

## 6. 驗證是否部署成功
部署後開啟：

`https://你的網域/api/health`

正常應看到 JSON，包含：
`"ok": true`
`"platform": "cloudflare-pages-functions"`

接著進入：
`https://你的網域/enterprise.html`

輸入你在 Cloudflare `ENTERPRISE_CODES` 設定的企業代號。

## 7. 為什麼這版不會再因 GitHub Pages 出現 Failed to fetch？
企業頁仍呼叫同網域 `/api/enterprise/login`，但現在 `/api/*` 由 Cloudflare Pages Functions 執行，不再依賴 GitHub Pages 執行 Node.js Express。

## 安全提醒
企業價格與企業 8 折計算都在 Functions 後端完成。前端只在驗證成功後取得企業價格，避免把企業代號直接寫在 JavaScript。
