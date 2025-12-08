# Implementation Notes - Wiki PoC Skeleton

## Overview

This document describes the current implementation status, known limitations, and roadmap for completing the wiki PoC.

## Current Status

### ✅ Completed Features

#### Infrastructure
- [x] pnpm monorepo with workspaces
- [x] TypeScript build configuration for all packages
- [x] Development scripts (dev, build)
- [x] .gitignore for build artifacts

#### Protocol Package (@tsuzuri/protocol)
- [x] Message type definitions (hello, welcome, op, presence, snapshot)
- [x] Operation types (insert, delete)
- [x] Position ID structure (siteId + counter)
- [x] Signing canonicalization function
- [x] Placeholder signing/verification functions

#### CRDT Package (@tsuzuri/makimono)
- [x] CRDTDocument class with core operations
- [x] Position ID generation and ordering
- [x] Tree structure for character storage
- [x] Insert/delete operation application
- [x] Text materialization (traverse tree to string)
- [x] Block-aware markdown detection
- [x] Pluggable ordering strategy

#### Client Package (@tsuzuri/client)
- [x] Vite + TypeScript build setup
- [x] Monaco editor integration
- [x] WebSocket client connection
- [x] Protocol message handling (hello, welcome, op, presence)
- [x] UI layout (sidebar tree + editor + status bar)
- [x] Connection status display
- [x] Presence manager structure
- [x] Ghost text overlay structure
- [x] Tree view with placeholder nodes

#### Server Package (@tsuzuri/server)
- [x] Node.js + TypeScript setup
- [x] WebSocket server with ws library
- [x] Connection handling and site ID assignment
- [x] Message routing (hello → welcome, op broadcast, presence relay)
- [x] File system snapshot store
- [x] Abstract storage interface
- [x] Image upload endpoint with sharp → WebP
- [x] CORS headers for uploads
- [x] Auth service placeholder

#### Documentation
- [x] Architecture overview (docs/README.md)
- [x] Protocol specification (docs/PROTOCOL.md)
- [x] CRDT explanation (docs/CRDT.md)
- [x] Quick start guide (README-WIKI.md)

### ⚠️ Implemented but Not Production-Ready

#### Signature Verification
**Status**: Placeholder implementation  
**Location**: `packages/protocol/src/signing.ts`

```typescript
// Current: Always returns true
export async function verifySignature(signedOp: SignedOperation): Promise<boolean> {
  console.warn('Signature verification not yet implemented');
  return true;
}
```

**Issue**: Operations are accepted without cryptographic verification, allowing unauthorized modifications.

**Required for Production**:
1. Integrate Ed25519 library (e.g., tweetnacl, libsodium.js, or @noble/ed25519)
2. Implement actual signature verification
3. Generate/store private keys securely
4. Key management system

**Example Implementation**:
```typescript
import { verify } from '@noble/ed25519';

export async function verifySignature(signedOp: SignedOperation): Promise<boolean> {
  const message = getSigningMessage(signedOp);
  const signature = Buffer.from(signedOp.signature, 'hex');
  const publicKey = Buffer.from(signedOp.publicKey, 'hex');
  
  return await verify(signature, message, publicKey);
}
```

#### Path Sanitization
**Status**: Basic implementation  
**Location**: `packages/server/src/storage.ts`

```typescript
// Current: Simple character replacement
const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
```

**Issue**: May not prevent all path traversal attacks or handle Unicode edge cases.

**Required for Production**:
1. Use crypto hash for document IDs (e.g., SHA-256)
2. Or implement whitelist validation
3. Or use proper path sanitization library

**Example Implementation**:
```typescript
import { createHash } from 'crypto';

private getDocPath(docId: string): string {
  // Hash the document ID to ensure safe filesystem path
  const hash = createHash('sha256').update(docId).digest('hex');
  return join(this.docsDir, `${hash}.json`);
}
```

### ❌ Not Yet Implemented

#### Local Edit → Operation Generation
**Status**: Not implemented  
**Location**: `packages/client/src/client.ts:172`

**Issue**: Client detects edits but doesn't generate CRDT operations, breaking collaborative editing.

**What's Needed**:
1. **Diff Calculation**: Compare old vs new editor content
   - Track previous content in component state
   - Use Monaco's onDidChangeModelContent with change events
   - Or use diff algorithm (e.g., diff-match-patch)

2. **Position Mapping**: Convert text offsets to CRDT position IDs
   - Use `crdt.getParentForInsert(offset)` to find parent position
   - Track character → position ID mapping

3. **Operation Generation**: Create insert/delete operations
   - For each insertion: generate insert operation with parent position
   - For each deletion: generate delete operation with target position
   - Include block type for markdown awareness

4. **Signing**: Sign operations with Ed25519 private key

5. **Send**: Transmit to server via WebSocket

**Example Implementation**:
```typescript
private handleLocalEdit(changes: monaco.editor.IModelContentChange[]): void {
  if (!this.crdt || !this.docId) return;

  for (const change of changes) {
    if (change.text) {
      // Handle insertion
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
      // Handle deletion
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

#### Server-Side CRDT Materialization
**Status**: Not implemented  
**Location**: `packages/server/src/server.ts:129-130`

**Issue**: Server doesn't apply operations to update document content, so snapshots don't reflect changes.

**What's Needed**:
1. **CRDT Instance**: Create CRDTDocument instance per document
2. **Apply Operations**: Apply incoming operations to CRDT
3. **Materialize**: Recompute content from CRDT state
4. **Persist**: Save updated content in snapshot

**Example Implementation**:
```typescript
private documentCRDTs: Map<string, CRDTDocument> = new Map();

private async handleOp(ws: WebSocket, message: OpMessage): Promise<void> {
  const client = this.clients.get(ws);
  if (!client) return;

  // Verify signature
  const isValid = await verifySignature(message.op);
  if (!isValid) {
    ws.close(1008, 'Invalid signature');
    return;
  }

  // Get or create CRDT instance
  let crdt = this.documentCRDTs.get(client.docId);
  if (!crdt) {
    crdt = new CRDTDocument({ siteId: 'server' });
    this.documentCRDTs.set(client.docId, crdt);
    
    // Load existing operations
    const snapshot = await this.storage.load(client.docId);
    if (snapshot) {
      for (const op of snapshot.operations) {
        crdt.apply(op);
      }
    }
  }

  // Apply operation
  crdt.apply(message.op);

  // Materialize and save
  const snapshot = await this.storage.load(client.docId);
  if (snapshot) {
    snapshot.operations.push(message.op);
    snapshot.content = crdt.materialize();
    snapshot.version++;
    await this.storage.save(client.docId, snapshot);
  }

  // Broadcast
  this.broadcast(client.docId, message, ws);
}
```

#### Tree CRUD Operations
**Status**: Not implemented

**What's Needed**:
- Create new document in tree
- Rename document
- Move document (change parent)
- Delete document
- Persist tree structure
- Load tree on client startup

#### Presence Ghost Text
**Status**: Structure exists, not functional

**What's Needed**:
- Capture uncommitted text being typed
- Send as part of presence updates
- Display in ghost text overlay at correct positions

#### Authentication & Authorization
**Status**: Placeholder only

**What's Needed**:
- User registration/login
- Session management
- Public key → user mapping
- Document permissions (read/write)
- Access control checks

## Testing Strategy

### Manual Testing (Current)
1. Start server: `pnpm dev:server`
2. Start client: `pnpm dev:client`
3. Open http://localhost:3000
4. Verify connection status shows "Connected"
5. Check server logs show "Client connected"

### Automated Testing (Future)
1. **Unit Tests**: Test CRDT operations, protocol serialization, storage
2. **Integration Tests**: Test WebSocket message flow, multi-client sync
3. **E2E Tests**: Test full user scenarios with Playwright
4. **Load Tests**: Test concurrent clients, large documents

## Performance Considerations

### Current Limitations
- No garbage collection of tombstones
- Full document materialization on every operation
- No incremental rendering
- All operations stored in memory + JSON file

### Future Optimizations
1. **CRDT Optimization**
   - Garbage collect old tombstones
   - Incremental materialization
   - Compressed position IDs
   - Skip list or finger tree for faster traversal

2. **Storage Optimization**
   - Database backend (PostgreSQL, MongoDB)
   - Operation compaction/snapshots
   - Indexing for fast lookups
   - Caching layer

3. **Network Optimization**
   - Operation batching
   - Binary protocol (MessagePack, Protobuf)
   - Compression (gzip, brotli)
   - Delta sync on reconnect

4. **Client Optimization**
   - Virtual scrolling for large documents
   - Web Workers for CRDT computation
   - Debounced operation sending
   - Local operation buffer with optimistic UI

## Security Considerations

### Current Vulnerabilities
1. ⚠️ **No signature verification**: Anyone can forge operations
2. ⚠️ **No authentication**: Anyone can connect
3. ⚠️ **No authorization**: Anyone can access any document
4. ⚠️ **No rate limiting**: Vulnerable to DoS
5. ⚠️ **Path traversal**: Basic sanitization may have edge cases

### Required for Production
1. **Cryptographic signing**: Implement Ed25519 verification
2. **Authentication**: User login with secure sessions
3. **Authorization**: Document-level permissions
4. **Rate limiting**: Per-user operation limits
5. **Input validation**: Strict validation of all inputs
6. **Audit logging**: Log all operations for security review

## Roadmap

### Phase 1: Core Functionality (Next)
- [ ] Implement Ed25519 signing/verification
- [ ] Implement local edit → operation generation
- [ ] Implement server-side CRDT materialization
- [ ] Test multi-client collaboration
- [ ] Add unit tests for CRDT and protocol

### Phase 2: Essential Features
- [ ] Tree CRUD operations
- [ ] Document persistence and loading
- [ ] Presence ghost text
- [ ] Conflict resolution UI
- [ ] Error handling and recovery

### Phase 3: Production Readiness
- [ ] User authentication
- [ ] Document permissions
- [ ] Rate limiting
- [ ] Database backend
- [ ] Performance optimization
- [ ] Security audit

### Phase 4: Advanced Features
- [ ] Comments and annotations
- [ ] Version history
- [ ] Export to PDF/HTML
- [ ] Search functionality
- [ ] Rich text formatting

## Known Issues

1. **Monaco Workers Warning**: Monaco editor complains about missing worker configuration
   - Impact: Editor loads but performance may be degraded
   - Fix: Configure Monaco environment for web workers

2. **Operation Batching**: Each keystroke generates separate operation
   - Impact: Network overhead, operation log bloat
   - Fix: Batch operations within time window

3. **Reconnection Handling**: No automatic reconnection on disconnect
   - Impact: User must refresh page
   - Fix: Implement exponential backoff reconnection

4. **Memory Leaks**: CRDT doesn't clean up tombstones
   - Impact: Memory grows unbounded
   - Fix: Implement garbage collection

## Development Tips

### Running Locally
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode (both client and server)
pnpm dev

# Or run separately
pnpm dev:server  # Terminal 1
pnpm dev:client  # Terminal 2
```

### Debugging
- Client logs: Open browser DevTools console
- Server logs: Check terminal running `pnpm dev:server`
- WebSocket traffic: Use browser DevTools Network tab (WS filter)

### Adding Features
1. Add types to `packages/protocol/src/types.ts`
2. Implement in appropriate package
3. Update documentation
4. Add tests (when test infrastructure exists)
5. Update this document

## References

- [CRDT Overview](https://crdt.tech/)
- [Replicated Growable Array (RGA)](https://pages.lip6.fr/Marc.Shapiro/papers/RGA-TPDS-2011.pdf)
- [Ed25519 Signatures](https://ed25519.cr.yp.to/)
- [Monaco Editor Docs](https://microsoft.github.io/monaco-editor/)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
