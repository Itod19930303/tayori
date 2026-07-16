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

  it('UML-02: 購読データ受信で mediaItems 更新・loading:false', () => {
    let cb: (items: Media[]) => void = () => {}
    subscribeMedia.mockImplementation((_id, callback: (m: Media[]) => void) => {
      cb = callback
      return vi.fn()
    })
    const { result } = renderHook(() => useMediaList('album-1'))
    act(() => cb([mockImageMedia, mockVideoMedia]))
    expect(result.current.mediaItems).toHaveLength(2)
    expect(result.current.loading).toBe(false)
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
})
