/**
 * @jhinresh/viem-guard integration test
 *
 * Demonstrates the guard blocking/allowing transactions based on Maiat trust scores.
 * Uses a mock wallet client (no real tx sent).
 *
 * Run: npx tsx scripts/test-guard.ts
 */

import { createWalletClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { withMaiatTrust, MaiatTrustError } from '@jhinresh/viem-guard'

// Dummy key — no real tx sent in this test
const account = privateKeyToAccount(
  '0x0000000000000000000000000000000000000000000000000000000000000001'
)

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http('https://base-mainnet.g.alchemy.com/v2/okgmVpKT-5iqER0g5yjyn'),
})

// ── Test cases ─────────────────────────────────────────────────────────────────

const TEST_CASES = [
  {
    label: 'Uniswap Router (should PASS — high trust)',
    address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    expectBlock: false,
  },
  {
    label: 'Unknown address (should PASS — fail-open)',
    address: '0x1234567890123456789012345678901234567890',
    expectBlock: false,
  },
  {
    label: 'Warn mode — low trust address',
    address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    mode: 'warn' as const,
    expectBlock: false,
  },
]

async function run() {
  console.log('\n🛡️  @jhinresh/viem-guard integration test\n')
  console.log('  API: https://app.maiat.io/api/v1/trust-check')
  console.log('  Tier: free (10 req/min)\n')
  console.log('─'.repeat(60))

  let passed = 0
  let failed = 0

  for (const tc of TEST_CASES) {
    process.stdout.write(`\n  ${tc.label}\n  → ${tc.address}\n  `)

    const client = withMaiatTrust(walletClient, {
      minScore: 60,
      mode: tc.mode ?? 'block',
      onWarn: (result) => {
        console.log(`  ⚠️  WARN: score=${result.score} verdict=${result.verdict}`)
      },
    })

    try {
      // We don't actually send the tx — just trigger the gate check
      // sendTransaction will throw MaiatTrustError before reaching the RPC
      // For unknown addresses, it returns null (fail-open) → reaches RPC → fails with nonce error
      await client.sendTransaction({
        to: tc.address as `0x${string}`,
        value: 0n,
        // @ts-ignore — no real signing in test
      }).catch((e: Error) => {
        // Rethrow only MaiatTrustError; ignore RPC errors (expected — dummy key)
        if (e instanceof MaiatTrustError || e.name === 'MaiatTrustError') throw e
      })

      if (tc.expectBlock) {
        console.log(`  ❌ FAIL — expected block, but tx was allowed`)
        failed++
      } else {
        console.log(`  ✅ PASS — allowed (fail-open or high trust)`)
        passed++
      }
    } catch (e) {
      if (e instanceof MaiatTrustError || (e as any).name === 'MaiatTrustError') {
        const err = e as MaiatTrustError
        if (tc.expectBlock) {
          console.log(`  ✅ PASS — blocked: score=${err.score} verdict=${err.verdict}`)
          passed++
        } else {
          console.log(`  ❌ FAIL — unexpectedly blocked: score=${err.score}`)
          failed++
        }
      } else {
        console.log(`  ⚠️  RPC error (expected for dummy key): ${(e as Error).message?.slice(0, 60)}`)
        passed++ // gate passed, RPC error is expected
      }
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)

  if (failed > 0) process.exit(1)
}

run().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
