import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidFilePath,
  isValidProjectName,
  isValidMcpServerName,
  isValidCommandPath,
  isValidPort,
  isValidTimeout,
  isValidJson,
  isValidToolPattern,
  sanitizeInput,
  isRequired,
  isInRange,
  isValidArrayLength,
  hasProperties,
  getValidationErrorMessage
} from '../validators';

describe('isValidEmail', () => {
  it('should accept valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('should accept email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('should reject email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('should reject email without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should reject email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('should accept valid http url', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('should accept valid https url', () => {
    expect(isValidUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should reject string without protocol', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });

  it('should accept localhost url', () => {
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });
});

describe('isValidFilePath', () => {
  it('should accept absolute unix path', () => {
    expect(isValidFilePath('/home/user/file.txt')).toBe(true);
  });

  it('should reject windows path with colon', () => {
    expect(isValidFilePath('C:\\Users\\file.txt')).toBe(false);
  });

  it('should accept relative path with ./', () => {
    expect(isValidFilePath('./src/file.ts')).toBe(true);
  });

  it('should accept home directory path', () => {
    expect(isValidFilePath('~/documents/file.txt')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidFilePath('')).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    expect(isValidFilePath('   ')).toBe(false);
  });

  it('should reject path with invalid characters', () => {
    expect(isValidFilePath('/path/with<>chars')).toBe(false);
  });

  it('should reject path with pipe character', () => {
    expect(isValidFilePath('/path/with|pipe')).toBe(false);
  });
});

describe('isValidProjectName', () => {
  it('should accept alphanumeric name', () => {
    expect(isValidProjectName('my-project')).toBe(true);
  });

  it('should accept name with underscores', () => {
    expect(isValidProjectName('my_project')).toBe(true);
  });

  it('should accept name with spaces', () => {
    expect(isValidProjectName('my project')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidProjectName('')).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    expect(isValidProjectName('   ')).toBe(false);
  });

  it('should reject name with special characters', () => {
    expect(isValidProjectName('project@name')).toBe(false);
  });

  it('should reject name exceeding 100 characters', () => {
    expect(isValidProjectName('a'.repeat(101))).toBe(false);
  });
});

describe('isValidMcpServerName', () => {
  it('should accept valid server name', () => {
    expect(isValidMcpServerName('my-server')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidMcpServerName('')).toBe(false);
  });

  it('should reject name with special characters', () => {
    expect(isValidMcpServerName('server@name')).toBe(false);
  });
});

describe('isValidCommandPath', () => {
  it('should accept npx command', () => {
    expect(isValidCommandPath('npx')).toBe(true);
  });

  it('should accept node command', () => {
    expect(isValidCommandPath('node server.js')).toBe(true);
  });

  it('should accept absolute path', () => {
    expect(isValidCommandPath('/usr/bin/python')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidCommandPath('')).toBe(false);
  });

  it('should reject command with invalid characters', () => {
    expect(isValidCommandPath('cmd && rm -rf')).toBe(false);
  });
});

describe('isValidPort', () => {
  it('should accept valid port number', () => {
    expect(isValidPort(3000)).toBe(true);
  });

  it('should accept port 1', () => {
    expect(isValidPort(1)).toBe(true);
  });

  it('should accept port 65535', () => {
    expect(isValidPort(65535)).toBe(true);
  });

  it('should accept valid port string', () => {
    expect(isValidPort('8080')).toBe(true);
  });

  it('should reject port 0', () => {
    expect(isValidPort(0)).toBe(false);
  });

  it('should reject negative port', () => {
    expect(isValidPort(-1)).toBe(false);
  });

  it('should reject port over 65535', () => {
    expect(isValidPort(65536)).toBe(false);
  });

  it('should reject non-integer port', () => {
    expect(isValidPort(3000.5)).toBe(false);
  });

  it('should reject NaN string', () => {
    expect(isValidPort('abc')).toBe(false);
  });
});

describe('isValidTimeout', () => {
  it('should accept zero timeout', () => {
    expect(isValidTimeout(0)).toBe(true);
  });

  it('should accept positive timeout', () => {
    expect(isValidTimeout(5000)).toBe(true);
  });

  it('should accept max timeout 300000', () => {
    expect(isValidTimeout(300000)).toBe(true);
  });

  it('should reject negative timeout', () => {
    expect(isValidTimeout(-1)).toBe(false);
  });

  it('should reject timeout over max', () => {
    expect(isValidTimeout(300001)).toBe(false);
  });

  it('should reject non-integer timeout', () => {
    expect(isValidTimeout(100.5)).toBe(false);
  });
});

describe('isValidJson', () => {
  it('should accept valid JSON object', () => {
    expect(isValidJson('{"key": "value"}')).toEqual({ valid: true });
  });

  it('should accept valid JSON array', () => {
    expect(isValidJson('[1, 2, 3]')).toEqual({ valid: true });
  });

  it('should reject empty string', () => {
    expect(isValidJson('')).toEqual({ valid: false, error: 'JSON string is empty' });
  });

  it('should reject invalid JSON', () => {
    const result = isValidJson('{invalid}');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('isValidToolPattern', () => {
  it('should accept simple tool name', () => {
    expect(isValidToolPattern('Read')).toEqual({ valid: true });
  });

  it('should accept tool name with params', () => {
    expect(isValidToolPattern('Tool(param1, param2)')).toEqual({ valid: true });
  });

  it('should reject empty string', () => {
    expect(isValidToolPattern('')).toEqual({ valid: false, error: 'Pattern is empty' });
  });

  it('should reject pattern over 200 characters', () => {
    expect(isValidToolPattern('A' + '('.repeat(201))).toEqual({
      valid: false,
      error: 'Pattern too long (max 200 characters)'
    });
  });

  it('should reject invalid pattern format', () => {
    expect(isValidToolPattern('invalid pattern!')).toEqual({
      valid: false,
      error: 'Invalid pattern format'
    });
  });
});

describe('sanitizeInput', () => {
  it('should escape HTML tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape quotes', () => {
    expect(sanitizeInput('test "value"')).toBe('test &quot;value&quot;');
  });

  it('should escape single quotes', () => {
    expect(sanitizeInput("it's")).toBe("it&#x27;s");
  });

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('should leave normal text unchanged', () => {
    expect(sanitizeInput('hello world')).toBe('hello world');
  });
});

describe('isRequired', () => {
  it('should accept non-empty string', () => {
    expect(isRequired('hello')).toBe(true);
  });

  it('should reject null', () => {
    expect(isRequired(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(isRequired(undefined)).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isRequired('')).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    expect(isRequired('   ')).toBe(false);
  });

  it('should accept non-empty array', () => {
    expect(isRequired([1, 2])).toBe(true);
  });

  it('should reject empty array', () => {
    expect(isRequired([])).toBe(false);
  });

  it('should accept number', () => {
    expect(isRequired(42)).toBe(true);
  });

  it('should accept zero', () => {
    expect(isRequired(0)).toBe(true);
  });
});

describe('isInRange', () => {
  it('should return true for value in range', () => {
    expect(isInRange(5, 1, 10)).toBe(true);
  });

  it('should return true for value at min', () => {
    expect(isInRange(1, 1, 10)).toBe(true);
  });

  it('should return true for value at max', () => {
    expect(isInRange(10, 1, 10)).toBe(true);
  });

  it('should return false for value below min', () => {
    expect(isInRange(0, 1, 10)).toBe(false);
  });

  it('should return false for value above max', () => {
    expect(isInRange(11, 1, 10)).toBe(false);
  });

  it('should handle string number', () => {
    expect(isInRange(Number('5'), 1, 10)).toBe(true);
  });
});

describe('isValidArrayLength', () => {
  it('should return true for valid length', () => {
    expect(isValidArrayLength([1, 2, 3], 1, 5)).toBe(true);
  });

  it('should return true at min length', () => {
    expect(isValidArrayLength([1], 1, 5)).toBe(true);
  });

  it('should return true at max length', () => {
    expect(isValidArrayLength([1, 2, 3, 4, 5], 1, 5)).toBe(true);
  });

  it('should return false below min length', () => {
    expect(isValidArrayLength([], 1, 5)).toBe(false);
  });

  it('should return false above max length', () => {
    expect(isValidArrayLength([1, 2, 3, 4, 5, 6], 1, 5)).toBe(false);
  });
});

describe('hasProperties', () => {
  it('should return true for object with properties', () => {
    expect(hasProperties({ key: 'value' })).toBe(true);
  });

  it('should return false for empty object', () => {
    expect(hasProperties({})).toBe(false);
  });
});

describe('getValidationErrorMessage', () => {
  it('should format known field name', () => {
    expect(getValidationErrorMessage('name', 'is required')).toBe('Name: is required');
  });

  it('should format url field', () => {
    expect(getValidationErrorMessage('url', 'invalid')).toBe('URL: invalid');
  });

  it('should format email field', () => {
    expect(getValidationErrorMessage('email', 'invalid')).toBe('Email address: invalid');
  });

  it('should capitalize unknown field', () => {
    expect(getValidationErrorMessage('custom', 'error')).toBe('Custom: error');
  });
});
