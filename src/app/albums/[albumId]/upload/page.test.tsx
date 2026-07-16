import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album } from '@/types'

// アップロードページ（pages 層）。useAuth でガード、canPost 判定、ファイル選択→
// validateMediaFile→uploadFile→createMediaDoc のオーケストレーションを検証する
// （基本設計書 4.7 / 6.3 / 7.3 / 8.1 #3〜#5）。uploadFile / createMediaDoc / useAlbum /
// useAuth / next/navigation をモックし、validateMediaFile は実関数を用いる。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
let albumState: { album: Album | null; loading: boolean; notFound: boolean } = {
  album: null,
  loading: false,
  notFound: false,
}
const push = vi.fn()
const replace = vi.fn()
const uploadFile = vi.fn()
const createMediaDoc = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbum', () => ({ useAlbum: () => albumState }))
vi.mock('@/lib/uploadFile', () => ({
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}))
vi.mock('@/lib/firestoreMedia', () => ({
  createMediaDoc: (...args: unknown[]) => createMediaDoc(...args),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ albumId: 'album-1' }),
}))

import UploadPage from './page'

const mockUser = { uid: 'test-uid', displayName: 'テスト太郎' } as unknown as User

function makeAlbum(canPost: boolean): Album {
  return {
    albumId: 'album-1',
    title: '湖畔で過ごした夏休み',
    memberUids: ['test-uid'],
    members: [
      { uid: 'test-uid', canView: true, canPost, canManage: false, role: 'editor' },
    ],
  } as unknown as Album
}

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const getFileInput = () =>
  screen.getByLabelText(/ファイルを選択/) as HTMLInputElement

describe('app/albums/[albumId]/upload/page (アップロード)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    albumState = { album: makeAlbum(true), loading: false, notFound: false }
    vi.clearAllMocks()
  })

  it('UPP-01: ファイル選択→アップロード成功で done になり Firestore へ反映する', async () => {
    uploadFile.mockImplementation(
      async (
        _albumId: string,
        _file: File,
        cbs: { onProgress?: (p: number) => void }
      ) => {
        cbs.onProgress?.(50)
        return {
          downloadUrl: 'https://storage.example.com/a.jpg',
          storagePath: 'albums/album-1/uuid/a.jpg',
          mediaId: 'uuid',
        }
      }
    )
    createMediaDoc.mockResolvedValue(undefined)

    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))

    await waitFor(() => expect(screen.getByText(/保存済み/)).toBeInTheDocument())
    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(createMediaDoc).toHaveBeenCalledTimes(1)
    expect(createMediaDoc.mock.calls[0][0]).toBe('album-1')
    expect(createMediaDoc.mock.calls[0][2]).toBe(mockUser)
  })

  it('UPP-02: 複数ファイルは各ファイルが個別に処理される', async () => {
    uploadFile.mockResolvedValue({
      downloadUrl: 'https://storage.example.com/a.jpg',
      storagePath: 'albums/album-1/uuid/a.jpg',
      mediaId: 'uuid',
    })
    createMediaDoc.mockResolvedValue(undefined)

    render(<UploadPage />)
    await userEvent.upload(getFileInput(), [
      makeFile('a.jpg', 'image/jpeg'),
      makeFile('b.png', 'image/png'),
    ])

    await waitFor(() =>
      expect(screen.getAllByText(/保存済み/)).toHaveLength(2)
    )
    expect(uploadFile).toHaveBeenCalledTimes(2)
    expect(createMediaDoc).toHaveBeenCalledTimes(2)
  })

  it('UPP-03: アップロード中ネットワークエラーでエラー行を表示し再試行できる', async () => {
    uploadFile
      .mockImplementationOnce(
        async (
          _albumId: string,
          _file: File,
          cbs: { onError?: (e: unknown) => void }
        ) => {
          const err = { code: 'storage/retry-limit-exceeded' }
          cbs.onError?.(err)
          throw err
        }
      )
      .mockResolvedValueOnce({
        downloadUrl: 'https://storage.example.com/a.jpg',
        storagePath: 'albums/album-1/uuid/a.jpg',
        mediaId: 'uuid',
      })
    createMediaDoc.mockResolvedValue(undefined)

    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))

    await waitFor(() =>
      expect(
        screen.getByText(/ネットワークが切断されました。タップして再試行してください。/)
      ).toBeInTheDocument()
    )

    // エラー行クリックで再試行
    await userEvent.click(screen.getByText(/タップして再試行/))
    await waitFor(() => expect(screen.getByText(/保存済み/)).toBeInTheDocument())
    expect(uploadFile).toHaveBeenCalledTimes(2)
  })

  it('UPP-04: Firestore書き込み失敗時にエラー行を表示し done にしない', async () => {
    uploadFile.mockResolvedValue({
      downloadUrl: 'https://storage.example.com/a.jpg',
      storagePath: 'albums/album-1/uuid/a.jpg',
      mediaId: 'uuid',
    })
    createMediaDoc.mockRejectedValue(new Error('write failed'))

    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))

    await waitFor(() =>
      expect(screen.getByText(/タップして再試行/)).toBeInTheDocument()
    )
    expect(screen.queryByText(/保存済み/)).not.toBeInTheDocument()
  })

  it('UPP-05: 非対応ファイル形式はインラインエラーで弾きアップロードしない', async () => {
    render(<UploadPage />)
    // input の accept 属性は UX 上の絞り込みで、実バリデーションは validateMediaFile が担う。
    // ここでは検証ロジックを通すため applyAccept:false で非対応ファイルを入力する。
    await userEvent.upload(
      getFileInput(),
      makeFile('a.pdf', 'application/pdf'),
      { applyAccept: false }
    )
    expect(
      screen.getByText(/対応していないファイル形式です/)
    ).toBeInTheDocument()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('UPP-06: サイズ超過ファイルはインラインエラーで弾く', async () => {
    render(<UploadPage />)
    await userEvent.upload(
      getFileInput(),
      makeFile('big.jpg', 'image/jpeg', 50 * 1024 * 1024 + 1)
    )
    expect(
      screen.getByText(/ファイルサイズが上限（画像50MB・動画500MB）を超えています。/)
    ).toBeInTheDocument()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('UPP-07: 有効/無効ファイル混在時は有効分のみアップロードする', async () => {
    uploadFile.mockResolvedValue({
      downloadUrl: 'https://storage.example.com/a.jpg',
      storagePath: 'albums/album-1/uuid/a.jpg',
      mediaId: 'uuid',
    })
    createMediaDoc.mockResolvedValue(undefined)

    render(<UploadPage />)
    await userEvent.upload(
      getFileInput(),
      [makeFile('a.jpg', 'image/jpeg'), makeFile('a.pdf', 'application/pdf')],
      { applyAccept: false }
    )

    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1))
    expect(
      screen.getByText(/対応していないファイル形式です/)
    ).toBeInTheDocument()
  })

  it('UPP-08: canPost=false はアップロード操作を許可しない', () => {
    albumState = { album: makeAlbum(false), loading: false, notFound: false }
    render(<UploadPage />)
    expect(screen.getByText(/投稿権限がありません/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/ファイルを選択/)).not.toBeInTheDocument()
  })

  it('UPP-09: 未ログイン時は /login へリダイレクトする', async () => {
    authState = { currentUser: null, loading: false }
    render(<UploadPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?returnUrl=%2Falbums%2Falbum-1%2Fupload'
      )
    )
    expect(screen.queryByLabelText(/ファイルを選択/)).not.toBeInTheDocument()
  })

  it('UPP-10: 認証確認中はローディング表示でリダイレクト・UIを出さない', () => {
    authState = { currentUser: null, loading: true }
    render(<UploadPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/ファイルを選択/)).not.toBeInTheDocument()
  })
})
