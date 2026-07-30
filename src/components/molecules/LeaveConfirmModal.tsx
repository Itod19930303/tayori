'use client'

// アップロード画面の離脱確認モーダル（molecules、基本設計書 4.10.2）。
// ファイル選択で積み上げた確定前プレビュー（status:'pending'）を残したままホームへ離脱すると、
// 未保存の選択内容が失われる。無警告での消失を防ぐため、pending が1件以上残る状態でホームボタンを
// 押した際に本モーダルを挟み、明示的な選択（移動する／キャンセル）を経てから遷移させる。
// UploadCompleteModal と同一の命名・配置パターンに倣う純粋表示コンポーネントとし、選択必須のため
// 背景クリック・Esc では閉じない（オーバーレイに onClick を持たせない）。molecules 制約により
// Firestore/Storage へ直接アクセスせず、遷移（onConfirm）・キャンセル（onCancel）は page 層責務の
// コールバックを呼ぶのみ。previewUrl 解放や router.push は page 層が担う。open=false のとき null を返す。
import { CONFIRM_MESSAGES } from '@/lib/messages/confirmMessages'

export interface LeaveConfirmModalProps {
  // true のとき表示。false のとき何も描画しない（null 返却）。
  open: boolean
  // 未保存の確定前プレビュー件数。本文に併記し、失われる対象件数をユーザーへ明示する。
  pendingCount: number
  // 「移動する」。page 層で router.push('/') を実行する（遷移は page 層責務）。
  onConfirm: () => void
  // 「キャンセル」。モーダルを閉じるのみ（uploads 状態・previewUrl は保持し、選択内容を維持する）。
  onCancel: () => void
}

export function LeaveConfirmModal({
  open,
  pendingCount,
  onConfirm,
  onCancel,
}: LeaveConfirmModalProps) {
  // open=false のときは DOM を持たない（開閉の真実源は page 層の state とし、独自state を持たない）。
  if (!open) return null

  return (
    // オーバーレイ背景。選択必須のため背景クリック・Esc では閉じない（onClick を持たせない）。
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-margin-mobile">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md flex-col gap-stack-lg rounded-lg bg-surface p-stack-lg text-center shadow-md"
      >
        {/* 警告本文: 文言は confirmMessages に定数化（設計書4.10.2 定数化方針）。 */}
        <div className="flex flex-col gap-stack-sm">
          <p className="font-headline-md text-headline-md text-on-surface">
            {CONFIRM_MESSAGES.LEAVE_UPLOAD_WITH_PENDING}
          </p>
          {/* 失われる対象件数を明示し、離脱の影響をユーザーが把握できるようにする。 */}
          <p className="font-body-md text-body-md text-on-surface-variant">
            未保存: {pendingCount}件
          </p>
        </div>

        <div className="flex flex-col gap-stack-md">
          {/* 「移動する」: 破壊的寄りの主アクション。page 層で router.push('/') を実行する。 */}
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-error px-6 font-label-md text-label-md text-on-error hover:opacity-90 active:scale-95"
          >
            移動する
          </button>

          {/* 「キャンセル」: 副次アクション。モーダルを閉じるのみで選択内容を維持する。 */}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-12 items-center justify-center rounded-lg px-6 font-label-md text-label-md text-on-surface hover:bg-surface-variant"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
