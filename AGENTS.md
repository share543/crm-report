# CRM 專案指引

單檔、零依賴、完全離線的 CRM 業務開發報表工具。核心程式只有 `report.html`（HTML+CSS+JS 全內嵌，無建置步驟），樣本資料 `customer.xlsx`。

## 常用任務語法

- 開新 session 時：告訴我「繼續 CRM 專案，改 report.html，需求：…，有問題先問我」。
- **工作方式（使用者指定）**：每次動手前從 repo `git clone` 最新版（`github.com/share543/crm-report`），
  **不要在 `~/` 留常態工作副本**；改完 push 回 repo，交付一律以 repo 版本為準。
  寄檔案也一樣每次重新拉：`~/slide/send_crm_report_email.py` 內建 `git clone --depth 1`，
  寄送紀錄會印出對應的 commit。
- ⚠ **刪掉本機副本前必須先確認**：**先 `git fetch`**，再確認 `git status --short` 空白（沒有未提交的改動）＋
  `git rev-parse HEAD origin/main` 兩者相同（已推上去）。少了這一步，未推的改動會隨副本一起消失，
  而且不會有任何錯誤訊息。交付前也順手確認一次 HEAD 與遠端相同。
  **`git fetch` 不可省**：`status` 與 `rev-parse` 只比對「上次 fetch 到的」ref，過期的 `origin/main`
  會讓根本沒同步的副本看起來完全同步。2026-10-03 兩個實例：一份 clone 顯示無領先/落後，實際已
  24/24 分岔（靠 tree 逐筆比對才發現內容其實相同）；`crm-report` 同樣顯示無領先/落後，實際靜默落後 6 個 commit。
- 本機**已有全域身分**（`~/.gitconfig`：`share543` ／ `81697900+share543@users.noreply.github.com`），
  新 clone **不用再設**就能 commit（可用 `git var GIT_AUTHOR_IDENT` 當場驗證）。
  只有在沒有全域設定的環境才需 `git config --local`；一律用 GitHub noreply 位址（ID 前綴形式），
  **不要用私人信箱**——歷史上曾因私人信箱被寫進 commit，導致整條歷史被改寫後 force-push。
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
- **互動類驗證要跑真實時間**：`--virtual-time-budget` 下 compositor 不跑 ⇒ `scrollIntoView()` 不會 commit，捲動斷言必然失敗（看起來像 bug，其實是環境）。
  跑法：chromium 開著不關 → 驅動碼跑完用 `fetch('/__result?d=' + encodeURIComponent(JSON))` 把結果送回本機 `python3 -m http.server`
  → 讀它的 access log 解出結果（access log 會記完整 query string）；另發一個 `/__done?n=PASS_FAIL` 圖片請求當完成信號。
- 驅動碼要呼叫頁面內部函式時，在**驗證副本**注入 `window.__CRM = {…}`；正式檔只留 `module.exports`（瀏覽器拿不到）。
- 數「可見」元素別用 `querySelectorAll().length`（隱藏節點也算），要用 `getClientRects().length`。
- 註解文字會誤觸 `indexOf('@media print')` 這類字串檢查，改成測 `/@media\s+print\s*\{/`。
- 驗「存圖內不出現藍字底線」：在頁面造一個 `<div class="shot-root">` 放 clone，讀 computed style（連結色＝父層色、`border-bottom-width` 為 `0px`）。

## 核心領域規則（務必遵守）

- 里程碑（有日期即發生）：`填單日期` → `初步接洽` → `需求確認` → `報價` → `簽約` → `導入`。
- `類別` 值域：`零擔`／`1P(SCM)`／`3P(MO+)`／`甲配`（`甲配` 樣本暫未出現）。`甲指`＝`1P(SCM)`＋`3P(MO+)` 的合併（業務用語，非欄位值）。
- 簽約/導入規則：`零擔`/`甲配` → 簽約＋導入皆有日期；`1P`/`3P` → 簽約空白、導入有日期。
- `課別` 值域：`北一課`／`北二課`／`北三課`／`南一課`／`南二課`／`中課`（另有 `分轉部` 於 KE_ORDER，`KE_QUICK_ORDER` 固定六課別）。
- `日均量體` 值域（**預定改為下拉選單**，行政處理中）：`≤10`／`11-50`／`51-100`／`101-200`／`201+`，單位為**件/工作日**（月以 **22 工作日**計）。
  目前為自由文字（如 `非檔期5~10件/天`）且**未被程式引用**；改為下拉選單不影響 `parseXlsx`（實測 5 情境通過），亦不需同步改程式。
  ⚠️ 轉換前必須先將原文字中的檔期資訊搬移至 `備註`，否則永久遺失。
- 期間錨點一律 `填單日期`；本週/上週以自然週（週一為起點）。
- 狀態判定依 `結案` 欄文字（見 README 對照表）。

## 區塊順序（report.html `main` 內）

載入 → 分析期間 → 本日議題 → **待留意** → 開場亮點 → 案件狀態統計 → **各課追蹤簡表** → **未啟動案件追蹤表** → 進度追蹤表 → 案件類型 → 漏斗 → 排行 → 開發時間 → 轉換流失 → 案件清單 → 原始資料。

新增區塊要同時改**四個**地方：`<main>` 內的 section、`PRESENT_SLIDES`、`PRINT_SECTIONS`（列印勾選清單）、本行。
其餘都與順序無關（渲染用 `getElementById`、沒有任何順序常數或依 id 排序的 CSS、
localStorage 以 id 為 key、列印與存圖跟 DOM 走）。

## 未啟動案件追蹤表（2026-10 新增）

- 條件：`classifyStatus(r) === '未啟動'` **且** `填單日期` 非空。
- **不套用分析期間與任何篩選**（`renderNotStartedSection()` 直接吃 `state.model.rows`）。
  與案件清單筆數不一致是預期行為 → 表頭必須保留「本表不隨分析期間與篩選縮放」註記。
- **課別堆疊橫條**（2026-10-05 改版）：一列一課別，長條內堆疊類別（顏色區分），
  課別依**總計多→少**（同數依 `KE_BASE_ORDER`），長條**以最大值為 100%**；
  表頭為 課別／類別組成／總計；**預設全部收攏**，點列展開該課別的案件清單
  （按類別分小節），案件可再點開明細。
- 純函式：`collectNotStarted(rows)`、`notStartedGroups(rows)` →
  `{ total, max, items: [{ ke, count, cats: [{ cat, count, rows }] }] }`；
  `NS_CAT_ORDER` 常數。舊 `groupNotStarted(rows)` 保留為相容介面（委派給 `notStartedGroups`）。
- DOM：`renderNotStartedSection()` / `buildNotStartedGroupRow(item, max)` /
  `buildNotStartedItem()` / `buildNotStartedDetail()`。
- ⚠️ **列印陷阱**：`.ns-grow` 與 `.ns-item` 是 `<button>`，會被列印樣式的
  `button{display:none}` 藏掉 → PDF 只剩表頭與明細，課別／類別／數量／比例與案件名稱全消失。
  必須在 `@media print` 內 `.ns-grow,.ns-item{display:flex!important}` 還原
  （與 `.row-warn`／`.pg-warn` 同類問題）。列印另需展開 `.ns-cases[hidden]` 與 `.ns-detail[hidden]`。
- 明細**只用 5 欄**（統一編號、公司名稱、站所、開發者、填單日期）——
  不要改回 `buildListDetail()`：這批案件的 `洽談內容`/`結案`/`說明` 填充率是 0/26、0/26、2/26，
  用通用明細只會顯示整片「（無資料）」（實測踩過）。
- 明細標籤用 `--muted` 而非 `--accent`（用藍色會被誤認為可點連結）。

## 改區塊順序（2026-10）

三處要一起改：`<main>` 的 section、`PRESENT_SLIDES`、本檔的「區塊順序」。

驗證怎麼跑（repo 沒有 `customer.xlsx`，自建 seed）：

1. **起本機 http 服務** —— `file://` 下 Chromium 停用 localStorage，直接開檔資料不會
   還原（畫面全 `hidden`、`#presentBtn` 仍 disabled），看起來像功能壞了，其實是環境。
2. 在**副本**注入 seed：`localStorage.setItem('crm-data', <JSON 字串>)`。
   ⚠️ 必須是字串 —— 塞物件字面值會被字串化成 `[object Object]`（15 字元）而靜默失敗。
3. 驅動碼要插在**最後一個** `</body>` 之前 —— 檔案裡「存檔（含資料）」的序列化字串
   也含有 `</body>`，插到第一個等於插進 JS 字串裡，整段不會執行。
4. `--headless=new --dump-dom` 跑完後讀結果：寫進 `documentElement` 屬性會被保留，
   **寫 `document.title` 會被頁面覆蓋掉**，不要只看 title。
5. 驗收清單：15 塊 DOM 順序、`#presentBtn` 已 enabled、逐頁 `#pvCount`／`#pvTitle`
   （14 頁）、離開簡報後 15 塊歸位順序與進入前相同、`.snap-btn` 數量＝有 h2 的卡片數。

## 列印設定面板（2026-10 新增）

- 工具列「列印」不再直接 `window.print()`，改開面板（`openPrintPanel()`）。
- 純函式（已 export）：`PRINT_SECTIONS`（14 項，**不含** `loadCard`／`periodCard`，載入與分析期間為控制用）、
  `PRINT_VIEW_OPTIONS`、`PRINT_LIST_OPTIONS`、`normalizePrintView`、`normalizePrintList`、
  `normalizePrintEnabled`、`printVisibleIds`、`resolvePrintView`。
- 狀態：`state.printEnabled`（`{區段id:boolean}`，未列＝true）、`state.printView`（`'auto'|'mobile'|'desktop'`）、
  `state.printList`（`'page'|'all'`）。**與簡報勾選 `state.presentEnabled` 各自獨立**，不要合併。
- 列印排除用 `@media print{ body.printing section.card.print-off{display:none!important} }`：
  **掛 `body.printing` 才生效**，所以畫面顯示不受勾選影響，不會誤刪 DOM。
- 版型切換：`doPrint()` 在 `needSwitch` 時**暫時**改 `body.classList` 並 `rerenderViewSensitiveSections()`
  （只重繪各課簡表／進度追蹤表兩個「依版型選 renderer」的寬表），
  **不動 `state.viewMode`**（保留 `prevMode` 供還原），列印後還原。
- 案件清單範圍：`printList='all'` 時 `expandListForPrint()` 以「一頁裝完」重繪
  （`renderList` 傳 `start:0, end:全部, totalPages:1`，**不要呼叫 onPage**，否則會改到 `state.page`），
  並先存 `printListBackup={page}`；列印後 `restoreListAfterPrint()` 還原頁碼並 `rebuildListResults()`。
- 還原用 `afterprint` ＋ `setTimeout(2000)` **雙重保險**（部分環境不觸發 `afterprint`）；
  `restore` 內先 `removeEventListener` 避免重複執行。
- 全部取消時 `readPrintPanel()` 回 false → **不列印**且面板保持開啟。
- 持久化：`persistData()` 與 `currentDataPayload()`（存檔副本）都要帶
  `printEnabled`/`printView`/`printList`；`tryRestoreData()` 的**兩條路徑**（內嵌副本／記憶）
  都要呼叫 `restorePrintConfig()`。漏掉任一條，存檔副本開啟後設定不會還原。

### 列印 PDF 只輸出勾選區塊

- `@media print` 內隱藏 `.topbar`、`#loadCard`、`#periodCard`（操作型 UI 不進 PDF）。
- 列印專用大標題：`<div class="print-only print-title">業務開發進度報表</div>`
  ＋ `.print-only{display:none}`（畫面完全不佔空間）→ `@media print` 內 `display:block`。
- 手機版型列印時要一併隱藏 h2 收合箭頭：`body.mobile section h2::after{content:none!important}`。

### 警示在紙上的可辨識性（2026-10 新增）

- **⚠ 是 `<button>`**，列印樣式有 `button{display:none}` 會把它藏掉 →
  `@media print` 內 `.row-warn,.pg-warn{display:inline!important; color:#8a6111!important}`。
- **列印強制淺色主題色票**：`@media print{ :root:root:root{ --error:#c03434; ... } }`。
  ⚠️ **特異性陷阱**：`:root[data-theme="light"]` 是 (0,2,0)，用 `html`（0,0,1）**會被蓋掉**；
  必須用 `:root:root:root`（0,3,0）。實測：用 `html` 時深色主題列印仍是 `#FF6B6B` 亮紅。
- 嚴重度文字標籤：`ALERT_SEV_LABEL = {high:'錯誤', mid:'提醒', low:'資料'}`，
  卡片標題前插 `.alert-sevtag`，**畫面上 `display:none`、列印才顯示**。
- 欄位級問題標記：`ALERT_FIELD_MAP = {mismatch:['簽約','導入']}` ＋ `alertFieldsOf(row)`；
  `buildListRow` 對這些欄位加 `.cell-mismatch`，列印用 `print-color-adjust:exact` 保留底色。

### 列印驗證怎麼跑

- 純函式：Node stub `document`/`window`/`localStorage` 後 `require` 抽出的主 script（見「驗證方式」）。
- E2E：**seed 必須插在主 script 之前** —— 主 script 尾端是 `if(typeof document !== 'undefined' && document.getElementById){ initApp(); }`
  **同步執行**，插在它之後的 seed 太晚，`tryRestoreData()` 讀不到 → 畫面全空、`#printBtn` 仍 disabled。
  （比舊筆記更嚴格：不只 `</body>` 要挑最後一個，seed 還必須在主 script 前。）
- 攔截 `window.print` 再按「開始列印」，可驗證列印期間的 `body` class、`print-off`、寬表是否改卡片。
- **真實 PDF 是最強證據**：`--print-to-pdf=<path>` ＋ `pdftotext` 抽文字比對區塊標題；
  再 `pdftoppm -png` 轉圖做像素量測（`PIL` 統計飽和色，可驗證主題色是否被固定）。
- ⚠️ **snap chromium 寫不進 `~/.hermes/...`（AppArmor 擋隱藏目錄，Permission denied 13）**，
  輸出檔要放家目錄下的非隱藏路徑（如 `~/crm-print-test/`），測完刪除。
- 寬表在手機版是 **JS 產生**（`.keq-card`／`buildKeQuickMobile`、`buildProgressMobile`），不是純 CSS；
  驗證時別用 `.ke-card`（那是案件狀態統計的 class）。
- 驗「案件清單只印當前頁」：用 `pdftotext` 抽出的序號集合判斷
  （page 模式只出現 50 個序號；all 模式出現全部）。

## 本日議題：層級化語法（2026-10-06 新增）

**語法**（行首符號決定層級；行內 `_文字_` 表底線）：
`#` 大項（自動編號）／`-` 項目／`*` 重點／`**` 次重點／`>` 說明。
**無符號＝大項**（舊資料相容）；舊資料若自己打了 `1.`／`一、`／`(2)` 會自動去掉，避免「1. 1.」。

- ⚠️ **解析順序**：`AGENDA_PREFIXES` 內 `'**'` 必須排在 `'*'` 之前，否則次重點會被吃成重點。
- **單一來源**：解析、工具列、圖例都讀 `AGENDA_PREFIXES` / `AGENDA_TYPES`，新增層級只要改這兩處 + CSS class `.ag-<type>`。
- **儲存格式不變**：`state.agenda` 仍存**原始文字行（含符號）**，`normalizeAgenda` 只去空白行；
  渲染時才 `parseAgendaLines` 解析。舊存檔（純字串陣列）直接可讀。
- **`stripManualNumber`** 用負向先行 `(?!\d)` 排除小數，否則「1.5 億」會被誤刪成「5 億」。
- **純函式（已 export）**：`parseAgendaLines`、`parseAgendaInline`、`stripManualNumber`、`normalizeAgMarker`。
- **渲染**：`renderAgendaNodes(ul, nodes)` 一律 `createElement`／`createTextNode`（防注入）；
  大項編號由渲染時累加，**不要**寫進儲存內容。
- **編輯器**：工具列按鈕 `agendaApplyPrefix` 會**先去掉該行原有符號再套用**（可反覆切換、不疊加）；
  `agendaWrapUnderline` 包底線；`agendaHandleEnter` 在 Enter 時沿用上一行符號
  （該行只有符號時則清掉符號結束該層）。工具列按鈕的顯示文字要與實際插入字元一致
  （曾出現按鈕寫全形 `＿` 但插入半形 `_`）。
- **全形相容**：`normalizeAgMarker` 把 `＃－＊＞` 轉半形（中文輸入法常打出全形）。
- **行內箭頭**：`normalizeInlineArrows(text)` 把 `->`／`=>`／`>`／`＞` 轉成 `→`，
  一行內可重複任意次（`A > B > C` → `A → B → C`）。`renderAgendaNodes` 在切底線**之前**先過這一關，
  所以箭頭與 `_底線_` 可並用。
  ⚠ 規則刻意單純：行內**所有** `>` 都變箭頭，**數字前也一樣**。
  曾加「後面是數字就不轉」的保護來保全「大於」語意，結果 `*南一課 > 19 件` 不會變成箭頭，
  反而違背需求 —— 這種「聰明的例外」會讓行為難以預測，已移除。要表達大於請寫「超過 30 天」。
- 工具列「→ 流程箭頭」按鈕用 `data-ag-insert`（在游標處插入 `' > '`，**不改變行首層級**），
  與 `data-ag-prefix`（行首層級）、`data-ag-wrap`（包底線）三者是不同的動作。

- **列印**：`@media print{ .agenda-editor, .agenda-empty-btn{display:none!important} }`，
  編輯器是操作介面不該進 PDF。投影層級字級只在 `body.pv-mode #agendaList > li.ag-*` 調，內容不省略。
- ⚠️ **議題的層級標記一律用 flex，不要用「絕對定位 + 手寫 left」**。
  踩過的坑：每個標記寫死 `left`，卻沒算字形實際寬度 → 全部都會壓到文字：
  `★` 寬 15px（right 31 > 文字 30）、`◦` 寬 16px（right 54 > 文字 52）、
  原本的「說明」徽章寬約 30px（right 60 > 文字 52）。
  連**投影模式**也中招（★ −2、◦ 0）。**只修被回報的那一個會漏掉其他的** —— 要一次修全部。
  現行做法：`.ag-item/.ag-key/.ag-subkey/.ag-note` 皆 `display:flex`，
  標記 `flex:0 0 22px`（投影 32px）、`gap:8px`（投影 12px），
  文字欄位因此固定為 大項 17／項目與重點 30／次重點與說明 52（投影 44／74）。
  「說明」用朝右箭頭 `→`，不再用文字徽章（徽章太寬，是重疊主因）。
- **驗證方式**：`Range.getBoundingClientRect()` 量文字左緣，再用「同款樣式的探針 span」
  量 `::before` 的寬度（`getComputedStyle(li,'::before')` 取 font/padding/border 後組一個 span），
  兩者相減即為實際間距；螢幕／預覽／投影三處都要量。
  另注意**預覽只在編輯器開啟後才渲染**（`updateAgendaPreview` 由 `openAgendaEditor` 觸發），
  沒開編輯器就檢查 `#agendaPreview` 會誤判為空。
- **驗證**：`parseAgendaLines` 的邊界要測到 —— `**` 優先於 `*`、無符號→大項、手動編號去除、
  小數不誤刪、全形符號、空行／只有符號忽略、行內底線切段、存檔往返一致。

## 區塊 →「案件清單」跳轉／回跳（2026-10-06 新增）

- **右上工具列 `.card-tools`**：`position:absolute; top:14px; right:14px; display:flex; gap:14px`，
  內含 `[☰ 案件][⬇ 存圖]`。**一律插在卡片本身**（`card.insertBefore(tools, card.firstChild)`），
  不要插進 `.list-head` —— 那會讓清單那張的按鈕比其他卡片內縮 20px。
  要再加按鈕就往這個 flex 群組 append，**不要新增第二個 absolute + 手寫 right 值**。
- **純函式／函式**：`jumpToListSection(card)`、`backToJumpFrom()`、`updateBackControls()`、`updateBackPill()`。
  `state.jumpFrom = {id,title}` 只記最近一個來源（單層返回），**不隨存檔保存**。
- **案件清單自己不放跳轉鈕**（`card.id !== 'listSection'`）；D1＝所有其他區塊都放。
- **跳轉保留篩選與頁碼**（J1），不可偷偷重置。跳轉展開目標區塊、回跳展開來源區塊，兩者都 `pulseClass` 高亮。
- **回跳兩個入口但同一時間只出現一個**：標題列鈕常駐；浮動膠囊 `#backPill` 只在
  「標題列已捲出畫面上方」且「還在清單附近」時出現。
- 列印／簡報／存圖 PNG **三處都要隱藏**：`@media print{ .card-tools, #backPill{display:none!important} }`
  （⚠ `#backPill` 是 `position:fixed`，不關掉會在 PDF 每頁重複）、
  `body.pv-mode .card-tools{display:none!important}`、
  `snapshotCss += '.shot-root .card-tools{display:none!important}'`。

### ⚠️ 兩個「以為會動、其實不會動」的環境地雷（都踩過）

1. **`html{scroll-behavior:smooth}`（第 700 行）＋ `scrollIntoView({behavior:'auto'})` = 平滑動畫**。
   依規範 `'auto'` 是「**沿用 CSS 設定**」，不是「不滑動」。在平滑動畫不推進的環境
   （headless／`--virtual-time-budget`、背景分頁、部分無障礙設定）**完全不會捲動**。
   → 要即時捲動一律用 **`behavior:'instant'`**。全站 4 處已改（含 `jumpToCase`／`focusAlertEntries`）。
   → 測試腳本自己 `window.scrollTo()` 也一樣，要寫 `scrollTo({top, behavior:'instant'})`。
2. **`requestAnimationFrame` 節流會卡死**：rAF 在上述環境不觸發時，節流旗標永遠設著，
   之後所有更新都被 `if(flag) return` 吃掉。→ 捲動節流用 **`setTimeout`**。

### 這一類功能的驗證方式（headless 也量得到）

- 用 `--virtual-time-budget` ＋ `--window-size`（比視窗矮就能捲）＋ `--dump-dom`，
  在頁內 `window.scrollTo({top, behavior:'instant'})` 後比較 `getBoundingClientRect()`，
  **不要只憑 DOM 狀態判斷**（捲動量才是真的）。
- ⚠ `--screenshot` **不反映捲動位置**（永遠從頁面頂端截）。要截「已捲動」的畫面，
  用 `document.documentElement.style.marginTop = '-Npx'` 模擬位移（負 margin 不會影響
  `position:fixed` 的定位基準；用 `transform` 會建立 containing block 把 fixed 弄壞）。

## ⚠️ 開發時間分析：右欄「各階段平均天數」不可用 SVG（2026-10-05 定案）

**踩過的坑**：右欄原用 `<svg viewBox="0 0 700 …">` + `width:100%`。
雙欄版面下實際只渲染約 505px，**整張圖被縮放 0.72 倍**
（`viewBox` 單位 × 0.72 = 實際 px）。因此 `font-size:15`（viewBox 單位）
實際只有 **10.8px**，比左欄 CSS 的 13px 還小 → 看起來「比較小」。
連續把 viewBox 內字級從 13→14→15 都沒效，因為**調錯層級**。

**規則**：`viewBox` 寬度 ≠ 實際渲染寬度時，SVG 內所有尺寸（含字級）都會被等比縮放。
要在並排欄位中對齊大小，**優先用 CSS 排版（絕對 px），不要用 SVG**。

**現行做法**：右欄改與左欄同一套 `.ts-node` 系列 CSS。
- `.ts-node-label.ts-stage-label{ flex:0 0 118px; }`
  （118 = 左欄標籤 84 + 展開箭頭 + gap，兩欄軌道才會同寬）
- `.ts-node-fill.ts-stage-fill`：保留藍色漸層識別（左欄為綠色）
- `.ts-stage-row`：hover 不變色（右欄列不可點，左欄可展開）
- 標題用 `.subtitle`（與左欄同 class，兩欄頂端才會對齊）
- 「有效樣本 N 筆」放在 `title`（hover）；同一區塊下方表格已有「樣本數」欄，列印看得到

**驗證方式（回歸用，別只靠目測）**：
在瀏覽器內用 `Range.getBoundingClientRect()` 量**文字本身**的渲染尺寸
（量元素不準，因為 `.ts-node-label` 有固定 `flex-basis`）。
同一字串丟進兩欄比較 —— 兩欄應完全相同（實測 96.05 × 20.00）。
幾何則比對兩欄的 `.ts-node-track` 寬/高、`.ts-node-fill` 高、列高。
⚠️ 視覺模型對「兩欄字級是否一致」的判斷**不可靠**（曾誤報右欄較小較淡），
以 `getComputedStyle` + `Range` 的實測數字為準。

## 待留意事項的交叉跳轉（2026-10 新增）

- 警報由純函式 `collectAlerts(rows)` 產生，回傳 `items[]`（`{sev, kind, title, sections:[{lead, entries:[{row,label,note}]}]}`）
  與 `stamps`（`{mismatch|slow|stale|missingDev|missingCont|missingSta: [row…]}`）。
  **每個 entry 都帶 `row` 參照**（＝ `state.model.rows` 內同一個物件）：跳轉靠物件參照定位，不需要另外加 key。
  `validateCategoryRule()` 的 `mismatches[]` 已補 `row` 欄位，改它時要保留。
- `renderAlerts()` 每類預設顯示 `ALERT_ENTRY_MAX`(5) 筆，其餘折進 `.alert-rest` ＋ `.alert-more`（就地展開，不動全域篩選——
  用篩選做「看全部」會把統計／漏斗／排行一起縮小，副作用太大）。
- `alertStamps` 是模組層級「目前這份資料的警報註記」，`rebuild()` 在**渲染進度追蹤表之前**就先算好
  （渲染順序是 progress → alerts → list）。案件清單的 ⚠ 來自 `alertKindsOf(row)`；
  進度追蹤表的 ⚠N 來自 `alertCountsBy('課別')`，**只掛課別那張表**，類別表不掛。
- `jumpToCase(row)`：先用 `applyFilters → applyPeriod → sortRows` 重算出與清單完全相同的排序結果，
  `indexOfRef` 取索引 → `Math.floor(i / PAGE_SIZE) + 1` 設 `state.page` → `rebuildListResults()`
  → 用 `tr.__row === row` 找列 → 展開 → 捲到 → `pulseClass(tr,'jump-target')`。
  `buildListRow()` 內的 `tr.__row = row` 是定位依據，不要移除。
- **捲動一律 `behavior:'auto'`，不要 smooth**：跨頁跳轉距離大，smooth 在無障礙設定／部分環境不跑，
  而且無法自動化驗證；定位感改由高亮脈動承擔。
- 反向：清單列 `.row-warn` 與進度表 `.pg-warn` 都呼叫 `focusAlertEntries(pred)`
  （高亮 `.alert-entry.focus`、必要時展開 `.alert-rest`、捲回卡片）。兩者的 click 都要 `stopPropagation()`，
  否則清單列會連帶展開／收合。
- 跳轉前先 `unfoldSection()`：手機版手風琴（`section.card.folded`）與無資料時被 `hidden` 的區塊要先打開才看得到。
- 簡報中跳轉：`presentState.slides` 是**勾選後**的頁面（與 `PRESENT_SLIDES` 不同），要用 `presentSlideIndexOf('listSection')` 找索引；
  該頁沒被勾選就 `leavePresent()`，照樣完成跳轉。
- 裝飾開關**兩套都要寫**，只寫一套會出事：
  - 列印：列印樣式表有 `button{display:none}`，所以 `.alert-link` 要在 `@media print` 內還原成 `display:inline !important`；
    `.alert-more/.row-warn/.pg-warn` 才要隱藏。
  - 存圖：`stripPrintBlocks()` 會把整段 `@media print` 抽掉（print 規則進不了 PNG），所以另寫 `.shot-root …` 規則。
    `rewriteSnapshotCss()` 只改寫 `:root`/`body`，`.shot-root` 選擇器原樣保留 ⇒ 只寫 print 規則的結果是「PNG 裡照樣有藍字底線」。

## 各課追蹤簡表（2026-09 新增）

- `computeKeQuick(scopeRows, periodRows)` 純函式：`新增`＝periodRows（隨期間）、`開發累計`/`已導入累計`＝scopeRows（全量）。
- 此表只套用 課別／開發者／關鍵字 篩選；不套用 類別（已是欄位維度）與 狀態 篩選。
- 「已導入累計」＝`導入` 日期欄非空；底部每第一層欄位一格（甲指/甲配/零擔）。

## 手機版型（body.mobile，2026-09 新增）

- 自動偵測：視窗寬度 `<700px` ⇒ `body.mobile`；否則貼 `body.desktop`。手機版只**重排＋額外 DOM helper**，不動任何純函式。
- 手動覆寫（工具列「版型」鈕，localStorage `crm-view`＝`auto|mobile|desktop`）：cycle `auto→mobile→desktop→auto`，`resolveViewMode(width, override)` 為純函式；`body.mobile`/`body.desktop` 即時套用並**重 render 兩張寬表**（各課簡表＋進度追蹤表），其餘區塊純 CSS 重排。
- 寬表改卡片（僅 `body.mobile` JS 層，桌面維持 table）：純函式 `groupKeQuickCols(KE_QUICK_COLUMNS)`→`[{l1,groups:[{l2,entries:[{l3,val,col}]}]}]`＋`buildKeQuickMobile(data)`；`progressTotalOf(computeProgress(...))`＋`buildProgressMobile(data)`。稅收快表沿用 `.qk-table`。
- 手機「分析期間」按鈕（`.period-chips`）一律 `flex-wrap:wrap` **換行**（不捲動、絕不超出卡片），桌面版規則不變。
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

## 介紹影片素材（media/，2026-10 新增）

- `media/intro.mp4`（1280×720、H.264 + AAC、53.57s、約 8.5 MB）＋ `media/intro-poster.jpg`（封面：六幕分鏡＋烤進去的播放鍵）。
- `intro.html`（repo 根目錄，Pages 上的**播放頁**）：`<video controls>` ＋封面 ＋返回 `report.html` 的連結。
  README 的封面圖連到這一頁（**不**連到 GitHub 的 blob 頁）。
- ⚠ **GitHub 的 README 無法內嵌播放器**：實測 `POST /markdown`，`<video src=…>` 與
  `<video><source …></video>` **兩種寫法都被過濾成空段落**（只有 `<a>` 存活）。
  所以 README 只能「封面圖（有播放鍵）→ 播放頁」；不要再試 `<video>`。
- ⚠ **刻意不嵌進 `report.html`**（使用者 2026-10-03 明確指定）：`report.html` 維持零依賴單檔，
  區塊順序仍是 15 塊、簡報仍 14 頁；`media/` 只是 repo 內另一份展示素材，
  **不要把影片區塊加回頁面**（2026-10-03 曾在 commit `2a5e2e2` 加過，隨即依指示還原）。
- 產生流程全在 `~/oe-voice/`（**不在 repo 內**，不進版控）：
  - `build.py`：旁白驅動時間軸 —— edge-tts `zh-TW-HsiaoChenNeural`（+8%）產生六幕旁白，
    以旁白長度決定每幕長度（量化到整數格），輸出動畫頁 `index.html` 與 `narration.wav`。
  - `music.py`：純 Python（無 numpy）合成配樂 —— Am7→Fmaj7→Cmaj7→G6 弦墊＋音樂盒琶音，
    再交 ffmpeg 做殘響／立體聲／`sidechaincompress` 對旁白 ducking，母帶 −16 LUFS。
  - 封面：容器內 `/root/oe-demo/runs/crm/poster/poster.html`（六張定格 `s1..s6.png` 排 3×2）
    → OpenEdit render 1 格 → PNG → `ffmpeg -i poster.png -q:v 3 media/intro-poster.jpg`。
  - 容器內 OpenEdit render **一律** `--workers 1 --chrome /usr/local/bin/chromium`
    （見全域 AGENTS 的 phantom process 上限那條）。

## 已了解的需求語氣

使用者偏好：先確認語意再動手；表格維度結構要逐層講清楚；新增區塊會希望與現有「期間＋篩選同步」語意一致，有矛盾時先舉例對照再問。