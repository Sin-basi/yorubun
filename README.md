# yorubun（夜文法）

## GitHub Pages

網站活了，2026-08-06 15:xx 那次部署成功：

```
https://sin-basi.github.io/yorubun/
```

repo 是 `https://github.com/Sin-basi/yorubun`。推上 master 就會自動部署，
工作流程在 `.github/workflows/pages.yml`。

### 之前卡了三小時，症狀與解法記在這裡

症狀是檔案上傳都成功（`upload-pages-artifact` 通過），卡在 `deploy-pages`，
部署進了佇列就再也沒有任何狀態更新，十分鐘後逾時。多次嘗試、
兩條不同部署路徑，結果相同。GitHub 狀態頁顯示全站正常。

**最後是它自己好的，我方沒有做對什麼。** 查證結果是 GitHub 平台的
已知問題，community discussions #200809、#200817、#200854、#184211
都是同一症狀，2026 年 7 月起多人回報，官方沒有確認原因也沒給解法。
所以下次再遇到，先確認下面兩個坑清乾淨，然後就是等。

我方已排除的項目（不用再查一遍）：repo 公開未封存、Actions 已啟用、
`github-pages` 環境的分支政策含 `master`、預設分支 `master`、
`.nojekyll` 已加、index.html 在根目錄、artifact 只有 43KB、
工作流程的權限與 action 版本、**帳號主要 email 已驗證**。

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

兩個坑都清乾淨之後，部署還是逾時了幾次，再過大約一小時就自己通了。
所以判斷「還在卡」的標準是：新 SHA、沒有 in-progress 擋著，仍然逾時。
那就只能等，不必再動設定。

---

日文文法自學 PWA。規劃文件在 `V:\pm-lab\yorubun\`，
產品事實在 `PRODUCT.md`，視覺系統在 `DESIGN.md`。

目前狀態：**正式 app（Phase 2 完成）**。已有首頁、一課的卡片流、
設定頁、localStorage 進度、service worker 離線、manifest 與圖示。
內容目前兩課（序章第 1 課 品詞の地図、第一部第 7 課 は と が）。

翻頁是**點畫面右半前進、左半後退**，左右滑動也可以。
第一張卡按左半就回首頁 — standalone 沒有瀏覽器返回鍵，
每個畫面都留了 app 內的出口。

## 檔案

```
index.html            殼，只有 head 與一個容器
app.css               全部樣式。字級用 rem，根字級由設定頁控制
app.js                全部邏輯。三個畫面：home / lesson / settings
sw.js                 service worker。改任何 shell 檔都要把 VERSION 加一
manifest.webmanifest  PWA 資訊
icons/                180 / 192 / 512，另有兩個 maskable
content/index.json    課程總表。app 啟動只讀這份，toc 是「已產出的課」
content/batch01.json  第一批的課文內容
prototype.html        視覺原型的定格，不再跟著 app 走，留著對照用
```

**`prototype.html` 已經不是 `index.html` 的來源了。** 以前兩個檔要
互相複製，現在 app 是獨立的一套，原型只是當時的紀錄。

## 在手機上看

```
https://sin-basi.github.io/yorubun/
```

**手機走的是電信商行動數據，不在電腦的網段上，所以區網位址一律無效。**
這件事踩過兩次，不要再提議 `http://10.1.1.12`。

用 Safari 開上面的網址，分享選單選「加入主畫面」。
**先安裝再開始讀**，主畫面 app 與 Safari 的儲存空間是分開的，
在 Safari 累積的進度不會自己跟過去（要搬的話用設定頁的匯出匯入）。

備援網址（Pages 又壞掉時用）：

```
https://raw.githack.com/Sin-basi/yorubun/master/index.html
```

githack 也能跑整個 app，相對路徑、目錄根、service worker 都成立，
branch 網址約一分鐘更新一次。statically.io 與 jsDelivr 不能用，
它們把 `.html` 當 `text/plain` 送，Safari 會顯示原始碼。

## 在電腦上看

`start-server.cmd`（或 `python -m http.server 80 --bind 0.0.0.0`），
然後開 `http://localhost/`。這條路徑只給自己驗證用。

**改完檔案沒看到變化，先想 service worker。** 它把 shell 快取成
cache first，這正是離線能用的原因，但開發時會擋住新版。
瀏覽器 console 跑這段清乾淨再重整：

```js
(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())await caches.delete(k);location.reload()})()
```

正式改版時是把 `sw.js` 的 `VERSION` 加一，使用者端會自己換掉。

## 設定與進度

配色、假名、中文說明、字級都在設定頁，選了就存進 localStorage。
進度也在同一個 key（`yorubun`），設定頁可以整包匯出成一段文字再貼回來。

**加入主畫面的 app 與 Safari 的 localStorage 是兩個空間。**
在 Safari 讀過的進度不會自動跟進主畫面 app，要用匯出匯入搬。
所以首頁在還沒安裝時會一直提醒先加入主畫面。

課程推進看的是完成與否，不是日曆。今天沒讀，明天打開還是同一課。
今天讀完了，當天再打開會停在同一課（按鈕變「もう一度読む」）並預告
明天那一課，想直接往下讀也有入口。

## 網址參數

只剩 `prototype.html` 還吃這些，正式 app 沒有。

| 參數 | 值 | 說明 |
|---|---|---|
| `dir` | `hanshita` / `joyato` | 深色方向 |
| `day` | `1` / `7` | 哪一課 |
| `i` | 0 起算 | 直接跳到第幾張卡 |
| `s` | `0` / `1` / `2` | 言い換えカード的三段 |
| `w` | 280 到 560 | 把版面框到指定寬度 |

例：`prototype.html?dir=joyato&day=7&i=12&s=2&w=390`

## 截圖

`shots/v6/` 是最後一輪，`shots/v7/` 是刻度動畫改用 transform 之後的
確認圖。都是 390px 版面寬度。
