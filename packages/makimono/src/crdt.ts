/**
 * CRDT implementation - Simple RGA/Logoot variant with block awareness
 */

import type {
  Operation,
  OperationPayload,
  PositionId,
  SignedOperation,
} from '@tsuzuri/protocol';

// ===== CRDT Character Node =====

interface CharNode {
  id: PositionId;
  parent: PositionId | null;
  char: string;
  deleted: boolean;
  blockType?: string; // Markdown block type (heading, list, code, etc.)
}

// ===== ID Ordering Strategy =====

export type IdOrderingStrategy = (a: PositionId, b: PositionId) => number;

/**
 * Default ordering: compare siteId lexicographically, then counter numerically
 */
export function defaultOrdering(a: PositionId, b: PositionId): number {
  const siteComp = a.siteId.localeCompare(b.siteId);
  if (siteComp !== 0) return siteComp;
  return a.counter - b.counter;
}

// ===== CRDT Document =====

export interface CRDTConfig {
  siteId: string;
  orderingStrategy?: IdOrderingStrategy;
}

export class CRDTDocument {
  private siteId: string;
  private counter: number;
  private nodes: Map<string, CharNode>;
  private ordering: IdOrderingStrategy;

  constructor(config: CRDTConfig) {
    this.siteId = config.siteId;
    this.counter = 0;
    this.nodes = new Map();
    this.ordering = config.orderingStrategy || defaultOrdering;
  }

  /**
   * Generate a new unique position ID
   */
  private generateId(): PositionId {
    return {
      siteId: this.siteId,
      counter: this.counter++,
    };
  }

  /**
   * Serialize a position ID to string for use as Map key
   */
  private idToString(id: PositionId | null): string {
    if (id === null) return 'ROOT';
    return `${id.siteId}:${id.counter}`;
  }

  /**
   * Apply an operation to the CRDT
   */
  apply(op: Operation | SignedOperation): void {
    const key = this.idToString(op.opId);

    if (op.payload.type === 'insert') {
      this.nodes.set(key, {
        id: op.opId,
        parent: op.parent,
        char: op.payload.char,
        deleted: false,
        blockType: op.payload.blockType,
      });
    } else if (op.payload.type === 'delete') {
      const node = this.nodes.get(key);
      if (node) {
        node.deleted = true;
      }
    }
  }

  /**
   * Generate an insert operation
   */
  generateInsert(
    parent: PositionId | null,
    char: string,
    docId: string,
    blockType?: string
  ): Operation {
    const opId = this.generateId();
    const payload: OperationPayload = {
      type: 'insert',
      char,
      blockType,
    };

    return {
      docId,
      opId,
      parent,
      payload,
    };
  }

  /**
   * Generate a delete operation
   */
  generateDelete(targetId: PositionId, docId: string): Operation {
    return {
      docId,
      opId: targetId,
      parent: null,
      payload: { type: 'delete' },
    };
  }

  /**
   * Build a sorted list of visible characters
   */
  private buildSequence(): CharNode[] {
    // Build tree structure
    const children = new Map<string, CharNode[]>();
    const nodes = Array.from(this.nodes.values());

    for (const node of nodes) {
      if (node.deleted) continue;

      const parentKey = this.idToString(node.parent);
      if (!children.has(parentKey)) {
        children.set(parentKey, []);
      }
      children.get(parentKey)!.push(node);
    }

    // Sort children by ID ordering
    for (const [, childList] of children) {
      childList.sort((a, b) => this.ordering(a.id, b.id));
    }

    // Traverse tree in order
    const result: CharNode[] = [];
    const traverse = (parentKey: string) => {
      const childList = children.get(parentKey) || [];
      for (const child of childList) {
        result.push(child);
        traverse(this.idToString(child.id));
      }
    };

    traverse('ROOT');
    return result;
  }

  /**
   * Materialize the current document state as a string
   */
  materialize(): string {
    const sequence = this.buildSequence();
    return sequence.map((node) => node.char).join('');
  }

  /**
   * Get all operations (for debugging/sync)
   */
  getOperations(): Array<Operation> {
    const ops: Operation[] = [];
    for (const node of this.nodes.values()) {
      const payload: OperationPayload = node.deleted
        ? { type: 'delete' }
        : { type: 'insert', char: node.char, blockType: node.blockType };

      ops.push({
        docId: 'unknown', // docId not stored in nodes
        opId: node.id,
        parent: node.parent,
        payload,
      });
    }
    return ops;
  }

  /**
   * Get the position ID at a specific offset in the materialized text
   */
  getPositionAtOffset(offset: number): PositionId | null {
    const sequence = this.buildSequence();
    if (offset < 0 || offset >= sequence.length) {
      return null;
    }
    return sequence[offset].id;
  }

  /**
   * Get the parent for inserting at a specific offset
   */
  getParentForInsert(offset: number): PositionId | null {
    const sequence = this.buildSequence();
    if (offset === 0) {
      return null; // Insert at root
    }
    if (offset > sequence.length) {
      return sequence[sequence.length - 1]?.id || null;
    }
    return sequence[offset - 1]?.id || null;
  }
}
