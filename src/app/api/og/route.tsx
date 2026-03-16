import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || 'anonymous'
  const score = parseInt(searchParams.get('score') || '0', 10)
  const type = searchParams.get('type') || 'human'

  const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'
  const scoreBg = score >= 80 ? 'rgba(16,185,129,0.10)' : score >= 50 ? 'rgba(234,179,8,0.10)' : 'rgba(239,68,68,0.10)'
  const scoreBorder = score >= 80 ? 'rgba(16,185,129,0.25)' : score >= 50 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'
  const verdict = score >= 80 ? 'Trusted' : score >= 50 ? 'Caution' : 'Risky'

  // Fonts — TTF only (Satori doesn't support woff2)
  const interBold = await fetch(
    'https://github.com/rsms/inter/raw/master/fonts/static/Inter-Bold.ttf'
  ).then((res) => res.arrayBuffer())

  const interBlack = await fetch(
    'https://github.com/rsms/inter/raw/master/fonts/static/Inter-Black.ttf'
  ).then((res) => res.arrayBuffer())

  // Fetch the actual Maiat logo from GitHub (can't self-fetch in edge runtime)
  const logoData = await fetch(
    'https://raw.githubusercontent.com/JhiNResH/maiat-protocol/master/public/maiat-logo.jpg'
  ).then((res) => res.arrayBuffer())
  const logoBase64 = `data:image/jpeg;base64,${Buffer.from(logoData).toString('base64')}`

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
}
