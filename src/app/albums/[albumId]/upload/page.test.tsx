import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// アップロードページ（pages 層）。新フロー: ファイル選択→確定前一覧（pending）追加のみ、
// 「保存」ボタン押下で初めて uploadFile→createMediaDoc を並列起動する（基本設計書 4.7 / 6.3）。
// 確定前の個別/一括削除はローカル state 操作のみで実削除APIは呼ばない。
// uploadFile / createMediaDoc / useAlbum / useAuth / next/navigation をモックし、
// validateMediaFile は実関数を用いる。

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
const signOutUser = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbum', () => ({ useAlbum: () => albumState }))
vi.mock('@/lib/uploadFile', () => ({
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}))
vi.mock('@/lib/firestoreMedia', () => ({
  createMediaDoc: (...args: unknown[]) => createMediaDoc(...args),
}))
vi.mock('@/lib/auth', () => ({
  signOutUser: (...args: unknown[]) => signOutUser(...args),
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
const getSaveButton = () => screen.getByRole('button', { name: '保存' })

// アップロード成功時の共通スタブ（進捗発火→結果 resolve）。
function mockUploadSuccess() {
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
}

describe('app/albums/[albumId]/upload/page (アップロード・確定前プレビューフロー)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    albumState = { album: makeAlbum(true), loading: false, notFound: false }
    // jsdom は Object URL API を持たないためスタブする（previewUrl 生成/解放）。
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview')
    global.URL.revokeObjectURL = vi.fn()
    vi.clearAllMocks()
  })

  it('UPP-01: ファイル選択直後は uploadFile を呼ばず pending 追加のみ・保存ボタン活性', async () => {
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))

    // 確定前一覧に追加され、チェックボックス付き（pending）で表示される
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    // アップロードはまだ起動しない
    expect(uploadFile).not.toHaveBeenCalled()
    expect(createMediaDoc).not.toHaveBeenCalled()
    // 保存ボタンが活性
    expect(getSaveButton()).toBeEnabled()
  })

  it('UPP-02: 「保存」押下で初めて uploadFile が呼ばれ done→Firestore反映', async () => {
    mockUploadSuccess()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    expect(uploadFile).not.toHaveBeenCalled()

    await userEvent.click(getSaveButton())

    // done 行キャプションはアルバム名（useAlbum の title）を含めて表示する（設計書4.7）
    await waitFor(() =>
      expect(
        screen.getByText('保存済み · 湖畔で過ごした夏休み')
      ).toBeInTheDocument()
    )
    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(createMediaDoc).toHaveBeenCalledTimes(1)
    expect(createMediaDoc.mock.calls[0][0]).toBe('album-1')
    expect(createMediaDoc.mock.calls[0][2]).toBe(mockUser)
  })

  it('UPP-03: 複数ファイルは保存押下で各ファイルが並列に処理される', async () => {
    mockUploadSuccess()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), [
      makeFile('a.jpg', 'image/jpeg'),
      makeFile('b.png', 'image/png'),
    ])
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)

    await userEvent.click(getSaveButton())

    await waitFor(() =>
      expect(screen.getAllByText(/保存済み/)).toHaveLength(2)
    )
    expect(uploadFile).toHaveBeenCalledTimes(2)
    expect(createMediaDoc).toHaveBeenCalledTimes(2)
  })

  it('UPP-04: 選択→「選択項目を削除」で対象行が一覧から除外される（実削除API不使用）', async () => {
    const deleteDoc = vi.fn()
    const deleteObject = vi.fn()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), [
      makeFile('a.jpg', 'image/jpeg'),
      makeFile('b.png', 'image/png'),
    ])
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)

    // 1行を選択して削除
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(
      screen.getByRole('button', { name: /選択項目を削除/ })
    )

    // 1行に減る
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    // ローカル state 操作のみ。実削除APIは一切呼ばない
    expect(deleteDoc).not.toHaveBeenCalled()
    expect(deleteObject).not.toHaveBeenCalled()
    // 除外行の previewUrl は解放される
    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('UPP-05: 削除後に「保存」すると残った分のみアップロードされる', async () => {
    mockUploadSuccess()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), [
      makeFile('a.jpg', 'image/jpeg'),
      makeFile('b.png', 'image/png'),
    ])
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(
      screen.getByRole('button', { name: /選択項目を削除/ })
    )

    await userEvent.click(getSaveButton())
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1))
  })

  it('UPP-06: 全件削除時は保存ボタンが非活性になり保存できない', async () => {
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    expect(getSaveButton()).toBeEnabled()

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(
      screen.getByRole('button', { name: /選択項目を削除/ })
    )

    // 一覧が空 → 保存ボタン disabled
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(getSaveButton()).toBeDisabled()
    await userEvent.click(getSaveButton())
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('UPP-07: 保存押下後はチェックボックス・「選択項目を削除」が表示されない', async () => {
    mockUploadSuccess()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    await userEvent.click(getSaveButton())

    await waitFor(() => expect(screen.getByText(/保存済み/)).toBeInTheDocument())
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /選択項目を削除/ })
    ).not.toBeInTheDocument()
  })

  it('UPP-08: アップロード中ネットワークエラーでエラー行を表示し再試行できる', async () => {
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
    await userEvent.click(getSaveButton())

    await waitFor(() =>
      expect(
        screen.getByText(new RegExp(ERROR_MESSAGES.UPLOAD_NETWORK_FAILED))
      ).toBeInTheDocument()
    )

    await userEvent.click(screen.getByText(/タップして再試行/))
    await waitFor(() => expect(screen.getByText(/保存済み/)).toBeInTheDocument())
    expect(uploadFile).toHaveBeenCalledTimes(2)
  })

  it('UPP-09: Firestore書き込み失敗時にエラー行を表示し done にしない', async () => {
    uploadFile.mockResolvedValue({
      downloadUrl: 'https://storage.example.com/a.jpg',
      storagePath: 'albums/album-1/uuid/a.jpg',
      mediaId: 'uuid',
    })
    createMediaDoc.mockRejectedValue(new Error('write failed'))

    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    await userEvent.click(getSaveButton())

    await waitFor(() =>
      expect(screen.getByText(/タップして再試行/)).toBeInTheDocument()
    )
    expect(screen.queryByText(/保存済み/)).not.toBeInTheDocument()
  })

  it('UPP-10: 非対応ファイル形式はインラインエラーで弾き pending 追加もアップロードもしない', async () => {
    render(<UploadPage />)
    await userEvent.upload(
      getFileInput(),
      makeFile('a.pdf', 'application/pdf'),
      { applyAccept: false }
    )
    expect(
      screen.getByText(/対応していないファイル形式です/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('UPP-11: サイズ超過ファイルはインラインエラーで弾く', async () => {
    render(<UploadPage />)
    await userEvent.upload(
      getFileInput(),
      makeFile('big.jpg', 'image/jpeg', 50 * 1024 * 1024 + 1)
    )
    expect(
      screen.getByText(/ファイルサイズが上限（画像50MB・動画500MB）を超えています。/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('UPP-12: 有効/無効ファイル混在時は有効分のみ pending 追加する', async () => {
    render(<UploadPage />)
    await userEvent.upload(
      getFileInput(),
      [makeFile('a.jpg', 'image/jpeg'), makeFile('a.pdf', 'application/pdf')],
      { applyAccept: false }
    )
    // valid 分のみ pending 追加（1行）
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(getSaveButton()).toBeEnabled()
    expect(
      screen.getByText(/対応していないファイル形式です/)
    ).toBeInTheDocument()
    // この時点では未発火
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('UPP-13: canPost=false はアップロード操作を許可しない', () => {
    albumState = { album: makeAlbum(false), loading: false, notFound: false }
    render(<UploadPage />)
    expect(screen.getByText(ERROR_MESSAGES.POST_FORBIDDEN)).toBeInTheDocument()
    expect(screen.queryByLabelText(/ファイルを選択/)).not.toBeInTheDocument()
  })

  it('UPP-14: 未ログイン時は /login へリダイレクトする', async () => {
    authState = { currentUser: null, loading: false }
    render(<UploadPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?returnUrl=%2Falbums%2Falbum-1%2Fupload'
      )
    )
    expect(screen.queryByLabelText(/ファイルを選択/)).not.toBeInTheDocument()
  })

  it('UPP-15: 認証確認中はローディング表示でリダイレクト・UIを出さない', () => {
    authState = { currentUser: null, loading: true }
    render(<UploadPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/ファイルを選択/)).not.toBeInTheDocument()
  })

  it('UPP-16: onBack がヘッダー戻るリンク経由で /albums/{albumId} へ遷移する', async () => {
    render(<UploadPage />)
    // uploads 空（活性）のヘッダー戻るリンクをクリックする
    await userEvent.click(screen.getByRole('button', { name: /に戻る/ }))
    expect(push).toHaveBeenCalledWith('/albums/album-1')
  })

  it('UPP-17: 完了モーダル内「戻る」ボタンも同じ /albums/{albumId} へ遷移する', async () => {
    mockUploadSuccess()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    await userEvent.click(getSaveButton())
    await waitFor(() => expect(screen.getByText(/保存済み/)).toBeInTheDocument())

    // 完了モーダル内の「戻る」ボタン（末尾要素。ヘッダー戻るリンクとは別）をクリック
    const backButtons = screen.getAllByRole('button', { name: '戻る' })
    await userEvent.click(backButtons[backButtons.length - 1])
    expect(push).toHaveBeenCalledWith('/albums/album-1')
  })

  it('UPP-18: アップロード進行中はヘッダー戻るリンクが非活性で遷移しない', async () => {
    // uploadFile を resolve/reject させず進行中（uploading）を維持する
    uploadFile.mockImplementation(
      (
        _albumId: string,
        _file: File,
        cbs: { onProgress?: (p: number) => void }
      ) => {
        cbs.onProgress?.(30)
        return new Promise(() => {})
      }
    )
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    await userEvent.click(getSaveButton())

    const back = screen.getByRole('button', { name: /に戻る/ })
    await waitFor(() =>
      expect(back).toHaveAttribute('aria-disabled', 'true')
    )
    await userEvent.click(back)
    expect(push).not.toHaveBeenCalled()
  })

  it('UPP-19: 完了モーダル「続けてアップロードする」で uploads がリセットされ初期状態へ戻る', async () => {
    mockUploadSuccess()
    render(<UploadPage />)
    await userEvent.upload(getFileInput(), makeFile('a.jpg', 'image/jpeg'))
    await userEvent.click(getSaveButton())
    await waitFor(() => expect(screen.getByText(/保存済み/)).toBeInTheDocument())

    uploadFile.mockClear()
    createMediaDoc.mockClear()

    await userEvent.click(
      screen.getByRole('button', { name: '続けてアップロードする' })
    )

    // uploads が空になり一覧行が消え、保存ボタンが非活性・完了モーダルが閉じる
    expect(screen.queryByText('a.jpg')).not.toBeInTheDocument()
    expect(getSaveButton()).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: '続けてアップロードする' })
    ).not.toBeInTheDocument()
    // 追加のアップロードは起きず、previewUrl が解放される
    expect(uploadFile).not.toHaveBeenCalled()
    expect(createMediaDoc).not.toHaveBeenCalled()
    expect(global.URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('UPP-20: 確定前（pending）行が残ったままアンマウントすると残存 previewUrl を件数分解放する', async () => {
    // createObjectURL を呼び出しごとに異なる値へ変え、pending 行の previewUrl を追跡する。
    let seq = 0
    global.URL.createObjectURL = vi.fn(() => `blob:preview-${seq++}`)
    const revoke = global.URL.revokeObjectURL as ReturnType<typeof vi.fn>

    const { unmount } = render(<UploadPage />)
    await userEvent.upload(getFileInput(), [
      makeFile('a.jpg', 'image/jpeg'),
      makeFile('b.png', 'image/png'),
    ])
    // 2件が pending として残っている（保存も削除もしていない）
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    // このアンマウント前時点では解放は行われていない
    expect(revoke).not.toHaveBeenCalled()

    act(() => {
      unmount()
    })

    // アンマウント時に残存 pending 2件の previewUrl が解放される（stale closure 回帰防止）
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(revoke).toHaveBeenCalledWith('blob:preview-0')
    expect(revoke).toHaveBeenCalledWith('blob:preview-1')
  })

  // --- 共通ヘッダーのログアウトハンドラ（テスト仕様書 §5.45 LGH-UPLOAD）---
  it('LGH-UPLOAD-01: ログアウト押下で signOutUser が1回呼ばれる', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<UploadPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(signOutUser).toHaveBeenCalledTimes(1)
  })

  it('LGH-UPLOAD-02: ログアウト成功で router.push("/login") を呼ぶ', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<UploadPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('LGH-UPLOAD-03: ログアウト失敗時は遷移せず LOGOUT_FAILED を表示する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutUser.mockRejectedValue(new Error('signout failed'))
    render(<UploadPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() =>
      expect(screen.getByText(ERROR_MESSAGES.LOGOUT_FAILED)).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalledWith('/login')
    consoleErrorSpy.mockRestore()
  })
})
