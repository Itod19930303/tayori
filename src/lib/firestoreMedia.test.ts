import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'
import type { Media } from '@/types'

// firestoreMedia.ts は Firestore SDK の薄いラッパー。実DB書き込み・購読を避けるため
// firebase/firestore をモジュール全体でモックし（テスト仕様書 4.5 / 4.8）、
// subscribeMedia のクエリ・整形（基本設計書 6.4）と createMediaDoc のペイロード
// （基本設計書 6.3 / 5.1）・親アルバム更新を検証する。

const collection = vi.fn((..._args: unknown[]) => ({ __type: 'collection' }))
const doc = vi.fn((..._args: unknown[]) => ({ __type: 'doc', args: _args }))
const query = vi.fn((...args: unknown[]) => ({ __type: 'query', args }))
const orderBy = vi.fn((...args: unknown[]) => ({ __type: 'orderBy', args }))
const limit = vi.fn((n: number) => ({ __type: 'limit', n }))
const onSnapshot = vi.fn()
const setDoc = vi.fn()
const updateDoc = vi.fn()
const increment = vi.fn((n: number) => ({ __type: 'increment', n }))
const serverTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: (...args: unknown[]) => collection(...args),
  doc: (...args: unknown[]) => doc(...args),
  query: (...args: unknown[]) => query(...args),
  orderBy: (...args: unknown[]) => orderBy(...args),
  limit: (...args: unknown[]) => limit(...(args as [number])),
  onSnapshot: (...args: unknown[]) => onSnapshot(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  increment: (...args: unknown[]) => increment(...(args as [number])),
  serverTimestamp: () => serverTimestamp(),
}))

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

const mockImageMedia = {
  mediaId: 'media-1',
  albumId: 'album-1',
  fileName: 'wedding_photo.jpg',
  contentType: 'image/jpeg',
  size: 1024,
  storagePath: 'albums/album-1/media-1/wedding_photo.jpg',
  downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
  thumbnailUrl: null,
  uploadedBy: 'test-uid',
  uploaderName: 'テスト太郎',
  createdAt: { toMillis: () => 0 },
  provider: 'firebase',
} as unknown as Media

const createInput = {
  mediaId: 'media-1',
  fileName: 'wedding_photo.jpg',
  contentType: 'image/jpeg',
  size: 1024,
  storagePath: 'albums/album-1/media-1/wedding_photo.jpg',
  downloadUrl: 'https://storage.example.com/wedding_photo.jpg',
}

describe('lib/firestoreMedia - subscribeMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FM-01: 設計書6.4のクエリ条件（createdAt desc / limit(20)）で購読する', async () => {
    onSnapshot.mockReturnValue(vi.fn())
    const { subscribeMedia } = await import('./firestoreMedia')
    subscribeMedia('album-1', vi.fn())
    expect(collection).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'media'
    )
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc')
    expect(limit).toHaveBeenCalledWith(20)
    expect(onSnapshot).toHaveBeenCalledTimes(1)
  })

  it('FM-02: スナップショットを Media[] に整形し（doc.id→mediaId）callbackへ渡す', async () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { subscribeMedia } = await import('./firestoreMedia')
    const cb = vi.fn()
    subscribeMedia('album-1', cb)
    nextCb({ docs: [{ id: 'media-1', data: () => mockImageMedia }] })
    expect(cb).toHaveBeenCalledTimes(1)
    const items = cb.mock.calls[0][0] as Media[]
    expect(items).toHaveLength(1)
    expect(items[0].mediaId).toBe('media-1')
    expect(items[0].fileName).toBe('wedding_photo.jpg')
  })

  it('FM-03: 0件スナップショットで空配列を渡す', async () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { subscribeMedia } = await import('./firestoreMedia')
    const cb = vi.fn()
    subscribeMedia('album-1', cb)
    nextCb({ docs: [] })
    expect(cb).toHaveBeenCalledWith([])
  })

  it('FM-04: 20件（limit上限）のスナップショットを全件整形して渡す', async () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { subscribeMedia } = await import('./firestoreMedia')
    const cb = vi.fn()
    subscribeMedia('album-1', cb)
    const docs = Array.from({ length: 20 }, (_, i) => ({
      id: `media-${i}`,
      data: () => ({ ...mockImageMedia }),
    }))
    nextCb({ docs })
    const items = cb.mock.calls[0][0] as Media[]
    expect(items).toHaveLength(20)
  })

  it('FM-05: 購読エラー時に onError へフォールバックする', async () => {
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_q, _next: unknown, error: (e: unknown) => void) => {
        errCb = error
        return vi.fn()
      }
    )
    const { subscribeMedia } = await import('./firestoreMedia')
    const onError = vi.fn()
    subscribeMedia('album-1', vi.fn(), onError)
    const err = new Error('permission denied')
    expect(() => errCb(err)).not.toThrow()
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('FM-06: unsubscribe関数を返し、呼ぶと購読解除される', async () => {
    const unsub = vi.fn()
    onSnapshot.mockReturnValue(unsub)
    const { subscribeMedia } = await import('./firestoreMedia')
    const result = subscribeMedia('album-1', vi.fn())
    expect(typeof result).toBe('function')
    result()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})

describe('lib/firestoreMedia - createMediaDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FM-07: media サブコレクションの mediaId ドキュメントへ setDoc する', async () => {
    setDoc.mockResolvedValue(undefined)
    updateDoc.mockResolvedValue(undefined)
    const { createMediaDoc } = await import('./firestoreMedia')
    await createMediaDoc('album-1', createInput, mockUser)
    expect(doc).toHaveBeenCalledWith(
      { __type: 'db-stub' },
      'albums',
      'album-1',
      'media',
      'media-1'
    )
    expect(setDoc).toHaveBeenCalledTimes(1)
  })

  it('FM-08: 書き込みペイロードが設計書5.1のMedia型に一致する', async () => {
    setDoc.mockResolvedValue(undefined)
    updateDoc.mockResolvedValue(undefined)
    const { createMediaDoc } = await import('./firestoreMedia')
    await createMediaDoc('album-1', createInput, mockUser)
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.mediaId).toBe('media-1')
    expect(payload.albumId).toBe('album-1')
    expect(payload.fileName).toBe('wedding_photo.jpg')
    expect(payload.contentType).toBe('image/jpeg')
    expect(payload.size).toBe(1024)
    expect(payload.storagePath).toBe('albums/album-1/media-1/wedding_photo.jpg')
    expect(payload.downloadUrl).toBe('https://storage.example.com/wedding_photo.jpg')
    expect(payload.uploadedBy).toBe('test-uid')
    expect(payload.uploaderName).toBe('テスト太郎')
    expect(payload.createdAt).toEqual({ __type: 'serverTimestamp' })
    expect(payload.provider).toBe('firebase')
    expect(payload.thumbnailUrl).toBeNull()
  })

  it('FM-09: 親アルバムの mediaCount を increment し updatedAt を更新する', async () => {
    setDoc.mockResolvedValue(undefined)
    updateDoc.mockResolvedValue(undefined)
    const { createMediaDoc } = await import('./firestoreMedia')
    await createMediaDoc('album-1', createInput, mockUser)
    // 親 albums/album-1 への doc 呼び出しが行われる
    expect(doc).toHaveBeenCalledWith({ __type: 'db-stub' }, 'albums', 'album-1')
    expect(updateDoc).toHaveBeenCalledTimes(1)
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.mediaCount).toEqual({ __type: 'increment', n: 1 })
    expect(payload.updatedAt).toEqual({ __type: 'serverTimestamp' })
  })

  it('FM-09b: increment / updatedAt は配列内ではなくトップレベルのフィールド変換で構成される（Firestore制約の回避）', async () => {
    setDoc.mockResolvedValue(undefined)
    updateDoc.mockResolvedValue(undefined)
    const { createMediaDoc } = await import('./firestoreMedia')
    await createMediaDoc('album-1', createInput, mockUser)
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>
    // ペイロードは配列を含まず、フィールド変換（increment/serverTimestamp）は
    // トップレベルに置かれる（配列要素内でのフィールド変換はFirestoreが拒否するため）
    Object.values(payload).forEach((v) => {
      expect(Array.isArray(v)).toBe(false)
    })
  })

  it('FM-10: メディア書き込み失敗時にエラーを伝播し、updateDoc を呼ばない（不整合防止）', async () => {
    setDoc.mockRejectedValue(new Error('write failed'))
    const { createMediaDoc } = await import('./firestoreMedia')
    await expect(
      createMediaDoc('album-1', createInput, mockUser)
    ).rejects.toThrow('write failed')
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('FM-11: provider は firebase を必ず付与し Media型外の余分なフィールドを持たない', async () => {
    setDoc.mockResolvedValue(undefined)
    updateDoc.mockResolvedValue(undefined)
    const { createMediaDoc } = await import('./firestoreMedia')
    await createMediaDoc('album-1', createInput, mockUser)
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>
    const keys = Object.keys(payload).sort()
    expect(keys).toEqual(
      [
        'albumId',
        'contentType',
        'createdAt',
        'downloadUrl',
        'fileName',
        'mediaId',
        'provider',
        'size',
        'storagePath',
        'thumbnailUrl',
        'uploadedBy',
        'uploaderName',
      ].sort()
    )
    expect(payload.provider).toBe('firebase')
  })
})
