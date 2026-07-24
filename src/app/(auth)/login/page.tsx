'use client'

// ログインページ（pages 層）。認証状態の取得・ログイン処理の実行・エラー変換を担い、
// 表示は LoginTemplate へ委譲する（基本設計書 4.3 / 6.1 / 7.4）。
// ログイン済みユーザーは returnUrl（なければ /）へリダイレクトし、/login のUIは見せない。
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getRedirectResult } from 'firebase/auth'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'
import { signInWithGoogle, getAuthErrorMessage } from '@/lib/auth'
import { isMobileDevice } from '@/lib/device'
import { LoginTemplate } from '@/components/templates/LoginTemplate'

// モバイルのリダイレクトログインでは URL クエリ（?returnUrl=...）が復帰後に失われるため、
// 遷移前に returnUrl を sessionStorage へ退避し、復帰後に読み戻す。プロジェクト固有
// プレフィックス tayori: を付与し、他アプリ・他機能との衝突を避ける（基本設計書 6.1.1(3)）。
const RETURN_URL_STORAGE_KEY = 'tayori:returnUrl'

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
  // リダイレクトログイン復帰時に sessionStorage から復元した returnUrl を保持する。
  // 遷移そのものは既存 effect に一本化するため、ここでは遷移先の「値」だけを反映する
  // （getRedirectResult の effect から router.replace を直接呼ばず二重遷移を防ぐ・基本設計書 6.1.1(4)）。
  const [redirectReturnUrl, setRedirectReturnUrl] = useState<string | null>(null)

  // 遷移先。共有リンク経由の場合は returnUrl を優先し、なければホームへ（基本設計書 7.4）。
  const returnUrl = searchParams.get('returnUrl') || '/'
  // リダイレクト復帰時は URL クエリが失われているため、復元済みの値を優先する。
  const destination = redirectReturnUrl ?? returnUrl

  // マウント時に一度だけ getRedirectResult を呼び、モバイルのリダイレクトログイン復帰を処理する。
  // 遷移は既存の onAuthStateChanged ベース effect に委ね、ここでは returnUrl の復元と
  // sessionStorage の後始末（成功・null・失敗いずれも削除）のみを担う（基本設計書 6.1.1(4)）。
  useEffect(() => {
    let active = true
    getRedirectResult(auth)
      .then((result) => {
        if (!active) return
        // 非 null はリダイレクトログイン成功。退避した returnUrl を復元（無ければ / へ）。
        if (result) {
          const saved = sessionStorage.getItem(RETURN_URL_STORAGE_KEY)
          setRedirectReturnUrl(saved || '/')
        }
        // null はリダイレクト由来でない通常表示。従来どおり何もしない（回帰維持）。
      })
      .catch((e) => {
        if (!active) return
        // リダイレクト固有コードも既存 default（AUTH_SIGNIN_FAILED）へ集約する（8.3 不変更）。
        const code = (e as { code?: string })?.code ?? ''
        setError(getAuthErrorMessage(code))
      })
      .finally(() => {
        // キーが次回ログインへ誤って引き継がれないよう、いずれの結果でも後始末する。
        sessionStorage.removeItem(RETURN_URL_STORAGE_KEY)
      })
    return () => {
      active = false
    }
  }, [])

  // 認証状態が確定し（loading=false）かつログイン済みなら遷移する。
  // ログイン成功時は onAuthStateChanged 経由で currentUser が更新され、この effect が発火する。
  // replace を用いてブラウザ履歴に /login を残さない（戻る操作でログイン画面に戻らない）。
  useEffect(() => {
    if (!loading && currentUser) {
      router.replace(destination)
    }
  }, [loading, currentUser, destination, router])

  // ログイン実行。処理中は isLoading で二重送信を防ぎ、失敗時はコードをメッセージへ変換して表示する。
  const handleSignIn = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      // モバイルはリダイレクトで遷移し URL クエリが失われるため、redirect 実行直前に
      // returnUrl を sessionStorage へ退避する（PC はポップアップで遷移しないため不要）。
      if (isMobileDevice()) {
        sessionStorage.setItem(RETURN_URL_STORAGE_KEY, returnUrl)
      }
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
