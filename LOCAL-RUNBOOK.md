# 本機半自動運作說明

## 第一次設定

1. 複製 `.env.local.example` 為 `.env.local`
2. 填入：
   - `GEMINI_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. 第一次啟動後，開啟：

```text
http://localhost:8787/auth/google/start
```

完成授權後，token 會保存到 `google-tokens.json`。

## 之後啟動

直接執行：

```powershell
.\start.ps1
```

## 目前已支援

- Google token 重啟後保留
- Google Doc 建立失敗可單獨重試
- Email 寄送失敗可單獨重試
- 研究失敗時可重新執行研究
