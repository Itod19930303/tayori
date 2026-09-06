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
  // 各 AlbumCard の onSelect へそのまま透過する（設計書4.4.1・MediaGrid の onSelect パターン踏襲）。
  // 遷移という副作用は page 層に閉じ込め、organism 層は選択の通知を中継するのみ。
  onSelect?: (album: Album) => void
}

export function AlbumGrid({ albums, loading, onCreateClick, onSelect }: AlbumGridProps) {
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
  // flex-1 でHomeTemplate内の残り空間に配置すると、その残り空間自体が「アルバム」見出し行の
  // 分だけ既に画面下寄りにズレており、その中で中央寄せしても画面全体の中央にはならない。
  // TopHeader（h-16=64px）の直下から画面下端まで（position: fixed）を基準に中央寄せすることで、
  // ページ固有見出しの高さに影響されず常に画面中央に表示する。
  if (albums.length === 0) {
    return (
      <div className="fixed inset-x-0 top-16 bottom-0 flex flex-col items-center justify-center gap-stack-md px-margin-mobile text-center md:px-margin-desktop">
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
        <AlbumCard key={album.albumId} album={album} onSelect={onSelect} />
      ))}
    </div>
  )
}
