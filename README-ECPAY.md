# GRAB A CUP 購物車 + 綠界 ECPay 串接

## 已完成
- 9 款商品加入購物車、數量增減、刪除、LocalStorage 保留購物車。
- 商品總覽與 9 個商品內頁都有加入購物車功能。
- checkout.html 訂購人資料與訂單摘要。
- Node/Express 後端建立 ECPay AioCheckOut V5 訂單。
- CheckMacValue SHA256 依綠界官方規格計算，附官方範例測試。
- ReturnURL 驗證 CheckMacValue，並依規格回傳 `1|OK`。
- 預設 Stage 測試環境，不會實際扣款。

## 重要：目前 9 款商品已使用正式商品售價
因為尚未收到正式售價，本專案為了讓整個購物車與綠界流程可以測試，9 款商品暫設 NT$100。正式上線前必須同時修改：
1. `shop-config.js` 的 9 款 `price`
2. `server/server.js` 的 `PRODUCTS` 9 款 `price`

後端會重新依自己的商品價格計算總額，不採信瀏覽器送來的金額，避免使用者竄改前端價格。

## 本機測試
```bash
cd server
npm install
npm test
npm start
```
然後不要直接 file:// 開 HTML。可用 VS Code Live Server，或把前端放到可由瀏覽器存取的 HTTP 伺服器。若前端不是 `http://localhost:3000`，請設定 `ALLOWED_ORIGINS`。

## GitHub Pages 部署方式
GitHub Pages 只能放前端，不能安全保存 HashKey / HashIV，也不能接收 ECPay ReturnURL，所以**不能只靠 GitHub Pages 完成金流**。

建議架構：
- 前端：GitHub Pages
- 後端：Render / Railway / Fly.io / 自有主機（需公開 HTTPS）

後端環境變數請參考 `server/.env.example`。部署後：
1. `PUBLIC_BASE_URL` = 後端公開 HTTPS 網址
2. `FRONTEND_URL` = GitHub Pages 或正式網站網址
3. `ALLOWED_ORIGINS` = 前端網址
4. 修改前端 `shop-config.js` 的 `apiBaseUrl` = 後端公開 HTTPS 網址

## 正式綠界上線
正式環境請在後端環境變數設定：
- `ECPAY_MODE=prod`
- `ECPAY_MERCHANT_ID=你的 MerchantID`
- `ECPAY_HASH_KEY=你的 HashKey`
- `ECPAY_HASH_IV=你的 HashIV`

HashKey / HashIV **不可寫在 HTML、CSS 或前端 JavaScript**。

## 正式上線前還要補的電商功能
此版完成「購物車 + 金流建立交易 + ReturnURL 驗證」的 MVP。正式營運仍建議加入：
- 真實商品售價、庫存與 SKU
- 運費規則
- 收件人 / 配送地址或超商物流
- 訂單資料庫（目前 `orders.json` 僅適合測試，不適合正式營運）
- 後台訂單管理
- Email / LINE 訂單通知
- 發票串接
- 退款 / 取消訂單流程
- 伺服器端查詢訂單 API 二次驗證付款結果

## 購物優惠規則（V4）

目前已加入商品加入購物車後的優惠提示視窗，以及購物車／結帳頁優惠計算：

- 滿 NT$1,000：免運。
- 每滿 NT$1,000 折 NT$100，最高折 NT$300。
- 滿 3 件 9 折；滿 6 件 8 折。
- 每滿 NT$2,000 贈「開心果瑪奇朵10入」1 盒，最多 3 盒。

**目前假設：**「滿額折扣」與「滿件折扣」不重複折抵，系統自動採折扣金額較高者；「滿額免運」與「滿額贈」可以與折扣同時享有。這是為了避免在尚未確認活動疊加規則前發生過度折扣。若品牌確認所有折扣都可疊加，請把前後端 `discountStacking` 改為 `stack`。

未滿千的實際運費尚未提供，因此預設 `SHIPPING_FEE=0`。正式上線前請依物流規則設定。
