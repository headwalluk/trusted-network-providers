/**
 * Provider-specific tests
 *
 * Tests the built-in providers (Googlebot, Stripe, PayPal, etc.) with their configured test addresses.
 * These tests verify that each provider's test IPs are correctly identified after loading and reloading.
 */

import trustedProviders from '../src/index.js';
import fakeProvider from '../src/providers/fake-provider.js';

describe('Built-in Providers', () => {
  beforeAll(async () => {
    // Load all default providers once before running tests
    trustedProviders.loadDefaultProviders();
    await trustedProviders.reloadAll();
  });

  afterAll(() => {
    // Clean up after tests
    const providers = trustedProviders.getAllProviders();
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  test('should have loaded default providers', () => {
    const providers = trustedProviders.getAllProviders();
    expect(providers.length).toBeGreaterThan(0);
  });

  test('should correctly identify known untrusted IPs as null', () => {
    // These IPs should not be trusted by any provider
    expect(trustedProviders.getTrustedProvider('192.42.116.182')).toBeNull();
    expect(trustedProviders.getTrustedProvider('123.123.123.123')).toBeNull();
  });

  describe('Provider Test Addresses', () => {
    let allProviders;

    beforeAll(() => {
      allProviders = trustedProviders.getAllProviders();
    });

    test('each provider with test addresses should recognize its own IPs', () => {
      const providersWithTests = allProviders.filter(
        (provider) => Array.isArray(provider.testAddresses) && provider.testAddresses.length > 0
      );

      expect(providersWithTests.length).toBeGreaterThan(0);

      providersWithTests.forEach((provider) => {
        provider.testAddresses.forEach((testIP) => {
          const result = trustedProviders.getTrustedProvider(testIP);
          expect(result).toBe(provider.name);
        });
      });
    });

    test('isTrusted() should return true for provider test addresses', () => {
      const providersWithTests = allProviders.filter(
        (provider) => Array.isArray(provider.testAddresses) && provider.testAddresses.length > 0
      );

      providersWithTests.forEach((provider) => {
        provider.testAddresses.forEach((testIP) => {
          expect(trustedProviders.isTrusted(testIP)).toBe(true);
        });
      });
    });

    test('isTrusted() should return false for unknown IPs', () => {
      expect(trustedProviders.isTrusted('192.42.116.182')).toBe(false);
      expect(trustedProviders.isTrusted('123.123.123.123')).toBe(false);
    });
  });
});

describe('Fake Provider', () => {
  beforeEach(() => {
    // Clean slate before each test
    const providers = trustedProviders.getAllProviders();
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  test('should add fake provider only once even when called multiple times', () => {
    // Try adding the same provider multiple times
    trustedProviders.addProvider(fakeProvider);
    trustedProviders.addProvider(fakeProvider);
    trustedProviders.addProvider(fakeProvider);
    trustedProviders.addProvider(fakeProvider);

    const providers = trustedProviders.getAllProviders();
    const fakeProviderCount = providers.filter((p) => p.name === fakeProvider.name).length;

    expect(fakeProviderCount).toBe(1);
  });

  test('fake provider test addresses should be recognized after reload', async () => {
    trustedProviders.addProvider(fakeProvider);
    await trustedProviders.reloadAll();

    if (fakeProvider.testAddresses && fakeProvider.testAddresses.length > 0) {
      fakeProvider.testAddresses.forEach((testIP) => {
        const result = trustedProviders.getTrustedProvider(testIP);
        expect(result).toBe(fakeProvider.name);
      });
    }
  });
});

describe('Custom Provider', () => {
  beforeEach(() => {
    // Clean slate before each test
    const providers = trustedProviders.getAllProviders();
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  test('should add and recognize custom provider with specific IPs', async () => {
    const customProvider = {
      name: 'My Custom Network',
      reload: () => Promise.resolve(),
      testAddresses: ['12.12.12.34'],
      ipv4: {
        addresses: ['12.12.12.34', '12.12.34.34'],
        ranges: [],
      },
      ipv6: {
        addresses: [],
        ranges: [],
      },
    };

    trustedProviders.addProvider(customProvider);
    await trustedProviders.reloadAll();

    // Test that custom IPs are recognized
    expect(trustedProviders.getTrustedProvider('12.12.12.34')).toBe('My Custom Network');
    expect(trustedProviders.getTrustedProvider('12.12.34.34')).toBe('My Custom Network');

    // Test that non-custom IPs are not recognized
    expect(trustedProviders.getTrustedProvider('12.12.12.35')).toBeNull();
  });

  test('custom provider reload function should be called during reloadAll', async () => {
    const reloadSpy = jest.fn(() => Promise.resolve());

    const customProvider = {
      name: 'Spy Provider',
      reload: reloadSpy,
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

    trustedProviders.addProvider(customProvider);
    await trustedProviders.reloadAll();

    expect(reloadSpy).toHaveBeenCalled();
  });
});

describe('Provider Management', () => {
  beforeEach(() => {
    // Clean slate
    const providers = trustedProviders.getAllProviders();
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  test('hasProvider() should return true for added providers', () => {
    const testProvider = {
      name: 'Test Provider',
      reload: () => Promise.resolve(),
      testAddresses: [],
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    };

    expect(trustedProviders.hasProvider('Test Provider')).toBe(false);

    trustedProviders.addProvider(testProvider);

    expect(trustedProviders.hasProvider('Test Provider')).toBe(true);
  });

  test('deleteProvider() should remove a provider', () => {
    const testProvider = {
      name: 'Provider to Delete',
      reload: () => Promise.resolve(),
      testAddresses: [],
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    };

    trustedProviders.addProvider(testProvider);
    expect(trustedProviders.hasProvider('Provider to Delete')).toBe(true);

    trustedProviders.deleteProvider('Provider to Delete');
    expect(trustedProviders.hasProvider('Provider to Delete')).toBe(false);
  });

  test('getAllProviders() should return all registered providers', () => {
    const provider1 = {
      name: 'Provider 1',
      reload: () => Promise.resolve(),
      testAddresses: [],
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    };

    const provider2 = {
      name: 'Provider 2',
      reload: () => Promise.resolve(),
      testAddresses: [],
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    };

    trustedProviders.addProvider(provider1);
    trustedProviders.addProvider(provider2);

    const allProviders = trustedProviders.getAllProviders();
    expect(allProviders.length).toBe(2);
    expect(allProviders.some((p) => p.name === 'Provider 1')).toBe(true);
    expect(allProviders.some((p) => p.name === 'Provider 2')).toBe(true);
  });
});
