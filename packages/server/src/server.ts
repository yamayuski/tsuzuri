/**
 * Wiki WebSocket server implementation
 */

import { WebSocketServer, WebSocket } from 'ws';
import type {
  Message,
  HelloMessage,
  WelcomeMessage,
  OpMessage,
  PresenceMessage,
  SignedOperation,
} from '@tsuzuri/protocol';
import { verifySignature } from '@tsuzuri/protocol';
import type { SnapshotStore } from './storage.js';

interface ClientState {
  ws: WebSocket;
  siteId: string;
  publicKey: string;
  docId: string;
}

export class WikiServer {
  private wss: WebSocketServer;
  private storage: SnapshotStore;
  private clients: Map<WebSocket, ClientState> = new Map();
  private siteIdCounter = 0;

  constructor(wss: WebSocketServer, storage: SnapshotStore) {
    this.wss = wss;
    this.storage = storage;

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected');

      ws.on('message', async (data: Buffer) => {
        try {
          const message: Message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
          ws.close(1008, 'Invalid message');
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: Message): Promise<void> {
    switch (message.type) {
      case 'hello':
        await this.handleHello(ws, message);
        break;
      case 'op':
        await this.handleOp(ws, message);
        break;
      case 'presence':
        await this.handlePresence(ws, message);
        break;
    }
  }

  private async handleHello(ws: WebSocket, message: HelloMessage): Promise<void> {
    // Generate site ID
    const siteId = this.generateSiteId();

    // Store client state
    const client: ClientState = {
      ws,
      siteId,
      publicKey: message.publicKey,
      docId: message.docId,
    };
    this.clients.set(ws, client);

    // Load or create snapshot
    let snapshot = await this.storage.load(message.docId);
    if (!snapshot) {
      snapshot = {
        docId: message.docId,
        content: '',
        operations: [],
        version: 0,
      };
      await this.storage.save(message.docId, snapshot);
    }

    // Send welcome message
    const welcome: WelcomeMessage = {
      type: 'welcome',
      siteId,
      snapshot,
    };

    ws.send(JSON.stringify(welcome));
    console.log(`Client ${siteId} joined document ${message.docId}`);
  }

  private async handleOp(ws: WebSocket, message: OpMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.warn('Received op from unknown client');
      return;
    }

    // Verify signature
    // TODO: Implement actual Ed25519 verification (currently placeholder always returns true)
    const isValid = await verifySignature(message.op);
    if (!isValid) {
      console.warn('Invalid signature on operation');
      ws.close(1008, 'Invalid signature');
      return;
    }

    // Save operation
    const snapshot = await this.storage.load(client.docId);
    if (snapshot) {
      snapshot.operations.push(message.op);
      snapshot.version++;
      
      // TODO: Recompute content from operations using CRDT materialize()
      // This requires applying all operations to a CRDTDocument instance
      // For now, content remains static from initial snapshot
      
      await this.storage.save(client.docId, snapshot);
    }

    // Broadcast to other clients in the same document
    this.broadcast(client.docId, message, ws);
  }

  private async handlePresence(
    ws: WebSocket,
    message: PresenceMessage
  ): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    // Broadcast presence to other clients in the same document
    this.broadcast(client.docId, message, ws);
  }

  private broadcast(docId: string, message: Message, exclude?: WebSocket): void {
    const messageStr = JSON.stringify(message);

    for (const [ws, client] of this.clients) {
      if (client.docId === docId && ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  private generateSiteId(): string {
    return `site-${this.siteIdCounter++}`;
  }
}
