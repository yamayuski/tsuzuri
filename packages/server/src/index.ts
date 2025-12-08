/**
 * Tsuzuri Server - WebSocket relay and storage
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WikiServer } from './server.js';
import { FileSnapshotStore } from './storage.js';
import { ImageUploadHandler } from './upload.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const STORAGE_DIR = process.env.STORAGE_DIR || './data';

// Create HTTP server for both WebSocket and image uploads
const httpServer = createServer();

// Create storage
const storage = new FileSnapshotStore(STORAGE_DIR);

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const wikiServer = new WikiServer(wss, storage);

// Create image upload handler
const uploadHandler = new ImageUploadHandler(STORAGE_DIR);

// Handle HTTP requests for image uploads
httpServer.on('request', async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/upload' && req.method === 'POST') {
    try {
      const result = await uploadHandler.handleUpload(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Upload error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload failed' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Tsuzuri server listening on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`Image upload: http://localhost:${PORT}/upload`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  wss.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});
