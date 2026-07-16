import { describe, it, expect, vi, beforeEach } from 'vitest'

// uploadFile.ts は Firebase Storage の uploadBytesResumable を薄くラップし、
// 進捗通知・完了時の getDownloadURL・失敗時の reject を扱う（基本設計書 6.3）。
// 実ファイル送信を避けるため firebase/storage をモジュール全体でモックし
// （テスト仕様書 4.7）、uploadTask の on(next/error/complete) 各経路を制御する。

const ref = vi.fn((_storage: unknown, path: string) => ({ __type: 'ref', fullPath: path }))
const uploadBytesResumable = vi.fn()
const getDownloadURL = vi.fn()

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: (...args: unknown[]) => ref(...(args as [unknown, string])),
  uploadBytesResumable: (...args: unknown[]) => uploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURL(...args),
}))

// firebase.ts の副作用初期化を避けるため storage インスタンスをスタブ化する
vi.mock('./firebase', () => ({
  auth: {},
  db: {},
  storage: { __type: 'storage-stub' },
}))

// crypto.randomUUID を固定して storagePath / mediaId を決定的に検証する
function stubUuid(value: string) {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(value as `${string}-${string}-${string}-${string}-${string}`)
}

// uploadBytesResumable が返す uploadTask スタブ。テスト側が next/error/complete を
// 任意タイミングで発火できるよう、on() 登録時のコールバックを保持する。
function makeUploadTask() {
  const refStub = { __type: 'snapshot-ref' }
  const handlers: {
    next?: (snap: unknown) => void
    error?: (err: unknown) => void
    complete?: () => void
  } = {}
  const task = {
    snapshot: { ref: refStub },
    on: (
      _event: string,
      next: (snap: unknown) => void,
      error: (err: unknown) => void,
      complete: () => void
    ) => {
      handlers.next = next
      handlers.error = error
      handlers.complete = complete
    },
  }
  return { task, handlers, refStub }
}

describe('lib/uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UF-01: 設計書5.2のパス規則でStorage参照を作り uploadBytesResumable を呼ぶ', async () => {
    stubUuid('uuid-fixed')
    const { task, handlers } = makeUploadTask()
    uploadBytesResumable.mockReturnValue(task)
    getDownloadURL.mockResolvedValue('https://storage.example.com/a.jpg')
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

    const { uploadFile } = await import('./uploadFile')
    const promise = uploadFile('album-1', file, {})
    handlers.complete?.()
    await promise

    expect(ref).toHaveBeenCalledWith(
      { __type: 'storage-stub' },
      'albums/album-1/uuid-fixed/a.jpg'
    )
    expect(uploadBytesResumable).toHaveBeenCalledTimes(1)
    expect(uploadBytesResumable.mock.calls[0][1]).toBe(file)
  })

  it('UF-02: 進捗コールバックへ0〜100の百分率を渡す', async () => {
    stubUuid('uuid-fixed')
    const { task, handlers } = makeUploadTask()
    uploadBytesResumable.mockReturnValue(task)
    getDownloadURL.mockResolvedValue('https://storage.example.com/a.jpg')
    const onProgress = vi.fn()
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

    const { uploadFile } = await import('./uploadFile')
    const promise = uploadFile('album-1', file, { onProgress })
    handlers.next?.({ bytesTransferred: 42, totalBytes: 100 })
    handlers.complete?.()
    await promise

    expect(onProgress).toHaveBeenCalledWith(42)
  })

  it('UF-03: 完了時に getDownloadURL を呼び { downloadUrl, storagePath, mediaId } を resolve', async () => {
    stubUuid('uuid-fixed')
    const { task, handlers, refStub } = makeUploadTask()
    uploadBytesResumable.mockReturnValue(task)
    getDownloadURL.mockResolvedValue('https://storage.example.com/a.jpg')
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

    const { uploadFile } = await import('./uploadFile')
    const promise = uploadFile('album-1', file, {})
    handlers.complete?.()
    const result = await promise

    expect(getDownloadURL).toHaveBeenCalledWith(refStub)
    expect(result.downloadUrl).toBe('https://storage.example.com/a.jpg')
    expect(result.storagePath).toBe('albums/album-1/uuid-fixed/a.jpg')
    expect(result.mediaId).toBe('uuid-fixed')
  })

  it('UF-04: アップロード中のネットワークエラーで reject し onError を呼ぶ', async () => {
    stubUuid('uuid-fixed')
    const { task, handlers } = makeUploadTask()
    uploadBytesResumable.mockReturnValue(task)
    const onError = vi.fn()
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

    const { uploadFile } = await import('./uploadFile')
    const promise = uploadFile('album-1', file, { onError })
    const err = { code: 'storage/retry-limit-exceeded' }
    handlers.error?.(err)

    await expect(promise).rejects.toBe(err)
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('UF-05: getDownloadURL 失敗時も reject する', async () => {
    stubUuid('uuid-fixed')
    const { task, handlers } = makeUploadTask()
    uploadBytesResumable.mockReturnValue(task)
    const err = new Error('url failed')
    getDownloadURL.mockRejectedValue(err)
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

    const { uploadFile } = await import('./uploadFile')
    const promise = uploadFile('album-1', file, {})
    handlers.complete?.()

    await expect(promise).rejects.toThrow('url failed')
  })

  it('UF-06: storagePath が設計書5.2形式で、Firestore書き込み・provider付与を行わない', async () => {
    stubUuid('uuid-fixed')
    const { task, handlers } = makeUploadTask()
    uploadBytesResumable.mockReturnValue(task)
    getDownloadURL.mockResolvedValue('https://storage.example.com/a.jpg')
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })

    const { uploadFile } = await import('./uploadFile')
    const promise = uploadFile('album-1', file, {})
    handlers.complete?.()
    const result = await promise

    // /albums/{albumId}/{mediaId}/{fileName} 形式に一致（責務はStorageアップロードのみ）
    expect(result.storagePath).toBe('albums/album-1/uuid-fixed/a.jpg')
    expect(result).not.toHaveProperty('provider')
  })
})
