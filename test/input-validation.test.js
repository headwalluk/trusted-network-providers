/**
 * Input validation tests
 *
 * Tests for provider input validation:
 * - Max providers limit
 * - Max IPs per provider limit
 * - CIDR range validation
 */

import trustedProviders from '../src/index.js';

describe('Input Validation', () => {
  beforeEach(() => {
    // Clean slate - remove all providers
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

  describe('Provider Count Limit', () => {
    test('should reject adding provider when max providers limit is reached', () => {
      // Add providers up to the limit (100)
      for (let i = 0; i < 100; i++) {
        const provider = {
          name: `Provider ${i}`,
          ipv4: {
            addresses: ['192.0.2.1'],
            ranges: [],
          },
          ipv6: {
            addresses: [],
            ranges: [],
          },
        };
        trustedProviders.addProvider(provider);
      }

      expect(trustedProviders.getAllProviders().length).toBe(100);

      // Attempt to add 101st provider should throw
      const overLimitProvider = {
        name: 'Over Limit Provider',
        ipv4: {
          addresses: ['192.0.2.2'],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(overLimitProvider);
      }).toThrow(/Maximum provider limit reached \(100\)/);
    });

    test('should allow adding provider when under the limit', () => {
      const provider = {
        name: 'Valid Provider',
        ipv4: {
          addresses: ['192.0.2.1'],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Valid Provider')).toBe(true);
    });
  });

  describe('IPs Per Provider Limit', () => {
    test('should reject provider exceeding max IPs limit (addresses only)', () => {
      const addresses = Array.from({ length: 10001 }, (_, i) => `192.0.${Math.floor(i / 256)}.${i % 256}`);

      const provider = {
        name: 'Too Many IPs',
        ipv4: {
          addresses,
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/exceeds maximum IP limit \(10000\)/);
    });

    test('should reject provider exceeding max IPs limit (ranges only)', () => {
      const ranges = Array.from(
        { length: 10001 },
        (_, i) => `10.${Math.floor(i / 65536)}.${Math.floor((i % 65536) / 256)}.0/24`
      );

      const provider = {
        name: 'Too Many Ranges',
        ipv4: {
          addresses: [],
          ranges,
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/exceeds maximum IP limit \(10000\)/);
    });

    test('should reject provider exceeding max IPs limit (combined addresses and ranges)', () => {
      const ipv4Addresses = Array.from({ length: 5000 }, (_, i) => `192.0.${Math.floor(i / 256)}.${i % 256}`);
      const ipv4Ranges = Array.from({ length: 3000 }, (_, i) => `10.${Math.floor(i / 256)}.${i % 256}.0/24`);
      const ipv6Addresses = Array.from({ length: 2000 }, (_, i) => `2001:db8::${i}`);
      const ipv6Ranges = Array.from({ length: 2 }, (_, i) => `2001:db${i}::/32`);

      const provider = {
        name: 'Combined Too Many',
        ipv4: {
          addresses: ipv4Addresses,
          ranges: ipv4Ranges,
        },
        ipv6: {
          addresses: ipv6Addresses,
          ranges: ipv6Ranges,
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/exceeds maximum IP limit \(10000\)/);
    });

    test('should allow provider at exactly the max IPs limit', () => {
      const addresses = Array.from({ length: 10000 }, (_, i) => `192.0.${Math.floor(i / 256)}.${i % 256}`);

      const provider = {
        name: 'Exactly At Limit',
        ipv4: {
          addresses,
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Exactly At Limit')).toBe(true);
    });

    test('should allow provider under the max IPs limit', () => {
      const provider = {
        name: 'Under Limit',
        ipv4: {
          addresses: ['192.0.2.1', '192.0.2.2'],
          ranges: ['198.51.100.0/24'],
        },
        ipv6: {
          addresses: ['2001:db8::1'],
          ranges: ['2001:db8::/32'],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Under Limit')).toBe(true);
    });
  });

  describe('CIDR Validation', () => {
    test('should reject provider with invalid IPv4 CIDR range', () => {
      const provider = {
        name: 'Invalid IPv4 CIDR',
        ipv4: {
          addresses: [],
          ranges: ['192.0.2.0/33'], // Invalid prefix length
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/contains invalid CIDR ranges: 192\.0\.2\.0\/33/);
    });

    test('should reject provider with invalid IPv6 CIDR range', () => {
      const provider = {
        name: 'Invalid IPv6 CIDR',
        ipv4: {
          addresses: [],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: ['2001:db8::/129'], // Invalid prefix length
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/contains invalid CIDR ranges: 2001:db8::\/129/);
    });

    test('should reject provider with malformed CIDR range', () => {
      const provider = {
        name: 'Malformed CIDR',
        ipv4: {
          addresses: [],
          ranges: ['not-a-cidr'], // Malformed CIDR
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/contains invalid CIDR ranges: not-a-cidr/);
    });

    test('should reject provider with multiple invalid CIDR ranges', () => {
      const provider = {
        name: 'Multiple Invalid',
        ipv4: {
          addresses: [],
          ranges: ['192.0.2.0/33', '10.0.0.0/8', '172.16.0.0/35'],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).toThrow(/contains invalid CIDR ranges.*192\.0\.2\.0\/33.*172\.16\.0\.0\/35/);
    });

    test('should accept provider with valid IPv4 CIDR ranges', () => {
      const provider = {
        name: 'Valid IPv4 CIDR',
        ipv4: {
          addresses: [],
          ranges: ['192.0.2.0/24', '10.0.0.0/8', '172.16.0.0/12'],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Valid IPv4 CIDR')).toBe(true);
    });

    test('should accept provider with valid IPv6 CIDR ranges', () => {
      const provider = {
        name: 'Valid IPv6 CIDR',
        ipv4: {
          addresses: [],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: ['2001:db8::/32', 'fe80::/10', '::1/128'],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Valid IPv6 CIDR')).toBe(true);
    });

    test('should accept provider with valid mixed IPv4 and IPv6 CIDR ranges', () => {
      const provider = {
        name: 'Valid Mixed CIDR',
        ipv4: {
          addresses: ['192.0.2.1'],
          ranges: ['198.51.100.0/24'],
        },
        ipv6: {
          addresses: ['2001:db8::1'],
          ranges: ['2001:db8::/32'],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Valid Mixed CIDR')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle provider with missing ipv4 object gracefully', () => {
      const provider = {
        name: 'No IPv4',
        ipv6: {
          addresses: ['2001:db8::1'],
          ranges: ['2001:db8::/32'],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('No IPv4')).toBe(true);
    });

    test('should handle provider with missing ipv6 object gracefully', () => {
      const provider = {
        name: 'No IPv6',
        ipv4: {
          addresses: ['192.0.2.1'],
          ranges: ['198.51.100.0/24'],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('No IPv6')).toBe(true);
    });

    test('should handle provider with empty arrays gracefully', () => {
      const provider = {
        name: 'Empty Arrays',
        ipv4: {
          addresses: [],
          ranges: [],
        },
        ipv6: {
          addresses: [],
          ranges: [],
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Empty Arrays')).toBe(true);
    });

    test('should handle provider with undefined addresses/ranges gracefully', () => {
      const provider = {
        name: 'Undefined Fields',
        ipv4: {
          addresses: undefined,
          ranges: undefined,
        },
        ipv6: {
          addresses: undefined,
          ranges: undefined,
        },
      };

      expect(() => {
        trustedProviders.addProvider(provider);
      }).not.toThrow();

      expect(trustedProviders.hasProvider('Undefined Fields')).toBe(true);
    });
  });
});
