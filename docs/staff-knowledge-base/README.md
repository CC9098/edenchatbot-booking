# Eden 姑娘內部知識庫

## 目的

呢個資料夾係姑娘內部手冊嘅第一版知識庫，用嚟逐步整理 Google Doc 入面嘅散亂內容，之後可以再接入 staff-only 網頁、搜尋、WhatsApp 模板複製、同內部 AI 問答。

## 來源

- Google Doc: `分類頁面手冊`
- 文件 ID: `1wjOwNF2EIB-53bYwxlVjVuzPrP1poNtH_N65EGZV7HI`
- Notion export: `Eden Series Export.zip`
- Notion export: `EDENGRAM Export Block.zip`
- 首次整理日期: `2026-05-09`

## 使用原則

1. 先做 staff-only 知識庫，不直接放入公開病人 chatbot。
2. 每條內容要分清楚「病人可見文字」同「姑娘內部操作」。
3. 目前過渡期以「完整收錄，不漏資料」為優先，Notion export 內的登入、密碼、付款、系統操作資料會先保留原文。
4. 權限分層之後再做；未分層前，整個知識庫只應放在 staff-only 入口。
5. 收費、付款、醫師接症範圍要標記待覆核，避免舊資料被直接照用。
6. AI 日後可以再按權限收窄；現階段用來協助姑娘搜尋已入庫內容。

## 姑娘新增 Notes

`/nurse/knowledge` 現在支援新增和編輯姑娘 Notes。原始 Google Doc / Notion export 仍然作為匯入底稿保留；姑娘新增或由底稿建立的可編輯副本會儲存在 `knowledge_cards`，並以 `staff-knowledge` tag 隔離。

第一版支援：

- 新增 Note
- 編輯已新增 Note
- 由匯入底稿建立可編輯副本
- AI 問答和搜尋一併讀取匯入底稿與可編輯 Notes

## 目前結構

| 檔案 | 用途 | 狀態 |
| --- | --- | --- |
| [00-intake-index.md](./00-intake-index.md) | Google Doc 需求清單分類 | 初版 |
| [patient-enquiries/home-visit.md](./patient-enquiries/home-visit.md) | 上門出診查詢及訂金流程 | 已整理自 Google Doc |
| [patient-enquiries/seminars.md](./patient-enquiries/seminars.md) | 講座查詢流程 | 已整理自 Google Doc |
| [patient-enquiries/weight-management.md](./patient-enquiries/weight-management.md) | 減重治療查詢 | 只有標題，待補內容 |
| [security-and-credentials.md](./security-and-credentials.md) | 帳號密碼類資料保存規則 | 初版安全規則 |
| [notion-import/eden-series](./notion-import/eden-series) | EDEN 姑娘系列 Notion export | 已原文匯入 |
| [notion-import/edengram](./notion-import/edengram) | EDENGRAM Notion export | 已原文匯入 |

## 目前已匯入數量

- Google Doc 主題：3 篇
- EDEN 姑娘系列：18 篇
- EDENGRAM：11 篇
- 目錄 / 權限備忘：2 篇
- 圖片 / 附件：放在 `public/staff-knowledge-assets/notion-import/`

## 建議下一步

1. 繼續在 Google Doc 加內容。
2. 每次新增一個主題，就抽成一篇 Markdown。
3. 每篇 Markdown 都用同一格式：用途、病人可見文字、姑娘內部動作、待確認、敏感度。
4. 之後再做 Eden staff-only 手冊頁：左側分類、全文搜尋、常用模板一鍵複製。
