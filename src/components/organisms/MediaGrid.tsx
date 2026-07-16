// メディアのグリッド/空状態/ローディングを描画する organism（基本設計書 4.6）。
// props（mediaItems / loading）のみで完結し、Firestore/Storage へ直接アクセスしない
// （データ取得は useMediaList / page 層の責務、atomic-design.md）。
import type { Media } from '@/types'
import { MediaCell } from '@/components/molecules/MediaCell'
import { Button } from '@/components/atoms/button'

export interface MediaGridProps {
  mediaItems: Media[]
  loading: boolean
  onSelect?: (media: Media) => void
  // 空状態の「写真・動画を追加」CTA 押下時のハンドラ（遷移は page 層の責務）。任意。
  onAddClick?: () => void
}

export function MediaGrid({
  mediaItems,
  loading,
  onSelect,
  onAddClick,
}: MediaGridProps) {
  // データ未確定（loading）中は空状態ではなくローディングを表示し、
  // 一瞬「メディアがありません」相当が誤表示されるのを防ぐ。
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

  // 0件時は空状態UI（基本設計書 4.6 layouts/3 のデザイン・文言）を表示する。
  if (mediaItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-stack-md py-stack-lg text-center">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">
          家族の絆を未来へ
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          全ての写真には、語られるべき物語があります。
        </p>
        {/* カメラアイコン（破線円） */}
        <span
          className="flex size-32 items-center justify-center rounded-full border-2 border-dashed border-outline-variant"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-4xl text-outline-variant">
            photo_camera
          </span>
        </span>
        <Button
          type="button"
          onClick={onAddClick}
          className="h-12 rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
        >
          写真・動画を追加
        </Button>
      </div>
    )
  }

  return (
    <div
      data-testid="media-grid"
      className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
    >
      {mediaItems.map((media) => (
        <MediaCell key={media.mediaId} media={media} onSelect={onSelect} />
      ))}
    </div>
  )
}
