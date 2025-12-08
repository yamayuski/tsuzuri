/**
 * Snapshot storage abstraction and file system implementation
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { DocumentSnapshot, Tree } from '@tsuzuri/protocol';

/**
 * Abstract snapshot store interface
 */
export interface SnapshotStore {
  /**
   * Load a document snapshot by ID
   */
  load(docId: string): Promise<DocumentSnapshot | null>;

  /**
   * Save a document snapshot
   */
  save(docId: string, snapshot: DocumentSnapshot): Promise<void>;

  /**
   * Delete a document snapshot
   */
  delete(docId: string): Promise<void>;

  /**
   * List all document IDs
   */
  list(): Promise<string[]>;

  /**
   * Load the tree structure
   */
  loadTree(treeId: string): Promise<Tree | null>;

  /**
   * Save the tree structure
   */
  saveTree(treeId: string, tree: Tree): Promise<void>;
}

/**
 * File system based snapshot store
 */
export class FileSnapshotStore implements SnapshotStore {
  private baseDir: string;
  private docsDir: string;
  private treesDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.docsDir = join(baseDir, 'docs');
    this.treesDir = join(baseDir, 'trees');
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if already exists
    }
  }

  private getDocPath(docId: string): string {
    // TODO: Use more robust path sanitization (e.g., whitelist pattern or crypto hash)
    // Current implementation prevents basic path traversal but may not handle all edge cases
    const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.docsDir, `${safeId}.json`);
  }

  private getTreePath(treeId: string): string {
    const safeId = treeId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.treesDir, `${safeId}.json`);
  }

  async load(docId: string): Promise<DocumentSnapshot | null> {
    await this.ensureDir(this.docsDir);
    const path = this.getDocPath(docId);

    try {
      const data = await fs.readFile(path, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async save(docId: string, snapshot: DocumentSnapshot): Promise<void> {
    await this.ensureDir(this.docsDir);
    const path = this.getDocPath(docId);
    const dir = dirname(path);

    await this.ensureDir(dir);
    await fs.writeFile(path, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  async delete(docId: string): Promise<void> {
    const path = this.getDocPath(docId);
    try {
      await fs.unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async list(): Promise<string[]> {
    await this.ensureDir(this.docsDir);

    try {
      const files = await fs.readdir(this.docsDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
    } catch (error) {
      return [];
    }
  }

  async loadTree(treeId: string): Promise<Tree | null> {
    await this.ensureDir(this.treesDir);
    const path = this.getTreePath(treeId);

    try {
      const data = await fs.readFile(path, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async saveTree(treeId: string, tree: Tree): Promise<void> {
    await this.ensureDir(this.treesDir);
    const path = this.getTreePath(treeId);

    await fs.writeFile(path, JSON.stringify(tree, null, 2), 'utf-8');
  }
}
