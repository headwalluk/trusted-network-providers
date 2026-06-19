/**
 * Google User-Triggered Fetchers Provider Tests
 *
 * Tests the provider's reload functions (bundled asset + web), error handling,
 * and that it recognises the google-proxy IPs that motivated the provider
 * (see dev-notes/08-milestone-8-google-user-fetchers.md).
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import trustedProviders from '../src/index.js';
import googleUserFetchers from '../src/providers/google-user-fetchers.js';

// Store original fetch
const originalFetch = global.fetch;

describe('Google User-Triggered Fetchers Provider', () => {
  beforeEach(() => {
    // Clear ranges before each test
    googleUserFetchers.ipv4.ranges.length = 0;
    googleUserFetchers.ipv6.ranges.length = 0;

    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('reload() - bundled asset', () => {
    test('should load IPv4 ranges from bundled asset', async () => {
      await googleUserFetchers.reload();

      expect(googleUserFetchers.ipv4.ranges.length).toBeGreaterThan(0);
      expect(googleUserFetchers.ipv4.ranges[0]).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
    });

    test('should load IPv6 ranges from bundled asset', async () => {
      await googleUserFetchers.reload();

      expect(googleUserFetchers.ipv6.ranges.length).toBeGreaterThan(0);
      expect(googleUserFetchers.ipv6.ranges[0]).toMatch(/^[0-9a-f:]+\/\d+$/i);
    });

    test('should clear existing ranges before reloading', async () => {
      googleUserFetchers.ipv4.ranges.push('1.2.3.0/24');
      googleUserFetchers.ipv6.ranges.push('2001:db8::/32');

      await googleUserFetchers.reload();

      expect(googleUserFetchers.ipv4.ranges).not.toContain('1.2.3.0/24');
      expect(googleUserFetchers.ipv6.ranges).not.toContain('2001:db8::/32');
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
          { ipv4Prefix: '66.249.93.160/27' },
          { ipv4Prefix: '66.249.81.0/27' },
          { ipv6Prefix: '2001:4860:4801:4004::/64' },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(mockData));

      await googleUserFetchers.reloadFromWeb();

      expect(googleUserFetchers.ipv4.ranges).toContain('66.249.93.160/27');
      expect(googleUserFetchers.ipv4.ranges).toContain('66.249.81.0/27');
      expect(googleUserFetchers.ipv6.ranges).toContain('2001:4860:4801:4004::/64');
    });

    test('should clear existing ranges before reloading from web', async () => {
      const mockData = { prefixes: [{ ipv4Prefix: '66.249.93.160/27' }] };

      googleUserFetchers.ipv4.ranges.push('1.2.3.0/24');
      googleUserFetchers.ipv6.ranges.push('2001:db8::/32');

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(mockData));

      await googleUserFetchers.reloadFromWeb();

      expect(googleUserFetchers.ipv4.ranges).not.toContain('1.2.3.0/24');
      expect(googleUserFetchers.ipv6.ranges).not.toContain('2001:db8::/32');
    });

    test('should throw error if API returns invalid format', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse({ invalid: 'structure' }));

      await expect(googleUserFetchers.reloadFromWeb()).rejects.toThrow(
        'Invalid response format from Google User-Triggered Fetchers API'
      );
    });

    test('should throw error if API returns null', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(null));

      await expect(googleUserFetchers.reloadFromWeb()).rejects.toThrow(
        'Invalid response format from Google User-Triggered Fetchers API'
      );
    });

    test('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(googleUserFetchers.reloadFromWeb()).rejects.toThrow();
    });

    test('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse({}, 500));

      await expect(googleUserFetchers.reloadFromWeb()).rejects.toThrow();
    });
  });

  describe('runtime lookup via main library', () => {
    beforeEach(() => {
      // Isolate the provider under test
      trustedProviders.getAllProviders().forEach((p) => trustedProviders.deleteProvider(p.name));
    });

    test('should identify the google-proxy test addresses', async () => {
      await googleUserFetchers.reload();
      trustedProviders.addProvider(googleUserFetchers);

      googleUserFetchers.testAddresses.forEach((testAddr) => {
        expect(trustedProviders.getTrustedProvider(testAddr)).toBe('Google User-Triggered Fetchers');
      });
    });

    test('should return null for a non-Google IP', async () => {
      await googleUserFetchers.reload();
      trustedProviders.addProvider(googleUserFetchers);

      expect(trustedProviders.getTrustedProvider('1.1.1.1')).toBeNull();
    });

    test('should NOT claim the Googlebot crawler half (66.249.66.x)', async () => {
      await googleUserFetchers.reload();
      trustedProviders.addProvider(googleUserFetchers);

      // 66.249.66.87 is a Googlebot crawler IP — must not be matched here.
      expect(trustedProviders.getTrustedProvider('66.249.66.87')).toBeNull();
    });
  });

  describe('provider structure', () => {
    test('should have required name property', () => {
      expect(googleUserFetchers.name).toBe('Google User-Triggered Fetchers');
    });

    test('should have test addresses', () => {
      expect(Array.isArray(googleUserFetchers.testAddresses)).toBe(true);
      expect(googleUserFetchers.testAddresses.length).toBeGreaterThan(0);
    });

    test('should have reload and reloadFromWeb functions', () => {
      expect(typeof googleUserFetchers.reload).toBe('function');
      expect(typeof googleUserFetchers.reloadFromWeb).toBe('function');
    });

    test('should have ipv4 and ipv6 structures', () => {
      expect(Array.isArray(googleUserFetchers.ipv4.addresses)).toBe(true);
      expect(Array.isArray(googleUserFetchers.ipv4.ranges)).toBe(true);
      expect(Array.isArray(googleUserFetchers.ipv6.addresses)).toBe(true);
      expect(Array.isArray(googleUserFetchers.ipv6.ranges)).toBe(true);
    });
  });
});
