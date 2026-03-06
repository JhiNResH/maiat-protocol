# Monitor API

Real-time event stream and on-chain interaction monitoring.

---

## `GET /api/v1/monitor/feed`

**Server-Sent Events (SSE)** stream. Connect once and receive live events.

### Usage
```js
const es = new EventSource('https://maiat-protocol.vercel.app/api/v1/monitor/feed')
es.onmessage = (e) => console.log(JSON.parse(e.data))
```

### Event Format
```json
{
  "id": "evt_1772000000_abc",
  "message": "✓ VERIFIED: Agent 0xAbCd1234 passed behavioral audit.",
  "level": "info",
  "timestamp": "2026-03-06T00:01:00Z"
}
```

### `level` Values
| Value | Meaning |
|---|---|
| `info` | Standard system event |
| `warning` | Anomaly detected |
| `error` | Failure or critical alert |

---

## `POST /api/v1/monitor/ingest`

Ingest an external event into the monitor feed.

### Request Body
```json
{
  "message": "External system: agent 0x... flagged by partner",
  "level": "warning",
  "source": "partner-api"
}
```

### Response `200`
```json
{ "success": true, "eventId": "evt_..." }
```

---

## `GET /api/v1/monitor/interactions`

Recent on-chain interactions indexed by Maiat.

### Query Parameters
| Name | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `20` | Max results |
| `since` | `string` | 24h ago | ISO timestamp |

### Response `200`
```json
{
  "interactions": [
    {
      "wallet": "0x...",
      "contract": "0xProtocol...",
      "chain": "base",
      "type": "swap",
      "timestamp": "2026-03-06T00:00:00Z"
    }
  ]
}
```

---

## `GET /api/v1/monitor/sweeps`

Recent audit sweep results.

### Response `200`
```json
{
  "sweeps": [
    {
      "agentId": "0xAbCd...",
      "result": "pass",
      "timestamp": "2026-03-05T23:50:00Z",
      "details": "Passed behavioral audit"
    }
  ]
}
```
