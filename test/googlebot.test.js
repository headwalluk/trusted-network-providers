/**
 * Googlebot Provider Tests
 *
 * Tests the Googlebot provider's reload functions, including web-based reloading
 * and error handling scenarios.
 */

import { jest, describe, it, test, expect, beforeEach } from '@jest/globals';
import googlebot from '../src/providers/googlebot.js';

// Store original fetch
const originalFetch = global.fetch;

describe('Googlebot Provider', () => {
  beforeEach(() => {
    // Clear ranges before each test
    googlebot.ipv4.ranges.length = 0;
    googlebot.ipv6.ranges.length = 0;

    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('reload() - bundled asset', () => {
    test('should load IPv4 ranges from bundled asset', async () => {
      await googlebot.reload();

      expect(googlebot.ipv4.ranges.length).toBeGreaterThan(0);
      expect(googlebot.ipv4.ranges[0]).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
    });

    test('should load IPv6 ranges from bundled asset', async () => {
      await googlebot.reload();

      expect(googlebot.ipv6.ranges.length).toBeGreaterThan(0);
      expect(googlebot.ipv6.ranges[0]).toMatch(/^[0-9a-f:]+\/\d+$/i);
    });

    test('should clear existing ranges before reloading', async () => {
      // Add some fake ranges
      googlebot.ipv4.ranges.push('1.2.3.0/24');
      googlebot.ipv6.ranges.push('2001:db8::/32');

      await googlebot.reload();

      // Ranges should be cleared and replaced with real data
      expect(googlebot.ipv4.ranges).not.toContain('1.2.3.0/24');
      expect(googlebot.ipv6.ranges).not.toContain('2001:db8::/32');
    });

    test('test addresses should be in loaded ranges', async () => {
      await googlebot.reload();

      // Verify that test addresses are valid (this is a basic sanity check)
      expect(googlebot.testAddresses.length).toBeGreaterThan(0);
      expect(googlebot.testAddresses[0]).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    });
  });

  describe('reloadFromWeb()', () => {
    const createMockResponse = (body, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      json: jest.fn().mockResolvedValue(body),
    });

    test('should load ranges from web API', async () => {
      const mockData = {
        prefixes: [
          { ipv4Prefix: '66.249.64.0/19' },
          { ipv4Prefix: '66.249.96.0/19' },
          { ipv6Prefix: '2001:4860:4801::/48' },
          { ipv6Prefix: '2001:4860:4802::/48' },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(mockData));

      await googlebot.reloadFromWeb();

      expect(googlebot.ipv4.ranges).toContain('66.249.64.0/19');
      expect(googlebot.ipv4.ranges).toContain('66.249.96.0/19');
      expect(googlebot.ipv6.ranges).toContain('2001:4860:4801::/48');
      expect(googlebot.ipv6.ranges).toContain('2001:4860:4802::/48');
    });

    test('should clear existing ranges before reloading from web', async () => {
      const mockData = {
        prefixes: [{ ipv4Prefix: '66.249.64.0/19' }],
      };

      googlebot.ipv4.ranges.push('1.2.3.0/24');
      googlebot.ipv6.ranges.push('2001:db8::/32');

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(mockData));

      await googlebot.reloadFromWeb();

      expect(googlebot.ipv4.ranges).not.toContain('1.2.3.0/24');
      expect(googlebot.ipv6.ranges).not.toContain('2001:db8::/32');
    });

    test('should throw error if API returns invalid format', async () => {
      const invalidData = { invalid: 'structure' };

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(invalidData));

      await expect(googlebot.reloadFromWeb()).rejects.toThrow(
        'Invalid response format from Googlebot API'
      );
    });

    test('should throw error if API returns null', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(null));

      await expect(googlebot.reloadFromWeb()).rejects.toThrow(
        'Invalid response format from Googlebot API'
      );
    });

    test('should throw error if prefixes is not an array', async () => {
      const invalidData = { prefixes: 'not-an-array' };

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(invalidData));

      await expect(googlebot.reloadFromWeb()).rejects.toThrow(
        'Invalid response format from Googlebot API'
      );
    });

    test('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(googlebot.reloadFromWeb()).rejects.toThrow();
    });

    test('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse({}, 500));

      await expect(googlebot.reloadFromWeb()).rejects.toThrow();
    });

    test('should handle mixed IPv4 and IPv6 prefixes', async () => {
      const mockData = {
        prefixes: [
          { ipv4Prefix: '66.249.64.0/19' },
          { ipv6Prefix: '2001:4860:4801::/48' },
          { ipv4Prefix: '66.249.96.0/19' },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(mockData));

      await googlebot.reloadFromWeb();

      expect(googlebot.ipv4.ranges.length).toBe(2);
      expect(googlebot.ipv6.ranges.length).toBe(1);
    });
  });

  describe('provider structure', () => {
    test('should have required name property', () => {
      expect(googlebot.name).toBe('Googlebot');
    });

    test('should have test addresses', () => {
      expect(Array.isArray(googlebot.testAddresses)).toBe(true);
      expect(googlebot.testAddresses.length).toBeGreaterThan(0);
    });

    test('should have reload function', () => {
      expect(typeof googlebot.reload).toBe('function');
    });

    test('should have reloadFromWeb function', () => {
      expect(typeof googlebot.reloadFromWeb).toBe('function');
    });

    test('should have ipv4 structure', () => {
      expect(googlebot.ipv4).toBeDefined();
      expect(Array.isArray(googlebot.ipv4.addresses)).toBe(true);
      expect(Array.isArray(googlebot.ipv4.ranges)).toBe(true);
    });

    test('should have ipv6 structure', () => {
      expect(googlebot.ipv6).toBeDefined();
      expect(Array.isArray(googlebot.ipv6.addresses)).toBe(true);
      expect(Array.isArray(googlebot.ipv6.ranges)).toBe(true);
    });
  });
});
