// 招待（メール事前登録）と権限編集の Firestore アクセスを集約するラッパー
// （基本設計書 6.7 / 5.1 / 7.1）。画面/フックが Firestore SDK の詳細（ドキュメントID決定・
// バッチ構築・ペイロード構造）に依存しないよう、ここに閉じ込める。既存の firestoreAlbum.ts /
// firestoreMedia.ts と同じ規約に従い、エラーは握りつぶさず呼び出し元へ伝播させ、メッセージ変換は
// page 層の責務とする。招待の「正」は pendingInvites サブコレクションで一元管理する。
import {
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import type { AlbumMember } from '@/types'

// 招待作成/権限プリセットの入力。owner は招待対象外のため role は admin/editor/viewer に限る。
export interface InvitePreset {
  role: 'admin' | 'editor' | 'viewer'
  canView: boolean
  canPost: boolean
  canManage: boolean
}

// メールアドレスの正規化を保存経路・照合経路で統一適用する（基本設計書 5.1 注記）。
// pendingInvites のドキュメントID・保存 email・受諾時の自分のメール照合すべてで同じ規則を用い、
// 「Taro@Example.com」と「taro@example.com 」が別レコード化する不整合を防ぐ。
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// メール事前登録による招待を作成する（基本設計書 6.7）。ドキュメントIDに正規化済みメールを用いる
// ため、同一メールへの再招待は同一ドキュメントを上書きし invitedAt が再送日時に更新される。
export async function createInvite(
  albumId: string,
  emailInput: string,
  preset: InvitePreset,
  currentUser: User
): Promise<void> {
  const email = normalizeEmail(emailInput)
  await setDoc(doc(db, 'albums', albumId, 'pendingInvites', email), {
    email,
    role: preset.role,
    canView: preset.canView,
    canPost: preset.canPost,
    canManage: preset.canManage,
    invitedBy: currentUser.uid,
    // 招待日時。トップレベルのフィールドのため serverTimestamp() を使用できる。
    invitedAt: serverTimestamp(),
  })
}

// 招待中メンバーの権限プリセットを個別に更新する（基本設計書 4.8）。
// 確定メンバーの保存（updateAlbumMembers）とは経路を分け、招待レコード側のみを書き換える。
export async function updateInvite(
  albumId: string,
  emailInput: string,
  patch: Partial<InvitePreset>
): Promise<void> {
  const email = normalizeEmail(emailInput)
  await updateDoc(doc(db, 'albums', albumId, 'pendingInvites', email), patch)
}

// 招待を取り消す（基本設計書 6.7）。削除対象は「未受諾の招待レコード」のみで、
// 確定済みメンバー（members 配列要素）やアルバム本体は削除しない（今回スコープ外）。
export async function cancelInvite(
  albumId: string,
  emailInput: string
): Promise<void> {
  const email = normalizeEmail(emailInput)
  await deleteDoc(doc(db, 'albums', albumId, 'pendingInvites', email))
}

// 確定メンバーの権限編集を保存する（基本設計書 4.8）。招待中（invited:true）の一時オブジェクトは
// 呼び出し元（page 層）で除外済みの members/memberUids を受け取り、albums 本体を更新する。
// adminUids は members の canManage:true から再算出して同時に書き込む。Security Rules の
// isAlbumAdmin が adminUids 包含で判定するため、権限編集のたびに members と整合させる必要がある
// （基本設計書 5.1 / 7.1）。呼び出し元にこの派生ロジックを漏らさないよう本関数内へ閉じ込める。
export async function updateAlbumMembers(
  albumId: string,
  members: AlbumMember[],
  memberUids: string[]
): Promise<void> {
  const adminUids = members.filter((m) => m.canManage).map((m) => m.uid)
  await updateDoc(doc(db, 'albums', albumId), {
    members,
    memberUids,
    adminUids,
    updatedAt: serverTimestamp(),
  })
}

// ログインユーザーの招待受諾（基本設計書 6.7）。自分のメール（正規化済み）に一致する招待が
// 存在すれば、その権限値どおりに members/memberUids へ arrayUnion で追加し、招待レコードを削除する
// 1バッチ（writeBatch）で原子的に処理する。招待が無ければ何もせず false を返す（403判定を妨げない）。
// 権限値は招待ドキュメントの値をそのまま転記し、ユーザー入力由来の昇格を許さない（設計書 7.1）。
export async function acceptPendingInvite(
  albumId: string,
  currentUser: User
): Promise<boolean> {
  // メール未設定ユーザーは照合できないため受諾を試みない。
  if (!currentUser.email) return false

  const email = normalizeEmail(currentUser.email)
  const inviteRef = doc(db, 'albums', albumId, 'pendingInvites', email)
  const snapshot = await getDoc(inviteRef)
  if (!snapshot.exists()) return false

  const invite = snapshot.data() as InvitePreset
  const albumRef = doc(db, 'albums', albumId)

  // 配列要素内で serverTimestamp() は使用できないため joinedAt は Timestamp.now() を用いる
  // （firestoreAlbum.ts の owner 登録と同じ Firestore 制約）。
  const newMember: AlbumMember = {
    uid: currentUser.uid,
    displayName: currentUser.displayName ?? '',
    email,
    photoURL: currentUser.photoURL ?? '',
    role: invite.role,
    canView: invite.canView,
    canPost: invite.canPost,
    canManage: invite.canManage,
    joinedAt: Timestamp.now(),
  }

  // members/memberUids へは常に自分を追加する。canManage:true の権限で招待された場合のみ
  // adminUids へも自分を append し、Security Rules の isAlbumAdmin（adminUids 包含）と整合させる
  // （基本設計書 5.1 / 7.1）。canManage:false の招待では adminUids を書き換えないことで、
  // 受諾に便乗した管理者昇格（adminUids だけ膨らませる別経路）を Rules 側でも拒否できるようにする。
  const updatePayload: Record<string, unknown> = {
    members: arrayUnion(newMember),
    memberUids: arrayUnion(currentUser.uid),
  }
  if (invite.canManage) {
    updatePayload.adminUids = arrayUnion(currentUser.uid)
  }

  const batch = writeBatch(db)
  batch.update(albumRef, updatePayload)
  batch.delete(inviteRef)
  await batch.commit()
  return true
}
