## Spec: Oracle Sync + ScarabToken

**Goal:** 讓 trust score 上鏈同步 + Scarab 積分代幣化

---

### Part 1: Oracle Sync (auto-attest cron)

**Goal:** auto-attest cron 定期把 DB trust scores 寫到鏈上（EAS attestation + TrustScoreOracle.updateScore()）

**Inputs:**
- QueryLog 中未 attest 的記錄（buyer-target pair 24h 去重）
- EAS Schema UIDs（已 register）:
  - TrustScore: `0xaeabc9ee6cde40c2f2ec527e4250919a109efd67fd61eadd0efbb38f3eb1e57a`
  - Review: `0x5f7c2176bf57e7cd886b2c5ce8d554071fc1089ae516d03e0c70146aa0922488`
  - ACPInteraction: `0x8b9f3237c38bd01ca808b04f189fd162532c02caca14788b5a6813c0ae4616d2`
- Deployer wallet: `0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9` (`EAS_DEPLOYER_KEY`)
- TrustScoreOracle contract: `0xf662902...` (Base Sepolia)

**Outputs:**
- EAS attestation on Base Sepolia for each trust score update
- TrustScoreOracle.updateScore(agent, score) called for top agents
- DB marks attested records (prevent re-attestation)

**Acceptance Criteria:**
- [ ] auto-attest cron (`POST /api/v1/cron/auto-attest`) uses `EAS_DEPLOYER_KEY`
- [ ] Attests unattested QueryLog entries (24h buyer-target dedup)
- [ ] Calls `TrustScoreOracle.updateScore()` after each attestation batch
- [ ] Logs attestation tx hash + UID back to DB
- [ ] Rate limit: max 20 attestations per cron run (gas budget)
- [ ] tsc --noEmit passes
- [ ] Existing tests don't break

---

### Part 2: ScarabToken.sol (ERC-20 with transfer gate)

**Goal:** Scarab 積分上鏈，默認不可轉讓（SBT-like），admin 可開放

**Contract Design:**
- ERC-20 standard (OpenZeppelin)
- `transferable` bool flag (default: false)
- `transferWhitelist` mapping (specific addresses can always transfer)
- `owner` can toggle `transferable` + manage whitelist
- `mint(address to, uint256 amount)` — only owner (batch-settle cron)
- `burn(address from, uint256 amount)` — only owner (spend scarab)
- Override `_update()` to enforce transfer gate

**Inputs:**
- DB ScarabBalance table (current off-chain balances)
- Deployer wallet: `0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9`

**Outputs:**
- ScarabToken deployed on Base Sepolia
- Contract address stored in .env (`SCARAB_TOKEN_ADDRESS`)
- batch-settle cron endpoint (`POST /api/v1/cron/scarab-settle`)

**Acceptance Criteria:**
- [ ] ScarabToken.sol compiles with solc 0.8.24+
- [ ] Transfer blocked when `transferable == false` (except owner + whitelist)
- [ ] `setTransferable(true)` enables free transfer for everyone
- [ ] `addToWhitelist(address)` / `removeFromWhitelist(address)` work
- [ ] Only owner can mint/burn
- [ ] Deployed to Base Sepolia via `EAS_DEPLOYER_KEY`
- [ ] Contract verified on BaseScan
- [ ] batch-settle cron: reads DB balances, diffs with on-chain, mints/burns delta
- [ ] tsc --noEmit passes

---

### Part 3: Token Forensics (Day 30-60 roadmap)

**Goal:** 擴展 Maiat 從 agent scoring → token rug risk scoring

**Scope (future):**
- Deep contract analysis (honeypot patterns, ownership renounce, liquidity locks)
- Holder concentration scoring (whale %, top 10 holder distribution)
- Trading pattern anomaly detection (wash trading, coordinated buys)
- Historical rug pattern matching
- `/api/v1/token/{address}/forensics` endpoint

**Not now — parked for Day 30-60.**

---

### Out of Scope (this spec)
- Mainnet deployment (stays on Sepolia until validated)
- Opinion market integration (wait for Scarab on-chain)
- Forced outcome reporting (deferred)
- Paid API tier (先跑量)

---

### Execution Order
1. Oracle Sync (Part 1) — ~1 hour
2. ScarabToken.sol (Part 2) — ~2 hours
3. Token Forensics (Part 3) — Day 30-60
