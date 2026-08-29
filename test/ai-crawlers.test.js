/**
 * AI Crawler Provider Tests (Milestone 7)
 *
 * Covers the four crawler providers added in 2.3.0 — Applebot, GPTBot,
 * OAI-SearchBot and ChatGPT-User. All four consume the same Google-style
 * `{creationTime, prefixes[]}` feed, so the per-provider assertions are
 * table-driven rather than duplicated four times.
 *
 * Note: every one of these feeds is IPv4-only today (no `ipv6Prefix` entries),
 * so an empty `ipv6.ranges` after a successful reload is the expected state,
 * not a loading failure.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import trustedProviders from '../src/index.js';
import applebot from '../src/providers/applebot.js';
import gptbot from '../src/providers/gptbot.js';
import oaiSearchbot from '../src/providers/oai-searchbot.js';
import chatgptUser from '../src/providers/chatgpt-user.js';

// Store original fetch
const originalFetch = global.fetch;

const AI_CRAWLERS = [
  { provider: applebot, name: 'Applebot', errorLabel: 'Applebot' },
  { provider: gptbot, name: 'GPTBot', errorLabel: 'GPTBot' },
  { provider: oaiSearchbot, name: 'OAI-SearchBot', errorLabel: 'OAI-SearchBot' },
  { provider: chatgptUser, name: 'ChatGPT-User', errorLabel: 'ChatGPT-User' },
];

const createMockResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  json: jest.fn().mockResolvedValue(body),
});

describe.each(AI_CRAWLERS)('$name provider', ({ provider, name, errorLabel }) => {
  beforeEach(() => {
    provider.ipv4.ranges.length = 0;
    provider.ipv6.ranges.length = 0;
    global.fetch = originalFetch;
  });

  describe('reload() - bundled asset', () => {
    test('should load IPv4 ranges from the checksum-verified bundled asset', async () => {
      await provider.reload();

      expect(provider.ipv4.ranges.length).toBeGreaterThan(0);
      expect(provider.ipv4.ranges[0]).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
    });

    test('should clear existing ranges before reloading', async () => {
      provider.ipv4.ranges.push('1.2.3.0/24');
      provider.ipv6.ranges.push('2001:db8::/32');

      await provider.reload();

      expect(provider.ipv4.ranges).not.toContain('1.2.3.0/24');
      expect(provider.ipv6.ranges).not.toContain('2001:db8::/32');
    });
  });

  describe('reloadFromWeb()', () => {
    test('should load ranges from the published feed', async () => {
      const mockData = {
        prefixes: [{ ipv4Prefix: '203.0.113.0/24' }, { ipv6Prefix: '2001:db8:1::/48' }],
      };

      global.fetch = jest.fn().mockResolvedValue(createMockResponse(mockData));

      await provider.reloadFromWeb();

      expect(provider.ipv4.ranges).toContain('203.0.113.0/24');
      expect(provider.ipv6.ranges).toContain('2001:db8:1::/48');
    });

    test('should throw if the feed returns an invalid format', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse({ invalid: 'structure' }));

      await expect(provider.reloadFromWeb()).rejects.toThrow(`Invalid response format from ${errorLabel} API`);
    });

    test('should throw if the feed returns null', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse(null));

      await expect(provider.reloadFromWeb()).rejects.toThrow(`Invalid response format from ${errorLabel} API`);
    });

    test('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.reloadFromWeb()).rejects.toThrow();
    });

    test('should handle HTTP error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue(createMockResponse({}, 500));

      await expect(provider.reloadFromWeb()).rejects.toThrow();
    });
  });

  describe('runtime lookup via main library', () => {
    beforeEach(() => {
      // Isolate the provider under test
      trustedProviders.getAllProviders().forEach((registered) => trustedProviders.deleteProvider(registered.name));
    });

    test('should identify its own test addresses', async () => {
      await provider.reload();
      trustedProviders.addProvider(provider);

      provider.testAddresses.forEach((testAddress) => {
        expect(trustedProviders.getTrustedProvider(testAddress)).toBe(name);
      });
    });

    test('should return null for an unrelated IP', async () => {
      await provider.reload();
      trustedProviders.addProvider(provider);

      expect(trustedProviders.getTrustedProvider('198.51.100.42')).toBeNull();
    });
  });
});

describe('OpenAI crawler egress overlap', () => {
  beforeEach(() => {
    trustedProviders.getAllProviders().forEach((registered) => trustedProviders.deleteProvider(registered.name));
  });

  /**
   * OpenAI reuses egress infrastructure across its crawlers, so a handful of
   * prefixes are published in both the GPTBot and OAI-SearchBot feeds. Both are
   * trusted, so the only consequence is which name a shared prefix reports —
   * whichever provider is registered first wins the linear scan. This test pins
   * that behaviour so the overlap can't silently become a lookup regression.
   */
  test('shared prefixes resolve to the first-registered provider, and both feeds are still trusted', async () => {
    await gptbot.reload();
    await oaiSearchbot.reload();

    const sharedPrefixes = gptbot.ipv4.ranges.filter((range) => oaiSearchbot.ipv4.ranges.includes(range));

    // Guard the premise: if OpenAI ever de-duplicates its feeds this test
    // becomes vacuous, so assert the overlap actually exists.
    expect(sharedPrefixes.length).toBeGreaterThan(0);

    const sharedAddress = sharedPrefixes[0].replace(/\.\d+\/\d+$/, '.1');

    trustedProviders.addProvider(gptbot);
    trustedProviders.addProvider(oaiSearchbot);
    expect(trustedProviders.getTrustedProvider(sharedAddress)).toBe('GPTBot');
    expect(trustedProviders.isTrusted(sharedAddress)).toBe(true);
  });
});
