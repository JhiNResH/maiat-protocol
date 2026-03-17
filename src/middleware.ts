import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // passport.maiat.io → rewrite to /passport/*
  if (host.startsWith('passport.')) {
    const { pathname, search } = request.nextUrl
    // Already on /passport path → pass through
    if (pathname.startsWith('/passport')) {
      return NextResponse.next()
    }
    // Root → /passport
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/passport'
      return NextResponse.rewrite(url)
    }
    // /0x... → /passport/0x...
    if (/^\/0x[a-fA-F0-9]{40}/.test(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = `/passport${pathname}`
      return NextResponse.rewrite(url)
    }
    // API/static/other paths → pass through
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
