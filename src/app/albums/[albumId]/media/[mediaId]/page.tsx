'use client'

// メディアプレビュー単体画面（pages 層 / MediaPreviewPage、基本設計書 4.9 / 4.6 / 5.1 / 7.3 / 8.1 #7）。
// 既知の404不具合（ページ未実装によりプレビューURLへ直接アクセスすると全面404になる問題）を解消するために新設する。
// useAuth でガードし、親アルバムの memberUids でアクセス権を判定（非メンバーは403相当）、
// useMedia で対象 mediaId の存在を確認（不在は404相当）し、media.contentType で画像/動画を分岐表示する。
// 表示URLの生成は getPreviewUrl（@/lib/mediaUrl）へ集約し、将来の provider 移行時も本画面を触らない。
// データ取得はフック（useAuth/useAlbum/useMedia）に集約し、UI は props/取得値で完結させる（atomic-design.md）。
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAlbum } from '@/hooks/useAlbum'
import { useMedia } from '@/hooks/useMedia'
import { useLogout } from '@/hooks/useLogout'
import { getPreviewUrl } from '@/lib/mediaUrl'
import { AuthedShell } from '@/components/organisms/AuthedShell'
import { NoticeScreen } from '@/components/molecules/NoticeScreen'
import type { Media } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// 認証・データ確認中のフルスクリーンスピナー（ちらつき・誤判定防止、基本設計書 7.4）。
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

// 投稿日時を利用者向けの日付文字列へ整形する（AlbumDetailTemplate と同方針で toMillis を基準にする）。
function formatCreatedAt(media: Media): string {
  const millis = media.createdAt?.toMillis?.() ?? 0
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(millis))
}

// 左ペインのメディア表示。contentType を判定基準に画像/動画/フォールバックを切り替える（基本設計書 4.9）。
// 画像は object-contain で全体を収め、動画はブラウザネイティブUI（controls）+ preload="metadata" とする。
// 想定外 contentType（image/*・video/* 以外）は再生・表示を試みず、ダウンロード導線に委ねるフォールバックにする。
function MediaViewer({ media }: { media: Media }) {
  const src = getPreviewUrl(media)
  const isImage = media.contentType.startsWith('image/')
  const isVideo = media.contentType.startsWith('video/')

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Storage 署名付きURLを直接表示するため next/image を使わない（provider 移行時は getPreviewUrl 側で吸収）
      <img
        src={src}
        alt={media.fileName}
        className="max-h-full max-w-full object-contain"
      />
    )
  }

  if (isVideo) {
    return (
      // controls でネイティブ再生UIを用い、preload="metadata" で初期通信量を抑える（基本設計書 4.9）。
      <video
        src={src}
        controls
        preload="metadata"
        className="max-h-full max-w-full object-contain"
      >
        {/* 動画非対応環境向けの代替テキスト。字幕トラックは MVP 対象外。 */}
        {ERROR_MESSAGES.VIDEO_NOT_SUPPORTED}
      </video>
    )
  }

  // 想定外 contentType。画面を壊さず、右パネルのダウンロードリンクを主導線とするフォールバック表示。
  return (
    <div className="flex flex-col items-center gap-stack-md text-center text-on-surface-variant">
      <span className="material-symbols-outlined text-6xl" aria-hidden="true">
        draft
      </span>
      <p className="font-body-md text-body-md">
        {ERROR_MESSAGES.MEDIA_PREVIEW_UNSUPPORTED}
      </p>
    </div>
  )
}

export default function MediaPreviewPage() {
  const params = useParams()
  const albumId = params.albumId as string
  const mediaId = params.mediaId as string
  const { currentUser, loading: authLoading } = useAuth()
  const { album, loading: albumLoading, notFound: albumNotFound } = useAlbum(albumId)
  const { media, loading: mediaLoading, notFound: mediaNotFound } = useMedia(
    albumId,
    mediaId
  )
  const { handleLogout, logoutError } = useLogout()
  const router = useRouter()

  // 認証確定後に未ログインなら /login へ誘導し、returnUrl に現在のプレビューパスを保持する（基本設計書 7.4）。
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace(
        `/login?returnUrl=${encodeURIComponent(
          `/albums/${albumId}/media/${mediaId}`
        )}`
      )
    }
  }, [authLoading, currentUser, router, albumId, mediaId])

  // 認証・アルバム・メディアいずれかの読み込み中はちらつき・誤判定防止のためスピナーを表示する。
  if (authLoading || albumLoading || mediaLoading) {
    return <LoadingScreen />
  }

  // 未ログインならリダイレクト中のため UI を描画しない。
  if (!currentUser) {
    return null
  }

  // 以降のエラー通知（403/404）も AuthedShell 内で表示し、ログイン済みユーザーが
  // アクセスできない場合でも共通ヘッダー（ログアウト導線）を維持する（CodeRabbit Major指摘）。
  // 親アルバムが存在しない場合は404相当を表示する。
  if (albumNotFound || !album) {
    return (
      <AuthedShell
        currentUser={currentUser}
        onHomeClick={() => router.push('/')}
        onLogoutClick={handleLogout}
        logoutError={logoutError}
      >
        <NoticeScreen message={ERROR_MESSAGES.ALBUM_NOT_FOUND} />
      </AuthedShell>
    )
  }

  // 非メンバーは403相当を表示する（memberUids で判定、アルバム詳細と統一。設計書4.9 アクセス条件）。
  if (!album.memberUids?.includes(currentUser.uid)) {
    return (
      <AuthedShell
        currentUser={currentUser}
        onHomeClick={() => router.push('/')}
        onLogoutClick={handleLogout}
        logoutError={logoutError}
      >
        <NoticeScreen message={ERROR_MESSAGES.FORBIDDEN} />
      </AuthedShell>
    )
  }

  // 対象メディアが存在しない場合は404相当を表示する（403文言とは区別する）。
  if (mediaNotFound || !media) {
    return (
      <AuthedShell
        currentUser={currentUser}
        onHomeClick={() => router.push('/')}
        onLogoutClick={handleLogout}
        logoutError={logoutError}
      >
        <NoticeScreen message={ERROR_MESSAGES.MEDIA_NOT_FOUND} />
      </AuthedShell>
    )
  }

  const uploaderInitial = media.uploaderName?.charAt(0) ?? '?'

  // TopHeader を最上部の共通バーとして配置し、既存のプレビュー2ペインレイアウトはその下段に維持する（設計書 4.10）。
  return (
    <AuthedShell
      currentUser={currentUser}
      onHomeClick={() => router.push('/')}
      onLogoutClick={handleLogout}
      logoutError={logoutError}
    >
      <div className="flex flex-1 flex-col bg-background md:flex-row">
      {/* 左ペイン: メディア表示（前後ナビゲーションは含めない。設計書4.9） */}
      <div className="flex flex-1 items-center justify-center bg-surface-variant p-margin-mobile md:p-margin-desktop">
        <MediaViewer media={media} />
      </div>

      {/* 右サイドパネル（PC）/ 下部パネル（モバイル）: 投稿者・ファイル名・投稿日時・ダウンロード */}
      <aside className="flex w-full flex-col gap-stack-lg border-t border-outline-variant bg-background p-margin-mobile md:w-80 md:border-l md:border-t-0 md:p-margin-desktop">
        <div className="flex items-center gap-stack-md">
          {/* 投稿者アバター: 表示名の頭文字を用いる（<img> を使わないことで動画時の img 誤検出も避ける） */}
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-primary font-label-md text-label-md text-on-primary"
          >
            {uploaderInitial}
          </span>
          <span className="font-body-md text-body-md text-on-surface">
            {media.uploaderName}
          </span>
        </div>

        <div className="flex flex-col gap-stack-sm">
          <p className="font-body-md text-body-md text-on-surface">
            {media.fileName}
          </p>
          <p className="font-caption text-caption text-on-surface-variant">
            {formatCreatedAt(media)}
          </p>
        </div>

        {/* ダウンロードリンク: Storage の downloadUrl を直接指し、download 属性で保存を促す（設計書4.9）。
            preventDefault せずブラウザ既定のダウンロード挙動を妨げない。 */}
        <a
          href={media.downloadUrl}
          download
          className="inline-flex h-12 items-center justify-center gap-stack-sm rounded-lg bg-primary px-6 font-label-md text-label-md text-on-primary hover:opacity-90"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            download
          </span>
          ダウンロード
        </a>
      </aside>
      </div>
    </AuthedShell>
  )
}
