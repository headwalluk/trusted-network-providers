/**
 * Reload integrity tests
 *
 * Failed reloads keep previous data, direct reloads invalidate cached
 * verdicts, bundled assets must match their checksums, the HTTP deadline
 * covers the body, and reloadAll() records one outcome per provider.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import trustedProviders from '../src/index.js';
import googlebot from '../src/providers/googlebot.js';
import { fetchJSON, fetchText } from '../src/utils/secure-http-client.js';
import { readVerifiedAsset } from '../src/utils/checksum-verifier.js';
import {
  createEmptySnapshot,
  replaceProviderData,
  snapshotFromAddressList,
  snapshotFromPrefixes,
} from '../src/utils/provider-data.js';

const ASSETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/assets');
const GOOGLEBOT_TEST_ADDRESS = '66.249.66.87';

const originalFetch = global.fetch;

const removeAllProviders = () => {
  for (const provider of trustedProviders.getAllProviders()) {
    trustedProviders.deleteProvider(provider.name);
  }
};

const createJsonResponse = (body, overrides = {}) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify(body),
  ...overrides,
});

const createProvider = (name, reload) => ({
  name,
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
  reload,
});

describe('Reload integrity', () => {
  beforeEach(() => {
    removeAllProviders();
    trustedProviders.setLogLevel('silent');
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    trustedProviders.setLogLevel('error');
    await googlebot.reload();
  });

  describe('direct provider reloads', () => {
    test('reloadFromWeb() withdraws a cached trusted verdict', async () => {
      await googlebot.reload();
      trustedProviders.addProvider(googlebot);
      expect(trustedProviders.getTrustedProvider(GOOGLEBOT_TEST_ADDRESS)).toBe('Googlebot');

      global.fetch = jest.fn().mockResolvedValue(createJsonResponse({ prefixes: [{ ipv4Prefix: '198.51.100.0/24' }] }));
      await googlebot.reloadFromWeb();

      expect(trustedProviders.getTrustedProvider(GOOGLEBOT_TEST_ADDRESS)).toBeNull();
      expect(trustedProviders.getTrustedProvider('198.51.100.1')).toBe('Googlebot');
    });

    test('reload() restores a cached miss once the range returns', async () => {
      trustedProviders.addProvider(googlebot);
      global.fetch = jest.fn().mockResolvedValue(createJsonResponse({ prefixes: [{ ipv4Prefix: '198.51.100.0/24' }] }));
      await googlebot.reloadFromWeb();
      expect(trustedProviders.getTrustedProvider(GOOGLEBOT_TEST_ADDRESS)).toBeNull();

      await googlebot.reload();

      expect(trustedProviders.getTrustedProvider(GOOGLEBOT_TEST_ADDRESS)).toBe('Googlebot');
    });
  });

  describe('failed reloads keep previous data', () => {
    test.each([
      ['a null entry', { prefixes: [{ ipv4Prefix: '198.51.100.0/24' }, null] }],
      ['an entry with no prefix', { prefixes: [{ ipv4Prefix: '198.51.100.0/24' }, { service: 'x' }] }],
      ['an invalid CIDR', { prefixes: [{ ipv4Prefix: '198.51.100.0/24' }, { ipv4Prefix: '198.51.100.0/33' }] }],
      ['a wrong-family CIDR', { prefixes: [{ ipv4Prefix: '2001:db8::/32' }] }],
      ['an empty prefix list', { prefixes: [] }],
    ])('a web payload with %s is rejected without touching the ranges', async (_label, payload) => {
      await googlebot.reload();
      const ipv4Before = [...googlebot.ipv4.ranges];
      const ipv6Before = [...googlebot.ipv6.ranges];
      expect(ipv4Before.length).toBeGreaterThan(0);

      global.fetch = jest.fn().mockResolvedValue(createJsonResponse(payload));

      await expect(googlebot.reloadFromWeb()).rejects.toThrow();
      expect(googlebot.ipv4.ranges).toEqual(ipv4Before);
      expect(googlebot.ipv6.ranges).toEqual(ipv6Before);
    });

    test('replaceProviderData() rejects a late invalid entry without partial application', () => {
      const provider = createProvider('Snapshot');
      provider.ipv4.ranges.push('203.0.113.0/24');

      const snapshot = createEmptySnapshot();
      snapshot.ipv4.ranges = ['198.51.100.0/24', '192.0.2.0/24', 'bogus'];

      expect(() => replaceProviderData(provider, snapshot)).toThrow(/invalid entry "bogus"/);
      expect(provider.ipv4.ranges).toEqual(['203.0.113.0/24']);
    });

    test('replaceProviderData() keeps array identity', () => {
      const provider = createProvider('Identity');
      const rangesReference = provider.ipv4.ranges;

      const snapshot = createEmptySnapshot();
      snapshot.ipv4.ranges = ['198.51.100.0/24'];
      replaceProviderData(provider, snapshot);

      expect(provider.ipv4.ranges).toBe(rangesReference);
      expect(rangesReference).toEqual(['198.51.100.0/24']);
    });

    test('snapshotFromAddressList() rejects an invalid address anywhere in the list', () => {
      expect(() => snapshotFromAddressList(['192.0.2.1', '2001:db8::1', 'not-an-ip'])).toThrow(/invalid address/);
    });

    test('snapshotFromAddressList() sorts addresses by family', () => {
      const snapshot = snapshotFromAddressList(['192.0.2.1', '2001:db8::1']);

      expect(snapshot.ipv4.addresses).toEqual(['192.0.2.1']);
      expect(snapshot.ipv6.addresses).toEqual(['2001:db8::1']);
    });

    test('snapshotFromPrefixes() rejects a non-array', () => {
      expect(() => snapshotFromPrefixes('nope')).toThrow(/Expected a "prefixes" array/);
    });
  });

  describe('bundled asset checksums', () => {
    test('readVerifiedAsset() returns the contents of a matching asset', async () => {
      const contents = await readVerifiedAsset(path.join(ASSETS_DIR, 'googlebot-ips.json'), 'googlebot');

      expect(JSON.parse(contents).prefixes.length).toBeGreaterThan(0);
    });

    test('readVerifiedAsset() rejects an asset whose hash does not match', async () => {
      await expect(readVerifiedAsset(path.join(ASSETS_DIR, 'bunnynet-ip4s.json'), 'googlebot')).rejects.toThrow(
        /Checksum mismatch for googlebot/
      );
    });

    test('readVerifiedAsset() rejects an asset with no manifest entry', async () => {
      await expect(readVerifiedAsset(path.join(ASSETS_DIR, 'googlebot-ips.json'), 'no-such-key')).rejects.toThrow(
        /No checksum configured for no-such-key/
      );
    });
  });

  describe('HTTP deadline and size limit', () => {
    test('the timeout covers a body that stalls after the headers', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createJsonResponse(
          {},
          {
            text: () => new Promise((resolve) => setTimeout(() => resolve('{}'), 200)),
          }
        )
      );

      await expect(fetchJSON('https://example.invalid/data', { timeout: 20, retries: 0 })).rejects.toThrow(
        /Request timeout .* after 20ms/
      );
    });

    test('the request signal is aborted when the body overruns the deadline', async () => {
      let requestSignal;
      global.fetch = jest.fn().mockImplementation(async (_url, options) => {
        requestSignal = options.signal;
        return createJsonResponse({}, { text: () => new Promise((resolve) => setTimeout(() => resolve('{}'), 200)) });
      });

      await expect(fetchJSON('https://example.invalid/data', { timeout: 20, retries: 0 })).rejects.toThrow();
      expect(requestSignal.aborted).toBe(true);
    });

    test('a streamed body over the size limit is rejected', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('x'.repeat(2048)));

      await expect(fetchText('https://example.invalid/big', { maxResponseBytes: 1024, retries: 0 })).rejects.toThrow(
        /exceeds 1024 bytes/
      );
    });

    test('a declared content-length over the limit is rejected before reading', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(new Response('x', { headers: { 'content-length': String(10 * 1024 * 1024) } }));

      await expect(fetchText('https://example.invalid/big', { retries: 0 })).rejects.toThrow(/exceeds/);
    });

    test('a streamed body within the limit is returned', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('{"ok":true}'));

      await expect(fetchJSON('https://example.invalid/small', { retries: 0 })).resolves.toEqual({ ok: true });
    });

    test('a redirect to plain HTTP is rejected without retrying', async () => {
      global.fetch = jest.fn().mockResolvedValue(createJsonResponse({}, { url: 'http://example.invalid/data' }));

      await expect(fetchJSON('https://example.invalid/data', { retries: 2, retryDelay: 1 })).rejects.toThrow(
        /Insecure redirect rejected/
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('a certificate error wrapped in cause is not retried', async () => {
      const fetchError = new TypeError('fetch failed');
      fetchError.cause = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' });
      global.fetch = jest.fn().mockRejectedValue(fetchError);

      await expect(fetchJSON('https://example.invalid/data', { retries: 2, retryDelay: 1 })).rejects.toThrow(
        /SSL certificate validation failed/
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('reloadAll() outcomes', () => {
    test('a synchronous throw fails only that provider', async () => {
      let laterProviderRan = false;
      trustedProviders.addProvider(
        createProvider('Throws', () => {
          throw new Error('sync failure');
        })
      );
      trustedProviders.addProvider(
        createProvider('Later', async () => {
          laterProviderRan = true;
        })
      );

      const results = await trustedProviders.reloadAll();

      expect(laterProviderRan).toBe(true);
      expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled']);
      expect(results[0].reason.message).toBe('sync failure');
      expect(trustedProviders.getProviderStatus('Throws').state).toBe('error');
      expect(trustedProviders.getProviderStatus('Later').state).toBe('ready');
    });

    test('a reload returning nothing counts as success', async () => {
      trustedProviders.addProvider(createProvider('Sync', () => undefined));

      const results = await trustedProviders.reloadAll();

      expect(results[0].status).toBe('fulfilled');
      expect(trustedProviders.getProviderStatus('Sync').state).toBe('ready');
    });

    test.each([
      [
        'fails first',
        () => [Promise.reject(new Error('task failed')), new Promise((resolve) => setTimeout(resolve, 10))],
      ],
      [
        'fails last',
        () => [
          Promise.resolve(),
          new Promise((resolve, reject) => setTimeout(() => reject(new Error('task failed')), 10)),
        ],
      ],
    ])('a multi-task reload that %s ends in one failed state', async (_label, reload) => {
      const successEvents = [];
      const onSuccess = (payload) => successEvents.push(payload);
      trustedProviders.on('reload:success', onSuccess);
      trustedProviders.addProvider(createProvider('Multi', reload));

      try {
        const results = await trustedProviders.reloadAll();

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('rejected');
        const status = trustedProviders.getProviderStatus('Multi');
        expect(status.state).toBe('error');
        expect(status.lastError.message).toBe('task failed');
        expect(status.lastUpdated).toBeNull();
        expect(successEvents).toHaveLength(0);
      } finally {
        trustedProviders.off('reload:success', onSuccess);
      }
    });
  });

  describe('reload failure events', () => {
    test("'reload:error' listeners are notified and the original error is preserved", async () => {
      const originalError = new Error('upstream unavailable');
      const notifications = [];
      const onReloadError = (payload) => notifications.push(payload);
      trustedProviders.on('reload:error', onReloadError);
      trustedProviders.addProvider(
        createProvider('Failing', async () => {
          throw originalError;
        })
      );

      try {
        const results = await trustedProviders.reloadAll();

        expect(notifications).toHaveLength(1);
        expect(notifications[0].provider).toBe('Failing');
        expect(notifications[0].error).toBe(originalError);
        expect(results[0].reason).toBe(originalError);
      } finally {
        trustedProviders.off('reload:error', onReloadError);
      }
    });

    test("the deprecated 'error' event still reaches its listeners", async () => {
      const notifications = [];
      const onError = (payload) => notifications.push(payload);
      trustedProviders.on('error', onError);
      trustedProviders.addProvider(
        createProvider('Failing', async () => {
          throw new Error('upstream unavailable');
        })
      );

      try {
        await trustedProviders.reloadAll();
        expect(notifications).toHaveLength(1);
      } finally {
        trustedProviders.off('error', onError);
      }
    });

    test('a failed reload keeps the last-updated time of the previous success', async () => {
      let shouldFail = false;
      trustedProviders.addProvider(
        createProvider('Flaky', async () => {
          if (shouldFail) {
            throw new Error('flaky');
          }
        })
      );

      await trustedProviders.reloadAll();
      const lastUpdated = trustedProviders.getProviderStatus('Flaky').lastUpdated;
      expect(lastUpdated).not.toBeNull();

      shouldFail = true;
      await trustedProviders.reloadAll();

      expect(trustedProviders.getProviderStatus('Flaky').lastUpdated).toBe(lastUpdated);
      expect(trustedProviders.getProviderStatus('Flaky').state).toBe('error');
    });
  });
});
