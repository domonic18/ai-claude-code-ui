/**
 * Diff Utilities
 *
 * Provides functions for calculating and displaying line-based diffs.
 * Used for showing file changes in tool output.
 */

/**
 * Diff line type
 */
export type DiffLineType = 'added' | 'removed' | 'context';

/**
 * Single line in a diff
 */
export interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNum?: number;
}

/**
 * Calculate line-based diff between two strings
 *
 * Simple diff algorithm that finds common lines and differences.
 * Used for displaying file changes in a readable format.
 *
 * @param oldStr - Original content
 * @param newStr - New content
 * @returns Array of diff lines
 */
export function calculateDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  // Simple diff algorithm - find common lines and differences
  const diffLines: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      // Only new lines remaining
      diffLines.push({ type: 'added', content: newLine || '', lineNum: newIndex + 1 });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Only old lines remaining
      diffLines.push({ type: 'removed', content: oldLine || '', lineNum: oldIndex + 1 });
      oldIndex++;
    } else if (oldLine === newLine) {
      // Lines are the same - skip in diff view
      oldIndex++;
      newIndex++;
    } else {
      // Lines are different
      diffLines.push({ type: 'removed', content: oldLine || '', lineNum: oldIndex + 1 });
      diffLines.push({ type: 'added', content: newLine || '', lineNum: newIndex + 1 });
      oldIndex++;
      newIndex++;
    }
  }

  return diffLines;
}

/**
 * Create a memoized version of calculateDiff for performance
 *
 * @returns Memoized diff function
 */
export function createMemoizedDiff() {
  const cache = new Map<string, DiffLine[]>();

  return (oldStr: string, newStr: string): DiffLine[] => {
    const key = `${oldStr.length}-${newStr.length}-${oldStr.slice(0, 50)}`;
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = calculateDiff(oldStr, newStr);
    cache.set(key, result);

    // Limit cache size to prevent memory issues
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}
