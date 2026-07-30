import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Media } from '@/types'

// useMedia は albums/{albumId}/media/{mediaId} の単一メディアを onSnapshot(doc(...)) で購読し
// { media, loading, notFound } を返すフック（基本設計書 4.9、useAlbum と同一パターン）。
// firebase/firestore（doc / onSnapshot）をモックし、存在・不在・エラー・購読解除を検証する。

const doc = vi.fn((..._args: unknown[]) => ({ __type: 'doc', args: _args }))
const onSnapshot = vi.fn()

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: (...args: unknown[]) => doc(...args),
  onSnapshot: (...args: unknown[]) => onSnapshot(...args),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: { __type: 'db-stub' },
  storage: {},
}))

import { useMedia } from './useMedia'

const mockMedia = {
  mediaId: 'media-1',
  contentType: 'image/jpeg',
  downloadUrl: 'https://storage.example.com/photo.jpg',
} as unknown as Media

describe('hooks/useMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onSnapshot.mockReturnValue(vi.fn())
  })

  it('UMD-01: 初期状態は media:null / loading:true / notFound:false', () => {
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    expect(result.current.media).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.notFound).toBe(false)
  })

  it('UMD-02: 存在するメディアを受信して media を設定し loading:false（正常時は console.error を呼ばない）', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_ref, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    // albums/{albumId}/media/{mediaId} の単一ドキュメントを購読していることを併せて確認する。
    expect(doc).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'media',
      'media-1'
    )
    act(() =>
      nextCb({ exists: () => true, id: 'media-1', data: () => mockMedia })
    )
    expect(result.current.media?.mediaId).toBe('media-1')
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(false)
    // ログはエラー経路のみ（UMD-05と対）。正常受信では出力されない。
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('UMD-03: 存在しない mediaId（exists=false）で notFound:true（404相当・console.error は呼ばない）', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_ref, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => useMedia('album-1', 'missing'))
    act(() =>
      nextCb({ exists: () => false, id: 'missing', data: () => undefined })
    )
    expect(result.current.media).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(true)
    // exists=false は購読エラーではないためログ対象外。
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('UMD-04: 購読エラー（permission-denied）でクラッシュせず loading を解除する（403相当）', () => {
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_ref, _next: unknown, error: (e: unknown) => void) => {
        errCb = error
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    expect(() => act(() => errCb({ code: 'permission-denied' }))).not.toThrow()
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(false)
  })

  it('UMD-05: 購読エラー発火時に console.error で原因をログ出力する', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = { code: 'permission-denied' }
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_ref, _next: unknown, error2: (e: unknown) => void) => {
        errCb = error2
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    act(() => errCb(error))
    // 単一メディア購読エラーを識別できる日本語文言と error を引数に1回だけ出力する。
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('メディア'), error)
    // UMD-04のフォールバック（loading解除・notFound非変更）が維持されること。
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(false)
    errorSpy.mockRestore()
  })

  it('UMD-06: error が undefined や code 無しでもクラッシュせず loading を解除する', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_ref, _next: unknown, error2: (e: unknown) => void) => {
        errCb = error2
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    // undefined / code 未設定の空オブジェクトいずれでも throw しない（error.code 依存でない実装）。
    expect(() => act(() => errCb(undefined))).not.toThrow()
    expect(() => act(() => errCb({}))).not.toThrow()
    expect(result.current.loading).toBe(false)
    errorSpy.mockRestore()
  })

  it('UMD-07: アンマウント時に購読解除する', () => {
    const unsub = vi.fn()
    onSnapshot.mockReturnValue(unsub)
    const { unmount } = renderHook(() => useMedia('album-1', 'media-1'))
    unmount()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})
