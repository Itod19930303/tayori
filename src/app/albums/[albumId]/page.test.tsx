import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album, Media } from '@/types'

// アルバム詳細ページ（pages 層）。useAuth でガード、useAlbum で存在確認・メンバー判定、
// useMediaList でメディア取得し AlbumDetailTemplate へ委譲する（基本設計書 4.6 / 8.1 #7）。
// フック群と next/navigation をモックし、正常/403/404/未ログイン/ローディングを検証する。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
let albumState: { album: Album | null; loading: boolean; notFound: boolean } = {
  album: null,
  loading: false,
  notFound: false,
}
let mediaState: { mediaItems: Media[]; loading: boolean } = {
  mediaItems: [],
  loading: false,
}
const push = vi.fn()
const replace = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbum', () => ({ useAlbum: () => albumState }))
vi.mock('@/hooks/useMediaList', () => ({ useMediaList: () => mediaState }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ albumId: 'album-1' }),
}))

import AlbumDetailPage from './page'

const mockUser = { uid: 'test-uid', displayName: 'テスト太郎' } as unknown as User

function makeAlbum(memberUids: string[]): Album {
  return {
    albumId: 'album-1',
    title: '湖畔で過ごした夏休み',
    memberUids,
    members: memberUids.map((uid) => ({ uid })),
    mediaCount: 0,
    createdAt: { toMillis: () => 0 },
    updatedAt: { toMillis: () => 0 },
  } as unknown as Album
}

const mockImageMedia = {
  mediaId: 'media-1',
  fileName: 'wedding_photo.jpg',
  contentType: 'image/jpeg',
  downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
  thumbnailUrl: null,
} as unknown as Media

describe('app/albums/[albumId]/page (アルバム詳細)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    albumState = { album: makeAlbum(['test-uid']), loading: false, notFound: false }
    mediaState = { mediaItems: [mockImageMedia], loading: false }
    vi.clearAllMocks()
  })

  it('ADP-01: メンバーがアクセスするとメディア一覧が表示される', () => {
    render(<AlbumDetailPage />)
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('ADP-02: 「アップロード」ボタン押下で upload ページへ遷移する', async () => {
    render(<AlbumDetailPage />)
    await userEvent.click(screen.getByRole('button', { name: /アップロード/ }))
    expect(push).toHaveBeenCalledWith('/albums/album-1/upload')
  })

  it('ADP-03: MediaCell 選択でプレビューページへ遷移する', async () => {
    render(<AlbumDetailPage />)
    // MediaCell（画像）をクリック
    await userEvent.click(screen.getByRole('img'))
    expect(push).toHaveBeenCalledWith('/albums/album-1/media/media-1')
  })

  it('ADP-04: 非メンバーは403相当を表示する', () => {
    albumState = {
      album: makeAlbum(['other-uid']),
      loading: false,
      notFound: false,
    }
    render(<AlbumDetailPage />)
    expect(
      screen.getByText(
        'このアルバムへのアクセス権がありません。管理者に招待を依頼してください。'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('ADP-05: 存在しないalbumIdは404相当を表示する', () => {
    albumState = { album: null, loading: false, notFound: true }
    render(<AlbumDetailPage />)
    expect(screen.getByText(/アルバムが見つかりません/)).toBeInTheDocument()
    expect(
      screen.queryByText(/アクセス権がありません/)
    ).not.toBeInTheDocument()
  })

  it('ADP-06: 未ログイン時は /login へリダイレクトする', async () => {
    authState = { currentUser: null, loading: false }
    render(<AlbumDetailPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?returnUrl=%2Falbums%2Falbum-1'
      )
    )
    expect(screen.queryByText('湖畔で過ごした夏休み')).not.toBeInTheDocument()
  })

  it('ADP-07: 認証・アルバム読み込み中はローディング表示にし403/404を出さない', () => {
    albumState = { album: null, loading: true, notFound: false }
    render(<AlbumDetailPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(
      screen.queryByText(/アクセス権がありません/)
    ).not.toBeInTheDocument()
  })

  it('ADP-08: メディア0件で空状態を表示する', () => {
    mediaState = { mediaItems: [], loading: false }
    render(<AlbumDetailPage />)
    expect(screen.getByText('家族の絆を未来へ')).toBeInTheDocument()
  })
})
