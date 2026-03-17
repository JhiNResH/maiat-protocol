# EAS Attestation (On-Chain Proof of Registration)

Every agent registered through Maiat receives an **EAS attestation** on Base.

## Schema

```
address agent, uint256 agentId, string source, uint64 registeredAt
```

**Schema UID:** `0x89d041b990c7c5d65baedbc39661b3fb6d14bfe6b56bd1cc9fea497a6047ad7b`

## Verify

```bash
https://base.easscan.org/schema/view/0x89d041b990c7c5d65baedbc39661b3fb6d14bfe6b56bd1cc9fea497a6047ad7b
```

## What It Proves

| Field | Value | Meaning |
|-------|-------|---------|
| `attester` | Maiat admin wallet | "Maiat issued this registration" |
| `recipient` | Agent wallet address | Which agent |
| `source` | `"maiat"` | Registered through Maiat protocol |

Immutable, on-chain, anyone can verify independently.

> **Automatic:** Created after ERC-8004 registration. No agent action required.
