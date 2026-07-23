// アルバムの Firestore アクセスを集約するラッパー（基本設計書 6.2 作成 / 4.4 一覧）。
// 画面/フックが Firestore SDK の詳細（クエリ構築・スナップショット整形）に依存しないよう、
// 書き込みペイロード（設計書 5.1 / 6.2）と array-contains クエリをここに閉じ込める。
// エラーは握りつぶさず呼び出し元へ伝播させ、メッセージ変換は page 層の責務とする。
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { Album } from '@/types'

// createAlbum の入力。タイトルは必須・説明は任意（バリデーションは validators.ts / 呼び出し側で実施）。
export interface CreateAlbumInput {
  title: string
  description: string
}

// アルバムを作成し、生成された albumId（docRef.id）を返す（基本設計書 6.2）。
// 作成者を owner（全権限）としてメンバーに登録し、memberUids には UID のみを保持して
// 一覧取得の array-contains クエリを単純化する（基本設計書 4.4 注記）。
// title/description はサニタイズ方針に従い trim して保存する（基本設計書 7.5）。
export async function createAlbum(
  input: CreateAlbumInput,
  currentUser: User
): Promise<string> {
  const ownerMember = {
    uid: currentUser.uid,
    displayName: currentUser.displayName ?? '',
    email: currentUser.email ?? '',
    photoURL: currentUser.photoURL ?? '',
    role: 'owner' as const,
    canView: true,
    canPost: true,
    canManage: true,
    // serverTimestamp() は配列要素内では使用できない（Firestoreの制約）ため、
    // members 配列内の joinedAt はクライアント側の Timestamp.now() を使う。
    joinedAt: Timestamp.now(),
  }

  const docRef = await addDoc(collection(db, 'albums'), {
    title: input.title.trim(),
    description: input.description.trim(),
    ownerId: currentUser.uid,
    memberUids: [currentUser.uid],
    // owner は常に canManage:true のため adminUids にも自分を含める（基本設計書 5.1 / 7.1）。
    // Security Rules の isAlbumAdmin が adminUids 包含で管理者判定できるよう非正規化して保持する。
    adminUids: [currentUser.uid],
    members: [ownerMember],
    mediaCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

// ログインユーザーがメンバーのアルバムを updatedAt 降順で購読する（基本設計書 4.4）。
// スナップショットの doc.id を albumId に反映して Album[] へ整形し callback へ渡す。
// 購読エラーは onError（任意）へフォールバックさせ、呼び出し側（useAlbums）が
// ローディング解除・空表示に切り替えられるようにする。戻り値は購読解除関数。
export function subscribeAlbums(
  uid: string,
  callback: (albums: Album[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const q = query(
    collection(db, 'albums'),
    where('memberUids', 'array-contains', uid),
    orderBy('updatedAt', 'desc')
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const albums = snapshot.docs.map(
        (doc) => ({ ...doc.data(), albumId: doc.id }) as Album
      )
      callback(albums)
    },
    (error) => {
      onError?.(error)
    }
  )
}
