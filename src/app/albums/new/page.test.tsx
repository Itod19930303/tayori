import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'

// アルバム作成ページ（pages 層）。useAuth でガードし、onSubmit で createAlbum を呼ぶ。
// createAlbum / useAuth / next/navigation をモックし、送信成功時の push・失敗時のエラー表示・
// 二重送信防止・未ログインリダイレクトを検証する（基本設計書 4.5 / 6.2 / 8.1 #6）。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
const replace = vi.fn()
const push = vi.fn()
const createAlbum = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/lib/firestoreAlbum', () => ({
  createAlbum: (...args: unknown[]) => createAlbum(...args),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}))

import NewAlbumPage from './page'

const mockUser = { uid: 'test-uid', displayName: 'テスト太郎' } as unknown as User

const fillTitleAndSave = async () => {
  await userEvent.type(screen.getByLabelText(/アルバム名/), '夏休み')
  await userEvent.click(screen.getByRole('button', { name: /保存/ }))
}

describe('app/albums/new/page (アルバム作成)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    vi.clearAllMocks()
  })

  it('NAP-01: ログイン済みで作成フォームを表示する', () => {
    render(<NewAlbumPage />)
    expect(screen.getByLabelText(/アルバム名/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('NAP-02: 送信成功で作成したアルバムへ router.push する', async () => {
    createAlbum.mockResolvedValue('new-album-id')
    render(<NewAlbumPage />)
    await fillTitleAndSave()
    expect(createAlbum).toHaveBeenCalledWith(
      { title: '夏休み', description: '' },
      mockUser
    )
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/albums/new-album-id')
    )
  })

  it('NAP-03: 送信中は二重送信を防ぎ createAlbum を2回呼ばない', async () => {
    createAlbum.mockReturnValue(new Promise(() => {}))
    render(<NewAlbumPage />)
    await userEvent.type(screen.getByLabelText(/アルバム名/), '夏休み')
    const button = screen.getByRole('button', { name: /保存/ })
    await userEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    await userEvent.click(button)
    expect(createAlbum).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it('NAP-04: 書き込み失敗時にエラーメッセージを表示し遷移しない', async () => {
    createAlbum.mockRejectedValue(new Error('write failed'))
    render(<NewAlbumPage />)
    await fillTitleAndSave()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '保存に失敗しました。時間をおいて再試行してください。'
      )
    )
    expect(push).not.toHaveBeenCalled()
    // 再送信可能（ボタンが再度有効）
    expect(screen.getByRole('button', { name: /保存/ })).toBeEnabled()
  })

  it('NAP-05: タイトル未入力ではクライアントバリデーションで止まり createAlbum を呼ばない', async () => {
    render(<NewAlbumPage />)
    await userEvent.click(screen.getByRole('button', { name: /保存/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('アルバム名を入力してください')
    expect(createAlbum).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('NAP-06: 未ログイン時は /login へ replace しフォームを表示しない', async () => {
    authState = { currentUser: null, loading: false }
    render(<NewAlbumPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?returnUrl=%2Falbums%2Fnew'
      )
    )
    expect(screen.queryByLabelText(/アルバム名/)).not.toBeInTheDocument()
  })

  it('NAP-07: 認証確認中（loading:true）はローディング表示しリダイレクトしない', () => {
    authState = { currentUser: null, loading: true }
    render(<NewAlbumPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/アルバム名/)).not.toBeInTheDocument()
  })
})
