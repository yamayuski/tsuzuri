/**
 * Main entry point for Tsuzuri client
 */

import * as monaco from 'monaco-editor';
import { WikiClient } from './client.js';
import { TreeView } from './tree.js';
import { PresenceManager } from './presence.js';
import { GhostTextOverlay } from './ghost-text.js';

// Initialize Monaco editor
const editorElement = document.getElementById('monaco-editor');
if (!editorElement) {
  throw new Error('Monaco editor element not found');
}

const editor = monaco.editor.create(editorElement, {
  value: '',
  language: 'markdown',
  theme: 'vs',
  automaticLayout: true,
  wordWrap: 'on',
  minimap: { enabled: false },
});

// Initialize components
const wsUrl = `ws://${window.location.hostname}:3001`;
const client = new WikiClient(wsUrl, editor);
const treeView = new TreeView(client);
const presenceManager = new PresenceManager(client, editor);
const ghostTextOverlay = new GhostTextOverlay(editor);

// Update UI with connection status
client.on('connected', () => {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.textContent = 'Connected';
    statusEl.style.color = '#90EE90';
  }
});

client.on('disconnected', () => {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.textContent = 'Disconnected';
    statusEl.style.color = '#FF6B6B';
  }
});

client.on('documentChanged', (docId: string) => {
  const docTitle = document.getElementById('doc-title');
  const docInfo = document.getElementById('doc-info');
  if (docTitle) docTitle.textContent = docId;
  if (docInfo) docInfo.textContent = `Document: ${docId}`;
});

// Handle presence updates
client.on('presence', (presenceData) => {
  presenceManager.updatePresence(presenceData);
  ghostTextOverlay.updateGhostText(presenceData);
});

// Connect to server
const defaultDocId = 'welcome';
client.connect(defaultDocId);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  client.disconnect();
  editor.dispose();
});
