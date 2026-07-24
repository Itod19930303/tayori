// アップロード画面のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー（戻るリンク＋見出し）・ファイル選択UI・UploadList・「保存」ボタン・完了モーダルを配置し、
// 受け取った props を透過的に渡す。バリデーション・アップロード実処理は page 層の責務とする。
// v2.5: プライバシー案内（暗号化）バナーを廃止し、全件 done（allDone）時に完了モーダル
// UploadCompleteModal を表示する。ヘッダー戻るリンクは常時表示し、アップロード進行中
// （uploading/waiting/retrying が1件以上）は非活性化して離脱による中断を防ぐ。
import { UploadList } from '@/components/organisms/UploadList'
import { UploadCompleteModal } from '@/components/molecules/UploadCompleteModal'
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
  // ヘッダー戻るリンク & 完了モーダル「戻る」の遷移先コールバック（/albums/${albumId}）。
  // UploadCompleteModal へも透過する。page 層生成のため本層は Firestore/Storage 直アクセスをしない。
  onBack?: () => void
  // v2.5: 完了モーダル「続けてアップロードする」。uploads を初期化し再選択可能状態へ戻す（page 層責務）。
  onResetUploads?: () => void
  // ヘッダー戻るリンクの文言「「[アルバム名]」に戻る」・done 行キャプションに使用する。
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
  onBack,
  onResetUploads,
  albumName,
}: UploadTemplateProps) {
  // ファイル選択（input change）を FileList のまま page 層へ委ねる。
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectFiles(e.target.files)
    }
  }

  // アップロード進行中（uploading/waiting/retrying が1件以上）はヘッダー戻るリンクを非活性化する。
  // pending（確定前）・error のみは進行中ではないため活性を維持する（設計書4.7 非活性化条件）。
  const isUploadInProgress = uploads.some((u) =>
    ['uploading', 'waiting', 'retrying'].includes(u.status)
  )

  // 全件 done のとき完了モーダルを表示する。props の uploads から導出する表示ロジックのみで、
  // Firestore/Storage へはアクセスしない（allDone を唯一の真実源とする。設計書4.7 v2.5）。
  const allDone = uploads.length > 0 && uploads.every((u) => u.status === 'done')

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      <header className="flex flex-col gap-stack-md">
        {/* ヘッダー戻るリンク:「「[アルバム名]」に戻る」（PermissionsTemplate と同一表現・設計書4.7）。
            常時表示し、アップロード進行中は disabled + aria-disabled でグレーアウトする。 */}
        <button
          type="button"
          onClick={onBack}
          disabled={isUploadInProgress}
          aria-disabled={isUploadInProgress}
          className="inline-flex items-center gap-stack-sm self-start font-label-md text-label-md text-on-surface-variant hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-on-surface-variant"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          「{albumName}」に戻る
        </button>

        <div className="flex flex-col gap-stack-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            思い出を保存中
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            大切な思い出を安全に保存しています。
          </p>
        </div>
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

      {/* フッター操作バー: 「保存」ボタン（設計書4.7）。v2.5 で暗号化案内バナーを廃止した。 */}
      <div className="flex flex-col gap-stack-md">
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

      {/* 完了モーダル: 全件 done のとき表示し、次操作を2択で選ばせる（設計書4.7 v2.5）。 */}
      <UploadCompleteModal
        open={allDone}
        count={uploads.length}
        onContinue={onResetUploads ?? (() => {})}
        onBack={onBack}
      />
    </div>
  )
}
