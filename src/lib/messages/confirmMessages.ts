/**
 * `window.confirm` 等の確認ダイアログ文言の受け皿（現時点では使用箇所なし）。
 *
 * 将来「削除しますか？」等の確認文言を追加する際に、errorMessages/successMessages と同じ
 * オブジェクト形式・命名規則で拡張できるよう、空定数と型だけを先に定義しておく。
 * 空オブジェクトのままでも import 可能で、キー追加時に呼び出し側の参照方法が変わらない。
 */
export const CONFIRM_MESSAGES = {
  // アップロード画面で未保存の確定前プレビュー（status:'pending'）を残したままホームへ離脱しようと
  // した際の確認本文（設計書4.10.2 LeaveConfirmModal）。無警告での選択内容消失を防ぐため、
  // 移動すると選択が失われることを明示する。件数は LeaveConfirmModal 側で pendingCount を併記する。
  LEAVE_UPLOAD_WITH_PENDING:
    '保存されていない写真・動画があります。ホームに移動すると選択内容が失われます。',
} as const

/** 確認文言キーの型。キー追加時に参照側で型補完・型チェックを効かせるためのユーティリティ型。 */
export type ConfirmMessageKey = keyof typeof CONFIRM_MESSAGES
