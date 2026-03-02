# $MAIAT Tokenomics

> Arcade Token Model × Virtuals Genesis Launch
> Last updated: 2026-03-02

---

## 核心定位

$MAIAT 是 Maiat Protocol 的 **arcade token** — 一個消費型代幣，價值來自生態內的使用需求，不是投機。

類比：遊戲幣。你買 $MAIAT 是為了在 Maiat 生態內使用，不是為了囤積等漲。漲價是使用量增長的結果，不是目的。

參考框架：[a16z — Arcade Tokens: The Most Underappreciated Token Type](https://a16zcrypto.com/posts/article/arcade-tokens/)

---

## 發射機制：Virtuals Genesis Launch

| 參數 | 值 |
|------|-----|
| 平台 | Virtuals Protocol (Base) |
| 機制 | Genesis Launch (point-based fair allocation) |
| 配對 | $MAIAT / $VIRTUAL LP |
| 最低募資 | 21,000 $VIRTUAL |
| 每人上限 | 566 $VIRTUAL |
| LP | 鎖定 + staking 賺 emission rewards |

### 為什麼選 Virtuals 不選 Bankr？

- **Bankr** — 適合單一 agent 發幣賺 trading fee 養活自己
- **Virtuals** — 適合 protocol 級別的分發：Genesis 給你 holder base + Virgen 社群 + ACP 天然整合
- Maiat 已經是 Virtuals ACP agent，$VIRTUAL 是 ACP 結算貨幣，$MAIAT 自然融入生態

---

## 代幣分配

| 分類 | 比例 | 用途 | 備註 |
|------|------|------|------|
| Genesis 公開分配 | 50% | Virgen point holders 認購 | Fair launch，無私募 |
| Developer Allocation | 50% | 見下方細分 | Vesting: 20% TGE + 80% 線性 8 個月 |

### Developer Allocation 細分（50% 總供應）

| 子分類 | 佔 Dev 比例 | 用途 |
|--------|------------|------|
| 獎勵金庫 (Rewards Vault) | 40% | Review 獎勵、Opinion Market prize pool、ACP 貢獻回饋 |
| 營運儲備 (Operations) | 30% | 團隊、開發、基礎設施 |
| 生態成長 (Ecosystem Growth) | 20% | 合作夥伴、integration 獎勵、早期 agent 激勵 |
| Scarab Migration | 10% | Pre-launch Scarab points 兌換 |

---

## Arcade Token 經濟循環

### 賺取 $MAIAT（供應進入流通）

| 行為 | 獎勵來源 | 說明 |
|------|---------|------|
| 提交 Review | 獎勵金庫 | 對 agent/token 提交有效評價 |
| Opinion Market 預測正確 | Prize Pool | 預測正確獲得輸家的 $MAIAT |
| ACP Job 完成 | 獎勵金庫 | Agent 完成高品質 ACP 服務 |
| Scarab Points 兌換 | Migration Pool | Pre-launch 積分按比例轉換（一次性） |

### 消費 $MAIAT（需求 / 流通減少）

| 行為 | 去向 | 說明 |
|------|------|------|
| Opinion Market 下注 | 鎖定 → 重新分配 | 預測錯誤的 $MAIAT 歸贏家 |
| Premium Trust Report | 回庫或燒毀 | 深度分析報告（比 token_check 更詳細） |
| ACP 手續費折扣 | 回庫 | 用 $MAIAT 付費享折扣（vs. $VIRTUAL 原價） |
| Review 提升權重 | 燒毀 | 花 $MAIAT 讓你的 review 權重更高 |
| Passport NFT Mint | 燒毀 | 鑄造鏈上 SBT 身份護照 |

### 循環圖

```
用戶花 $VIRTUAL 買 $MAIAT
        ↓
在生態內使用（review / vote / premium / 折扣）
        ↓
$MAIAT 回到金庫 or 燒毀
        ↓
金庫重新分發給貢獻者
        ↓
貢獻者可以繼續使用 or 賣回 $VIRTUAL
```

---

## Scarab → $MAIAT Migration

**Scarab 是 pre-launch 積分系統。** Token launch 後：

- Scarab 名稱退役
- 按快照時的比例從 Migration Pool（Dev allocation 的 10%）兌換
- 不是空投 — 用戶主動 claim
- Claim 後 Scarab 歸零

**Scarab 積分來源（pre-launch）：**
- 在 maiat-protocol.vercel.app 提交 review
- Opinion Market 參與
- ACP offering 使用

---

## 價格邏輯

$MAIAT 漲價靠使用量，不靠炒作：

1. **更多 agent 用 ACP offerings** → 更多人需要買 $MAIAT 付費 → 買壓
2. **Opinion Market 活躍** → $MAIAT 鎖在賭注裡 → 流通減少
3. **Review 生態成長** → 更多人需要 $MAIAT 參與 → 需求增加
4. **燒毀機制** → 部分消費直接減少總供應 → 通縮壓力

**不會像 meme coin 一天 100x，但也不會一天歸零。** 隨 ACP 生態成長穩定上升。

---

## 與 Maiat 產品的整合

| 產品 | $MAIAT 角色 |
|------|------------|
| ACP Offerings (token_check / agent_trust / trust_swap) | 用 $MAIAT 付費打折 |
| TrustGateHook (Uniswap v4) | Hook fee 部分以 $MAIAT 計價（未來） |
| EAS Attestation | 提交 attestation 消耗 $MAIAT |
| Opinion Market | 下注 + 獎勵 |
| Passport SBT | Mint 消耗 $MAIAT |
| Review System | 獎勵 + 權重提升 |

---

## 時間線

| 階段 | 時間 | 里程碑 |
|------|------|--------|
| Pre-launch | 現在 → 4月 | Scarab 積分累積、冷啟動 ACP、Hookathon |
| Genesis Launch | 4月 | Virtuals Genesis、$MAIAT TGE |
| Arcade Economy | 4月 → | Scarab migration、Opinion Market 上線、獎勵發放開始 |
| Deflationary Phase | 6月 → | 燒毀機制啟動、Premium features 上線 |

---

## 風險與考量

1. **冷啟動風險** — 沒有使用量，代幣經濟是空談。必須先有 ACP 用戶。
2. **Genesis 失敗** — 募不到 21,000 $VIRTUAL 就不會 launch。需要 Hookathon 成績 + Twitter 宣傳。
3. **Arcade vs 投機矛盾** — Genesis 本身有投機性質（早買可能便宜），但長期靠使用量支撐。
4. **Dev allocation 解鎖壓力** — Vesting 緩解，但前 20% TGE 釋放需要有足夠需求吸收。

---

*此文件隨產品演進更新。代幣設計未最終確定，launch 前會根據市場條件調整。*
