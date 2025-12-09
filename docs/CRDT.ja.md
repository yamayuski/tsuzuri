# CRDT実装

## 概要

TsuzuriはRGA（Replicated Growable Array）をベースとし、Logootスタイルの識別子を持つカスタムCRDT（Conflict-free Replicated Data Type）を使用しています。この実装はマークダウンコンテンツに対してブロック認識機能を備えています。

## 設計目標

1. **競合のないマージ**: 操作は任意の順序で適用可能
2. **収束**: すべてのクライアントが最終的に同じ状態に到達
3. **因果関係の保持**: happened-before関係を尊重
4. **ブロック認識**: マークダウン構造を保持
5. **プラガブル順序付け**: 設定可能なID比較戦略

## ポジション識別子

### 構造

各文字は一意のポジションIDを持ちます：

```typescript
interface PositionId {
  siteId: string;   // 一意のサイト識別子
  counter: number;  // 単調増加カウンター
}
```

### サイトID

- 接続時にサーバーによって割り当て
- 形式：`site-{number}`（例：`site-0`、`site-1`）
- クライアントセッションごとに一意
- 順序付けのタイブレークに使用

### カウンター

- 各サイトで0から開始
- 新しい操作ごとにインクリメント
- リセットや再利用はされない
- サイト内での一意性を保証

## ツリー構造

### 親子関係

文字はツリー構造を形成します：

```
ROOT (null)
├─ PositionId(site-0, 0) → 'H'
│  ├─ PositionId(site-0, 1) → 'e'
│  │  └─ PositionId(site-1, 0) → 'l'  // 並行挿入
│  └─ PositionId(site-0, 2) → 'l'
└─ PositionId(site-0, 3) → 'o'
```

### 順序付けルール

兄弟は以下の順序で並べられます：
1. `siteId`を辞書順で比較
2. 同じ場合、`counter`を数値的に比較

これにより、すべてのクライアント間で決定的な順序付けが提供されます。

### トラバーサル

順序通りのトラバーサルでドキュメントテキストが得られます：

```typescript
function traverse(parent: PositionId | null): string {
  const children = getChildren(parent).sort(comparePositionIds);
  let result = '';
  for (const child of children) {
    result += child.char;
    result += traverse(child.id);
  }
  return result;
}
```

## 操作

### Insert

既存の位置の子として新しい文字を作成：

```typescript
{
  docId: "welcome",
  opId: { siteId: "site-0", counter: 5 },
  parent: { siteId: "site-0", counter: 4 },  // この後に挿入
  payload: {
    type: "insert",
    char: "a",
    blockType: "paragraph"
  }
}
```

**セマンティクス**:
- ID `opId`で新しいノードを作成
- `parent`の子として付加（`parent`がnullの場合はルート）
- 文字は`char`でマークダウンブロックタイプ付き

### Delete

ターゲットを参照する不変な削除レコードを作成：

```typescript
{
  docId: "welcome",
  opId: { siteId: "site-0", counter: 5 },  // この削除操作の一意なID
  parent: null,
  payload: {
    type: "delete",
    targetId: { siteId: "site-0", counter: 3 }  // 削除する文字のID
  }
}
```

**セマンティクス**:
- 一意な`opId`を持つ独立した削除操作を作成
- `targetId`を通じてターゲット文字を参照
- 元の挿入操作は不変のまま
- ターゲットは具体化されたテキストに含まれない
- 削除操作は追記型で不変

### 並行操作

例：2つのクライアントが同じ位置に挿入：

```
初期状態: "Hello"

クライアントAが"l"の後に"x"を挿入 → "Helxlo"
クライアントBが"l"の後に"y"を挿入 → "Helylo"

マージ後: "Helxylo"または"Helyxlo"（決定的）
```

順序付けはポジションIDの比較によって決定されます。

## ブロック認識

### ブロックタイプ

行の内容から検出：

```typescript
type BlockType =
  | 'paragraph'
  | 'heading-1' | 'heading-2' | ... | 'heading-6'
  | 'list-item'
  | 'code-block'
  | 'blockquote'
  | 'horizontal-rule';
```

### 検出アルゴリズム

```typescript
function detectBlockType(line: string): BlockType {
  if (/^#{1,6}\s/.test(line)) {
    const level = line.match(/^(#{1,6})/)[1].length;
    return `heading-${level}`;
  }
  if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
    return 'list-item';
  }
  if (/^```/.test(line)) {
    return 'code-block';
  }
  if (/^>\s/.test(line)) {
    return 'blockquote';
  }
  return 'paragraph';
}
```

### ブロック認識操作

各文字にはブロックタイプのタグが付けられます：

```typescript
{
  id: { siteId: "site-0", counter: 0 },
  char: "#",
  blockType: "heading-1",
  deleted: false
}
```

これにより以下が可能になります：
- マージ中のフォーマット保持
- ブロックレベル操作（将来）
- コンテンツのセマンティック理解

## API

### CRDTDocumentクラス

```typescript
class CRDTDocument {
  constructor(config: {
    siteId: string;
    orderingStrategy?: (a: PositionId, b: PositionId) => number;
  });
  
  // 操作を適用
  apply(op: Operation): void;
  
  // 挿入操作を生成
  generateInsert(
    parent: PositionId | null,
    char: string,
    docId: string,
    blockType?: string
  ): Operation;
  
  // 削除操作を生成
  generateDelete(
    targetId: PositionId,
    docId: string
  ): Operation;
  
  // 現在の状態を具体化
  materialize(): string;
  
  // テキストオフセットの位置を取得
  getPositionAtOffset(offset: number): PositionId | null;
  
  // オフセットでの挿入用の親を取得
  getParentForInsert(offset: number): PositionId | null;
}
```

### 使用例

```typescript
// このサイト用のCRDTを作成
const crdt = new CRDTDocument({ siteId: 'site-0' });

// 文字を挿入
const op1 = crdt.generateInsert(null, 'H', 'doc-1', 'paragraph');
crdt.apply(op1);

const op2 = crdt.generateInsert(op1.opId, 'e', 'doc-1', 'paragraph');
crdt.apply(op2);

const op3 = crdt.generateInsert(op2.opId, 'l', 'doc-1', 'paragraph');
crdt.apply(op3);

// 現在のテキストを取得
console.log(crdt.materialize()); // "Hel"

// 文字を削除
const delOp = crdt.generateDelete(op2.opId, 'doc-1');
crdt.apply(delOp);

console.log(crdt.materialize()); // "Hl"
```

## 競合解決

### Insert-Insert競合

2つのクライアントが同じ位置に挿入：

```
サイト0: parent = posA, char = 'x'
サイト1: parent = posA, char = 'y'

結果: 両方がposAの子、サイトIDで順序付け
```

### Delete-Delete競合

2つのクライアントが同じ文字を削除：

```
両方: posAを削除

結果: 文字は削除される（冪等）
```

### Insert-Delete競合

1つのクライアントが挿入、もう1つが親を削除：

```
サイト0: posAの子を挿入
サイト1: posAを削除

結果: posAは削除されるが、子は表示される
```

子ノードは保持されます。削除はノードを削除済みとしてマークするだけです（トゥームストーン）。

## パフォーマンスの考慮事項

### 時間計算量

- 操作適用: O(1)（ハッシュマップ挿入）
- 具体化: O(n log n)（nは表示文字数）
- オフセットでの位置取得: O(n log n)

### 空間計算量

- O(n + d)（nは文字数、dは削除された文字数）
- 削除された文字はトゥームストーン（順序付けに必要）

### 最適化

将来の改善：
- 古いトゥームストーンのガベージコレクション
- より高速なオフセット検索用のインデックスアクセス
- インクリメンタル具体化
- 圧縮されたポジションID

## 他のCRDTとの比較

### vs Operational Transform (OT)

**利点**:
- 変換のための中央サーバーが不要
- 可換的かつ結合的
- 正確性についてのシンプルな推論

**欠点**:
- より多くのメタデータオーバーヘッド
- トゥームストーンの蓄積

### vs Yjs

**利点**:
- よりシンプルな実装
- より透過的な動作
- デバッグが容易

**欠点**:
- 最適化が少ない
- 組み込みのアンドゥ/リドゥなし
- より大きなメモリフットプリント

### vs Automerge

**利点**:
- ブロック認識が組み込み
- 構造のより多くの制御
- マークダウンとの統合が容易

**欠点**:
- 成熟度が低い
- 最適化が少ない
- タイムトラベル機能なし

## 将来の拡張

### ガベージコレクション

以下のトゥームストーンを削除：
- 閾値より古い（例：30日）
- ライブ操作から参照されていない
- すべてのアクティブクライアントによって確認済み

### リッチテキスト

以下のサポート：
- インラインフォーマット（太字、イタリック、コード）
- リンクと参照
- 埋め込み画像
- カスタム属性

### アンドゥ/リドゥ

スタックベースのアンドゥ：
- クライアントごとのアンドゥスタック
- 逆操作
- タイムスタンプベースのリドゥ

### ブランチング

以下のサポート：
- 名前付きブランチ
- マージ操作
- 競合の可視化

## テスト

### プロパティベーステスト

CRDTが満たすことをテスト：
1. 収束：すべての順序付けが同じ状態に収束
2. 因果関係：happened-beforeを尊重
3. 冪等性：同じ操作を2回適用 = 1回適用

### シナリオテスト

特定のシナリオをテスト：
- 並行挿入
- 並行削除
- 削除後の挿入
- 長いドキュメント
- 高速編集

### ベンチマーク

パフォーマンスを測定：
- 1秒あたりの操作数
- メモリ使用量
- 具体化時間
- ネットワーク帯域幅
