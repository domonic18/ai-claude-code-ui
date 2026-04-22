import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_FILE_CONTENT,
  INVALID_NAME_CHARS,
  extractRelativePath,
  isValidFileName,
  isImageFile,
  findFileByPath,
  filterFileTree
} from '../fileTreeHelpers';
import { formatFileSize, formatRelativeTime } from '../fileFormatters';

describe('DEFAULT_FILE_CONTENT', () => {
  it('should be a newline character', () => {
    expect(DEFAULT_FILE_CONTENT).toBe('\n');
  });
});

describe('INVALID_NAME_CHARS', () => {
  it('should match backslash', () => {
    expect(INVALID_NAME_CHARS.test('\\')).toBe(true);
  });

  it('should match colon', () => {
    expect(INVALID_NAME_CHARS.test(':')).toBe(true);
  });

  it('should match asterisk', () => {
    expect(INVALID_NAME_CHARS.test('*')).toBe(true);
  });

  it('should not match alphanumeric', () => {
    expect(INVALID_NAME_CHARS.test('a')).toBe(false);
  });
});

describe('extractRelativePath', () => {
  it('should extract relative path from workspace path', () => {
    expect(extractRelativePath('/workspace/my-project/src/file.ts', 'my-project')).toBe('src/file.ts');
  });

  it('should return "." for project root', () => {
    expect(extractRelativePath('/workspace/my-project', 'my-project')).toBe('.');
  });

  it('should return path with project stripped for non-matching project', () => {
    expect(extractRelativePath('/workspace/my-project/src/file.ts', 'other-project')).toBe('my-project/src/file.ts');
  });

  it('should return path unchanged if not in workspace', () => {
    expect(extractRelativePath('/other/path/file.ts', 'my-project')).toBe('/other/path/file.ts');
  });
});

describe('isValidFileName', () => {
  it('should accept valid filename', () => {
    expect(isValidFileName('file.txt')).toBe(true);
  });

  it('should accept filename with spaces', () => {
    expect(isValidFileName('my file.txt')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidFileName('')).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    expect(isValidFileName('   ')).toBe(false);
  });

  it('should reject filename with colon', () => {
    expect(isValidFileName('file:name')).toBe(false);
  });

  it('should reject filename with backslash', () => {
    expect(isValidFileName('file\\name')).toBe(false);
  });

  it('should reject "."', () => {
    expect(isValidFileName('.')).toBe(false);
  });

  it('should reject ".."', () => {
    expect(isValidFileName('..')).toBe(false);
  });

  it('should accept dotfile', () => {
    expect(isValidFileName('.gitignore')).toBe(true);
  });
});

describe('formatFileSize (fileTreeHelpers)', () => {
  it('should return "0 B" for zero', () => {
    expect(formatFileSize(0, ['B', 'KB', 'MB'])).toBe('0 B');
  });

  it('should return "0 B" for undefined', () => {
    expect(formatFileSize(undefined, ['B', 'KB', 'MB'])).toBe('0 B');
  });

  it('should format with custom units', () => {
    expect(formatFileSize(1024, ['B', 'KB', 'MB'])).toBe('1 KB');
  });

  it('should format bytes', () => {
    expect(formatFileSize(500, ['B', 'KB', 'MB'])).toBe('500 B');
  });
});

describe('formatRelativeTime (fileTreeHelpers)', () => {
  const t = vi.fn((key: string, options?: Record<string, unknown>) => {
    if (options?.count) return `${options.count} ${key}`;
    return key;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return "-" for null', () => {
    expect(formatRelativeTime(null, t)).toBe('-');
  });

  it('should return translation key for recent time', () => {
    formatRelativeTime(new Date(), t);
    expect(t).toHaveBeenCalledWith('fileExplorer.time.justNow');
  });

  it('should return minutes translation', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    formatRelativeTime(date, t);
    expect(t).toHaveBeenCalledWith('fileExplorer.time.minutesAgo', { count: 5 });
  });

  it('should return hours translation', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    formatRelativeTime(date, t);
    expect(t).toHaveBeenCalledWith('fileExplorer.time.hoursAgo', { count: 3 });
  });

  it('should return days translation', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    formatRelativeTime(date, t);
    expect(t).toHaveBeenCalledWith('fileExplorer.time.daysAgo', { count: 2 });
  });

  it('should return locale date for very old dates', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(date, t);
    expect(typeof result).toBe('string');
    expect(t).not.toHaveBeenCalled();
  });
});

describe('isImageFile', () => {
  it('should detect PNG', () => {
    expect(isImageFile('photo.png')).toBe(true);
  });

  it('should detect JPG', () => {
    expect(isImageFile('photo.jpg')).toBe(true);
  });

  it('should detect SVG', () => {
    expect(isImageFile('icon.svg')).toBe(true);
  });

  it('should not detect non-image', () => {
    expect(isImageFile('file.ts')).toBe(false);
  });

  it('should handle case insensitive', () => {
    expect(isImageFile('photo.PNG')).toBe(true);
  });

  it('should handle no extension', () => {
    expect(isImageFile('file')).toBe(false);
  });
});

describe('findFileByPath', () => {
  const tree = [
    { path: '/src', children: [
      { path: '/src/index.ts' },
      { path: '/src/app.tsx' },
    ]},
    { path: '/package.json' },
  ];

  it('should find top-level node', () => {
    expect(findFileByPath(tree, '/package.json')?.path).toBe('/package.json');
  });

  it('should find nested node', () => {
    expect(findFileByPath(tree, '/src/index.ts')?.path).toBe('/src/index.ts');
  });

  it('should return null for missing path', () => {
    expect(findFileByPath(tree, '/missing')).toBeNull();
  });

  it('should return null for empty tree', () => {
    expect(findFileByPath([], '/any')).toBeNull();
  });
});

describe('filterFileTree', () => {
  const tree = [
    { name: 'src', type: 'directory', children: [
      { name: 'index.ts', type: 'file', children: [] },
      { name: 'app.tsx', type: 'file', children: [] },
    ]},
    { name: 'package.json', type: 'file', children: [] },
    { name: 'README.md', type: 'file', children: [] },
  ];

  it('should filter by name match', () => {
    const result = filterFileTree(tree, 'package');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('package.json');
  });

  it('should include directory with matching children', () => {
    const result = filterFileTree(tree, 'index');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('src');
  });

  it('should return all for empty query', () => {
    expect(filterFileTree(tree, '')).toHaveLength(3);
  });

  it('should be case insensitive', () => {
    const result = filterFileTree(tree, 'readme');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('README.md');
  });
});
