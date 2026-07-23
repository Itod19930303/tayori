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

  it('UM-01: 初期状態は media:null / loading:true / notFound:false', () => {
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    expect(result.current.media).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.notFound).toBe(false)
  })

  it('UM-02: albums/{albumId}/media/{mediaId} のドキュメントを購読する', () => {
    renderHook(() => useMedia('album-1', 'media-1'))
    expect(doc).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'media',
      'media-1'
    )
    expect(onSnapshot).toHaveBeenCalledTimes(1)
  })

  it('UM-03: 存在するメディアを受信して media を設定し loading:false', () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_ref, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => useMedia('album-1', 'media-1'))
    act(() =>
      nextCb({ exists: () => true, id: 'media-1', data: () => mockMedia })
    )
    expect(result.current.media?.mediaId).toBe('media-1')
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(false)
  })

  it('UM-04: 存在しない mediaId（exists=false）で notFound:true（404相当）', () => {
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
  })

  it('UM-05: 購読エラーでクラッシュせず loading を解除する', () => {
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

  it('UM-06: アンマウント時に購読解除する', () => {
    const unsub = vi.fn()
    onSnapshot.mockReturnValue(unsub)
    const { unmount } = renderHook(() => useMedia('album-1', 'media-1'))
    unmount()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})
