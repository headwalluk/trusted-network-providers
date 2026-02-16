/**
 * Edge case and error handling tests
 *
 * Tests for invalid inputs, error conditions, and edge cases
 */

import { jest } from '@jest/globals';
import trustedProviders from '../src/index.js';

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    // Clean slate - remove all providers
    // Use a while loop to handle providers without names
    let providers = trustedProviders.getAllProviders();
    while (providers.length > 0) {
      const provider = providers[0];
      if (provider.name) {
        trustedProviders.deleteProvider(provider.name);
      } else {
        // Provider has no name, remove it directly by splicing the internal array
        providers.splice(0, 1);
      }
      providers = trustedProviders.getAllProviders();
    }
  });

  describe('Invalid IP Addresses', () => {
    beforeEach(async () => {
      const testProvider = {
        name: 'Test Provider',
        reload: () => Promise.resolve(),
        testAddresses: ['192.0.2.1'],
        ipv4: {
          addresses: ['192.0.2.1'],
          ranges: ['198.51.100.0/24'],
        },
        ipv6: {
          addresses: ['2001:db8::1'],
          ranges: ['2001:db8::/32'],
        },
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();
    });

    test('should return null for malformed IP addresses', () => {
      expect(trustedProviders.getTrustedProvider('invalid-ip')).toBeNull();
      expect(trustedProviders.getTrustedProvider('999.999.999.999')).toBeNull();
      expect(trustedProviders.getTrustedProvider('192.0.2')).toBeNull();
      expect(trustedProviders.getTrustedProvider('not.an.ip.address')).toBeNull();
    });

    test('should return null for empty string IP', () => {
      expect(trustedProviders.getTrustedProvider('')).toBeNull();
    });

    test('should handle null/undefined IP gracefully', () => {
      expect(trustedProviders.getTrustedProvider(null)).toBeNull();
      expect(trustedProviders.getTrustedProvider(undefined)).toBeNull();
    });

    test('isTrusted() should return false for invalid IPs', () => {
      expect(trustedProviders.isTrusted('invalid-ip')).toBe(false);
      expect(trustedProviders.isTrusted('')).toBe(false);
      expect(trustedProviders.isTrusted(null)).toBe(false);
      expect(trustedProviders.isTrusted(undefined)).toBe(false);
    });
  });

  describe('IPv6 Support', () => {
    beforeEach(async () => {
      const ipv6Provider = {
        name: 'IPv6 Test Provider',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: [],
          ranges: [],
        },
        ipv6: {
          addresses: ['2001:db8::1', '2001:db8::2'],
          ranges: ['2001:db8::/32'],
        },
      };

      trustedProviders.addProvider(ipv6Provider);
      await trustedProviders.reloadAll();
    });

    test('should recognize IPv6 addresses', () => {
      expect(trustedProviders.getTrustedProvider('2001:db8::1')).toBe('IPv6 Test Provider');
      expect(trustedProviders.getTrustedProvider('2001:db8::2')).toBe('IPv6 Test Provider');
    });

    test('should recognize IPs within IPv6 CIDR ranges', () => {
      expect(trustedProviders.getTrustedProvider('2001:db8::1234')).toBe('IPv6 Test Provider');
      expect(trustedProviders.getTrustedProvider('2001:db8:0:0:0:0:0:5678')).toBe('IPv6 Test Provider');
    });

    test('should not recognize IPs outside IPv6 CIDR ranges', () => {
      expect(trustedProviders.getTrustedProvider('2001:db9::1')).toBeNull();
    });
  });

  describe('Provider Without Reload Function', () => {
    test('should handle provider without reload function', async () => {
      const noReloadProvider = {
        name: 'No Reload Provider',
        // No reload function
        testAddresses: ['203.0.113.1'],
        ipv4: {
          addresses: ['203.0.113.1'],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(noReloadProvider);

      // reloadAll should not throw even if provider has no reload
      await expect(trustedProviders.reloadAll()).resolves.not.toThrow();

      // Provider should still work
      expect(trustedProviders.getTrustedProvider('203.0.113.1')).toBe('No Reload Provider');
    });
  });

  describe('Provider with Array of Reload Functions', () => {
    test('should handle provider with multiple reload functions', async () => {
      const reload1 = jest.fn(() => Promise.resolve());
      const reload2 = jest.fn(() => Promise.resolve());

      const multiReloadProvider = {
        name: 'Multi Reload Provider',
        reload: () => [reload1(), reload2()],
        testAddresses: [],
        ipv4: {
          addresses: [],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(multiReloadProvider);
      await trustedProviders.reloadAll();

      expect(reload1).toHaveBeenCalled();
      expect(reload2).toHaveBeenCalled();
    });
  });

  describe('Empty Provider Data', () => {
    test('should handle provider with no IP addresses or ranges', async () => {
      const emptyProvider = {
        name: 'Empty Provider',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: [],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(emptyProvider);
      await trustedProviders.reloadAll();

      // Should not find any IPs for this provider
      expect(trustedProviders.getTrustedProvider('192.0.2.1')).toBeNull();
    });
  });

  describe('Provider Order Priority', () => {
    test('should return first matching provider when IP matches multiple providers', async () => {
      const provider1 = {
        name: 'Provider 1',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: ['198.51.100.1'],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      const provider2 = {
        name: 'Provider 2',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: ['198.51.100.1'], // Same IP as provider1
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      // Add in specific order
      trustedProviders.addProvider(provider1);
      trustedProviders.addProvider(provider2);
      await trustedProviders.reloadAll();

      // Should match the first provider (Provider 1)
      expect(trustedProviders.getTrustedProvider('198.51.100.1')).toBe('Provider 1');
    });
  });

  describe('Invalid Provider Data', () => {
    test('should not add provider without a name', () => {
      const noNameProvider = {
        // name is missing
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
      };

      trustedProviders.addProvider(noNameProvider);
      const providers = trustedProviders.getAllProviders();

      expect(providers.length).toBe(0);
    });

    test('should not add null provider', () => {
      trustedProviders.addProvider(null);
      const providers = trustedProviders.getAllProviders();

      expect(providers.length).toBe(0);
    });

    test('should not add undefined provider', () => {
      trustedProviders.addProvider(undefined);
      const providers = trustedProviders.getAllProviders();

      expect(providers.length).toBe(0);
    });
  });

  describe('hasProvider Edge Cases', () => {
    test('should return false for null provider name', () => {
      expect(trustedProviders.hasProvider(null)).toBe(false);
    });

    test('should return false for undefined provider name', () => {
      expect(trustedProviders.hasProvider(undefined)).toBe(false);
    });

    test('should return false for empty string provider name', () => {
      expect(trustedProviders.hasProvider('')).toBe(false);
    });
  });

  describe('CIDR Edge Cases', () => {
    beforeEach(async () => {
      const cidrProvider = {
        name: 'CIDR Edge Provider',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: [],
          ranges: [
            '10.0.0.0/8', // Large range
            '192.168.1.0/32', // Single IP as CIDR
          ],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(cidrProvider);
      await trustedProviders.reloadAll();
    });

    test('should handle large CIDR ranges', () => {
      expect(trustedProviders.getTrustedProvider('10.0.0.1')).toBe('CIDR Edge Provider');
      expect(trustedProviders.getTrustedProvider('10.255.255.255')).toBe('CIDR Edge Provider');
      expect(trustedProviders.getTrustedProvider('11.0.0.1')).toBeNull();
    });

    test('should handle /32 CIDR (single IP)', () => {
      expect(trustedProviders.getTrustedProvider('192.168.1.0')).toBe('CIDR Edge Provider');
      expect(trustedProviders.getTrustedProvider('192.168.1.1')).toBeNull();
    });
  });

  describe('Diagnostics Mode', () => {
    test('should log diagnostics when isDiagnosticsEnabled is true', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Enable diagnostics
      trustedProviders.isDiagnosticsEnabled = true;

      const diagnosticProvider = {
        name: 'Diagnostic Test Provider',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: ['203.0.113.99'],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      // Set log level to debug so diagnostic messages appear
      trustedProviders.setLogLevel('debug');

      // addProvider should log when diagnostics enabled
      trustedProviders.addProvider(diagnosticProvider);
      expect(consoleLogSpy).toHaveBeenCalledWith('➕ Add provider: Diagnostic Test Provider');

      // reloadAll should log when diagnostics enabled
      await trustedProviders.reloadAll();
      expect(consoleLogSpy).toHaveBeenCalledWith('🔃 Reload: Diagnostic Test Provider');

      // Restore
      trustedProviders.isDiagnosticsEnabled = false;
      trustedProviders.setLogLevel('error'); // Reset to default
      consoleLogSpy.mockRestore();
    });
  });

  describe('Error Handling in IP Matching', () => {
    test('should handle exception during IP matching loop', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create a provider with a malformed structure that will cause an exception
      const badProvider = {
        name: 'Bad Provider',
        reload: () => Promise.resolve(),
        testAddresses: [],
        ipv4: {
          addresses: null, // This will cause an exception when iterating
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(badProvider);

      // This should trigger the catch block in getTrustedProvider
      const result = trustedProviders.getTrustedProvider('192.0.2.1');

      // Should have logged the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Failed to find trusted source'));

      // Should return null even though an error occurred
      expect(result).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Manual Testing Function', () => {
    test('should execute runTests() without throwing', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const testProvider = {
        name: 'Test Provider for runTests',
        reload: () => Promise.resolve(),
        testAddresses: ['192.0.2.100', '198.51.100.200'],
        ipv4: {
          addresses: ['192.0.2.100'],
          ranges: ['198.51.100.0/24'],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();

      // Set log level to info so test output appears
      trustedProviders.setLogLevel('info');

      // runTests() should not throw
      expect(() => trustedProviders.runTests()).not.toThrow();

      // Should have logged test results
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Finished tests'));

      trustedProviders.setLogLevel('error'); // Reset to default
      consoleLogSpy.mockRestore();
    });

    test('runTests() should handle provider with no testAddresses', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const noTestProvider = {
        name: 'Provider Without Tests',
        reload: () => Promise.resolve(),
        // testAddresses is undefined (not an array)
        ipv4: {
          addresses: ['203.0.113.1'],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      trustedProviders.addProvider(noTestProvider);
      await trustedProviders.reloadAll();

      // Set log level to info so test output appears
      trustedProviders.setLogLevel('info');

      // runTests() should handle missing testAddresses
      expect(() => trustedProviders.runTests()).not.toThrow();

      // Should have logged "No tests for Provider Without Tests"
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No tests for Provider Without Tests'));

      trustedProviders.setLogLevel('error'); // Reset to default
      consoleLogSpy.mockRestore();
    });
  });
});
