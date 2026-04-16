/**
 * Test Runner Utilities
 *
 * Shared test framework: test executor, assertion library, HTTP client.
 * Extracted from existing api-endpoints.test.js for reuse.
 *
 * @module tests/integration/helpers/test-runner
 */

import http from 'http';

/**
 * Test result collector
 */
export class TestResults {
  constructor() {
    this.passed = [];
    this.failed = [];
    this.total = 0;
  }

  get passCount() {
    return this.passed.length;
  }

  get failCount() {
    return this.failed.length;
  }

  get allPassed() {
    return this.failed.length === 0;
  }
}

/**
 * Assertion utility library
 */
export const assert = {
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
  },

  notEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(`${message}\n  Expected: NOT ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
  },

  truthy(value, message) {
    if (!value) {
      throw new Error(`${message}\n  Expected truthy value, got: ${JSON.stringify(value)}`);
    }
  },

  falsy(value, message) {
    if (value) {
      throw new Error(`${message}\n  Expected falsy value, got: ${JSON.stringify(value)}`);
    }
  },

  hasProperty(obj, prop, message) {
    if (!obj || !(prop in obj)) {
      throw new Error(`${message}\n  Expected object to have property: ${prop}`);
    }
  },

  contains(str, substr, message) {
    if (typeof str !== 'string' || !str.includes(substr)) {
      throw new Error(`${message}\n  Expected "${String(str).substring(0, 200)}" to contain "${substr}"`);
    }
  },

  notContains(str, substr, message) {
    if (typeof str === 'string' && str.includes(substr)) {
      throw new Error(`${message}\n  Expected "${String(str).substring(0, 200)}" to NOT contain "${substr}"`);
    }
  },

  isArray(value, message) {
    if (!Array.isArray(value)) {
      throw new Error(`${message}\n  Expected array, got: ${typeof value}`);
    }
  },

  lengthOf(value, expected, message) {
    if (!value || value.length !== expected) {
      throw new Error(`${message}\n  Expected length ${expected}, got: ${value?.length ?? 'undefined'}`);
    }
  },

  greaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(`${message}\n  Expected ${actual} > ${expected}`);
    }
  },

  throwsAsync(asyncFn, expectedMessage, message) {
    return asyncFn().then(
      () => { throw new Error(`${message}\n  Expected function to throw`); },
      (err) => {
        if (expectedMessage && !err.message.includes(expectedMessage)) {
          throw new Error(`${message}\n  Expected error to contain "${expectedMessage}", got: "${err.message}"`);
        }
      }
    );
  }
};

/**
 * Create a test executor bound to a TestResults instance
 *
 * @param {TestResults} results - Test result collector
 * @returns {Function} Test executor function
 */
export function createTestExecutor(results) {
  return async function test(name, testFn) {
    results.total++;
    try {
      await testFn();
      results.passed.push(name);
      console.log(`  \u2713 ${name}`);
      return true;
    } catch (error) {
      results.failed.push({ name, error: error.message });
      console.log(`  \u2717 ${name}: ${error.message}`);
      return false;
    }
  };
}

/**
 * Send HTTP request to the test server
 *
 * @param {string} method - HTTP method
 * @param {string} path - URL path
 * @param {Object|string|null} body - Request body
 * @param {string|null} token - Auth token (Bearer)
 * @param {Object} [options] - Additional options
 * @param {string} [options.contentType] - Content-Type header override
 * @param {string} [options.cookie] - Cookie header value
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
 */
export function makeRequest(method, path, body = null, token = null, options = {}) {
  const requestOptions = {
    hostname: 'localhost',
    port: 3001,
    path,
    method,
    headers: {
      'Content-Type': options.contentType || 'application/json'
    }
  };

  if (token) {
    requestOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.cookie) {
    requestOptions.headers['Cookie'] = options.cookie;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }

    req.end();
  });
}

/**
 * Send multipart form-data request (for file uploads)
 *
 * @param {string} method - HTTP method
 * @param {string} path - URL path
 * @param {Object} fields - Form fields
 * @param {Array<{name: string, filename: string, data: Buffer, contentType?: string}>} files - File entries
 * @param {string|null} token - Auth token
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
 */
export function makeMultipartRequest(method, path, fields, files, token) {
  const boundary = `----TestBoundary${Date.now()}`;
  const parts = [];

  // Add form fields
  for (const [key, value] of Object.entries(fields || {})) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
    );
  }

  // Add files
  for (const file of files || []) {
    const contentType = file.contentType || 'application/octet-stream';
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
    );
  }

  // Build complete body
  const bodyParts = [];
  let partIndex = 0;

  for (const [key, value] of Object.entries(fields || {})) {
    bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }

  for (const file of files || []) {
    const contentType = file.contentType || 'application/octet-stream';
    bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${contentType}\r\n\r\n`));
    bodyParts.push(file.data);
    bodyParts.push(Buffer.from('\r\n'));
  }

  bodyParts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(bodyParts);

  const requestOptions = {
    hostname: 'localhost',
    port: 3001,
    path,
    method,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    }
  };

  if (token) {
    requestOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Parse JSON response body safely
 *
 * @param {string} body - Response body string
 * @returns {Object} Parsed JSON object
 * @throws {Error} If body is not valid JSON
 */
export function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Invalid JSON response: ${String(body).substring(0, 200)}`);
  }
}

/**
 * Print test summary and exit with appropriate code
 *
 * @param {TestResults} results - Test results
 * @param {string} title - Test suite title
 */
export function printSummary(results, title) {
  console.log(`\n=== ${title} Summary ===`);
  console.log(`Total: ${results.total}`);
  console.log(`Passed: ${results.passCount}`);
  console.log(`Failed: ${results.failCount}`);
  console.log();

  if (results.failCount > 0) {
    console.log('Failed Tests:');
    results.failed.forEach(({ name, error }) => {
      console.log(`  - ${name}`);
      console.log(`    ${error}`);
    });
    console.log();
  }

  if (results.allPassed) {
    console.log(`\u2713 All ${title} tests passed!`);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

/**
 * Check if the test server is running
 *
 * @returns {Promise<boolean>}
 */
export async function checkServerRunning() {
  try {
    const response = await makeRequest('GET', '/health');
    return response.statusCode === 200;
  } catch {
    return false;
  }
}

/**
 * Generate a unique test identifier
 *
 * @param {string} prefix - Prefix for the identifier
 * @returns {string}
 */
export function uniqueId(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
