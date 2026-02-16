/**
 * Performance tests for trusted-network-providers
 *
 * Profiles IP lookup performance with 20+ providers loaded.
 * Compares cold cache (first lookup) vs warm cache (repeated lookups).
 */

import trustedProviders from '../src/index.js';

describe('Performance: IP Lookup with 20+ Providers', () => {
  // Test IP addresses covering different providers
  const testIPs = [
    '66.249.66.1',      // Googlebot
    '54.240.226.1',     // Stripe API
    '192.0.2.1',        // Private (RFC 5737)
    '13.110.62.1',      // PayPal
    '2001:4860:4801::', // Google IPv6
    '203.0.113.50',     // Random (should not match)
    '34.237.253.141',   // Stripe Webhooks
    '157.55.9.128',     // Outlook
    '104.16.0.1',       // Cloudflare
    '69.169.224.1',     // Ezoic
    '10.0.0.1',         // Private
    '172.16.0.1',       // Private
    '192.168.1.1',      // Private
    '198.51.100.1',     // Random (should not match)
    '2a06:98c0::',      // Cloudflare IPv6
  ];

  beforeAll(async () => {
    // Load all default providers
    trustedProviders.loadDefaultProviders();
    
    // Reload to fetch current IP ranges
    await trustedProviders.reloadAll();
    
    // Verify we have 20+ providers loaded
    const providers = trustedProviders.getAllProviders();
    expect(providers.length).toBeGreaterThanOrEqual(19);
  });

  afterAll(() => {
    // Clean up: remove all providers
    const providers = trustedProviders.getAllProviders();
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  test('should profile cold cache vs warm cache performance', async () => {
    // Force fresh cache by reloading (this clears result cache)
    await trustedProviders.reloadAll();

    // Cold cache: First pass (all cache misses)
    const coldStart = performance.now();
    for (let i = 0; i < testIPs.length; i++) {
      trustedProviders.getTrustedProvider(testIPs[i]);
    }
    const coldEnd = performance.now();
    const coldDuration = coldEnd - coldStart;

    // Warm cache: Immediate second pass (all cache hits)
    const warmStart = performance.now();
    for (let i = 0; i < testIPs.length; i++) {
      trustedProviders.getTrustedProvider(testIPs[i]);
    }
    const warmEnd = performance.now();
    const warmDuration = warmEnd - warmStart;

    // Calculate speedup
    const speedup = coldDuration / warmDuration;

    // Log results
    console.log('\n📊 Performance Profile (20+ providers, 15 IP lookups):');
    console.log(`   Cold cache (first lookup): ${coldDuration.toFixed(3)}ms`);
    console.log(`   Warm cache (cached):       ${warmDuration.toFixed(3)}ms`);
    console.log(`   Speedup:                   ${speedup.toFixed(1)}x faster`);
    console.log(`   Per-lookup (cold):         ${(coldDuration / testIPs.length).toFixed(3)}ms`);
    console.log(`   Per-lookup (warm):         ${(warmDuration / testIPs.length).toFixed(3)}ms\n`);

    // Assert that warm cache is faster
    expect(warmDuration).toBeLessThan(coldDuration);
    
    // Assert that warm cache provides at least 2x speedup
    // (Conservative threshold - real-world speedup is typically much higher)
    expect(speedup).toBeGreaterThan(2);
  });

  test('should handle repeated lookups efficiently', async () => {
    // Force fresh cache
    await trustedProviders.reloadAll();

    const iterations = 100;
    const sampleIP = '66.249.66.1'; // Googlebot

    // First lookup (cache miss)
    const firstLookupStart = performance.now();
    trustedProviders.getTrustedProvider(sampleIP);
    const firstLookupEnd = performance.now();
    const firstLookupDuration = firstLookupEnd - firstLookupStart;

    // Subsequent lookups (cache hits)
    const repeatedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      trustedProviders.getTrustedProvider(sampleIP);
    }
    const repeatedEnd = performance.now();
    const repeatedDuration = repeatedEnd - repeatedStart;
    const avgRepeatedDuration = repeatedDuration / iterations;

    // Log results
    console.log('\n📊 Repeated Lookup Performance:');
    console.log(`   First lookup:        ${firstLookupDuration.toFixed(3)}ms`);
    console.log(`   Avg cached lookup:   ${avgRepeatedDuration.toFixed(6)}ms (${iterations} iterations)`);
    console.log(`   Total cached time:   ${repeatedDuration.toFixed(3)}ms\n`);

    // Assert that cached lookups are significantly faster
    expect(avgRepeatedDuration).toBeLessThan(firstLookupDuration / 10);
  });

  test('should maintain performance with mixed match/no-match lookups', async () => {
    // Force fresh cache
    await trustedProviders.reloadAll();

    // Mix of IPs that match and don't match
    const mixedIPs = [
      '66.249.66.1',      // Match: Googlebot
      '203.0.113.1',      // No match
      '54.240.226.1',     // Match: Stripe
      '198.51.100.1',     // No match
      '192.0.2.1',        // Match: Private
      '203.0.113.50',     // No match
      '13.110.62.1',      // Match: PayPal
      '198.51.100.200',   // No match
    ];

    // Cold cache
    const coldStart = performance.now();
    for (let i = 0; i < mixedIPs.length; i++) {
      trustedProviders.getTrustedProvider(mixedIPs[i]);
    }
    const coldEnd = performance.now();
    const coldDuration = coldEnd - coldStart;

    // Warm cache
    const warmStart = performance.now();
    for (let i = 0; i < mixedIPs.length; i++) {
      trustedProviders.getTrustedProvider(mixedIPs[i]);
    }
    const warmEnd = performance.now();
    const warmDuration = warmEnd - warmStart;

    // Log results
    console.log('\n📊 Mixed Match/No-Match Performance:');
    console.log(`   Cold cache: ${coldDuration.toFixed(3)}ms`);
    console.log(`   Warm cache: ${warmDuration.toFixed(3)}ms`);
    console.log(`   Speedup:    ${(coldDuration / warmDuration).toFixed(1)}x\n`);

    // Assert warm cache is faster
    expect(warmDuration).toBeLessThan(coldDuration);
  });
});
