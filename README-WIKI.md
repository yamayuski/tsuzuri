# Tsuzuri Wiki PoC

This document provides quick start instructions for the wiki PoC skeleton.

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
```

This builds:
- `@tsuzuri/protocol` - Shared types and protocol definitions
- `@tsuzuri/makimono` - CRDT implementation
- `@tsuzuri/client` - Web client with Monaco editor
- `@tsuzuri/server` - WebSocket server with storage

### Run Development Servers

Run both client and server in development mode:

```bash
# Terminal 1: Start the server
pnpm dev:server

# Terminal 2: Start the client
pnpm dev:client
```

Or run both in parallel:

```bash
pnpm dev
```

- Client: http://localhost:3000
- Server: ws://localhost:3001

## Architecture

See [docs/README.md](docs/README.md) for comprehensive documentation including:

- System architecture
- Protocol specification (v0)
- CRDT implementation details
- API documentation
- Development guide

## Package Structure

```
packages/
├── protocol/     # Shared types, message formats, signing
├── makimono/     # CRDT with block-aware markdown support
├── client/       # Vite + TypeScript + Monaco editor client
└── server/       # Node.js + WebSocket relay server
```

## Features Implemented

### Protocol v0
- ✅ Message types: hello, welcome, op, presence, snapshot
- ✅ Ed25519 signature placeholders (verification TODO)
- ✅ Canonical JSON signing target

### CRDT
- ✅ RGA/Logoot variant with siteId + counter IDs
- ✅ Block-aware operations for Markdown
- ✅ API: apply, generateInsert, generateDelete, materialize
- ✅ Pluggable ID ordering strategy

### Client
- ✅ Monaco editor integration
- ✅ Minimal DOM (no virtual DOM overhead)
- ✅ WebSocket connection
- ✅ Tree view for navigation
- ✅ Presence indicators
- ✅ Ghost text overlay (structure in place)
- ✅ Caret/selection tracking

### Server
- ✅ WebSocket relay (ws library)
- ✅ Signature verification placeholder
- ✅ File system JSON snapshot store
- ✅ Abstract storage interface
- ✅ Image upload endpoint with sharp → WebP
- ✅ Presence relay
- ✅ Auth placeholder

## Next Steps

### High Priority
1. Implement actual Ed25519 signing/verification (using tweetnacl or similar)
2. Implement diff-based operation generation in client
3. Test real-time collaboration with multiple clients
4. Implement CRDT materialization on server side

### Medium Priority
1. Add tree CRUD operations
2. Implement snapshot persistence
3. Add conflict resolution UI
4. Performance optimization for large documents

### Low Priority
1. Database backend for storage
2. Real authentication system
3. Document permissions
4. WebRTC peer-to-peer mode

## Testing

Currently no automated tests. To manually test:

1. Start server: `pnpm dev:server`
2. Open client in browser: http://localhost:3000
3. Check browser console for connection status
4. Try editing in Monaco editor
5. Check server logs for received messages

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clean and rebuild
rm -rf packages/*/dist
pnpm build
```

### Connection Issues

- Ensure server is running on port 3001
- Check firewall settings
- Check browser console for WebSocket errors

### Monaco Editor Not Loading

- Clear browser cache
- Check that dist files were built correctly
- Verify Vite dev server is running

## License

MIT
