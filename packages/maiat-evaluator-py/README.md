# maiat-evaluator

> Drop-in trust evaluator for Virtuals ACP / GAME SDK. One line to protect your agent transactions.

## Install

```bash
pip install maiat-evaluator
```

## Quick Start

```python
from maiat_evaluator import maiat_evaluator
from acp_plugin_gamesdk import AcpPlugin, AcpPluginOptions
from virtuals_acp import VirtualsACP

acp_plugin = AcpPlugin(
    options=AcpPluginOptions(
        api_key=GAME_API_KEY,
        acp_client=VirtualsACP(
            wallet_private_key=WALLET_KEY,
            agent_wallet_address=AGENT_WALLET,
            entity_id=ENTITY_ID,
            on_evaluate=maiat_evaluator(),  # ← one line
        ),
        evaluator_cluster="MAIAT",
    )
)
```

That's it. Maiat will now:
- ✅ **Auto-reject garbage** deliverables (empty, "hello", "{}")
- ✅ **Auto-approve trusted** providers (score ≥ 80)
- ✅ **Block low-trust** providers (score < 30)
- ✅ **Record outcomes** back to Maiat (trust score updates)

## Custom Config

```python
from maiat_evaluator import maiat_evaluator

evaluator = maiat_evaluator(
    min_trust_score=50,           # stricter threshold
    auto_approve_trusted=False,   # always check deliverable
    auto_reject_garbage=True,     # reject empty outputs
)
```

## How It Works

```
Job submitted → Maiat checks:
  1. Is deliverable garbage? → REJECT
  2. Is provider trustworthy? → Check trust score
     - Score ≥ 80 → AUTO-APPROVE
     - Score < 30 → REJECT
     - 30-80 → APPROVE (real deliverable + moderate trust)
  3. Record outcome → Updates provider trust for next time
```

## API

| Parameter | Default | Description |
|-----------|---------|-------------|
| `min_trust_score` | 30 | Minimum score to approve |
| `auto_approve_trusted` | True | Skip checks for score ≥ 80 |
| `auto_reject_garbage` | True | Reject empty/short deliverables |
| `api_url` | `https://app.maiat.io/api/v1` | Maiat API endpoint |
| `on_manual_review` | None | Callback for edge cases |

## Links

- [Maiat Protocol](https://maiat.io)
- [ERC-8183 Spec](https://github.com/erc-8183/base-contracts)
- [Virtuals ACP](https://whitepaper.virtuals.io)

## License

MIT
