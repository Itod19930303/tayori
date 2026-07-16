import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Album } from '@/types'

// useAlbum は albumId の単一アルバムを onSnapshot(doc(...)) で購読し
// { album, loading, notFound } を返すフック（基本設計書 4.6）。
// firebase/firestore（doc / onSnapshot）をモックし、存在・不在・エラー各経路を検証する。

const doc = vi.fn((..._args: unknown[]) => ({ __type: 'doc' }))
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

import { useAlbum } from './useAlbum'

const mockAlbum = {
  albumId: 'album-1',
  title: '湖畔で過ごした夏休み',
  memberUids: ['test-uid'],
  members: [],
} as unknown as Album

describe('hooks/useAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onSnapshot.mockReturnValue(vi.fn())
  })

  it('UAB-01: 初期状態は album:null / loading:true / notFound:false', () => {
    const { result } = renderHook(() => useAlbum('album-1'))
    expect(result.current.album).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.notFound).toBe(false)
  })

  it('UAB-02: 存在するアルバムを受信して album を設定し loading:false', () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_ref, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => useAlbum('album-1'))
    act(() =>
      nextCb({ exists: () => true, id: 'album-1', data: () => mockAlbum })
    )
    expect(result.current.album?.albumId).toBe('album-1')
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(false)
  })

  it('UAB-03: 存在しないalbumId（exists=false）で notFound:true（404相当）', () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_ref, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => useAlbum('missing'))
    act(() => nextCb({ exists: () => false, id: 'missing', data: () => undefined }))
    expect(result.current.album).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.notFound).toBe(true)
  })

  it('UAB-04: 購読エラー（permission-denied）でクラッシュせず loading を解除する（403相当）', () => {
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_ref, _next: unknown, error: (e: unknown) => void) => {
        errCb = error
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useAlbum('album-1'))
    expect(() =>
      act(() => errCb({ code: 'permission-denied' }))
    ).not.toThrow()
    expect(result.current.loading).toBe(false)
    // notFound とは区別する（権限エラーは非メンバー判定を page 層が memberUids で行う）
    expect(result.current.notFound).toBe(false)
  })

  it('UAB-05: アンマウント時に購読解除する', () => {
    const unsub = vi.fn()
    onSnapshot.mockReturnValue(unsub)
    const { unmount } = renderHook(() => useAlbum('album-1'))
    unmount()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})
