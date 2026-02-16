/**
 * Functional Provider Tests
 *
 * Tests that actually exercise provider code through the main library.
 * Loads providers, performs IP lookups, and verifies runtime behavior.
 */

import trustedProviders from '../src/index.js';
import ahrefsbot from '../src/providers/ahrefsbot.js';
import brevo from '../src/providers/brevo.js';
import cloudflare from '../src/providers/cloudflare.js';
import ezoic from '../src/providers/ezoic.js';
import labrika from '../src/providers/labrika.js';
import opayo from '../src/providers/opayo.js';
import outlook from '../src/providers/outlook.js';
import paypal from '../src/providers/paypal.js';
import privateIPs from '../src/providers/private.js';
import semrush from '../src/providers/semrush.js';
import shipHero from '../src/providers/ship-hero.js';

describe('Functional Provider Tests', () => {
  beforeEach(() => {
    // Clear all providers before each test
    const providers = trustedProviders.getAllProviders();
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  describe('AhrefsBot - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(ahrefsbot);

      ahrefsbot.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('AhrefsBot');
      });
    });

    test('should return null for non-Ahrefs IPs', () => {
      trustedProviders.addProvider(ahrefsbot);

      const result = trustedProviders.getTrustedProvider('1.1.1.1');
      expect(result).toBeNull();
    });

    test('isTrusted should return boolean', () => {
      trustedProviders.addProvider(ahrefsbot);

      ahrefsbot.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.isTrusted(testAddr);
        expect(result).toBe(true);
      });

      expect(trustedProviders.isTrusted('1.1.1.1')).toBe(false);
    });
  });

  describe('Brevo - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(brevo);

      brevo.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Brevo');
      });
    });

    test('should return null for non-Brevo IPs', () => {
      trustedProviders.addProvider(brevo);

      const result = trustedProviders.getTrustedProvider('8.8.8.8');
      expect(result).toBeNull();
    });
  });

  describe('Cloudflare - Runtime Tests', () => {
    test('should load and correctly identify IPv4 test addresses', () => {
      trustedProviders.addProvider(cloudflare);

      const ipv4TestAddresses = cloudflare.testAddresses.filter((addr) => addr.includes('.'));
      ipv4TestAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Cloudflare');
      });
    });

    test('should load and correctly identify IPv6 test addresses', () => {
      trustedProviders.addProvider(cloudflare);

      const ipv6TestAddresses = cloudflare.testAddresses.filter((addr) => addr.includes(':'));
      ipv6TestAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Cloudflare');
      });
    });

    test('should return null for non-Cloudflare IPs', () => {
      trustedProviders.addProvider(cloudflare);

      expect(trustedProviders.getTrustedProvider('1.0.0.1')).toBeNull();
      expect(trustedProviders.getTrustedProvider('2001:db8::1')).toBeNull();
    });
  });

  describe('Ezoic - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(ezoic);

      ezoic.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Ezoic');
      });
    });

    test('should use address list (not ranges)', () => {
      expect(ezoic.ipv4.addresses.length).toBeGreaterThan(0);
      expect(ezoic.ipv4.ranges.length).toBe(0);
    });
  });

  describe('Labrika - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(labrika);

      labrika.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Labrika');
      });
    });

    test('should use address list (not ranges)', () => {
      expect(labrika.ipv4.addresses.length).toBeGreaterThan(0);
      expect(labrika.ipv4.ranges.length).toBe(0);
    });
  });

  describe('Opayo - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(opayo);

      opayo.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Opayo');
      });
    });

    test('should return null for non-Opayo IPs', () => {
      trustedProviders.addProvider(opayo);

      const result = trustedProviders.getTrustedProvider('9.9.9.9');
      expect(result).toBeNull();
    });
  });

  describe('MS Outlook - Runtime Tests', () => {
    test('should load and correctly identify IPv4 test addresses', () => {
      trustedProviders.addProvider(outlook);

      const ipv4TestAddresses = outlook.testAddresses.filter((addr) => addr.includes('.'));
      ipv4TestAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('MS Outlook');
      });
    });

    test('should load and correctly identify IPv6 test addresses', () => {
      trustedProviders.addProvider(outlook);

      const ipv6TestAddresses = outlook.testAddresses.filter((addr) => addr.includes(':'));
      ipv6TestAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('MS Outlook');
      });
    });

    test('should return null for non-Outlook IPs', () => {
      trustedProviders.addProvider(outlook);

      expect(trustedProviders.getTrustedProvider('10.0.0.1')).toBeNull();
    });
  });

  describe('PayPal - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(paypal);

      paypal.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('PayPal');
      });
    });

    test('should return null for non-PayPal IPs', () => {
      trustedProviders.addProvider(paypal);

      const result = trustedProviders.getTrustedProvider('192.168.1.1');
      expect(result).toBeNull();
    });
  });

  describe('Private IPs - Runtime Tests', () => {
    test('should load and correctly identify IPv4 private ranges', () => {
      trustedProviders.addProvider(privateIPs);

      privateIPs.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Private');
      });
    });

    test('should identify common private IPs', () => {
      trustedProviders.addProvider(privateIPs);

      // 10.0.0.0/8
      expect(trustedProviders.getTrustedProvider('10.1.2.3')).toBe('Private');

      // 172.16.0.0/12
      expect(trustedProviders.getTrustedProvider('172.16.0.1')).toBe('Private');
      expect(trustedProviders.getTrustedProvider('172.31.255.254')).toBe('Private');

      // 192.168.0.0/16
      expect(trustedProviders.getTrustedProvider('192.168.0.1')).toBe('Private');
      expect(trustedProviders.getTrustedProvider('192.168.255.255')).toBe('Private');
    });

    test('should identify loopback addresses', () => {
      trustedProviders.addProvider(privateIPs);

      expect(trustedProviders.getTrustedProvider('127.0.0.1')).toBe('Private');
      expect(trustedProviders.getTrustedProvider('127.255.255.255')).toBe('Private');
    });

    test('should identify IPv6 private ranges', () => {
      trustedProviders.addProvider(privateIPs);

      const ipv6TestAddresses = privateIPs.testAddresses.filter((addr) => addr.includes(':'));
      ipv6TestAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('Private');
      });
    });

    test('should NOT identify public IPs as private', () => {
      trustedProviders.addProvider(privateIPs);

      expect(trustedProviders.getTrustedProvider('8.8.8.8')).toBeNull();
      expect(trustedProviders.getTrustedProvider('1.1.1.1')).toBeNull();
      expect(trustedProviders.getTrustedProvider('172.15.0.1')).toBeNull(); // Outside 172.16.0.0/12
      expect(trustedProviders.getTrustedProvider('172.32.0.1')).toBeNull(); // Outside 172.16.0.0/12
    });
  });

  describe('SemrushBot - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(semrush);

      semrush.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('SemrushBot');
      });
    });

    test('should return null for non-Semrush IPs', () => {
      trustedProviders.addProvider(semrush);

      const result = trustedProviders.getTrustedProvider('4.4.4.4');
      expect(result).toBeNull();
    });
  });

  describe('ShipHero - Runtime Tests', () => {
    test('should load and correctly identify test addresses', () => {
      trustedProviders.addProvider(shipHero);

      shipHero.testAddresses.forEach((testAddr) => {
        const result = trustedProviders.getTrustedProvider(testAddr);
        expect(result).toBe('ShipHero');
      });
    });

    test('should use address list (not ranges)', () => {
      expect(shipHero.ipv4.addresses.length).toBeGreaterThan(0);
      expect(shipHero.ipv4.ranges.length).toBe(0);
    });

    test('should return null for non-ShipHero IPs', () => {
      trustedProviders.addProvider(shipHero);

      const result = trustedProviders.getTrustedProvider('5.5.5.5');
      expect(result).toBeNull();
    });
  });

  describe('Multiple Providers - Runtime Tests', () => {
    test('should correctly identify IPs from multiple loaded providers', () => {
      trustedProviders.addProvider(cloudflare);
      trustedProviders.addProvider(paypal);
      trustedProviders.addProvider(privateIPs);

      // Test Cloudflare
      expect(trustedProviders.getTrustedProvider(cloudflare.testAddresses[0])).toBe('Cloudflare');

      // Test PayPal
      expect(trustedProviders.getTrustedProvider(paypal.testAddresses[0])).toBe('PayPal');

      // Test Private
      expect(trustedProviders.getTrustedProvider('192.168.1.1')).toBe('Private');

      // Test unknown IP
      expect(trustedProviders.getTrustedProvider('8.8.8.8')).toBeNull();
    });

    test('should handle provider removal correctly', () => {
      trustedProviders.addProvider(cloudflare);
      trustedProviders.addProvider(paypal);

      // Verify both work
      expect(trustedProviders.getTrustedProvider(cloudflare.testAddresses[0])).toBe('Cloudflare');
      expect(trustedProviders.getTrustedProvider(paypal.testAddresses[0])).toBe('PayPal');

      // Remove Cloudflare
      trustedProviders.deleteProvider('Cloudflare');

      // Cloudflare should no longer match
      expect(trustedProviders.getTrustedProvider(cloudflare.testAddresses[0])).toBeNull();

      // PayPal should still work
      expect(trustedProviders.getTrustedProvider(paypal.testAddresses[0])).toBe('PayPal');
    });

    test('getAllProviders should return all loaded providers', () => {
      trustedProviders.addProvider(cloudflare);
      trustedProviders.addProvider(paypal);
      trustedProviders.addProvider(privateIPs);

      const allProviders = trustedProviders.getAllProviders();

      expect(allProviders.length).toBe(3);
      expect(allProviders.map((p) => p.name)).toContain('Cloudflare');
      expect(allProviders.map((p) => p.name)).toContain('PayPal');
      expect(allProviders.map((p) => p.name)).toContain('Private');
    });

    test('hasProvider should correctly report provider existence', () => {
      // Ensure clean state
      trustedProviders.deleteProvider('Cloudflare');
      trustedProviders.deleteProvider('PayPal');

      // Add only Cloudflare
      trustedProviders.addProvider(cloudflare);

      expect(trustedProviders.hasProvider('Cloudflare')).toBe(true);
      expect(trustedProviders.hasProvider('PayPal')).toBe(false);
      expect(trustedProviders.hasProvider('NonExistent')).toBe(false);
    });
  });
});
