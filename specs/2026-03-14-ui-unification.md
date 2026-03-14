## Spec: UI Unification — app.maiat.io → landing/passport-ens 風格

**Goal:** 把 app.maiat.io 的 UI 統一成 maiat-landing + passport-ens 的設計語言，看起來像同一個產品。

---

### 現狀對比

| 屬性 | app.maiat.io (現在) | landing + passport-ens (目標) |
|------|-------------------|--------------------------|
| 背景 | `#050508` 純黑 | `#FDFDFB` 亮白 / `#0A0A0A` 暗黑（可切換） |
| 主色 | 金色 `#d4a017` | 黑白 + 藍色 `#3B82F6` accent |
| 字體 | JetBrains Mono 全局 | Inter 正文 + Mono 僅代碼區 |
| 圓角 | `rounded-lg`（小） | `rounded-[2.5rem]`（超大） |
| 佈局 | 固定側邊欄 220px | Top navbar + 全寬內容 |
| 動畫 | 無 | Framer Motion（hover, scroll, page transition） |
| 主題 | 僅暗色 | 亮/暗切換 |
| 卡片 | `bg-[#0d0e17]` border `#1e2035` | `bg-white/5` 或 `bg-white` + `backdrop-blur` |
| Navbar | 固定 header 65px（空的） | 毛玻璃浮動 navbar，圓角，居中導航 |

---

### 改動範圍

#### 1. globals.css — 新 CSS 變數
```css
:root {
  --bg-page: #FDFDFB;
  --bg-surface: #FFFFFF;
  --bg-elevated: #F5F5F3;
  --border-default: rgba(0,0,0,0.05);
  --text-primary: #141414;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --accent: #3B82F6;
}

.dark {
  --bg-page: #0A0A0A;
  --bg-surface: rgba(255,255,255,0.05);
  --bg-elevated: rgba(255,255,255,0.08);
  --border-default: rgba(255,255,255,0.10);
  --text-primary: #FFFFFF;
  --text-secondary: #9CA3AF;
  --text-muted: #4B5563;
  --accent: #3B82F6;
}
```

#### 2. ClientLayout.tsx — 去側邊欄，改 top navbar
- 刪除 `<Sidebar />`
- 新增 `<TopNavbar />` 組件（跟 passport-ens 一致）
  - 毛玻璃 `backdrop-blur-2xl`
  - 圓角 `rounded-[2.5rem]`
  - Logo + 導航 + 錢包連接 + 亮暗切換
  - Mobile hamburger menu
- `<main>` 去掉 `lg:pl-[220px]`

#### 3. TopNavbar.tsx — 新組件
```
結構：
[Logo] ---- [Monitor] [Markets] [Leaderboard] [Passport] [Docs] ---- [🌙/☀️] [Connect/Address] 
```
- 跟 passport-ens 的 navbar 同風格
- Privy 錢包連接按鈕
- 亮暗切換
- Scarab 餘額顯示（小 badge）

#### 4. 頁面卡片風格統一
所有頁面的卡片：
- `rounded-[2rem]` 或 `rounded-3xl`
- 亮色：`bg-white border border-black/5 shadow-sm`
- 暗色：`bg-white/5 border border-white/10`
- 更多 padding（`p-8` → `p-10`）

#### 5. 字體
- 正文：Inter（已有，但被 mono 覆蓋）
- 代碼/數據：JetBrains Mono
- 標題：Inter `font-black`

#### 6. 亮暗切換
- `ThemeProvider` context
- `localStorage` 記住偏好
- 所有頁面支持

---

### 不動的東西

- API routes（`/api/v1/*`）— 不動
- Prisma schema — 不動
- 業務邏輯 — 不動
- 頁面路由結構 — 不動（`/monitor`, `/markets`, `/passport` 等保留）
- Privy 配置 — 不動

---

### 影響的檔案

| 檔案 | 改動 |
|------|------|
| `src/app/globals.css` | 新 CSS 變數 + dark class |
| `src/components/ClientLayout.tsx` | 去 Sidebar，加 TopNavbar |
| `src/components/Sidebar.tsx` | 刪除 |
| `src/components/Header.tsx` | 刪除（被 TopNavbar 取代）|
| `src/components/TopNavbar.tsx` | 新增 |
| `src/components/ThemeProvider.tsx` | 新增 |
| `src/app/monitor/page.tsx` | 卡片樣式更新 |
| `src/app/passport/page.tsx` | 卡片樣式更新 |
| `src/app/passport/[address]/page.tsx` | 卡片樣式更新 |
| `src/app/markets/*/page.tsx` | 卡片樣式更新 |
| `src/app/leaderboard/page.tsx` | 卡片樣式更新 |
| `src/app/analytics/page.tsx` | 卡片樣式更新 |
| `src/app/docs/page.tsx` | 卡片樣式更新 |
| `tailwind.config.ts` | 更新 color tokens |

---

### Acceptance Criteria

- [ ] 亮色模式預設，暗色可切換
- [ ] Top navbar 取代 sidebar（所有頁面）
- [ ] 卡片圓角 ≥ `rounded-2xl`
- [ ] 無金色元素（`#d4a017` 全部替換）
- [ ] 正文用 Inter，代碼用 Mono
- [ ] Mobile responsive（navbar collapse to hamburger）
- [ ] Privy 錢包連接在 navbar 裡
- [ ] `tsc --noEmit` passes
- [ ] 現有功能不 break（monitor, passport, markets, reviews）
- [ ] 風格跟 passport.maiat.io 視覺一致

---

### Out of Scope

- 新功能
- API 改動
- DB schema 改動
- Motion 動畫（Phase 2 再加）
- Cursor spotlight 效果（landing 專屬，app 不需要）
