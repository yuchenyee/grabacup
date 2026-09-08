# GRAB A CUP 全站 SEO + Schema 更新

## 已完成
- 19 個 HTML 頁面重新整理 SEO Title / Meta Description
- Canonical
- Robots / Googlebot
- Open Graph
- Twitter Card
- `zh_TW` 社群語系
- Product Schema（9 個商品頁）
- Offer：正式售價 / TWD
- Brand / Organization Schema
- WebSite / WebPage Schema
- Product Collection + ItemList Schema
- FAQPage Schema
- Store locator ItemList / Place Schema
- Enterprise Service Schema
- BreadcrumbList
- ContactPage
- 結帳頁、付款結果頁設為 `noindex,nofollow`
- Cloudflare Pages Functions 動態 `/sitemap.xml`
- Cloudflare Pages Functions 動態 `/robots.txt`

## 網域注意事項
目前專案尚未提供正式網域，因此 HTML 內 canonical、og:url、商品 URL 與圖片採「相對網址」。
瀏覽器與多數搜尋引擎會依目前頁面網址解析 canonical；但 Open Graph 圖片與 Schema URL 若要做到最完整，正式網域確認後建議改成絕對 HTTPS URL。

Cloudflare 的 `/sitemap.xml` 與 `/robots.txt` 已使用 Request Origin 動態產生正式網域，因此部署到自訂網域後不需要手動改 Sitemap 網址。

## Schema 刻意沒有加入
- 星等 / 評論數：目前沒有真實評價資料，不虛構 AggregateRating。
- GTIN / MPN：目前沒有正式商品條碼資料。
- 庫存 InStock / OutOfStock：目前沒有真實庫存 API。
- 企業 8 折價格：企業價屬登入後資訊，不放在公開 Schema 內。
- 模擬成分與保存期限：目前為商品頁參考資料，不放進 Product Schema，避免搜尋引擎誤判為已確認的法定食品標示。

## 上線後建議
1. Cloudflare 自訂網域確認後，把相對 canonical / OG image 轉為完整 HTTPS 網址。
2. 到 Google Search Console 提交 `/sitemap.xml`。
3. 用 Google Rich Results Test 驗證 9 個 Product 與 FAQ Schema。
4. 若取得 GTIN、真實庫存、正式客服資訊與真實評論，再補 Product / Organization 結構化資料。
