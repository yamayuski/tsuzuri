/**
 * Markdown block detection for block-aware CRDT operations
 */

export type BlockType =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'list-item'
  | 'code-block'
  | 'blockquote'
  | 'horizontal-rule'
  | 'unknown';

/**
 * Detect the block type of a line
 */
export function detectBlockType(line: string): BlockType {
  const trimmed = line.trim();

  // Headings
  if (/^#{1,6}\s/.test(trimmed)) {
    const level = trimmed.match(/^(#{1,6})/)?.[1].length || 1;
    return `heading-${level}` as BlockType;
  }

  // List items
  if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
    return 'list-item';
  }

  // Code block (fenced)
  if (/^```/.test(trimmed)) {
    return 'code-block';
  }

  // Blockquote
  if (/^>\s/.test(trimmed)) {
    return 'blockquote';
  }

  // Horizontal rule
  if (/^(---|\*\*\*|___)$/.test(trimmed)) {
    return 'horizontal-rule';
  }

  // Default to paragraph
  return 'paragraph';
}

/**
 * Get the block type for a character at a given position in the document
 */
export function getBlockTypeAtPosition(
  content: string,
  offset: number
): BlockType {
  // Find the start of the current line
  let lineStart = offset;
  while (lineStart > 0 && content[lineStart - 1] !== '\n') {
    lineStart--;
  }

  // Find the end of the current line
  let lineEnd = offset;
  while (lineEnd < content.length && content[lineEnd] !== '\n') {
    lineEnd++;
  }

  const line = content.substring(lineStart, lineEnd);
  return detectBlockType(line);
}

/**
 * Helper to generate block-aware operations for inserting text
 */
export interface BlockAwareInsert {
  char: string;
  blockType: BlockType;
}

/**
 * Split text into block-aware characters
 */
export function splitIntoBlockAwareChars(
  text: string,
  contextBefore: string = ''
): BlockAwareInsert[] {
  const result: BlockAwareInsert[] = [];
  const fullText = contextBefore + text;
  const startOffset = contextBefore.length;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const offset = startOffset + i;
    const blockType = getBlockTypeAtPosition(fullText, offset);

    result.push({ char, blockType });
  }

  return result;
}
