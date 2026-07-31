import { describe, it, expect } from 'vitest'
import { CONFIRM_MESSAGES, type ConfirmMessageKey } from './confirmMessages'

// CONFIRM_MESSAGES は確認ダイアログ文言の受け皿。v3.0 で離脱確認モーダル（LeaveConfirmModal・
// 設計書4.10.2）用の LEAVE_UPLOAD_WITH_PENDING を追加した。import 可能で型が成立すること、
// および追加キーが定義済みであること（MSG-06）を検証する。

describe('lib/messages/confirmMessages', () => {
  it('MSG-06: CONFIRM_MESSAGES は import 可能で型が成立し、離脱確認文言を持つ', () => {
    // 離脱確認本文（設計書4.10.2）が定義されている。
    expect(CONFIRM_MESSAGES.LEAVE_UPLOAD_WITH_PENDING).toBe(
      '保存されていない写真・動画があります。ホームに移動すると選択内容が失われます。'
    )
    // ConfirmMessageKey 型が keyof typeof CONFIRM_MESSAGES として解決できることを型レベルで確認する。
    const keys: ConfirmMessageKey[] = Object.keys(
      CONFIRM_MESSAGES
    ) as ConfirmMessageKey[]
    expect(keys).toContain('LEAVE_UPLOAD_WITH_PENDING')
  })
})