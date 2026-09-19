# 主題切換器（深色/淺色）設計 — 2026-09-19

## 目標
在 `projects/crm/report.html`（單檔、零依賴、離線、file:// 可用、繁中）新增深色/淺色主題切換器。維持既有「單一檔案、零外部資源」約束。

## 使用者已確認的行為
- **開場**：無儲存偏好時，依系統 `prefers-color-scheme`；使用者手動切換後用 `localStorage` 記住。
- **佈局**：切換按鈕置於 `topbar` 右側，與「匯出 CSV / 列印」同列，`no-print`，含 `aria-pressed` 與太陽/月亮圖示。
- **列印**：`@media print` 已強制白底黑字，深/淺模式下列印結果一致，不需變更。

## 架構（Approach A：CSS 變數覆寫）
現有 `:root` 定義核心變數：`--bg`、`--card`、`--card-2`、`--border`、`--text`、`--muted`、`--accent`（另有 `--type-cat` 類別色集）。所有區塊（topbar/dropzone/卡片/表格/流失卡/排行/按鈕）皆以變數取值。

新增 `:root[data-theme="light"]` 覆寫：
- `--bg:#f5f6f8; --card:#ffffff; --card-2:#eef0f4; --border:#d5dae2;`
- `--text:#1a1d23; --muted:#5d6875;` `--accent` 維持 `#4f8eff`。
- `--type-cat` 類別色需在淺底保留對比（如現值偏亮，則在此 depth 調深 1–2 階；以實際檢視為準）。

### 必要的小修（避免淺底不可讀/突兀）
- `:root[data-theme="light"] svg text{ fill:#1a1d23 }` —— render 內 SVG 文字寫死 `#e8eaef`（深底用），淺底需覆寫。
- `:root[data-theme="light"] .stat-value.ok{ color:#157a3a }` 等若有寫死深底色，逐一以 `:root[data-theme="light"]` 覆寫；以 grep 全檔 `#e8eaef`/暗色硬編碼為準逐項檢核。
- accent 按鈕文字 `#fff`、dropzone hover `rgba(79,142,255,.08)` 淺底可讀，維持不變。

## 邏輯（純函式，沿用 exports 慣例）
- `resolveTheme(pref, stored, systemDark)` → `'dark'|'light'`（優先 stored，次 systemDark，缺省 dark）。
- `applyTheme(theme)`：`document.documentElement.dataset.theme = theme`（absent→dark 同義，仍顯式設定），`try{ localStorage.setItem('crm-theme', theme) }catch(_){}` 靜默降級。
- `initApp` 內一次初始化：讀 `localStorage.getItem('crm-theme')` → 無則 `matchMedia('(prefers-color-scheme: dark)').matches` → `applyTheme`，更新按鈕 `aria-pressed`/圖示。
- 使用者手動切換後：`applyTheme(toggle)` + 停止追隨系統（設定標記；未存偏好前系統變更仍跟隨）。
- `matchMedia` 不存在（極舊環境）→ 直接預設 dark。

## 按鈕
- `#themeBtn`，文字 `●(深)` / `○(淺)` 或字元 `🌙`/`☀` + 當前模式文字；`aria-pressed` 同步。Zero-dep：不可用 emoji 庫，用純文字/字元。

## 測試
- Node（純函式層）：`resolveTheme` 三分支；`applyTheme` 寫入/異常降級（以假 storage stub）。
- 瀏覽器人工驗證：切換即時生效、全區（topbar/dropzone/卡/表格/流失卡/排行/漏斗/SVG 文字）對比正常；重開記住；系統偏好未存時生效；列印仍白底。

## 不做（YAGNI）
- 不做三色以上主題、不做動畫、不做每列自訂色。