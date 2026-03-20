# TrustGateHook — Demo Video Script

**長度：** 3-4 分鐘
**格式：** Screen recording + voiceover（不用露臉）
**工具：** QuickTime / OBS

---

## SLIDE 1 — Hook (0:00 – 0:25)

**畫面：** 黑底 + TrustGateHook logo 或 title slide

**旁白：**

> "TrustGateHook is a Uniswap V4 hook that gates swaps based on on-chain trust scores and adjusts LP fees dynamically by reputation.
>
> Trusted agents pay zero fees. Unknown addresses pay half a percent. Your on-chain history directly affects your swap costs."

---

## SLIDE 2 — The Problem (0:25 – 0:55)

**畫面：** 簡單的對比圖（左邊：Current DeFi，右邊：With TrustGateHook）

**旁白：**

> "Today, DeFi pools treat every swapper the same — a bot that just drained a lending protocol pays the same fee as a wallet with a 2-year clean track record.
>
> In an agent economy where AI agents execute thousands of swaps autonomously, there's no mechanism to reward reliable actors or penalize bad ones.
>
> We built TrustGateHook to make reputation an economic primitive."

---

## LIVE DEMO (0:55 – 3:15)

### Part A — Agent Dashboard (0:55 – 1:25)

**畫面：** 打開 app.maiat.io

**旁白：**

> "This is the Maiat dashboard. We've indexed over 18,000 agents from the Virtuals ACP ecosystem.
>
> Each agent has a trust score, a tier — Guardian, Verified, Trusted, or New — and a full behavioral history."

**動作：**
- 展示 agent leaderboard
- 點進一個 agent 的 KYA page（Know Your Agent）
- 展示 trust score、tier、endorsements

### Part B — Contracts on Base Mainnet (1:25 – 1:50)

**畫面：** 打開 Basescan

**旁白：**

> "TrustGateHook is deployed on Base mainnet.
>
> Here's the hook contract — and here's the TrustScoreOracle that feeds it trust data.
>
> Both are verified on Basescan, you can read the source right now."

**動作：**
- 打開 TrustGateHook (0xf980...daFf) on Basescan
- 快速看 verified source code
- 打開 TrustScoreOracle (0xc6cf...c6da)

### Part C — forge test: Fee Tiers in Action (1:50 – 2:45)

**畫面：** Terminal

**旁白：**

> "Let me show you the four reputation tiers in action. We'll run the test suite."

**動作：** 跑 `cd ~/maiat-protocol/contracts && forge test --match-contract TrustGateHookTest -vv`

**旁白（看 output）：**

> "Here's what's happening:
>
> — `test_BeforeSwap_NewUserGetsBaseFee` — a new user with no reputation pays the base fee: 50 basis points, half a percent.
>
> — `test_BeforeSwap_TrustedUserGetsTrustedFee` — reputation score of 25: 30 basis points.
>
> — `test_BeforeSwap_VerifiedUserGetsVerifiedFee` — reputation score of 100: 10 basis points.
>
> — `test_BeforeSwap_GuardianUserGetsZeroFee` — reputation score of 250 or above: zero fees. Free swaps.
>
> The higher your reputation, the less you pay. It's a self-reinforcing flywheel."

**等 test output 出來，展示 all passing ✅**

### Part D — Code Walkthrough: beforeSwap (2:45 – 3:15)

**畫面：** VS Code，打開 `TrustGateHook.sol`，scroll 到 `beforeSwap`

**旁白：**

> "The core logic lives in beforeSwap. Two modes:
>
> Mode 1 — EIP-712 signed scores. The swapper brings their own verified trust score, signed by our trusted signer. Completely gasless — no oracle call needed.
>
> Mode 2 — Oracle fallback. The hook reads trust scores directly from the on-chain TrustScoreOracle.
>
> Both modes gate the swap — if either token scores below the threshold, the transaction reverts. Then the dynamic fee is calculated based on the swapper's reputation tier."

**動作：**
- Highlight lines 382-384 (MODE 1 comment + signed score decode)
- Highlight lines 410-413 (MODE 2 comment + oracle.getScore)
- Highlight lines 472-473 (fee calculation + emit)

---

## SLIDE 3 — Architecture (3:15 – 3:35)

**畫面：** 架構圖

```
┌─────────────┐     hookData (EIP-712)     ┌──────────────────┐
│   Swapper   │ ──────────────────────────→ │  TrustGateHook   │
│  (Agent)    │                             │  (beforeSwap)    │
└─────────────┘                             └────────┬─────────┘
                                                     │
                          ┌──────────────────────────┤
                          ↓                          ↓
                ┌──────────────────┐      ┌──────────────────┐
                │ TrustScoreOracle │      │  LPFeeLibrary    │
                │ (token scores)   │      │  (dynamic fees)  │
                └──────────────────┘      └──────────────────┘

Fee Tiers:
  Guardian (200+)  → 0.00%
  Verified (50+)   → 0.10%
  Trusted  (10+)   → 0.30%
  New      (<10)   → 0.50%
```

**旁白：**

> "Simple architecture. The hook sits between the swapper and the pool. It reads trust scores — either from a signed payload or the oracle — gates the swap, and overrides the LP fee based on reputation."

---

## SLIDE 4 — What's Next (3:35 – 3:50)

**畫面：** Bullet list

**旁白：**

> "Going forward — we're integrating ERC-8183 coalition partners for multi-source attestation, building a Wadjet ML risk engine for real-time rug pull detection in the hook, and launching the MAIAT governance token.
>
> Thanks for watching."

---

## 錄製 Checklist

**錄之前：**
- [ ] 打開 app.maiat.io，確認 dashboard 正常
- [ ] 打開 Basescan TrustGateHook page
- [ ] Terminal 準備好 `cd ~/maiat-protocol/contracts`
- [ ] VS Code 打開 TrustGateHook.sol，scroll 到 `beforeSwap`
- [ ] 確認 `forge test --match-contract TrustGateHookTest` 全部 pass
- [ ] 準備 3 張 slides（title、problem、architecture）— 可以用 Keynote 或 Google Slides

**錄製順序：**
1. Slides 先錄（title + problem）
2. 切到瀏覽器（app.maiat.io → Basescan）
3. 切到 terminal（forge test）
4. 切到 VS Code（code walkthrough）
5. 回到 slides（architecture + what's next）

**後製：** 不需要，一鏡到底最好。有小口誤也沒關係，hackathon 不是拍電影。
