# 実装ノート - Wiki PoC スケルトン

## 概要

このドキュメントは、現在の実装状況、既知の制限事項、およびWiki PoCを完成させるためのロードマップを説明します。

## 現在のステータス

### ✅ 完了した機能

#### インフラストラクチャ
- [x] ワークスペースを持つpnpmモノレポ
- [x] すべてのパッケージのTypeScriptビルド設定
- [x] 開発スクリプト（dev、build）
- [x] ビルド成果物用の.gitignore

#### Protocolパッケージ (@tsuzuri/protocol)
- [x] メッセージタイプ定義（hello、welcome、op、presence、snapshot）
- [x] 操作タイプ（insert、delete）
- [x] ポジションID構造（siteId + counter）
- [x] 署名正規化関数
- [x] プレースホルダー署名/検証関数

#### CRDTパッケージ (@tsuzuri/makimono)
- [x] コア操作を持つCRDTDocumentクラス
- [x] ポジションID生成と順序付け
- [x] 文字ストレージ用ツリー構造
- [x] 挿入/削除操作の適用
- [x] テキスト具体化（ツリーから文字列へのトラバース）
- [x] ブロック認識マークダウン検出
- [x] プラガブル順序戦略

#### Clientパッケージ (@tsuzuri/client)
- [x] Vite + TypeScriptビルドセットアップ
- [x] Monaco editor統合
- [x] WebSocketクライアント接続
- [x] プロトコルメッセージハンドリング（hello、welcome、op、presence）
- [x] UIレイアウト（サイドバーツリー + エディター + ステータスバー）
- [x] 接続ステータス表示
- [x] プレゼンスマネージャー構造
- [x] ゴーストテキストオーバーレイ構造
- [x] プレースホルダーノード付きツリービュー

#### Serverパッケージ (@tsuzuri/server)
- [x] Node.js + TypeScriptセットアップ
- [x] wsライブラリを使用したWebSocketサーバー
- [x] 接続ハンドリングとサイトID割り当て
- [x] メッセージルーティング（hello → welcome、opブロードキャスト、presenceリレー）
- [x] ファイルシステムスナップショットストア
- [x] 抽象ストレージインターフェース
- [x] sharp → WebPによる画像アップロードエンドポイント
- [x] アップロード用CORSヘッダー
- [x] 認証サービスプレースホルダー

#### ドキュメント
- [x] アーキテクチャ概要（docs/README.md）
- [x] プロトコル仕様（docs/PROTOCOL.md）
- [x] CRDT説明（docs/CRDT.md）
- [x] クイックスタートガイド（README-WIKI.md）

### ⚠️ 実装済みだが本番環境未対応

#### 署名検証
**ステータス**: プレースホルダー実装  
**場所**: `packages/protocol/src/signing.ts`

```typescript
// 現在：常にtrueを返す
export async function verifySignature(signedOp: SignedOperation): Promise<boolean> {
  console.warn('Signature verification not yet implemented');
  return true;
}
```

**問題**: 操作が暗号検証なしで受け入れられ、不正な変更が可能になります。

**本番環境に必要**:
1. Ed25519ライブラリの統合（例：tweetnacl、libsodium.js、または@noble/ed25519）
2. 実際の署名検証の実装
3. 秘密鍵の安全な生成/保存
4. 鍵管理システム

**実装例**:
```typescript
import { verify } from '@noble/ed25519';

export async function verifySignature(signedOp: SignedOperation): Promise<boolean> {
  const message = getSigningMessage(signedOp);
  const signature = Buffer.from(signedOp.signature, 'hex');
  const publicKey = Buffer.from(signedOp.publicKey, 'hex');
  
  return await verify(signature, message, publicKey);
}
```

#### パスサニタイゼーション
**ステータス**: 基本実装  
**場所**: `packages/server/src/storage.ts`

```typescript
// 現在：シンプルな文字置換
const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
```

**問題**: すべてのパストラバーサル攻撃やUnicodeエッジケースを防げない可能性があります。

**本番環境に必要**:
1. ドキュメントIDに暗号ハッシュを使用（例：SHA-256）
2. またはホワイトリスト検証を実装
3. または適切なパスサニタイゼーションライブラリを使用

**実装例**:
```typescript
import { createHash } from 'crypto';

private getDocPath(docId: string): string {
  // ドキュメントIDをハッシュ化して安全なファイルシステムパスを確保
  const hash = createHash('sha256').update(docId).digest('hex');
  return join(this.docsDir, `${hash}.json`);
}
```

### ❌ 未実装

#### ローカル編集 → 操作生成
**ステータス**: 未実装  
**場所**: `packages/client/src/client.ts:172`

**問題**: クライアントは編集を検出しますが、CRDT操作を生成しないため、コラボレーティブ編集が機能しません。

**必要なもの**:
1. **差分計算**: 古いエディターコンテンツと新しいコンテンツを比較
   - コンポーネント状態で以前のコンテンツを追跡
   - 変更イベント付きMonacoのonDidChangeModelContentを使用
   - または差分アルゴリズムを使用（例：diff-match-patch）

2. **ポジションマッピング**: テキストオフセットをCRDTポジションIDに変換
   - `crdt.getParentForInsert(offset)`を使用して親ポジションを見つける
   - 文字 → ポジションIDマッピングを追跡

3. **操作生成**: 挿入/削除操作を作成
   - 各挿入：親ポジション付き挿入操作を生成
   - 各削除：ターゲットポジション付き削除操作を生成
   - マークダウン認識用のブロックタイプを含める

4. **署名**: Ed25519秘密鍵で操作に署名

5. **送信**: WebSocket経由でサーバーに送信

**実装例**:
```typescript
private handleLocalEdit(changes: monaco.editor.IModelContentChange[]): void {
  if (!this.crdt || !this.docId) return;

  for (const change of changes) {
    if (change.text) {
      // 挿入を処理
      for (let i = 0; i < change.text.length; i++) {
        const offset = change.rangeOffset + i;
        const parent = this.crdt.getParentForInsert(offset);
        const blockType = getBlockTypeAtPosition(this.editor.getValue(), offset);
        const op = this.crdt.generateInsert(parent, change.text[i], this.docId, blockType);
        const signedOp = await signOperation(op, this.privateKey);
        this.sendOp(signedOp);
      }
    }
    
    if (change.rangeLength > 0) {
      // 削除を処理
      for (let i = 0; i < change.rangeLength; i++) {
        const offset = change.rangeOffset + i;
        const targetId = this.crdt.getPositionAtOffset(offset);
        if (targetId) {
          const op = this.crdt.generateDelete(targetId, this.docId);
          const signedOp = await signOperation(op, this.privateKey);
          this.sendOp(signedOp);
        }
      }
    }
  }
}
```

#### サーバー側CRDT具体化
**ステータス**: 未実装  
**場所**: `packages/server/src/server.ts:129-130`

**問題**: サーバーがドキュメントコンテンツを更新するために操作を適用しないため、スナップショットが変更を反映しません。

**必要なもの**:
1. **CRDTインスタンス**: ドキュメントごとにCRDTDocumentインスタンスを作成
2. **操作適用**: 受信した操作をCRDTに適用
3. **具体化**: CRDT状態からコンテンツを再計算
4. **永続化**: スナップショットに更新されたコンテンツを保存

**実装例**:
```typescript
private documentCRDTs: Map<string, CRDTDocument> = new Map();

private async handleOp(ws: WebSocket, message: OpMessage): Promise<void> {
  const client = this.clients.get(ws);
  if (!client) return;

  // 署名を検証
  const isValid = await verifySignature(message.op);
  if (!isValid) {
    ws.close(1008, 'Invalid signature');
    return;
  }

  // CRDTインスタンスを取得または作成
  let crdt = this.documentCRDTs.get(client.docId);
  if (!crdt) {
    crdt = new CRDTDocument({ siteId: 'server' });
    this.documentCRDTs.set(client.docId, crdt);
    
    // 既存の操作をロード
    const snapshot = await this.storage.load(client.docId);
    if (snapshot) {
      for (const op of snapshot.operations) {
        crdt.apply(op);
      }
    }
  }

  // 操作を適用
  crdt.apply(message.op);

  // 具体化して保存
  const snapshot = await this.storage.load(client.docId);
  if (snapshot) {
    snapshot.operations.push(message.op);
    snapshot.content = crdt.materialize();
    snapshot.version++;
    await this.storage.save(client.docId, snapshot);
  }

  // ブロードキャスト
  this.broadcast(client.docId, message, ws);
}
```

#### ツリーCRUD操作
**ステータス**: 未実装

**必要なもの**:
- ツリー内に新しいドキュメントを作成
- ドキュメントの名前変更
- ドキュメントの移動（親を変更）
- ドキュメントの削除
- ツリー構造の永続化
- クライアント起動時にツリーをロード

#### プレゼンスゴーストテキスト
**ステータス**: 構造は存在するが機能していない

**必要なもの**:
- 入力中のコミットされていないテキストをキャプチャ
- プレゼンス更新の一部として送信
- 正しい位置にゴーストテキストオーバーレイで表示

#### 認証と認可
**ステータス**: プレースホルダーのみ

**必要なもの**:
- ユーザー登録/ログイン
- セッション管理
- 公開鍵 → ユーザーマッピング
- ドキュメント権限（読み取り/書き込み）
- アクセス制御チェック

## テスト戦略

### 手動テスト（現在）
1. サーバー起動：`pnpm dev:server`
2. クライアント起動：`pnpm dev:client`
3. http://localhost:3000 を開く
4. 接続ステータスが「Connected」と表示されることを確認
5. サーバーログで「Client connected」を確認

### 自動テスト（将来）
1. **単体テスト**: CRDT操作、プロトコルシリアライゼーション、ストレージをテスト
2. **統合テスト**: WebSocketメッセージフロー、マルチクライアント同期をテスト
3. **E2Eテスト**: Playwrightで完全なユーザーシナリオをテスト
4. **負荷テスト**: 並行クライアント、大きなドキュメントをテスト

## パフォーマンスの考慮事項

### 現在の制限
- トゥームストーンのガベージコレクションなし
- 操作ごとに完全なドキュメント具体化
- インクリメンタルレンダリングなし
- すべての操作がメモリ + JSONファイルに保存

### 将来の最適化
1. **CRDT最適化**
   - 古いトゥームストーンをガベージコレクト
   - インクリメンタル具体化
   - 圧縮されたポジションID
   - より高速なトラバーサル用のスキップリストまたはフィンガーツリー

2. **ストレージ最適化**
   - データベースバックエンド（PostgreSQL、MongoDB）
   - 操作の圧縮/スナップショット
   - 高速検索用のインデックス
   - キャッシング層

3. **ネットワーク最適化**
   - 操作のバッチング
   - バイナリプロトコル（MessagePack、Protobuf）
   - 圧縮（gzip、brotli）
   - 再接続時のデルタ同期

4. **クライアント最適化**
   - 大きなドキュメント用の仮想スクロール
   - CRDT計算用のWeb Workers
   - デバウンスされた操作送信
   - 楽観的UIを持つローカル操作バッファ

## セキュリティの考慮事項

### 現在の脆弱性
1. ⚠️ **署名検証なし**: 誰でも操作を偽造可能
2. ⚠️ **認証なし**: 誰でも接続可能
3. ⚠️ **認可なし**: 誰でも任意のドキュメントにアクセス可能
4. ⚠️ **レート制限なし**: DoSに脆弱
5. ⚠️ **パストラバーサル**: 基本的なサニタイゼーションにエッジケースがある可能性

### 本番環境に必要
1. **暗号署名**: Ed25519検証を実装
2. **認証**: セキュアなセッション付きユーザーログイン
3. **認可**: ドキュメントレベルの権限
4. **レート制限**: ユーザーごとの操作制限
5. **入力検証**: すべての入力の厳密な検証
6. **監査ログ**: セキュリティレビュー用のすべての操作をログ

## ロードマップ

### フェーズ1：コア機能（次）
- [ ] Ed25519署名/検証を実装
- [ ] ローカル編集 → 操作生成を実装
- [ ] サーバー側CRDT具体化を実装
- [ ] マルチクライアントコラボレーションをテスト
- [ ] CRDTとプロトコルの単体テストを追加

### フェーズ2：必須機能
- [ ] ツリーCRUD操作
- [ ] ドキュメントの永続化とロード
- [ ] プレゼンスゴーストテキスト
- [ ] 競合解決UI
- [ ] エラーハンドリングと復旧

### フェーズ3：本番環境対応
- [ ] ユーザー認証
- [ ] ドキュメント権限
- [ ] レート制限
- [ ] データベースバックエンド
- [ ] パフォーマンス最適化
- [ ] セキュリティ監査

### フェーズ4：高度な機能
- [ ] コメントと注釈
- [ ] バージョン履歴
- [ ] PDF/HTMLへのエクスポート
- [ ] 検索機能
- [ ] リッチテキストフォーマット

## 既知の問題

1. **Monaco Workersの警告**: Monaco editorがワーカー設定の欠落について警告
   - 影響：エディターは読み込まれるがパフォーマンスが低下する可能性
   - 修正：Web workers用のMonaco環境を設定

2. **操作バッチング**: 各キーストロークが個別の操作を生成
   - 影響：ネットワークオーバーヘッド、操作ログの肥大化
   - 修正：時間枠内で操作をバッチ化

3. **再接続ハンドリング**: 切断時の自動再接続なし
   - 影響：ユーザーはページを更新する必要がある
   - 修正：指数バックオフによる再接続を実装

4. **メモリリーク**: CRDTがトゥームストーンをクリーンアップしない
   - 影響：メモリが無制限に増加
   - 修正：ガベージコレクションを実装

## 開発のヒント

### ローカルでの実行
```bash
# 依存関係のインストール
pnpm install

# すべてのパッケージをビルド
pnpm build

# 開発モードで実行（クライアントとサーバーの両方）
pnpm dev

# または個別に実行
pnpm dev:server  # ターミナル1
pnpm dev:client  # ターミナル2
```

### デバッグ
- クライアントログ：ブラウザDevToolsコンソールを開く
- サーバーログ：`pnpm dev:server`を実行しているターミナルを確認
- WebSocketトラフィック：ブラウザDevToolsネットワークタブを使用（WSフィルター）

### 機能の追加
1. `packages/protocol/src/types.ts`に型を追加
2. 適切なパッケージで実装
3. ドキュメントを更新
4. テストを追加（テストインフラが存在する場合）
5. このドキュメントを更新

## 参考資料

- [CRDT概要](https://crdt.tech/)
- [Replicated Growable Array (RGA)](https://pages.lip6.fr/Marc.Shapiro/papers/RGA-TPDS-2011.pdf)
- [Ed25519署名](https://ed25519.cr.yp.to/)
- [Monaco Editorドキュメント](https://microsoft.github.io/monaco-editor/)
- [WebSocketプロトコル](https://datatracker.ietf.org/doc/html/rfc6455)
