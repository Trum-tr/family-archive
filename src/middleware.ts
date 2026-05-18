import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = 'site_auth'
const COOKIE_VALUE = 'ok_100674'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Защищаем только /dashboard
  if (pathname.startsWith('/dashboard')) {
    const auth = request.cookies.get(COOKIE_NAME)
    if (auth?.value !== COOKIE_VALUE) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
