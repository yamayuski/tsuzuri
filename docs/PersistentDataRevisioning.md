# 永続化データのリビジョニング方法

## 前提と設計方針

- すべてのデータは immutable。更新は常に「追記」で表現し、旧データは保持。
- データ関係はツリー構造（親子・参照）を持つ。認可は別設計（本書では扱わない）。
- 内容テキストは「副作用（Operation）の配列」で永続化する。
- リアルタイム共同編集は WebSocket を用い、CRDT によりコンフリクトを解消。
- 永続層は append-only バイナリログ。ガーベジコレクションは別途。

## Operation モデル

- Operation はテキストへの副作用を表す不変レコード。
- 種類: insert, delete（必要に応じて replace は insert+delete に分解）
- 位置は CRDT 用のロジカルポジション（例: Lamport/PosID）または UTF-16
  オフセットに変換可能なインデックス。
- 例（抽象型定義イメージ）:
  - id: string（ユニーク）
  - authorId: string
  - timestamp: number（単調増加が望ましい）
  - kind: "insert" | "delete"
  - pos: Position（CRDT ポジション）
  - text?: string（insert のみ）
  - length?: number（delete のみ）
  - parentObjectId: string（ツリー内の対象ノード）

## インメモリ永続化管理クラス（インターフェース）

- 目的: Operation の配列を保持し、現在状態の再構成と Operation のマージを提供。
- メソッド:
  - getState(objectId): Operation を適用して現在のテキストを返す
  - merge(ops): 新規 Operation を受け取り、CRDT を通してローカルログへ統合
  - getOperations(objectId): 指定オブジェクトの Operation
    一覧を返す（デバッグ/同期用）
  - snapshot(objectId): 現在のテキストのスナップショットを生成（オプション）
- 擬似的な型宣言（Deno/Fresh/Preact 前提の TypeScript 想定）:

```ts
export interface Operation {
  id: string;
  authorId: string;
  timestamp: number;
  kind: "insert" | "delete";
  pos: Position;
  text?: string;
  length?: number;
  parentObjectId: string;
}

export interface Position {
  // CRDT の識別情報（例: siteId + counter 等）
  // 具体実装は CRDT の選定（RGA, LSEQ, Yjs 等）に依存
}

export interface InMemoryPersistence {
  getState(objectId: string): string;
  getOperations(objectId: string): readonly Operation[];
  merge(ops: readonly Operation[]): void;
  snapshot?(objectId: string): ArrayBuffer; // 任意
}
```

## マージと再構成の手順（概要）

- merge:
  1. 未適用の Operation を ID 去重。
  2. CRDT ルールで順序整列・因果整合（timestamp/siteId ではなく CRDT 指定順）。
  3. ローカルログへ追記（append-only）。
- getState:
  1. 指定 objectId の Operation を収集。
  2. CRDT ポジションを用いて挿入/削除を適用し、文字列を再構成。
  3. 必要に応じてキャッシュ（例: バッファツリー）。

## バイナリ永続化ブロック設計（指針）

- BlockHeader: version, codec, objectId, count, checksum
- Entries: Operation を CBOR/MessagePack 等でエンコードして順次追記
- Index: objectId → offset
  の単純インデックス（メモリ常駐）。再起動時に再構築可能。
- GC/圧縮は別段階（例: スナップショット後に古いログを圧縮）。

## WebSocket 同期と CRDT

- クライアントからは Operation を送信。サーバは CRDT
  で整合化してブロードキャスト。
- 冪等化のために Operation ID で去重。
- 一時的フォークは CRDT マージで解消。認可はツリー単位で別処理。

## ツリー構造の取り扱い

- 各オブジェクトは title とユニーク ID を持つ。
- 親子関係はメタデータで表現し、テキスト Operation は parentObjectId に紐付け。
- ツリー操作（移動/コピー）はメタ Operation として別種で扱うと拡張容易。

## 実装メモ

- ランタイム: Deno 2.5+。fmt: `deno fmt`。
- UI: Preact 10+、Fresh 2.2+、Tailwind CSS 4+ + daisyUI。
- CRDT 実装は既存ライブラリの採用を推奨（例: Yjs）または軽量 RGA を自作。
