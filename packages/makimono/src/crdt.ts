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
  blockType?: string; // Markdown block type (heading, list, code, etc.)
}

// ===== CRDT Operation Record =====
// Stores applied operations in their original form for replay/sync

interface OpRecord {
  opId: PositionId;
  parent: PositionId | null;
  payload: OperationPayload;
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
  private operations: Map<string, OpRecord>;  // All operations for replay
  private ordering: IdOrderingStrategy;

  constructor(config: CRDTConfig) {
    this.siteId = config.siteId;
    this.counter = 0;
    this.nodes = new Map();
    this.operations = new Map();
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
   * 
   * All operations are stored in their original form and can be replayed.
   * This ensures deterministic behavior regardless of operation order.
   */
  apply(op: Operation | SignedOperation): void {
    const key = this.idToString(op.opId);
    
    // Store operation for replay
    this.operations.set(key, {
      opId: op.opId,
      parent: op.parent,
      payload: op.payload,
    });
    
    // Apply operation-specific effects
    if (op.payload.type === 'insert') {
      this.nodes.set(key, {
        id: op.opId,
        parent: op.parent,
        char: op.payload.char,
        blockType: op.payload.blockType,
      });
    } else if (op.payload.type === 'delete') {
      // Delete operations reference their target via parent field
      // The node itself is not removed, just marked as deleted
      const targetKey = this.idToString(op.parent);
      const targetNode = this.nodes.get(targetKey);
      if (targetNode) {
        // Remove from nodes map (tombstone pattern)
        this.nodes.delete(targetKey);
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
   * 
   * Uses the same structure as insert:
   * - opId: unique identifier for this delete operation
   * - parent: the node to delete (parallel to insert's parent semantics)
   * - payload: specifies this is a delete operation
   */
  generateDelete(targetId: PositionId, docId: string): Operation {
    const opId = this.generateId();
    return {
      docId,
      opId,
      parent: targetId,  // Target to delete (consistent with insert's use of parent)
      payload: { type: 'delete' },
    };
  }

  /**
   * Build a sorted list of visible characters
   * 
   * Only nodes that exist in the nodes map are visible.
   * Delete operations remove nodes from the map, so this naturally handles deletions.
   */
  private buildSequence(): CharNode[] {
    // Build tree structure
    const children = new Map<string, CharNode[]>();
    const nodes = Array.from(this.nodes.values());

    for (const node of nodes) {
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
   * 
   * Returns operations in their original form, allowing for deterministic replay.
   */
  getOperations(): Array<Operation> {
    const ops: Operation[] = [];
    
    for (const opRecord of this.operations.values()) {
      ops.push({
        docId: 'unknown', // docId not stored in operation records
        opId: opRecord.opId,
        parent: opRecord.parent,
        payload: opRecord.payload,
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
