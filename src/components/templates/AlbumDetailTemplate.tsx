// アルバム詳細画面のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー（アルバム名・メンバー数・更新日時・アップロードボタン）と MediaGrid を配置し、
// 受け取った props を透過的に渡す。データ取得・遷移は page 層の責務とする。
// 共通ナビ（SideNav 等）は本フェーズ対象外（テスト仕様書 §1.5）。
import type { Album, Media } from '@/types'
import { Button } from '@/components/atoms/button'
import { MediaGrid } from '@/components/organisms/MediaGrid'

export interface AlbumDetailTemplateProps {
  album: Album
  mediaItems: Media[]
  loading: boolean
  onUploadClick: () => void
  onSelectMedia?: (media: Media) => void
}

// Firestore Timestamp を利用者向けの日付文字列へ整形する。
// モック/本番いずれの Timestamp も toMillis() を持つため、これを基準に Date へ変換する。
function formatUpdatedAt(album: Album): string {
  const millis = album.updatedAt?.toMillis?.() ?? 0
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(millis))
}

export function AlbumDetailTemplate({
  album,
  mediaItems,
  loading,
  onUploadClick,
  onSelectMedia,
}: AlbumDetailTemplateProps) {
  const memberCount = album.members?.length ?? 0

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      <header className="flex items-start justify-between gap-stack-md">
        <div className="flex flex-col gap-stack-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {album.title}
          </h1>
          <p className="font-caption text-caption text-on-surface-variant">
            メンバー{memberCount}人 · 更新 {formatUpdatedAt(album)}
          </p>
        </div>
        <Button
          type="button"
          onClick={onUploadClick}
          className="h-12 rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
        >
          アップロード
        </Button>
      </header>

      <MediaGrid
        mediaItems={mediaItems}
        loading={loading}
        onSelect={onSelectMedia}
        onAddClick={onUploadClick}
      />
    </div>
  )
}
