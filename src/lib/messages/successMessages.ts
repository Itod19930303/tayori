/**
 * 利用者向けの成功トースト・完了バナー文言を一元管理する。
 *
 * エラー文言（errorMessages.ts）と責務を分離し、tone（成功/失敗）の取り違えを防ぐ。
 * 件数などパラメータを含む文言は関数形式とする。
 */
export const SUCCESS_MESSAGES = {
  LINK_COPIED: 'リンクをコピーしました',
  PERMISSIONS_SAVED: '権限を保存しました',
  INVITE_REGISTERED: '招待を登録しました',
  /**
   * アップロード全件完了時のバナー文言を生成する。
   * @param count 保存が完了したメディアの件数
   * @returns 件数を埋め込んだ日本語の完了メッセージ
   */
  MEDIA_SAVED: (count: number) => `${count}件の思い出を保存しました`,
} as const
