/**
 * Tree view component for wiki navigation
 */

import type { WikiClient } from './client.js';

export class TreeView {
  private client: WikiClient;
  private container: HTMLElement;

  constructor(client: WikiClient) {
    this.client = client;
    
    const container = document.getElementById('tree-container');
    if (!container) {
      throw new Error('Tree container element not found');
    }
    this.container = container;

    this.render();
  }

  private render(): void {
    // Create a simple tree with placeholder nodes
    const nodes = [
      { id: 'welcome', title: 'Welcome', level: 0 },
      { id: 'getting-started', title: 'Getting Started', level: 0 },
      { id: 'features', title: 'Features', level: 1 },
      { id: 'crdt', title: 'CRDT Implementation', level: 1 },
      { id: 'documentation', title: 'Documentation', level: 0 },
    ];

    this.container.innerHTML = '';

    for (const node of nodes) {
      const el = document.createElement('div');
      el.className = 'tree-node';
      el.style.paddingLeft = `${node.level * 16 + 12}px`;
      el.textContent = node.title;
      el.dataset.nodeId = node.id;

      el.addEventListener('click', () => {
        this.selectNode(node.id);
      });

      this.container.appendChild(el);
    }
  }

  private selectNode(nodeId: string): void {
    // Remove active class from all nodes
    const nodes = this.container.querySelectorAll('.tree-node');
    for (const node of nodes) {
      node.classList.remove('active');
    }

    // Add active class to selected node
    const selectedNode = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (selectedNode) {
      selectedNode.classList.add('active');
    }

    // TODO: Load the document for this node
    console.log('Selected node:', nodeId);
  }
}
