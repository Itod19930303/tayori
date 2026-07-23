// window.confirm 等の確認ダイアログ文言の受け皿（現時点では使用箇所なし）。
// 将来「削除しますか？」等の確認文言を追加する際に、errorMessages/successMessages と同じ
// オブジェクト形式・命名規則で拡張できるよう、空定数と型だけを先に定義しておく。
// 空オブジェクトのままでも import 可能で、キー追加時に呼び出し側の参照方法が変わらない。
export const CONFIRM_MESSAGES = {
  // 例（将来追加時のイメージ・現在は未使用）:
  // DELETE_ALBUM: 'このアルバムを削除しますか？この操作は取り消せません。',
} as const

// 確認文言キーの型。キー追加時に参照側で型補完・型チェックを効かせるためのユーティリティ型。
export type ConfirmMessageKey = keyof typeof CONFIRM_MESSAGES
