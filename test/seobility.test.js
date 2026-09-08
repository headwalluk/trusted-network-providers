/**
 * Seobility Provider Tests
 *
 * Covers the bots.json feed shape, which mixes bare host addresses with CIDR
 * blocks under the same ipv4Prefix/ipv6Prefix keys.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import seobility from '../src/providers/seobility.js';
import logger from '../src/utils/logger.js';

const originalFetch = global.fetch;

const createMockResponse = (body) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify(body),
});

describe('Seobility Provider', () => {
  beforeEach(() => {
    seobility.ipv4 = { addresses: [], ranges: [] };
    seobility.ipv6 = { addresses: [], ranges: [] };
    logger.setLevel('silent');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    logger.setLevel('error');
  });

  test('should route bare addresses and CIDR blocks separately', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createMockResponse({
        prefixes: [
          { ipv4Prefix: '116.202.182.111' },
          { ipv4Prefix: '192.0.2.0/24' },
          { ipv6Prefix: '2a01:4f8:1c0c:4018::1' },
          { ipv6Prefix: '2001:db8::/32' },
        ],
      })
    );

    await seobility.reload();

    expect(seobility.ipv4.addresses).toEqual(['116.202.182.111']);
    expect(seobility.ipv4.ranges).toEqual(['192.0.2.0/24']);
    expect(seobility.ipv6.addresses).toEqual(['2a01:4f8:1c0c:4018::1']);
    expect(seobility.ipv6.ranges).toEqual(['2001:db8::/32']);
  });

  test('should replace previous data rather than append', async () => {
    seobility.ipv4.addresses.push('198.51.100.1');

    global.fetch = jest.fn().mockResolvedValue(createMockResponse({ prefixes: [{ ipv4Prefix: '116.202.182.111' }] }));

    await seobility.reload();

    expect(seobility.ipv4.addresses).toEqual(['116.202.182.111']);
  });

  test('should reject a payload with no prefixes array', async () => {
    global.fetch = jest.fn().mockResolvedValue(createMockResponse({ something: 'else' }));

    await expect(seobility.reload()).rejects.toThrow(/Structure verification failed/);
  });

  test('should reject an empty prefixes array rather than emptying the provider', async () => {
    global.fetch = jest.fn().mockResolvedValue(createMockResponse({ prefixes: [] }));

    await expect(seobility.reload()).rejects.toThrow(/Structure verification failed/);
  });
});
