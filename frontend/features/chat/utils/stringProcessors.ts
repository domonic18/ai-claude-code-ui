/**
 * String Processing Utilities
 *
 * Provides text processing functions for message content:
 * - HTML entity decoding
 * - Escape sequence processing with math formula protection
 */

/**
 * Decode HTML entities in text
 * @param text - Text containing HTML entities
 * @returns Text with decoded entities
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Unescape \n, \t, \r while protecting LaTeX formulas ($...$ and $$...$$) from being corrupted
 * @param text - Text with escape sequences
 * @returns Text with unescaped sequences, math formulas preserved
 */
export function unescapeWithMathProtection(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const mathBlocks: string[] = [];
  const PLACEHOLDER_PREFIX = '__MATH_BLOCK_';
  const PLACEHOLDER_SUFFIX = '__';

  // Extract and protect math formulas
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$|\$([^\$\n]+?)\$/g, (match) => {
    const index = mathBlocks.length;
    mathBlocks.push(match);
    return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
  });

  // Process escape sequences on non-math content
  processedText = processedText
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');

  // Restore math formulas
  processedText = processedText.replace(
    new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, 'g'),
    (match, index) => {
      return mathBlocks[parseInt(index)];
    }
  );

  return processedText;
}
