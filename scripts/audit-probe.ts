/**
 * Maiat Protocol — Audit Probe Script
 *
 * Probes the live API for all HIGH severity issues found in the audit.
 * Run: npx tsx scripts/audit-probe.ts
 */

const BASE_URL = 'https://app.maiat.io'
const TIMEOUT = 10_000

// ANSI colors
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

type Result = { label: string; status: 'PASS' | 'FAIL' | 'WARN'; detail: string }
const results: Result[] = []

function log(emoji: string, label: string, status: 'PASS' | 'FAIL' | 'WARN', detail: string) {
  const color = status === 'PASS' ? GREEN : status === 'FAIL' ? RED : YELLOW
  console.log(`  ${emoji} ${color}${status}${RESET} ${BOLD}${label}${RESET}`)
  console.log(`       ${DIM}${detail}${RESET}`)
  results.push({ label, status, detail })
}

async function fetchApi(path: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(TIMEOUT) })
}

// ============================================
// [H1] Name Impersonation Baseline
// ============================================
async function probeH1() {
  console.log(`\n${BOLD}[H1] Name Impersonation Baseline${RESET}`)
  log(
    '⚠️',
    '[H1] Name Impersonation',
    'WARN',
    'getAIBaselineScore() keys on project.name (mutable), not address. Any agent named "uniswap" gets score 90. Fix: key on address or use a separate verified allowlist.'
  )
}

// ============================================
// [H2] Chain Oracle Enumeration
// ============================================
async function probeH2() {
  console.log(`\n${BOLD}[H2] Chain Oracle Enumeration${RESET}`)
  try {
    const res = await fetchApi('/api/v1/trust/based-agent-base?chain=sol')
    if (res.status === 404) {
      const body = await res.json()
      if (body.actual_chain) {
        log(
          '❌',
          '[H2] Chain Oracle',
          'FAIL',
          `404 response leaks actual_chain="${body.actual_chain}". Enables cross-chain enumeration of agent deployments.`
        )
      } else {
        log('✅', '[H2] Chain Oracle', 'PASS', 'Chain mismatch 404 does NOT leak actual_chain. Oracle is patched.')
      }
    } else {
      log('⚠️', '[H2] Chain Oracle', 'WARN', `Unexpected status ${res.status} — agent might actually be on sol.`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log('⚠️', '[H2] Chain Oracle', 'WARN', `Request failed: ${msg}`)
  }
}

// ============================================
// [H3a] Rate Limit Detection
// ============================================
async function probeH3a() {
  console.log(`\n${BOLD}[H3a] Rate Limit Detection${RESET}`)
  try {
    const requests = Array.from({ length: 30 }, () => fetchApi('/api/v1/agents?limit=1'))
    const responses = await Promise.all(requests)
    const statuses = responses.map((r) => r.status)
    const count429 = statuses.filter((s) => s === 429).length

    if (count429 > 0) {
      log('✅', '[H3a] Rate Limiting', 'PASS', `${count429}/30 requests returned 429. Rate limiting is active.`)
    } else {
      log(
        '❌',
        '[H3a] Rate Limiting',
        'FAIL',
        'All 30 concurrent requests returned 200. No rate limiting — endpoint is open to enumeration and DoS.'
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log('⚠️', '[H3a] Rate Limiting', 'WARN', `Request failed: ${msg}`)
  }
}

// ============================================
// [H3b] Negative Offset
// ============================================
async function probeH3b() {
  console.log(`\n${BOLD}[H3b] Negative Offset${RESET}`)
  try {
    const res = await fetchApi('/api/v1/agents?offset=-1')

    if (res.status === 400) {
      log('✅', '[H3b] Negative Offset', 'PASS', 'Server correctly returns 400 for offset=-1.')
    } else if (res.status === 200) {
      const body = await res.json()
      log(
        '✅',
        '[H3b] Negative Offset',
        'PASS',
        `Server returns 200 with ${body.agents?.length ?? '?'} agents (offset likely clamped).`
      )
    } else if (res.status === 500) {
      log(
        '❌',
        '[H3b] Negative Offset',
        'FAIL',
        'Server returns 500 for offset=-1. Prisma skip:-1 causes unhandled error. Fix: clamp offset to >= 0.'
      )
    } else {
      log('⚠️', '[H3b] Negative Offset', 'WARN', `Unexpected status ${res.status}.`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log('⚠️', '[H3b] Negative Offset', 'WARN', `Request failed: ${msg}`)
  }
}

// ============================================
// [H3c] Full Enumeration
// ============================================
async function probeH3c() {
  console.log(`\n${BOLD}[H3c] Full DB Enumeration${RESET}`)
  try {
    const start = Date.now()
    let offset = 0
    let totalAgents = 0
    let hasMore = true

    while (hasMore) {
      const res = await fetchApi(`/api/v1/agents?limit=100&offset=${offset}`)
      if (res.status !== 200) {
        log('⚠️', '[H3c] DB Enumeration', 'WARN', `Non-200 response at offset=${offset}: status=${res.status}`)
        return
      }

      const body = await res.json()
      totalAgents += body.agents?.length ?? 0
      hasMore = body.pagination?.has_more ?? false
      offset += 100
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2)

    if (parseFloat(elapsed) < 2) {
      log(
        '⚠️',
        '[H3c] DB Enumeration',
        'WARN',
        `Full catalog (${totalAgents} agents) enumerated in ${elapsed}s — add rate limiting to prevent bulk scraping.`
      )
    } else {
      log(
        '✅',
        '[H3c] DB Enumeration',
        'PASS',
        `Enumeration took ${elapsed}s for ${totalAgents} agents — acceptable.`
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log('⚠️', '[H3c] DB Enumeration', 'WARN', `Request failed: ${msg}`)
  }
}

// ============================================
// Summary
// ============================================
function printSummary() {
  console.log('\n')
  console.log(`${BOLD}════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  MAIAT PROTOCOL — AUDIT PROBES SUMMARY${RESET}`)
  console.log(`${BOLD}════════════════════════════════════════${RESET}`)

  for (const r of results) {
    const emoji = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'
    const color = r.status === 'PASS' ? GREEN : r.status === 'FAIL' ? RED : YELLOW
    const padded = r.label.padEnd(28)
    console.log(`  ${padded} ${emoji} ${color}${r.status}${RESET}`)
  }

  console.log(`${BOLD}════════════════════════════════════════${RESET}`)

  const fails = results.filter((r) => r.status === 'FAIL').length
  const warns = results.filter((r) => r.status === 'WARN').length
  const passes = results.filter((r) => r.status === 'PASS').length
  console.log(`\n  ${GREEN}${passes} passed${RESET}  ${YELLOW}${warns} warnings${RESET}  ${RED}${fails} failed${RESET}\n`)
}

// ============================================
// Main
// ============================================
async function main() {
  console.log(`\n${BOLD}🔍 Maiat Protocol — Security Audit Probes${RESET}`)
  console.log(`${DIM}   Target: ${BASE_URL}${RESET}\n`)

  await probeH1()
  await probeH2()
  await probeH3a()
  await probeH3b()
  await probeH3c()

  printSummary()
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
