# yorubun（夜文法）

## GitHub Pages 現況（2026-08-06）

repo 是 `https://github.com/Sin-basi/yorubun`，程式碼都在上面。
**Pages 部署尚未成功，網站還沒活。**

症狀：檔案上傳都成功（`upload-pages-artifact` 通過），
卡在 `deploy-pages`，部署進了佇列就再也沒有任何狀態更新，
十分鐘後逾時。多次嘗試、兩條不同部署路徑，結果相同。
GitHub 狀態頁顯示全站正常，設定頁沒有任何錯誤橫幅。

已確認正確的項目：repo 公開未封存、Actions 已啟用、
`github-pages` 環境的分支政策含 `master`、預設分支 `master`、
`.nojekyll` 已加、`index.html` 在根目錄且大小正確。
工作流程本身也已排除嫌疑：`.github/workflows/pages.yml` 的權限、
concurrency 與三個 action 版本都正確，每次都跑到建立部署那一步才卡。

### 排查過程留下的兩個坑

**一、重試不能只重跑工作流程，必須推新的 commit。**
Pages 的部署以 commit SHA 當識別碼。前一次逾時中止會把那個 SHA
標成 cancelled，之後同一個 SHA 再跑 `gh workflow run`，五秒內就會
收到 `Deployment cancelled.`。看起來像新錯誤，其實只是撞到作廢的 SHA。
所以重試一律推 commit，空的也可以：

```
git commit --allow-empty -m "重新觸發 Pages 部署" && git push
```

**二、卡住的部署會擋住後面全部的部署，要手動取消。**
逾時的部署在 GitHub 端可能仍掛在 in-progress，這時新的部署會直接
被拒絕，錯誤訊息是 `due to in progress deployment. Please cancel
<SHA> first`。用 API 取消那個 SHA 才解得開：

```
gh api --method POST repos/Sin-basi/yorubun/pages/deployments/<SHA>/cancel
```

### 目前的結論

上面兩個坑都清乾淨之後（2026-08-06 13:29 那次），部署建立得很乾淨、
沒有任何阻擋，然後照樣在佇列裡躺滿十分鐘逾時。
**所以這是 GitHub 端的佇列問題，repo 這邊沒有東西可以再調。**
下一步只有兩條：等幾小時再推一次看佇列有沒有恢復，
或找 GitHub Support（順便確認帳號主要 email 已驗證）。

在 Pages 活起來之前，手機端走下面的區網或離線方式，不擋開發。


日文文法自學 PWA。規劃文件在 `V:\pm-lab\yorubun\`，
產品事實在 `PRODUCT.md`，視覺系統在 `DESIGN.md`。

目前狀態：**視覺原型**。`prototype.html` 一個檔，含兩課真實內容
（序章第 1 課 品詞の地図、第 7 課 は と が）與三個深色方向。
還不是正式 app，沒有 service worker、沒有 localStorage、沒有 manifest。

## 在手機上看

電腦端點兩下 `start-server.cmd`（或自己跑
`python -m http.server 80 --bind 0.0.0.0`）。

手機連同一個 Wi-Fi，用 Safari 開：

```
http://10.1.1.12
```

**要連 `http://` 一起打**，只打 IP 的話 Safari 會當成搜尋關鍵字。

IP 若變了，用 `ipconfig` 查「乙太網路 2」的 IPv4 位址。
`index.html` 是 `prototype.html` 的副本，改完原型要重新複製一次。

連不到時依序檢查：手機是否在 Wi-Fi 而不是行動網路、手機端 VPN 是否關閉、
網址是否含 `http://`。都對還是不行的話，用下面的離線方式。

## 離線方式（完全不用網路）

`prototype.html` 是單一自足檔案，沒有任何外部相依。
用 AirDrop、郵件或 OneDrive 把它送到手機，存進「檔案」App，
點開就會用 Safari 的預覽渲染。

已放一份在 `%USERPROFILE%\OneDrive\yorubun-prototype.html`。

## 網址參數

原型專用，正式版不會有。

| 參數 | 值 | 說明 |
|---|---|---|
| `dir` | `keiki` / `hanshita` / `joyato` | 深色方向 |
| `day` | `1` / `7` | 哪一課 |
| `i` | 0 起算 | 直接跳到第幾張卡 |
| `s` | `0` / `1` / `2` | 言い換えカード的三段 |
| `rd` | `0` / `1` | 読み假名顯示，預設開 |
| `zh` | `0` / `1` | 說明的中文顯示，預設開 |
| `w` | 280 到 560 | 把版面框到指定寬度，用來在電腦上預覽手機尺寸 |
| `dbg` | `1` | 顯示版面量測值 |

例：`prototype.html?dir=joyato&day=7&i=12&s=2&w=390`

畫面底部有原型控制列，可以直接切方向、切課、開關假名。

## 截圖

`shots/v6/` 是最後一輪，`shots/v7/` 是刻度動畫改用 transform 之後的
確認圖。都是 390px 版面寬度。
