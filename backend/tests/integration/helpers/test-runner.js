/**
 * HTTP Test Helpers
 *
 * HTTP client utilities for integration tests.
 * Migrated from the custom test framework — only the HTTP helpers remain.
 *
 * @module tests/integration/helpers/test-runner
 */

import http from 'http';

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

  // Build complete body
  const bodyParts = [];

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
