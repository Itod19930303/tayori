// Firebase Authentication（Googleログイン）の薄いラッパー。
// 画面側が SDK の詳細に依存しないよう、ログイン/ログアウトの入口と
// エラーコード→日本語メッセージ変換をここに集約する（基本設計書 6.1 / 8.3）。
// エラーは握りつぶさず呼び出し元へ伝播させ、表示可否の判断は getAuthErrorMessage に委ねる。
import { signInWithPopup, signOut, GoogleAuthProvider, type User } from 'firebase/auth'
import { auth } from './firebase'

// Googleアカウントでログインする。成功時はログインした User を返す。
// ポップアップ方式を用いる（基本設計書 6.1 手順3）。
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

// サインアウトする。失敗時は呼び出し元でハンドリングできるようエラーを伝播させる。
export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

// Firebase の認証エラーコードを利用者向けの日本語メッセージへ変換する（基本設計書 8.3）。
// popup-closed-by-user はユーザー自身のキャンセルのため空文字を返し、UI にエラーを出さない。
// 未定義コード・空文字・undefined 等の想定外入力はデフォルトメッセージへフォールバックする。
export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-closed-by-user':
      return ''
    case 'auth/network-request-failed':
      return 'ネットワーク接続を確認してください。'
    case 'auth/too-many-requests':
      return 'しばらく時間をおいてから再試行してください。'
    default:
      return 'Googleログインに失敗しました。もう一度お試しください。'
  }
}
