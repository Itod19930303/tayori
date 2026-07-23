import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'
import type { PendingInvite } from '@/types'

// firestorePermissions.ts は招待の作成/更新/取り消し/受諾を担う Firestore ラッパー
// （基本設計書 6.7 / 5.1 / 7.1、テスト仕様書 5.33）。実DB書き込みを避けるため
// firebase/firestore をモジュール全体でモックし（テスト仕様書 4.11）、
// メール正規化（.trim().toLowerCase()）・書き込みペイロード・受諾バッチの構造を検証する。

const doc = vi.fn((..._args: unknown[]) => ({ __type: 'doc', path: _args.slice(1) }))
const setDoc = vi.fn()
const updateDoc = vi.fn()
const deleteDoc = vi.fn()
const getDoc = vi.fn()
const arrayUnion = vi.fn((...v: unknown[]) => ({ __type: 'arrayUnion', v }))
const serverTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }))
const timestampNow = vi.fn(() => ({ __type: 'timestamp-now' }))
const batchUpdate = vi.fn()
const batchDelete = vi.fn()
const batchCommit = vi.fn()
const writeBatch = vi.fn((..._args: unknown[]) => ({
  update: batchUpdate,
  delete: batchDelete,
  commit: batchCommit,
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: (...args: unknown[]) => doc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  getDoc: (...args: unknown[]) => getDoc(...args),
  arrayUnion: (...args: unknown[]) => arrayUnion(...args),
  writeBatch: (...args: unknown[]) => writeBatch(...args),
  serverTimestamp: () => serverTimestamp(),
  Timestamp: { now: () => timestampNow() },
}))

vi.mock('./firebase', () => ({
  auth: {},
  db: { __type: 'db-stub' },
  storage: {},
}))

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
  email: 'invitee@example.com',
  photoURL: 'https://example.com/photo.png',
} as unknown as User

const viewerPreset = {
  role: 'viewer' as const,
  canView: true,
  canPost: false,
  canManage: false,
}

const mockPendingInvite = {
  email: 'invitee@example.com',
  role: 'viewer',
  canView: true,
  canPost: false,
  canManage: false,
  invitedBy: 'admin-uid',
  invitedAt: { toMillis: () => 0 },
} as unknown as PendingInvite

describe('lib/firestorePermissions - createInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FP-01: 正規化メールをドキュメントIDに setDoc し、email/invitedAt/invitedBy を含む', async () => {
    setDoc.mockResolvedValue(undefined)
    const { createInvite } = await import('./firestorePermissions')
    await createInvite('album-1', ' Invitee@Example.com ', viewerPreset, mockUser)
    expect(doc).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'pendingInvites',
      'invitee@example.com'
    )
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.email).toBe('invitee@example.com')
    expect(payload.invitedBy).toBe('test-uid')
    expect(payload.invitedAt).toEqual({ __type: 'serverTimestamp' })
    expect(payload.role).toBe('viewer')
  })

  it('FP-02: メール正規化が .trim().toLowerCase() で行われる', async () => {
    setDoc.mockResolvedValue(undefined)
    const { createInvite } = await import('./firestorePermissions')
    await createInvite('album-1', '  TARO@Example.COM ', viewerPreset, mockUser)
    const idArg = doc.mock.calls[0].slice(1)
    expect(idArg).toContain('taro@example.com')
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.email).toBe('taro@example.com')
  })

  it('FP-03: 同一メール再招待で同一ドキュメントを上書きし invitedAt を更新する', async () => {
    setDoc.mockResolvedValue(undefined)
    const { createInvite } = await import('./firestorePermissions')
    await createInvite('album-1', 'invitee@example.com', viewerPreset, mockUser)
    await createInvite('album-1', 'invitee@example.com', viewerPreset, mockUser)
    expect(setDoc).toHaveBeenCalledTimes(2)
    const first = doc.mock.calls[0].slice(1)
    const second = doc.mock.calls[1].slice(1)
    expect(first).toEqual(second)
    const p1 = setDoc.mock.calls[0][1] as Record<string, unknown>
    const p2 = setDoc.mock.calls[1][1] as Record<string, unknown>
    expect(p1.invitedAt).toEqual({ __type: 'serverTimestamp' })
    expect(p2.invitedAt).toEqual({ __type: 'serverTimestamp' })
  })

  it('FP-10: setDoc 失敗時にエラーを伝播する', async () => {
    setDoc.mockRejectedValue(new Error('write failed'))
    const { createInvite } = await import('./firestorePermissions')
    await expect(
      createInvite('album-1', 'invitee@example.com', viewerPreset, mockUser)
    ).rejects.toThrow('write failed')
  })
})

describe('lib/firestorePermissions - updateInvite / cancelInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FP-04: updateInvite が招待ドキュメントを個別 updateDoc し members へは書かない', async () => {
    updateDoc.mockResolvedValue(undefined)
    const { updateInvite } = await import('./firestorePermissions')
    await updateInvite('album-1', 'invitee@example.com', {
      role: 'editor',
      canPost: true,
    })
    expect(doc).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'pendingInvites',
      'invitee@example.com'
    )
    expect(updateDoc).toHaveBeenCalledTimes(1)
    // members 配列を持つ albums 本体への updateDoc は呼ばれない（経路分離）
    const target = doc.mock.calls[0].slice(1)
    expect(target).toContain('pendingInvites')
  })

  it('FP-05: cancelInvite が正規化メールの招待ドキュメントを deleteDoc する', async () => {
    deleteDoc.mockResolvedValue(undefined)
    const { cancelInvite } = await import('./firestorePermissions')
    await cancelInvite('album-1', ' Invitee@Example.com ')
    expect(doc).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'pendingInvites',
      'invitee@example.com'
    )
    expect(deleteDoc).toHaveBeenCalledTimes(1)
    // 確定メンバー削除（albums 本体）は呼ばれない（今回スコープ外）
    expect(updateDoc).not.toHaveBeenCalled()
  })
})

describe('lib/firestorePermissions - acceptPendingInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FP-06: 招待存在時に writeBatch で members/memberUids へ arrayUnion + 招待削除する', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockPendingInvite,
    })
    batchCommit.mockResolvedValue(undefined)
    const { acceptPendingInvite } = await import('./firestorePermissions')
    const result = await acceptPendingInvite('album-1', mockUser)
    expect(batchUpdate).toHaveBeenCalledTimes(1)
    expect(batchDelete).toHaveBeenCalledTimes(1)
    expect(batchCommit).toHaveBeenCalledTimes(1)
    const updatePayload = batchUpdate.mock.calls[0][1] as Record<string, unknown>
    const membersUnion = updatePayload.members as { v: Record<string, unknown>[] }
    const newMember = membersUnion.v[0]
    expect(newMember.uid).toBe('test-uid')
    expect(newMember.role).toBe('viewer')
    expect(newMember.canView).toBe(true)
    expect(newMember.joinedAt).toEqual({ __type: 'timestamp-now' })
    expect(updatePayload.memberUids).toEqual({
      __type: 'arrayUnion',
      v: ['test-uid'],
    })
    // viewer 招待（canManage:false）では adminUids を書き換えない（設計書 5.1 / 7.1）
    expect(updatePayload.adminUids).toBeUndefined()
    expect(result).toBe(true)
  })

  it('FP-06c: canManage:true の招待受諾時は adminUids へも arrayUnion で自分を追加する', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...mockPendingInvite,
        role: 'admin',
        canManage: true,
      }),
    })
    batchCommit.mockResolvedValue(undefined)
    const { acceptPendingInvite } = await import('./firestorePermissions')
    await acceptPendingInvite('album-1', mockUser)
    const updatePayload = batchUpdate.mock.calls[0][1] as Record<string, unknown>
    const membersUnion = updatePayload.members as { v: Record<string, unknown>[] }
    expect(membersUnion.v[0].canManage).toBe(true)
    // canManage 権限で受諾する場合、adminUids にも自分の UID を append する
    expect(updatePayload.adminUids).toEqual({
      __type: 'arrayUnion',
      v: ['test-uid'],
    })
  })

  it('FP-07: 受諾時の権限値は招待ドキュメントの値どおり（自称昇格しない）', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...mockPendingInvite, canManage: false, role: 'viewer' }),
    })
    batchCommit.mockResolvedValue(undefined)
    const { acceptPendingInvite } = await import('./firestorePermissions')
    await acceptPendingInvite('album-1', mockUser)
    const updatePayload = batchUpdate.mock.calls[0][1] as Record<string, unknown>
    const membersUnion = updatePayload.members as { v: Record<string, unknown>[] }
    expect(membersUnion.v[0].canManage).toBe(false)
  })

  it('FP-08: 招待が存在しないユーザーの受諾は no-op（false を返す）', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined })
    const { acceptPendingInvite } = await import('./firestorePermissions')
    const result = await acceptPendingInvite('album-1', mockUser)
    expect(writeBatch).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('FP-09: commit 失敗時にエラーを伝播する', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockPendingInvite,
    })
    batchCommit.mockRejectedValue(new Error('commit failed'))
    const { acceptPendingInvite } = await import('./firestorePermissions')
    await expect(acceptPendingInvite('album-1', mockUser)).rejects.toThrow(
      'commit failed'
    )
  })

  it('FP-08b: メール未設定ユーザー（email:null）は受諾を試みない', async () => {
    const noEmailUser = { ...mockUser, email: null } as unknown as User
    const { acceptPendingInvite } = await import('./firestorePermissions')
    const result = await acceptPendingInvite('album-1', noEmailUser)
    expect(getDoc).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })
})

describe('lib/firestorePermissions - updateAlbumMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FP-11: 確定メンバーを albums 本体へ updateDoc し updatedAt を更新する', async () => {
    updateDoc.mockResolvedValue(undefined)
    const { updateAlbumMembers } = await import('./firestorePermissions')
    const members = [
      {
        uid: 'test-uid',
        displayName: 'テスト太郎',
        email: 'test@example.com',
        role: 'owner' as const,
        canView: true,
        canPost: true,
        canManage: true,
        joinedAt: { toMillis: () => 0 } as never,
      },
    ]
    await updateAlbumMembers('album-1', members, ['test-uid'])
    expect(doc).toHaveBeenCalledWith({ __type: 'db-stub' }, 'albums', 'album-1')
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.members).toEqual(members)
    expect(payload.memberUids).toEqual(['test-uid'])
    expect(payload.updatedAt).toEqual({ __type: 'serverTimestamp' })
  })

  it('FP-12: members から canManage:true の UID のみを adminUids として算出し同時に書き込む', async () => {
    updateDoc.mockResolvedValue(undefined)
    const { updateAlbumMembers } = await import('./firestorePermissions')
    const base = { joinedAt: { toMillis: () => 0 } as never }
    const members = [
      {
        uid: 'owner-uid',
        displayName: 'オーナー',
        email: 'owner@example.com',
        role: 'owner' as const,
        canView: true,
        canPost: true,
        canManage: true,
        ...base,
      },
      {
        uid: 'admin-uid',
        displayName: '管理者',
        email: 'admin@example.com',
        role: 'admin' as const,
        canView: true,
        canPost: true,
        canManage: true,
        ...base,
      },
      {
        uid: 'viewer-uid',
        displayName: '閲覧者',
        email: 'viewer@example.com',
        role: 'viewer' as const,
        canView: true,
        canPost: false,
        canManage: false,
        ...base,
      },
    ]
    await updateAlbumMembers(
      'album-1',
      members,
      ['owner-uid', 'admin-uid', 'viewer-uid']
    )
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>
    // canManage:true の owner/admin のみ adminUids に含め、viewer は除外する（設計書 7.1）
    expect(payload.adminUids).toEqual(['owner-uid', 'admin-uid'])
  })
})
