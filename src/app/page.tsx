'use client'

// ホームページ（pages 層、基本設計書 4.4 / 6.8 / 7.4）。useAuth で認証状態を取得し、
// 未ログインなら /login へ replace（履歴に保護ページを残さない）、ログイン済みなら
// useAlbums の実データを HomeTemplate へ渡す。データ取得ロジックはフックに集約し、
// templates 以下は props のみで完結させる（atomic-design.md）。
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAlbums } from '@/hooks/useAlbums'
import { HomeTemplate } from '@/components/templates/HomeTemplate'

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

export default function HomePage() {
  const { currentUser, loading } = useAuth()
  const { albums, loading: albumsLoading } = useAlbums()
  const router = useRouter()

  // 認証確定後に未ログインなら /login へ誘導する。returnUrl に現在パスを保持し、
  // ログイン後に元の画面へ戻せるようにする（基本設計書 7.4）。
  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace(`/login?returnUrl=${encodeURIComponent('/')}`)
    }
  }, [loading, currentUser, router])

  // 認証確定前はちらつき防止のためスピナーを表示する。
  if (loading) {
    return <LoadingScreen />
  }

  // 未ログインならリダイレクト中のため UI を描画しない。
  if (!currentUser) {
    return null
  }

  return (
    <HomeTemplate
      albums={albums}
      loading={albumsLoading}
      onCreateClick={() => router.push('/albums/new')}
    />
  )
}
