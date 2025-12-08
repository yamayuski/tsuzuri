/**
 * Presence management for showing other users' cursors and selections
 */

import * as monaco from 'monaco-editor';
import type { PresenceInfo } from '@tsuzuri/protocol';
import type { WikiClient } from './client.js';

interface PresenceState {
  info: PresenceInfo;
  decorations: string[];
  color: string;
}

export class PresenceManager {
  private client: WikiClient;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private presences: Map<string, PresenceState> = new Map();
  private colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#6C5CE7',
    '#A8E6CF',
    '#FFD93D',
  ];
  private colorIndex = 0;

  constructor(client: WikiClient, editor: monaco.editor.IStandaloneCodeEditor) {
    this.client = client;
    this.editor = editor;
  }

  updatePresence(presence: PresenceInfo): void {
    // Don't show our own presence
    if (presence.siteId === this.client.getSiteId()) {
      return;
    }

    let state = this.presences.get(presence.siteId);
    if (!state) {
      state = {
        info: presence,
        decorations: [],
        color: this.colors[this.colorIndex % this.colors.length],
      };
      this.colorIndex++;
      this.presences.set(presence.siteId, state);
    } else {
      state.info = presence;
    }

    this.renderPresence(state);
    this.updatePresenceIndicators();
  }

  private renderPresence(state: PresenceState): void {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    // Render selection if present
    if (state.info.selection) {
      decorations.push({
        range: new monaco.Range(
          state.info.selection.start.line,
          state.info.selection.start.column,
          state.info.selection.end.line,
          state.info.selection.end.column
        ),
        options: {
          className: 'remote-selection',
          inlineClassName: 'remote-selection-inline',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Render caret if present
    if (state.info.caret) {
      decorations.push({
        range: new monaco.Range(
          state.info.caret.line,
          state.info.caret.column,
          state.info.caret.line,
          state.info.caret.column
        ),
        options: {
          className: 'remote-caret',
          beforeContentClassName: 'remote-caret-marker',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Apply decorations
    state.decorations = this.editor.deltaDecorations(state.decorations, decorations);

    // Inject CSS for this user's color (if not already done)
    this.injectPresenceStyles(state.color);
  }

  private injectPresenceStyles(color: string): void {
    // Check if styles already exist
    const styleId = `presence-style-${color.replace('#', '')}`;
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .remote-selection {
        background-color: ${color}33 !important;
      }
      .remote-caret-marker::before {
        content: '';
        position: absolute;
        width: 2px;
        height: 1.2em;
        background-color: ${color};
        z-index: 100;
      }
    `;
    document.head.appendChild(style);
  }

  private updatePresenceIndicators(): void {
    const container = document.getElementById('presence-indicators');
    if (!container) return;

    container.innerHTML = '';

    for (const [siteId, state] of this.presences) {
      const indicator = document.createElement('div');
      indicator.className = 'presence-indicator';
      indicator.style.backgroundColor = state.color;
      indicator.textContent = siteId.substring(0, 2).toUpperCase();
      indicator.title = `User ${siteId}`;
      container.appendChild(indicator);
    }
  }
}
