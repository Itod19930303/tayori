import { describe, it, expect } from 'vitest'
import { SUCCESS_MESSAGES } from './successMessages'

// SUCCESS_MESSAGES は成功トースト・完了バナーの利用者向け文言を一元管理する純粋データモジュール
// （メッセージ定数設計書 5.3）。キー網羅（MSG-02）と関数形式の引数埋め込み（MSG-05/05b）を検証する。

describe('lib/messages/successMessages', () => {
  it('MSG-02: SUCCESS_MESSAGES が設計どおりの4キーを過不足なく持つ', () => {
    const expectedKeys = [
      'LINK_COPIED',
      'PERMISSIONS_SAVED',
      'INVITE_REGISTERED',
      'MEDIA_SAVED',
    ].sort()
    expect(Object.keys(SUCCESS_MESSAGES).sort()).toEqual(expectedKeys)
  })

  it('MSG-03: 静的キーの文言が旧実装と完全一致する', () => {
    expect(SUCCESS_MESSAGES.LINK_COPIED).toBe('リンクをコピーしました')
    expect(SUCCESS_MESSAGES.PERMISSIONS_SAVED).toBe('権限を保存しました')
    expect(SUCCESS_MESSAGES.INVITE_REGISTERED).toBe('招待を登録しました')
  })

  it('MSG-05: 関数形式メッセージ MEDIA_SAVED が件数を正しく埋め込む', () => {
    expect(SUCCESS_MESSAGES.MEDIA_SAVED(3)).toBe('3件の思い出を保存しました')
  })

  it('MSG-05b: MEDIA_SAVED が境界値（0・1）でも補間位置がずれない', () => {
    expect(SUCCESS_MESSAGES.MEDIA_SAVED(0)).toBe('0件の思い出を保存しました')
    expect(SUCCESS_MESSAGES.MEDIA_SAVED(1)).toBe('1件の思い出を保存しました')
  })
})
