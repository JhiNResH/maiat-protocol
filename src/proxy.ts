import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js edge proxy — handles subdomain rewrites + API request logging.
 * Replaces both middleware.ts and proxy.ts (Next.js 16 requires proxy only).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // ── Subdomain rewrites ──────────────────────────────────────────────
  // passport.maiat.io → rewrite to /passport/*
  if (host.startsWith('passport.')) {
    if (pathname.startsWith('/passport')) {
      return NextResponse.next()
    }
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/passport'
      return NextResponse.rewrite(url)
    }
    if (/^\/0x[a-fA-F0-9]{40}/.test(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = `/passport${pathname}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // ── API request logging ─────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const start = Date.now()
    const method = request.method
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    console.log(
      `[Maiat:MW] ${new Date().toISOString()} ${method} ${pathname} from=${ip}`
    )

    const response = NextResponse.next()
    response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
    response.headers.set('X-Request-Id', crypto.randomUUID())
    return response
  }

  return NextResponse.next()
}

export default proxy

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
