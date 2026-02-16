/**
 * Simple LRU (Least Recently Used) cache implementation.
 * Stores key-value pairs with a maximum size limit.
 * When the cache is full, the least recently accessed item is evicted.
 */
export class LRUCache {
  /**
   * Create a new LRU cache
   * @param {number} maxSize - Maximum number of items to store
   */
  constructor(maxSize) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('maxSize must be a positive integer');
    }

    this.maxSize = maxSize;
    this.cache = new Map(); // Map maintains insertion order
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {*} The cached value, or undefined if not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (mark as recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set a value in the cache
   * @param {string} key - The cache key
   * @param {*} value - The value to cache
   */
  set(key, value) {
    // If key exists, delete it first (we'll re-add it at the end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add the new entry
    this.cache.set(key, value);

    // If we've exceeded max size, remove the oldest entry
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - The cache key
   * @returns {boolean} True if the key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current number of items in the cache
   * @returns {number} The number of cached items
   */
  get size() {
    return this.cache.size;
  }
}
