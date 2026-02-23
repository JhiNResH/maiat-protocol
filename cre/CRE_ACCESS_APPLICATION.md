# Chainlink CRE Early Access Application
# 申請網址: https://cre.chain.link/request-access
# 填好後存這裡備份

---

## Project Name
Maiat Protocol

## Project Website / GitHub
https://github.com/JhiNResH/maiat-protocol

## Contact Email
(填你的 email)

---

## Project Description (What are you building?)

Maiat Protocol is a trust-gated DeFi infrastructure layer built on Uniswap V4. It aggregates community reviews, on-chain metrics, and AI sentiment analysis to compute trust scores for tokens, then enforces these scores at the AMM layer via a Uniswap V4 hook.

The core stack:
- **TrustGateHook** — Uniswap V4 hook that gates token swaps based on trust scores and applies reputation-based dynamic fees
- **TrustScoreOracle** — on-chain trust score registry updated by a Chainlink CRE workflow
- **MaiatTrustConsumer** — IReceiver contract receiving signed CRE reports (KeystoneForwarder delivery)

The CRE workflow orchestrates: Cron trigger → fetch community reviews from Maiat API → Gemini AI sentiment analysis → compute weighted trust scores → write batch to MaiatTrustConsumer via EVMClient

---

## Why CRE? What capabilities do you need?

Our architecture is purpose-built for CRE. We need:

1. **CronCapability** — scheduled workflow execution every 30 minutes
2. **HTTPClient (Node Mode)** — fetch review data from Maiat API + call Gemini AI sentiment endpoint
3. **EVMClient (writeReport)** — deliver signed batch reports to MaiatTrustConsumer.onReport() via KeystoneForwarder
4. **consensusMedianAggregation** — DON consensus on aggregated review metrics

Without CRE deployment, the trust score updates are manual/centralized. CRE is the only path to trustless, decentralized score computation.

---

## Target Network

- **Testnet:** Base Sepolia (primary development)
- **Mainnet (future):** Base

---

## Current Status

- MaiatTrustConsumer.sol deployed and audited (IReceiver compliant)
- CRE workflow code complete (`cre/trust-score/main.ts`) — TypeScript SDK
- Simulation tested locally
- Full security audit completed 2026-02-23 (all findings fixed, 118 tests passing)
- Uniswap V4 hook deployed to Base Sepolia testnet

---

## Use Case Category

[ ] DeFi
[x] Infrastructure / Tooling
[x] Data / Oracles
[ ] Gaming
[ ] Other

---

## Team

- Size: small (~2-3 devs)
- Background: smart contract security, DeFi protocol development
- Building on Uniswap V4 (Convergence Hackathon track: CRE & AI)

---

## What does success look like?

CRE workflow running on DON with 30-min cadence, updating trust scores for tokens trading on Uniswap V4 Base pools. Community review scores → verifiable on-chain trust data → lower fees for trusted participants, blocked swaps for low-trust tokens.

---

## Additional Notes

Our MaiatTrustConsumer contract is already designed to receive CRE-signed reports:
- Implements IReceiver interface with onReport(bytes metadata, bytes report)
- Validates KeystoneForwarder caller
- Includes replay protection, metadata length validation, workflow owner verification
- 2-day timelock on all admin changes

We are already in the CRE ecosystem — just need live DON access to complete the circle.

---

## 填表指引 (for JhiNResH)

申請連結: **https://cre.chain.link/request-access**

表單通常問：
1. Name / Email / Company → 填你個人/Maiat
2. Project description → 複製上面「Project Description」段落
3. What capabilities needed → 複製「Why CRE」段落
4. Target network → Base Sepolia
5. Use case → DeFi Infrastructure / Oracle

提交後通常 1-3 個工作天審核。審核期間可以繼續用 simulation 模式開發。
