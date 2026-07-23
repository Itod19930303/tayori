// アプリ全体で共有する Firestore データモデルの型定義（基本設計書 5.1 準拠）。
// ホーム/アルバム詳細/アップロード/権限管理など後続画面がこの型を再利用するため、
// スキーマの単一の情報源としてここに集約する。日時は Firestore の Timestamp を用い、
// クライアント/サーバー間で同一型を扱えるようにする。
import type { Timestamp } from 'firebase/firestore'

// アルバムのメンバー。権限は role（表示・既定値の判断用）と
// canView/canPost/canManage（権限管理画面のチェックボックス実体）で表現する。
export interface AlbumMember {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  canView: boolean
  canPost: boolean
  canManage: boolean
  joinedAt: Timestamp
  // UI表示専用フラグ（基本設計書 5.1）。true の要素は「招待中（未受諾）」を表す。
  // 権限管理画面が pendingInvites サブコレクションを AlbumMember 形へ変換した一時オブジェクトに
  // のみ付与する。Firestore の members 配列に invited:true が保存されることはない。
  invited?: boolean
}

// メール事前登録による招待の「正」（albums/{albumId}/pendingInvites/{email}、基本設計書 5.1）。
// ドキュメントIDは正規化済みメール（.trim().toLowerCase()）とし、招待状態はこのサブコレクションで
// 一元管理する。受諾時に members/memberUids へ転記し、このドキュメントを削除する（基本設計書 6.7）。
export interface PendingInvite {
  email: string
  role: 'admin' | 'editor' | 'viewer'
  canView: boolean
  canPost: boolean
  canManage: boolean
  invitedBy: string
  invitedAt: Timestamp
}

// アルバム。memberUids は Firestore の array-contains クエリ用（members とは別に保持し、
// メンバー検索を単純化する設計上の理由による。基本設計書 4.4 注記・10.3 参照）。
export interface Album {
  albumId: string
  title: string
  description?: string
  coverImageUrl?: string
  ownerId: string
  memberUids: string[]
  // canManage:true のメンバー（owner/admin）UID を非正規化して保持する配列（基本設計書 5.1 / 7.1）。
  // members 内で canManage===true の uid を常に反映する。Security Rules の isAlbumAdmin が
  // `request.auth.uid in adminUids` の配列包含チェックで admin 判定できるよう memberUids と同様に別持ちする
  // （List 型に exists(lambda) 相当のマクロが無いという Rules の制約を回避するため）。
  adminUids: string[]
  members: AlbumMember[]
  mediaCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// メディア（画像/動画）。provider を必須で持たせ、将来 Cloudinary/Mux へ移行する際に
// 画面側の変更を getPreviewUrl() へ局所化できるようにする（基本設計書 5.3）。
export interface Media {
  mediaId: string
  albumId: string
  fileName: string
  contentType: string
  size: number
  storagePath: string
  downloadUrl: string
  thumbnailUrl?: string
  uploadedBy: string
  uploaderName: string
  createdAt: Timestamp
  provider: 'firebase' | 'cloudinary' | 'mux'
  width?: number
  height?: number
  duration?: number
}

// ユーザープロファイル（users/{uid}、任意コレクション）。本人のみ読み書きする想定。
export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
