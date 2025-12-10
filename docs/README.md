# Tsuzuri - Next-Gen Collaborative Markdown Wiki

## Overview

Tsuzuri is a collaborative markdown wiki with real-time editing capabilities, built using WebSocket and CRDT technology. It features:

- Real-time collaborative editing with ghost text showing other users' typing
- Ed25519 signature verification for operations
- Block-aware CRDT for markdown content
- Tree-based document organization
- Image upload with automatic WebP conversion
- Minimal DOM client (no virtual DOM overhead)

## Architecture

### Monorepo Structure

```
tsuzuri/
├── packages/
│   ├── protocol/         # Shared types and protocol definitions
│   ├── makimono/        # CRDT implementation
│   ├── client/          # Web client (Vite + TypeScript + Monaco)
│   └── server/          # Node.js server (WebSocket relay + storage)
├── app/                 # Legacy app (being replaced)
├── docs/                # Documentation
└── data/                # Runtime data (gitignored)
```

### Components

#### Protocol (@tsuzuri/protocol)

Defines the shared types and protocol for communication between client and server:

- **Message Types**: hello, welcome, op, presence, snapshot
- **Operation Types**: insert, delete with block awareness
- **Signature Canonicalization**: Ed25519 signing of operations
- **Tree Structure**: Document tree organization

#### CRDT (@tsuzuri/makimono)

Implements a simple RGA/Logoot variant with:

- **Position IDs**: siteId + counter based
- **Block Awareness**: Markdown block detection (headings, lists, code, etc.)
- **Pluggable Ordering**: Configurable ID ordering strategy
- **API**: apply, generateInsert, generateDelete, materialize

#### Client (@tsuzuri/client)

Minimal DOM web client featuring:

- **Monaco Editor**: Full-featured code editor with markdown support
- **Ghost Text Overlay**: Shows other users' typing in real-time
- **Presence Indicators**: Displays connected users with cursor positions
- **Tree View**: Navigate document hierarchy
- **WebSocket Client**: Real-time communication with server

#### Server (@tsuzuri/server)

Node.js WebSocket server providing:

- **WebSocket Relay**: Broadcasts operations and presence to connected clients
- **Signature Verification**: Ed25519 verification of signed operations
- **Snapshot Storage**: File system-based JSON storage
- **Image Upload**: Endpoint for uploading images with sharp → WebP conversion
- **Abstract Storage**: Interface for future database backends
- **Auth Placeholder**: Minimal authentication structure

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 10+

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development

Run both client and server in development mode:

```bash
# Run client and server in parallel
pnpm dev

# Or run separately:
pnpm dev:client  # Client on http://localhost:3000
pnpm dev:server  # Server on ws://localhost:3001
```

### Building

```bash
# Build all packages
pnpm build
```

## Protocol v0

### Connection Flow

1. Client opens WebSocket to server
2. Client sends `hello` message with public key and document ID
3. Server assigns site ID and sends `welcome` with snapshot
4. Client applies snapshot and begins editing
5. All operations are signed and broadcast through server

### Message Types

#### Hello (Client → Server)

```typescript
{
  type: 'hello',
  version: 0,
  publicKey: string,  // Ed25519 public key (hex)
  docId: string
}
```

#### Welcome (Server → Client)

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

#### Operation (Client ↔ Server)

```typescript
{
  type: 'op',
  op: {
    docId: string,
    opId: { siteId: string, counter: number },
    parent: { siteId: string, counter: number } | null,  // Context-dependent
    payload: {
      type: 'insert',
      char: string,
      blockType?: string
    } | {
      type: 'delete'
    },
    signature: string,      // Ed25519 signature (hex)
    publicKey: string       // Ed25519 public key (hex)
  }
}
```

**Note**: `parent` field meaning depends on operation type:
- For `insert`: parent node to attach to
- For `delete`: target node to delete

This uniform structure allows for extensible operation types.

#### Presence (Client ↔ Server)

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

### Signing

Operations are signed using Ed25519. The signing target is canonical JSON:

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

## CRDT Implementation

### Position IDs

Each character has a unique position ID:

```typescript
{
  siteId: string,    // Unique site identifier
  counter: number    // Monotonically increasing counter
}
```

### Tree Structure

Characters are organized in a tree:
- Parent relationship determines ordering
- Siblings are sorted by position ID
- Root is represented as `parent: null`

### Block Awareness

The CRDT tracks markdown block types:
- `heading-1` through `heading-6`
- `list-item`
- `code-block`
- `blockquote`
- `paragraph`
- etc.

This enables block-level operations and formatting preservation.

### API

```typescript
// Create CRDT instance
const crdt = new CRDTDocument({ siteId: 'site-1' });

// Apply an operation
crdt.apply(operation);

// Generate insert operation
const insertOp = crdt.generateInsert(
  parentId,     // Position to insert after
  'a',          // Character to insert
  'doc-1',      // Document ID
  'paragraph'   // Block type
);

// Generate delete operation
const deleteOp = crdt.generateDelete(
  targetId,     // Position to delete
  'doc-1'       // Document ID
);

// Materialize current state
const text = crdt.materialize();
```

## Storage

### File System Store

The default storage implementation uses JSON files:

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

### Snapshot Format

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

### Abstract Interface

The `SnapshotStore` interface allows for future implementations:
- Database backends (PostgreSQL, MongoDB, etc.)
- Cloud storage (S3, GCS, etc.)
- In-memory stores for testing

## Image Upload

### Endpoint

```
POST /upload
Content-Type: image/*
```

### Processing

Images are automatically:
1. Converted to WebP format
2. Resized to max 2000x2000 (maintaining aspect ratio)
3. Compressed with quality 80
4. Stored in `data/uploads/`

### Response

```json
{
  "success": true,
  "url": "/uploads/image-1234567890.webp",
  "filename": "image-1234567890.webp"
}
```

## Future Enhancements

### Authentication

Currently uses a placeholder. Future implementation should include:
- User registration/login
- Session management
- Document-level permissions
- API key management

### CRDT Variants

The abstraction layer allows for:
- Yjs integration
- Automerge integration
- Custom CRDT algorithms
- Performance optimizations

### Rich Collaboration

- Audio/video calls
- Comments and annotations
- Change tracking
- Conflict resolution UI

### Scale

- Horizontal scaling with Redis pub/sub
- Database backend for snapshots
- CDN for static assets
- WebRTC for peer-to-peer

## License

MIT
