'use client'

// アルバム作成ページ（pages 層、基本設計書 4.5 / 6.2 / 8.1 #6）。useAuth でガードし、
// AlbumCreateForm の onSubmit で createAlbum を呼ぶ。成功時は作成したアルバムへ
// router.push（作成後は履歴に残してよいためログイン系の replace とは別方針）、
// 失敗時はエラーメッセージを表示する。フォーム状態管理・遷移はこの層に集約する。
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useLogout } from '@/hooks/useLogout'
import { createAlbum, type CreateAlbumInput } from '@/lib/firestoreAlbum'
import { NewAlbumTemplate } from '@/components/templates/NewAlbumTemplate'
import { TopHeader } from '@/components/organisms/TopHeader'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// 認証確認中のフルスクリーンスピナー（ちらつき防止、基本設計書 7.4）。
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

export default function NewAlbumPage() {
  const { currentUser, loading } = useAuth()
  const { handleLogout, logoutError } = useLogout()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 未ログインなら /login へ誘導し、returnUrl に作成画面パスを保持する（基本設計書 7.4）。
  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace(`/login?returnUrl=${encodeURIComponent('/albums/new')}`)
    }
  }, [loading, currentUser, router])

  // フォーム送信。二重送信を防ぎつつ createAlbum を実行し、成功時は作成アルバムへ push、
  // 失敗時はメッセージを表示して再送信可能に戻す（設計書 6.2 手順5/6）。
  const handleSubmit = async (values: CreateAlbumInput) => {
    if (!currentUser || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const albumId = await createAlbum(values, currentUser)
      router.push(`/albums/${albumId}`)
    } catch (err) {
      // 利用者へは共通メッセージのみ表示し、実際の原因（Security Rules拒否等）は
      // コンソールで切り分けられるようにログへ残す。
      console.error('アルバム作成に失敗しました', err)
      setError(ERROR_MESSAGES.SAVE_FAILED)
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (!currentUser) {
    return null
  }

  // TopHeader を最上部の共通バーとして配置し、既存の作成フォームはその下段に維持する（設計書 4.10）。
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <TopHeader currentUser={currentUser} onLogoutClick={handleLogout} />
      {logoutError && (
        <p
          role="alert"
          aria-live="assertive"
          className="bg-error-container px-margin-mobile py-stack-sm text-center font-body-md text-body-md text-error md:px-margin-desktop"
        >
          {logoutError}
        </p>
      )}
      <NewAlbumTemplate
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
        onCancel={() => router.push('/')}
      />
    </div>
  )
}
