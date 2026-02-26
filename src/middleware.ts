import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js edge middleware — logs every /api/* request with method, path, duration, and status.
 * Also injects deprecation warnings for legacy /api/* routes (non-v1).
 */

// Map of deprecated legacy routes → their v1 replacement
const DEPRECATED_ROUTES: Record<string, string> = {
  '/api/trust-score':   '/api/v1/trust-score',
  '/api/reputation':    '/api/v1/wallet/{address}/passport',
  '/api/search':        '/api/v1/agents?q={query}',
  '/api/onchain/stats': '/api/v1/stats',
  '/api/verify-base':   '/api/v1/score/{address}',
}

export function middleware(request: NextRequest) {
  const start = Date.now()
  const method = request.method
  const path = request.nextUrl.pathname
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  console.log(
    `[Maiat:MW] ${new Date().toISOString()} ${method} ${path} from=${ip}`
  )

  const response = NextResponse.next()
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
  response.headers.set('X-Request-Id', crypto.randomUUID())

  // Inject deprecation headers for legacy routes
  const isV1 = path.startsWith('/api/v1/')
  const isLegacyReview = path === '/api' || path.startsWith('/api/')
  if (!isV1 && isLegacyReview) {
    const successor = DEPRECATED_ROUTES[path] ?? '/api/v1/'
    response.headers.set('Deprecation', 'true')
    response.headers.set('X-Deprecated-Route', path)
    response.headers.set('X-Use-Instead', successor)
    response.headers.set(
      'Warning',
      `299 maiat "This route is deprecated. Use ${successor} instead. It will be removed in v2."`
    )
    console.log(`[Maiat:MW] DEPRECATED ${path} → ${successor}`)
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
