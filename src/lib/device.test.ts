import { describe, it, expect, afterEach, vi } from 'vitest'
import { isMobileDevice } from './device'

// device.ts のモバイル端末判定を検証する（設計書 6.1.1(1) / テスト仕様書 5.46 DV-01〜08）。
// 引数を明示した場合は navigator を参照しないこと、判定不能時（空UA・SSR相当）は
// false（PC扱い・ポップアップへフォールバック）になることをフェイルセーフとして担保する。

describe('lib/device isMobileDevice', () => {
  afterEach(() => {
    // DV-08 で navigator を差し替えるため、テスト間で確実に元へ戻す
    vi.unstubAllGlobals()
  })

  it('DV-01: Android のUAで true', () => {
    expect(
      isMobileDevice('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36')
    ).toBe(true)
  })

  it('DV-02: iPhone のUAで true', () => {
    expect(
      isMobileDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(true)
  })

  it('DV-03: iPad のUAで true', () => {
    expect(
      isMobileDevice(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(true)
  })

  it('DV-04: iPod のUAで true', () => {
    expect(
      isMobileDevice(
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(true)
  })

  it('DV-05: 主要PCのUA（Windows Chrome / macOS Safari）で false', () => {
    expect(
      isMobileDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'
      )
    ).toBe(false)
    expect(
      isMobileDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
      )
    ).toBe(false)
  })

  it('DV-06: 空文字UAは false（判定不能時のPCフォールバック）', () => {
    expect(isMobileDevice('')).toBe(false)
  })

  it('DV-07: 想定外文字列は false（過検知しない）', () => {
    expect(isMobileDevice('unknown-agent-123')).toBe(false)
  })

  it('DV-08: 引数省略かつ navigator 未定義（SSR相当）で false（フェイルセーフ）', () => {
    // navigator を未定義相当に差し替え、引数なし呼び出しで例外を投げずPC扱いになることを確認
    vi.stubGlobal('navigator', undefined)
    expect(() => isMobileDevice()).not.toThrow()
    expect(isMobileDevice()).toBe(false)
  })

  it('DV-08b: 引数省略時は navigator.userAgent を参照する（モバイルUA→true）', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })
    expect(isMobileDevice()).toBe(true)
  })
})
