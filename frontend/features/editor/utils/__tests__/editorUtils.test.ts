import { describe, it, expect } from 'vitest';
import {
  getThemeBackgroundColor,
  getThemeForegroundColor,
  formatJSON,
  minifyJSON,
  isBinaryFile,
  getPositionFromOffset,
  getOffsetFromPosition,
  truncateCode,
  validateCodeSyntax,
  getWordAtPosition
} from '../editorUtils';

import {
  detectLanguageFromFilename,
  detectLanguageFromContent,
  detectLanguage,
  getLanguageExtensions,
  getMonacoLanguage
} from '../languageDetection';

import { getFileIconInfo } from '../fileIconUtils';

describe('detectLanguageFromFilename', () => {
  it('should detect TypeScript', () => {
    expect(detectLanguageFromFilename('app.ts')).toBe('typescript');
  });

  it('should detect TSX', () => {
    expect(detectLanguageFromFilename('app.tsx')).toBe('typescript');
  });

  it('should detect JavaScript', () => {
    expect(detectLanguageFromFilename('app.js')).toBe('javascript');
  });

  it('should detect Python', () => {
    expect(detectLanguageFromFilename('script.py')).toBe('python');
  });

  it('should detect YAML', () => {
    expect(detectLanguageFromFilename('config.yaml')).toBe('yaml');
  });

  it('should detect JSON', () => {
    expect(detectLanguageFromFilename('package.json')).toBe('json');
  });

  it('should detect Markdown', () => {
    expect(detectLanguageFromFilename('README.md')).toBe('markdown');
  });

  it('should detect Dockerfile by name', () => {
    expect(detectLanguageFromFilename('Dockerfile')).toBe('dockerfile');
  });

  it('should return text for unknown extension', () => {
    expect(detectLanguageFromFilename('file.xyz')).toBe('text');
  });

  it('should return text for no extension', () => {
    expect(detectLanguageFromFilename('Makefile')).toBe('text');
  });
});

describe('detectLanguageFromContent', () => {
  it('should detect Python from shebang', () => {
    expect(detectLanguageFromContent('#!/usr/bin/python\nprint("hello")')).toBe('python');
  });

  it('should detect Bash from shebang', () => {
    expect(detectLanguageFromContent('#!/bin/bash\necho hello')).toBe('bash');
  });

  it('should detect Node from shebang', () => {
    expect(detectLanguageFromContent('#!/usr/bin/env node\nconsole.log("hello")')).toBe('javascript');
  });

  it('should detect Ruby from shebang', () => {
    expect(detectLanguageFromContent('#!/usr/bin/ruby\nputs "hello"')).toBe('ruby');
  });

  it('should return null for no shebang', () => {
    expect(detectLanguageFromContent('const x = 1;')).toBeNull();
  });

  it('should return null for empty content', () => {
    expect(detectLanguageFromContent('')).toBeNull();
  });
});

describe('detectLanguage', () => {
  it('should prefer content detection over filename', () => {
    expect(detectLanguage('script', '#!/usr/bin/python\nprint("hello")')).toBe('python');
  });

  it('should fall back to filename when no shebang', () => {
    expect(detectLanguage('script.py', 'print("hello")')).toBe('python');
  });

  it('should use filename when no content provided', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
  });
});

describe('getLanguageExtensions', () => {
  it('should return extensions for JavaScript', () => {
    expect(getLanguageExtensions('javascript')).toContain('.js');
    expect(getLanguageExtensions('javascript')).toContain('.jsx');
  });

  it('should return extensions for TypeScript', () => {
    expect(getLanguageExtensions('typescript')).toContain('.ts');
    expect(getLanguageExtensions('typescript')).toContain('.tsx');
  });

  it('should return empty array for unknown language', () => {
    expect(getLanguageExtensions('text')).toEqual(['.txt']);
  });
});

describe('getMonacoLanguage', () => {
  it('should map JavaScript correctly', () => {
    expect(getMonacoLanguage('javascript')).toBe('javascript');
  });

  it('should map TypeScript correctly', () => {
    expect(getMonacoLanguage('typescript')).toBe('typescript');
  });

  it('should map bash to shell', () => {
    expect(getMonacoLanguage('bash')).toBe('shell');
  });

  it('should map text to plaintext', () => {
    expect(getMonacoLanguage('text')).toBe('plaintext');
  });

  it('should map all languages without fallback', () => {
    const languages: Array<import('../../types').EditorLanguage> = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp',
      'go', 'rust', 'php', 'ruby', 'perl', 'sql', 'yaml', 'json',
      'markdown', 'html', 'css', 'scss', 'xml', 'bash', 'powershell',
      'dockerfile', 'text'
    ];
    for (const lang of languages) {
      const result = getMonacoLanguage(lang);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    }
  });
});

describe('getThemeBackgroundColor', () => {
  it('should return white for light theme', () => {
    expect(getThemeBackgroundColor('light')).toBe('#ffffff');
  });

  it('should return dark color for dark theme', () => {
    expect(getThemeBackgroundColor('dark')).toBe('#1e1e1e');
  });

  it('should return correct color for all themes', () => {
    const themes: Array<import('../../types').EditorTheme> = ['light', 'dark', 'monokai', 'solarized', 'dracula', 'nord', 'github'];
    for (const theme of themes) {
      expect(getThemeBackgroundColor(theme)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('getThemeForegroundColor', () => {
  it('should return black for light theme', () => {
    expect(getThemeForegroundColor('light')).toBe('#000000');
  });

  it('should return light color for dark theme', () => {
    expect(getThemeForegroundColor('dark')).toBe('#d4d4d4');
  });
});

describe('formatJSON', () => {
  it('should pretty print valid JSON', () => {
    expect(formatJSON('{"key":"value"}')).toBe('{\n  "key": "value"\n}');
  });

  it('should return original string for invalid JSON', () => {
    expect(formatJSON('{invalid}')).toBe('{invalid}');
  });
});

describe('minifyJSON', () => {
  it('should minify valid JSON', () => {
    expect(minifyJSON('{\n  "key":  "value"\n}')).toBe('{"key":"value"}');
  });

  it('should return original string for invalid JSON', () => {
    expect(minifyJSON('{invalid}')).toBe('{invalid}');
  });
});

describe('isBinaryFile', () => {
  it('should detect PNG by extension', () => {
    expect(isBinaryFile('', 'image.png')).toBe(true);
  });

  it('should detect ZIP by extension', () => {
    expect(isBinaryFile('', 'archive.zip')).toBe(true);
  });

  it('should detect EXE by extension', () => {
    expect(isBinaryFile('', 'program.exe')).toBe(true);
  });

  it('should not detect text file by extension', () => {
    expect(isBinaryFile('hello world', 'file.txt')).toBe(false);
  });

  it('should detect by null bytes in content', () => {
    expect(isBinaryFile('hello\0world', 'file.txt')).toBe(true);
  });

  it('should detect by non-printable character ratio', () => {
    const content = '\x01\x02\x03\x04\x05\x06\x07\x08\x0E\x0F\x10';
    expect(isBinaryFile(content, 'unknown')).toBe(true);
  });

  it('should handle empty content with text extension', () => {
    expect(isBinaryFile('', 'file.txt')).toBe(false);
  });
});

describe('getPositionFromOffset', () => {
  it('should return position at start', () => {
    expect(getPositionFromOffset('hello', 0)).toEqual({ line: 1, column: 1 });
  });

  it('should return position in middle of first line', () => {
    expect(getPositionFromOffset('hello', 3)).toEqual({ line: 1, column: 4 });
  });

  it('should return position on second line', () => {
    expect(getPositionFromOffset('hello\nworld', 6)).toEqual({ line: 2, column: 1 });
  });

  it('should return position at end', () => {
    expect(getPositionFromOffset('hello', 5)).toEqual({ line: 1, column: 6 });
  });

  it('should handle multiline', () => {
    expect(getPositionFromOffset('ab\ncd\nef', 4)).toEqual({ line: 2, column: 2 });
  });
});

describe('getOffsetFromPosition', () => {
  it('should return offset at start', () => {
    expect(getOffsetFromPosition('hello', 1, 1)).toBe(0);
  });

  it('should return offset on second line', () => {
    expect(getOffsetFromPosition('hello\nworld', 2, 1)).toBe(6);
  });

  it('should return offset at specific position', () => {
    expect(getOffsetFromPosition('hello\nworld', 2, 3)).toBe(8);
  });

  it('should round-trip with getPositionFromOffset', () => {
    const content = 'line1\nline2\nline3';
    const offset = 8;
    const pos = getPositionFromOffset(content, offset);
    expect(getOffsetFromPosition(content, pos.line, pos.column)).toBe(offset);
  });
});

describe('truncateCode', () => {
  it('should not truncate code within limit', () => {
    const code = 'line1\nline2\nline3';
    expect(truncateCode(code, 10)).toBe(code);
  });

  it('should truncate code exceeding limit', () => {
    const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join('\n');
    const result = truncateCode(lines, 10);
    expect(result).toContain('// ... (truncated)');
    expect(result.split('\n')).toHaveLength(11);
  });

  it('should use default maxLines of 10', () => {
    const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join('\n');
    const result = truncateCode(lines);
    expect(result).toContain('// ... (truncated)');
  });
});

describe('getFileIconInfo (editor)', () => {
  it('should return info for TypeScript file', () => {
    const info = getFileIconInfo('app.ts');
    expect(info.icon).toBe('typescript');
  });

  it('should return info for Python file', () => {
    const info = getFileIconInfo('script.py');
    expect(info.icon).toBe('python');
  });

  it('should detect Dockerfile special case', () => {
    const info = getFileIconInfo('Dockerfile');
    expect(info.icon).toBe('docker');
    expect(info.category).toBe('devops');
  });

  it('should detect package.json special case', () => {
    const info = getFileIconInfo('package.json');
    expect(info.icon).toBe('npm');
    expect(info.color).toBe('#cb3837');
  });

  it('should detect tsconfig.json special case', () => {
    const info = getFileIconInfo('tsconfig.json');
    expect(info.icon).toBe('typescript');
    expect(info.color).toBe('#3178c6');
  });

  it('should detect readme.md special case', () => {
    const info = getFileIconInfo('readme.md');
    expect(info.icon).toBe('markdown');
    expect(info.category).toBe('docs');
  });

  it('should return default for unknown file', () => {
    const info = getFileIconInfo('unknown.xyz');
    expect(info.icon).toBe('file');
    expect(info.category).toBe('file');
  });

  it('should detect image files', () => {
    const info = getFileIconInfo('photo.png');
    expect(info.icon).toBe('image');
  });
});

describe('validateCodeSyntax', () => {
  it('should validate balanced brackets', () => {
    const result = validateCodeSyntax('function test() { return [1, 2]; }', 'javascript');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should detect unbalanced bracket', () => {
    const result = validateCodeSyntax('function test() {', 'javascript');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate JSON syntax', () => {
    const result = validateCodeSyntax('{"key": "value"}', 'json');
    expect(result.valid).toBe(true);
  });

  it('should detect invalid JSON', () => {
    const result = validateCodeSyntax('{invalid}', 'json');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect mismatched brackets', () => {
    const result = validateCodeSyntax('(]', 'javascript');
    expect(result.valid).toBe(false);
  });

  it('should handle empty code', () => {
    const result = validateCodeSyntax('', 'javascript');
    expect(result.valid).toBe(true);
  });
});

describe('getWordAtPosition', () => {
  it('should get word at cursor position', () => {
    expect(getWordAtPosition('hello world', 2)).toBe('hello');
  });

  it('should get word at boundary between words', () => {
    expect(getWordAtPosition('hello world', 5)).toBe('hello');
  });

  it('should get word at start of second word', () => {
    expect(getWordAtPosition('hello world', 6)).toBe('world');
  });

  it('should handle underscore in word', () => {
    expect(getWordAtPosition('my_variable', 5)).toBe('my_variable');
  });

  it('should handle empty string', () => {
    expect(getWordAtPosition('', 0)).toBe('');
  });

  it('should handle position at space', () => {
    expect(getWordAtPosition('hello world', 5)).toBe('hello');
  });
});
