import { describe, it, expect } from 'vitest'
import { ERROR_MESSAGES } from './errorMessages'

// ERROR_MESSAGES はエラー・警告・403/404・入力バリデーションの利用者向け日本語文言を
// 一元管理する純粋データモジュール（メッセージ定数設計書 5.2）。Firebase 非依存のためモック不要。
// 本テストはキー網羅（MSG-01）・静的文言の旧実装完全一致（MSG-03）・静的値の重複なし（MSG-04）・
// 関数形式の引数埋め込み（MSG-05/05b）・統合の1対1一致（MSG-07）を検証する。

describe('lib/messages/errorMessages', () => {
  it('MSG-01: ERROR_MESSAGES が設計どおりの19キーを過不足なく持つ', () => {
    const expectedKeys = [
      'FORBIDDEN',
      'POST_FORBIDDEN',
      'ALBUM_NOT_FOUND',
      'MEDIA_NOT_FOUND',
      'SAVE_FAILED',
      'CANCEL_FAILED',
      'UPLOAD_NETWORK_FAILED',
      'VIDEO_NOT_SUPPORTED',
      'MEDIA_PREVIEW_UNSUPPORTED',
      'TITLE_REQUIRED',
      'TITLE_MAX_LENGTH',
      'DESCRIPTION_MAX_LENGTH',
      'UNSUPPORTED_FILE_TYPE',
      'FILE_SIZE_EXCEEDED',
      'EMAIL_REQUIRED',
      'EMAIL_INVALID_FORMAT',
      'AUTH_NETWORK_FAILED',
      'AUTH_TOO_MANY_REQUESTS',
      'AUTH_SIGNIN_FAILED',
    ].sort()
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(expectedKeys)
  })

  it('MSG-03: 静的キーの文言が旧実装と完全一致する（末尾句点まで）', () => {
    expect(ERROR_MESSAGES.FORBIDDEN).toBe(
      'このアルバムへのアクセス権がありません。管理者に招待を依頼してください。'
    )
    expect(ERROR_MESSAGES.POST_FORBIDDEN).toBe('投稿権限がありません。')
    expect(ERROR_MESSAGES.ALBUM_NOT_FOUND).toBe('アルバムが見つかりません。')
    expect(ERROR_MESSAGES.MEDIA_NOT_FOUND).toBe('メディアが見つかりません。')
    expect(ERROR_MESSAGES.SAVE_FAILED).toBe(
      '保存に失敗しました。時間をおいて再試行してください。'
    )
    expect(ERROR_MESSAGES.CANCEL_FAILED).toBe(
      '取り消しに失敗しました。時間をおいて再試行してください。'
    )
    expect(ERROR_MESSAGES.UPLOAD_NETWORK_FAILED).toBe(
      'ネットワークが切断されました。タップして再試行してください。'
    )
    expect(ERROR_MESSAGES.VIDEO_NOT_SUPPORTED).toBe(
      'お使いのブラウザは動画再生に対応していません。'
    )
    expect(ERROR_MESSAGES.MEDIA_PREVIEW_UNSUPPORTED).toBe(
      'このファイルはプレビューに対応していません。ダウンロードしてご確認ください。'
    )
    expect(ERROR_MESSAGES.TITLE_REQUIRED).toBe('アルバム名を入力してください')
    expect(ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE).toBe(
      '対応していないファイル形式です（対応: JPG, PNG, WebP, GIF, MP4, MOV）。'
    )
    expect(ERROR_MESSAGES.FILE_SIZE_EXCEEDED).toBe(
      'ファイルサイズが上限（画像50MB・動画500MB）を超えています。'
    )
    expect(ERROR_MESSAGES.EMAIL_REQUIRED).toBe('メールアドレスを入力してください')
    expect(ERROR_MESSAGES.EMAIL_INVALID_FORMAT).toBe(
      'メールアドレスの形式が正しくありません'
    )
    expect(ERROR_MESSAGES.AUTH_NETWORK_FAILED).toBe(
      'ネットワーク接続を確認してください。'
    )
    expect(ERROR_MESSAGES.AUTH_TOO_MANY_REQUESTS).toBe(
      'しばらく時間をおいてから再試行してください。'
    )
    expect(ERROR_MESSAGES.AUTH_SIGNIN_FAILED).toBe(
      'Googleログインに失敗しました。もう一度お試しください。'
    )
  })

  it('MSG-04: ERROR_MESSAGES 内で静的（string型）値の重複がない', () => {
    const staticValues = (Object.values(ERROR_MESSAGES) as unknown[]).filter(
      (v): v is string => typeof v === 'string'
    )
    expect(new Set(staticValues).size).toBe(staticValues.length)
    // FORBIDDEN と POST_FORBIDDEN、AUTH_NETWORK_FAILED と UPLOAD_NETWORK_FAILED が
    // 別文言であることを明示的に確認する（意図しない統合の検出）。
    expect(ERROR_MESSAGES.FORBIDDEN).not.toBe(ERROR_MESSAGES.POST_FORBIDDEN)
    expect(ERROR_MESSAGES.AUTH_NETWORK_FAILED).not.toBe(
      ERROR_MESSAGES.UPLOAD_NETWORK_FAILED
    )
  })

  it('MSG-05: 関数形式メッセージが引数を正しく埋め込む', () => {
    expect(ERROR_MESSAGES.TITLE_MAX_LENGTH(50)).toBe(
      'アルバム名は50文字以内で入力してください'
    )
    expect(ERROR_MESSAGES.DESCRIPTION_MAX_LENGTH(200)).toBe(
      '説明は200文字以内で入力してください'
    )
  })

  it('MSG-05b: 関数形式メッセージが境界値（1）でも補間位置がずれない', () => {
    expect(ERROR_MESSAGES.TITLE_MAX_LENGTH(1)).toBe(
      'アルバム名は1文字以内で入力してください'
    )
    expect(ERROR_MESSAGES.DESCRIPTION_MAX_LENGTH(1)).toBe(
      '説明は1文字以内で入力してください'
    )
  })

  it('MSG-07: 統合対象キーが単一値へ集約されている', () => {
    // FORBIDDEN(3箇所)・SAVE_FAILED(2箇所)・ALBUM_NOT_FOUND(2箇所)が単一定数へ統合されている。
    expect(typeof ERROR_MESSAGES.FORBIDDEN).toBe('string')
    expect(typeof ERROR_MESSAGES.SAVE_FAILED).toBe('string')
    expect(typeof ERROR_MESSAGES.ALBUM_NOT_FOUND).toBe('string')
  })
})
