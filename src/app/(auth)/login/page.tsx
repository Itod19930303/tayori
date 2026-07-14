'use client'

// ログインページ（pages 層）。認証状態の取得・ログイン処理の実行・エラー変換を担い、
// 表示は LoginTemplate へ委譲する（基本設計書 4.3 / 6.1 / 7.4）。
// ログイン済みユーザーは returnUrl（なければ /）へリダイレクトし、/login のUIは見せない。
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signInWithGoogle, getAuthErrorMessage } from '@/lib/auth'
import { LoginTemplate } from '@/components/templates/LoginTemplate'

// 認証状態確定前・Suspense 待機中に共通で用いるフルスクリーンのスピナー表示。
// ちらつき防止のためログイン UI と同じ背景色で全画面を覆う（基本設計書 7.4）。
function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
      <span
        role="status"
        aria-label="読み込み中"
        className="size-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary"
      />
    </div>
  )
}

// useSearchParams() は CSR bailout を伴うため、Next.js の要求どおり Suspense 境界の内側で
// 呼び出す必要がある。ページ本体を子コンポーネントへ分離し、default export 側で Suspense ラップする
// ことで /login のプリレンダリング（build）が失敗しないようにする（Next.js 公式パターン）。
function LoginPageContent() {
  const { currentUser, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 遷移先。共有リンク経由の場合は returnUrl を優先し、なければホームへ（基本設計書 7.4）。
  const returnUrl = searchParams.get('returnUrl') || '/'

  // 認証状態が確定し（loading=false）かつログイン済みなら遷移する。
  // ログイン成功時は onAuthStateChanged 経由で currentUser が更新され、この effect が発火する。
  // replace を用いてブラウザ履歴に /login を残さない（戻る操作でログイン画面に戻らない）。
  useEffect(() => {
    if (!loading && currentUser) {
      router.replace(returnUrl)
    }
  }, [loading, currentUser, returnUrl, router])

  // ログイン実行。処理中は isLoading で二重送信を防ぎ、失敗時はコードをメッセージへ変換して表示する。
  const handleSignIn = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
      // 成功時は currentUser 更新→上記 effect でリダイレクトするため、ここでは何もしない
    } catch (e) {
      const code = (e as { code?: string })?.code ?? ''
      setError(getAuthErrorMessage(code))
      setIsLoading(false)
    }
  }

  // 認証状態確定前はちらつき防止のためスピナーを表示する（基本設計書 7.4）。
  if (loading) {
    return <LoadingScreen />
  }

  // ログイン済みならリダイレクト中のため UI を描画しない。
  if (currentUser) {
    return null
  }

  return (
    <LoginTemplate onSignIn={handleSignIn} isLoading={isLoading} error={error} />
  )
}

// pages 層のエントリポイント。useSearchParams() を使う本体を Suspense で包み、
// ビルド時プリレンダリングでの suspense boundary 欠如エラーを回避する。
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginPageContent />
    </Suspense>
  )
}
