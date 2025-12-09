# Tsuzuri - 次世代コラボレーティブマークダウンWiki

## 概要

Tsuzuriは、WebSocketとCRDT技術を使用して構築されたリアルタイム編集機能を備えたコラボレーティブマークダウンWikiです。以下の機能を備えています：

- 他のユーザーの入力を示すゴーストテキストを使用したリアルタイムコラボレーティブ編集
- 操作のEd25519署名検証
- マークダウンコンテンツ用のブロック認識CRDT
- ツリーベースのドキュメント構成
- 自動WebP変換を伴う画像アップロード
- 最小限のDOMクライアント（仮想DOMのオーバーヘッドなし）

## アーキテクチャ

### モノレポ構造

```
tsuzuri/
├── packages/
│   ├── protocol/         # 共有型とプロトコル定義
│   ├── makimono/        # CRDT実装
│   ├── client/          # Webクライアント (Vite + TypeScript + Monaco)
│   └── server/          # Node.jsサーバー (WebSocketリレー + ストレージ)
├── app/                 # レガシーアプリ（置き換え中）
├── docs/                # ドキュメント
└── data/                # ランタイムデータ（gitignored）
```

### コンポーネント

#### Protocol (@tsuzuri/protocol)

クライアントとサーバー間の通信のための共有型とプロトコルを定義：

- **メッセージタイプ**: hello, welcome, op, presence, snapshot
- **操作タイプ**: ブロック認識を持つinsert、delete
- **署名正規化**: 操作のEd25519署名
- **ツリー構造**: ドキュメントツリーの構成

#### CRDT (@tsuzuri/makimono)

次の機能を持つシンプルなRGA/Logoot変種を実装：

- **ポジションID**: siteId + counterベース
- **ブロック認識**: マークダウンブロック検出（見出し、リスト、コードなど）
- **プラガブル順序付け**: 設定可能なID順序戦略
- **API**: apply, generateInsert, generateDelete, materialize

#### Client (@tsuzuri/client)

最小限のDOM Webクライアントの機能：

- **Monaco Editor**: マークダウンサポート付きフル機能コードエディター
- **ゴーストテキストオーバーレイ**: 他のユーザーの入力をリアルタイムで表示
- **プレゼンスインジケーター**: カーソル位置を持つ接続ユーザーを表示
- **ツリービュー**: ドキュメント階層をナビゲート
- **WebSocketクライアント**: サーバーとのリアルタイム通信

#### Server (@tsuzuri/server)

以下を提供するNode.js WebSocketサーバー：

- **WebSocketリレー**: 接続されたクライアントに操作とプレゼンスをブロードキャスト
- **署名検証**: 署名された操作のEd25519検証
- **スナップショットストレージ**: ファイルシステムベースのJSONストレージ
- **画像アップロード**: sharp → WebP変換による画像アップロードエンドポイント
- **抽象ストレージ**: 将来のデータベースバックエンド用インターフェース
- **認証プレースホルダー**: 最小限の認証構造

## はじめに

### 前提条件

- Node.js 18+ 
- pnpm 10+

### インストール

```bash
# 依存関係のインストール
pnpm install

# すべてのパッケージをビルド
pnpm build
```

### 開発

クライアントとサーバーの両方を開発モードで実行：

```bash
# クライアントとサーバーを並行して実行
pnpm dev

# または個別に実行：
pnpm dev:client  # http://localhost:3000 でクライアント
pnpm dev:server  # ws://localhost:3001 でサーバー
```

### ビルド

```bash
# すべてのパッケージをビルド
pnpm build
```

## Protocol v0

### 接続フロー

1. クライアントがサーバーへWebSocket接続を開く
2. クライアントが公開鍵とドキュメントIDを含む`hello`メッセージを送信
3. サーバーがサイトIDを割り当て、スナップショット付きの`welcome`を送信
4. クライアントがスナップショットを適用して編集を開始
5. すべての操作が署名され、サーバーを通じてブロードキャストされる

### メッセージタイプ

#### Hello (クライアント → サーバー)

```typescript
{
  type: 'hello',
  version: 0,
  publicKey: string,  // Ed25519公開鍵（16進数）
  docId: string
}
```

#### Welcome (サーバー → クライアント)

```typescript
{
  type: 'welcome',
  siteId: string,
  snapshot: {
    docId: string,
    content: string,
    operations: SignedOperation[],
    version: number
  }
}
```

#### Operation (クライアント ↔ サーバー)

```typescript
{
  type: 'op',
  op: {
    docId: string,
    opId: { siteId: string, counter: number },
    parent: { siteId: string, counter: number } | null,
    payload: {
      type: 'insert',
      char: string,
      blockType?: string
    } | {
      type: 'delete',
      targetId: { siteId: string, counter: number }
    },
    signature: string,      // Ed25519署名（16進数）
    publicKey: string       // Ed25519公開鍵（16進数）
  }
}
```

#### Presence (クライアント ↔ サーバー)

```typescript
{
  type: 'presence',
  presence: {
    siteId: string,
    publicKey: string,
    caret?: { line: number, column: number },
    selection?: {
      start: { line: number, column: number },
      end: { line: number, column: number }
    },
    ghostText?: Array<{
      position: { line: number, column: number },
      text: string
    }>
  }
}
```

### 署名

操作はEd25519を使用して署名されます。署名対象は正規化されたJSONです：

```typescript
const canonical = {
  docId: op.docId,
  opId: op.opId,
  parent: op.parent,
  payload: op.payload
};
const message = JSON.stringify(canonical, Object.keys(canonical).sort());
const signature = ed25519.sign(message, privateKey);
```

## CRDT実装

### ポジションID

各文字は一意のポジションIDを持ちます：

```typescript
{
  siteId: string,    // 一意のサイト識別子
  counter: number    // 単調増加カウンター
}
```

### ツリー構造

文字はツリーで構成されます：
- 親子関係が順序を決定
- 兄弟はポジションIDでソート
- ルートは`parent: null`として表現

### ブロック認識

CRDTはマークダウンブロックタイプを追跡します：
- `heading-1`から`heading-6`
- `list-item`
- `code-block`
- `blockquote`
- `paragraph`
- など

これにより、ブロックレベルの操作とフォーマット保持が可能になります。

### API

```typescript
// CRDTインスタンスを作成
const crdt = new CRDTDocument({ siteId: 'site-1' });

// 操作を適用
crdt.apply(operation);

// 挿入操作を生成
const insertOp = crdt.generateInsert(
  parentId,     // 挿入後の位置
  'a',          // 挿入する文字
  'doc-1',      // ドキュメントID
  'paragraph'   // ブロックタイプ
);

// 削除操作を生成
const deleteOp = crdt.generateDelete(
  targetId,     // 削除する位置
  'doc-1'       // ドキュメントID
);

// 現在の状態を具体化
const text = crdt.materialize();
```

## ストレージ

### ファイルシステムストア

デフォルトのストレージ実装はJSONファイルを使用：

```
data/
├── docs/
│   ├── welcome.json
│   ├── getting-started.json
│   └── ...
├── trees/
│   └── main.json
└── uploads/
    ├── image-123456.webp
    └── ...
```

### スナップショット形式

```json
{
  "docId": "welcome",
  "content": "# Welcome...",
  "operations": [
    {
      "docId": "welcome",
      "opId": { "siteId": "site-0", "counter": 0 },
      "parent": null,
      "payload": { "type": "insert", "char": "#", "blockType": "heading-1" },
      "signature": "...",
      "publicKey": "..."
    }
  ],
  "version": 42
}
```

### 抽象インターフェース

`SnapshotStore`インターフェースは将来の実装を可能にします：
- データベースバックエンド（PostgreSQL、MongoDBなど）
- クラウドストレージ（S3、GCSなど）
- テスト用インメモリストア

## 画像アップロード

### エンドポイント

```
POST /upload
Content-Type: image/*
```

### 処理

画像は自動的に：
1. WebP形式に変換
2. 最大2000x2000にリサイズ（アスペクト比維持）
3. 品質80で圧縮
4. `data/uploads/`に保存

### レスポンス

```json
{
  "success": true,
  "url": "/uploads/image-1234567890.webp",
  "filename": "image-1234567890.webp"
}
```

## 将来の拡張

### 認証

現在はプレースホルダーを使用。将来の実装には以下を含む必要があります：
- ユーザー登録/ログイン
- セッション管理
- ドキュメントレベルの権限
- APIキー管理

### CRDT変種

抽象化レイヤーにより以下が可能：
- Yjs統合
- Automerge統合
- カスタムCRDTアルゴリズム
- パフォーマンス最適化

### リッチコラボレーション

- 音声/ビデオ通話
- コメントと注釈
- 変更追跡
- 競合解決UI

### スケール

- Redis pub/subによる水平スケーリング
- スナップショット用データベースバックエンド
- 静的アセット用CDN
- ピアツーピア用WebRTC

## ライセンス

MIT
