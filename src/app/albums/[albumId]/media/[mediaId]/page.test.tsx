import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album, Media } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// メディアプレビュー単体画面（pages 層 / MediaPreviewPage、基本設計書 4.9 / 4.6 / 5.1 / 7.3 / 8.1 #7）。
// useAuth でガード、useAlbum で memberUids 判定（403相当）、useMedia で mediaId 存在確認（404相当）し、
// media.contentType で画像/動画を分岐表示する。フック群と next/navigation をモックし、
// getPreviewUrl は実関数のまま用いる（provider分岐を壊さない = MPP-13）。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
let albumState: { album: Album | null; loading: boolean; notFound: boolean } = {
  album: null,
  loading: false,
  notFound: false,
}
let mediaState: { media: Media | null; loading: boolean; notFound: boolean } = {
  media: null,
  loading: false,
  notFound: false,
}
const push = vi.fn()
const replace = vi.fn()
const signOutUser = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbum', () => ({ useAlbum: () => albumState }))
vi.mock('@/hooks/useMedia', () => ({ useMedia: () => mediaState }))
vi.mock('@/lib/auth', () => ({
  signOutUser: (...args: unknown[]) => signOutUser(...args),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ albumId: 'album-1', mediaId: 'media-1' }),
}))

import MediaPreviewPage from './page'

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

function makeMedia(overrides: Partial<Media>): Media {
  return {
    mediaId: 'media-1',
    albumId: 'album-1',
    fileName: 'wedding_photo.jpg',
    contentType: 'image/jpeg',
    size: 1024,
    storagePath: 'albums/album-1/media-1/wedding_photo.jpg',
    downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
    uploadedBy: 'test-uid',
    uploaderName: 'テスト太郎',
    createdAt: { toMillis: () => new Date('2026-07-20').getTime() },
    provider: 'firebase',
    ...overrides,
  } as unknown as Media
}

const mockImageMedia = makeMedia({ contentType: 'image/jpeg', thumbnailUrl: undefined })
const mockVideoMedia = makeMedia({
  mediaId: 'media-1',
  contentType: 'video/mp4',
  fileName: 'trip.mp4',
  downloadUrl: 'https://storage.example.com/trip.mp4',
})

describe('app/albums/[albumId]/media/[mediaId]/page (MediaPreviewPage)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    albumState = { album: makeAlbum(['test-uid']), loading: false, notFound: false }
    mediaState = { media: mockImageMedia, loading: false, notFound: false }
    vi.clearAllMocks()
  })

  it('MPP-01: 画像メディアを <img>（object-contain, src=getPreviewUrl）で表示する', () => {
    render(<MediaPreviewPage />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', mockImageMedia.downloadUrl)
    expect(img).toHaveClass('object-contain')
    // 画像時は <video> を表示しない
    expect(document.querySelector('video')).toBeNull()
  })

  it('MPP-02: 動画メディアを <video controls preload="metadata"> で表示する', () => {
    mediaState = { media: mockVideoMedia, loading: false, notFound: false }
    const { container } = render(<MediaPreviewPage />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('preload', 'metadata')
    // 動画時は <img>（メディア本体）を表示しない
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('MPP-03: 右サイドパネルに投稿者情報・ファイル名・投稿日時を表示する', () => {
    render(<MediaPreviewPage />)
    // 「テスト太郎」は TopHeader（共通ヘッダー）と右サイドパネルの投稿者名の2箇所に表示される
    // （テスト仕様書 §5.45 回帰注記）。投稿者名が描画されていることを2件表示で確認する。
    expect(screen.getAllByText('テスト太郎')).toHaveLength(2)
    expect(screen.getByText('wedding_photo.jpg')).toBeInTheDocument()
    // 投稿日時（2026年）が表示される
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('MPP-04: ダウンロードリンク（a href=downloadUrl download）を配置する', async () => {
    render(<MediaPreviewPage />)
    const link = screen.getByRole('link', { name: /ダウンロード/ })
    expect(link).toHaveAttribute('href', mockImageMedia.downloadUrl)
    expect(link).toHaveAttribute('download')
    // クリックしても preventDefault で既定挙動を阻害しない
    await userEvent.click(link)
  })

  it('MPP-05: 非メンバーがアクセスすると403相当を表示する', () => {
    albumState = { album: makeAlbum(['other-uid']), loading: false, notFound: false }
    render(<MediaPreviewPage />)
    expect(
      screen.getByText(ERROR_MESSAGES.FORBIDDEN)
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toBeNull()
  })

  it('MPP-06: 存在しない mediaId は404相当を表示する（403文言と区別）', () => {
    mediaState = { media: null, loading: false, notFound: true }
    render(<MediaPreviewPage />)
    expect(screen.getByText(/メディアが見つかりません/)).toBeInTheDocument()
    expect(screen.queryByText(/アクセス権がありません/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('MPP-07: thumbnailUrl 未設定でも downloadUrl フォールバックで表示が壊れない', () => {
    mediaState = {
      media: makeMedia({ thumbnailUrl: undefined }),
      loading: false,
      notFound: false,
    }
    render(<MediaPreviewPage />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', mockImageMedia.downloadUrl)
  })

  it('MPP-08: 想定外 contentType はフォールバック表示（img/video なし・ダウンロード主導線）', () => {
    mediaState = {
      media: makeMedia({ contentType: 'application/octet-stream' }),
      loading: false,
      notFound: false,
    }
    render(<MediaPreviewPage />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toBeNull()
    // ダウンロードリンクは主導線として残る
    expect(screen.getByRole('link', { name: /ダウンロード/ })).toHaveAttribute(
      'href',
      mockImageMedia.downloadUrl
    )
  })

  it('MPP-09: メンバー（memberUids に自分を含む）はアクセスでき、403/404・リダイレクトが出ない', () => {
    render(<MediaPreviewPage />)
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByText(/アクセス権がありません/)).not.toBeInTheDocument()
    expect(screen.queryByText(/見つかりません/)).not.toBeInTheDocument()
  })

  it('MPP-10: 未ログイン時は /login へリダイレクトする', async () => {
    authState = { currentUser: null, loading: false }
    render(<MediaPreviewPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?returnUrl=%2Falbums%2Falbum-1%2Fmedia%2Fmedia-1'
      )
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('MPP-11: 読み込み中（loading:true）はローディング表示にし403/404を出さない', () => {
    albumState = { album: null, loading: true, notFound: false }
    render(<MediaPreviewPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByText(/アクセス権がありません/)).not.toBeInTheDocument()
    expect(screen.queryByText(/見つかりません/)).not.toBeInTheDocument()
  })

  it('MPP-12: useParams の albumId/mediaId を解決して表示できる（ADP-03 遷移先との整合）', () => {
    render(<MediaPreviewPage />)
    // albumId/mediaId が解決され、メディア本体が表示される（既知404の解消）
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  // --- 403/404 通知画面でも共通ヘッダー（ログアウト手段）が提供されること（CodeRabbit Major指摘）---
  it('MPP-13: 非メンバー403相当でも TopHeader のログアウトボタンが表示される', () => {
    albumState = { album: makeAlbum(['other-uid']), loading: false, notFound: false }
    render(<MediaPreviewPage />)
    expect(screen.getByText(ERROR_MESSAGES.FORBIDDEN)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ログアウト/ })).toBeInTheDocument()
  })

  it('MPP-14: アルバム不在404相当でも TopHeader のログアウトボタンが表示される', () => {
    albumState = { album: null, loading: false, notFound: true }
    render(<MediaPreviewPage />)
    expect(screen.getByText(ERROR_MESSAGES.ALBUM_NOT_FOUND)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ログアウト/ })).toBeInTheDocument()
  })

  it('MPP-15: メディア不在404相当のログアウト押下で signOutUser が呼ばれる', async () => {
    signOutUser.mockResolvedValue(undefined)
    mediaState = { media: null, loading: false, notFound: true }
    render(<MediaPreviewPage />)
    expect(screen.getByText(ERROR_MESSAGES.MEDIA_NOT_FOUND)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(signOutUser).toHaveBeenCalledTimes(1)
  })

  // --- 共通ヘッダーのログアウトハンドラ（テスト仕様書 §5.45 LGH-PREVIEW）---
  it('LGH-PREVIEW-01: ログアウト押下で signOutUser が1回呼ばれる', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<MediaPreviewPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(signOutUser).toHaveBeenCalledTimes(1)
  })

  it('LGH-PREVIEW-02: ログアウト成功で router.push("/login") を呼ぶ', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<MediaPreviewPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('LGH-PREVIEW-03: ログアウト失敗時は遷移せず LOGOUT_FAILED を表示する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutUser.mockRejectedValue(new Error('signout failed'))
    render(<MediaPreviewPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() =>
      expect(screen.getByText(ERROR_MESSAGES.LOGOUT_FAILED)).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalledWith('/login')
    consoleErrorSpy.mockRestore()
  })
})
