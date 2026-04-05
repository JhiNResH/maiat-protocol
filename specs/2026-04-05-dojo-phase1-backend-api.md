# Spec: MAIAT V2 Phase 1 — Backend API Routes

**Goal:** Implement backend API routes to persist Dojo MVP data and enable frontend <→ database transactions.

**Status:** BLOCKED ON → UNBLOCKED (2026-04-05 02:15 AM) — T306-SCHEMA merged

---

## API Routes (Priority Order)

### (A) Agent Management

#### POST /api/agents/create
**Purpose:** Create a new AI agent, mint ERC-8004 identity NFT, open ERC-6551 TBA

**Input:**
```json
{
  "name": string,
  "description": string,
  "personality": string,
  "templateId": number,
  "privyDid": string          // from Privy login
}
```

**Process:**
1. Validate Privy DID + extract user wallet
2. Insert Agent record into DB (status = "pending")
3. Call ERC-8004 Identity contract → mint NFT
4. Get returned tokenId
5. Call ERC-6551 TBA Registry → create TBA for agent
6. Update Agent.tokenId + Agent.tbaAddress
7. Return agent data + wallet address

**Output:**
```json
{
  "agentId": number,
  "tokenId": number,
  "tbaAddress": string,
  "name": string,
  "walletAddress": string,
  "status": "active",
  "createdAt": iso8601
}
```

**Success Criteria:**
- [ ] Agent record created in DB
- [ ] ERC-8004 NFT minted
- [ ] ERC-6551 TBA created and linked
- [ ] Privy wallet verified

---

### (B) Skill Marketplace (Browse)

#### GET /api/skills
**Purpose:** Browse all skills in Dojo marketplace with filtering/sorting

**Query Params:**
```
?search=string          // full-text search on name + description
&sort=price|popularity|rating|newest
&category=agent|utility|dao|other
&limit=20
&offset=0
```

**Output:**
```json
{
  "skills": [
    {
      "skillId": number,
      "creatorAddress": string,
      "name": string,
      "description": string,
      "price": number (wei),
      "totalBuyers": number,
      "rating": number (0-5),
      "metadataURI": string,
      "active": boolean,
      "createdAt": iso8601
    }
  ],
  "total": number,
  "hasMore": boolean
}
```

**Success Criteria:**
- [ ] Full-text search on name + description
- [ ] Sort by all 4 options
- [ ] Category filtering works
- [ ] Pagination correct (limit + offset)
- [ ] Response time < 200ms (cached)

---

### (C) Skill Purchase

#### POST /api/skills/buy
**Purpose:** Purchase a skill NFT for an agent (EOA or TBA)

**Input:**
```json
{
  "skillId": number,
  "recipientAddress": string,    // EOA or TBA address where skill mints
  "privyDid": string             // buyer's Privy DID
}
```

**Process:**
1. Validate Privy DID + get buyer wallet
2. Fetch skill details from SkillRegistry contract
3. Create Stripe checkout session for skill.price
4. Upon Stripe webhook (payment.success):
   - Mint ERC-1155 skill to recipientAddress (via SkillRegistry.buySkillToTBA)
   - Create SkillPurchase record in DB (txHash, status=success)
   - Create SkillEquipment record (agent = recipientAddress, equippedAt = now)
5. Return purchase confirmation

**Output:**
```json
{
  "purchaseId": number,
  "skillId": number,
  "recipientAddress": string,
  "status": "pending" | "success" | "failed",
  "txHash": string (null if pending),
  "stripeCheckoutUrl": string (if status=pending),
  "equippedAt": iso8601 (if status=success)
}
```

**Success Criteria:**
- [ ] Stripe integration functional
- [ ] Payment validated before on-chain mint
- [ ] SkillPurchase record created
- [ ] SkillEquipment record created (agent has skill)
- [ ] Webhook handles payment success/failure

---

### (D) Job Management

#### GET /api/agents/[walletAddress]/skills
**Purpose:** Get skills equipped to a specific agent

**Output:**
```json
{
  "agentAddress": string,
  "equipped": [
    {
      "skillId": number,
      "creatorAddress": string,
      "name": string,
      "purchasedAt": iso8601,
      "equippedAt": iso8601
    }
  ]
}
```

**Success Criteria:**
- [ ] Lists only equipped (active) skills
- [ ] Cross-references SkillEquipment + Skill tables

---

#### POST /api/jobs/create
**Purpose:** Create a new job request for an agent

**Input:**
```json
{
  "title": string,
  "description": string,
  "jobType": "service" | "task" | "consultation",
  "requiredSkillIds": [number],
  "budget": number (wei, USDC),
  "deadline": iso8601,
  "buyerDid": string
}
```

**Process:**
1. Validate buyer Privy DID
2. Create Job record (status = "open")
3. Lock budget in escrow (via JobMarket contract)
4. Return job details

**Output:**
```json
{
  "jobId": number,
  "title": string,
  "description": string,
  "budget": number,
  "status": "open",
  "requiredSkillIds": [number],
  "createdAt": iso8601,
  "escrowAddress": string
}
```

**Success Criteria:**
- [ ] Job record created
- [ ] Budget locked in escrow
- [ ] Job queryable in marketplace

---

### (E) Leaderboard

#### GET /api/leaderboard
**Purpose:** Get agent leaderboard ranked by trust score

**Query Params:**
```
?sort=trust_score|jobs_completed|rating
&limit=50
```

**Output:**
```json
{
  "agents": [
    {
      "rank": number,
      "agentAddress": string,
      "name": string,
      "trustScore": number (0-100),
      "jobsCompleted": number,
      "totalEarnings": number (wei),
      "rating": number (0-5),
      "levelName": string ("Kozo" | "Senpai" | "Tatsujin" | "Sensei")
    }
  ]
}
```

**Success Criteria:**
- [ ] Ranked by selected metric
- [ ] Trust scores accurate (pulled from ReputationEngine)
- [ ] Cached (5-min TTL)

---

## Database Integration

**Migrations:**
- Migration 20260401000001_add_dojo_v2_models already applied

**Key Models:**
- `Agent` — ERC-8004 identity + wallet
- `Skill` — ERC-1155 listings
- `SkillPurchase` — USDC transactions
- `SkillEquipment` — agent loadout
- `Job` — service requests
- `JobAttestation` — EAS attestations (Phase 2)
- `LeaderboardEntry` — denormalized cache for performance

---

## Payment Integration

**Stripe Setup:**
- [ ] Stripe API keys configured
- [ ] Webhook endpoint: POST /api/webhooks/stripe (handle payment.success + payment.failed)
- [ ] Checkout sessions created in POST /api/skills/buy

**Contract Integration:**
- [ ] SkillRegistry contract deployed on Base (testnet or mainnet)
- [ ] JobMarket contract deployed
- [ ] Mint permissions verified (contract has minter role)

---

## Acceptance Criteria

- [ ] All 5 API routes (A-E) implemented
- [ ] Stripe payment flow end-to-end tested
- [ ] ERC-1155 mint successful on real contract
- [ ] Database records persisted correctly
- [ ] Pagination + filtering work as spec'd
- [ ] Error handling (invalid input, payment fail, contract error)
- [ ] Response times: GET < 200ms, POST < 1s
- [ ] Webhook handles payment events reliably

---

## Blockers

- [ ] Contract addresses (SkillRegistry, JobMarket, ERC-6551 Registry) must be deployed
- [ ] Stripe API keys must be configured
- [ ] Database migrations already run (✅ merged 2026-04-05)

---

## Phase 2 (Deferred)

- Agent-native skill discovery (skill.json + MCP endpoint)
- x402 per-call micro-payments for executable skills
- EAS attestation hooks for on-chain reputation sync
- Level progression (Kozo → Sensei)
