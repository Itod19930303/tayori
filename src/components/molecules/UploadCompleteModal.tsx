'use client'

// アップロード完了モーダル（molecules、基本設計書 4.7 v2.5「完了モーダルの仕様」）。
// 全件 done（allDone）時にアップロード完了を通知し、次操作を「続けてアップロードする」／「戻る」の
// 2択で選ばせる。InviteModal.tsx と同一の命名・配置パターンに倣う。
// 選択を必須とするため背景クリック・Esc では閉じない（onClose を持たない）。
// molecules 制約により Firestore/Storage へ直接アクセスせず、リセット（onContinue）・遷移（onBack）は
// いずれも page 層責務のコールバックを呼ぶのみ。open=false のとき DOM を持たない（null を返す）。
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

export interface UploadCompleteModalProps {
  // allDone のとき true。false のとき何も描画しない。
  open: boolean
  // 保存件数（uploads.length）。SUCCESS_MESSAGES.MEDIA_SAVED(count) に使用する。
  count: number
  // 「続けてアップロードする」。page 層の onResetUploads を呼ぶ（uploads リセットは page 層責務）。
  onContinue: () => void
  // 「戻る」。ヘッダー戻るリンクと同一の /albums/${albumId} 遷移コールバック（任意）。
  onBack?: () => void
}

export function UploadCompleteModal({
  open,
  count,
  onContinue,
  onBack,
}: UploadCompleteModalProps) {
  // open=false のときは DOM を持たない（allDone を唯一の真実源とし、独自の開閉 state を持たない）。
  if (!open) return null

  return (
    // オーバーレイ背景。選択必須のため背景クリック・Esc では閉じない（onClick を持たせない）。
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-margin-mobile">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md flex-col gap-stack-lg rounded-lg bg-surface p-stack-lg text-center shadow-md"
      >
        {/* 完了メッセージ: 既存定数を流用し新規文言を作らない（設計書4.7 v2.5）。 */}
        <p className="font-headline-md text-headline-md text-on-surface">
          {SUCCESS_MESSAGES.MEDIA_SAVED(count)}
        </p>

        <div className="flex flex-col gap-stack-md">
          {/* 「続けてアップロードする」: page 層で uploads をリセットし初期状態へ戻す。 */}
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 font-label-md text-label-md text-on-primary hover:opacity-90 active:scale-95"
          >
            続けてアップロードする
          </button>

          {/* 「戻る」: ヘッダー戻るリンクと同一の onBack を共有し /albums/${albumId} へ遷移する。 */}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-12 items-center justify-center rounded-lg px-6 font-label-md text-label-md text-on-surface hover:bg-surface-variant"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  )
}
