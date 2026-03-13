## Spec: MaiatEvaluator — ERC-8183 Trust Evaluator

**Goal:** 實作 ERC-8183 Evaluator 合約，讓 Maiat 成為 Agentic Commerce 的信譽裁判。我們同時是 Provider（4 個 ACP offerings）+ Evaluator（裁判），自己閉環自己的生態。

---

### 閉環飛輪（核心邏輯）

```
① Guard（交易前）
   Agent 想雇人 → Guard SDK 查 provider 信譽
   → Protocol API → Wadjet ML 跑風險模型
   → verdict=avoid → 不雇，到此結束
   → verdict=proceed → 進入 ②

② ACP + ERC-8183（發 Job）
   Client createJob(provider=Maiat, evaluator=MaiatEvaluator)
   → fund($0.02 escrow)
   → Maiat 跑 agent_trust → submit(deliverableHash)

③ Evaluator（交易後裁判）
   MaiatEvaluator.evaluate(jobId)
   → 讀 TrustScoreOracle + ERC-8004 Reputation
   → complete() 或 reject()

④ EAS（鏈上存證）
   complete/reject → 觸發 EAS attestation
   → 鏈上永久記錄：誰評的、評了誰、結果、分數
   → 任何協議可讀（composable）

⑤ ERC-8004（信譽更新）
   → complete → provider reputation +1
   → reject → provider reputation -1

⑥ Wadjet（ML 學習）
   新 evaluation 數據 → 重新訓練 → 模型更準

⑦ Oracle Sync（鏈上同步）
   每日 4AM → 新 scores 寫入 TrustScoreOracle

⑧ Hook（swap 費率）
   TrustGateHook 讀最新 TrustScore
   → 高信譽 0% / 低信譽 0.5% → fee 差額 = revenue

⑨ 回到 ① → Guard 下次查詢看到更準的分數
```

**一句話：Guard 擋壞人 → ACP 鎖錢 → Evaluator 裁判 → EAS 存證 → 8004 更新 → Wadjet 學習 → Oracle 同步 → Hook 調費率 → Guard 更準 → 循環**

---

### 自己吃自己的飯

Maiat 自己就是第一個用戶：

| 角色 | 誰 | 說明 |
|------|-----|------|
| Client | 外部 Agent | 付 $0.01-0.05 買 Maiat 的 ACP offerings |
| Provider | Maiat | 提供 agent_trust / token_check / token_forensics / agent_profile |
| Evaluator | MaiatEvaluator | 根據 TrustScore 裁判 Job 品質 |

每個 ACP query 都變成 ERC-8183 Job → 鏈上有真實數據 → 別人看到「已 evaluate 1000+ Jobs」→ 也設 evaluator = MaiatEvaluator → 飛輪轉起來

---

### ERC-8183 快速回顧

```
State Machine: Open → Funded → Submitted → Completed/Rejected/Expired

Roles:
  Client    — 發 Job、出錢、escrow
  Provider  — 做事、submit deliverable
  Evaluator — 唯一能 complete() 或 reject() 的角色

Hook Interface (IACPHook):
  beforeAction(jobId, selector, data)
  afterAction(jobId, selector, data)
```

---

### 合約接口

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IMaiatEvaluator {
    /// @notice Evaluate a submitted job — reads TrustScore, decides complete/reject
    /// @param acpContract The ERC-8183 AgenticCommerce contract
    /// @param jobId The job to evaluate
    function evaluate(address acpContract, uint256 jobId) external;

    /// @notice Set minimum trust score for auto-complete (owner only)
    /// @param threshold Score 0-100 (default: 30)
    function setThreshold(uint256 threshold) external;

    /// @notice Set threat count threshold for auto-reject (owner only)
    /// @param count Number of reports to trigger reject (default: 3)
    function setThreatThreshold(uint256 count) external;

    /// @notice Check if a provider would pass evaluation (view)
    /// @param provider Address to check
    /// @return score Current trust score
    /// @return wouldPass Whether score >= threshold
    function preCheck(address provider) external view returns (uint256 score, bool wouldPass);
}

interface IAgenticCommerce {
    enum Status { Open, Funded, Submitted, Completed, Rejected, Expired }
    
    struct Job {
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        Status status;
        address hook;
    }
    
    function getJob(uint256 jobId) external view returns (Job memory);
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
}
```

---

### 核心邏輯

```
evaluate(acpContract, jobId):
  1. job = ACP.getJob(jobId)
  2. require(job.status == Submitted)
  3. require(job.evaluator == address(this))
  4. score = TrustScoreOracle.getScore(job.provider)
  5. threatCount = threatReports[job.provider]
  6. 決策：
     - threatCount >= threatThreshold → reject("FLAGGED_AGENT")
     - score >= threshold → complete(attestationHash)
     - score < threshold  → reject("LOW_TRUST_SCORE")
  7. emit EvaluationResult(jobId, provider, score, decision, reason)
```

---

### 數據流（每層產生什麼）

```
Guard query     → who-asked-about-whom
ACP Job         → who-hired-whom + escrow amount
Evaluator       → complete/reject decision + score
EAS attestation → on-chain proof（composable, 永久）
ERC-8004        → cumulative reputation
Wadjet          → ML prediction（更準的分數）
Oracle          → on-chain score（Hook 可讀）
Hook            → fee data（revenue）
```

---

### 合約依賴

| 依賴 | 地址 | 用途 |
|------|------|------|
| TrustScoreOracle | `0xf662902ca227baba3a4d11a1bc58073e0b0d1139` (Sepolia) | 讀 provider trust score |
| ERC-8004 Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (Mainnet) | 讀/寫 reputation |
| AgenticCommerce (ERC-8183) | TBD — 需要先部署或用 Virtuals 的 | 呼叫 complete/reject |

---

### 配置參數

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `threshold` | 30 | 最低通過分數 (0-100) |
| `threatThreshold` | 3 | 幾個 threat reports 自動 reject |
| `owner` | deployer | 能改 threshold 的 admin |
| `oracle` | TrustScoreOracle | 分數來源 |

---

### Events

```solidity
event EvaluationResult(
    uint256 indexed jobId,
    address indexed provider,
    uint256 score,
    bool completed,       // true = complete, false = reject
    bytes32 reason        // attestation hash or rejection reason
);

event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
event ThreatThresholdUpdated(uint256 oldCount, uint256 newCount);
event ThreatReported(address indexed provider, uint256 newCount);
```

---

### 安全考量

1. **只有 Evaluator 能 complete/reject** — MaiatEvaluator 合約地址必須是 Job 的 evaluator
2. **Oracle 數據新鮮度** — 每日 4AM 同步，~24h 延遲；備案：EIP-712 signed scores
3. **Reentrancy** — complete/reject 轉帳 escrow，用 ReentrancyGuard
4. **Gas** — evaluate() ≈ 150-200k gas（讀 oracle + 呼叫 ACP + emit event）
5. **Fail-safe** — oracle 沒有該 provider 分數 → 預設 score = 0 → reject
6. **Threat reporting** — 只有 owner 能 reportThreat（防 spam）；off-chain API 收集 → batch 上鏈

---

### 測試計劃

**Unit Tests (`test/MaiatEvaluator.t.sol`):**
- [ ] evaluate() — score >= threshold → complete
- [ ] evaluate() — score < threshold → reject  
- [ ] evaluate() — 3+ threats → auto-reject（即使 score 夠高）
- [ ] evaluate() — job not Submitted → revert
- [ ] evaluate() — evaluator != this → revert
- [ ] preCheck() — 正確回傳 score + wouldPass
- [ ] setThreshold() — owner 能改、non-owner revert
- [ ] setThreatThreshold() — owner 能改、non-owner revert
- [ ] reportThreat() — 正確累加 count
- [ ] evaluate() — oracle 沒分數 → score=0 → reject

**Fuzz Tests (`test/MaiatEvaluator.fuzz.t.sol`):**
- [ ] fuzz_evaluate_thresholdBoundary(uint256 score, uint256 threshold) — 邊界一致性
- [ ] fuzz_evaluate_threatCount(uint256 threats, uint256 threatThreshold) — threat 邊界
- [ ] fuzz_setThreshold(uint256 value) — threshold 0-100 範圍
- [ ] fuzz_preCheck_consistency(address provider) — preCheck 和 evaluate 決策一致

**Deploy Script (`script/DeployMaiatEvaluator.s.sol`):**
- [ ] 部署 MaiatEvaluator（constructor: oracle, threshold, threatThreshold, owner）
- [ ] 驗證初始配置
- [ ] Base Sepolia 部署

---

### Acceptance Criteria

- [ ] `forge build` 通過
- [ ] `forge test` 全部通過（unit + fuzz）
- [ ] evaluate() — complete/reject 邏輯正確
- [ ] 3+ threats → auto-reject
- [ ] preCheck() view function 正確
- [ ] owner-only setThreshold/setThreatThreshold
- [ ] emit EvaluationResult event
- [ ] 部署到 Base Sepolia
- [ ] atomic commit + PR

---

### Out of Scope（Phase 2+）

- IACPHook 實作（`MaiatACPHook`）
- 自動 evaluate() 觸發（Gelato / off-chain watcher）
- Multi-evaluator 共識
- deliverable 內容驗證（Wadjet ML 評估品質）
- EAS attestation 寫入（先 off-chain，Phase 2 on-chain）
- ERC-8004 直接寫入（先 event-driven，Phase 2 合約互調）
