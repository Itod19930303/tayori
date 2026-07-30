import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// ホームページ（pages 層）。useAuth でガードし、useAlbums の実データを HomeTemplate へ渡す。
// useAuth / useAlbums / next/navigation をモックし、認証状態に応じた表示・リダイレクトを検証する。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
let albumsState: { albums: Album[]; loading: boolean } = {
  albums: [],
  loading: false,
}
const replace = vi.fn()
const push = vi.fn()
const signOutUser = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbums', () => ({ useAlbums: () => albumsState }))
vi.mock('@/lib/auth', () => ({
  signOutUser: (...args: unknown[]) => signOutUser(...args),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}))

import HomePage from './page'

const mockUser = { uid: 'test-uid', displayName: 'テスト太郎' } as unknown as User
const mockAlbum = {
  albumId: 'album-1',
  title: '湖畔で過ごした夏休み',
  description: '',
  ownerId: 'test-uid',
  memberUids: ['test-uid'],
  members: [
    {
      uid: 'test-uid',
      displayName: 'テスト太郎',
      email: 'test@example.com',
      role: 'owner',
      canView: true,
      canPost: true,
      canManage: true,
      joinedAt: { toMillis: () => 0 },
    },
  ],
  mediaCount: 0,
  createdAt: { toMillis: () => 0 },
  updatedAt: { toMillis: () => 0 },
} as unknown as Album

describe('app/page (ホーム)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    albumsState = { albums: [mockAlbum], loading: false }
    vi.clearAllMocks()
  })

  it('HP-01: ログイン済みでアルバム一覧を表示する', () => {
    render(<HomePage />)
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('HP-02: 「+ 新しいアルバム」押下で /albums/new へ遷移する', async () => {
    render(<HomePage />)
    await userEvent.click(screen.getByRole('button', { name: /新しいアルバム/ }))
    expect(push).toHaveBeenCalledWith('/albums/new')
  })

  it('HP-03: 未ログイン時は /login へ replace し一覧を表示しない', async () => {
    authState = { currentUser: null, loading: false }
    render(<HomePage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/login?returnUrl=%2F')
    )
    expect(screen.queryByText('湖畔で過ごした夏休み')).not.toBeInTheDocument()
  })

  it('HP-04: 認証確認中（loading:true）はローディング表示しリダイレクトしない', () => {
    authState = { currentUser: null, loading: true }
    render(<HomePage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByText('湖畔で過ごした夏休み')).not.toBeInTheDocument()
  })

  it('HP-05: アルバム読み込み中は AlbumGrid にloadingを伝播する', () => {
    albumsState = { albums: [], loading: true }
    render(<HomePage />)
    // AlbumGrid のローディング（role=status）が表示され空状態は出ない
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('まだアルバムがありません')).not.toBeInTheDocument()
  })

  it('HP-06: アルバム0件で空状態を表示する', () => {
    albumsState = { albums: [], loading: false }
    render(<HomePage />)
    expect(screen.getByText('まだアルバムがありません')).toBeInTheDocument()
  })

  // --- 共通ヘッダーのログアウトハンドラ（テスト仕様書 §5.45 LGH-HOME）---
  it('LGH-HOME-01: ログアウト押下で signOutUser が1回呼ばれる', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<HomePage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(signOutUser).toHaveBeenCalledTimes(1)
  })

  it('LGH-HOME-02: ログアウト成功で router.push("/login") を呼ぶ', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<HomePage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('LGH-HOME-03: ログアウト失敗時は遷移せず LOGOUT_FAILED を表示する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutUser.mockRejectedValue(new Error('signout failed'))
    render(<HomePage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() =>
      expect(screen.getByText(ERROR_MESSAGES.LOGOUT_FAILED)).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalledWith('/login')
    consoleErrorSpy.mockRestore()
  })

  // --- 共通ヘッダーのホームボタンハンドラ（テスト仕様書 §5.45.1 HMN-HOME）---
  it('HMN-HOME-01: ホームボタン押下で router.push("/") が1回呼ばれる', async () => {
    render(<HomePage />)
    await userEvent.click(screen.getByRole('button', { name: 'ホームへ戻る' }))
    expect(push).toHaveBeenCalledWith('/')
    expect(push).toHaveBeenCalledTimes(1)
  })
})
