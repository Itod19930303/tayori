// アルバム一覧のグリッド/空状態/ローディングを描画する organism（基本設計書 4.4）。
// props（albums / loading）のみで完結し、Firestore/Storage へ直接アクセスしない
// （データ取得は useAlbums / page 層の責務、atomic-design.md）。
import type { Album } from '@/types'
import { AlbumCard } from '@/components/molecules/AlbumCard'
import { Button } from '@/components/atoms/button'

export interface AlbumGridProps {
  albums: Album[]
  loading: boolean
  onCreateClick: () => void
}

export function AlbumGrid({ albums, loading, onCreateClick }: AlbumGridProps) {
  // データ未確定（loading）中は空状態ではなくローディングを表示し、
  // 一瞬「まだアルバムがありません」が誤表示されるのを防ぐ。
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-stack-lg">
        <span
          role="status"
          aria-label="読み込み中"
          className="size-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary"
        />
      </div>
    )
  }

  // 0件時は空状態UIと作成を促すCTAを表示する（基本設計書 4.4 空状態）。
  // ヘッダーにも同じ「新しいアルバム」ボタンがあるが、空状態はユーザーの視線が
  // 集まる位置のため、その場で行動できるようボタンをもう一つ置く（UX観点の追加対応）。
  if (albums.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-stack-md py-stack-lg text-center">
        <p className="font-headline-md text-headline-md text-on-surface">
          まだアルバムがありません
        </p>
        <p className="font-body-md text-body-md text-on-surface-variant">
          「新しいアルバム」から最初のアルバムを作成しましょう。
        </p>
        <Button
          type="button"
          onClick={onCreateClick}
          className="h-12 rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
        >
          アルバムを作成
        </Button>
      </div>
    )
  }

  return (
    <div
      data-testid="album-grid"
      className="grid grid-cols-1 gap-gutter sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      {albums.map((album) => (
        <AlbumCard key={album.albumId} album={album} />
      ))}
    </div>
  )
}
