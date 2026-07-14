// 認証ガードのミドルウェア。MVP 期間は Client-side Firebase Auth のみを採用するため、
// ここでは一切ブロック/リダイレクトせず pass-through する（基本設計書 6.8）。
// 未ログイン時のリダイレクトは各ページの useAuth() 側で判定する。
// Server-side セッション管理（firebase-admin）は後回し。
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 将来のサーバーサイド判定拡張のため引数を保持
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}
