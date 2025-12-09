# CRDT Implementation

## Overview

Tsuzuri uses a custom CRDT (Conflict-free Replicated Data Type) based on RGA (Replicated Growable Array) with Logoot-style identifiers. The implementation is block-aware for Markdown content.

## Design Goals

1. **Conflict-free merging**: Operations can be applied in any order
2. **Convergence**: All clients eventually reach the same state
3. **Causality preservation**: Respects happened-before relationships
4. **Block awareness**: Preserves Markdown structure
5. **Pluggable ordering**: Configurable ID comparison strategy

## Position Identifiers

### Structure

Each character has a unique position ID:

```typescript
interface PositionId {
  siteId: string;   // Unique site identifier
  counter: number;  // Monotonically increasing counter
}
```

### Site IDs

- Assigned by server on connection
- Format: `site-{number}` (e.g., `site-0`, `site-1`)
- Unique per client session
- Used to break ordering ties

### Counters

- Start at 0 for each site
- Increment for each new operation
- Never reset or reuse
- Ensures uniqueness within site

## Tree Structure

### Parent-Child Relationships

Characters form a tree structure:

```
ROOT (null)
├─ PositionId(site-0, 0) → 'H'
│  ├─ PositionId(site-0, 1) → 'e'
│  │  └─ PositionId(site-1, 0) → 'l'  // Concurrent insert
│  └─ PositionId(site-0, 2) → 'l'
└─ PositionId(site-0, 3) → 'o'
```

### Ordering Rules

Siblings are ordered by:
1. Compare `siteId` lexicographically
2. If equal, compare `counter` numerically

This provides deterministic ordering across all clients.

### Traversal

In-order traversal yields the document text:

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

## Operations

### Insert

Creates a new character as a child of an existing position:

```typescript
{
  docId: "welcome",
  opId: { siteId: "site-0", counter: 5 },
  parent: { siteId: "site-0", counter: 4 },  // Insert after this
  payload: {
    type: "insert",
    char: "a",
    blockType: "paragraph"
  }
}
```

**Semantics**:
- Creates new node with ID `opId`
- Attaches as child of `parent` (or root if `parent` is null)
- Character is `char` with markdown block type

### Delete

Creates an immutable delete operation with uniform structure:

```typescript
{
  docId: "welcome",
  opId: { siteId: "site-0", counter: 5 },  // Unique ID for this delete operation
  parent: { siteId: "site-0", counter: 3 },  // ID of character to delete
  payload: {
    type: "delete"
  }
}
```

**Semantics**:
- Creates independent delete operation with unique `opId`
- Uses `parent` field to reference target (consistent with insert)
- Original insert operation remains immutable
- Target is removed from visible nodes
- Delete operations are append-only and immutable

**Uniform Design**:
All operations follow the same structure:
- `opId`: unique identifier for the operation
- `parent`: position reference (insert: where to attach, delete: what to delete)
- `payload`: operation-specific data

This enables future extensibility (e.g., `modify`, `format` operations).

### Concurrent Operations

Example: Two clients insert at same position:

```
Initial: "Hello"

Client A inserts "x" after "l" → "Helxlo"
Client B inserts "y" after "l" → "Helylo"

After merge: "Helxylo" or "Helyxlo" (deterministic)
```

The ordering is determined by comparing position IDs.

## Block Awareness

### Block Types

Detected from line content:

```typescript
type BlockType =
  | 'paragraph'
  | 'heading-1' | 'heading-2' | ... | 'heading-6'
  | 'list-item'
  | 'code-block'
  | 'blockquote'
  | 'horizontal-rule';
```

### Detection Algorithm

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

### Block-Aware Operations

Each character is tagged with its block type:

```typescript
{
  id: { siteId: "site-0", counter: 0 },
  char: "#",
  blockType: "heading-1",
  deleted: false
}
```

This allows:
- Preserving formatting during merge
- Block-level operations (future)
- Semantic understanding of content

## API

### CRDTDocument Class

```typescript
class CRDTDocument {
  constructor(config: {
    siteId: string;
    orderingStrategy?: (a: PositionId, b: PositionId) => number;
  });
  
  // Apply an operation
  apply(op: Operation): void;
  
  // Generate insert operation
  generateInsert(
    parent: PositionId | null,
    char: string,
    docId: string,
    blockType?: string
  ): Operation;
  
  // Generate delete operation
  generateDelete(
    targetId: PositionId,
    docId: string
  ): Operation;
  
  // Materialize current state
  materialize(): string;
  
  // Get position at text offset
  getPositionAtOffset(offset: number): PositionId | null;
  
  // Get parent for inserting at offset
  getParentForInsert(offset: number): PositionId | null;
}
```

### Example Usage

```typescript
// Create CRDT for this site
const crdt = new CRDTDocument({ siteId: 'site-0' });

// Insert characters
const op1 = crdt.generateInsert(null, 'H', 'doc-1', 'paragraph');
crdt.apply(op1);

const op2 = crdt.generateInsert(op1.opId, 'e', 'doc-1', 'paragraph');
crdt.apply(op2);

const op3 = crdt.generateInsert(op2.opId, 'l', 'doc-1', 'paragraph');
crdt.apply(op3);

// Get current text
console.log(crdt.materialize()); // "Hel"

// Delete a character
const delOp = crdt.generateDelete(op2.opId, 'doc-1');
crdt.apply(delOp);

console.log(crdt.materialize()); // "Hl"
```

## Conflict Resolution

### Insert-Insert Conflict

Two clients insert at same position:

```
Site 0: parent = posA, char = 'x'
Site 1: parent = posA, char = 'y'

Result: Both are children of posA, ordered by site ID
```

### Delete-Delete Conflict

Two clients delete same character:

```
Both: delete posA

Result: Character is deleted (idempotent)
```

### Insert-Delete Conflict

One client inserts, another deletes parent:

```
Site 0: insert child of posA
Site 1: delete posA

Result: posA is deleted, child remains visible
```

The child node is preserved because deletes only mark nodes as deleted (tombstones).

## Performance Considerations

### Time Complexity

- Apply operation: O(1) (hash map insert)
- Materialize: O(n log n) where n = number of visible chars
- Get position at offset: O(n log n)

### Space Complexity

- O(n + d) where n = chars, d = deleted chars
- Deleted chars are tombstones (needed for ordering)

### Optimizations

Future improvements:
- Garbage collection of old tombstones
- Indexed access for faster offset lookups
- Incremental materialization
- Compressed position IDs

## Comparison with Other CRDTs

### vs Operational Transform (OT)

**Advantages**:
- No central server for transformation
- Commutative and associative
- Simpler reasoning about correctness

**Disadvantages**:
- More metadata overhead
- Tombstone accumulation

### vs Yjs

**Advantages**:
- Simpler implementation
- More transparent behavior
- Easier to debug

**Disadvantages**:
- Less optimized
- No built-in undo/redo
- Larger memory footprint

### vs Automerge

**Advantages**:
- Block awareness built-in
- More control over structure
- Easier integration with markdown

**Disadvantages**:
- Less mature
- Fewer optimizations
- No time travel

## Future Enhancements

### Garbage Collection

Remove tombstones that are:
- Older than threshold (e.g., 30 days)
- Not referenced by any live operation
- Confirmed by all active clients

### Rich Text

Support for:
- Inline formatting (bold, italic, code)
- Links and references
- Embedded images
- Custom attributes

### Undo/Redo

Stack-based undo with:
- Per-client undo stacks
- Inverse operations
- Timestamp-based redo

### Branching

Support for:
- Named branches
- Merge operations
- Conflict visualization

## Testing

### Property-Based Tests

Test that CRDT satisfies:
1. Convergence: All orderings converge to same state
2. Causality: Respects happened-before
3. Idempotence: Applying same op twice = applying once

### Scenario Tests

Test specific scenarios:
- Concurrent inserts
- Concurrent deletes
- Insert after delete
- Long documents
- Rapid editing

### Benchmarks

Measure performance:
- Operations per second
- Memory usage
- Materialization time
- Network bandwidth
