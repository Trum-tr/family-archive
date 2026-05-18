import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = '100674'
const COOKIE_NAME = 'site_auth'
const COOKIE_VALUE = 'ok_100674'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (password === PASSWORD) {
    const response = NextResponse.json({ ok: true })
    response.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90, // 90 дней
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
}
