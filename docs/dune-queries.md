# Maiat Dune Dashboard — SQL Queries

Go to [dune.com/queries](https://dune.com/queries) → New Query → paste each SQL.
After creating all queries, create a dashboard and add them as panels.

---

## 1. EAS Attestations by Maiat (Base Sepolia)

> Note: Dune may not index Base Sepolia. If not, switch to Base mainnet queries once we migrate.

```sql
-- Maiat EAS Attestations on Base
-- Attester: 0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
-- EAS contract: 0x4200000000000000000000000000000000000021
-- Attested event topic0: 0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75c68f7992a

SELECT
    block_time,
    tx_hash,
    topic1 as schema_uid,
    topic2 as attester_topic,
    CASE 
        WHEN topic1 = 0x0dd60646c73be829e8dd9f3962d598c160c2f02dc312e54a897e2a775462c325 THEN 'ServiceAttestation'
        WHEN topic1 = 0x524e9c4af4d00891e2fd82d8d3a8a76242af517828041993d897dd9ada38d584 THEN 'ReviewAttestation'
        WHEN topic1 = 0x0673489de908dbfecce0a4b517c8c8b4017e774e57ede2bebfaa04eeae78a424 THEN 'TrustQuery'
        ELSE 'Other'
    END as attestation_type
FROM base.logs
WHERE contract_address = 0x4200000000000000000000000000000000000021
    AND topic0 = 0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75c68f7992a
    AND "from" = 0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
ORDER BY block_time DESC
LIMIT 200
```

## 2. EAS Attestation Trend (Daily Count)

```sql
SELECT
    DATE_TRUNC('day', block_time) as day,
    COUNT(*) as attestation_count,
    COUNT(DISTINCT topic1) as unique_schemas
FROM base.logs
WHERE contract_address = 0x4200000000000000000000000000000000000021
    AND topic0 = 0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75c68f7992a
    AND "from" = 0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
GROUP BY 1
ORDER BY 1 DESC
```

## 3. ERC-8004 Registered Agents

```sql
-- ERC-8004 IdentityRegistry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
-- Registered event topic0: keccak256("Registered(uint256,string,address)")

SELECT
    block_time,
    tx_hash,
    topic1 as agent_id,
    topic2 as owner
FROM base.logs
WHERE contract_address = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
    AND topic0 = 0xd8ea577440b846e100f1e4b3a17b30d76a1f0268abc26abf79bfd3b26bc94bd3
ORDER BY block_time DESC
LIMIT 200
```

## 4. ERC-8004 Reputation Feedback Submissions

```sql
-- ReputationRegistry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
-- submitFeedback events

SELECT
    block_time,
    tx_hash,
    "from" as submitter,
    topic1 as agent_id
FROM base.logs
WHERE contract_address = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
ORDER BY block_time DESC
LIMIT 200
```

## 5. Maiat Oracle — Trust Score Updates

```sql
-- MaiatOracle on Base Sepolia
-- TrustScoreOracle: 0xf662902... (check actual deployed address)
-- updateScore events

SELECT
    block_time,
    tx_hash,
    "from" as updater,
    topic1 as agent_address
FROM base.logs
WHERE contract_address = 0xf662902eBD8e29a52f48Db2d57e7c1a44fa04d21
ORDER BY block_time DESC
LIMIT 100
```

## 6. Maiat Ecosystem Overview (Counter Panel)

```sql
-- Total counts for headline metrics
SELECT
    (SELECT COUNT(*) FROM base.logs 
     WHERE contract_address = 0x4200000000000000000000000000000000000021
       AND "from" = 0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9) as total_attestations,
    (SELECT COUNT(*) FROM base.logs 
     WHERE contract_address = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
       AND topic0 = 0xd8ea577440b846e100f1e4b3a17b30d76a1f0268abc26abf79bfd3b26bc94bd3) as total_8004_agents
```

---

## Dashboard Layout

1. **Row 1** — Counter panels: Total Attestations | Total 8004 Agents | Total Feedback
2. **Row 2** — EAS Attestation Trend (line chart, daily)
3. **Row 3** — Recent Attestations (table) | Recent 8004 Registrations (table)
4. **Row 4** — Oracle Score Updates (table) | Feedback Submissions (table)

Dashboard title: **Maiat Trust Infrastructure — Base**
Description: *Real-time metrics for Maiat's trust scoring, EAS attestations, and ERC-8004 identity registry on Base.*
