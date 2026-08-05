// アルバム1件を表示する molecule（基本設計書 4.4 / 4.4.1）。表紙画像（無ければプレースホルダー）・
// アルバム名・更新日時・メンバー数バッジを描画する。Atomic Design のルールに従い
// props（album）のみで完結させ、Firestore/Storage・router へ直接アクセスしない。
// カード全体を <button> にしてクリック可能にし、押下時は onSelect（props）経由で
// page 層へ選択を通知する（遷移という副作用は page 層に閉じ込める＝MediaCell の onSelect パターン踏襲）。
import type { Album } from '@/types'

export interface AlbumCardProps {
  album: Album
  // カード押下時に自身の album を引数に呼ぶ。任意（未指定時は押下しても何もしない）。
  // 遷移先の解決・権限判定は page 層の責務とし、本コンポーネントは選択の通知のみを行う。
  onSelect?: (album: Album) => void
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

export function AlbumCard({ album, onSelect }: AlbumCardProps) {
  const updatedLabel = formatUpdatedAt(album)
  const memberCount = album.members?.length ?? 0

  return (
    // ルートを <button> にしてカード全体を1つのクリック領域にする（設計書4.4.1）。
    // ネイティブのボタンセマンティクス（フォーカス・Enter/Space 発火・読み上げ）を利用するため
    // role="button" は明示しない。text-left/w-full でブラウザ既定の中央寄せを打ち消し左揃えを維持する。
    // onSelect?.(album) のオプショナルチェーンで未接続時も例外を投げない。
    <button
      type="button"
      onClick={() => onSelect?.(album)}
      className="w-full cursor-pointer overflow-hidden rounded-xl bg-surface-container-lowest text-left custom-shadow transition-opacity hover:opacity-90"
    >
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
    </button>
  )
}
