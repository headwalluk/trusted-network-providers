/**
 * Tests for TTL cache implementation
 */

import { TTLCache } from '../src/ttl-cache.js';

describe('TTLCache', () => {
  describe('constructor', () => {
    test('should create cache with valid maxSize and ttlMs', () => {
      const cache = new TTLCache(10, 5000);
      expect(cache.maxSize).toBe(10);
      expect(cache.ttlMs).toBe(5000);
      expect(cache.size).toBe(0);
    });

    test('should throw error for non-integer maxSize', () => {
      expect(() => new TTLCache(10.5, 5000)).toThrow('maxSize must be a positive integer');
      expect(() => new TTLCache('10', 5000)).toThrow('maxSize must be a positive integer');
    });

    test('should throw error for zero or negative maxSize', () => {
      expect(() => new TTLCache(0, 5000)).toThrow('maxSize must be a positive integer');
      expect(() => new TTLCache(-5, 5000)).toThrow('maxSize must be a positive integer');
    });

    test('should throw error for non-integer ttlMs', () => {
      expect(() => new TTLCache(10, 5000.5)).toThrow('ttlMs must be a positive integer');
      expect(() => new TTLCache(10, '5000')).toThrow('ttlMs must be a positive integer');
    });

    test('should throw error for zero or negative ttlMs', () => {
      expect(() => new TTLCache(10, 0)).toThrow('ttlMs must be a positive integer');
      expect(() => new TTLCache(10, -1000)).toThrow('ttlMs must be a positive integer');
    });
  });

  describe('set and get', () => {
    test('should store and retrieve values', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });

    test('should return undefined for missing keys', () => {
      const cache = new TTLCache(3, 60000);
      expect(cache.get('missing')).toBeUndefined();
    });

    test('should update existing keys', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
      expect(cache.size).toBe(1);
    });
  });

  describe('TTL expiration', () => {
    test('should expire entries after ttlMs', () => {
      const cache = new TTLCache(10, 50); // 50ms TTL
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      const start = Date.now();
      while (Date.now() - start < 60) {
        // busy wait
      }

      expect(cache.get('key1')).toBeUndefined();
    });

    test('should report expired entries via has()', () => {
      const cache = new TTLCache(10, 50);
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);

      const start = Date.now();
      while (Date.now() - start < 60) {
        // busy wait
      }

      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    test('should evict least recently used item when max size exceeded', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size).toBe(3);

      // Adding a fourth item should evict key1 (oldest)
      cache.set('key4', 'value4');

      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBeUndefined(); // evicted
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update LRU order when accessing items', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 (making it recently used)
      cache.get('key1');

      // Add key4, which should evict key2 (now the oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1'); // still present
      expect(cache.get('key2')).toBeUndefined(); // evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update LRU order when updating existing keys', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update key1 (making it recently used)
      cache.set('key1', 'updated1');

      // Add key4, which should evict key2 (now the oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('updated1'); // still present
      expect(cache.get('key2')).toBeUndefined(); // evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('has', () => {
    test('should return true for existing keys', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
    });

    test('should return false for missing keys', () => {
      const cache = new TTLCache(3, 60000);
      expect(cache.has('missing')).toBe(false);
    });

    test('should not affect LRU order', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Check key1 existence (should NOT affect LRU order)
      cache.has('key1');

      // Add key4, which should still evict key1 (oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeUndefined(); // evicted
    });
  });

  describe('clear', () => {
    test('should remove all items', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    test('should allow adding items after clear', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', 'value1');
      cache.clear();
      cache.set('key2', 'value2');

      expect(cache.size).toBe(1);
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('prune', () => {
    test('should remove expired entries and return count', () => {
      const cache = new TTLCache(10, 50); // 50ms TTL
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const start = Date.now();
      while (Date.now() - start < 60) {
        // busy wait for expiry
      }

      // Add a fresh entry
      cache.set('key3', 'value3');

      const removed = cache.prune();

      expect(removed).toBe(2); // key1 and key2 expired
      expect(cache.size).toBe(1); // only key3 remains
      expect(cache.get('key3')).toBe('value3');
    });

    test('should return 0 when no entries are expired', () => {
      const cache = new TTLCache(10, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const removed = cache.prune();
      expect(removed).toBe(0);
      expect(cache.size).toBe(2);
    });
  });

  describe('size', () => {
    test('should track number of items', () => {
      const cache = new TTLCache(5, 60000);
      expect(cache.size).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size).toBe(3);
    });

    test('should not exceed maxSize', () => {
      const cache = new TTLCache(2, 60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size).toBe(2);
    });

    test('should include expired entries until pruned', () => {
      const cache = new TTLCache(10, 50);
      cache.set('key1', 'value1');

      const start = Date.now();
      while (Date.now() - start < 60) {
        // busy wait
      }

      // Size still includes expired entry
      expect(cache.size).toBe(1);

      // After prune, size is updated
      cache.prune();
      expect(cache.size).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    test('should handle complex access patterns with mixed expiry and eviction', () => {
      const cache = new TTLCache(4, 60000);

      // Fill cache
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);

      // Access pattern: b, c, a (d is now oldest)
      cache.get('b');
      cache.get('c');
      cache.get('a');

      // Add new item (should evict d)
      cache.set('e', 5);

      expect(cache.get('d')).toBeUndefined();
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('e')).toBe(5);
    });

    test('should handle objects and arrays as values', () => {
      const cache = new TTLCache(3, 60000);
      const obj = { foo: 'bar' };
      const arr = [1, 2, 3];

      cache.set('obj', obj);
      cache.set('arr', arr);

      expect(cache.get('obj')).toBe(obj);
      expect(cache.get('arr')).toBe(arr);
    });

    test('should handle null values', () => {
      const cache = new TTLCache(3, 60000);
      cache.set('key1', null);

      expect(cache.has('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });
  });
});
