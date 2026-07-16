// UploadItem を並べ、全体進捗（完了数/総数）を表示する organism（基本設計書 4.7）。
// props（uploads / onRetry）のみで完結し、Storage へ直接アクセスしない
// （アップロード実処理は page 層 uploadFile 経由、atomic-design.md）。
import { UploadItem, type UploadItemState } from '@/components/molecules/UploadItem'

export interface UploadListProps {
  uploads: UploadItemState[]
  onRetry?: (mediaId: string) => void
}

export function UploadList({ uploads, onRetry }: UploadListProps) {
  const total = uploads.length
  const done = uploads.filter((u) => u.status === 'done').length

  return (
    <div className="flex flex-col gap-stack-md">
      {/* 全体進捗（完了数/総数）。対象が無いときは表示しない。 */}
      {total > 0 && (
        <p className="font-label-md text-label-md text-on-surface-variant">
          {total}個中{done}個完了
        </p>
      )}

      <div className="flex flex-col gap-stack-sm">
        {uploads.map((upload) => (
          <UploadItem
            key={upload.mediaId}
            upload={upload}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  )
}
