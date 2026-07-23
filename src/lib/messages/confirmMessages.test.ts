import { describe, it, expect } from 'vitest'
import { CONFIRM_MESSAGES, type ConfirmMessageKey } from './confirmMessages'

// CONFIRM_MESSAGES は window.confirm 系の確認ダイアログ文言の受け皿（空実装）。
// 空実装でも import 可能で型が成立すること（MSG-06）を検証する。

describe('lib/messages/confirmMessages', () => {
  it('MSG-06: CONFIRM_MESSAGES は空実装でも import 可能で型が成立する', () => {
    expect(CONFIRM_MESSAGES).toBeDefined()
    expect(typeof CONFIRM_MESSAGES).toBe('object')
    // ConfirmMessageKey 型が keyof typeof CONFIRM_MESSAGES として解決できることを型レベルで確認する。
    const keys: ConfirmMessageKey[] = Object.keys(
      CONFIRM_MESSAGES
    ) as ConfirmMessageKey[]
    expect(Array.isArray(keys)).toBe(true)
  })
})
