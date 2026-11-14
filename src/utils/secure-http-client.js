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
  maxResponseBytes: 5 * 1024 * 1024, // 5 MiB; the largest feed is well under 1 MiB
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

/** Raised when a redirect leaves HTTPS; never retried. */
class InsecureRedirectError extends Error {
  constructor(url, finalUrl) {
    super(`Insecure redirect rejected: ${url} redirected to ${finalUrl}. Only HTTPS URLs are allowed.`);
    this.name = 'InsecureRedirectError';
  }
}

const CERTIFICATE_ERROR_CODES = new Set(['CERT_HAS_EXPIRED', 'CERT_UNTRUSTED', 'DEPTH_ZERO_SELF_SIGNED_CERT']);

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rejects with an AbortError once the signal aborts, otherwise settles as the promise does.
 * @param {Promise<*>} promise - The work to bound
 * @param {AbortSignal} signal - The request's abort signal
 * @returns {Promise<*>}
 */
function withAbort(promise, signal) {
  let removeListener = () => {};
  const aborted = new Promise((resolve, reject) => {
    const rejectWithAbort = () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      reject(abortError);
    };
    if (signal.aborted) {
      rejectWithAbort();
    } else {
      signal.addEventListener('abort', rejectWithAbort, { once: true });
      removeListener = () => signal.removeEventListener('abort', rejectWithAbort);
    }
  });

  return Promise.race([promise, aborted]).finally(removeListener);
}

/**
 * Reads a response body as UTF-8 text, rejecting once it exceeds maxBytes.
 * @param {Response} response - The fetch response
 * @param {number} maxBytes - Maximum body size in bytes
 * @param {string} url - URL for error messages
 * @returns {Promise<string>} - The body text
 */
async function readBodyText(response, maxBytes, url) {
  const tooLarge = () => new Error(`Response from ${url} exceeds ${maxBytes} bytes`);

  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw tooLarge();
  }

  let text;
  if (typeof response.body?.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;
    let isDone = false;
    while (!isDone) {
      const { done, value } = await reader.read();
      isDone = done;
      if (value) {
        receivedBytes += value.byteLength;
        if (receivedBytes > maxBytes) {
          await reader.cancel();
          throw tooLarge();
        }
        chunks.push(value);
      }
    }
    text = Buffer.concat(chunks).toString('utf8');
  } else {
    text = await response.text();
    if (Buffer.byteLength(text ?? '', 'utf8') > maxBytes) {
      throw tooLarge();
    }
  }

  return text;
}

/**
 * Makes one request and processes its body, all within a single timeout.
 * @param {string} url - The URL to fetch
 * @param {object} config - Merged configuration
 * @param {object} fetchOptions - Options to pass to fetch
 * @param {Function} processText - Callback receiving the body text, returns the final value
 * @returns {Promise<*>} - The processed value
 */
async function fetchOnce(url, config, fetchOptions, processText) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await withAbort(fetch(url, { ...fetchOptions, signal: controller.signal }), controller.signal);

    // fetch follows redirects, so check where the body actually came from
    if (typeof response.url === 'string' && response.url !== '' && !response.url.startsWith('https://')) {
      await response.body?.cancel?.();
      throw new InsecureRedirectError(url, response.url);
    }

    // Check HTTP status — non-retryable client errors
    if (response.status === 404 || response.status === 403 || response.status === 401) {
      await response.body?.cancel?.();
      throw new HttpError(response.status, url);
    }

    if (!response.ok) {
      await response.body?.cancel?.();
      throw new HttpError(response.status, url, response.statusText);
    }

    const text = await withAbort(readBodyText(response, config.maxResponseBytes, url), controller.signal);
    return await processText(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Internal helper that handles HTTPS enforcement, retry loop, error classification,
 * and backoff for all fetch functions.
 *
 * @param {string} url - The URL to fetch from (must be HTTPS)
 * @param {object} config - Merged configuration (DEFAULT_CONFIG + caller overrides)
 * @param {object} fetchOptions - The { method, headers } object for fetch
 * @param {Function} processText - Callback receiving the body text, returns the final value
 * @returns {Promise<*>} - The processed response value
 * @throws {Error|HttpError} - On failure
 */
async function fetchWithRetry(url, config, fetchOptions, processText) {
  // Security check: Only allow HTTPS
  if (!url.startsWith('https://')) {
    throw new Error(`Insecure URL rejected: ${url}. Only HTTPS URLs are allowed.`);
  }

  let result;
  let lastError = null;
  let isFinished = false;
  let isPermanentFailure = false;

  for (let attempt = 0; attempt <= config.retries && !isFinished; attempt++) {
    try {
      result = await fetchOnce(url, config, fetchOptions, processText);
      lastError = null;
      isFinished = true;
    } catch (error) {
      lastError = error;

      // Native fetch wraps transport errors, so the certificate code may be on the cause
      const errorCode = error.code ?? error.cause?.code;

      if (error instanceof HttpError && [401, 403, 404].includes(error.statusCode)) {
        // Permanent HTTP client errors are not retried
        isPermanentFailure = true;
      } else if (error instanceof InsecureRedirectError) {
        isPermanentFailure = true;
      } else if (CERTIFICATE_ERROR_CODES.has(errorCode)) {
        lastError = new Error(`SSL certificate validation failed for ${url}: ${error.message}`, { cause: error });
        isPermanentFailure = true;
      } else {
        if (error.name === 'AbortError') {
          lastError = new Error(`Request timeout for ${url} after ${config.timeout}ms`, { cause: error });
        }

        // Linear backoff: 1s, 2s, 3s...
        if (attempt < config.retries) {
          await sleep(config.retryDelay * (attempt + 1));
        }
      }
      isFinished = isPermanentFailure;
    }
  }

  if (isPermanentFailure) {
    throw lastError;
  }

  if (lastError) {
    throw new Error(`Failed to fetch ${url} after ${config.retries + 1} attempts: ${lastError.message}`, {
      cause: lastError,
    });
  }

  return result;
}

/**
 * Fetch JSON data from a URL with security best practices
 *
 * @param {string} url - The URL to fetch from (must be HTTPS)
 * @param {object} options - Optional configuration overrides
 * @param {number} options.timeout - Deadline in milliseconds for the whole request, body included
 * @param {number} options.retries - Number of retry attempts
 * @param {number} options.maxResponseBytes - Largest response body accepted
 * @param {string} options.expectedChecksum - Optional SHA-256 checksum to verify
 * @param {Function} options.verifyStructure - Callback to verify JSON structure instead of checksum
 * @returns {Promise<object>} - The parsed JSON response
 * @throws {Error} - If the request fails, URL is not HTTPS, or checksum doesn't match
 */
async function fetchJSON(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  return fetchWithRetry(url, config, { method: 'GET', headers: { Accept: 'application/json' } }, (text) => {
    if (!text) {
      throw new Error('Empty response body received');
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON from ${url}: ${parseError.message}`, { cause: parseError });
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

  return fetchWithRetry(url, config, { method: 'GET', headers: { Accept: 'text/plain' } }, (text) => text);
}

export { fetchJSON, fetchText, calculateSHA256, verifyChecksum, DEFAULT_CONFIG, HttpError };
