# 把 yorubun 推上 GitHub Pages
# 用 deploy.cmd 啟動，或直接 powershell -File deploy.ps1

# 不能設 Stop：PowerShell 5.1 會把原生指令的 stderr 包成 NativeCommandError，
# gh auth status 未登入時正好會寫 stderr，設 Stop 會在第二步直接中斷。
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$REPO = "yorubun"

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Note($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }
function Die($msg)  { Write-Host "`n  失敗：$msg" -ForegroundColor Red; Write-Host "  把這段訊息貼給 Claude。`n"; Read-Host "按 Enter 關閉"; exit 1 }

Write-Host "`n  夜文法　部署到 GitHub Pages" -ForegroundColor White

# --- 1. gh 是否存在 ---
Step 1 "檢查 gh CLI"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Die "找不到 gh CLI。請先安裝 GitHub CLI。" }
Ok "gh 已安裝"

# --- 2. 登入 ---
Step 2 "GitHub 登入"
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Note "接下來會開啟瀏覽器，畫面上會給你一組代碼，貼進網頁即可。"
  Note "選項照預設走：GitHub.com / HTTPS / Login with a web browser。"
  Read-Host "    按 Enter 開始登入"
  gh auth login --hostname github.com --git-protocol https --web --scopes repo
  if ($LASTEXITCODE -ne 0) { Die "登入沒有完成。" }
}
$OWNER = (gh api user --jq .login 2>$null)
if (-not $OWNER) { Die "登入後仍取不到帳號名稱。" }
Ok "已登入：$OWNER"

# --- 3. commit ---
Step 3 "建立 commit"
git add -A | Out-Null
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -q -m "夜文法視覺原型：兩課內容、三個深色方向、言い換えカード"
  Ok "已建立 commit"
} else {
  git rev-parse HEAD 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "沒有任何檔案可以 commit。" }
  Note "沒有新變更，沿用既有 commit"
}
$BRANCH = (git branch --show-current)
Ok "分支：$BRANCH"

# --- 4. repo 與推送 ---
Step 4 "建立 repo 並推送"
gh repo view "$OWNER/$REPO" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh repo create $REPO --public --source=. --remote=origin --push
  if ($LASTEXITCODE -ne 0) { Die "建立 repo 失敗。" }
  Ok "已建立並推送 $OWNER/$REPO"
} else {
  $hasRemote = (git remote) -contains "origin"
  if (-not $hasRemote) { git remote add origin "https://github.com/$OWNER/$REPO.git" }
  git push -u origin $BRANCH
  if ($LASTEXITCODE -ne 0) { Die "推送失敗。" }
  Ok "已推送到既有 repo"
}

# --- 5. 開啟 Pages ---
Step 5 "開啟 GitHub Pages"
$body = @{ source = @{ branch = $BRANCH; path = "/" } } | ConvertTo-Json -Compress
$tmp = Join-Path $env:TEMP "yorubun-pages.json"
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
gh api "repos/$OWNER/$REPO/pages" --method POST --input $tmp 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh api "repos/$OWNER/$REPO/pages" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "Pages 開啟失敗，且查不到既有設定。請到 repo 的 Settings > Pages 手動指定分支 $BRANCH 與根目錄。" }
  Note "Pages 本來就開著"
} else {
  Ok "已開啟 Pages（分支 $BRANCH，根目錄）"
}
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

# --- 6. 等待建置 ---
Step 6 "等待第一次建置（最多兩分鐘）"
$url = "https://$OWNER.github.io/$REPO/"
$done = $false
for ($i = 1; $i -le 24; $i++) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 8 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $done = $true; break }
  } catch { }
  Write-Host "." -NoNewline
}
Write-Host ""

if ($done) {
  Write-Host "`n  好了。手機用行動數據直接開：" -ForegroundColor White
} else {
  Write-Host "`n  推送完成，但建置還沒好。過幾分鐘再開這個網址：" -ForegroundColor Yellow
}
Write-Host "`n      $url`n" -ForegroundColor Green
Note "在 Safari 開啟後，分享選單選「加入主畫面」就能像 app 一樣用。"
Write-Host ""
Read-Host "按 Enter 關閉"
