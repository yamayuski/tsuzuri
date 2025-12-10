/**
 * WebSocket client for Tsuzuri wiki
 */

import * as monaco from 'monaco-editor';
import { CRDTDocument } from '@tsuzuri/makimono';
import type {
  Message,
  HelloMessage,
  WelcomeMessage,
  OpMessage,
  PresenceMessage,
  PresenceInfo,
  Operation,
} from '@tsuzuri/protocol';

type EventHandler = (...args: any[]) => void;

export class WikiClient {
  private ws: WebSocket | null = null;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private crdt: CRDTDocument | null = null;
  private siteId: string | null = null;
  private docId: string | null = null;
  private publicKey: string;
  private wsUrl: string;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private suppressNextChange = false;

  constructor(wsUrl: string, editor: monaco.editor.IStandaloneCodeEditor) {
    this.wsUrl = wsUrl;
    this.editor = editor;
    
    // Generate a temporary public key (in real implementation, use Ed25519)
    this.publicKey = this.generatePublicKey();

    // Listen to editor changes
    this.editor.onDidChangeModelContent(() => {
      if (!this.suppressNextChange) {
        this.handleLocalEdit();
      }
      this.suppressNextChange = false;
    });

    // Listen to cursor/selection changes for presence
    this.editor.onDidChangeCursorPosition(() => {
      this.sendPresence();
    });

    this.editor.onDidChangeCursorSelection(() => {
      this.sendPresence();
    });
  }

  private generatePublicKey(): string {
    // Placeholder: generate a random hex string
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  connect(docId: string): void {
    this.docId = docId;
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.emit('connected');
      this.sendHello();
    };

    this.ws.onmessage = (event) => {
      const message: Message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private sendHello(): void {
    if (!this.ws || !this.docId) return;

    const hello: HelloMessage = {
      type: 'hello',
      version: 0,
      publicKey: this.publicKey,
      docId: this.docId,
    };

    this.ws.send(JSON.stringify(hello));
  }

  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'welcome':
        this.handleWelcome(message);
        break;
      case 'op':
        this.handleOp(message);
        break;
      case 'presence':
        this.handlePresence(message);
        break;
      case 'snapshot':
        this.handleSnapshot(message);
        break;
    }
  }

  private handleWelcome(message: WelcomeMessage): void {
    this.siteId = message.siteId;
    this.crdt = new CRDTDocument({ siteId: message.siteId });

    // Apply snapshot operations
    for (const op of message.snapshot.operations) {
      this.crdt.apply(op);
    }

    // Update editor with initial content
    this.suppressNextChange = true;
    this.editor.setValue(message.snapshot.content);
    
    this.emit('documentChanged', this.docId);
  }

  private handleOp(message: OpMessage): void {
    if (!this.crdt) return;

    // Apply the operation
    this.crdt.apply(message.op);

    // Update editor
    this.suppressNextChange = true;
    const newContent = this.crdt.materialize();
    this.editor.setValue(newContent);
  }

  private handleSnapshot(message: { type: 'snapshot'; snapshot: any }): void {
    console.log('Received snapshot:', message);
    // Handle snapshot updates if needed
  }

  private handlePresence(message: PresenceMessage): void {
    this.emit('presence', message.presence);
  }

  private handleLocalEdit(): void {
    if (!this.crdt || !this.docId) return;

    // TODO: Implement operation generation from text diffs
    // Required steps:
    // 1. Calculate diff between old and new editor content
    // 2. Convert text positions to CRDT position IDs
    // 3. Generate insert/delete operations for each change
    // 4. Sign operations with Ed25519 private key
    // 5. Send operations to server via WebSocket
    // Without this, collaborative editing is one-way (server → client only)

    console.log('Local edit detected (operation generation not yet implemented)');
  }

  private sendPresence(): void {
    if (!this.ws || !this.siteId) return;

    const position = this.editor.getPosition();
    const selection = this.editor.getSelection();

    const presence: PresenceInfo = {
      siteId: this.siteId,
      publicKey: this.publicKey,
    };

    if (position) {
      presence.caret = {
        line: position.lineNumber,
        column: position.column,
      };
    }

    if (selection && !selection.isEmpty()) {
      presence.selection = {
        start: {
          line: selection.startLineNumber,
          column: selection.startColumn,
        },
        end: {
          line: selection.endLineNumber,
          column: selection.endColumn,
        },
      };
    }

    const message: PresenceMessage = {
      type: 'presence',
      presence,
    };

    this.ws.send(JSON.stringify(message));
  }

  // Event emitter pattern
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  getSiteId(): string | null {
    return this.siteId;
  }

  getDocId(): string | null {
    return this.docId;
  }
}
