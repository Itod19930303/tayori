'use client'

// アルバム詳細ページ（pages 層、基本設計書 4.6 / 6.4 / 7.4 / 8.1 #7）。
// useAuth でガードし、useAlbum で存在確認・メンバー判定、useMediaList でメディア取得して
// AlbumDetailTemplate へ委譲する。非メンバーは403相当、存在しないアルバムは404相当を表示する。
// データ取得はフックに集約し、templates 以下は props のみで完結させる（atomic-design.md）。
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAlbum } from '@/hooks/useAlbum'
import { useMediaList } from '@/hooks/useMediaList'
import { useAcceptInvite } from '@/hooks/useAcceptInvite'
import { AlbumDetailTemplate } from '@/components/templates/AlbumDetailTemplate'

// 非メンバーアクセス時のメッセージ（基本設計書 8.1 #7）。
const FORBIDDEN_MESSAGE =
  'このアルバムへのアクセス権がありません。管理者に招待を依頼してください。'

// 認証・データ確認中のフルスクリーンスピナー（ちらつき防止、基本設計書 7.4）。
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

// 403/404 相当の中央メッセージ表示（専用ページの簡易版）。
function NoticeScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-margin-mobile text-center">
      <p className="font-body-md text-body-md text-on-surface-variant">
        {message}
      </p>
    </div>
  )
}

export default function AlbumDetailPage() {
  const params = useParams()
  const albumId = params.albumId as string
  const { currentUser, loading: authLoading } = useAuth()
  const { album, loading: albumLoading, notFound } = useAlbum(albumId)
  const { mediaItems, loading: mediaLoading } = useMediaList(albumId)
  const router = useRouter()

  // 403判定の「前」に受諾処理を実行し、招待済みだが未受諾のユーザーを初回アクセスで
  // 自動的にメンバー化する（基本設計書 6.7）。受諾の成否は useAlbum の再購読へ反映される。
  // 受諾失敗は握りつぶされ、通常の権限判定（403/表示）を妨げない。
  useAcceptInvite(albumId)

  // 認証確定後に未ログインなら /login へ誘導し、returnUrl に現在パスを保持する（基本設計書 7.4）。
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace(`/login?returnUrl=${encodeURIComponent(`/albums/${albumId}`)}`)
    }
  }, [authLoading, currentUser, router, albumId])

  // 認証・アルバム読み込み中はちらつき・誤判定防止のためスピナーを表示する。
  if (authLoading || albumLoading) {
    return <LoadingScreen />
  }

  // 未ログインならリダイレクト中のため UI を描画しない。
  if (!currentUser) {
    return null
  }

  // 存在しないアルバムは404相当を表示する（notFound と権限エラーを区別）。
  if (notFound || !album) {
    return <NoticeScreen message="アルバムが見つかりません。" />
  }

  // 非メンバーは403相当を表示する（memberUids で判定、設計書7.1 isAlbumMember と一致）。
  if (!album.memberUids?.includes(currentUser.uid)) {
    return <NoticeScreen message={FORBIDDEN_MESSAGE} />
  }

  return (
    <AlbumDetailTemplate
      album={album}
      mediaItems={mediaItems}
      loading={mediaLoading}
      onUploadClick={() => router.push(`/albums/${albumId}/upload`)}
      onSelectMedia={(media) =>
        router.push(`/albums/${albumId}/media/${media.mediaId}`)
      }
    />
  )
}
