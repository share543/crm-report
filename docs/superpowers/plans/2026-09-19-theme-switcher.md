# 主題切換器（深色/淺色）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `projects/crm/report.html`（單檔零依賴離線報表工具）加入深色/淺色主題切換器。

**Architecture:** `:root[data-theme="light"]` 覆寫既有 11 個 CSS 變數達成淺色主題（不動任何既有規則）；`resolveTheme`（純函式）判決主題，`applyTheme` 寫入 `data-theme` + `localStorage`，`initTheme` 於載入時初始化並接上按鈕。

**Tech Stack:** 原生 Web Platform API（CSS custom properties、matchMedia、localStorage），無外部依賴，維持 file:// 可離線使用。

## Global Constraints
- 單檔 `report.html`，零外部依賴、零新增 .js 檔案、維持繁體中文 UI。
- 禁止 emoji；按鈕以純文字標示（「切換到淺色/深色」）。
- 不使用 icon 庫/字重載入；`@media print` 既白底行為不變。
- 不修改既有功能（漏斗/時程/流失/排行/明細/匯出/列印）任何邏輯。
- Node 測試路徑沿用既有慣例：`python3` 抽取 `<script>` 內嵌 JS → `/tmp/opencode/sdd/task9-script.js`，再由 `task9-test.js` require。
- 本工作區非 git repo → 每次完成用「快照副本 + `diff`」取代 commit，快照放 `projects/crm/docs/superpowers/sdd/diffs/`。

---
## Task 1: 主題切換器（CSS 變數覆寫 + 純函式 + 按鈕）

**Files:**
- Modify: `projects/crm/report.html:8-19`（新增 `:root[data-theme="light"]` 區塊於 `:root` 之後）
- Modify: `projects/crm/report.html:203-206`（top-actions 加按鈕）
- Modify: `projects/crm/report.html:2564`（initApp 加 `initTheme()`）、於 `initApp` 前插入 `resolveTheme/applyTheme/initTheme`
- Modify: `projects/crm/report.html:2620-2705`（exports 加 `resolveTheme`、`applyTheme`）
- Test: `projects/crm/docs/superpowers/sdd/task9-test.js`（新增 theme 區塊）
- Test: `projects/crm/docs/superpowers/sdd/task9-smoke.js`（新增主題 smoke 檢查）

**Interfaces:**
- Consumes: 既有抽取/測試 harness（`node task9-test.js`）；既有 `initApp`（瀏覽器啟動點）。
- Produces: `resolveTheme(storedPref:string|null, prefersDark:boolean) → 'dark'|'light'`（純函式，Node 可測）；`applyTheme(theme)`；`initTheme()`；DOM `#themeBtn`。

- [ ] **Step 1: 抽取目前 script 作測試基線**

```bash
cd /root/opencode/projects/crm/docs/superpowers/sdd
python3 -c "import re;h=open('/root/opencode/projects/crm/report.html').read();s=re.search(r'<script>(.*?)</script>',h,re.S).group(1);open('/tmp/opencode/sdd/task9-script.js','w').write(s);print(len(s))"
node task9-test.js   # 期望：目前 ALL PASS (>=191 checks) 為基線
```

- [ ] **Step 2: 寫失敗測試（task9-test.js 新增 theme 區塊）**

在 `task9-test.js` 結尾（`ALL TESTS PASSED` 列印之前）加入：

```js
// ── Theme switcher (Task: 主題切換器) ──────────────────────────────
const THEME = (() => {
  const m = require('/tmp/opencode/sdd/task9-script.js');
  return { resolveTheme: m.resolveTheme };
})();

t('resolveTheme: stored dark 優先系統 light', THEME.resolveTheme('dark', false) === 'dark');
t('resolveTheme: stored light 優先系統 dark', THEME.resolveTheme('light', true) === 'light');
t('resolveTheme: 未存偏好時跟隨系統 dark', THEME.resolveTheme(null, true) === 'dark');
t('resolveTheme: 未存偏好時跟隨系統 light', THEME.resolveTheme(null, false) === 'light');
t('resolveTheme: localStorage 有值但為非法字串 → 跟隨系統', THEME.resolveTheme('banana', false) === 'light');
```

（若 `task9-test.js` 使用不同於 `t(name, cond)` 的欄位計數結構，以該檔既有 helper/計數方式套用同等斷言；核心是上述 5 個 case。）

- [ ] **Step 3: 重跑測試確認失敗**

```bash
node task9-test.js
```
期望：失敗（`TypeError: Cannot read properties of undefined (reading 'resolveTheme')` 或計數缺 5 個 assert），代表功能尚未實作。

- [ ] **Step 4: 實作 CSS（report.html 於 `:root{…}` 結束的 `}` L19 後插入）**

```css
  :root[data-theme="light"]{
    --bg:#f5f6f8;
    --card:#ffffff;
    --card-2:#eef0f4;
    --border:#d5dae2;
    --text:#1a1d23;
    --muted:#5d6875;
    --accent:#2f6fe0;
    --error:#c03434;
    --warning:#8a6111;
    --ok:#157a3a;
  }
  :root[data-theme="light"] svg text{ fill:#1a1d23; }
  :root[data-theme="light"] #dropzone{ background:#fff; }
```

- [ ] **Step 5: 實作按鈕（report.html top-actions 改良）**

將 L203-206（`.top-actions` div）改為：

```html
  <div class="top-actions no-print">
    <button type="button" id="themeBtn" aria-pressed="false">切換到淺色</button>
    <button type="button" id="exportCsvBtn" disabled>匯出 CSV</button>
    <button type="button" id="printBtn" disabled>列印</button>
  </div>
```

- [ ] **Step 6: 實作 JS（report.html 在 `function initApp(){` L2564 之前插入）**

```js
  // 主題：深色/淺色。resolveTheme 為純函式（Node 可測）。
  function resolveTheme(storedPref, prefersDark){
    if(storedPref === 'dark' || storedPref === 'light') return storedPref;
    return prefersDark ? 'dark' : 'light';
  }
  function applyTheme(theme){
    document.documentElement.dataset.theme = theme;
    var isLight = theme === 'light';
    var btn = document.getElementById('themeBtn');
    if(btn){
      btn.textContent = isLight ? '切換到深色' : '切換到淺色';
      btn.setAttribute('aria-pressed', String(isLight));
    }
    try{ localStorage.setItem('crm-theme', theme); }catch(_){}
  }
  function initTheme(){
    var stored = null;
    try{ stored = localStorage.getItem('crm-theme'); }catch(_){}
    var mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    var base = resolveTheme(stored, mq ? mq.matches : true);
    if(!stored && mq){
      var follow = function(e){ applyTheme(resolveTheme(null, e.matches)); };
      if(mq.addEventListener) mq.addEventListener('change', follow);
      else if(mq.addListener) mq.addListener(follow);
    }
    applyTheme(base);
    var btn = document.getElementById('themeBtn');
    if(btn) btn.addEventListener('click', function(){
      applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
  }
```

於 `initApp()` 內、`var pickBtn …` 之後（`if(!dropzone) return;` 之前）加入一行 `initTheme();`。

於 `module.exports`（L2621）「`exportFilteredCsv: exportFilteredCsv,`」之後加入：
```js
      resolveTheme: resolveTheme,
      applyTheme: applyTheme,
```

- [ ] **Step 7: 重跑測試確認通過**

```bash
cd /root/opencode/projects/crm/docs/superpowers/sdd
python3 -c "import re;h=open('/root/opencode/projects/crm/report.html').read();s=re.search(r'<script>(.*?)</script>',h,re.S).group(1);open('/tmp/opencode/sdd/task9-script.js','w').write(s)"
node task9-test.js
node task9-smoke.js
```
期望：`ALL PASSED`，check 數 ≥ 196（191 基線 + 新增 5），smoke 全過。

- [ ] **Step 8: Syntax + 抽取檢查**

```bash
node --check /tmp/opencode/sdd/task9-script.js
grep -c 'data-theme' report.html
```
期望：無錯誤；出現 `:root[data-theme="light"]` + `dataset.theme` 等 ≥ 3 處。

- [ ] **Step 9: 快照 + diff（取代 commit）**

```bash
cp report.html docs/superpowers/sdd/diffs/theme-switcher-base.html   # 實作前
#（實作完成後，相對於 base 產生 diff）
diff -u docs/superpowers/sdd/diffs/theme-switcher-base.html report.html > docs/superpowers/sdd/diffs/theme-switcher.diff
```
確認 diff 只含 4 個 hunk（CSS / 按鈕 / JS 三函式 / exports），別無其他變更。

- [ ] **Step 10: 瀏覽器人工驗證（代理不可行，交回使用者）**

- 開啟後依系統偏好得深/淺正確；手動切換立即生效（topbar/dropzone/卡片/表格頭/流失卡/排行/SVG 文字/分頁列全區對比正常）
- 重新載入記住選擇；未手動切換時系統主題變更仍跟隨
- 列印預覽仍是白底黑字（與模式無關）
- 落差檢查：全檔 grep `#e8eaef|#16191f|#1c212b|#0e1013` 之硬編碼若出現在淺色可讀性有疑處，補 `:root[data-theme="light"]` 覆寫

---
## Task 2: Theme 收尾 review（兩階段）

**Files:**
- Review: `projects/crm/report.html`（全檔）、`projects/crm/docs/superpowers/sdd/diffs/theme-switcher.diff`

- [ ] **Step 1: 分派 reviewer 對 diff + 全檔做整合 review**，重點：a) 僅含 4 hunk 無雜訊；b) `resolveTheme`/`applyTheme`/`initTheme` 邊界正確（非法 stored、matchMedia 缺失、localStorage 拋錯）；c) 淺色下 `--ok/--error/--warning`、SVG 文字、`#dropzone` 對比成立；d) 既有 191 功能無回歸（整份 `node task9-test.js` 再跑）。
- [ ] **Step 2: 依 review 回報套用必要修正並 re-run Steps 7/8**；若皆空則封板。
- [ ] **Step 3: 更新 ledger**：`progress.md` 記 theme 完成；`request-count.md` 結算。