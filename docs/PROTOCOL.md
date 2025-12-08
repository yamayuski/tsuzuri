# Protocol Specification v0

## Overview

The Tsuzuri protocol is a WebSocket-based protocol for real-time collaborative editing. It uses JSON messages for communication and Ed25519 signatures for operation verification.

## Connection Lifecycle

### 1. Connection Establishment

Client initiates WebSocket connection to server:

```
ws://server:3001/ws
```

### 2. Handshake

Client sends hello message:

```json
{
  "type": "hello",
  "version": 0,
  "publicKey": "a1b2c3...",
  "docId": "welcome"
}
```

Server responds with welcome:

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

### 3. Collaborative Editing

Clients send signed operations:

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

Server broadcasts to all clients in the same document.

### 4. Presence Updates

Clients send presence information:

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

Server broadcasts presence to other clients.

## Message Types

### Hello

**Direction**: Client → Server

Initiates connection for a specific document.

**Fields**:
- `type`: Always `"hello"`
- `version`: Protocol version (currently `0`)
- `publicKey`: Ed25519 public key in hex format
- `docId`: Document ID to open

### Welcome

**Direction**: Server → Client

Acknowledges connection and provides initial state.

**Fields**:
- `type`: Always `"welcome"`
- `siteId`: Assigned site identifier for this client
- `snapshot`: Current document snapshot
  - `docId`: Document ID
  - `content`: Materialized document content
  - `operations`: Array of all operations
  - `version`: Document version number

### Op

**Direction**: Client ↔ Server

Represents a signed CRDT operation.

**Fields**:
- `type`: Always `"op"`
- `op`: Signed operation object
  - `docId`: Document ID
  - `opId`: Position identifier
    - `siteId`: Site identifier
    - `counter`: Operation counter
  - `parent`: Parent position (or `null` for root)
  - `payload`: Operation payload
    - `type`: `"insert"` or `"delete"`
    - `char`: Character (for insert)
    - `blockType`: Markdown block type (for insert)
  - `signature`: Ed25519 signature (hex)
  - `publicKey`: Ed25519 public key (hex)

### Presence

**Direction**: Client ↔ Server

Shares cursor position and typing state.

**Fields**:
- `type`: Always `"presence"`
- `presence`: Presence information
  - `siteId`: Site identifier
  - `publicKey`: Public key
  - `caret`: Cursor position (optional)
    - `line`: Line number
    - `column`: Column number
  - `selection`: Selected range (optional)
    - `start`: Start position
    - `end`: End position
  - `ghostText`: Uncommitted typing (optional)
    - Array of text segments with positions

### Snapshot

**Direction**: Server → Client

Provides a full document snapshot (used for sync/recovery).

**Fields**:
- `type`: Always `"snapshot"`
- `snapshot`: Document snapshot (same format as in welcome)

## Operation Signing

### Canonical Form

Operations are signed in canonical JSON form with sorted keys:

```typescript
const canonical = {
  docId: op.docId,
  opId: op.opId,
  parent: op.parent,
  payload: op.payload
};

// Sort keys alphabetically
const message = JSON.stringify(canonical, Object.keys(canonical).sort());
```

Example canonical form:

```json
{"docId":"welcome","opId":{"counter":5,"siteId":"site-0"},"parent":{"counter":4,"siteId":"site-0"},"payload":{"blockType":"paragraph","char":"a","type":"insert"}}
```

### Signing Process

1. Create canonical JSON string
2. Convert to bytes (UTF-8 encoding)
3. Sign with Ed25519 private key
4. Encode signature as hex string

### Verification Process

1. Extract operation fields (excluding signature and publicKey)
2. Create canonical JSON string
3. Convert to bytes (UTF-8 encoding)
4. Verify signature using provided public key

## Error Handling

### Invalid Signature

If signature verification fails:
- Server closes connection with code `1008` (Policy Violation)
- Message: `"Invalid signature"`

### Invalid Message

If message cannot be parsed:
- Server closes connection with code `1008`
- Message: `"Invalid message"`

### Document Not Found

Server creates new empty document if it doesn't exist.

## Ordering Guarantees

### Operation Ordering

- Operations are applied in causal order within each site
- Cross-site operations use CRDT merge semantics
- No global ordering guarantee

### Presence Ordering

- Presence updates may arrive out of order
- Last-write-wins for each client's presence
- No guaranteed delivery (best-effort)

## Rate Limiting

Future implementation may include:
- Max operations per second per client
- Max presence updates per second
- Max concurrent connections per document

## Security

### Authentication

Currently uses public key as identity. Future:
- User authentication required
- Session tokens
- Document-level permissions

### Authorization

Currently allows all operations. Future:
- Read/write permissions
- Admin operations
- Rate limiting per user

### Validation

Server validates:
- Message format (JSON schema)
- Operation signatures (Ed25519)
- Document access (future)

## Extensions

The protocol is designed to be extensible:

### Version Negotiation

Clients specify protocol version in hello:
```json
{
  "version": 1  // Future version
}
```

Server may reject unsupported versions.

### Custom Message Types

Reserved message type prefixes:
- `x-*`: Experimental extensions
- `plugin-*`: Plugin-specific messages

Example:
```json
{
  "type": "x-cursor-annotation",
  "annotation": { /* custom data */ }
}
```

### Metadata

Operations and presence may include metadata:
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

## Implementation Notes

### Client Implementation

- Use WebSocket with automatic reconnection
- Buffer operations during disconnection
- Replay buffered operations on reconnect
- Merge remote operations into local CRDT

### Server Implementation

- Use efficient JSON parsing
- Verify signatures asynchronously
- Broadcast to same-document clients only
- Persist operations to storage

### Testing

- Unit tests for message encoding/decoding
- Integration tests for full flow
- Fuzz testing for malformed messages
- Load testing for concurrent clients
