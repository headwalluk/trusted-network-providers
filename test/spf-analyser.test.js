/**
 * Tests for spf-analyser.js
 *
 * Covers the SPF record parsing and IP extraction logic with:
 * - SPF record resolution
 * - IPv4 and IPv6 address extraction
 * - CIDR range extraction
 * - Include directive handling
 * - Error handling for DNS failures
 * - Edge cases and invalid records
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock DNS before importing the module under test
const mockResolveTxt = jest.fn();

jest.unstable_mockModule('node:dns/promises', () => ({
  default: {
    resolveTxt: mockResolveTxt,
  },
}));

// Import the module under test AFTER setting up the mock
const { default: spfAnalyser } = await import('../src/spf-analyser.js');
import logger from '../src/utils/logger.js';

describe('spfAnalyser', () => {
  let mockProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock provider structure
    mockProvider = {
      name: 'test-provider',
      ipv4: {
        addresses: [],
        ranges: [],
      },
      ipv6: {
        addresses: [],
        ranges: [],
      },
    };
  });

  describe('happy path', () => {
    it('should extract IPv4 addresses from SPF records', async () => {
      // Main domain SPF record
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      // Include domain SPF record with IPv4
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ip4:198.51.100.5 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1', '198.51.100.5']);
      expect(mockProvider.ipv4.ranges).toEqual([]);
      expect(mockProvider.ipv6.addresses).toEqual([]);
      expect(mockProvider.ipv6.ranges).toEqual([]);
    });

    it('should extract IPv4 CIDR ranges from SPF records', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.0/24 ip4:198.51.100.0/28 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual([]);
      expect(mockProvider.ipv4.ranges).toEqual(['192.0.2.0/24', '198.51.100.0/28']);
    });

    it('should extract IPv6 addresses from SPF records', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip6:2001:db8::1 ip6:2001:db8::2 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual([]);
      expect(mockProvider.ipv4.ranges).toEqual([]);
      expect(mockProvider.ipv6.addresses).toEqual(['2001:db8::1', '2001:db8::2']);
      expect(mockProvider.ipv6.ranges).toEqual([]);
    });

    it('should extract IPv6 CIDR ranges from SPF records', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip6:2001:db8::/32 ip6:2001:db8:1::/48 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv6.addresses).toEqual([]);
      expect(mockProvider.ipv6.ranges).toEqual(['2001:db8::/32', '2001:db8:1::/48']);
    });

    it('should extract mixed IPv4 and IPv6 addresses', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([
        ['v=spf1 ip4:192.0.2.1 ip4:198.51.100.0/24 ip6:2001:db8::1 ip6:2001:db8::/32 ~all'],
      ]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
      expect(mockProvider.ipv4.ranges).toEqual(['198.51.100.0/24']);
      expect(mockProvider.ipv6.addresses).toEqual(['2001:db8::1']);
      expect(mockProvider.ipv6.ranges).toEqual(['2001:db8::/32']);
    });

    it('should handle multiple include directives', async () => {
      // Main domain with two includes
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf1.example.com include:_spf2.example.com ~all']]);

      // First include
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      // Second include
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:198.51.100.5 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1', '198.51.100.5']);
    });

    it('should deduplicate include directives', async () => {
      // Main domain with duplicate includes
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com include:_spf.example.com ~all']]);

      // Include domain (should only be resolved once)
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
      // Should only call resolveTxt twice (main + one include), not three times
      expect(mockResolveTxt).toHaveBeenCalledTimes(2);
    });

    it('should extract IPs written inline on the root record, with no includes', async () => {
      // The shape _spf.google.com uses: directives inline, nothing to include
      mockResolveTxt.mockResolvedValueOnce([
        ['v=spf1 ip4:74.125.0.0/16 ip4:209.85.128.0/17 ip6:2001:4860:4864::/56 ~all'],
      ]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.ranges).toEqual(['74.125.0.0/16', '209.85.128.0/17']);
      expect(mockProvider.ipv6.ranges).toEqual(['2001:4860:4864::/56']);
      expect(mockResolveTxt).toHaveBeenCalledTimes(1); // No includes to follow
    });

    it('should follow includes nested inside includes', async () => {
      // The shape mailgun.org uses: root -> _spf -> _spf1/_spf2, IPs only at the leaves
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf1.example.com include:_spf2.example.com ~all']]);
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.0/24 ~all']]);
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:198.51.100.0/24 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.ranges).toEqual(['192.0.2.0/24', '198.51.100.0/24']);
      expect(mockResolveTxt).toHaveBeenCalledTimes(4); // root + _spf + _spf1 + _spf2
    });

    it('should stop at the RFC 7208 ten-lookup limit rather than chase a loop', async () => {
      // Each record includes the next, forever; the guard must cut it off.
      mockResolveTxt.mockImplementation((domain) => {
        const depth = Number(String(domain).replace(/\D/g, '') || 0);
        return Promise.resolve([[`v=spf1 ip4:192.0.2.${depth} include:_spf${depth + 1}.example.com ~all`]]);
      });

      await spfAnalyser('_spf0.example.com', mockProvider);

      // The root lookup plus at most 10 include lookups.
      expect(mockResolveTxt.mock.calls.length).toBeLessThanOrEqual(11);
      expect(mockProvider.ipv4.addresses.length).toBeGreaterThan(0);
    });

    it('should combine inline root IPs with those from includes', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:198.51.100.5 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1', '198.51.100.5']);
    });
  });

  describe('provider mutation', () => {
    it('should clear existing provider data before adding new data', async () => {
      // Pre-populate provider with existing data
      mockProvider.ipv4.addresses = ['old-ipv4-address'];
      mockProvider.ipv4.ranges = ['old-ipv4-range'];
      mockProvider.ipv6.addresses = ['old-ipv6-address'];
      mockProvider.ipv6.ranges = ['old-ipv6-range'];

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
      expect(mockProvider.ipv4.ranges).toEqual([]);
      expect(mockProvider.ipv6.addresses).toEqual([]);
      expect(mockProvider.ipv6.ranges).toEqual([]);
    });

    it('should keep existing data when a record yields no IPs', async () => {
      mockProvider.ipv4.ranges = ['198.51.100.0/24'];

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      // An empty provider silently reports every address as untrusted, so the
      // previous data is kept rather than replaced with nothing.
      expect(mockProvider.ipv4.ranges).toEqual(['198.51.100.0/24']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty SPF records', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual([]);
      expect(mockProvider.ipv4.ranges).toEqual([]);
      expect(mockProvider.ipv6.addresses).toEqual([]);
      expect(mockProvider.ipv6.ranges).toEqual([]);
    });

    it('should report, at the default log level, when no SPF netblocks are found', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(consoleSpy).toHaveBeenCalledWith('Not updating test-provider addresses because no SPF netblocks found');
      expect(mockResolveTxt).toHaveBeenCalledTimes(1); // Only main domain, no includes

      consoleSpy.mockRestore();
    });

    it('should handle TXT records that are not SPF records', async () => {
      mockResolveTxt.mockResolvedValueOnce([
        ['some-other-txt-record'],
        ['google-site-verification=random-token'],
        ['v=spf1 include:_spf.example.com ~all'],
      ]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
    });

    it('should handle simple array wrapped TXT records', async () => {
      // DNS returns records as array of arrays, each inner array contains strings
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
    });

    it('should handle split TXT records (long records)', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      // Some DNS responses split long TXT records into multiple strings in the inner array
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ', 'ip4:192.0.2.1 ', 'ip4:198.51.100.5 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1', '198.51.100.5']);
    });

    it('should skip include directives with invalid format', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:too:many:colons include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      await spfAnalyser('example.com', mockProvider);

      // Only the valid include should be processed (too:many:colons has >2 components)
      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
      expect(mockResolveTxt).toHaveBeenCalledTimes(2); // Main domain + one valid include
    });

    it('should handle IP directives with missing values (edge case)', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4: ip4:192.0.2.1 ip6: ~all']]);

      await spfAnalyser('example.com', mockProvider);

      // Current implementation does not validate empty values
      // ip4: with no value results in empty string being added
      expect(mockProvider.ipv4.addresses).toContain('192.0.2.1');
      expect(mockProvider.ipv4.addresses).toContain(''); // Empty string from ip4:
      expect(mockProvider.ipv6.addresses).toContain(''); // Empty string from ip6:
    });
  });

  describe('error handling', () => {
    it('should throw on DNS resolution failure', async () => {
      const dnsError = new Error('ENOTFOUND');
      mockResolveTxt.mockRejectedValueOnce(dnsError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(spfAnalyser('example.com', mockProvider)).rejects.toThrow('ENOTFOUND');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to analyse SPF records for test-provider: ENOTFOUND');

      consoleSpy.mockRestore();
    });

    it('should log error when include resolution fails but continue gracefully', async () => {
      // Main domain resolves successfully
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      // Include domain fails
      mockResolveTxt.mockRejectedValueOnce(new Error('DNS timeout'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should NOT throw - should complete gracefully with empty results
      await spfAnalyser('example.com', mockProvider);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to resolve SPF include _spf.example.com for test-provider: DNS timeout'
      );

      // Provider should have empty results (no successful DNS lookups)
      expect(mockProvider.ipv4.addresses).toEqual([]);
      expect(mockProvider.ipv4.ranges).toEqual([]);
      expect(mockProvider.ipv6.addresses).toEqual([]);
      expect(mockProvider.ipv6.ranges).toEqual([]);

      consoleSpy.mockRestore();
    });

    it('should handle partial include resolution failures gracefully', async () => {
      // Main domain with two includes
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf1.example.com include:_spf2.example.com ~all']]);

      // First include succeeds, second fails
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ~all']]);

      mockResolveTxt.mockRejectedValueOnce(new Error('Include resolution failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should NOT throw - should continue with partial results
      await spfAnalyser('example.com', mockProvider);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to resolve SPF include _spf2.example.com for test-provider: Include resolution failed'
      );

      // Should have results from the successful include only
      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
      expect(mockProvider.ipv4.ranges).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('SPF record format variations', () => {
    it('should handle SPF records without trailing ~all', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com']]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1']]);

      await spfAnalyser('example.com', mockProvider);

      expect(mockProvider.ipv4.addresses).toEqual(['192.0.2.1']);
    });

    it('should handle SPF records with different all qualifiers', async () => {
      mockResolveTxt.mockResolvedValueOnce([
        ['v=spf1 include:_spf.example.com -all'], // fail all qualifier
      ]);

      mockResolveTxt.mockResolvedValueOnce([['v=spf1 ip4:192.0.2.1 ip4:198.51.100.5 -all']]);

      await spfAnalyser('example.com', mockProvider);

      // Different all qualifiers (-all, ~all, ?all, +all) should not affect IP extraction
      expect(mockProvider.ipv4.addresses).toContain('192.0.2.1');
      expect(mockProvider.ipv4.addresses).toContain('198.51.100.5');
    });

    it('should only process records starting with v=spf1', async () => {
      mockResolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.example.com ~all']]);

      mockResolveTxt.mockResolvedValueOnce([
        ['v=spf2 ip4:192.0.2.1 ~all'], // Future SPF version (not v=spf1)
        ['v=spf1 ip4:198.51.100.5 ~all'], // Valid
      ]);

      await spfAnalyser('example.com', mockProvider);

      // Only the v=spf1 record should be processed
      expect(mockProvider.ipv4.addresses).toEqual(['198.51.100.5']);
    });
  });
});
