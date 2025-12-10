/**
 * Ghost text overlay for showing other users' typing in real-time
 */

import * as monaco from 'monaco-editor';
import type { PresenceInfo } from '@tsuzuri/protocol';

interface GhostText {
  siteId: string;
  position: { line: number; column: number };
  text: string;
  element: HTMLElement;
}

export class GhostTextOverlay {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private overlay: HTMLElement;
  private ghostTexts: Map<string, GhostText[]> = new Map();

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;

    const overlay = document.getElementById('ghost-text-overlay');
    if (!overlay) {
      throw new Error('Ghost text overlay element not found');
    }
    this.overlay = overlay;

    // Update positions on scroll/resize
    this.editor.onDidScrollChange(() => this.updatePositions());
    this.editor.onDidLayoutChange(() => this.updatePositions());
  }

  updateGhostText(presence: PresenceInfo): void {
    // Clear existing ghost text for this user
    this.clearGhostText(presence.siteId);

    if (!presence.ghostText || presence.ghostText.length === 0) {
      return;
    }

    const ghostTexts: GhostText[] = [];

    for (const ghost of presence.ghostText) {
      const element = this.createGhostTextElement(ghost.text);
      this.overlay.appendChild(element);

      ghostTexts.push({
        siteId: presence.siteId,
        position: ghost.position,
        text: ghost.text,
        element,
      });
    }

    this.ghostTexts.set(presence.siteId, ghostTexts);
    this.updatePositions();
  }

  private createGhostTextElement(text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'ghost-text';
    el.textContent = text;
    return el;
  }

  private clearGhostText(siteId: string): void {
    const existing = this.ghostTexts.get(siteId);
    if (existing) {
      for (const ghost of existing) {
        ghost.element.remove();
      }
      this.ghostTexts.delete(siteId);
    }
  }

  private updatePositions(): void {
    for (const [, ghostTexts] of this.ghostTexts) {
      for (const ghost of ghostTexts) {
        const pos = this.editor.getScrolledVisiblePosition({
          lineNumber: ghost.position.line,
          column: ghost.position.column,
        });

        if (pos) {
          ghost.element.style.top = `${pos.top}px`;
          ghost.element.style.left = `${pos.left}px`;
          ghost.element.style.display = 'block';
        } else {
          ghost.element.style.display = 'none';
        }
      }
    }
  }
}
