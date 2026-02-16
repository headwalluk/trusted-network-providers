/**
 * Custom error classes for trusted-network-providers
 */

export class HttpError extends Error {
  constructor(statusCode, url, statusText = '') {
    super(`HTTP ${statusCode} error for ${url}${statusText ? `: ${statusText}` : ''}`);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.url = url;
  }
}
