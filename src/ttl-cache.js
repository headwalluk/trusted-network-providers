/**
 * Simple TTL (Time-To-Live) cache implementation with LRU eviction.
 * Stores key-value pairs with automatic expiration and a maximum size limit.
 * When the cache is full, the least recently accessed item is evicted.
 * Expired entries are removed lazily on access.
 */
export class TTLCache {
  /**
   * Create a new TTL cache
   * @param {number} maxSize - Maximum number of items to store
   * @param {number} ttlMs - Time-to-live in milliseconds for each entry
   */
  constructor(maxSize, ttlMs) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('maxSize must be a positive integer');
    }

    if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
      throw new Error('ttlMs must be a positive integer');
    }

    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map(); // Map maintains insertion order
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {*} The cached value, or undefined if not found or expired
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const entry = this.cache.get(key);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache with TTL
   * @param {string} key - The cache key
   * @param {*} value - The value to cache
   */
  set(key, value) {
    const expiresAt = Date.now() + this.ttlMs;

    // If key exists, delete it first (we'll re-add it at the end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add the new entry
    this.cache.set(key, { value, expiresAt });

    // If we've exceeded max size, remove the oldest entry
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Check if a key exists in the cache (and is not expired)
   * @param {string} key - The cache key
   * @returns {boolean} True if the key exists and is not expired
   */
  has(key) {
    if (!this.cache.has(key)) {
      return false;
    }

    const entry = this.cache.get(key);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current number of items in the cache (including expired entries)
   * @returns {number} The number of cached items
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Remove expired entries from the cache.
   * This is called automatically on get/has, but can be called manually for cleanup.
   * @returns {number} The number of expired entries removed
   */
  prune() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}
