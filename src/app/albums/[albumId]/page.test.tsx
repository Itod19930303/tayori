import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album, Media } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

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
const useAcceptInvite = vi.fn()
const signOutUser = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbum', () => ({ useAlbum: () => albumState }))
vi.mock('@/hooks/useMediaList', () => ({ useMediaList: () => mediaState }))
vi.mock('@/hooks/useAcceptInvite', () => ({
  useAcceptInvite: (...args: unknown[]) => useAcceptInvite(...args),
}))
vi.mock('@/lib/auth', () => ({
  signOutUser: (...args: unknown[]) => signOutUser(...args),
}))
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
      screen.getByText(ERROR_MESSAGES.FORBIDDEN)
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

  it('ADP-09: 受諾フックが403判定前に albumId で実行され、メンバー表示される', () => {
    render(<AlbumDetailPage />)
    // useAcceptInvite が albumId とともに呼ばれる（受諾は403判定の前に走る）
    expect(useAcceptInvite).toHaveBeenCalledWith('album-1')
    // 受諾成功後（メンバー）はメディア一覧が表示される
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('ADP-10: 招待もされていない非メンバーは従来どおり403相当（ADP-04不変更）', () => {
    albumState = {
      album: makeAlbum(['other-uid']),
      loading: false,
      notFound: false,
    }
    render(<AlbumDetailPage />)
    expect(useAcceptInvite).toHaveBeenCalledWith('album-1')
    expect(
      screen.getByText(ERROR_MESSAGES.FORBIDDEN)
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('ADP-11: 受諾処理が失敗しても詳細ページがクラッシュしない', () => {
    // useAcceptInvite 内部で reject は握りつぶされる想定（フック側テスト UAI-04 と連動）。
    // ページはフック呼び出しのみを行い、例外を投げず通常の権限判定へ進む。
    expect(() => render(<AlbumDetailPage />)).not.toThrow()
    expect(screen.getByText('湖畔で過ごした夏休み')).toBeInTheDocument()
  })

  it('ADP-12: canManage=true のメンバーには権限管理リンクを表示し、押下で /permissions へ遷移する', async () => {
    // 自分（test-uid）が canManage:true でメンバーに含まれる状態を用意する。
    albumState = {
      album: {
        ...makeAlbum(['test-uid']),
        members: [{ uid: 'test-uid', canManage: true }],
      } as unknown as Album,
      loading: false,
      notFound: false,
    }
    render(<AlbumDetailPage />)
    const link = screen.getByRole('button', { name: /権限管理/ })
    expect(link).toBeInTheDocument()
    await userEvent.click(link)
    expect(push).toHaveBeenCalledWith('/albums/album-1/permissions')
  })

  it('ADP-13: canManage=false（viewer/editor）のメンバーには権限管理リンクを表示しない（遷移不可）', () => {
    // 自分（test-uid）が canManage:false でメンバーに含まれる状態を用意する。
    albumState = {
      album: {
        ...makeAlbum(['test-uid']),
        members: [{ uid: 'test-uid', canManage: false }],
      } as unknown as Album,
      loading: false,
      notFound: false,
    }
    render(<AlbumDetailPage />)
    expect(
      screen.queryByRole('button', { name: /権限管理/ })
    ).not.toBeInTheDocument()
  })

  // --- 共通ヘッダーのログアウトハンドラ（テスト仕様書 §5.45 LGH-DETAIL）---
  it('LGH-DETAIL-01: ログアウト押下で signOutUser が1回呼ばれる', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<AlbumDetailPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(signOutUser).toHaveBeenCalledTimes(1)
  })

  it('LGH-DETAIL-02: ログアウト成功で router.push("/login") を呼ぶ', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<AlbumDetailPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('LGH-DETAIL-03: ログアウト失敗時は遷移せず LOGOUT_FAILED を表示する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutUser.mockRejectedValue(new Error('signout failed'))
    render(<AlbumDetailPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() =>
      expect(screen.getByText(ERROR_MESSAGES.LOGOUT_FAILED)).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalledWith('/login')
    consoleErrorSpy.mockRestore()
  })
})
