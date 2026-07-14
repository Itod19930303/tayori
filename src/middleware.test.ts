import { describe, it, expect, vi, beforeEach } from 'vitest'

// middleware は MVP 期間中 pass-through（NextResponse.next() のみ）。
// 認証判定は Client-side（useAuth）の責務であり、middleware はどのパスでもブロック/リダイレクトしないことを検証する。

const next = vi.fn(() => ({ type: 'next-response' }))
const redirect = vi.fn()

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => next(),
    redirect: (...args: unknown[]) => redirect(...args),
  },
}))

import { middleware } from './middleware'
import type { NextRequest } from 'next/server'

const makeRequest = (pathname: string) =>
  ({ nextUrl: { pathname } }) as unknown as NextRequest

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('MW-01: 任意のパスで NextResponse.next() を返しリダイレクトしない', () => {
    const result = middleware(makeRequest('/'))
    expect(next).toHaveBeenCalledTimes(1)
    expect(redirect).not.toHaveBeenCalled()
    expect(result).toEqual({ type: 'next-response' })
  })

  it('MW-02: /login など公開パスでも pass-through する', () => {
    middleware(makeRequest('/login'))
    expect(next).toHaveBeenCalledTimes(1)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('MW-03: protected route でもブロックしない', () => {
    middleware(makeRequest('/albums/abc123'))
    expect(next).toHaveBeenCalledTimes(1)
    expect(redirect).not.toHaveBeenCalled()
  })
})
