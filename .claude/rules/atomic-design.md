# コンポーネント設計ルール（Atomic Design）

コンポーネントは Atomic Design の階層に従って `src/components/` 配下に配置する。実装の進め方（TDD・共通化基準・コメントルール）は [`development.md`](development.md) を参照。

## ディレクトリ構成

```
src/components/
  atoms/       # shadcn/ui由来のプリミティブ含む最小単位（Button, Input, Avatar, Badge等）
  molecules/   # atomsの小さな組み合わせ（AlbumCard, MediaCell, UploadItem, MemberRow, ActivityCard等）
  organisms/   # molecules/atomsを組み合わせた独立したUIセクション（AlbumGrid, MediaGrid, PermissionTable, SideNav, TopHeader, BottomNav, UploadList, MediaPreview等）
  templates/   # organismsを配置したページレイアウトの骨格（実データを持たない）（HomeTemplate, AlbumDetailTemplate等）
  common/      # Atomic Design階層に当てはまらない横断的コンポーネント（ErrorBoundary, Toast）
```

`src/app/**/page.tsx` が Atomic Design の「pages」層を担う。`hooks/`（`useAlbum`, `useMediaList`, `useAuth` 等）経由でFirestoreから実データを取得し、対応する `templates/` コンポーネントにpropsとして渡す。

ドメイン別フォルダ（`album/` `media/` `permissions/` 等）は採用しない。コンポーネントの置き場所は常にAtomic Designの階層のみで判断する。判断軸を1つに絞ることで、配置に迷うことを防ぐ。

## 各層の判定基準

新しいコンポーネントを作る際は、以下の基準で層を決める。

| 層 | 判定基準 |
|---|---|
| atoms | これ以上分解すると意味を失う最小単位。ビジネスロジックを持たない |
| molecules | atomsの組み合わせで1つの意味的な単位を成す。データ取得を行わない（propsのみで完結する） |
| organisms | molecules/atomsを組み合わせた独立したUIセクション。ローカルstateは持ってよいが、**Firestore/Storageへの直接アクセス（`onSnapshot`・`uploadBytesResumable`等）は行わない** |
| templates | organismsを配置したレイアウト骨格。実データを持たず、構造（配置）のみに関心を持つ |
| pages（`page.tsx`） | `hooks/`経由で実データを取得し、templateへpropsとして渡す。ルーティングパラメータの処理もここで行う |

### データアクセス制約の意図

organisms以下の層でFirestore/Storageへの直接アクセスを禁止することで、atoms〜templatesはすべて「propsを受け取って描画するだけ」の純粋な表示コンポーネントになる。これにより、[`development.md`](development.md) のTDD方針に沿ってFirebase SDKをモックせずにユニットテストを書けるようになる。データ取得ロジックは `page.tsx` または `hooks/` に集約する。

## その他の規約

- shadcn/uiで生成するコンポーネントは `atoms/` に配置する。`components.json` のエイリアス設定で `ui` エイリアスの出力先を `atoms/` に向ける（プロジェクトscaffolding時に設定する）
- コンポーネントファイル名はPascalCaseとし、層を示すプレフィックス/サフィックス（例: `AtomButton`）は付けない。層はフォルダ階層のみで表現する
- `common/` はAtomic Designの階層に当てはまらない横断的コンポーネント（`ErrorBoundary` のような非UIロジックのラッパー、`Toast` のような通知プリミティブ）専用とし、通常のUIコンポーネントをここに置かない
- [`development.md`](development.md) の共通化判断基準・実装コメント必須ルールは、すべての層に等しく適用される
