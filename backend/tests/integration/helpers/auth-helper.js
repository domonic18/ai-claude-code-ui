/**
 * Auth Helper
 *
 * Shared authentication utilities for integration tests.
 * Handles user registration, login, and token management.
 *
 * @module tests/integration/helpers/auth-helper
 */

import { makeRequest, parseJson } from './test-runner.js';

/**
 * Auth helper class for managing test user tokens
 */
export class AuthHelper {
  constructor() {
    /** @type {Map<string, {token: string, cookie: string, userId: number}>} */
    this.users = new Map();
  }

  /**
   * Register a test user and obtain auth token
   *
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<{token: string, cookie: string, userId: number}>}
   */
  async registerUser(username, password) {
    // Try register first
    const regResponse = await makeRequest('POST', '/api/auth/register', {
      username,
      password
    });

    // Extract token from response
    const tokenData = this._extractToken(regResponse, username);
    if (tokenData) {
      this.users.set(username, tokenData);
      return tokenData;
    }

    // If registration fails (e.g., user exists), try login
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      username,
      password
    });

    const loginTokenData = this._extractToken(loginResponse, username);
    if (loginTokenData) {
      this.users.set(username, loginTokenData);
      return loginTokenData;
    }

    throw new Error(`Failed to register/login user ${username}: ${regResponse.statusCode} / ${loginResponse.statusCode}`);
  }

  /**
   * Get token for an existing user (must be registered first)
   *
   * @param {string} username - Username
   * @returns {{token: string, cookie: string, userId: number}}
   */
  getToken(username) {
    const data = this.users.get(username);
    if (!data) {
      throw new Error(`No token for user ${username}. Call registerUser first.`);
    }
    return data;
  }

  /**
   * Get the Bearer token string for authorization header
   *
   * @param {string} username - Username
   * @returns {string} Bearer token
   */
  getBearerToken(username) {
    return this.getToken(username).token;
  }

  /**
   * Get the cookie string for cookie-based auth
   *
   * @param {string} username - Username
   * @returns {string} Cookie header value
   */
  getCookie(username) {
    return this.getToken(username).cookie;
  }

  /**
   * Login an existing user and refresh token
   *
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<{token: string, cookie: string, userId: number}>}
   */
  async loginUser(username, password) {
    const response = await makeRequest('POST', '/api/auth/login', {
      username,
      password
    });

    if (response.statusCode !== 200) {
      throw new Error(`Login failed for ${username}: ${response.statusCode} ${response.body}`);
    }

    const tokenData = this._extractToken(response, username);
    if (tokenData) {
      this.users.set(username, tokenData);
      return tokenData;
    }

    throw new Error(`Failed to extract token from login response for ${username}`);
  }

  /**
   * Extract token from HTTP response
   *
   * @param {Object} response - HTTP response
   * @param {string} username - Username for logging
   * @returns {{token: string, cookie: string, userId: number}|null}
   * @private
   */
  _extractToken(response, username) {
    const cookies = response.headers['set-cookie'];
    if (!cookies) {
      return null;
    }

    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
      return null;
    }

    const token = authCookie.split('auth_token=')[1].split(';')[0];
    const cookie = authCookie.split(';')[0];

    // Try to get userId from response body
    let userId = null;
    try {
      const body = parseJson(response.body);
      userId = body.data?.id || body.data?.userId || body.data?.user?.id;
    } catch {
      // Ignore parse errors
    }

    return { token, cookie, userId };
  }

  /**
   * Clean up all stored tokens
   */
  clear() {
    this.users.clear();
  }
}
