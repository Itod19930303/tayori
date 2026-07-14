import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'
import type { Album } from '@/types'

// firestoreAlbum.ts は Firestore SDK の薄いラッパー。実DB書き込み・購読を避けるため
// firebase/firestore をモジュール全体でモックし（テスト仕様書 4.5）、
// createAlbum のペイロード（基本設計書 6.2 / 5.1）と subscribeAlbums のクエリ・整形を検証する。
//
// カバレッジ注記: createAlbum内の `currentUser.displayName ?? ''` 等の `??` フォールバックは
// 意図的に未テスト。displayName/email/photoURL は firebase/auth の User 型が
// `string | null` を許容するため型安全のために置いているが、Googleログイン経由であれば
// 実運用でnullになるケースは稀。あえてnullを注入するテストは「TypeScriptの型を無視した
// 入力に対する防御」を確認するだけで実バグ検出に繋がらないためスキップしている
// （レビュー2026-07-14で許容判断）。

const addDoc = vi.fn()
const collection = vi.fn((..._args: unknown[]) => ({ __type: 'collection' }))
const query = vi.fn((...args: unknown[]) => ({ __type: 'query', args }))
const where = vi.fn((...args: unknown[]) => ({ __type: 'where', args }))
const orderBy = vi.fn((...args: unknown[]) => ({ __type: 'orderBy', args }))
const onSnapshot = vi.fn()
const serverTimestamp = vi.fn((..._args: unknown[]) => ({ __type: 'serverTimestamp' }))
const timestampNow = vi.fn(() => ({ __type: 'timestamp-now' }))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: (...args: unknown[]) => collection(...args),
  addDoc: (...args: unknown[]) => addDoc(...args),
  query: (...args: unknown[]) => query(...args),
  where: (...args: unknown[]) => where(...args),
  orderBy: (...args: unknown[]) => orderBy(...args),
  onSnapshot: (...args: unknown[]) => onSnapshot(...args),
  serverTimestamp: () => serverTimestamp(),
  Timestamp: { now: () => timestampNow() },
}))

// firebase.ts の副作用初期化を避けるため db インスタンスをスタブ化する
vi.mock('./firebase', () => ({
  auth: {},
  db: { __type: 'db-stub' },
  storage: {},
}))

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
  email: 'test@example.com',
  photoURL: 'https://example.com/photo.png',
} as unknown as User

const mockAlbum = {
  albumId: 'album-1',
  title: '湖畔で過ごした夏休み',
  description: '',
  ownerId: 'test-uid',
  memberUids: ['test-uid'],
  members: [],
  mediaCount: 0,
  createdAt: { toMillis: () => 0 },
  updatedAt: { toMillis: () => 0 },
} as unknown as Album

describe('lib/firestoreAlbum - createAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FA-01: albums コレクションへ addDoc し albumId を返す', async () => {
    addDoc.mockResolvedValue({ id: 'new-album-id' })
    const { createAlbum } = await import('./firestoreAlbum')
    const id = await createAlbum({ title: '夏休み', description: '記録' }, mockUser)
    expect(collection).toHaveBeenCalledWith({ __type: 'db-stub' }, 'albums')
    expect(addDoc).toHaveBeenCalledTimes(1)
    expect(id).toBe('new-album-id')
  })

  it('FA-02: 書き込みペイロードが設計書6.2/5.1に一致する', async () => {
    addDoc.mockResolvedValue({ id: 'new-album-id' })
    const { createAlbum } = await import('./firestoreAlbum')
    await createAlbum({ title: '  夏休み  ', description: '  記録  ' }, mockUser)
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.ownerId).toBe('test-uid')
    expect(payload.memberUids).toEqual(['test-uid'])
    expect(payload.mediaCount).toBe(0)
    expect(payload.title).toBe('夏休み')
    expect(payload.description).toBe('記録')
    expect(payload.createdAt).toEqual({ __type: 'serverTimestamp' })
    expect(payload.updatedAt).toEqual({ __type: 'serverTimestamp' })
    const members = payload.members as Array<Record<string, unknown>>
    expect(members).toHaveLength(1)
    expect(members[0].uid).toBe('test-uid')
    expect(members[0].role).toBe('owner')
    expect(members[0].canView).toBe(true)
    expect(members[0].canPost).toBe(true)
    expect(members[0].canManage).toBe(true)
  })

  it('FA-11: members配列内のjoinedAtはserverTimestamp()ではなくTimestamp.now()を使う（Firestoreは配列内でのserverTimestamp()を許可しないため）', async () => {
    addDoc.mockResolvedValue({ id: 'new-album-id' })
    const { createAlbum } = await import('./firestoreAlbum')
    await createAlbum({ title: '夏', description: '' }, mockUser)
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>
    const members = payload.members as Array<Record<string, unknown>>
    expect(members[0].joinedAt).toEqual({ __type: 'timestamp-now' })
    expect(members[0].joinedAt).not.toEqual({ __type: 'serverTimestamp' })
  })

  it('FA-03: 説明未入力（空文字）でも書き込める', async () => {
    addDoc.mockResolvedValue({ id: 'new-album-id' })
    const { createAlbum } = await import('./firestoreAlbum')
    await createAlbum({ title: '夏', description: '' }, mockUser)
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.description).toBe('')
    expect(addDoc).toHaveBeenCalledTimes(1)
  })

  it('FA-04: Firestore書き込み失敗時にエラーを伝播する', async () => {
    addDoc.mockRejectedValue(new Error('write failed'))
    const { createAlbum } = await import('./firestoreAlbum')
    await expect(
      createAlbum({ title: '夏', description: '' }, mockUser)
    ).rejects.toThrow('write failed')
  })

  it('FA-05: Album型（設計書5.1）のフィールドのみで構成され余分なフィールドを持たない', async () => {
    addDoc.mockResolvedValue({ id: 'new-album-id' })
    const { createAlbum } = await import('./firestoreAlbum')
    await createAlbum({ title: '夏', description: '' }, mockUser)
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>
    const keys = Object.keys(payload).sort()
    expect(keys).toEqual(
      [
        'createdAt',
        'description',
        'mediaCount',
        'memberUids',
        'members',
        'ownerId',
        'title',
        'updatedAt',
      ].sort()
    )
  })
})

describe('lib/firestoreAlbum - subscribeAlbums', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FA-06: 設計書4.4のクエリ条件で購読する', async () => {
    onSnapshot.mockReturnValue(vi.fn())
    const { subscribeAlbums } = await import('./firestoreAlbum')
    subscribeAlbums('test-uid', vi.fn())
    expect(where).toHaveBeenCalledWith('memberUids', 'array-contains', 'test-uid')
    expect(orderBy).toHaveBeenCalledWith('updatedAt', 'desc')
    expect(onSnapshot).toHaveBeenCalledTimes(1)
  })

  it('FA-07: スナップショットを Album[] に整形し（doc.id→albumId）callbackへ渡す', async () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { subscribeAlbums } = await import('./firestoreAlbum')
    const cb = vi.fn()
    subscribeAlbums('test-uid', cb)
    nextCb({ docs: [{ id: 'album-1', data: () => mockAlbum }] })
    expect(cb).toHaveBeenCalledTimes(1)
    const albums = cb.mock.calls[0][0] as Album[]
    expect(albums).toHaveLength(1)
    expect(albums[0].albumId).toBe('album-1')
    expect(albums[0].title).toBe('湖畔で過ごした夏休み')
  })

  it('FA-08: 0件スナップショットで空配列を渡す', async () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { subscribeAlbums } = await import('./firestoreAlbum')
    const cb = vi.fn()
    subscribeAlbums('test-uid', cb)
    nextCb({ docs: [] })
    expect(cb).toHaveBeenCalledWith([])
  })

  it('FA-09: 購読エラー時に onError ハンドラへフォールバックする', async () => {
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_q, _next: unknown, error: (e: unknown) => void) => {
        errCb = error
        return vi.fn()
      }
    )
    const { subscribeAlbums } = await import('./firestoreAlbum')
    const cb = vi.fn()
    const onError = vi.fn()
    subscribeAlbums('test-uid', cb, onError)
    const err = new Error('permission denied')
    expect(() => errCb(err)).not.toThrow()
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('FA-10: unsubscribe関数を返し、呼ぶと購読解除される', async () => {
    const unsub = vi.fn()
    onSnapshot.mockReturnValue(unsub)
    const { subscribeAlbums } = await import('./firestoreAlbum')
    const result = subscribeAlbums('test-uid', vi.fn())
    expect(typeof result).toBe('function')
    result()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})
