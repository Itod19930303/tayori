// グリッド1セルを描画する molecule（基本設計書 4.6）。画像は <img> でサムネイルを、
// 動画はサムネイル上に再生アイコンをオーバーレイ表示する（contentType で判定）。
// Atomic Design のルールに従い props（media）のみで完結させ、Firestore/Storage へ
// 直接アクセスしない。クリック時の遷移は onSelect（props）経由で page 層へ委ねる。
import type { Media } from '@/types'

export interface MediaCellProps {
  media: Media
  onSelect?: (media: Media) => void
}

export function MediaCell({ media, onSelect }: MediaCellProps) {
  const isVideo = media.contentType.startsWith('video/')
  // サムネイルがあれば優先し、無ければ実体URLを表示する（動画は MVP 期間 thumbnailUrl=null）。
  const src = media.thumbnailUrl || media.downloadUrl

  return (
    <button
      type="button"
      onClick={() => onSelect?.(media)}
      className="relative aspect-square cursor-pointer overflow-hidden rounded-xl transition-opacity hover:opacity-90"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Storage 署名付きURLを直接表示するため next/image を使わない（provider 移行時は getPreviewUrl 側で吸収） */}
      <img
        src={src}
        alt={media.fileName}
        className="h-full w-full object-cover"
      />
      {/* 動画は再生可能であることを示す再生アイコンを中央にオーバーレイする（設計書4.6） */}
      {isVideo && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-4xl text-white drop-shadow-lg"
            aria-hidden="true"
          >
            play_circle
          </span>
        </span>
      )}
    </button>
  )
}
