import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || 'anonymous'
  const score = parseInt(searchParams.get('score') || '0', 10)
  const type = searchParams.get('type') || 'human'

  const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'
  const scoreBg = score >= 80 ? 'rgba(16,185,129,0.10)' : score >= 50 ? 'rgba(234,179,8,0.10)' : 'rgba(239,68,68,0.10)'
  const scoreBorder = score >= 80 ? 'rgba(16,185,129,0.25)' : score >= 50 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'
  const verdict = score >= 80 ? 'Trusted' : score >= 50 ? 'Caution' : 'Risky'

  // Fonts: Inter woff2 direct from Google Fonts static CDN (edge-safe, no redirects)
  // Next.js ImageResponse (Satori) supports woff2 since v14
  const [interBold, interBlack] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2').then((r) => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2').then((r) => r.arrayBuffer()),
  ])

  // Maiat logo inlined as base64 (64x64 jpeg, ~3KB) — edge runtime can't self-fetch or use Buffer
  const logoBase64 = 'data:image/jpeg;base64,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'

  // Score arc
  const pct = score / 100
  const r = 56
  const cx = 64
  const cy = 64
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + 2 * Math.PI * pct
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const largeArc = pct > 0.5 ? 1 : 0
  const arcPath = `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A0A',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Atmosphere gradients — matching globals.css dark mode */}
        <div style={{
          position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)',
          width: '1000px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 65%)',
          filter: 'blur(80px)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: '-150px', right: '50px',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 55%)',
          filter: 'blur(80px)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', top: '100px', left: '-100px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,23,0.05) 0%, transparent 55%)',
          filter: 'blur(80px)',
          display: 'flex',
        }} />

        {/* Main content */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '56px',
          position: 'relative',
        }}>
          {/* Left: Trust gauge with score */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}>
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
              <path d={arcPath} fill="none" stroke={scoreColor} strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <div style={{
              position: 'absolute',
              top: '0', left: '0', right: '0', bottom: '0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '40px',
                fontWeight: 900,
                color: scoreColor,
                lineHeight: 1,
              }}>{score}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.2)',
                marginTop: '2px',
              }}>/100</span>
            </div>
          </div>

          {/* Center: Logo + Name + Badges */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Maiat Logo — liquid glass container */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '20px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 0 30px rgba(255,255,255,0.02), 0 30px 100px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={logoBase64}
                width="64"
                height="64"
                style={{ objectFit: 'cover' }}
              />
            </div>

            {/* Name */}
            <div style={{
              fontSize: '52px',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              color: '#ffffff',
              marginBottom: '28px',
              textAlign: 'center',
              display: 'flex',
            }}>
              {name}.maiat.eth
            </div>

            {/* Badges row — liquid glass style */}
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}>
              {/* Trust Score badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: scoreBg,
                backdropFilter: 'blur(60px) saturate(180%)',
                border: `1px solid ${scoreBorder}`,
                borderRadius: '24px',
                padding: '10px 22px',
                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.01)',
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: scoreColor, display: 'flex',
                }} />
                <span style={{
                  fontSize: '15px', fontWeight: 700, color: scoreColor,
                }}>
                  {verdict}
                </span>
              </div>

              {/* Verified badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(59,130,246,0.06)',
                backdropFilter: 'blur(60px) saturate(180%)',
                border: '1px solid rgba(59,130,246,0.15)',
                borderRadius: '24px',
                padding: '10px 22px',
                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.01)',
              }}>
                <span style={{
                  fontSize: '15px', fontWeight: 700, color: '#3b82f6',
                }}>
                  ✓ Verified on ENS
                </span>
              </div>

              {/* Type badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(212,160,23,0.06)',
                backdropFilter: 'blur(60px) saturate(180%)',
                border: '1px solid rgba(212,160,23,0.12)',
                borderRadius: '24px',
                padding: '10px 22px',
                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.01)',
              }}>
                <span style={{
                  fontSize: '15px', fontWeight: 700, color: '#d4a017',
                }}>
                  {type === 'agent' ? '🤖 Agent' : '👤 Human'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: 'absolute',
          bottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
        }}>
          {/* Small logo repeat */}
          <img
            src={logoBase64}
            width="18"
            height="18"
            style={{ borderRadius: '4px', opacity: 0.4 }}
          />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.15)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase' as const,
          }}>
            MAIAT PASSPORT
          </span>
          <div style={{
            width: '3px', height: '3px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', display: 'flex',
          }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.08)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
          }}>
            Built on Base · Powered by Virtuals ACP
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const },
        { name: 'Inter', data: interBlack, weight: 900 as const, style: 'normal' as const },
      ],
    },
  )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
