# プロトコル仕様 v0

## 概要

Tsuzuriプロトコルは、リアルタイムコラボレーティブ編集のためのWebSocketベースのプロトコルです。通信にはJSONメッセージを使用し、操作の検証にはEd25519署名を使用します。

## 接続ライフサイクル

### 1. 接続確立

クライアントがサーバーへのWebSocket接続を開始：

```
ws://server:3001/ws
```

### 2. ハンドシェイク

クライアントがhelloメッセージを送信：

```json
{
  "type": "hello",
  "version": 0,
  "publicKey": "a1b2c3...",
  "docId": "welcome"
}
```

サーバーがwelcomeで応答：

```json
{
  "type": "welcome",
  "siteId": "site-0",
  "snapshot": {
    "docId": "welcome",
    "content": "# Welcome\n\nThis is a test document.",
    "operations": [],
    "version": 1
  }
}
```

### 3. コラボレーティブ編集

クライアントが署名された操作を送信：

```json
{
  "type": "op",
  "op": {
    "docId": "welcome",
    "opId": { "siteId": "site-0", "counter": 5 },
    "parent": { "siteId": "site-0", "counter": 4 },
    "payload": {
      "type": "insert",
      "char": "a",
      "blockType": "paragraph"
    },
    "signature": "...",
    "publicKey": "..."
  }
}
```

サーバーが同じドキュメント内のすべてのクライアントにブロードキャスト。

### 4. プレゼンス更新

クライアントがプレゼンス情報を送信：

```json
{
  "type": "presence",
  "presence": {
    "siteId": "site-0",
    "publicKey": "...",
    "caret": { "line": 3, "column": 15 },
    "selection": {
      "start": { "line": 3, "column": 10 },
      "end": { "line": 3, "column": 15 }
    },
    "ghostText": [
      {
        "position": { "line": 3, "column": 15 },
        "text": "hello"
      }
    ]
  }
}
```

サーバーがプレゼンスを他のクライアントにブロードキャスト。

## メッセージタイプ

### Hello

**方向**: クライアント → サーバー

特定のドキュメントの接続を開始します。

**フィールド**:
- `type`: 常に`"hello"`
- `version`: プロトコルバージョン（現在は`0`）
- `publicKey`: 16進数形式のEd25519公開鍵
- `docId`: 開くドキュメントID

### Welcome

**方向**: サーバー → クライアント

接続を確認し、初期状態を提供します。

**フィールド**:
- `type`: 常に`"welcome"`
- `siteId`: このクライアントに割り当てられたサイト識別子
- `snapshot`: 現在のドキュメントスナップショット
  - `docId`: ドキュメントID
  - `content`: 具体化されたドキュメントコンテンツ
  - `operations`: すべての操作の配列
  - `version`: ドキュメントバージョン番号

### Op

**方向**: クライアント ↔ サーバー

署名されたCRDT操作を表します。

**フィールド**:
- `type`: 常に`"op"`
- `op`: 署名された操作オブジェクト
  - `docId`: ドキュメントID
  - `opId`: ポジション識別子
    - `siteId`: サイト識別子
    - `counter`: 操作カウンター
  - `parent`: 親ポジション（ルートの場合は`null`）
  - `payload`: 操作ペイロード
    - insertの場合：`type: "insert"`、`char: string`、`blockType?: string`
    - deleteの場合：`type: "delete"`
  - 注意：`parent`フィールドのセマンティクスは操作タイプによって異なります（insert：付加点、delete：ターゲット）
  - `signature`: Ed25519署名（16進数）
  - `publicKey`: Ed25519公開鍵（16進数）

### Presence

**方向**: クライアント ↔ サーバー

カーソル位置と入力状態を共有します。

**フィールド**:
- `type`: 常に`"presence"`
- `presence`: プレゼンス情報
  - `siteId`: サイト識別子
  - `publicKey`: 公開鍵
  - `caret`: カーソル位置（オプション）
    - `line`: 行番号
    - `column`: 列番号
  - `selection`: 選択範囲（オプション）
    - `start`: 開始位置
    - `end`: 終了位置
  - `ghostText`: コミットされていない入力（オプション）
    - 位置を持つテキストセグメントの配列

### Snapshot

**方向**: サーバー → クライアント

完全なドキュメントスナップショットを提供（同期/復旧用）。

**フィールド**:
- `type`: 常に`"snapshot"`
- `snapshot`: ドキュメントスナップショット（welcomeと同じ形式）

## 操作の署名

### 正規形式

操作はソート済みキーを持つ正規JSONフォームで署名されます：

```typescript
const canonical = {
  docId: op.docId,
  opId: op.opId,
  parent: op.parent,
  payload: op.payload
};

// キーをアルファベット順にソート
const message = JSON.stringify(canonical, Object.keys(canonical).sort());
```

正規形式の例：

```json
{"docId":"welcome","opId":{"counter":5,"siteId":"site-0"},"parent":{"counter":4,"siteId":"site-0"},"payload":{"blockType":"paragraph","char":"a","type":"insert"}}
```

### 署名プロセス

1. 正規JSON文字列を作成
2. バイトに変換（UTF-8エンコーディング）
3. Ed25519秘密鍵で署名
4. 署名を16進数文字列としてエンコード

### 検証プロセス

1. 操作フィールドを抽出（signatureとpublicKeyを除く）
2. 正規JSON文字列を作成
3. バイトに変換（UTF-8エンコーディング）
4. 提供された公開鍵を使用して署名を検証

## エラーハンドリング

### 無効な署名

署名検証が失敗した場合：
- サーバーはコード`1008`（ポリシー違反）で接続を閉じる
- メッセージ：`"Invalid signature"`

### 無効なメッセージ

メッセージが解析できない場合：
- サーバーはコード`1008`で接続を閉じる
- メッセージ：`"Invalid message"`

### ドキュメントが見つからない

ドキュメントが存在しない場合、サーバーは新しい空のドキュメントを作成します。

## 順序保証

### 操作の順序

- 操作は各サイト内で因果順序で適用される
- クロスサイト操作はCRDTマージセマンティクスを使用
- グローバルな順序保証なし

### プレゼンスの順序

- プレゼンス更新は順不同で到着する可能性がある
- 各クライアントのプレゼンスは最後の書き込みが優先
- 配信保証なし（ベストエフォート）

## レート制限

将来の実装には以下を含む可能性があります：
- クライアントあたりの1秒あたりの最大操作数
- 1秒あたりの最大プレゼンス更新数
- ドキュメントあたりの最大同時接続数

## セキュリティ

### 認証

現在は公開鍵をIDとして使用。将来：
- ユーザー認証が必要
- セッショントークン
- ドキュメントレベルの権限

### 認可

現在はすべての操作を許可。将来：
- 読み取り/書き込み権限
- 管理者操作
- ユーザーごとのレート制限

### 検証

サーバーが検証：
- メッセージ形式（JSONスキーマ）
- 操作署名（Ed25519）
- ドキュメントアクセス（将来）

## 拡張

プロトコルは拡張可能に設計されています：

### バージョンネゴシエーション

クライアントはhelloでプロトコルバージョンを指定：
```json
{
  "version": 1  // 将来のバージョン
}
```

サーバーはサポートされていないバージョンを拒否する可能性があります。

### カスタムメッセージタイプ

予約されたメッセージタイププレフィックス：
- `x-*`: 実験的拡張
- `plugin-*`: プラグイン固有のメッセージ

例：
```json
{
  "type": "x-cursor-annotation",
  "annotation": { /* カスタムデータ */ }
}
```

### メタデータ

操作とプレゼンスにメタデータを含めることができます：
```json
{
  "type": "op",
  "op": { /* ... */ },
  "metadata": {
    "timestamp": 1234567890,
    "client": "tsuzuri-web-1.0"
  }
}
```

## 実装ノート

### クライアント実装

- 自動再接続を持つWebSocketを使用
- 切断中の操作をバッファリング
- 再接続時にバッファリングされた操作を再生
- リモート操作をローカルCRDTにマージ

### サーバー実装

- 効率的なJSON解析を使用
- 署名を非同期で検証
- 同じドキュメントのクライアントのみにブロードキャスト
- 操作をストレージに永続化

### テスト

- メッセージのエンコード/デコードの単体テスト
- 完全フローの統合テスト
- 不正なメッセージのファズテスト
- 並行クライアントの負荷テスト
