# 週報管理工具前端原型

這是一個用來展示週報管理流程的前端原型，包含：

- 報告任務管理
- 頻率、區間與提示詞設定
- OpenAI / Gemini 提供者切換
- 立即執行與狀態顯示
- Google Doc 與 Email 輸出流程

## 線上預覽

若你把這個專案放到 GitHub Pages，首頁會直接使用 `index.html`。

若你剛更新過前端檔案，但頁面看起來仍像舊版，請一併更新 `index.html`，再重新整理頁面。

## 專案結構

```text
.
|-- index.html
|-- styles.css
|-- src/
|   |-- data.js
|   `-- main.js
|-- product-blueprint.md
|-- GITHUB-PAGES.md
`-- README.md
```

## 本機啟動

若要在本機預覽，請在此資料夾啟動一個靜態網站服務，然後開啟：

```text
http://localhost:8765
```

## 目前已完成

- 左側任務列表
- 任務切換
- 研究提供者切換
- 重新執行狀態模擬
- Google Doc / Email 流程狀態區塊
- 頁面版本號顯示
- Deep Research 後端 API 雛形
- Google Docs 後端雛形
- Gmail 寄送雛形

## 後續可擴充

- 真正的後端 API
- 排程設定儲存
- OpenAI Deep Research 串接
- Gemini Deep Research 串接
- Google Docs API
- Gmail API

## API 雛形

後端 API 測試方式請見 `API-TESTING.md`。

Google Docs 授權與測試方式請見 `GOOGLE-DOCS-SETUP.md`。

Email 測試方式請見 `EMAIL-TESTING.md`。

Markdown renderer 測試方式請見 `MARKDOWN-RENDERER-TESTING.md`。

若要直接用既有 `result.txt` 測試 renderer，請見 `RENDERER-FILE-TESTING.md`。

本機半自動運作方式請見 `LOCAL-RUNBOOK.md`。
