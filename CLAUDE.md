# tayori — 画像・動画共有アプリ

LINEで流れてしまう画像・動画を、チームで一元管理・即時プレビューできる共有アルバムアプリ。
SNSではなく「業務ツール」として設計する。

## 技術スタック

| 項目 | 採用技術 |
|---|---|
| フロントエンド | Next.js + TypeScript + Tailwind CSS + shadcn/ui |
| 認証 | Firebase Authentication（Googleログイン） |
| DB | Cloud Firestore |
| ストレージ | Firebase Storage → 将来: Cloudinary / Mux |
| デプロイ | Vercel |

## Firestoreデータ構造

- `albums/{albumId}` — title, members, createdAt
- `albums/{albumId}/media/{mediaId}` — fileName, contentType, size, storagePath, downloadUrl, thumbnailUrl, uploadedBy, createdAt, **provider**
- Storage パス: `/albums/{albumId}/{mediaId}/{fileName}`
- `provider` フィールドを必ず持たせ、将来の Cloudinary/Mux 移行時に画面側の影響を最小化する

## MVP機能（優先度順）

1. Googleログイン
2. アルバム作成・一覧
3. 画像/動画アップロード（`uploadBytesResumable` による進捗表示）
4. グリッド表示・プレビュー（ブラウザ上で即時表示）
5. 共有リンク
6. 閲覧権限管理（Firebase Security Rules + Firestore members）

後回し: コメント、既読管理、AIタグ付け、動画変換、一括DL、管理画面

## 5画面構成

| 画面 | 完了条件 |
|---|---|
| ログイン | ログイン後にホームへ遷移できる |
| ホーム | アルバム名と更新日時が一覧表示される |
| アルバム詳細 | グリッド表示・クリックでプレビューできる |
| アップロード | 進捗付きで Storage へ保存できる |
| 共有設定 | 他ユーザーが同じアルバムを閲覧できる |

## 開発ワークフロー

**PM → writer → developer → レビュワー** の4役割で進める。  
詳細: [`.claude/commands/workflow.md`](.claude/commands/workflow.md) — `/workflow <タスク>` で起動

| 役割 | 主な責務 |
|---|---|
| PM | 要件確認・タスク割振・最終確認・リスク整理 |
| writer | 設計書・テスト仕様書の作成と更新 |
| developer | テストコード先行実装・カバレッジ90%以上 |
| レビュワー | 仕様適合・品質・セキュリティ検査・差戻し判定 |

## 品質基準

- テストカバレッジ: **90%以上**（未達時は理由・リスク・追加テスト方針を PM へ報告）
- セキュリティ: Firebase Security Rules でアルバムメンバーのみ読み書き可
- UIトーン: Google Photos × Notion の中間（軽量・整理しやすい）

## 制約ルール

詳細: [`.claude/rules/restrictions.md`](.claude/rules/restrictions.md)

- **Git push/fetch 禁止** — 料金発生のため、ユーザーが手動で実行する（pull は可）
- **削除操作禁止** — ファイル・ブランチ・DB削除は事前確認必須
- **修正前に依存関係を調査** — 影響箇所とリグレッションテスト対象を先に提示する

## 参照ドキュメント

- [`docs/画像・動画共有アプリ 機能一覧.md`](docs/画像・動画共有アプリ%20機能一覧.md)
- [`docs/画像・動画共有アプリ構想メモ.md`](docs/画像・動画共有アプリ構想メモ.md)
- [`docs/Claude Code 開発チーム運用指示書.md`](docs/Claude%20Code%20開発チーム運用指示書.md)
