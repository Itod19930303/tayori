// アップロード画面のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー・ファイル選択UI・UploadList・プライバシー案内バナーを配置し、
// 受け取った props を透過的に渡す。バリデーション・アップロード実処理は page 層の責務とする。
import { UploadList } from '@/components/organisms/UploadList'
import type { UploadItemState } from '@/components/molecules/UploadItem'

// page 層のクライアントバリデーション（validateMediaFile）で弾いたファイルのエラー。
export interface FileValidationError {
  fileName: string
  message: string
}

export interface UploadTemplateProps {
  uploads: UploadItemState[]
  onSelectFiles: (files: FileList) => void
  onSave: () => void
  canSave: boolean
  onRetry?: (mediaId: string) => void
  onToggleSelect?: (mediaId: string) => void
  onDeleteSelected?: () => void
  fileErrors?: FileValidationError[]
  // done 行のキャプションに添える保存先アルバム名。UploadList へ透過する（設計書4.7）。
  albumName?: string
}

export function UploadTemplate({
  uploads,
  onSelectFiles,
  onSave,
  canSave,
  onRetry,
  onToggleSelect,
  onDeleteSelected,
  fileErrors,
  albumName,
}: UploadTemplateProps) {
  // ファイル選択（input change）を FileList のまま page 層へ委ねる。
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectFiles(e.target.files)
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      <header className="flex flex-col gap-stack-sm">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          思い出を保存中
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          大切な思い出を安全に保存しています。
        </p>
      </header>

      {/* ファイル選択UI。label を input に紐付け、アクセシブルなボタンとして機能させる。 */}
      <div className="flex flex-col items-center gap-stack-md rounded-lg border-2 border-dashed border-outline-variant p-stack-lg text-center">
        <label
          htmlFor="media-file-input"
          className="inline-flex h-12 cursor-pointer items-center rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
        >
          ファイルを選択
        </label>
        <input
          id="media-file-input"
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleChange}
          className="sr-only"
        />
      </div>

      {/* クライアントバリデーションで弾いたファイルのインラインエラー（設計書8.1 #4・#5） */}
      {fileErrors && fileErrors.length > 0 && (
        <div role="alert" aria-live="polite" className="flex flex-col gap-stack-sm">
          {fileErrors.map((err) => (
            <p
              key={`${err.fileName}-${err.message}`}
              className="font-body-md text-body-md text-error"
            >
              {err.fileName}: {err.message}
            </p>
          ))}
        </div>
      )}

      <UploadList
        uploads={uploads}
        onRetry={onRetry}
        onToggleSelect={onToggleSelect}
        onDeleteSelected={onDeleteSelected}
        albumName={albumName}
      />

      {/* フッター操作バー: プライバシー案内 + 「保存」ボタン（設計書4.7） */}
      <div className="flex flex-col gap-stack-md">
        {/* プライバシー案内バナー（緑背景、設計書4.7） */}
        <div className="rounded-lg bg-primary-fixed p-stack-md font-body-md text-body-md text-on-surface">
          すべてのアップロードは暗号化され、安全に保存されます。
        </div>

        {/* 「保存」ボタン: 確定前（pending）行が1件以上のとき活性。全件削除時は非活性で
            表示を維持し、保存操作の起点を失わせない（設計書4.7 保存ボタン活性条件）。 */}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          aria-disabled={!canSave}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-secondary px-8 font-label-md text-label-md text-on-secondary shadow-md hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  )
}
