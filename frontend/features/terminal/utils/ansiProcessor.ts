/**
 * ANSI Color Processor
 *
 * Functions for parsing and stripping ANSI escape codes from terminal output.
 */

/**
 * Parsed ANSI segment with style information
 */
export type AnsiSegment = {
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

/** ANSI foreground color mapping */
const COLOR_MAP: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
};

/** ANSI background color mapping */
const BG_COLOR_MAP: Record<number, string> = {
  40: 'black',
  41: 'red',
  42: 'green',
  43: 'yellow',
  44: 'blue',
  45: 'magenta',
  46: 'cyan',
  47: 'white',
};

/**
 * Parse ANSI color codes into styled text segments
 * @param text - Text containing ANSI escape codes
 * @returns Array of text segments with associated styles
 */
export function parseAnsiColors(text: string): AnsiSegment[] {
  const ansiRegex = /\x1b\[[0-9;]*m/g;

  const segments: AnsiSegment[] = [];

  let lastIndex = 0;
  let currentStyle: {
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  } = {};

  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        ...currentStyle,
      });
    }

    const codeStr = match[0].slice(2, -1);
    const codes = codeStr.split(';').map(Number);

    for (const code of codes) {
      if (code === 0) {
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code in COLOR_MAP) {
        currentStyle.color = COLOR_MAP[code];
      } else if (code in BG_COLOR_MAP) {
        currentStyle.backgroundColor = BG_COLOR_MAP[code];
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      ...currentStyle,
    });
  }

  return segments;
}

/**
 * Strip ANSI escape codes from text
 * @param text - Text containing ANSI escape codes
 * @returns Plain text without any ANSI codes
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}
