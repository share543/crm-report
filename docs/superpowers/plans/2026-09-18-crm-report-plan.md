# CRM 客戶報表工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立單一自包含的 `report.html`，拖曳載入 `customer.xlsx` 後即時產生業務開發報表（總覽、里程碑、時程、流失節點、排行、明細），並支援 CSV／列印匯出。

**Architecture:** 單一 HTML 檔（HTML+CSS+JS 全內嵌）。以原生 `DecompressionStream('deflate-raw')` 解壓 xlsx 的 zip 內容、`DOMParser` 解析 XML、原生 SVG 畫圖，全部在瀏覽器端離線執行。欄位一律以表頭名稱對應。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Web API（FileReader、DecompressionStream、DOMParser、Blob、window.print）。無任何外部依賴。

## Global Constraints

- 單一檔案：`projects/crm/report.html`（所有資源內嵌）。
- 零依賴、完全離線、可經 `file://` 直接開啟。
- UI 一律繁體中文。
- 欄位以**表頭名稱**對應，不寫死欄位 index。
- `DecompressionStream('deflate-raw')` 僅現代瀏覽器支援；舊瀏覽器顯示升級提示。
- 里程碑日期欄：`填單日期`、`初步接洽`、`需求確認`、`報價`、`簽約`、`導入`（Excel 序號→`YYYY-MM-DD`）。
- `類別` 解讀規則：零擔/甲配 → 簽約＋導入都有日期；1P/3P → 簽約空白、導入有日期。
- `結案` 欄文字 = 結案原因，判定合作／不合作結案；`洽談內容` = 洽談過程全文（重要欄位）。
- 測試方式（無自動化測試框架）：改完存檔後，在瀏覽器開啟並拖曳 `customer.xlsx`，依 Task 內「驗證」檢查內容。

---

### Task 1: HTML 骨架 + XLSX 解析引擎 + 檔案載入區

**Files:**
- Create: `projects/crm/report.html`

**Interfaces:**
- Produces:
  - `handleFile(file)` → `Promise<{ headers:Array<string>, rows:Array<Object>, sheetName:string }>`，rows 為 `{ [headerName]: value }`
  - `excelSerialToDate(n)` → `"YYYY-MM-DD"` | `""`
  - `inflateDeflate(buffer)` → `Uint8Array`（NS:`ctx.inflateDeflate`）
  - DOM 結構：`#dropzone`、`#fileInput`、`#fileName`、`#errorBox`、`#rawTable`（暫存驗證用）、`#app`（主版面容器）

- [ ] **Step 1: 建立 HTML 骨架**

建立 `projects/crm/report.html` 基礎結構：極簡 CSS reset、深色簡潔配色、載入區（拖曳＋選檔）、錯誤訊息區、以及空的 `#app` 主容器。完成後先留 placeholder 內容。

- [ ] **Step 2: 實作 zip.EOCD 中央目錄解析**

JS 內實作：掃描 buffer 尾部找 `PK\x05\x06`，讀 `total entries` 與 central directory offset 與 size，再解析每個 central directory entry（`PK\x01\x02`）取得檔名、compression method、compressed size 與 local header offset。

- [ ] **Step 3: 實作 entry 讀取與 DEFLATE 解壓**

依 local header offset 讀 `PK\x03\x04` 取得 data offset（含檔名+額外欄位長度），讀壓縮資料：
- `method=0`（stored）→ 直接 `slice`
- `method=8`（deflate）→ `new DecompressionStream('deflate-raw')` 逐步累加至 `stream.data`，回傳 `Uint8Array`

若 `typeof DecompressionStream === 'undefined'` → `#errorBox` 顯示「需要較新瀏覽器」。

- [ ] **Step 4: XML 解析（workbook／sharedStrings／worksheet）**

`DOMParser('text/xml')`，包成 helper `parseXml(buf)` 回傳 `Document`。
讀取：
- `xl/workbook.xml` → sheet 名稱清單
- `xl/_rels/workbook.xml.rels` → sheet 名→`xl/worksheets/sheetN.xml` 對應
- `xl/sharedStrings.xml` → string 陣列（`<si>` 內所有 `<t>` 串接）
- 各 `sheetN.xml` → 解析 `<row>/<c>`：`t="s"` 查 sharedStrings、`t="inlineStr"` 讀 `<is><t>`、其餘讀 `<v>`

- [ ] **Step 5: 建構統一資料模型 + 日期轉換 + 表頭對應**

- 第一個非空 row 當表頭；`row[colLetter]` → 表頭名建立 index 對映。
- 排除表頭列以外「**僅有序號**」的樣板列：若該列除 `序號` 外所有欄位皆空白 → 過濾掉。其餘視為有意義列保留。
- `excelSerialToDate(n)`：n 可轉數字 → `new Date(Date.UTC(1899,11,30)+n*86400000)`，輸出 ISO 日期字串；非數字或越界回傳 `""`。
- 里程碑日期欄呼叫 `excelSerialToDate` 轉為 `YYYY-MM-DD`，同時保留 raw 值於 `_raw.<欄名>`。
- 每列轉成 `{ [表頭名]: 字串值, _raw: {...} }`。

- [ ] **Step 6: 綁定載入事件與初始版表格**

- `#dropzone` dragenter/dragover 加樣式、drop → `handleFile`。
- `#fileInput` change → `handleFile`。
- `handleFile`：`.xlsx` 走解析引擎；`.csv` 用 `FileReader` 以 UTF-8 讀取，純逗號分欄（不處理引號內容太複雜者用簡單 split 並警告）。
- 解析完：更新 `#fileName`，清除舊 `#errorBox`，並把資料渲染成 `#rawTable`（完整表頭＋前 20 列）供驗證。

- [ ] **Step 7: 驗證 — 用 customer.xlsx 實測**

Run：瀏覽器開啟 `projects/crm/report.html`，拖曳 `customer.xlsx`。
Expected：`#fileName` 顯示檔名；`#rawTable` 出現表頭 25 欄；有意義列 **97 列**；`填單日期`、`導入` 等欄以 `2026-08-XX` 形式呈現（46252 → `2026-08-18`、46253 → `2026-08-19`、46283 → `2026-09-18`，epoch 1899-12-30）。

---

### Task 2: 案件狀態分類 + 統計卡

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: `handleFile` 產生的 `{headers, rows, sheetName}`
- Produces:
  - `classifyStatus(row)` → 狀態字串（`合作成功`|`客戶婉拒`|`聯繫失敗`|`考慮中/暫緩`|`需求無法滿足(暫緩)`|`其他結案`|`進行中`|`未啟動`）
  - `computeStats(rows)` → `{ total, byKe, byStatus, byCategory, coop, nonCoop, rate }`
  - `#statCards`、`#funnel`、`#typeAnalysis`、`#timing`、`#dropoff`、`#charts`、`#rank`、`#list` 等版面區塊（含標題），內容先空或加「待產生」。

- [ ] **Step 1: 實作 `classifyStatus(row)`**

依 `結案` 欄文字順序匹配：
1. 含 `導入完成` → `合作成功`
2. 含 `婉拒` → `客戶婉拒`
3. 含 `三聯皆失敗` → `聯繫失敗`
4. 含 `考慮中` → `考慮中/暫緩`
5. 含 `需求無法滿足` → `需求無法滿足(暫緩)`
6. 其他含 `結案` → `其他結案`
7. `結案` 空白但 `洽談內容` 非空 → `進行中`
8. 否則 → `未啟動`

- [ ] **Step 2: 實作 `computeStats(rows)`**

```js
function computeStats(rows){
  const byKe={}, byStatus={}, byCategory={};
  let coop=0, nonCoop=0;
  for(const r of rows){
    const s=classifyStatus(r);
    byStatus[s]=(byStatus[s]||0)+1;
    const ke=r['課別']||'(空白)'; byKe[ke]=(byKe[ke]||0)+1;
    const cat=r['類別']||'(空白)'; byCategory[cat]=(byCategory[cat]||0)+1;
    if(s==='合作成功') coop++; else if(s!=='進行中'&&s!=='未啟動') nonCoop++;
  }
  return {total:rows.length, byKe, byStatus, byCategory, coop, nonCoop,
          rate: rows.length? (coop/rows.length*100).toFixed(1):'0.0'};
}
```

- [ ] **Step 3: 渲染統計卡**

`#statCards` 顯示：總客戶數、合作結案、不合作結案、成案率（次），以及 `課別` 各課數（北一課…分轉部）。卡片用 CSS grid 排 4 大卡 + 各課小卡。資料來自 `computeStats`。

- [ ] **Step 4: 驗證**

Run：拖曳 `customer.xlsx`。
Expected：
- 總客戶數 **97**、合作結案 **18**、不合作結案 **45**（16 聯繫失敗 + 13 婉拒 + 6 考慮中 + 5 需求無法滿足 + 5 其他結案）、成案率約 **18.6%**
- 課別：北二 23、南一 20、北三 16、南二 15、中 13、北一 10
- 狀態：進行中 **19**（結案空白＋洽談內容有值）、未啟動 **15**（全部空白）

---

### Task 3: 里程碑漏斗 + 類別分析（占比／導入成功率）

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: `computeStats` 的 rows、`excelSerialToDate`
- Produces:
  - `MILESTONES=['填單日期','初步接洽','需求確認','報價','簽約','導入']`
  - `computeMilestones(rows)` → `{ counts:[...], funnel:[{label,count}] }`
  - `computeCategoryAnalysis(rows)` → `[{cat, total, coop, rate}]`
  - `renderFunnel(container, funnel)`、`renderCategoryAnalysis(container, data)`（SVG 圓餅 + 成功率長條）

- [ ] **Step 1: 實作 `computeMilestones(rows)`**

`MILESTONES` 各階段計「該日期欄非空」的列數。漏斗層層遞減數值（不重算）。

- [ ] **Step 2: 實作 `computeCategoryAnalysis(rows)`**

依 `類別` 分組：總數、其中 `classifyStatus==='合作成功'` 數、成功率 `coop/total`。`類別` 空白者標 `(空白)`，在任意處顯示比對：`導入` 有值且 `簽約` 空白 → 該列類別應為 `1P/3P`，以一致數做標註（此為驗證 `類別` 填寫規則）。

- [ ] **Step 3: 渲染漏斗圖（SVG 橫條）**

`renderFunnel`：對每階段繪水平漸層條，長度 ∝ count，旁標數字。容器 `#funnel`。

- 漏斗圖數值**非嚴格遞減**屬正常：1P/3P 客戶「簽約」空白但「導入」有值，故「導入」可能大於「簽約」。
- [ ] **Step 4: 渲染類別占比圓餅 + 導入成功率長條（SVG）**

`renderCategoryAnalysis`：甜甜圈圖（`stroke-dasharray` 分段）標 `類別: 數量 (占比%)`；下方成功率橫條（寬度 ∝ rate%）標 `導入成功率`。

- [ ] **Step 5: 驗證**

Run：拖曳 `customer.xlsx`。
Expected：漏斗依序 **97 → 78 → 52 → 27 → 13 → 18**（填單日期 97、初步接洽 78、需求確認 52、報價 27、簽約 13、導入 18）；類別占比：零擔 45、1P(SCM) 38、3P(MO+) 13、空白 1；導入成功率：零擔 **27%**（12/45）、3P **46%**（6/13）、1P **0%**（0/38）。數字與前面人工分析相符。

---

### Task 4: 時程分析（天數）

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: MILESTONES、rows（含日期字串）
- Produces:
  - `dateToSerial(s)` → 數值（`excelSerialToDate` 的反向，供差日計算；直接回傳 `_raw` 中的序列號）
  - `computeStageDurations(rows)` → `{ stages:[{label, data:[天數...]}], total:{data:[...]} }`（僅對該列該階段起點與終點都有值者計入）
  - `summarize(arr)` → `{n, avg, median, min, max}`
  - `renderTiming(container, timing)`：階段平均長條圖 + 總時程直方圖（SVG）

- [ ] **Step 1: 實作 duration 計算**

階段：`填單日期→初步接洽`、`初步接洽→需求確認`、`需求確認→報價`、`報價→簽約`、`簽約→導入`。天數 = `終點序列號 - 起點序列號`（`_raw` 值）。僅當兩者都存在才計入；負數或非數值該列忽略。總時程 = `導入 - 填單日期`（缺任一忽略）。

- [ ] **Step 2: 實作 `summarize` 與 `renderTiming`**

`summarize`：n、平均（1 位小數）、中位數、min、max。直方圖 bucket：0–6、7–13、14–20、21–27、28–41、42–59、60+ 天（可依資料範圍動態分桶）。

- [ ] **Step 3: 渲染時程表 + 圖**

`#timing` 上方表格：階段、樣本數、平均／中位／最長／最短天；下方 SVVG 長條圖（各階段平均天）+ 總時程分布直方圖。標註 1P/3P 無簽約說明。

- [ ] **Step 4: 驗證**

Run：拖曳 `customer.xlsx`。
Expected（數據源自實際資料）：
- 填單→初步接洽：n=76、avg≈1.1、中位 0、max=13
- 初步接洽→需求確認：n=51、avg≈1.4、max=12
- 需求確認→報價：n=27、avg≈1.5、max=9
- 報價→簽約：n=13、avg≈1.0、max=8
- 簽約→導入：n=12、avg≈0.1、max=1（大部分同日）
- 總時程 填單→導入：n=18、avg≈2.1、max=14

---

### Task 5: 流失節點分析（drop-off）

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: MILESTONES、classifyStatus、rows
- Produces:
  - `lastMilestone(row)` → 最後一個有日期之里程碑 index（`-1`=無任何里程碑）
  - `computeDropOff(rows)` → `{ byCat: { [類別]: { [節點label]: [客戶] } }, nodeLabels:[...] }`（僅納入「非合作成功」客戶）
  - `renderDropOff(container, data)`：每個類別一個區塊，列出各節點停止人數（橫條），點節點→下方展開該批客戶的 `結案` 原因與 `洽談內容` 全文

- [ ] **Step 1: 實作 `lastMilestone(row)`**

對 MILESTONES 由後往前找第一個日期欄非空的 index；都空 → -1。

- [ ] **Step 2: 實作 `computeDropOff` 與渲染**

非合作客戶依 `類別` 分組，再依 `lastMilestone` 分桶。`節點label` 用 `MILESTONES[i]`＋「之後停止」。每個節點為可點擊列，顯示人數；點擊後在 `#dropoff` 下方展開對應客戶：公司名稱、`結案`（原文字）、`洽談內容`（原文，保留換行）。

- [ ] **Step 3: 驗證**

Run：拖曳 `customer.xlsx`。
Expected：非合作完成（無「導入完成」結案）客戶共 **79** 筆，最後節點分布：初步接洽 27、需求確認 20、填單日期 18、報價 13、簽約 1。簽約節點僅 **凱瑞達貿易有限公司**（簽約 09-17、導入空白、類別=零擔）。點擊節點能展開正確客戶清單，顯示其 `結案` 原因與 `洽談內容` 全文。

---

### Task 6: 其他圖表（課別／狀態／排行／時程分布整合）

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: computeStats、rows
- Produces:
  - 共用 SVG helper：`svgEl(tag, attrs)`、`makeChart(container, type, data)`（type: `bar`|`hbar`|`pie`|`hist`）
  - `renderRankings(container, rows)`：開發者／課別／站所排行表
  - `renderStatePie(container, byStatus)`

- [ ] **Step 1: 實作共用 SVG helper**

`svgEl`：`document.createElementNS('http://www.w3.org/2000/svg', tag)`；`makeChart` 依 type 繪製並套長度／顏色常數。橫條用 `<rect>`、圓餅用 `<path>`（arc）、標籤用 `<text>`。

- [ ] **Step 2: 案件狀態圓餅 + 課別長條**

`renderStatePie(container, byStatus)`：合作／不合作／進行中／未啟動占比。課別長條圖：`byKe` 排序降冪。

- [ ] **Step 3: 開發者／課別／站所排行**

`renderRankings`：對群組計數並排降冪；指定開發者排行指標下拉（案件總數／合作結案數／導入完成數／簽約數），課別與站所排行固定為案件數＋導入完成數。以 HTML 表格呈現（含 `#` 名次、數量、bar 比例）。

- [ ] **Step 4: 驗證**

Run：拖曳 `customer.xlsx`。
Expected：開發者排行首位廖怡菁(18)；課別排行＝統計卡各課；狀態圓餅總數和 97；切換指標排行順序正確變化。

---

### Task 7: 篩選列 + 明細表（含洽談內容展開）

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: `handleFile` 結果、`classifyStatus`、各 compute 函數
- Produces:
  - `applyFilters(rows, filters)` → 篩選後 rows
  - `renderList(rows, page)`：分頁（50/頁）+ 排序（點表頭）
  - 狀態：`state.filters`、`state.sortCol`/`state.sortDir`、`state.page`
  - `rebuild()`：依 filters 重算所有面板（統計卡、漏斗、時程、流失、圖表、排行、明細）

- [ ] **Step 1: 實作 `applyFilters`**

filters：`課別`、`狀態`、`開發者`、`類別`（各「全部」＋實際值）、`關鍵字`（比對所有字串欄含不分大小寫）。全空則回傳全部。

- [ ] **Step 2: 實作下拉與搜尋框**

`#filters` 列四個 `<select>`（值由資料動態填充）＋一個 `<input type="search">`。change/input 皆觸發 `rebuild()`。`#resetFilters` 回預設。

- [ ] **Step 3: 明細表 `renderList`**

表頭可點排序（升降冪切換）。分頁按鈕 `◀ 下一頁 ▶`，顯示「目前 N–M / 總 X 筆」。列點擊 → 該列下方展開子表格顯示完整 `洽談內容` 與 `說明`（保留換行）與 `結案` 原文。已展開列再次點擊收起。

- [ ] **Step 4: 接入 `rebuild()`**

`rebuild()` 依 `state.filters` 過濾後，呼叫前五個 Task 的所有 render 函數（統計卡、漏斗、類別、時程、流失、圖表、排行、明細）。確保各面板容器在無資料時顯示空狀態文字。

- [ ] **Step 5: 驗證**

Run：拖曳 `customer.xlsx`，選擇「課別=南二課」。
Expected：明細表剩 15 筆；統計卡／圖表／排行全部同步只剩南二課；點「狀態=合作成功」再辦→篩選交集；關鍵字「寵物」找到守漢實業與免睏；展開列顯示完整洽談內容。

---

### Task 8: CSV 匯出 + 列印樣式

**Files:**
- Modify: `projects/crm/report.html`

**Interfaces:**
- Consumes: `applyFilters`、state
- Produces:
  - `exportCsv(rows)`：篩選結果 → `\uFEFF` BOM 開頭 UTF-8 CSV（欄值含逗號/引號/換行時以 `"` 包圍並跳脫）
  - `#printBtn` → `window.print()`
  - `@media print` 樣式

- [ ] **Step 1: 實作 `exportCsv`**

以 `Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})` + `<a download>` 觸發下載。檔名 `crm-report-YYYYMMDD.csv`。欄：全 25 表頭 + `狀態`（新欄）。

- [ ] **Step 2: 列印樣式**

`@media print`：隱藏 `#dropzone`、`#filters`、按鈕、`#errorBox`；表格避免分頁切欄（`break-inside: avoid`）；`.no-print` 隱藏。加「列印/匯出 CSV」按鈕列在標頭。

- [ ] **Step 3: 驗證**

Run：拖曳 `customer.xlsx`，篩選任一條件後 Export CSV。
Expected：CSV 用 Excel 開啟中文正常（BOM）；`洽談內容` 含換行/逗號者欄位有引號包覆；列印預覽僅顯示報表內容、版面不破版。

---

### Task 9: 完整驗證與收尾

**Files:**
- Modify: `projects/crm/report.html`

- [ ] **Step 1: `file://` 離線實測**

Run：直接雙擊開啟 `report.html`（無 server）。Expected：全部功能運作，無 CDN 請求（DevTools Network 0 requests）。

- [ ] **Step 2: 全量數據比對**

Run：拖曳 `customer.xlsx`，人工檢視所有面板：
- 統計卡：總 97 ／ 合作 18 ／ 不合作 45 ／ 成案率 18.6%
- 課別：北一 10、北二 23、北三 16、中 13、南一 20、南二 15
- 狀態：合作成功 18、客戶婉拒 13、聯繫失敗 16、考慮中/暫緩 6、需求無法滿足(暫緩) 5、其他結案 5、進行中 19、未啟動 15
- 類別：零擔 45（導入 12）／1P(SCM) 38（導入 0）／3P(MO+) 13（導入 6）／空白 1
- 漏斗 97→78→52→27→13→18、時程與流失節點數字合理、排行榜首位廖怡菁 18
Expected：以上全部吻合。

- [ ] **Step 3: 邊界檢查**

Run：分別拖曳 (a) 空 xlsx（僅表頭無資料）(b) 非 xlsx 檔 (c) 損毀檔（文字另存為 .xlsx）。
Expected：顯示可讀錯誤訊息，不白畫面；空檔顯示「無資料」空狀態。

- [ ] **Step 4: 移除除錯輸出並確認無 console error**

Run：DevTools console。Expected：無 error、無 `console.log` 殘留；`DecompressionStream` unsupported 提示邏輯健在。

- [ ] **Step 5: 收尾**

確認 `report.html` 為單一檔案、無外部參考；將此計畫存在 `projects/crm/docs/superpowers/plans/2026-09-18-crm-report-plan.md` 與設計共存。