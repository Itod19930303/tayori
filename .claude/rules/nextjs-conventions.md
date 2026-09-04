# Next.js 実装規約

App Router（Next.js 16）のベストプラクティスに沿った実装方針。本プロジェクトは Firebase Client SDK による認証・リアルタイム購読に強く依存するため、公式ベストプラクティスと衝突する箇所は「意図的な例外」として明記し、無自覚な逸脱と区別する。

## 1. フォント読み込み

- `next/font/google` を使う。`<link rel="preconnect">` 等による Google Fonts CDN の直読みは禁止。
- 理由: セルフホストされ外部リクエストが減り、レイアウトシフト（CLS）を防げるため。
- 対象: `src/app/layout.tsx` の見出し（Source Serif 4）・本文（Be Vietnam Pro）・アイコン（Material Symbols Outlined）。
- Material Symbols のような可変フォント/アイコンフォントで `next/font/google` が非対応の場合は、対応不可の理由をコードコメントに明記したうえで例外扱いとする。

## 2. ローディング・エラー表示のファイル規約

- ルートセグメントの読み込み中UIは `loading.tsx`、予期しないエラーは `error.tsx`、存在しないリソースは `not-found.tsx` のファイル規約で配置する。
- ページコンポーネント内で `LoadingScreen` 等を都度定義することは禁止する（重複排除・規約準拠）。共通化する場合は `components/organisms/` に切り出したうえで `loading.tsx` から呼び出す。
- **例外**: 403（非メンバー）/404（アルバム未存在）はデータに依存するビジネスロジック判定であり、`not-found.tsx` の機械的な適用では表現できない。既存の `NoticeScreen` による出し分けパターンを踏襲してよい。

## 3. Server Components / Client Components の使い分け

- 原則: App Router は Server Components がデフォルト。可能な箇所はサーバー側でデータ取得する。
- **例外（本プロジェクトの明示的な設計判断）**: Firebase Auth のクライアント専用SDKと Firestore のリアルタイム購読（`onSnapshot`）に強く依存するため、`page.tsx`（pages層）はすべて `'use client'` を許容する。
- 新規実装時も、リアルタイム性を必要としない静的な表示部分（説明文・フッター等）は Server Component 化を検討する。

## 4. 画像表示

- 原則: `next/image` を使用する。
- **例外**: Firebase Storage の署名付きURLをそのまま表示する箇所（`AlbumCard` / `MediaCell` / `UploadItem` / メディア詳細ページ 等）は `<img>` を使用してよい。理由は、署名付きURLが動的で `next/image` の `remotePatterns` 事前登録が困難であり、将来の Cloudinary/Mux 移行時は `getPreviewUrl()`（`src/lib/mediaUrl.ts`）側で吸収する設計のため。
- 外部プロフィール画像（Googleアカウントのアバター等、provider非依存の外部URL）も同様に `<img>` を許容する。
- 新規追加時に `next/image` を使わない場合は、`eslint-disable-next-line @next/next/no-img-element` コメントで理由を明記する（既存踏襲）。

## レビュー時の確認

上記の例外に該当しない新規コードで、以下が見つかった場合は差戻し対象とする。

| 違反例 | 差戻し先 |
|---|---|
| `next/font/google` を使わない新規フォント追加 | developer |
| `loading.tsx` / `error.tsx` を整備せず独自スピナーを実装 | developer |
| 根拠コメントのない `next/image` 不使用 | developer |
| 例外に該当しないのに `'use client'` を安易に付与 | developer（設計判断が必要な場合は writer / PM） |

参照: `CLAUDE.md`、`.claude/rules/atomic-design.md`、`.claude/rules/development.md`
