// アップロード進捗行を描画する molecule（基本設計書 4.7）。
// pending/waiting/uploading/done/error/retrying の6状態に応じてサムネイル・チェックボックス・
// 進捗・メッセージを切り替える。pending は確定前（保存ボタン押下待ち）状態で、この状態のみ
// チェックボックスとサムネイルを表示し、選択→ローカル除外の対象になる。error 状態のみ行
// クリックで再試行できる（onRetry）。Atomic Design のルールに従い props のみで完結し、
// previewUrl の生成/解放（URL.createObjectURL/revokeObjectURL）は page 層が担い、本層は
// 受け取った previewUrl を描画するだけで副作用を持たない。
import { cn } from '@/lib/utils'

// アップロード状態（基本設計書 4.7 の6状態）。pending は確定前・保存ボタン押下待ちを表し、
// waiting（保存押下後・進捗発火前）とは意味を分けて区別する。
export type UploadStatus =
  | 'pending'
  | 'waiting'
  | 'uploading'
  | 'done'
  | 'error'
  | 'retrying'

// アップロード対象1件の状態。page 層がファイルごとに保持し、進捗に応じて更新する。
// selected/previewUrl は確定前（pending）行専用で、保存後は無視される。
export interface UploadItemState {
  file: File
  mediaId: string
  status: UploadStatus
  progress: number
  errorMessage?: string
  selected?: boolean
  previewUrl?: string
}

export interface UploadItemProps {
  upload: UploadItemState
  onRetry?: (mediaId: string) => void
  onToggleSelect?: (mediaId: string) => void
  // done 行のキャプションに保存先アルバム名を添えて「どこに保存されたか」を明示する
  // （設計書4.7 成功フィードバック改善「保存済み · [アルバム名]」）。未指定時はアルバム名なしで表示する。
  albumName?: string
}

// バイト数を利用者に読みやすい単位へ整形する（待機中・確定前のサイズ表示に用いる）。
function formatSize(bytes: number): string {
  const MB = 1024 * 1024
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

// 確定前（pending）行のサムネイル。画像は previewUrl を <img> で、動画は同 previewUrl を
// 背景に再生アイコン（play_circle）を重ねて表示し、内容を保存前に確認できるようにする。
function PendingThumbnail({ file, previewUrl }: { file: File; previewUrl?: string }) {
  const isVideo = file.type.startsWith('video/')
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-container">
      {previewUrl && (
        <img
          src={previewUrl}
          alt={file.name}
          className="size-full object-cover"
        />
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-white drop-shadow-lg"
            aria-hidden="true"
          >
            play_circle
          </span>
        </div>
      )}
    </div>
  )
}

export function UploadItem({
  upload,
  onRetry,
  onToggleSelect,
  albumName,
}: UploadItemProps) {
  const { file, mediaId, status, progress, errorMessage, selected, previewUrl } =
    upload
  const isPending = status === 'pending'
  const isError = status === 'error'
  const isDone = status === 'done'
  // retrying は uploading と同じ進捗UIを表示する（設計書4.7 状態6）。
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
        isError && 'cursor-pointer bg-error-container',
        // 完了行は成功トーン背景で他状態と視覚的に対比させる（設計書4.7 成功フィードバック改善）。
        isDone && 'bg-primary-fixed'
      )}
    >
      {/* 確定前（pending）行のみ: 選択チェックボックス。保存後（waiting 以降）は表示しない。 */}
      {isPending && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={() => onToggleSelect?.(mediaId)}
          aria-label={`${file.name} を選択`}
          className="size-5 shrink-0 rounded border-outline text-primary focus:ring-primary"
        />
      )}

      {/* 確定前（pending）行のみ: サムネイル。それ以外は状態アイコンを表示する。 */}
      {isPending ? (
        <PendingThumbnail file={file} previewUrl={previewUrl} />
      ) : (
        <span
          className={cn(
            'material-symbols-outlined',
            isDone && 'text-primary',
            isError && 'text-error',
            (status === 'waiting' || isProgressing) && 'text-on-surface-variant'
          )}
          aria-hidden="true"
        >
          {isDone ? 'check_circle' : isError ? 'warning' : 'progress_activity'}
        </span>
      )}

      <div className="flex flex-1 flex-col gap-stack-sm">
        <span className="font-body-md text-body-md text-on-surface">
          {file.name}
        </span>

        {/* pending / waiting はファイルサイズを表示する。 */}
        {(isPending || status === 'waiting') && (
          <span className="font-caption text-caption text-on-surface-variant">
            {formatSize(file.size)}
          </span>
        )}

        {isProgressing && (
          <span className="font-caption text-caption text-on-surface-variant">
            {Math.round(progress)}%
          </span>
        )}

        {/* 完了行のキャプションは label-md で強調し、保存先アルバム名を添えて成功を明確に伝える
            （設計書4.7「保存済み · [アルバム名]」）。albumName 未指定時はアルバム名なしで表示する。 */}
        {isDone && (
          <span className="font-label-md text-label-md text-primary">
            {albumName ? `保存済み · ${albumName}` : '保存済み'}
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
