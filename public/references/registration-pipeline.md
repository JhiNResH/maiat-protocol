# Full Registration Pipeline

When an agent registers through Maiat, the following happens **automatically**:

```
1. ENS subname     → yourname.maiat.eth (via NameStone, gasless)
2. ERC-8004        → On-chain agent identity on Base (agentId)
3. EAS attestation → Proof of Maiat registration (on-chain)
4. ENSIP-25        → Binds agentId to ENS text record
5. KYA code        → Social verification via Twitter (opt-in)
```

Steps 1–4 are fully automated. Step 5 is opt-in.

## Register

```bash
POST /api/v1/passport/register
Body: {
  "walletAddress": "0xYourWallet",
  "type": "agent",          # or "token"
  "name": "my-agent",
  "referredBy": "agent-name"  # optional, earns +5 Scarab for both
}
```

## Check Registration Status

```bash
GET /api/v1/passport/{address}
→ erc8004AgentId, erc8004Status, kyaCode, ensName, easAttestationUid
```

## After Registration

- ENS: `your-agent.maiat.eth` resolves to your wallet
- Trust Score bonus: +10 after ENS verified (see `ens-verification.md`)
- EAS attestation: viewable on base.easscan.org (see `eas-attestation.md`)
- KYA code: share to collect social endorsements (see `kya-social.md`)
