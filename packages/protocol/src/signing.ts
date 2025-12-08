/**
 * Signing utilities for protocol v0
 */

import type { Operation, SignedOperation } from './types.js';

/**
 * Canonicalize an operation for signing
 * Returns a canonical JSON string representation
 */
export function canonicalizeOperation(op: Operation): string {
  // Create canonical representation with sorted keys
  const canonical = {
    docId: op.docId,
    opId: op.opId,
    parent: op.parent,
    payload: op.payload,
  };
  
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

/**
 * Get the message to sign for an operation
 */
export function getSigningMessage(op: Operation): Uint8Array {
  const canonical = canonicalizeOperation(op);
  return new TextEncoder().encode(canonical);
}

/**
 * Verify a signed operation
 * Returns true if signature is valid
 * 
 * Note: This is a placeholder. Actual Ed25519 verification
 * should be implemented using a crypto library like tweetnacl
 * or the Web Crypto API / Node crypto module
 */
export async function verifySignature(
  signedOp: SignedOperation
): Promise<boolean> {
  // TODO: Implement actual Ed25519 signature verification
  // For now, return true as a placeholder
  console.warn('Signature verification not yet implemented');
  return true;
}

/**
 * Sign an operation
 * 
 * Note: This is a placeholder. Actual Ed25519 signing
 * should be implemented using a crypto library
 */
export async function signOperation(
  op: Operation,
  privateKey: string
): Promise<SignedOperation> {
  // TODO: Implement actual Ed25519 signing
  console.warn('Operation signing not yet implemented');
  
  // Placeholder signature
  const signature = '0'.repeat(128); // 64 bytes in hex
  const publicKey = '0'.repeat(64); // 32 bytes in hex
  
  return {
    ...op,
    signature,
    publicKey,
  };
}
