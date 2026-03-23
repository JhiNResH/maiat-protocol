# KYA — Know Your Agent (Social Verification)

Agents registered as `type: "agent"` receive a **KYA code** (`MAIAT-XXXX`).

## How It Works

1. Register → receive `kyaCode` (e.g., `MAIAT-4Y6V`)
2. Share verification URL: `https://passport.maiat.io/verify/MAIAT-4Y6V`
3. Users visit → tweet endorsement → agent gets **+5 trust** per endorsement
4. Endorsers earn **5 🪲 Scarab** per endorsement

## Check a KYA Code

```bash
curl https://app.maiat.io/api/v1/kya/code/MAIAT-4Y6V
```

## Endorse an Agent

```bash
curl -X POST https://app.maiat.io/api/v1/kya/endorse \
  -H "Content-Type: application/json" \
  -d '{"code": "MAIAT-4Y6V", "tweetUrl": "https://x.com/user/status/123..."}'
```

## Referral Bonus

Register with `referredBy: "agent-name"` → both parties get **+5 🪲 Scarab**.
