import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { User } from 'firebase/auth'
import type { Album } from '@/types'

// useAlbums は useAuth の currentUser.uid を用いて subscribeAlbums を購読するフック。
// subscribeAlbums / useAuth をモックし、初期状態・データ受信・未ログイン時の非購読・
// エラーフォールバック・アンマウント時の購読解除を検証する。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}

const subscribeAlbums = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))
vi.mock('@/lib/firestoreAlbum', () => ({
  subscribeAlbums: (...args: unknown[]) => subscribeAlbums(...args),
}))

import { useAlbums } from './useAlbums'

const mockUser = { uid: 'test-uid', displayName: 'テスト太郎' } as unknown as User
const mockAlbum = {
  albumId: 'album-1',
  title: '湖畔で過ごした夏休み',
} as unknown as Album

describe('hooks/useAlbums', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    subscribeAlbums.mockReset()
    subscribeAlbums.mockReturnValue(vi.fn())
  })

  it('UAL-01: 初期状態は albums:[] / loading:true', () => {
    const { result } = renderHook(() => useAlbums())
    expect(result.current.albums).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('UAL-02: 購読データ受信で albums 更新・loading:false', () => {
    let cb: (albums: Album[]) => void = () => {}
    subscribeAlbums.mockImplementation((_uid, callback: (a: Album[]) => void) => {
      cb = callback
      return vi.fn()
    })
    const { result } = renderHook(() => useAlbums())
    act(() => cb([mockAlbum]))
    expect(result.current.albums).toEqual([mockAlbum])
    expect(result.current.loading).toBe(false)
  })

  it('UAL-03: currentUser.uid を第1引数に subscribeAlbums を呼ぶ', () => {
    renderHook(() => useAlbums())
    expect(subscribeAlbums).toHaveBeenCalledTimes(1)
    expect(subscribeAlbums.mock.calls[0][0]).toBe('test-uid')
  })

  it('UAL-04: 未ログイン時は購読せず空を返す', () => {
    authState = { currentUser: null, loading: false }
    const { result } = renderHook(() => useAlbums())
    expect(subscribeAlbums).not.toHaveBeenCalled()
    expect(result.current.albums).toEqual([])
  })

  it('UAL-05: 購読エラー時も loading を解除しクラッシュしない', () => {
    let errCb: (e: unknown) => void = () => {}
    subscribeAlbums.mockImplementation(
      (_uid, _cb: unknown, onError: (e: unknown) => void) => {
        errCb = onError
        return vi.fn()
      }
    )
    const { result } = renderHook(() => useAlbums())
    act(() => errCb(new Error('subscribe failed')))
    expect(result.current.loading).toBe(false)
    expect(result.current.albums).toEqual([])
  })

  it('UAL-06: アンマウント時に購読解除する', () => {
    const unsub = vi.fn()
    subscribeAlbums.mockReturnValue(unsub)
    const { unmount } = renderHook(() => useAlbums())
    unmount()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})
