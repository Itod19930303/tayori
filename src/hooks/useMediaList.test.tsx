import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Media } from '@/types'

// useMediaList は subscribeMedia を購読し { mediaItems, loading } を返すフック。
// firestoreMedia.subscribeMedia をモックし、初期状態・データ受信・エラー・
// アンマウント時の購読解除を検証する（基本設計書 6.4）。

const subscribeMedia = vi.fn()

vi.mock('@/lib/firestoreMedia', () => ({
  subscribeMedia: (...args: unknown[]) => subscribeMedia(...args),
}))

import { useMediaList } from './useMediaList'

const mockImageMedia = { mediaId: 'media-1', contentType: 'image/jpeg' } as unknown as Media
const mockVideoMedia = { mediaId: 'media-2', contentType: 'video/mp4' } as unknown as Media

describe('hooks/useMediaList', () => {
  beforeEach(() => {
    subscribeMedia.mockReset()
    subscribeMedia.mockReturnValue(vi.fn())
  })

  it('UML-01: 初期状態は mediaItems:[] / loading:true', () => {
    const { result } = renderHook(() => useMediaList('album-1'))
    expect(result.current.mediaItems).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('UML-02: 購読データ受信で mediaItems 更新・loading:false（正常時は console.error を呼ばない）', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let cb: (items: Media[]) => void = () => {}
    subscribeMedia.mockImplementation((_id, callback: (m: Media[]) => void) => {
      cb = callback
      return vi.fn()
    })
    const { result } = renderHook(() => useMediaList('album-1'))
    act(() => cb([mockImageMedia, mockVideoMedia]))
    expect(result.current.mediaItems).toHaveLength(2)
    expect(result.current.loading).toBe(false)
    // ログはエラー経路のみ（UML-07と対）。正常受信では出力されない。
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('UML-03: albumId を第1引数に subscribeMedia を呼ぶ', () => {
    renderHook(() => useMediaList('album-1'))
    expect(subscribeMedia).toHaveBeenCalledTimes(1)
    expect(subscribeMedia.mock.calls[0][0]).toBe('album-1')
  })

  it('UML-04: 0件受信で空配列・loading:false', () => {
    let cb: (items: Media[]) => void = () => {}
    subscribeMedia.mockImplementation((_id, callback: (m: Media[]) => void) => {
      cb = callback
      return vi.fn()
    })
    const { result } = renderHook(() => useMediaList('album-1'))
    act(() => cb([]))
    expect(result.current.mediaItems).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('UML-05: 購読エラー時も loading を解除しクラッシュしない', () => {
    let errCb: (e: unknown) => void = () => {}
    subscribeMedia.mockImplementation(
      (_id, _cb: unknown, onError: (e: unknown) => void) => {
        errCb = onError
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useMediaList('album-1'))
    act(() => errCb(new Error('subscribe failed')))
    expect(result.current.loading).toBe(false)
    expect(result.current.mediaItems).toEqual([])
  })

  it('UML-06: アンマウント時に購読解除する', () => {
    const unsub = vi.fn()
    subscribeMedia.mockReturnValue(unsub)
    const { unmount } = renderHook(() => useMediaList('album-1'))
    unmount()
    expect(unsub).toHaveBeenCalledTimes(1)
  })

  it('UML-07: 購読エラー発火時に console.error で原因をログ出力する', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('subscribe failed')
    let errCb: (e: unknown) => void = () => {}
    subscribeMedia.mockImplementation(
      (_id, _cb: unknown, onError: (e: unknown) => void) => {
        errCb = onError
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useMediaList('album-1'))
    act(() => errCb(error))
    // メディア一覧購読エラーを識別できる日本語文言と error を引数に1回だけ出力する。
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('メディア'), error)
    // UML-05のUXフォールバック（loading解除・空配列）が維持されること。
    expect(result.current.loading).toBe(false)
    expect(result.current.mediaItems).toEqual([])
    errorSpy.mockRestore()
  })
})
