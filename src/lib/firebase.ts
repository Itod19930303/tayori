// Firebase の初期化とサービスインスタンス（auth / db / storage）の単一提供点。
// アプリ全体で1つの Firebase App を共有するため、getApps() で既存インスタンスの有無を確認し、
// HMR や再 import による多重初期化（"app/duplicate-app" エラー）を防ぐ。
// 設定値はクライアント公開前提の NEXT_PUBLIC_FIREBASE_* を参照する（基本設計書 2.3）。
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// 既存 App があれば再利用し、なければ初期化する（多重初期化防止）。
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// App Check（reCAPTCHA Enterprise）を初期化する。bot・クローラーによる自動化リクエストを
// Firebase Authentication 側で抑止するため、正規アプリから発行された証明トークンを
// リクエストへ自動付与させる目的で導入する（App Check導入設計書 2章）。
// ブラウザ専用APIのため SSR 評価時は何もせず、siteKey 未設定・初期化失敗時も
// アプリ起動を止めない（開発初期・CI で環境変数が無い状態を正常系として扱う）。
function setupAppCheck(firebaseApp: FirebaseApp): AppCheck | undefined {
  // SSR（サーバー側モジュール評価）では window/self が無いため初期化しない。
  if (typeof window === 'undefined') return undefined

  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    // 未設定は「App Check 無効で動かす」正常な運用状態のため、警告のみで継続する。
    console.warn(
      'App Check: NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY が未設定のため App Check を初期化しません。'
    )
    return undefined
  }

  // 開発・テスト環境では reCAPTCHA Enterprise 検証の代わりに debug token を使う。
  // SDK は initializeAppCheck 実行時にこの値を読むため、必ず初期化より前に設定する。
  if (process.env.NODE_ENV !== 'production') {
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }

  try {
    return initializeAppCheck(firebaseApp, {
      // Firebase Console の App Check 登録が reCAPTCHA Enterprise（スコアベース）のため、
      // classic v3 ではなく Enterprise プロバイダを使う（App Check導入設計書 v1.1）。
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      // トークン期限切れによる認証失敗を防ぐため、SDK に自動更新させる。
      isTokenAutoRefreshEnabled: true,
    })
  } catch (error) {
    // reCAPTCHA Enterprise スクリプトの読み込み失敗・重複初期化などで例外が出ても、
    // ログイン等の既存機能を止めないため握りつぶしてログのみ残す。
    console.error('App Check の初期化に失敗しました。App Check 無効のまま継続します。', error)
    return undefined
  }
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const appCheck = setupAppCheck(app)
export { app }
