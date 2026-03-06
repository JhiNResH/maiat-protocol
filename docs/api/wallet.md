# Wallet API

Wallet-level trust passport, interaction history, and EAS receipts.

---

## `GET /api/v1/wallet/{address}/passport`

Returns a wallet's full trust passport — aggregated trust data, review history, Scarab balance.

### Path Parameters
| Name | Type | Description |
|---|---|---|
| `address` | `string` | Wallet address (`0x...`) |

### Response `200`
```json
{
  "address": "0x...",
  "trustScore": 78,
  "tier": "Silver",
  "scarabBalance": 143,
  "reviewCount": 12,
  "feeDiscount": "20% off swap fees",
  "attestationCount": 8,
  "lastActive": "2026-03-01T..."
}
```

---

## `GET /api/v1/wallet/{address}/interactions`

On-chain interaction history for a wallet — queries indexed from Etherscan/Basescan.

### Path Parameters
| Name | Type | Description |
|---|---|---|
| `address` | `string` | Wallet address |

### Response `200`
```json
{
  "address": "0x...",
  "interactions": [
    {
      "contractAddress": "0xProtocol...",
      "chain": "base",
      "txHash": "0x...",
      "blockTimestamp": 1772000000,
      "type": "swap"
    }
  ],
  "total": 47
}
```

---

## `GET /api/v1/wallet/{address}/eas-receipts`

Lists all EAS attestations issued to or by this wallet address.

### Response `200`
```json
{
  "address": "0x...",
  "receipts": [
    {
      "uid": "0xattest...",
      "schemaUID": "0xschema...",
      "attester": "0xMaiatRelayer...",
      "recipient": "0x...",
      "data": {
        "trustScore": 72,
        "verdict": "caution",
        "target": "0xAgent..."
      },
      "time": 1772000000,
      "explorer": "https://base.easscan.org/attestation/view/0xattest..."
    }
  ],
  "total": 8
}
```

---

## `GET /api/v1/wallet/{address}/check-interaction`

Check if a wallet has interacted with a specific smart contract.  
Used to gate reviews (must have used the protocol to review it).

### Query Parameters
| Name | Type | Description |
|---|---|---|
| `contractAddress` | `string` | Target contract to check |
| `chain` | `string` | Chain: `base`, `ethereum`, `bsc` (default: auto-detect) |

### Response `200`
```json
{
  "wallet": "0x...",
  "contractAddress": "0xProtocol...",
  "interacted": true,
  "chain": "base",
  "txCount": 3,
  "firstTx": "2025-12-01T..."
}
```
