// Firebase Storage への画像/動画アップロードを集約するラッパー（基本設計書 6.3）。
// 画面/フックが uploadBytesResumable の詳細（進捗イベント・完了時のURL取得）に依存しないよう、
// Storage パス規則（基本設計書 5.2）の組み立てと進捗通知・完了/失敗のハンドリングを
// ここに閉じ込める。Firestore へのメタデータ書き込み・provider 付与は責務分離のため
// createMediaDoc（firestoreMedia.ts）側で行い、本関数は Storage アップロードのみを担う。
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

// 進捗・失敗を呼び出し元（page 層）へ通知するためのコールバック。いずれも任意。
export interface UploadFileCallbacks {
  onProgress?: (progress: number) => void
  onError?: (error: unknown) => void
}

// アップロード結果。mediaId は createMediaDoc がドキュメントIDとして同じ値を使うため返す
// （Storage パスと Firestore ドキュメントの mediaId を一致させる。テスト仕様書 5.21 writerメモ）。
export interface UploadFileResult {
  downloadUrl: string
  storagePath: string
  mediaId: string
}

export function uploadFile(
  albumId: string,
  file: File,
  { onProgress, onError }: UploadFileCallbacks = {}
): Promise<UploadFileResult> {
  // mediaId を採番し、設計書5.2の /albums/{albumId}/{mediaId}/{fileName} 形式で参照を作る。
  const mediaId = crypto.randomUUID()
  const storagePath = `albums/${albumId}/${mediaId}/${file.name}`
  const storageRef = ref(storage, storagePath)
  const uploadTask = uploadBytesResumable(storageRef, file)

  return new Promise<UploadFileResult>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      // 進捗: バイト転送量から百分率を算出して通知する（設計書6.3の進捗計算）。
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(progress)
      },
      // 失敗: onError で通知しつつ reject し、握りつぶさず呼び出し元へ伝播する
      // （メッセージ変換は page 層の責務。設計書8.1 #3）。
      (error) => {
        onError?.(error)
        reject(error)
      },
      // 完了: 署名付きURLを取得して結果を resolve する。URL取得失敗も reject する。
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
          resolve({ downloadUrl, storagePath, mediaId })
        } catch (error) {
          reject(error)
        }
      }
    )
  })
}
