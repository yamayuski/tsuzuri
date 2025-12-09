/**
 * Protocol v0 types for Tsuzuri wiki collaboration
 */

// ===== Position and CRDT Types =====

/**
 * CRDT position identifier using siteId + counter
 */
export interface PositionId {
  siteId: string;
  counter: number;
}

/**
 * Position in the document for CRDT operations
 */
export interface Position {
  id: PositionId;
  parent: PositionId | null; // null for root
}

// ===== Operation Types =====

/**
 * CRDT operation payload
 * All operation types follow the same structure for consistency and extensibility
 */
export type OperationPayload =
  | { 
      type: 'insert'; 
      char: string; 
      blockType?: string;
    }
  | { 
      type: 'delete';
    };

/**
 * CRDT operation (before signing)
 * 
 * Uniform structure for all operation types:
 * - opId: unique identifier for this operation
 * - parent: position in the document tree (insert: where to insert after, delete: what to delete)
 * - payload: operation-specific data
 * 
 * This design ensures:
 * - All operations have the same structure
 * - Sequential application always produces the same result
 * - Easy to extend with new operation types (e.g., 'modify', 'format')
 */
export interface Operation {
  docId: string;
  opId: PositionId;
  parent: PositionId | null;  // For insert: parent node, for delete: target node to delete
  payload: OperationPayload;
}

/**
 * Signed CRDT operation
 */
export interface SignedOperation extends Operation {
  signature: string; // Ed25519 signature (hex encoded)
  publicKey: string; // Ed25519 public key (hex encoded)
}

// ===== Message Types =====

/**
 * Client hello message
 */
export interface HelloMessage {
  type: 'hello';
  version: 0;
  publicKey: string; // Ed25519 public key (hex)
  docId: string;
}

/**
 * Server welcome message
 */
export interface WelcomeMessage {
  type: 'welcome';
  siteId: string; // Assigned site ID for this client
  snapshot: DocumentSnapshot;
}

/**
 * Operation message
 */
export interface OpMessage {
  type: 'op';
  op: SignedOperation;
}

/**
 * Presence information
 */
export interface PresenceInfo {
  siteId: string;
  publicKey: string;
  caret?: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  ghostText?: {
    position: { line: number; column: number };
    text: string;
  }[];
}

/**
 * Presence message
 */
export interface PresenceMessage {
  type: 'presence';
  presence: PresenceInfo;
}

/**
 * Snapshot message
 */
export interface SnapshotMessage {
  type: 'snapshot';
  snapshot: DocumentSnapshot;
}

/**
 * All message types
 */
export type Message =
  | HelloMessage
  | WelcomeMessage
  | OpMessage
  | PresenceMessage
  | SnapshotMessage;

// ===== Document Types =====

/**
 * Document snapshot
 */
export interface DocumentSnapshot {
  docId: string;
  content: string;
  operations: SignedOperation[];
  version: number;
}

/**
 * Tree node in wiki structure
 */
export interface TreeNode {
  id: string;
  title: string;
  parentId: string | null;
  children: string[]; // IDs of child nodes
  docId: string; // Document ID for content
  createdAt: number;
  updatedAt: number;
}

/**
 * Tree structure
 */
export interface Tree {
  id: string; // Tree ID (currently single tree)
  rootId: string; // Root node ID
  nodes: Record<string, TreeNode>;
}
