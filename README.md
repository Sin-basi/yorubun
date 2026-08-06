# yorubun（夜文法）

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
