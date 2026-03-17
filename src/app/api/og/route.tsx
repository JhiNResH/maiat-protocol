import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || 'anonymous'
    const score = parseInt(searchParams.get('score') || '0', 10)
    const type = searchParams.get('type') || 'human'
    const shape = searchParams.get('shape') || 'og' // og=1200x630, square=500x500

    const isSquare = shape === 'square'
    const width = isSquare ? 500 : 1200
    const height = isSquare ? 500 : 630

    const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'
    const verdict = score >= 80 ? 'Trusted' : score >= 50 ? 'Caution' : 'Risky'
    const verdictBg = score >= 80 ? 'rgba(16,185,129,0.12)' : score >= 50 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)'
    const verdictBorder = score >= 80 ? 'rgba(16,185,129,0.25)' : score >= 50 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'

    // Score arc
    const pct = score / 100
    const r = isSquare ? 44 : 56
    const cx = isSquare ? 52 : 64
    const cy = isSquare ? 52 : 64
    const svgSize = isSquare ? 104 : 128
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + 2 * Math.PI * pct
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = pct > 0.5 ? 1 : 0
    const arcPath = `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`

    if (isSquare) {
      // ─── Square Card (500x500) ─── Maiat liquid-glass dark style
      return new ImageResponse(
        (
          <div style={{
            width: '500px', height: '500px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0A0A0A',
            fontFamily: 'Inter, sans-serif',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Atmosphere gradients (simulated — no blur in Satori) */}
            <div style={{
              position: 'absolute', top: '-80px', right: '-40px',
              width: '320px', height: '320px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
              display: 'flex', opacity: 0.8,
            }} />
            <div style={{
              position: 'absolute', bottom: '-100px', left: '-40px',
              width: '300px', height: '300px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)',
              display: 'flex', opacity: 0.8,
            }} />

            {/* Glass card */}
            <div style={{
              width: '460px', height: '460px', borderRadius: '40px',
              background: 'rgba(20, 20, 20, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 0 60px rgba(0,0,0,0.4), inset 0 0 30px rgba(255,255,255,0.02)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {/* Content */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '20px',
              }}>
                {/* Trust gauge */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', width: `${svgSize}px`, height: `${svgSize}px`,
                }}>
                  <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                    <path d={arcPath} fill="none" stroke={scoreColor} strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <div style={{
                    position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '32px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                      {score}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>
                      /100
                    </span>
                  </div>
                </div>

                {/* Name */}
                <div style={{
                  fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em',
                  lineHeight: 1, color: '#ffffff', display: 'flex',
                }}>
                  {name}.maiat.eth
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Trust */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: verdictBg, border: `1px solid ${verdictBorder}`,
                    borderRadius: '16px', padding: '5px 14px',
                  }}>
                    <div style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: scoreColor, display: 'flex',
                    }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: scoreColor }}>
                      {verdict}
                    </span>
                  </div>

                  {/* Type */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'rgba(212,160,23,0.08)',
                    border: '1px solid rgba(212,160,23,0.15)',
                    borderRadius: '16px', padding: '5px 14px',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#d4a017' }}>
                      {type === 'agent' ? '🤖 Agent' : '👤 Human'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom bar */}
              <div style={{
                position: 'absolute', bottom: '20px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{
                  fontSize: '7px', fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.25em', color: 'rgba(255,255,255,0.12)',
                }}>
                  Maiat Protocol
                </span>
                <div style={{
                  width: '2px', height: '2px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)', display: 'flex',
                }} />
                <span style={{
                  fontSize: '7px', fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.2em', color: 'rgba(255,255,255,0.08)',
                }}>
                  Base · ACP
                </span>
              </div>
            </div>
          </div>
        ),
        { width, height },
      )
    }

    // ─── OG Rectangle (1200x630) ─── Light mode, atmosphere style
    return new ImageResponse(
      (
        <div style={{
          width: '1200px', height: '630px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#FDFDFB',
          fontFamily: 'Inter, sans-serif',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Atmosphere */}
          <div style={{
            position: 'absolute', top: '-100px', right: '100px',
            width: '500px', height: '500px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
            display: 'flex',
          }} />
          <div style={{
            position: 'absolute', bottom: '-80px', left: '150px',
            width: '400px', height: '400px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)',
            display: 'flex',
          }} />

          {/* Glass card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '48px',
            background: 'rgba(255,255,255,0.85)',
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
                position: 'absolute', top: '0', left: '0', right: '0', bottom: '0',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '40px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                  {score}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.2)', marginTop: '2px' }}>
                  /100
                </span>
              </div>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {/* Name */}
              <div style={{
                fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em',
                lineHeight: 1.1, color: '#000000', marginBottom: '20px', display: 'flex',
              }}>
                {name}.maiat.eth
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Trust */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: verdictBg, border: `1px solid ${verdictBorder}`,
                  borderRadius: '20px', padding: '8px 18px',
                }}>
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: scoreColor, display: 'flex',
                  }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: scoreColor }}>
                    {verdict}
                  </span>
                </div>

                {/* Verified */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(59,130,246,0.06)',
                  border: '1px solid rgba(59,130,246,0.12)',
                  borderRadius: '20px', padding: '8px 18px',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6' }}>
                    ✓ Verified on ENS
                  </span>
                </div>

                {/* Type */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(212,160,23,0.06)',
                  border: '1px solid rgba(212,160,23,0.1)',
                  borderRadius: '20px', padding: '8px 18px',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#d4a017' }}>
                    {type === 'agent' ? '🤖 Agent' : '👤 Human'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            position: 'absolute', bottom: '24px',
            display: 'flex', alignItems: 'center', gap: '20px',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.25em',
              color: 'rgba(0,0,0,0.15)', textTransform: 'uppercase' as const,
            }}>
              Maiat Passport
            </span>
            <div style={{
              width: '3px', height: '3px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.08)', display: 'flex',
            }} />
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
              color: 'rgba(0,0,0,0.08)',
            }}>
              Built on Base · Powered by Virtuals ACP
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
