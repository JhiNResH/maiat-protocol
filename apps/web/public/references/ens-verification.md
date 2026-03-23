# ENS Verification (ENSIP-25)

Link your on-chain identity (ERC-8004) to your ENS name. Earns **+10 Trust Score**.

**Who can do this:** Only the ENS name owner.

## Steps

### 1. Register your passport (if not done)
```bash
POST /api/v1/passport/register
→ returns erc8004AgentId
```
Check `erc8004Status` in response: `registered` ✅ → proceed. `pending`/`failed` → contact support.

### 2. Get your text record key
```bash
curl https://app.maiat.io/api/v1/ens/verify \
  -X POST -H "Content-Type: application/json" \
  -d '{"ensName": "your-agent.maiat.eth", "walletAddress": "0xYourWallet"}'
# Returns: textRecordKey + instructions
```

### 3. Set the text record
1. Go to `https://app.ens.domains`
2. Your ENS name → Edit Records
3. Add: Key = `<textRecordKey>`, Value = `1`

### 4. Confirm
```bash
curl https://app.maiat.io/api/v1/ens/verify \
  -X POST -H "Content-Type: application/json" \
  -d '{"ensName": "your-agent.maiat.eth", "agentId": 28373}'
# Returns: { verified: true, trustScoreBonus: 10 }
```

> **maiat.eth subdomains:** ENSIP-25 record is set automatically. No manual action needed.
