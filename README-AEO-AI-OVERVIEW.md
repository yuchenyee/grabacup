# GRAB A CUP AEO + Google AI Overview 最佳化

此版本延續既有 SEO / Schema，新增「答案優先」內容結構，目標是讓搜尋引擎與生成式 AI 更容易理解、抽取與引用網站資訊。

## 已完成
- 首頁：品牌、產品數量、價格區間、購買與門市快速答案
- 產品總覽：依風味與價格的選購問答
- 9 個產品詳細頁：風味、價格、規格、適合對象、購買方式
- FAQ：優惠、付款、配送、企業採購摘要
- 門市：全台據點摘要
- 企業專區：企業價、採購方式、用途
- 購物須知：運費、付款、優惠
- 可見 HTML 問答，不只藏在 Schema 裡
- 新增 `/llms.txt`
- 新增 `/ai-index.json`
- 保留 SEO、Product Schema、Breadcrumb、Organization、ItemList 等既有結構
- 維持 `max-snippet:-1`，讓 Google 在符合條件時可使用較完整的頁面文字產生摘要

## 關於 Google AI Overview
Google 官方說明：AI Overviews / AI Mode 沒有額外的特殊技術門檻；頁面必須能被索引、符合摘要顯示資格，並遵循一般 SEO、內容品質與搜尋政策。AEO / GEO 並不是一個能保證進入 AI 摘要的特殊標記。

因此本版沒有加入虛構或不存在的「AI Overview Schema」，而是強化：
1. 可被抓取的答案型 HTML
2. 明確問題標題與直接答案
3. 商品、價格、規格、配送、企業採購的實體資訊一致性
4. 既有結構化資料
5. Sitemap / robots
6. AI 可讀輔助檔案

## 重要
- `/llms.txt` 是新興社群慣例，不是 Google AI Overview 的必要條件，也不是排名保證。
- `/ai-index.json` 是本站自有的機器可讀摘要，不是 Google 官方排名格式。
- FAQ Rich Result 已不是目前 Google 搜尋的主要呈現方式，因此問答內容直接放在可見頁面，而不是只依賴 FAQ Schema。
- 是否出現在 Google AI Overview、AI Mode 或一般精選摘要，最終由 Google 系統依查詢、索引、品質、相關性與其他訊號決定，無法保證。

## 正式上線後
- Google Search Console 提交 `/sitemap.xml`
- 使用 URL Inspection 要求重新檢索重要頁
- 檢查 Search Console 中生成式 AI / AI Overview 可見度報表（帳號若已開放）
- 正式網域確定後，把 Canonical / OG / Schema 相對 URL 改成完整 HTTPS URL
- 持續累積真實商品評價、品牌故事、實際使用情境、FAQ、門市與企業採購案例，這些第一手內容比大量生成關鍵字頁更重要
