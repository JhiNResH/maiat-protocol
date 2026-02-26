import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js edge proxy — logs every /api/* request with method, path, duration, and status.
 * Runs at the edge before the route handler.
 */
export function proxy(request: NextRequest) {
  const start = Date.now()
  const method = request.method
  const path = request.nextUrl.pathname
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  // Log the incoming request
  console.log(
    `[Maiat:MW] ${new Date().toISOString()} ${method} ${path} from=${ip}`
  )

  const response = NextResponse.next()

  // Add timing header for downstream visibility
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
  response.headers.set('X-Request-Id', crypto.randomUUID())

  return response
}

// Support both naming conventions
export default proxy

export const config = {
  matcher: '/api/:path*',
}
