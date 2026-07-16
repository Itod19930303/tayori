// アップロード進捗行を描画する molecule（基本設計書 4.7）。
// waiting/uploading/done/error/retrying の5状態に応じてアイコン・進捗・メッセージを
// 切り替える。error 状態のみ行クリックで再試行できる（onRetry）。
// Atomic Design のルールに従い props のみで完結し、Storage へ直接アクセスしない。
import { cn } from '@/lib/utils'

// アップロード状態（基本設計書 4.7 の5状態）。
export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error' | 'retrying'

// アップロード対象1件の状態。page 層がファイルごとに保持し、進捗に応じて更新する。
export interface UploadItemState {
  file: File
  mediaId: string
  status: UploadStatus
  progress: number
  errorMessage?: string
}

export interface UploadItemProps {
  upload: UploadItemState
  onRetry?: (mediaId: string) => void
}

// バイト数を利用者に読みやすい単位へ整形する（待機中のサイズ表示に用いる）。
function formatSize(bytes: number): string {
  const MB = 1024 * 1024
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

export function UploadItem({ upload, onRetry }: UploadItemProps) {
  const { file, mediaId, status, progress, errorMessage } = upload
  const isError = status === 'error'
  // retrying は uploading と同じ進捗UIを表示する（設計書4.7 状態5）。
  const isProgressing = status === 'uploading' || status === 'retrying'

  // 誤再試行防止のため、再試行導線は error 状態のときのみ有効にする（設計書6.3 再試行処理）。
  const handleClick = () => {
    if (isError) onRetry?.(mediaId)
  }

  return (
    <div
      role={isError ? 'button' : undefined}
      onClick={isError ? handleClick : undefined}
      className={cn(
        'flex items-center gap-stack-md rounded-lg p-stack-md',
        isError && 'cursor-pointer bg-error-container'
      )}
    >
      {/* 状態アイコン（Material Symbols）。装飾のため aria-hidden とし、状態は隣接テキストで伝える。 */}
      <span
        className={cn(
          'material-symbols-outlined',
          status === 'done' && 'text-primary',
          isError && 'text-error',
          (status === 'waiting' || isProgressing) && 'text-on-surface-variant'
        )}
        aria-hidden="true"
      >
        {status === 'done'
          ? 'check_circle'
          : isError
            ? 'warning'
            : 'progress_activity'}
      </span>

      <div className="flex flex-1 flex-col gap-stack-sm">
        <span className="font-body-md text-body-md text-on-surface">
          {file.name}
        </span>

        {status === 'waiting' && (
          <span className="font-caption text-caption text-on-surface-variant">
            {formatSize(file.size)}
          </span>
        )}

        {isProgressing && (
          <span className="font-caption text-caption text-on-surface-variant">
            {Math.round(progress)}%
          </span>
        )}

        {status === 'done' && (
          <span className="font-caption text-caption text-on-surface-variant">
            保存済み
          </span>
        )}

        {isError && (
          <span className="font-caption text-caption text-error">
            {errorMessage} タップして再試行
          </span>
        )}
      </div>
    </div>
  )
}
