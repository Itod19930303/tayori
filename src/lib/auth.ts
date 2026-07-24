// Firebase Authentication（Googleログイン）の薄いラッパー。
// 画面側が SDK の詳細に依存しないよう、ログイン/ログアウトの入口と
// エラーコード→日本語メッセージ変換をここに集約する（基本設計書 6.1 / 8.3）。
// エラーは握りつぶさず呼び出し元へ伝播させ、表示可否の判断は getAuthErrorMessage に委ねる。
import {
  signInWithPopup,
  signInWithRedirect,
  signOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { isMobileDevice } from './device'
import { ERROR_MESSAGES } from './messages/errorMessages'

/**
 * Googleアカウントでログインする。
 *
 * モバイル端末ではポップアップがブロックされやすいため `signInWithRedirect` を用い、
 * PC では従来どおりポップアップ（`signInWithPopup`）で即座に User を得る（基本設計書 6.1.1）。
 * リダイレクト方式はページ遷移を伴い、この関数の戻り値で User を返せないため `null` を返す。
 * リダイレクト復帰後のログイン結果は login/page.tsx の `getRedirectResult` で受け取る。
 * @returns PCポップアップ時は Firebase の User、モバイルのリダイレクト実行時は null
 */
export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider()
  if (isMobileDevice()) {
    // モバイル: リダイレクトで遷移するため、この関数からは User を返せない。
    await signInWithRedirect(auth, provider)
    return null
  }
  // PC: 既存どおりポップアップで即座に User を得る。
  const result = await signInWithPopup(auth, provider)
  return result.user
}

/**
 * サインアウトする。
 * 失敗時は呼び出し元でハンドリングできるようエラーを伝播させる（握りつぶさない）。
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

/**
 * Firebase の認証エラーコードを利用者向けの日本語メッセージへ変換する（基本設計書 8.3）。
 *
 * `auth/popup-closed-by-user` はユーザー自身のキャンセルのため空文字を返し、UI にエラーを出さない。
 * 未定義コード・空文字・undefined 等の想定外入力はデフォルトメッセージへフォールバックする。
 * @param code Firebase Authentication が返すエラーコード
 * @returns 画面表示用の日本語メッセージ（キャンセル時は空文字）
 */
export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-closed-by-user':
      return ''
    case 'auth/network-request-failed':
      return ERROR_MESSAGES.AUTH_NETWORK_FAILED
    case 'auth/too-many-requests':
      return ERROR_MESSAGES.AUTH_TOO_MANY_REQUESTS
    default:
      return ERROR_MESSAGES.AUTH_SIGNIN_FAILED
  }
}
