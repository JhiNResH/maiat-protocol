# Maiat Ecosystem Architecture & Features

## 🔗 Smart Contracts (Base Mainnet)

我們將信任評分從 Web2 資料庫推向真正的去中心化，提供機器可讀 (Machine-readable) 的信任基礎設施。為了確保最高級別的安全性，我們的合約採用 **Owner / Operator 權限分離** 的架構設計。

| 合約 | 地址 | 網路 | 功能 |
| :--- | :--- | :--- | :--- |
| **MaiatOracle** | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` | Base Mainnet | 即時鏈上信任分數 Oracle。ACP 任務完成後由 Agent 主動寫入，任何 DeFi 協議（如 Uniswap v4 Hooks）可隨時呼叫 `getTrustScore()` 查詢並阻擋惡意交易。 |
| **MaiatReceiptResolver** | `0xda696009655825124bcbfdd5755c0657d6d841c0` | Base Mainnet | EAS 專屬守門員。攔截並拒絕所有非 Maiat 官方發出的 EAS 證明，確保 Maiat Receipt 的不可偽造性。 |

*註：以上合約的 `Owner` 為離線冷錢包部署者，僅負責權限轉移與合約升級；而 `Operator` 為 ACP Agent 的熱錢包，僅具有上傳分數與發行證明的寫入權限。*

---

## 🛡️ EAS（Ethereum Attestation Service）與防偽機制

Maiat 出具的所有報告都帶有無法篡改的密碼學收據 (Maiat Receipt)。

- **Base Mainnet EAS contract:** `0x4200000000000000000000000000000000000021`
- **Maiat Receipt Schema UID:** `0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802`
- **出證流程 (`src/lib/eas.ts`):** 每次 Agent 完成 `agent_trust` 或 `token_check` 等任務後，會以 Maiat 官方錢包的身份發送一筆交易，於 Base 鏈上鑄造 Attestation。
- **不可偽造性:** 由於綁定了 `MaiatReceiptResolver`，除了 Maiat 官方授權的 Operator 錢包外，任何人嘗試使用這個 Schema 鑄造憑證都會在鏈上直接被 Revert，保證了數據的絕對純潔性。

---

## 🌐 Protocol Web App（maiat-protocol.vercel.app）

以「高科技冷藍色調」為基底，結合局部玻璃擬物化 (Glassmorphism)，打造最具 Web3 / AI cyber-infrastructure 風格的信任樞紐平台。

**核心功能頁面：**
- `/explore` — Agent 瀏覽器與排行榜，實時顯示超過千名 Agent 的動態數據。**信任分數 (Trust Score) 採用直覺的紅黃綠語意配色 (`emerald`, `amber`, `red`)**，與冷藍色背景形成強烈對比，一眼辨識高風險 Agent。
- `/agent/[address]` — Agent 詳情與數據剖析頁，展示 `agent_deep_check` 的視覺化結果與行為洞察 (Behavioral Insights)。
- `/review/[address]` — 鏈上評價系統。僅允許經過以太坊互動證明 (On-chain proof) 的錢包提交評價，並根據 EAS 收據進行權重加乘 (最高 5x weight)，加上每筆評論燃燒 🪲 Scarab Token 作為防女巫攻擊機制。
- `/swap` — Trust-gated swap 概念驗證頁面，在交易前透過 Oracle 檢查風險，即時阻擋惡意代幣。
- `/markets` — AI Agent 的專屬預測市場。
- `/docs` — API 整合、合約交互與開發者文件。

---

## 🤖 ACP Agent（Virtuals Protocol Integration）

**Operator Hot Wallet:** `0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312`<br>

這是 Maiat 生態的營利與執行引擎，所有 Agent 間的查詢與委託都需要透過 Virtuals Agent Commerce Protocol (ACP) 支付 USDC。

| Offering | 功能說明 |
| :--- | :--- |
| `token_check` | ERC-20 安全檢查：honeypot / high tax / unverified 等風險稽核，運算完成後同步寫入 EAS Receipt 上鏈。 |
| `agent_trust` | Agent 可靠性檢查：統計 completionRate、paymentRate 等硬指標，並同步更新 Base Mainnet Oracle 分數。 |
| `agent_deep_check` | 深度分析：percentile rank、risk flags、tier（veteran/active/new）、以及 AI 摘要推薦。 |
| `trust_swap` | 信任守門員：先執行 token_check，若有毒則拒絕提供 calldata；安全才回傳 Uniswap quote。(附加 Base Builder Code `bc_cozhkj23` 以獲取 Gas 贊助與回饋) |

---

## 📈 信任分數計算引擎 (Trust Score Pipeline)

這套系統完美融合了「客觀鏈上行為數據」跟「主觀群眾驗證」，為去中心化 AI 經濟打造無堅不摧的護城河。分數從 0~100 即時動態計算：

### 1. ACP 真實訂單行為 (被動收集，絕對權重)
只要有人在 Virtuals ACP 上交易，Maiat 的 Indexer 就會抓取：
- **Completion Rate (完成率)：** Agent 接單後有沒有確實交付？
- **Payment Rate (即時性)：** 買家付款有無糾紛？
- **Expire Rate (超時率)：** Agent 是不是常常接單後超時不理人？
> 這個數據完全無法造假，構成了該 Agent 信評最硬的基石。

### 2. 使用者的真實評價回報 (主動收集)
透過 Protocol Web App 收集真人評價。
- **權重加乘機制：** 具備鏈上互動紀錄 (On-chain TXs) 的錢包獲取 3 倍權重；若持有特定 EAS Receipts 證明的錢包，給出的星等更會獲得高達 **5 倍的權重加成**。

### 3. Oracle 防護網 (最終結算)
當有客戶花 USDC 向 Maiat 請求 `agent_trust` 信用查詢時：
Maiat 本機 Agent 將攔截到這筆查詢 ➔ 計算最新綜合分數 ➔ 透過 `updateScore()` **直接上傳寫入 Base 主網的 `MaiatOracle` 合約**，全天候為全球 DeFi 協議與 Web3 世界輸入最具公信力的標準數據。
