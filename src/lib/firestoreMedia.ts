// メディア（画像/動画）の Firestore アクセスを集約するラッパー
// （基本設計書 6.3 書き込み / 6.4 一覧購読 / 5.1 Media型）。
// 画面/フックが Firestore SDK の詳細（クエリ構築・スナップショット整形・ペイロード構造）に
// 依存しないよう、ここに閉じ込める。エラーは握りつぶさず呼び出し元へ伝播させる。
import {
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { Media } from '@/types'

// createMediaDoc の入力。uploadFile の結果（mediaId / storagePath / downloadUrl）と
// ファイル自体のメタ（fileName / contentType / size）を受け取る。
export interface CreateMediaInput {
  mediaId: string
  fileName: string
  contentType: string
  size: number
  storagePath: string
  downloadUrl: string
}

// アルバムのメディアを createdAt 降順・最大20件で購読する（基本設計書 6.4）。
// スナップショットの doc.id を mediaId に反映して Media[] へ整形し callback へ渡す。
// 購読エラーは onError（任意）へフォールバックさせ、useMediaList がローディング解除・
// 空表示へ切り替えられるようにする。戻り値は購読解除関数。
export function subscribeMedia(
  albumId: string,
  callback: (mediaItems: Media[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(
    collection(db, 'albums', albumId, 'media'),
    orderBy('createdAt', 'desc'),
    limit(20)
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (d) => ({ ...d.data(), mediaId: d.id }) as Media
      )
      callback(items)
    },
    (error) => {
      onError?.(error)
    }
  )
}

// メディアドキュメントを albums/{albumId}/media/{mediaId} へ書き込み、
// 親アルバムの mediaCount を +1・updatedAt を更新する（基本設計書 6.3）。
// setDoc が失敗した場合は updateDoc を呼ばず件数の不整合を防ぐ（設計書8.1 #6 / テスト仕様書 FM-10）。
//
// 注意: updateDoc のペイロードは increment(1) / serverTimestamp() をトップレベルの
// フィールド値として渡す。Firestore は配列要素内でのフィールド変換（serverTimestamp 等）を
// 許可しないため、これらを配列に入れ子にしてはならない（アルバム作成時の joinedAt と同じ制約）。
export async function createMediaDoc(
  albumId: string,
  input: CreateMediaInput,
  currentUser: User
): Promise<void> {
  await setDoc(doc(db, 'albums', albumId, 'media', input.mediaId), {
    mediaId: input.mediaId,
    albumId,
    fileName: input.fileName,
    contentType: input.contentType,
    size: input.size,
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
    // 動画サムネイル自動生成は MVP 対象外のため null 保存する（設計書5.3 / 6.3）。
    thumbnailUrl: null,
    uploadedBy: currentUser.uid,
    uploaderName: currentUser.displayName ?? '',
    createdAt: serverTimestamp(),
    // provider を必ず付与し、将来の Cloudinary/Mux 移行を getPreviewUrl へ局所化する（設計書5.3）。
    provider: 'firebase',
  })

  await updateDoc(doc(db, 'albums', albumId), {
    mediaCount: increment(1),
    updatedAt: serverTimestamp(),
  })
}
