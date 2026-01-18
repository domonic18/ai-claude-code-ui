/**
 * Markdown Parser Utilities
 *
 * Utilities for parsing and processing markdown content.
 */

/**
 * Decode HTML entities in text
 *
 * @param text - Text to decode
 * @returns Decoded text
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
 * Normalize markdown text where providers mistakenly wrap short inline code
 * with single-line triple fences.
 *
 * Only convert fences that do NOT contain any newline to avoid touching real code blocks.
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeInlineCodeFences(text: string): string {
  if (!text || typeof text !== 'string') return text;
  try {
    // ```code```  -> `code`
    return text.replace(/```\s*([^\n\r]+?)\s*```/g, '`$1`');
  } catch {
    return text;
  }
}

/**
 * Unescape \n, \t, \r while protecting LaTeX formulas ($...$ and $$...$$)
 * from being corrupted
 *
 * @param text - Text to unescape
 * @returns Unescaped text with math protected
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
      return mathBlocks[parseInt(index as string, 10)];
    }
  );

  return processedText;
}

/**
 * Format "Claude AI usage limit reached|<epoch>" into a local time string
 *
 * @param text - Text containing usage limit message
 * @returns Formatted text with readable time
 */
export function formatUsageLimitText(text: string): string {
  try {
    if (typeof text !== 'string') return text;
    return text.replace(/Claude AI usage limit reached\|(\d{10,13})/g, (match, ts) => {
      let timestampMs = parseInt(ts, 10);
      if (!Number.isFinite(timestampMs)) return match;
      if (timestampMs < 1e12) timestampMs *= 1000; // seconds → ms
      const reset = new Date(timestampMs);

      // Time HH:mm in local time
      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(reset);

      // Human-readable timezone: GMT±HH[:MM] (City)
      const offsetMinutesLocal = -reset.getTimezoneOffset();
      const sign = offsetMinutesLocal >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutesLocal);
      const offH = Math.floor(abs / 60);
      const offM = abs % 60;
      const gmt = `GMT${sign}${offH}${offM ? ':' + String(offM).padStart(2, '0') : ''}`;
      const tzId = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const cityRaw = tzId.split('/').pop() || '';
      const city = cityRaw
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
      const tzHuman = city ? `${gmt} (${city})` : gmt;

      // Readable date like "8 Jun 2025"
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateReadable = `${reset.getDate()} ${months[reset.getMonth()]} ${reset.getFullYear()}`;

      return `Claude usage limit reached. Your limit will reset at **${timeStr} ${tzHuman}** - ${dateReadable}`;
    });
  } catch {
    return text;
  }
}

/**
 * Check if a code block looks multiline
 *
 * @param raw - Raw code content
 * @returns True if the code appears to be multiline
 */
export function looksMultiline(raw: string): boolean {
  return /[\r\n]/.test(raw);
}

/**
 * Truncate text to a maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
