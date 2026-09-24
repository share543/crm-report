# CRM 專案指引

單檔、零依賴、完全離線的 CRM 業務開發報表工具。核心程式只有 `report.html`（HTML+CSS+JS 全內嵌，無建置步驟），樣本資料 `customer.xlsx`。

## 常用任務語法

- 開新 session 時：告訴我「繼續 CRM 專案，改 report.html，需求：…，有問題先問我」。
- 欄位/區塊名稱、期間與篩選行為沿用 README.md 定義，先讀它再動手。
- 新增純函式（可 Node 測試）比 DOM 渲染優先，並加入 `module.exports`（檔案尾端）。

## 驗證方式

- 無測試框架、無建置步驟。唯一驗證方式：用 Node stub 掉 `document` 後 `_compile` 檔案尾端 `<script>`，呼叫匯出的純函式。
- 注意：Node 無 `DOMParser`，`parseXlsx` 在 Node 跑不起來；要拿資料改用 python/openpyxl 讀 xlsx 產 JSON，再餵給純函式。
- 不要用 CSV 轉檔驗證：`parseCsv` 用純逗號分欄，含引號/逗號的欄位會錯位（產品已知限制，不是 bug）。
- **DOM/E2E 級驗證**用真實 Chromium headless（`/usr/local/bin/chromium --headless=new --no-sandbox --disable-gpu --allow-file-access-from-files --virtual-time-budget=15000 --dump-dom`）：取 customer.xlsx 前 N 筆（python/openpyxl）組 model 檔，注入頁面後用 `localStorage.setItem('crm-data', JSON.stringify(payload))` seed、再 `localStorage.setItem('crm-theme','light')` 固定主題，寫結果到 `document.title` 再 grep。

## E2E seed 的踩雷（2026-09）

- seed 參數**必須包 `JSON.stringify(...)`**：直接插 raw JSON 物件字面值會被 `localStorage.setItem` 字串化成 `[object Object]`（15 字元），`readStoredData` 解析失敗後會**靜默移除 key 回 null**（無 console error，看似「未還原」）。先懷疑測試 harness 再懷疑產品。
- `.snap-btn[data-snap="…"]` 取按鈕的文字要用 `\uXXXX` 跳脫（避免字面非 ASCII 干擾）。
- 量測類驗證（PNG 像素）：頁內 decode preview `img.src` 到 offscreen canvas 後逐像素統計（近黑 `#242a36`、淺色 `#dce2ea` 係數），把摘要寫回 `document.title`。

## 核心領域規則（務必遵守）

- 里程碑（有日期即發生）：`填單日期` → `初步接洽` → `需求確認` → `報價` → `簽約` → `導入`。
- `類別` 值域：`零擔`／`1P(SCM)`／`3P(MO+)`／`甲配`（`甲配` 樣本暫未出現）。`甲指`＝`1P(SCM)`＋`3P(MO+)` 的合併（業務用語，非欄位值）。
- 簽約/導入規則：`零擔`/`甲配` → 簽約＋導入皆有日期；`1P`/`3P` → 簽約空白、導入有日期。
- `課別` 值域：`北一課`／`北二課`／`北三課`／`南一課`／`南二課`／`中課`（另有 `分轉部` 於 KE_ORDER，`KE_QUICK_ORDER` 固定六課別）。
- 期間錨點一律 `填單日期`；本週/上週以自然週（週一為起點）。
- 狀態判定依 `結案` 欄文字（見 README 對照表）。

## 區塊順序（report.html `main` 內）

載入 → 分析期間 → 本日議題 → 開場亮點 → 案件狀態統計 → **各課追蹤簡表** → 進度追蹤表 → 案件類型 → 漏斗 → 排行 → 開發時間 → 轉換流失 → 待留意 → 案件清單 → 原始資料。

## 各課追蹤簡表（2026-09 新增）

- `computeKeQuick(scopeRows, periodRows)` 純函式：`新增`＝periodRows（隨期間）、`開發累計`/`已導入累計`＝scopeRows（全量）。
- 此表只套用 課別／開發者／關鍵字 篩選；不套用 類別（已是欄位維度）與 狀態 篩選。
- 「已導入累計」＝`導入` 日期欄非空；底部每第一層欄位一格（甲指/甲配/零擔）。

## 手機版型（body.mobile，2026-09 新增）

- 自動偵測：視窗寬度 `<700px` ⇒ `body.mobile`；否則貼 `body.desktop`。手機版只**重排＋額外 DOM helper**，不動任何純函式。
- 手動覆寫（工具列「版型」鈕，localStorage `crm-view`＝`auto|mobile|desktop`）：cycle `auto→mobile→desktop→auto`，`resolveViewMode(width, override)` 為純函式；`body.mobile`/`body.desktop` 即時套用並**重 render 兩張寬表**（各課簡表＋進度追蹤表），其餘區塊純 CSS 重排。
- 寬表改卡片（僅 `body.mobile` JS 層，桌面維持 table）：純函式 `groupKeQuickCols(KE_QUICK_COLUMNS)`→`[{l1,groups:[{l2,entries:[{l3,val,col}]}]}]`＋`buildKeQuickMobile(data)`；`progressTotalOf(computeProgress(...))`＋`buildProgressMobile(data)`。稅收快表沿用 `.qk-table`。
- 手機手風琴：`section.card.folded` 由 CSS 隱藏 `> :not(h2):not(.list-head)`；折疊 under `body.mobile`。SVG 一律 `max-width:100%; height:auto`（sparkline 統一 56px 高）。

## 開會資訊 sparkline（2026-09 新增）

- `buildMeetingInfo` 末項「新增動向」（`spark:true`、`points`、`k`＝動態標題）＝`buildSparkBuckets(rows, from, to, now, { scope })`＋`sparkTitle(period, unit)`＋`sparkScope(period)` 純函式。
- 分箱單位隨期間跨度動態切換（`pickSparkUnit`）：`週/月`期間→**每日**（週期間底軸標「一二三四五六日」；月期間每 5 天一標＋末日）；`季`→**每週**（底軸只在月初所在桶標「M/1」）；`年`→**每月**（單年標月份每 3 個月一標、多年標 `YYYY/M` 每約 1/6）；`全部/自訂`依資料實際跨度由 `sparkUnit(daysSpan, months)` 挑（≤31 天→日、≤95 天→週、≤60 個月→月、其餘→年）。
- **只畫到今天**：`to` 在今日之後一律以今日封頂（本週/本月/本年不再把未來日零填充下拉）。
- 不套用 課別／開發者／關鍵字 篩選（與「案件件數」同源＝原始列）。
- `makeSparkline(container, pts)` 吃 `[{count,label,tick}]`（純 SVG polyline＋面積漸層＋末點綠點，viewBox 340×68、preserveAspectRatio=none）為 DOM helper，不屬 Node 純函式但照 export。空集合顯示 `無資料`。
- 計數一律依 `填單日期`；分箱用 `periodKeyDay`/bisect 對 `dayStarts` 統計（`countInRange`）。

## 區塊存成圖片（2026-09 新增）

- 每張 `section.card` 右上角注入 `.snap-btn`（`addSnapshotControls()`，冪等；僅有 h2 的卡）。
- 核心 `generateSnapshot(sectionEl, opts)`：`#snapHost` 離屏量測 → XHTML NS `<foreignObject>` SVG ＋ 內嵌改寫過的整份 CSS（`rewriteSnapshotCss`：`:root`→`.shot-root`、`body`→`.shot-root`、抽掉 `@media print`）→ dataURL → Canvas（scale 1/2）→ PNG。
- 背景選項語意：`theme`＝**把頁面實際 `data-theme` 掛在 `.shot-root` 上**（Light 頁才輸出淺色圖）；`white`＝吐 `data-theme="light"`；`transparent`＝對 `.shot-root, .card` 強制 `background:transparent`（內容仍深/淺主題原樣）。純函式 `snapBackgroundFill` 只負責 canvas 底層。
- 快照固定隱藏 `.snap-btn`（`display:none`），圖內不會出現存圖按鈕。
- 對應純函式/匯出：`stripPrintBlocks`、`rewriteSnapshotCss`、`shotFilename`、`snapshotTitleText` 等（exports 逾 140）。

## 表格背景色階

- `.pg-table`（進度追蹤表）與 `.qk-table`（各課簡表）的列 hover／合計／已導入列背景與 `td` 邊框一律用主題變數 `--row-hover`／`--row-hover-strong`／`--row-hover-strong-2`／`--row-hover-3`／`--cell-border`（深/淺各一組），**不要再寫死** `#1b202a`/`#242a36`/`#2a3140`/`#20242c`（Light 主題會反黑）。

## 已了解的需求語氣

使用者偏好：先確認語意再動手；表格維度結構要逐層講清楚；新增區塊會希望與現有「期間＋篩選同步」語意一致，有矛盾時先舉例對照再問。