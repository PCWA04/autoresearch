# Email 測試方式

## 1. 重新完成 Google 授權

因為 Email 需要新的 `gmail.send` 權限，更新程式後請重新打開：

```text
http://localhost:8787/auth/google/start
```

## 2. 手動測試寄信

```powershell
$body = @{
  to = "you@example.com"
  subject = "週報工具寄信測試"
  body = "這是一封測試信。"
} | ConvertTo-Json

Invoke-WebRequest `
  -UseBasicParsing `
  -Method POST `
  -Uri http://localhost:8787/api/email `
  -ContentType "application/json" `
  -Body $body
```

成功時會回傳 Gmail message id。
