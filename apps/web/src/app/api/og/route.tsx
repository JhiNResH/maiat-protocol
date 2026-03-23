import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || 'anonymous'
    const logo = searchParams.get('logo') || ''
    const shape = searchParams.get('shape') || 'og' // og=1200x630, square=500x500

    const isSquare = shape === 'square'
    const width = isSquare ? 500 : 1200
    const height = isSquare ? 500 : 630

    if (isSquare) {
      // ─── Square Card (500x500) ─── White bg, logo top-left, name bottom-left
      return new ImageResponse(
        (
          <div style={{
            width: '500px', height: '500px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#F8F8F6',
            fontFamily: 'Inter, sans-serif',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Subtle atmosphere */}
            <div style={{
              position: 'absolute', top: '-120px', right: '-60px',
              width: '360px', height: '360px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)',
              display: 'flex',
            }} />

            {/* Glass card */}
            <div style={{
              width: '440px', height: '440px', borderRadius: '32px',
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              padding: '32px',
            }}>
              {/* Logo top-left */}
              <div style={{ display: 'flex' }}>
                {logo ? (
                  <img
                    src={logo}
                    width={56}
                    height={56}
                    style={{ borderRadius: '14px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '14px',
                    background: '#111', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>
                      {name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name bottom-left */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em',
                  lineHeight: 1.1, color: '#000000',
                }}>
                  {name}.maiat.eth
                </span>
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{
              position: 'absolute', bottom: '16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{
                fontSize: '7px', fontWeight: 700, textTransform: 'uppercase' as const,
                letterSpacing: '0.25em', color: 'rgba(0,0,0,0.12)',
              }}>
                Maiat Passport
              </span>
            </div>
          </div>
        ),
        { width, height },
      )
    }

    // ─── OG Rectangle (1200x630) ─── White bg, logo left, name below
    return new ImageResponse(
      (
        <div style={{
          width: '1200px', height: '630px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#F8F8F6',
          fontFamily: 'Inter, sans-serif',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Subtle atmosphere */}
          <div style={{
            position: 'absolute', top: '-100px', right: '100px',
            width: '500px', height: '500px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)',
            display: 'flex',
          }} />

          {/* Glass card */}
          <div style={{
            width: '1080px', height: '510px', borderRadius: '40px',
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '48px 64px',
            position: 'relative',
          }}>
            {/* Logo top-left */}
            <div style={{ display: 'flex' }}>
              {logo ? (
                <img
                  src={logo}
                  width={72}
                  height={72}
                  style={{ borderRadius: '18px', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '72px', height: '72px', borderRadius: '18px',
                  background: '#111', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: '32px', fontWeight: 900 }}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Name bottom-left */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em',
                lineHeight: 1.1, color: '#000000',
              }}>
                {name}.maiat.eth
              </span>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            position: 'absolute', bottom: '24px',
            display: 'flex', alignItems: 'center', gap: '20px',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.25em',
              color: 'rgba(0,0,0,0.12)', textTransform: 'uppercase' as const,
            }}>
              Maiat Passport
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
