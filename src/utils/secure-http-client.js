/**
 * secure-http-client.js
 *
 * Centralized HTTP client with security best practices:
 * - Strict HTTPS certificate validation (native fetch default)
 * - Request timeouts
 * - Retry logic for transient failures
 * - SHA-256 checksum verification
 * - Error handling
 *
 * Note: Native Node.js fetch (v18+) performs strict certificate validation
 * by default (rejectUnauthorized: true, modern TLS versions). No additional
 * HTTPS agent configuration is needed.
 */

import crypto from 'node:crypto';
import { HttpError } from '../errors.js';

/**
 * Configuration for secure HTTP requests
 */
const DEFAULT_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 2,
  retryDelay: 1000, // 1 second between retries
};

/**
 * Calculate SHA-256 hash of data
 * @param {string|Buffer} data - Data to hash
 * @returns {string} - Hex-encoded SHA-256 hash
 */
function calculateSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify checksum of response data
 * @param {string} data - Raw response data
 * @param {string} expectedChecksum - Expected SHA-256 hash
 * @param {string} url - URL for error messages
 * @throws {Error} - If checksum doesn't match
 */
function verifyChecksum(data, expectedChecksum, url) {
  const actualChecksum = calculateSHA256(data);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(
      `Checksum verification failed for ${url}. ` + `Expected: ${expectedChecksum}, Got: ${actualChecksum}`
    );
  }
}

/**
 * Fetch with timeout support using AbortController
 * @param {string} url - The URL to fetch
 * @param {object} fetchOptions - Options to pass to fetch
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>} - The fetch response
 */
async function fetchWithTimeout(url, fetchOptions, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Internal helper that handles HTTPS enforcement, retry loop, error classification,
 * and backoff for all fetch functions.
 *
 * @param {string} url - The URL to fetch from (must be HTTPS)
 * @param {object} config - Merged configuration (DEFAULT_CONFIG + caller overrides)
 * @param {object} fetchOptions - The { method, headers } object for fetch
 * @param {Function} processResponse - Callback receiving the Response, returns the final value
 * @returns {Promise<*>} - The processed response value
 * @throws {Error|HttpError} - On failure
 */
async function fetchWithRetry(url, config, fetchOptions, processResponse) {
  // Security check: Only allow HTTPS
  if (!url.startsWith('https://')) {
    throw new Error(`Insecure URL rejected: ${url}. Only HTTPS URLs are allowed.`);
  }

  let lastError;

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, config.timeout);

      // Check HTTP status — non-retryable client errors
      if (response.status === 404 || response.status === 403 || response.status === 401) {
        throw new HttpError(response.status, url);
      }

      if (!response.ok) {
        throw new HttpError(response.status, url, response.statusText);
      }

      return await processResponse(response);
    } catch (error) {
      lastError = error;

      // Don't retry on permanent HTTP client errors
      if (error instanceof HttpError && [401, 403, 404].includes(error.statusCode)) {
        throw error;
      }

      // Certificate validation errors should not be retried
      if (
        error.code === 'CERT_HAS_EXPIRED' ||
        error.code === 'CERT_UNTRUSTED' ||
        error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
      ) {
        throw new Error(`SSL certificate validation failed for ${url}: ${error.message}`);
      }

      // Timeout errors (transient — retry makes sense)
      if (error.name === 'AbortError') {
        lastError = new Error(`Request timeout for ${url} after ${config.timeout}ms`);
      }

      // If this isn't the last attempt, wait before retrying
      // Linear backoff: 1s, 2s, 3s...
      if (attempt < config.retries) {
        await sleep(config.retryDelay * (attempt + 1));
        continue;
      }
    }
  }

  // All retries exhausted
  throw new Error(`Failed to fetch ${url} after ${config.retries + 1} attempts: ${lastError.message}`);
}

/**
 * Fetch JSON data from a URL with security best practices
 *
 * @param {string} url - The URL to fetch from (must be HTTPS)
 * @param {object} options - Optional configuration overrides
 * @param {number} options.timeout - Request timeout in milliseconds
 * @param {number} options.retries - Number of retry attempts
 * @param {string} options.expectedChecksum - Optional SHA-256 checksum to verify
 * @param {Function} options.verifyStructure - Callback to verify JSON structure instead of checksum
 * @returns {Promise<object>} - The parsed JSON response
 * @throws {Error} - If the request fails, URL is not HTTPS, or checksum doesn't match
 */
async function fetchJSON(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return fetchWithRetry(url, config, { method: 'GET', headers: { Accept: 'application/json' } }, async (response) => {
    const text = await response.text();

    if (!text) {
      throw new Error('Empty response body received');
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON from ${url}: ${parseError.message}`);
    }

    if (config.expectedChecksum) {
      verifyChecksum(text, config.expectedChecksum, url);
    }

    if (config.verifyStructure && typeof config.verifyStructure === 'function') {
      const isValid = config.verifyStructure(body);
      if (!isValid) {
        throw new Error(`Structure verification failed for ${url}`);
      }
    }

    return body;
  });
}

/**
 * Fetch text data from a URL with security best practices
 *
 * @param {string} url - The URL to fetch from (must be HTTPS)
 * @param {object} options - Optional configuration overrides
 * @returns {Promise<string>} - The response text
 * @throws {Error} - If the request fails or URL is not HTTPS
 */
async function fetchText(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return fetchWithRetry(url, config, { method: 'GET', headers: { Accept: 'text/plain' } }, (response) => {
    return response.text();
  });
}

/**
 * Fetch XML data from a URL with security best practices
 *
 * @param {string} url - The URL to fetch from (must be HTTPS)
 * @param {object} options - Optional configuration overrides
 * @returns {Promise<Buffer>} - The response body as a buffer (for XML parsing)
 * @throws {Error} - If the request fails or URL is not HTTPS
 */
async function fetchXML(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return fetchWithRetry(url, config, { method: 'GET', headers: { Accept: 'application/xml' } }, async (response) => {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  });
}

export { fetchJSON, fetchText, fetchXML, calculateSHA256, verifyChecksum, DEFAULT_CONFIG, HttpError };
