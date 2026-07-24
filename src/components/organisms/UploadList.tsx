// UploadItem を並べ、全体進捗（完了数/総数）・選択操作バーを表示する
// organism（基本設計書 4.7）。props（uploads / onRetry / onToggleSelect / onDeleteSelected）
// のみで完結し、Storage へ直接アクセスしない（アップロード実処理・確定前削除はいずれも
// page 層の state 操作。atomic-design.md）。確定前（pending）行が選択されているときのみ
// 「選択項目を削除」バーを出す。
// v2.5: 全件完了時の完了フィードバックは UploadTemplate 配置の完了モーダル（UploadCompleteModal）へ
// 移設したため、本 organism からは完了バナー・戻る導線を持たない。全件 done 時に全体進捗を出さない
// 挙動のみ維持する（allDone は進捗の非表示判定にのみ用いる）。
import { UploadItem, type UploadItemState } from '@/components/molecules/UploadItem'

export interface UploadListProps {
  uploads: UploadItemState[]
  onRetry?: (mediaId: string) => void
  onToggleSelect?: (mediaId: string) => void
  onDeleteSelected?: () => void
  // done 行のキャプションに添える保存先アルバム名。UploadItem へ透過する（設計書4.7）。
  albumName?: string
}

export function UploadList({
  uploads,
  onRetry,
  onToggleSelect,
  onDeleteSelected,
  albumName,
}: UploadListProps) {
  const total = uploads.length
  const done = uploads.filter((u) => u.status === 'done').length
  // 選択中は確定前（pending）かつ selected の行に限る（保存後の行は削除対象にしない）。
  const selectedCount = uploads.filter(
    (u) => u.status === 'pending' && u.selected
  ).length
  // 全件が done のとき全体進捗を非表示にするための判定（完了フィードバックは完了モーダルが担う）。
  const allDone = total > 0 && uploads.every((u) => u.status === 'done')

  return (
    <div className="flex flex-col gap-stack-md">
      {/* 全体進捗（完了数/総数）。対象が無い・全件完了時は表示しない。 */}
      {total > 0 && !allDone && (
        <p className="font-label-md text-label-md text-on-surface-variant">
          {total}個中{done}個完了
        </p>
      )}

      {/* 選択操作バー: 確定前行が1件以上選択されているときのみ表示（誤操作防止・設計書4.7）。 */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-surface-container p-stack-md">
          <span className="font-label-md text-label-md text-on-surface-variant">
            {selectedCount}件を選択中
          </span>
          <button
            type="button"
            onClick={onDeleteSelected}
            className="inline-flex h-10 items-center rounded-lg px-4 font-label-md text-label-md text-error hover:bg-error-container"
          >
            選択項目を削除
          </button>
        </div>
      )}

      <div className="flex flex-col gap-stack-sm">
        {uploads.map((upload) => (
          <UploadItem
            key={upload.mediaId}
            upload={upload}
            onRetry={onRetry}
            onToggleSelect={onToggleSelect}
            albumName={albumName}
          />
        ))}
      </div>
    </div>
  )
}
