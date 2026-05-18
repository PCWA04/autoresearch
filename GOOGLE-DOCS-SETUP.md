# Google Docs 串接設定

## 1. 建立 Google Cloud OAuth 憑證

1. 到 Google Cloud Console 建立或選擇一個專案
2. 啟用 Google Docs API
3. 建立 OAuth 2.0 Client ID
4. 應用程式類型選 `Web application`
5. Authorized redirect URI 設為：

```text
http://localhost:8787/auth/google/callback
```

## 2. 設定環境變數

```powershell
$env:GOOGLE_CLIENT_ID="你的 Client ID"
$env:GOOGLE_CLIENT_SECRET="你的 Client Secret"
$env:GOOGLE_REDIRECT_URI="http://localhost:8787/auth/google/callback"
```

## 3. 啟動後端後授權

開啟：

```text
http://localhost:8787/auth/google/start
```

完成 Google 授權後，後端就能建立文件。

## 4. 測試建立 Google Doc

```powershell
$body = @{
  title = "測試研究報告"
  content = "這是一份測試內容"
} | ConvertTo-Json

Invoke-WebRequest `
  -UseBasicParsing `
  -Method POST `
  -Uri http://localhost:8787/api/docs `
  -ContentType "application/json" `
  -Body $body
```

成功時會回傳：

```json
{
  "documentId": "...",
  "url": "https://docs.google.com/document/d/.../edit"
}
```
