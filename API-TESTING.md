# Deep Research API 測試方式

## 1. 設定環境變數

先準備至少一組 API key：

```text
OPENAI_API_KEY=...
GEMINI_API_KEY=...
PORT=8787
```

## 2. 啟動後端

```bash
node server.mjs
```

## 3. 檢查服務

```bash
curl http://localhost:8787/health
```

## 4. 建立 OpenAI Deep Research 任務

```bash
curl -X POST http://localhost:8787/api/research/start \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "prompt": "請整理最近 7 天生成式 AI 的重要發展，並以繁體中文產出完整報告。"
  }'
```

## 5. 查詢 OpenAI 任務結果

```bash
curl http://localhost:8787/api/research/openai/RESPONSE_ID
```

## 6. 建立 Gemini Deep Research 任務

```bash
curl -X POST http://localhost:8787/api/research/start \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "prompt": "請整理最近 7 天生成式 AI 的重要發展，並以繁體中文產出完整報告。"
  }'
```

## 7. 查詢 Gemini 任務結果

```bash
curl http://localhost:8787/api/research/gemini/INTERACTION_ID
```

## 目前這個階段完成的事

- 可建立 OpenAI Deep Research 任務
- 可建立 Gemini Deep Research 任務
- 可輪詢任務狀態
- 任務完成後可取得報告文字

## 下一步

下一步可把完成的報告文字送往 Google Docs API，自動建立正式文件。
