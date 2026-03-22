# 402 Index Integration Guide

## Overview

Maiat's integration with **402 Index** (world's largest paid API directory — 15,561+ endpoints) enables agents to discover trustworthy API endpoints and providers through behavioral trust scoring.

**Status:** Phase A (Registration) & Phase B (Trust Scoring API) — SHIPPED  
**Owner:** Jensen  
**Deadline:** 2026-04-01 (Phase C optional)

---

## What is 402 Index?

- **Platform:** Open directory for payment-enabled APIs (L402, x402, MPP protocols)
- **Scale:** 15K+ endpoints indexed, 5.7K+ with verified payments
- **Gap Solved:** Health checks (up/down) exist, but **no trust/quality scoring**
- **Our Role:** Maiat provides trust scoring alongside health metrics

---

## Phase A: Endpoint Registration ✅ COMPLETE

### What We Registered

Five Maiat x402 endpoints are now discoverable on 402 Index:

| Endpoint | Price | Purpose |
|----------|-------|---------|
| `/api/x402/trust` | $0.02/query | Agent trustworthiness (behavioral analysis) |
| `/api/x402/token-check` | $0.01/query | Token safety (honeypot detection) |
| `/api/x402/token-forensics` | $0.05/query | Rug pull analysis (Wadjet ML) |
| `/api/x402/reputation` | $0.03/query | Agent sentiment + endorsements |
| `/api/x402/register-passport` | $0.05/tx | SBT registration + on-chain attestation |

### Domain Verification

Two methods already implemented:

1. **`.well-known/402index-verify.txt`**
   - Located: `https://app.maiat.io/.well-known/402index-verify.txt`
   - Contains: SHA256 domain claim token
   - Purpose: Cryptographic proof of domain ownership

2. **`.well-known/x402-services.json`**
   - Located: `https://app.maiat.io/.well-known/x402-services.json`
   - Contains: Complete endpoint metadata (descriptions, prices, categories)
   - Purpose: Enables 402 Index crawler to auto-discover and index our endpoints

### Verification Status

```bash
# Check domain verification is live
curl https://app.maiat.io/.well-known/402index-verify.txt
curl https://app.maiat.io/.well-known/x402-services.json

# Verify x402 endpoints return proper 402 headers
curl -i https://app.maiat.io/api/x402/trust?agent=0x...
# Should include: WWW-Authenticate: L402 offer="...", WWW-Authenticate: x402 ...
```

---

## Phase B: Trust Scoring API for 402 Index ✅ SHIPPED

### New Endpoint: `/api/v1/402-index/scores`

**Purpose:** Let 402 Index consumers and agents cross-reference endpoints with Maiat trust profiles.

**Request:**
```bash
GET /api/v1/402-index/scores?endpoints[]=<url1>&endpoints[]=<url2>&include_metrics=true

# Example:
curl "https://app.maiat.io/api/v1/402-index/scores?endpoints[]=https://app.maiat.io/api/x402/trust&endpoints[]=https://api.example.com"
```

**Query Parameters:**
- `endpoints[]` (required, array): URLs to score (max 20)
- `include_metrics` (optional, boolean, default: true): Include detailed metrics

**Response:**
```json
{
  "endpoints": [
    {
      "url": "https://app.maiat.io/api/x402/trust",
      "maiatScore": 94,
      "status": "highly-trusted",
      "uptimePercent": 99.8,
      "responseTimeMs": 45,
      "reviewCount": 12,
      "avgRating": 4.8,
      "sybilRisk": "low",
      "completionRate": 0.95,
      "consistency": 0.94,
      "lastVerified": "2026-03-22T09:00:00Z"
    },
    {
      "url": "https://unknown-api.xyz",
      "maiatScore": 0,
      "status": "unvetted",
      "sybilRisk": "high",
      "lastVerified": "2026-03-22T09:00:00Z",
      "reason": "Endpoint not found in Maiat trust index"
    }
  ],
  "scoreCalculation": "Maiat trust = (30% completion_rate + 20% uptime + 15% response_time + 15% sentiment + 10% sybil_score + 10% consistency)",
  "generatedAt": "2026-03-22T09:00:00Z"
}
```

### Trust Score Calculation

Maiat's trust algorithm combines six weighted dimensions:

```
Score = 
  30% × Completion Rate (how often agents finish jobs)
+ 20% × Uptime         (service availability)
+ 15% × Response Time  (speed of responses)
+ 15% × Sentiment      (community reviews + endorsements)
+ 10% × Sybil Risk     (attack resistance based on job diversity)
+ 10% × Consistency    (variance in performance)
```

**Status Mapping:**
- **94-100:** Highly-trusted (proven, reliable)
- **70-93:** Trusted (good track record)
- **40-69:** Unvetted (insufficient data)
- **20-39:** Suspicious (poor performance)
- **0-19:** Dangerous (avoid)

### Rate Limiting

- **Limit:** 50 requests/hour per IP
- **Caching:** 5 minutes (Cache-Control: max-age=300)
- **Rate Limit Header:** `RateLimit-Remaining`

### Usage Examples

**Example 1: Score multiple endpoints**
```bash
curl "https://app.maiat.io/api/v1/402-index/scores?endpoints[]=https://app.maiat.io/api/x402/trust&endpoints[]=https://app.maiat.io/api/x402/token-forensics"
```

**Example 2: Integrate into agent logic**
```typescript
// Before trusting an API endpoint, agents can call:
const scores = await fetch(
  `https://app.maiat.io/api/v1/402-index/scores?endpoints[]=${encodeURIComponent(apiUrl)}`
).then(r => r.json());

if (scores.endpoints[0].maiatScore >= 60) {
  // Use endpoint
} else {
  // Reject or use fallback
}
```

**Example 3: 402 Index dashboard widget**
```html
<!-- Embed trust badge in 402 Index next to health check -->
<script src="https://app.maiat.io/embed/trust-badge.js"></script>
<trust-badge endpoint="https://api.example.com"></trust-badge>
```

---

## Phase C: Dashboard Widget (Optional, Q2+)

**Status:** Pending 402 Index roadmap decision  
**Requirement:** 402 Index to integrate Maiat MCP Server or expose iframe endpoint

If approved:
- Embed trust score widget directly on 402 Index directory pages
- Agents see health ✅ + trust 🛡️ side-by-side when browsing
- Bidirectional: agents submit trust feedback → Maiat learns from 402 Index user behavior

---

## Testing

### Manual Testing

```bash
# 1. Verify domain claim
curl https://app.maiat.io/.well-known/402index-verify.txt
# Response: [SHA256 token]

# 2. Verify services metadata
curl https://app.maiat.io/.well-known/x402-services.json
# Response: {version, provider, services[...]}

# 3. Test trust scoring endpoint
curl "https://app.maiat.io/api/v1/402-index/scores?endpoints[]=https://app.maiat.io/api/x402/trust"
# Response: {endpoints: [...], scoreCalculation: ..., generatedAt: ...}

# 4. Test rate limiting (make 51 rapid requests)
for i in {1..51}; do
  curl -s "https://app.maiat.io/api/v1/402-index/scores?endpoints[]=https://api$i.xyz" | jq .error
done
# Response on 51st request: "Rate limit exceeded"
```

### Automated Testing

```bash
npm test -- 402-index
```

**Test Coverage:**
- ✅ Missing endpoints[] parameter
- ✅ Maiat endpoints score 90+
- ✅ Unknown endpoints score 0
- ✅ Enforce 20-endpoint limit
- ✅ Rate limiting at 50/hour
- ✅ Cache headers (5min TTL)

---

## Integration Checklist

### For Maiat (Complete ✅)
- [x] `.well-known/402index-verify.txt` deployed
- [x] `.well-known/x402-services.json` deployed
- [x] `/api/v1/402-index/scores` endpoint implemented
- [x] Rate limiting configured (50/hour)
- [x] Cache headers set (5min TTL)
- [x] Test suite created
- [x] Build verified (npm run build ✅)
- [x] Production deployment ready

### For 402 Index (Ryan Gentry)
- [ ] Discover `/.well-known/x402-services.json` via crawler
- [ ] Verify domain claim token
- [ ] Index Maiat endpoints in directory
- [ ] Call `/api/v1/402-index/scores` to fetch trust metadata
- [ ] Display trust badge alongside health checks
- [ ] (Optional Phase C) Integrate MCP for widget

---

## Co-Announcement Plan

### Messaging
"**Maiat brings behavioral trust scoring to 402 Index** — agents can now discover API endpoints by both uptime AND trustworthiness. X trust scores available alongside health checks for 15K+ endpoints."

### Channels
1. Tweet (JhiNResH + Ryan Gentry, mutually retweeted)
2. Blog post: "Trust Scoring for Paid APIs" (5K+ target views)
3. 402 Index announcement (Ryan's channels)
4. Discord: ERC-8183, Virtuals, 402 Index communities

### Narrative
- **Problem:** APIs get picked by health only (up/down). No way to pick by provider quality.
- **Solution:** Maiat trust scores = behavioral + on-chain data = agents pick APIs they can trust
- **Impact:** 15K+ endpoints now discoverable by trust, not luck
- **Future:** Every agentic commerce transaction goes through trust layer

---

## Revenue Implications

| Source | Mechanism | Projected Q2 |
|--------|-----------|-------------|
| ACP Queries | Agents query `/api/x402/*` endpoints via 402 Index | +100 queries/day |
| Direct API Calls | 402 Index consumers call `/api/v1/402-index/scores` | +50 queries/day |
| Partnership Revenue | Co-revenue with 402 Index (if negotiated) | TBD |
| MAIAT Staking | Premium endpoints require MAIAT staking | Phase 3 |

---

## Maintenance & Monitoring

### Health Checks
```bash
# Weekly: Verify domain claim still valid
curl https://app.maiat.io/.well-known/402index-verify.txt

# Weekly: Check 402 Index crawler status
curl https://api.402.xyz/endpoints?filter=maiat.io

# Continuous: Monitor query volume
SELECT COUNT(*) FROM QueryLog WHERE route LIKE '%402-index%' AND createdAt > NOW() - INTERVAL 24 HOUR;
```

### Alerting
- If endpoint returns 5xx for >5min → alert
- If query latency > 500ms → check database
- If crawler hasn't indexed our endpoints for 24h → investigate

---

## FAQ

**Q: Why 402 Index and not other API directories?**  
A: 402 Index is the largest (15K+ endpoints), growing fastest, and has payment infrastructure already built. Other directories (RapidAPI, APIs.io) are either closed or don't support payments.

**Q: Do we need to worry about competitor endpoints gaming the score?**  
A: Scores are based on job completion data from ACP (Virtuals contracts), not self-reported metrics. Can't game what's on-chain.

**Q: What if 402 Index rejects our integration?**  
A: We've shipped the infrastructure anyway. Agents can still call `/api/v1/402-index/scores` directly. 402 Index integration is a distribution optimization, not core product.

**Q: How does this impact token launch?**  
A: Each trust query via 402 Index = potential $0.02-$0.05 revenue. 402 Index provides both distribution (15K+ endpoints) and revenue. Ship token → agents explore endpoints → 402 Index integration drives adoption.

---

## References

- **402 Index API:** https://docs.402.xyz/api
- **x402 Spec:** https://specs.402.xyz/x402
- **Ryan Gentry:** @RyanTheGentry (Twitter)
- **Maiat Integration Owner:** Jensen (@0xjhinresh)

_Last updated: 2026-03-22 02:30 AM (Nightly build)_
