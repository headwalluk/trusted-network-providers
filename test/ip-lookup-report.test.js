/**
 * IP Lookup Report
 *
 * Loads all default providers, runs every testAddress through getTrustedProvider(),
 * and prints a per-IP report. This gives visible confirmation that IP lookups work
 * correctly — similar to the old runTests() output.
 */

import trustedProviders from '../src/index.js';

describe('IP Lookup Report', () => {
  beforeAll(async () => {
    trustedProviders.loadDefaultProviders();
    await trustedProviders.reloadAll();
  });

  afterAll(() => {
    const providers = trustedProviders.getAllProviders();
    providers.forEach((p) => trustedProviders.deleteProvider(p.name));
  });

  test('all provider test addresses should resolve correctly', () => {
    const providers = trustedProviders.getAllProviders();
    let passed = 0;
    let failed = 0;

    console.log('');
    console.log('  IP Lookup Report');
    console.log('  ================');
    console.log('');

    for (const provider of providers) {
      if (!Array.isArray(provider.testAddresses) || provider.testAddresses.length === 0) {
        console.log(`  -- ${provider.name} (no test addresses)`);
        continue;
      }

      for (const ip of provider.testAddresses) {
        const result = trustedProviders.getTrustedProvider(ip);
        if (result === provider.name) {
          console.log(`  \u2705 ${ip} \u2192 ${result}`);
          passed++;
        } else {
          console.log(`  \u274c ${ip} \u2192 ${result} (expected ${provider.name})`);
          failed++;
        }
        expect(result).toBe(provider.name);
      }
    }

    console.log('');
    console.log(`  Results: ${passed} passed, ${failed} failed, ${providers.length} providers`);
    console.log('');
  });

  test('known-untrusted IPs should return null', () => {
    const untrustedIPs = ['192.42.116.182', '123.123.123.123', '1.1.1.1', '9.9.9.9', '203.0.113.50'];

    console.log('');
    console.log('  Untrusted IP Verification');
    console.log('  =========================');
    console.log('');

    for (const ip of untrustedIPs) {
      const result = trustedProviders.getTrustedProvider(ip);
      if (result === null) {
        console.log(`  \u2705 ${ip} \u2192 null (correctly untrusted)`);
      } else {
        console.log(`  \u274c ${ip} \u2192 ${result} (should be null)`);
      }
      expect(result).toBeNull();
    }

    console.log('');
  });
});
