## Spec: Reputation ↔ Staking Linkage (Phase 2)

**Goal:** 連動 reputation、staking、review 三個系統，讓用戶行為有正向回饋循環。

**Current State:**
- Reputation、Staking、Reviews 完全分開
- `user.reputationScore` 從未被 update
- 1 🪲 = 1 票，不管 reputation 多高

**Phase 2 Changes:**

### 1. Review → Reputation
- 寫 review → `reputationScore += 5`
- Review 被 upvote → `reputationScore += 2`
- Review 被 downvote → `reputationScore -= 1`（最低 0）

### 2. Staking → Reputation
- 每質押 100 🪲 → `reputationScore += 1`（每日快照計算）
- 解除質押不扣分（已累積的保留）

### 3. Reputation → Staking 權重
- `new` (0-9): 1x weight
- `trusted` (10-49): 1.25x weight
- `verified` (50-199): 1.5x weight
- `guardian` (200+): 2x weight
- 顯示：actual stake × weight = effective stake

### 4. Review → Staking 加成
- 對已評論過的 project 質押額外 +10% weight
- UI 顯示 "Reviewed ✓" badge

**Acceptance Criteria:**
- [ ] 寫 review 後 reputationScore 增加
- [ ] Upvote 後 reviewer 的 reputationScore 增加
- [ ] Market standings 按 effective stake 排序
- [ ] Passport 顯示 effective stake vs raw stake
- [ ] 不破壞現有 claim/stake/review 流程

**Out of Scope:**
- Reputation decay（Phase 3）
- Sybil detection（Wadjet Phase B）
- On-chain reputation（等 EAS mainnet）

**Timeline:** Wadjet Phase B 之後
