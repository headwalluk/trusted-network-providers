/**
 * Public DNS resolver providers: Cloudflare DNS, OpenDNS, Quad9 and Google Services.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import trustedProviders from '../src/index.js';
import cloudflareDns from '../src/providers/cloudflare-dns.js';
import openDns from '../src/providers/opendns.js';
import googleServices from '../src/providers/google-services.js';
import quad9 from '../src/providers/quad9.js';

const clearRegistry = () => {
  for (const registeredProvider of trustedProviders.getAllProviders()) {
    trustedProviders.deleteProvider(registeredProvider.name);
  }
};

describe('Public DNS resolver providers', () => {
  beforeEach(() => {
    clearRegistry();
    trustedProviders.loadDefaultProviders();
  });

  afterEach(() => {
    clearRegistry();
  });

  test.each([
    [cloudflareDns, 'Cloudflare DNS'],
    [openDns, 'OpenDNS'],
    [quad9, 'Quad9'],
    [googleServices, 'Google Services'],
  ])('%#: every test address of %s resolves to it with default providers loaded', (provider, expectedName) => {
    for (const testAddress of provider.testAddresses) {
      expect(trustedProviders.getTrustedProvider(testAddress)).toBe(expectedName);
    }
  });

  test('Cloudflare DNS IPv6 wins over the enclosing Cloudflare CDN range', () => {
    expect(trustedProviders.getTrustedProvider('2606:4700:4700::1111')).toBe('Cloudflare DNS');
    expect(trustedProviders.getTrustedProvider('2606:4700::6810:1')).toBe('Cloudflare');
  });

  test('Cloudflare CDN addresses are not reported as Cloudflare DNS', () => {
    expect(trustedProviders.getTrustedProvider('104.16.0.1')).toBe('Cloudflare');
  });

  test('neighbouring OpenDNS-owned space outside the resolver /24s stays untrusted', () => {
    expect(trustedProviders.getTrustedProvider('208.67.216.1')).toBeNull();
  });

  test('addresses just outside the Quad9 /24 stay untrusted', () => {
    expect(trustedProviders.getTrustedProvider('9.9.10.1')).toBeNull();
    expect(trustedProviders.getTrustedProvider('149.112.113.1')).toBeNull();
  });
});
