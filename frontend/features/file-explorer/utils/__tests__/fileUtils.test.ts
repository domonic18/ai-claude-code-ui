import { describe, it, expect } from 'vitest';
import type { FileNode } from '../../types';
import {
  formatFileSize,
  formatRelativeTime,
  getFileExtension,
  getFileName,
  getDirectoryPath,
  getParentPath,
  joinPath,
  isDirectory,
  isHiddenFile,
  getFileIconInfo,
  getFileType,
  filterFilesByQuery,
  flattenFileTree,
  findNodeByPath,
  getAllFilePaths,
  sortFilesByName,
  sortFilesBySize,
  sortFilesByTime,
  isValidFilePath,
  sanitizeFileName,
  truncateFileName
} from '../fileUtils';

describe('formatFileSize', () => {
  it('should return "0 B" for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('should return "0 B" for undefined', () => {
    expect(formatFileSize(undefined)).toBe('0 B');
  });

  it('should return "0 B" for null', () => {
    expect(formatFileSize(null)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('should format fractional sizes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});

describe('formatRelativeTime', () => {
  it('should return "-" for null', () => {
    expect(formatRelativeTime(null)).toBe('-');
  });

  it('should return "-" for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('-');
  });

  it('should return "just now" for recent time', () => {
    expect(formatRelativeTime(new Date())).toBe('just now');
  });

  it('should return minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('5 min ago');
  });

  it('should return hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('3 hours ago');
  });

  it('should return days ago', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe('2 days ago');
  });

  it('should return months ago', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(date);
    expect(result).toContain('months ago');
  });

  it('should return locale date for very old dates', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(date);
    expect(result).not.toBe('-');
    expect(typeof result).toBe('string');
  });
});

describe('getFileExtension', () => {
  it('should return extension for file with extension', () => {
    expect(getFileExtension('file.ts')).toBe('.ts');
  });

  it('should return extension for multi-dot filename', () => {
    expect(getFileExtension('file.test.ts')).toBe('.ts');
  });

  it('should return empty string for no extension', () => {
    expect(getFileExtension('file')).toBe('');
  });

  it('should return empty string for dotfile', () => {
    expect(getFileExtension('.gitignore')).toBe('');
  });
});

describe('getFileName', () => {
  it('should extract filename from path', () => {
    expect(getFileName('/home/user/file.txt')).toBe('file.txt');
  });

  it('should return filename for simple name', () => {
    expect(getFileName('file.txt')).toBe('file.txt');
  });

  it('should return empty string for trailing slash', () => {
    expect(getFileName('/path/')).toBe('');
  });
});

describe('getDirectoryPath', () => {
  it('should return directory from full path', () => {
    expect(getDirectoryPath('/home/user/file.txt')).toBe('/home/user');
  });

  it('should return empty string for filename only', () => {
    expect(getDirectoryPath('file.txt')).toBe('');
  });
});

describe('getParentPath', () => {
  it('should return parent directory', () => {
    expect(getParentPath('/home/user/docs')).toBe('/home/user');
  });

  it('should return root for top-level path', () => {
    expect(getParentPath('/home')).toBe('/');
  });
});

describe('joinPath', () => {
  it('should join path segments', () => {
    expect(joinPath('home', 'user', 'file.txt')).toBe('home/user/file.txt');
  });

  it('should handle leading slash', () => {
    expect(joinPath('/home', 'user')).toBe('/home/user');
  });

  it('should collapse multiple slashes', () => {
    expect(joinPath('/home/', '/user')).toBe('/home/user');
  });
});

describe('isDirectory', () => {
  it('should return true for trailing slash', () => {
    expect(isDirectory('/home/user/')).toBe(true);
  });

  it('should return false for file path', () => {
    expect(isDirectory('/home/user/file.txt')).toBe(false);
  });
});

describe('isHiddenFile', () => {
  it('should return true for dotfile', () => {
    expect(isHiddenFile('.gitignore')).toBe(true);
  });

  it('should return false for normal file', () => {
    expect(isHiddenFile('file.txt')).toBe(false);
  });
});

describe('getFileIconInfo', () => {
  it('should detect image files', () => {
    const result = getFileIconInfo('photo.png');
    expect(result.isImage).toBe(true);
    expect(result.icon).toBe('Image');
  });

  it('should detect PDF files', () => {
    const result = getFileIconInfo('doc.pdf');
    expect(result.isPdf).toBe(true);
  });

  it('should detect archive files', () => {
    const result = getFileIconInfo('archive.zip');
    expect(result.isArchive).toBe(true);
  });

  it('should detect code files', () => {
    const result = getFileIconInfo('app.ts');
    expect(result.icon).toBe('FileCode');
    expect(result.color).toBe('text-blue-500');
  });

  it('should detect markdown files', () => {
    const result = getFileIconInfo('readme.md');
    expect(result.icon).toBe('FileText');
  });

  it('should detect JSON/YAML files', () => {
    const result = getFileIconInfo('config.json');
    expect(result.icon).toBe('FileText');
    expect(result.color).toBe('text-yellow-500');
  });

  it('should return default for unknown files', () => {
    const result = getFileIconInfo('unknown.xyz');
    expect(result.icon).toBe('File');
    expect(result.isImage).toBe(false);
    expect(result.isPdf).toBe(false);
    expect(result.isArchive).toBe(false);
  });
});

describe('getFileType', () => {
  it('should return directory for trailing slash', () => {
    expect(getFileType('folder/')).toBe('directory');
  });

  it('should return file for known extensions', () => {
    expect(getFileType('file.ts')).toBe('file');
    expect(getFileType('file.py')).toBe('file');
    expect(getFileType('file.md')).toBe('file');
  });

  it('should return file for unknown extensions', () => {
    expect(getFileType('file.xyz')).toBe('file');
  });
});

const sampleTree: FileNode[] = [
  {
    id: '1', name: 'src', path: '/src', type: 'directory',
    children: [
      { id: '2', name: 'index.ts', path: '/src/index.ts', type: 'file' },
      { id: '3', name: 'app.tsx', path: '/src/app.tsx', type: 'file' },
    ]
  },
  { id: '4', name: 'package.json', path: '/package.json', type: 'file' },
  { id: '5', name: 'README.md', path: '/README.md', type: 'file' },
];

describe('filterFilesByQuery', () => {
  it('should return all items for empty query', () => {
    expect(filterFilesByQuery(sampleTree, '')).toEqual(sampleTree);
  });

  it('should filter by name', () => {
    const result = filterFilesByQuery(sampleTree, 'package');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('package.json');
  });

  it('should include directory with matching children', () => {
    const result = filterFilesByQuery(sampleTree, 'index');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('src');
  });

  it('should be case insensitive', () => {
    const result = filterFilesByQuery(sampleTree, 'README');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('README.md');
  });

  it('should return empty array for no matches', () => {
    expect(filterFilesByQuery(sampleTree, 'nonexistent')).toEqual([]);
  });
});

describe('flattenFileTree', () => {
  it('should flatten nested tree', () => {
    const result = flattenFileTree(sampleTree);
    expect(result).toHaveLength(5);
    expect(result.map(n => n.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('should handle empty tree', () => {
    expect(flattenFileTree([])).toEqual([]);
  });
});

describe('findNodeByPath', () => {
  it('should find top-level node', () => {
    const node = findNodeByPath(sampleTree, '/package.json');
    expect(node?.name).toBe('package.json');
  });

  it('should find nested node', () => {
    const node = findNodeByPath(sampleTree, '/src/index.ts');
    expect(node?.name).toBe('index.ts');
  });

  it('should return null for missing path', () => {
    expect(findNodeByPath(sampleTree, '/missing')).toBeNull();
  });
});

describe('getAllFilePaths', () => {
  it('should return only file paths (not directories)', () => {
    const paths = getAllFilePaths(sampleTree);
    expect(paths).toEqual(['/src/index.ts', '/src/app.tsx', '/package.json', '/README.md']);
  });

  it('should return empty array for empty tree', () => {
    expect(getAllFilePaths([])).toEqual([]);
  });
});

describe('sortFilesByName', () => {
  it('should sort directories first', () => {
    const dir: FileNode = { id: '1', name: 'z-dir', path: '/z-dir', type: 'directory' };
    const file: FileNode = { id: '2', name: 'a-file', path: '/a-file', type: 'file' };
    expect(sortFilesByName(dir, file)).toBe(-1);
    expect(sortFilesByName(file, dir)).toBe(1);
  });

  it('should sort same type alphabetically', () => {
    const a: FileNode = { id: '1', name: 'banana', path: '/banana', type: 'file' };
    const b: FileNode = { id: '2', name: 'apple', path: '/apple', type: 'file' };
    expect(sortFilesByName(a, b)).toBe(1);
  });

  it('should be case insensitive', () => {
    const a: FileNode = { id: '1', name: 'Apple', path: '/Apple', type: 'file' };
    const b: FileNode = { id: '2', name: 'apple', path: '/apple', type: 'file' };
    expect(sortFilesByName(a, b)).toBe(0);
  });
});

describe('sortFilesBySize', () => {
  it('should sort by size descending', () => {
    const a: FileNode = { id: '1', name: 'small', path: '/small', type: 'file', size: 100 };
    const b: FileNode = { id: '2', name: 'big', path: '/big', type: 'file', size: 500 };
    expect(sortFilesBySize(a, b)).toBe(400);
  });

  it('should treat missing size as 0', () => {
    const a: FileNode = { id: '1', name: 'no-size', path: '/no-size', type: 'file' };
    const b: FileNode = { id: '2', name: 'sized', path: '/sized', type: 'file', size: 10 };
    expect(sortFilesBySize(a, b)).toBe(10);
  });
});

describe('sortFilesByTime', () => {
  it('should sort by modified time descending', () => {
    const a: FileNode = { id: '1', name: 'old', path: '/old', type: 'file', modifiedTime: new Date('2024-01-01') };
    const b: FileNode = { id: '2', name: 'new', path: '/new', type: 'file', modifiedTime: new Date('2025-01-01') };
    expect(sortFilesByTime(a, b)).toBeGreaterThan(0);
  });
});

describe('isValidFilePath (fileUtils)', () => {
  it('should accept valid path', () => {
    expect(isValidFilePath('/home/user/file.txt')).toBe(true);
  });

  it('should reject path with null bytes', () => {
    expect(isValidFilePath('/path/\0file')).toBe(false);
  });

  it('should reject path with invalid characters', () => {
    expect(isValidFilePath('/path/<script>')).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('should replace invalid characters', () => {
    expect(sanitizeFileName('file<name>.txt')).toBe('file_name_.txt');
  });

  it('should replace spaces with dashes', () => {
    expect(sanitizeFileName('my file name.txt')).toBe('my-file-name.txt');
  });

  it('should truncate to 255 characters', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeFileName(longName)).toHaveLength(255);
  });
});

describe('truncateFileName', () => {
  it('should return name unchanged if under limit', () => {
    expect(truncateFileName('file.txt')).toBe('file.txt');
  });

  it('should truncate long names preserving extension', () => {
    const name = 'a'.repeat(40) + '.ts';
    const result = truncateFileName(name, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith('.ts')).toBe(true);
    expect(result).toContain('...');
  });

  it('should handle default max length 30', () => {
    const name = 'a'.repeat(35) + '.txt';
    expect(truncateFileName(name)).toContain('...');
  });
});
