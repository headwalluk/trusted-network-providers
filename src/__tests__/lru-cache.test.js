/**
 * Tests for LRU cache implementation
 */

import { LRUCache } from '../lru-cache.js';

describe('LRUCache', () => {
  describe('constructor', () => {
    test('should create cache with valid maxSize', () => {
      const cache = new LRUCache(10);
      expect(cache.maxSize).toBe(10);
      expect(cache.size).toBe(0);
    });

    test('should throw error for non-integer maxSize', () => {
      expect(() => new LRUCache(10.5)).toThrow('maxSize must be a positive integer');
      expect(() => new LRUCache('10')).toThrow('maxSize must be a positive integer');
    });

    test('should throw error for zero or negative maxSize', () => {
      expect(() => new LRUCache(0)).toThrow('maxSize must be a positive integer');
      expect(() => new LRUCache(-5)).toThrow('maxSize must be a positive integer');
    });
  });

  describe('set and get', () => {
    test('should store and retrieve values', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });

    test('should return undefined for missing keys', () => {
      const cache = new LRUCache(3);
      expect(cache.get('missing')).toBeUndefined();
    });

    test('should update existing keys', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
      expect(cache.size).toBe(1);
    });
  });

  describe('LRU eviction', () => {
    test('should evict least recently used item when max size exceeded', () => {
      const cache = new LRUCache(3);
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
      const cache = new LRUCache(3);
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
      const cache = new LRUCache(3);
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
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
    });

    test('should return false for missing keys', () => {
      const cache = new LRUCache(3);
      expect(cache.has('missing')).toBe(false);
    });

    test('should not affect LRU order', () => {
      const cache = new LRUCache(3);
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
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    test('should allow adding items after clear', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.clear();
      cache.set('key2', 'value2');

      expect(cache.size).toBe(1);
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('size', () => {
    test('should track number of items', () => {
      const cache = new LRUCache(5);
      expect(cache.size).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size).toBe(3);
    });

    test('should not exceed maxSize', () => {
      const cache = new LRUCache(2);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size).toBe(2);
    });
  });

  describe('integration scenarios', () => {
    test('should handle complex access patterns', () => {
      const cache = new LRUCache(4);
      
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
      const cache = new LRUCache(3);
      const obj = { foo: 'bar' };
      const arr = [1, 2, 3];

      cache.set('obj', obj);
      cache.set('arr', arr);

      expect(cache.get('obj')).toBe(obj);
      expect(cache.get('arr')).toBe(arr);
    });
  });
});
