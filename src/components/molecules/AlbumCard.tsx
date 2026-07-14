// アルバム1件を表示する molecule（基本設計書 4.4）。表紙画像（無ければプレースホルダー）・
// アルバム名・更新日時・メンバー数バッジを描画する。Atomic Design のルールに従い
// props（album）のみで完結させ、Firestore/Storage へ直接アクセスしない。
import type { Album } from '@/types'

export interface AlbumCardProps {
  album: Album
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

export function AlbumCard({ album }: AlbumCardProps) {
  const updatedLabel = formatUpdatedAt(album)
  const memberCount = album.members?.length ?? 0

  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-lowest custom-shadow">
      {/* 表紙: coverImageUrl があれば画像、無ければプレースホルダー領域を表示する */}
      {album.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Storage 署名付きURLを直接表示するため next/image を使わない（provider 移行時は getPreviewUrl 側で吸収）
        <img
          src={album.coverImageUrl}
          alt={`${album.title} の表紙`}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div
          data-testid="album-cover-placeholder"
          className="flex aspect-video w-full items-center justify-center bg-surface-container"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-outline-variant">
            photo_album
          </span>
        </div>
      )}

      <div className="flex flex-col gap-stack-sm p-stack-md">
        <h3 className="font-headline-md text-headline-md text-on-surface">
          {album.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-caption text-caption text-on-surface-variant">
            {updatedLabel}
          </span>
          {/* メンバー数バッジ（chip） */}
          <span className="inline-flex items-center gap-stack-sm rounded-full bg-surface-container px-3 py-1 font-caption text-caption text-on-surface-variant">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              group
            </span>
            {memberCount}
          </span>
        </div>
      </div>
    </div>
  )
}
