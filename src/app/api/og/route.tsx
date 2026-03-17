import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || 'anonymous'
    const score = parseInt(searchParams.get('score') || '0', 10)
    const type = searchParams.get('type') || 'human'
    const shape = searchParams.get('shape') || 'og' // og | square | card

    const isSquare = shape === 'square' || shape === 'card'
    const width = isSquare ? 500 : 1200
    const height = isSquare ? 500 : 630

    const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'
    const verdict = score >= 80 ? 'Trusted' : score >= 50 ? 'Caution' : 'Risky'

    // Score arc calculation
    const pct = Math.min(score, 100) / 100

    if (isSquare) {
      // ─── Square Card (500x500) ─── Clean, premium dark card
      return new ImageResponse(
        (
          <div style={{
            width: '500px',
            height: '500px',
            display: 'flex',
            background: '#0A0A0A',
            fontFamily: 'Inter, system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Atmosphere glow — top right emerald */}
            <div style={{
              position: 'absolute',
              top: '-120px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.05) 40%, transparent 70%)',
              display: 'flex',
            }} />

            {/* Atmosphere glow — bottom left blue */}
            <div style={{
              position: 'absolute',
              bottom: '-140px',
              left: '-100px',
              width: '420px',
              height: '420px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.04) 40%, transparent 70%)',
              display: 'flex',
            }} />

            {/* Subtle center glow */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 60%)',
              display: 'flex',
            }} />

            {/* Main content — centered */}
            <div style={{
              position: 'absolute',
              inset: '0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
            }}>
              {/* Diamond Logo */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px',
              }}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  {/* Outer hexagonal shield */}
                  <path
                    d="M32 4L56 18V46L32 60L8 46V18L32 4Z"
                    fill="rgba(255,255,255,0.04)"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                  />
                  {/* Inner diamond */}
                  <path
                    d="M32 16L46 24V40L32 48L18 40V24L32 16Z"
                    fill="rgba(255,255,255,0.06)"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="0.8"
                  />
                  {/* Center jewel */}
                  <path
                    d="M32 26L38 30V38L32 42L26 38V30L32 26Z"
                    fill="rgba(255,255,255,0.12)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="0.6"
                  />
                </svg>
              </div>

              {/* Score */}
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '4px',
                marginBottom: '16px',
              }}>
                <span style={{
                  fontSize: '56px',
                  fontWeight: 900,
                  color: scoreColor,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}>
                  {score}
                </span>
                <span style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.15)',
                  lineHeight: 1,
                }}>
                  /100
                </span>
              </div>

              {/* Name */}
              <div style={{
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                lineHeight: 1,
                marginBottom: '20px',
                display: 'flex',
              }}>
                {name}.maiat.eth
              </div>

              {/* Badge row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Trust verdict */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: score >= 80 ? 'rgba(16,185,129,0.1)' : score >= 50 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${score >= 80 ? 'rgba(16,185,129,0.2)' : score >= 50 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: '100px',
                  padding: '6px 14px',
                }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: scoreColor, display: 'flex',
                    boxShadow: `0 0 8px ${scoreColor}`,
                  }} />
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: scoreColor,
                    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                  }}>
                    {verdict}
                  </span>
                </div>

                {/* Type */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '100px',
                  padding: '6px 14px',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                  }}>
                    {type === 'agent' ? 'Agent' : 'Human'}
                  </span>
                </div>

                {/* ENS verified */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(59,130,246,0.06)',
                  border: '1px solid rgba(59,130,246,0.12)',
                  borderRadius: '100px',
                  padding: '6px 14px',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    color: 'rgba(59,130,246,0.7)',
                    letterSpacing: '0.05em',
                  }}>
                    ENS
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom watermark */}
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '0',
              right: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}>
              <span style={{
                fontSize: '8px', fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.3em',
                color: 'rgba(255,255,255,0.08)',
              }}>
                Maiat Protocol
              </span>
              <div style={{
                width: '2px', height: '2px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', display: 'flex',
              }} />
              <span style={{
                fontSize: '8px', fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.3em',
                color: 'rgba(255,255,255,0.06)',
              }}>
                Base
              </span>
            </div>
          </div>
        ),
        { width, height },
      )
    }

    // ─── OG Rectangle (1200x630) ─── Light atmosphere style
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
        <div style={{
          width: '1200px', height: '630px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#FDFDFB',
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Atmosphere */}
          <div style={{
            position: 'absolute', top: '-100px', right: '80px',
            width: '500px', height: '500px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
            display: 'flex',
          }} />
          <div style={{
            position: 'absolute', bottom: '-80px', left: '120px',
            width: '400px', height: '400px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 65%)',
            display: 'flex',
          }} />

          {/* Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '56px',
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '32px', padding: '48px 64px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)',
          }}>
            {/* Trust gauge */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              position: 'relative', width: '128px', height: '128px', flexShrink: 0,
            }}>
              <svg width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="3" />
                <path d={arcPath} fill="none" stroke={scoreColor} strokeWidth="3.5" strokeLinecap="round" />
              </svg>
              <div style={{
                position: 'absolute', inset: '0',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '40px', fontWeight: 900, color: scoreColor, lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}>
                  {score}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.15)', marginTop: '2px',
                }}>
                  /100
                </span>
              </div>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {/* Name */}
              <div style={{
                fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em',
                lineHeight: 1.1, color: '#000', marginBottom: '20px', display: 'flex',
              }}>
                {name}.maiat.eth
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: score >= 80 ? 'rgba(16,185,129,0.08)' : score >= 50 ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${score >= 80 ? 'rgba(16,185,129,0.2)' : score >= 50 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: '100px', padding: '8px 18px',
                }}>
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: scoreColor, display: 'flex',
                  }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: scoreColor }}>
                    {verdict}
                  </span>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(59,130,246,0.06)',
                  border: '1px solid rgba(59,130,246,0.12)',
                  borderRadius: '100px', padding: '8px 18px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>
                    ENS Verified
                  </span>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(212,160,23,0.06)',
                  border: '1px solid rgba(212,160,23,0.1)',
                  borderRadius: '100px', padding: '8px 18px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#d4a017' }}>
                    {type === 'agent' ? 'Agent' : 'Human'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div style={{
            position: 'absolute', bottom: '24px',
            display: 'flex', alignItems: 'center', gap: '20px',
          }}>
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em',
              color: 'rgba(0,0,0,0.12)', textTransform: 'uppercase' as const,
            }}>
              Maiat Passport
            </span>
            <div style={{
              width: '3px', height: '3px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', display: 'flex',
            }} />
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em',
              color: 'rgba(0,0,0,0.06)',
            }}>
              Built on Base
            </span>
          </div>
        </div>
      ),
      { width, height },
    )
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: String(e), stack: (e as Error)?.stack }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
