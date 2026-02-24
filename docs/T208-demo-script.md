# T208 Demo Script — Maiat Protocol
# Track: CRE & AI (Chainlink Convergence Hackathon)
# Target length: ~3 minutes

---

## 🎬 Scene 1 — Problem Hook (0:00–0:20)

**Narration:**
> "DeFi has a trust problem. Anyone can list a token. Rugpulls happen every day.
> What if your DEX automatically blocked low-trust tokens before you could even swap them?"

**Visuals:** Show a rugpull news headline, then cut to Maiat UI

---

## 🎬 Scene 2 — Architecture Overview (0:20–0:50)

**Narration:**
> "Maiat Protocol combines AI sentiment analysis, community reviews, and on-chain data — 
> verified by Chainlink CRE — to produce a decentralized trust score for every token."

**Visuals:** Architecture diagram (draw.io or Figma):
```
Community Reviews → Maiat API
                              ↘
Gemini AI Sentiment ────────→ CRE Workflow (DON) → MaiatTrustConsumer → TrustScoreOracle
                              ↗                                              ↓
On-chain Metrics ──────────→                                        TrustGateHook
                                                                         ↓
                                                                 Uniswap V4 Swap Blocked
                                                                 if score < 4.0/10
```

**Key talking points:**
- CRE = Chainlink Runtime Environment (decentralized computation)
- Score computed by 4 DON nodes via consensus
- Result signed and delivered on-chain via KeystoneForwarder

---

## 🎬 Scene 3 — Live CRE Simulation (0:50–1:30)

**Narration:**
> "The workflow runs every 30 minutes. Here's a real simulation:"

**Screen recording:**
```bash
cd maiat-protocol/cre
cre workflow simulate --target staging-settings trust-score
```

**Show output:**
```
🔱 Maiat Trust Score Workflow triggered
Gemini AI sentiment score: 48
Token 0x12345678...: score=65/100 (6.5/10), reviews=15
Token 0xabcdefab...: score=40/100 (4.0/10), reviews=3
Token 0x98765432...: score=74/100 (7.4/10), reviews=42
Writing 3 trust scores to consumer: 0x1080cf80...
✅ Trust scores written onchain
```

**Narration:**
> "Scores computed: 6.5/10, 4.0/10, and 7.4/10 — written on-chain in one atomic transaction."

---

## 🎬 Scene 4 — TrustGateHook in Action (1:30–2:00)

**Narration:**
> "The TrustGateHook enforces the scores at the swap level.
> Any token scoring below 4.0/10 — the amber threshold — is blocked."

**Screen recording:** Forge test run
```bash
cd contracts && forge test --force --match-test "StaleScore\|TrustScore\|BeforeSwap"
```

**Show:** 
- `test_BeforeSwap_Token0LowScore_Reverts` ✅
- `test_BeforeSwap_BothHighScore_Passes` ✅
- Tier display: `gold ≥7.0/10 | amber ≥4.0/10 | red <4.0/10`

**Narration:**
> "Gold-tier tokens also get lower swap fees — reputation rewarded automatically."

---

## 🎬 Scene 5 — On-chain Proof (2:00–2:30)

**Narration:**
> "Everything is verifiable on Base Sepolia:"

**Show BaseScan links:**
- TrustScoreOracle: `basescan.org/address/0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139`
- MaiatTrustConsumer: `basescan.org/address/0x1080cf8074130ba6e491ba3424b07baff2b92204`
- TrustGateHook: `basescan.org/address/0xf980Ad83bCbF2115598f5F555B29752F00b8daFf`

**Narration:**
> "Scores are written on-chain by a Chainlink DON — not an admin wallet.
> Security audited: 13 findings fixed, 118 tests passing."

---

## 🎬 Scene 6 — Score UI (2:30–2:50)

**Show:** Maiat frontend (`maiat-protocol.vercel.app`)
- Score page: `6.5/10 amber` for a token
- TrustGauge visual
- AI summary from Gemini

---

## 🎬 Close (2:50–3:00)

**Narration:**
> "Maiat Protocol: decentralized trust scores, enforced at the DEX layer.
> Powered by Chainlink CRE and Uniswap V4."

**Show:** Logo + links

---

## 📋 Key Metrics for Judges

| Metric | Value |
|---|---|
| CRE Workflow | ✅ Deployed on Base Sepolia |
| Trust Score | 0-10 (stored 0-100 in oracle) |
| Update frequency | Every 30 minutes (Cron) |
| AI integration | Gemini 2.0 Flash |
| Tests | 118 passing |
| Security | Full audit (13 findings fixed) |
| Hook | Uniswap V4 beforeSwap |
| Threshold | 4.0/10 = amber (40/100) |

---

## 🎥 Recording Checklist

- [ ] Terminal font size: 18px+
- [ ] Dark terminal theme
- [ ] Resolution: 1920x1080
- [ ] Audio: clear, no background noise
- [ ] Show contract addresses on BaseScan
- [ ] Demo wallet with some ETH for live txs (if needed)
- [ ] CRE simulation screen recording (3-5 min, clip to 40s)
- [ ] Forge test run screen recording (clip to 20s)
- [ ] Frontend screen recording (score page, 30s)
