import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import type { Album, AlbumMember } from '@/types'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

// 権限管理ページ（pages 層、基本設計書 4.8 / 6.7 / 7.3）。三段ガード・受諾フック実行・
// 招待/取り消し/保存のオーケストレーションを検証する。フック群・firestorePermissions・
// next/navigation をモックする（テスト仕様書 5.39）。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
let albumState: { album: Album | null; loading: boolean; notFound: boolean } = {
  album: null,
  loading: false,
  notFound: false,
}
let invitesState: { invites: AlbumMember[]; loading: boolean } = {
  invites: [],
  loading: false,
}
const push = vi.fn()
const replace = vi.fn()
const useAcceptInvite = vi.fn()
const createInvite = vi.fn()
const cancelInvite = vi.fn()
const updateInvite = vi.fn()
const updateAlbumMembers = vi.fn()
const signOutUser = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useAlbum', () => ({ useAlbum: () => albumState }))
vi.mock('@/hooks/usePendingInvites', () => ({
  usePendingInvites: () => invitesState,
}))
vi.mock('@/hooks/useAcceptInvite', () => ({
  useAcceptInvite: (...args: unknown[]) => useAcceptInvite(...args),
}))
vi.mock('@/lib/firestorePermissions', () => ({
  createInvite: (...args: unknown[]) => createInvite(...args),
  cancelInvite: (...args: unknown[]) => cancelInvite(...args),
  updateInvite: (...args: unknown[]) => updateInvite(...args),
  updateAlbumMembers: (...args: unknown[]) => updateAlbumMembers(...args),
}))
vi.mock('@/lib/auth', () => ({
  signOutUser: (...args: unknown[]) => signOutUser(...args),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ albumId: 'album-1' }),
}))

import PermissionsPage from './page'

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
  email: 'test@example.com',
} as unknown as User

const ownerMe = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
  email: 'test@example.com',
  role: 'owner',
  canView: true,
  canPost: true,
  canManage: true,
  joinedAt: { toMillis: () => 0 },
} as unknown as AlbumMember

const editorOther = {
  uid: 'editor-uid',
  displayName: '編集者花子',
  email: 'editor@example.com',
  role: 'editor',
  canView: true,
  canPost: false,
  canManage: false,
  joinedAt: { toMillis: () => 0 },
} as unknown as AlbumMember

const invitedMember = {
  uid: '',
  displayName: 'invitee@example.com',
  email: 'invitee@example.com',
  role: 'viewer',
  canView: true,
  canPost: false,
  canManage: false,
  invited: true,
} as unknown as AlbumMember

function makeAlbum(members: AlbumMember[]): Album {
  return {
    albumId: 'album-1',
    title: '湖畔で過ごした夏休み',
    ownerId: 'test-uid',
    memberUids: members.map((m) => m.uid),
    members,
    mediaCount: 0,
    createdAt: { toMillis: () => 0 },
    updatedAt: { toMillis: () => 0 },
  } as unknown as Album
}

describe('app/albums/[albumId]/permissions/page (権限管理)', () => {
  beforeEach(() => {
    authState = { currentUser: mockUser, loading: false }
    albumState = {
      album: makeAlbum([ownerMe, editorOther]),
      loading: false,
      notFound: false,
    }
    invitesState = { invites: [invitedMember], loading: false }
    vi.clearAllMocks()
    createInvite.mockResolvedValue(undefined)
    cancelInvite.mockResolvedValue(undefined)
    updateInvite.mockResolvedValue(undefined)
    updateAlbumMembers.mockResolvedValue(undefined)
  })

  it('PP-01: canManage メンバーで権限管理UI（メンバー行 + 招待中行）が表示される', () => {
    render(<PermissionsPage />)
    expect(screen.getByText('アルバムの閲覧権限')).toBeInTheDocument()
    // 「テスト太郎」は TopHeader（共通ヘッダー）とメンバー行の2箇所に表示される（テスト仕様書 §5.45 回帰注記）。
    // メンバー行が描画されていることを、ヘッダー分を含む2件表示で確認する。
    expect(screen.getAllByText('テスト太郎')).toHaveLength(2)
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument()
    expect(screen.getByText('招待中')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('PP-02: canManage=false は403相当を表示する', () => {
    albumState = {
      album: makeAlbum([{ ...ownerMe, role: 'viewer', canManage: false }]),
      loading: false,
      notFound: false,
    }
    render(<PermissionsPage />)
    expect(
      screen.getByText(ERROR_MESSAGES.FORBIDDEN)
    ).toBeInTheDocument()
    expect(screen.queryByText('アルバムの閲覧権限')).not.toBeInTheDocument()
  })

  it('PP-03: 未ログイン時は /login へ replace する', async () => {
    authState = { currentUser: null, loading: false }
    render(<PermissionsPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?returnUrl=%2Falbums%2Falbum-1%2Fpermissions'
      )
    )
  })

  it('PP-04: アルバム読込中はローディング表示で403を出さない', () => {
    albumState = { album: null, loading: true, notFound: false }
    render(<PermissionsPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText(/アクセス権がありません/)).not.toBeInTheDocument()
  })

  it('PP-05: 保存で確定メンバーのみ updateAlbumMembers を呼ぶ（招待中を除外）', async () => {
    render(<PermissionsPage />)
    // 確定メンバー（editor）の投稿権限を変更して isDirty にする
    await userEvent.click(screen.getByLabelText('編集者花子 の投稿権限'))
    await userEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await waitFor(() => expect(updateAlbumMembers).toHaveBeenCalledTimes(1))
    const [albumIdArg, members, memberUids] = updateAlbumMembers.mock.calls[0]
    expect(albumIdArg).toBe('album-1')
    expect((members as AlbumMember[]).some((m) => m.invited)).toBe(false)
    expect(members).toHaveLength(2)
    expect(memberUids).toEqual(['test-uid', 'editor-uid'])
  })

  it('PP-06: メール招待で createInvite を呼び完了メッセージを表示する', async () => {
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /家族を招待/ }))
    await userEvent.type(screen.getByLabelText(/メールアドレス/), 'invitee@example.com')
    await userEvent.click(screen.getByRole('button', { name: '招待する' }))
    await waitFor(() =>
      expect(createInvite).toHaveBeenCalledWith(
        'album-1',
        'invitee@example.com',
        { role: 'viewer', canView: true, canPost: false, canManage: false },
        mockUser
      )
    )
    expect(
      await screen.findByText(SUCCESS_MESSAGES.INVITE_REGISTERED)
    ).toBeInTheDocument()
  })

  it('PP-07: 招待取り消しで cancelInvite を呼び確定メンバー削除は呼ばない', async () => {
    render(<PermissionsPage />)
    await userEvent.click(
      screen.getByRole('button', { name: /招待の操作メニュー/ })
    )
    await userEvent.click(screen.getByRole('button', { name: '招待を取り消す' }))
    expect(cancelInvite).toHaveBeenCalledWith('album-1', 'invitee@example.com')
    expect(updateAlbumMembers).not.toHaveBeenCalled()
  })

  it('PP-08: 招待中行の権限変更で updateInvite を呼ぶ（members保存とは別経路）', async () => {
    render(<PermissionsPage />)
    // 招待中メンバー行の投稿権限チェックボックスを変更
    await userEvent.click(screen.getByLabelText('invitee@example.com の投稿権限'))
    expect(updateInvite).toHaveBeenCalledWith('album-1', 'invitee@example.com', {
      canPost: true,
    })
    expect(updateAlbumMembers).not.toHaveBeenCalled()
  })

  it('PP-09: 403判定の前に useAcceptInvite が実行される', () => {
    render(<PermissionsPage />)
    expect(useAcceptInvite).toHaveBeenCalledWith('album-1')
  })

  it('PP-10: 保存失敗時に日本語エラーを表示する', async () => {
    updateAlbumMembers.mockRejectedValue(new Error('save failed'))
    render(<PermissionsPage />)
    await userEvent.click(screen.getByLabelText('編集者花子 の投稿権限'))
    await userEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    expect(
      await screen.findByText(ERROR_MESSAGES.SAVE_FAILED)
    ).toBeInTheDocument()
  })

  it('PP-11: 招待取り消し失敗時に日本語エラーを表示する', async () => {
    cancelInvite.mockRejectedValue(new Error('cancel failed'))
    render(<PermissionsPage />)
    await userEvent.click(
      screen.getByRole('button', { name: /招待の操作メニュー/ })
    )
    await userEvent.click(screen.getByRole('button', { name: '招待を取り消す' }))
    expect(
      await screen.findByText(ERROR_MESSAGES.CANCEL_FAILED)
    ).toBeInTheDocument()
  })

  it('PP-12: 招待登録失敗時に日本語エラーを表示する（設計書8.1 #6）', async () => {
    createInvite.mockRejectedValue(new Error('invite failed'))
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /家族を招待/ }))
    await userEvent.type(screen.getByLabelText(/メールアドレス/), 'invitee@example.com')
    await userEvent.click(screen.getByRole('button', { name: '招待する' }))
    expect(
      await screen.findByText(ERROR_MESSAGES.SAVE_FAILED)
    ).toBeInTheDocument()
  })

  it('PP-13: 招待モーダルを閉じる操作でモーダルが閉じる', async () => {
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /家族を招待/ }))
    expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /閉じる/ }))
    expect(screen.queryByLabelText(/メールアドレス/)).not.toBeInTheDocument()
  })

  it('PP-14: 戻るリンクでアルバム詳細へ遷移する', async () => {
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /に戻る/ }))
    expect(push).toHaveBeenCalledWith('/albums/album-1')
  })

  // --- 共通ヘッダーのログアウトハンドラ（テスト仕様書 §5.45 LGH-PERM）---
  it('LGH-PERM-01: ログアウト押下で signOutUser が1回呼ばれる', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(signOutUser).toHaveBeenCalledTimes(1)
  })

  it('LGH-PERM-02: ログアウト成功で router.push("/login") を呼ぶ', async () => {
    signOutUser.mockResolvedValue(undefined)
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('LGH-PERM-03: ログアウト失敗時は遷移せず LOGOUT_FAILED を表示する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutUser.mockRejectedValue(new Error('signout failed'))
    render(<PermissionsPage />)
    await userEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await waitFor(() =>
      expect(screen.getByText(ERROR_MESSAGES.LOGOUT_FAILED)).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalledWith('/login')
    consoleErrorSpy.mockRestore()
  })
})
