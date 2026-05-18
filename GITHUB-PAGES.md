# GitHub Pages 發布方式

## 建立 Repository

1. 到 GitHub 建立一個新的 repository
2. 將此資料夾中的所有檔案上傳到 repository 根目錄
3. 確認 `index.html` 位於最外層

## 開啟 GitHub Pages

1. 進入 repository 的 `Settings`
2. 左側選單進入 `Pages`
3. 在 `Build and deployment` 中選擇 `Deploy from a branch`
4. Branch 選擇 `main`
5. Folder 選擇 `/root`
6. 儲存設定

## 驗證

稍等 GitHub 完成部署後，頁面上會顯示一組公開網址。

打開該網址後，應可看到：

- 週報任務列表
- 任務切換
- Deep Research 提供者切換
- 重新執行後的狀態變化

## 常見問題

### 看到 404

- 確認 `index.html` 是否在 repository 根目錄
- 確認 Pages 是否選擇 `main` 與 `/root`

### 樣式或互動沒有生效

- 確認 `styles.css`、`src/data.js`、`src/main.js` 都已一併上傳
- 保持目前資料夾結構，不要只上傳單一 `index.html`
