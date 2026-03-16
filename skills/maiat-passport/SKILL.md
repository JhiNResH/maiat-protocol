# Maiat Passport — Give Your Agent an Identity

Register your AI agent on Maiat to get a verifiable on-chain identity, ENS name, and trust score.

## What You Get

| Feature | Description |
|---------|-------------|
| **ENS Name** | `yourname.maiat.eth` — gasless, resolvable on-chain via CCIP-Read |
| **ERC-8004 Identity** | On-chain agent registration on Base Mainnet |
| **Trust Score** | Queryable reputation score (0-100) |
| **Scarab Credits** | 10 🪲 bonus credits on registration |

## Quick Start (API)

### 1. Register Your Agent

```bash
curl -X POST https://app.maiat.io/api/v1/passport/register \
  -H "Content-Type: application/json" \
  -d '{
    "ensName": "my-agent",
    "walletAddress": "0xYourAgentWalletAddress",
    "type": "agent"
  }'
```

**Response:**
```json
{
  "passport": {
    "ensName": "my-agent",
    "ensFullName": "my-agent.maiat.eth",
    "walletAddress": "0x...",
    "type": "agent",
    "trustScore": 50,
    "verdict": "Caution",
    "scarabBalance": 10,
    "isNew": true,
    "erc8004AgentId": 28373
  }
}
```

### 2. Lookup Any Agent

```bash
curl https://app.maiat.io/api/v1/passport/lookup?q=my-agent
```

### 3. Check Trust Before Transacting

```bash
curl https://app.maiat.io/api/v1/agent/0xAddress/deep
```

## SDK (Optional)

```bash
npm install @jhinresh/maiat-sdk
```

```typescript
import { MaiatSDK } from '@jhinresh/maiat-sdk';

const maiat = new MaiatSDK();

// Register
const passport = await maiat.passport.register({
  ensName: 'my-agent',
  walletAddress: '0x...',
  type: 'agent',
});

// Lookup
const result = await maiat.passport.lookup('my-agent');

// Trust check
const trust = await maiat.agent.trust('0xAddress');
```

## Parameters

| Field | Required | Description |
|-------|----------|-------------|
| `ensName` | ✅ | 3+ chars, lowercase, letters/numbers/hyphens only |
| `walletAddress` | ✅ | Valid 0x address (your agent's wallet) |
| `type` | Optional | `"agent"` or `"human"` (default: `"human"`) |
| `referredBy` | Optional | ENS name of referrer (both get +5 🪲) |

## Rules

- Names are unique and case-insensitive
- Once claimed, a name cannot be re-registered
- ENS names resolve on-chain via CCIP-Read (zero gas)
- Trust scores update based on on-chain activity and reviews

## Links

- **Passport Portal:** https://passport.maiat.io
- **API Docs:** https://app.maiat.io/docs
- **Explorer:** https://app.maiat.io/analytics
- **GitHub:** https://github.com/JhiNResH/maiat-protocol
- **ERC-8004 Registry:** https://www.8004scan.io
