// Firebase の初期化とサービスインスタンス（auth / db / storage）の単一提供点。
// アプリ全体で1つの Firebase App を共有するため、getApps() で既存インスタンスの有無を確認し、
// HMR や再 import による多重初期化（"app/duplicate-app" エラー）を防ぐ。
// 設定値はクライアント公開前提の NEXT_PUBLIC_FIREBASE_* を参照する（基本設計書 2.3）。
import { initializeApp, getApps, getApp } from 'firebase/app'
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

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export { app }
