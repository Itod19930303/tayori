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
  // getRedirectResult の処理中フラグ。true の間は下部の遷移 effect を止める。
  // onAuthStateChanged はリダイレクト復帰の認証状態を getRedirectResult の解決前に
  // 検知しうるため、これが無いと currentUser 確定が先行し、復元前の returnUrl（既定 /）へ
  // 誤って遷移してしまう。マウント時は true とし、getRedirectResult 完了（成功・失敗問わず）で
  // false へ戻すことで、returnUrl 復元後にのみ正しい宛先へ遷移させる（レースコンディション対策）。
  const [isProcessingRedirectResult, setIsProcessingRedirectResult] =
    useState(true)

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
        // 原因調査用に生のエラーをコンソールへ残す（表示文言は変えない）。
        console.error('getRedirectResult に失敗しました', e)
        const code = (e as { code?: string })?.code ?? ''
        const message = getAuthErrorMessage(code)
        // 暫定: モバイル実機での原因調査のため、画面上にもエラーコードを併記する。
        // message が空（＝非表示仕様）の場合は従来どおり何も出さない。原因特定後に削除すること。
        setError(message ? `${message}（${code}）` : message)
      })
      .finally(() => {
        if (!active) return
        // キーが次回ログインへ誤って引き継がれないよう、いずれの結果でも後始末する。
        sessionStorage.removeItem(RETURN_URL_STORAGE_KEY)
        // 復元・後始末が済んだ時点で処理中フラグを下ろし、遷移 effect の発火を許可する。
        // then/catch より後に実行されるため、成功時は redirectReturnUrl 反映後に解放される。
        setIsProcessingRedirectResult(false)
      })
    return () => {
      active = false
    }
  }, [])

  // 認証状態が確定し（loading=false）かつログイン済みなら遷移する。
  // ログイン成功時は onAuthStateChanged 経由で currentUser が更新され、この effect が発火する。
  // replace を用いてブラウザ履歴に /login を残さない（戻る操作でログイン画面に戻らない）。
  // getRedirectResult の処理中（isProcessingRedirectResult）は遷移を保留する。
  // これにより currentUser が先に確定しても、returnUrl の復元完了を待ってから
  // 正しい destination へ一度だけ遷移する（レースコンディション対策・基本設計書 6.1.1(4)）。
  useEffect(() => {
    if (!loading && currentUser && !isProcessingRedirectResult) {
      router.replace(destination)
    }
  }, [loading, currentUser, destination, router, isProcessingRedirectResult])

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
      // 原因調査用に生のエラーをコンソールへ残す（表示文言は変えない）。
      console.error('Googleログインに失敗しました', e)
      const code = (e as { code?: string })?.code ?? ''
      const message = getAuthErrorMessage(code)
      // 暫定: モバイル実機での原因調査のため、画面上にもエラーコードを併記する。
      // popup-closed-by-user 等、message が空（＝非表示仕様）の場合は従来どおり何も出さない。
      // 原因特定後に削除すること。
      setError(message ? `${message}（${code}）` : message)
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
