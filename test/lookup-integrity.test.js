/**
 * Lookup integrity tests
 *
 * Cache expiry, address normalisation, cache invalidation on registration,
 * registration-time validation and configuration setters.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import trustedProviders from '../src/index.js';

const DEFAULT_TTL_MS = 60 * 60 * 1000;

const removeAllProviders = () => {
  for (const provider of trustedProviders.getAllProviders()) {
    trustedProviders.deleteProvider(provider.name);
  }
};

const createProvider = (name, { ipv4Addresses = [], ipv4Ranges = [], ipv6Addresses = [], ipv6Ranges = [] } = {}) => ({
  name,
  ipv4: { addresses: [...ipv4Addresses], ranges: [...ipv4Ranges] },
  ipv6: { addresses: [...ipv6Addresses], ranges: [...ipv6Ranges] },
});

describe('Lookup integrity', () => {
  beforeEach(() => {
    removeAllProviders();
    trustedProviders.setLogLevel('silent');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    trustedProviders.setResultCacheTTL(DEFAULT_TTL_MS);
    trustedProviders.setLogLevel('error');
  });

  describe('result cache expiry', () => {
    test.each([101, 102])(
      'an unknown address stays untrusted when its cached miss expires mid-lookup (clock from %i)',
      (clockStart) => {
        trustedProviders.setResultCacheTTL(1);
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(100);
        expect(trustedProviders.isTrusted('203.0.113.42')).toBe(false);

        // Every clock read advances 1 ms, so the entry expires during the lookup
        let clock = clockStart;
        nowSpy.mockImplementation(() => clock++);

        expect(trustedProviders.getTrustedProvider('203.0.113.42')).toBeNull();
        expect(trustedProviders.isTrusted('203.0.113.42')).toBe(false);
      }
    );

    test('a cached positive verdict is returned from the cache', () => {
      trustedProviders.addProvider(createProvider('Cached', { ipv4Ranges: ['198.51.100.0/24'] }));
      expect(trustedProviders.getTrustedProvider('198.51.100.7')).toBe('Cached');
      expect(trustedProviders.getTrustedProvider('198.51.100.7')).toBe('Cached');
    });
  });

  describe('non-string input', () => {
    test.each([undefined, null, 42, {}, ['198.51.100.7']])('%p is untrusted', (input) => {
      expect(trustedProviders.getTrustedProvider(input)).toBeNull();
      expect(trustedProviders.isTrusted(input)).toBe(false);
    });

    test('logs a bounded description of overlong input', () => {
      trustedProviders.setLogLevel('error');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      trustedProviders.getTrustedProvider('x'.repeat(5000));

      const loggedText = consoleErrorSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(loggedText).toContain('(5000 characters)');
      expect(loggedText.length).toBeLessThan(500);
    });
  });

  describe('address normalisation', () => {
    test('IPv4-mapped IPv6 matches IPv4 ranges', () => {
      trustedProviders.addProvider(createProvider('Network', { ipv4Ranges: ['198.51.100.0/24'] }));

      expect(trustedProviders.getTrustedProvider('198.51.100.42')).toBe('Network');
      expect(trustedProviders.getTrustedProvider('::ffff:198.51.100.42')).toBe('Network');
      expect(trustedProviders.getTrustedProvider('::FFFF:198.51.100.42')).toBe('Network');
    });

    test('IPv4-mapped IPv6 matches exact IPv4 addresses', () => {
      trustedProviders.addProvider(createProvider('Exact', { ipv4Addresses: ['198.51.100.42'] }));

      expect(trustedProviders.getTrustedProvider('::ffff:198.51.100.42')).toBe('Exact');
    });

    test.each([
      '2001:4860:4860::8888',
      '2001:4860:4860:0:0:0:0:8888',
      '2001:4860:4860:0000::8888',
      '2001:4860:4860::8888'.toUpperCase(),
    ])('%s matches a compressed exact IPv6 entry', (spelling) => {
      trustedProviders.addProvider(createProvider('IPv6', { ipv6Addresses: ['2001:4860:4860::8888'] }));

      expect(trustedProviders.getTrustedProvider(spelling)).toBe('IPv6');
    });

    test('an expanded exact IPv6 entry matches compressed input', () => {
      trustedProviders.addProvider(createProvider('Expanded', { ipv6Addresses: ['2001:db8:0:0:0:0:0:1'] }));

      expect(trustedProviders.getTrustedProvider('2001:db8::1')).toBe('Expanded');
    });

    test('an exact match does not depend on a later range', () => {
      trustedProviders.addProvider(
        createProvider('Both', { ipv4Addresses: ['198.51.100.42'], ipv4Ranges: ['203.0.113.0/24'] })
      );

      expect(trustedProviders.getTrustedProvider('198.51.100.42')).toBe('Both');
    });
  });

  describe('cache invalidation on registration', () => {
    test('a cached miss does not survive adding a provider that covers it', () => {
      expect(trustedProviders.getTrustedProvider('198.51.100.42')).toBeNull();

      trustedProviders.addProvider(createProvider('New', { ipv4Addresses: ['198.51.100.42'] }));

      expect(trustedProviders.getTrustedProvider('198.51.100.42')).toBe('New');
    });

    test('a cached miss does not survive loading the default providers', () => {
      expect(trustedProviders.getTrustedProvider('10.1.2.3')).toBeNull();

      trustedProviders.loadDefaultProviders();

      expect(trustedProviders.getTrustedProvider('10.1.2.3')).toBe('Private');
    });
  });

  describe('registration validation', () => {
    test('rejects a CIDR in the wrong family pool', () => {
      expect(() =>
        trustedProviders.addProvider(createProvider('Wrong Family', { ipv4Ranges: ['2001:db8::/32'] }))
      ).toThrow(/ipv4\.ranges: 2001:db8::\/32 is ipv6/);
    });

    test('rejects an invalid exact address', () => {
      expect(() =>
        trustedProviders.addProvider(createProvider('Bad Address', { ipv4Addresses: ['not-an-ip'] }))
      ).toThrow(/ipv4\.addresses: invalid entry "not-an-ip"/);
    });

    test('rejects a list that is not an array', () => {
      const provider = createProvider('Not An Array');
      provider.ipv6.ranges = 'fc00::/7';

      expect(() => trustedProviders.addProvider(provider)).toThrow(/ipv6\.ranges is not an array/);
    });

    test('fills in absent pools so lookups do not fail', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      trustedProviders.setLogLevel('error');

      trustedProviders.addProvider({ name: 'IPv4 Only', ipv4: { ranges: ['198.51.100.0/24'] } });

      expect(trustedProviders.getTrustedProvider('198.51.100.1')).toBe('IPv4 Only');
      expect(trustedProviders.getTrustedProvider('2001:db8::1')).toBeNull();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('configuration setters', () => {
    test('a fractional result-cache TTL is ignored without changing the reported TTL', () => {
      trustedProviders.setResultCacheTTL(1.5);

      expect(trustedProviders.getResultCacheTTL()).toBe(DEFAULT_TTL_MS);
    });

    test('an infinite staleness threshold is ignored', () => {
      const threshold = trustedProviders.getStalenessThreshold();
      trustedProviders.setStalenessThreshold(Infinity);

      expect(trustedProviders.getStalenessThreshold()).toBe(threshold);
    });

    test.each(['toString', '__proto__', 'constructor'])('rejects the inherited log level name %s', (level) => {
      expect(() => trustedProviders.setLogLevel(level)).toThrow(/Invalid log level/);
    });
  });
});
