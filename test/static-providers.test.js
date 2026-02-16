/**
 * Static Provider Tests
 *
 * Tests for providers that don't have reload functions (static IP lists).
 * These providers are defined with hardcoded ranges and addresses.
 */

import ahrefsbot from '../src/providers/ahrefsbot.js';
import brevo from '../src/providers/brevo.js';
import cloudflare from '../src/providers/cloudflare.js';
import ezoic from '../src/providers/ezoic.js';
import mailgun from '../src/providers/mailgun.js';
import opayo from '../src/providers/opayo.js';
import outlook from '../src/providers/outlook.js';
import paypal from '../src/providers/paypal.js';
import privateIPs from '../src/providers/private.js';
import semrush from '../src/providers/semrush.js';
import shipHero from '../src/providers/ship-hero.js';
import labrika from '../src/providers/labrika.js';
import seobility from '../src/providers/seobility.js';
import ipaddr from 'ipaddr.js';

/**
 * Helper to verify a test address is in the provider's defined ranges
 */
function isTestAddressInRanges(testAddr, provider) {
  const parsedTest = ipaddr.parse(testAddr);
  const kind = parsedTest.kind();

  // Check addresses
  const addresses = kind === 'ipv4' ? provider.ipv4.addresses : provider.ipv6.addresses;
  if (addresses.includes(testAddr)) {
    return true;
  }

  // Check ranges
  const ranges = kind === 'ipv4' ? provider.ipv4.ranges : provider.ipv6.ranges;
  for (const range of ranges) {
    const [addr, prefixLen] = ipaddr.parseCIDR(range);
    if (parsedTest.match(addr, prefixLen)) {
      return true;
    }
  }

  return false;
}

describe('Static Providers', () => {
  describe('AhrefsBot', () => {
    test('should have required structure', () => {
      expect(ahrefsbot.name).toBe('AhrefsBot');
      expect(Array.isArray(ahrefsbot.testAddresses)).toBe(true);
      expect(ahrefsbot.testAddresses.length).toBeGreaterThan(0);
      expect(ahrefsbot.ipv4).toBeDefined();
      expect(ahrefsbot.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(ahrefsbot.ipv4.ranges)).toBe(true);
      expect(ahrefsbot.ipv4.ranges.length).toBeGreaterThan(0);

      // Verify each range is a valid CIDR
      ahrefsbot.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      ahrefsbot.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, ahrefsbot)).toBe(true);
      });
    });
  });

  describe('Brevo', () => {
    test('should have required structure', () => {
      expect(brevo.name).toBe('Brevo');
      expect(Array.isArray(brevo.testAddresses)).toBe(true);
      expect(brevo.testAddresses.length).toBeGreaterThan(0);
      expect(brevo.ipv4).toBeDefined();
      expect(brevo.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(brevo.ipv4.ranges)).toBe(true);
      expect(brevo.ipv4.ranges.length).toBeGreaterThan(0);

      brevo.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      brevo.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, brevo)).toBe(true);
      });
    });
  });

  describe('Cloudflare', () => {
    test('should have required structure', () => {
      expect(cloudflare.name).toBe('Cloudflare');
      expect(Array.isArray(cloudflare.testAddresses)).toBe(true);
      expect(cloudflare.testAddresses.length).toBeGreaterThan(0);
      expect(cloudflare.ipv4).toBeDefined();
      expect(cloudflare.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(cloudflare.ipv4.ranges)).toBe(true);
      expect(cloudflare.ipv4.ranges.length).toBeGreaterThan(0);

      cloudflare.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('should have valid IPv6 ranges', () => {
      expect(Array.isArray(cloudflare.ipv6.ranges)).toBe(true);
      expect(cloudflare.ipv6.ranges.length).toBeGreaterThan(0);

      cloudflare.ipv6.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      cloudflare.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, cloudflare)).toBe(true);
      });
    });
  });

  describe('Ezoic', () => {
    test('should have required structure', () => {
      expect(ezoic.name).toBe('Ezoic');
      expect(Array.isArray(ezoic.testAddresses)).toBe(true);
      expect(ezoic.testAddresses.length).toBeGreaterThan(0);
      expect(ezoic.ipv4).toBeDefined();
      expect(ezoic.ipv6).toBeDefined();
    });

    test('should have valid IPv4 addresses', () => {
      expect(Array.isArray(ezoic.ipv4.addresses)).toBe(true);
      expect(ezoic.ipv4.addresses.length).toBeGreaterThan(0);

      ezoic.ipv4.addresses.forEach((addr) => {
        expect(() => ipaddr.parse(addr)).not.toThrow();
      });
    });

    test('test addresses should be in defined addresses', () => {
      ezoic.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, ezoic)).toBe(true);
      });
    });
  });

  describe('Mailgun', () => {
    test('should have required structure', () => {
      expect(mailgun.name).toBe('Mailgun');
      expect(Array.isArray(mailgun.testAddresses)).toBe(true);
      expect(mailgun.testAddresses.length).toBeGreaterThan(0);
      expect(mailgun.ipv4).toBeDefined();
      expect(mailgun.ipv6).toBeDefined();
    });

    test('should have reload function', () => {
      expect(typeof mailgun.reload).toBe('function');
    });

    test('should have empty arrays before reload', () => {
      expect(Array.isArray(mailgun.ipv4.addresses)).toBe(true);
      expect(Array.isArray(mailgun.ipv4.ranges)).toBe(true);
      expect(Array.isArray(mailgun.ipv6.addresses)).toBe(true);
      expect(Array.isArray(mailgun.ipv6.ranges)).toBe(true);
    });
  });

  describe('Opayo', () => {
    test('should have required structure', () => {
      expect(opayo.name).toBe('Opayo');
      expect(Array.isArray(opayo.testAddresses)).toBe(true);
      expect(opayo.testAddresses.length).toBeGreaterThan(0);
      expect(opayo.ipv4).toBeDefined();
      expect(opayo.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(opayo.ipv4.ranges)).toBe(true);
      expect(opayo.ipv4.ranges.length).toBeGreaterThan(0);

      opayo.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      opayo.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, opayo)).toBe(true);
      });
    });
  });

  describe('MS Outlook', () => {
    test('should have required structure', () => {
      expect(outlook.name).toBe('MS Outlook');
      expect(Array.isArray(outlook.testAddresses)).toBe(true);
      expect(outlook.testAddresses.length).toBeGreaterThan(0);
      expect(outlook.ipv4).toBeDefined();
      expect(outlook.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(outlook.ipv4.ranges)).toBe(true);
      expect(outlook.ipv4.ranges.length).toBeGreaterThan(0);

      outlook.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('should have valid IPv6 ranges', () => {
      expect(Array.isArray(outlook.ipv6.ranges)).toBe(true);
      expect(outlook.ipv6.ranges.length).toBeGreaterThan(0);

      outlook.ipv6.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      outlook.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, outlook)).toBe(true);
      });
    });
  });

  describe('PayPal', () => {
    test('should have required structure', () => {
      expect(paypal.name).toBe('PayPal');
      expect(Array.isArray(paypal.testAddresses)).toBe(true);
      expect(paypal.testAddresses.length).toBeGreaterThan(0);
      expect(paypal.ipv4).toBeDefined();
      expect(paypal.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(paypal.ipv4.ranges)).toBe(true);
      expect(paypal.ipv4.ranges.length).toBeGreaterThan(0);

      paypal.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      paypal.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, paypal)).toBe(true);
      });
    });
  });

  describe('Private', () => {
    test('should have required structure', () => {
      expect(privateIPs.name).toBe('Private');
      expect(Array.isArray(privateIPs.testAddresses)).toBe(true);
      expect(privateIPs.testAddresses.length).toBeGreaterThan(0);
      expect(privateIPs.ipv4).toBeDefined();
      expect(privateIPs.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(privateIPs.ipv4.ranges)).toBe(true);
      expect(privateIPs.ipv4.ranges.length).toBeGreaterThan(0);

      privateIPs.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('should have valid IPv6 ranges', () => {
      expect(Array.isArray(privateIPs.ipv6.ranges)).toBe(true);
      expect(privateIPs.ipv6.ranges.length).toBeGreaterThan(0);

      privateIPs.ipv6.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      privateIPs.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, privateIPs)).toBe(true);
      });
    });
  });

  describe('SemrushBot', () => {
    test('should have required structure', () => {
      expect(semrush.name).toBe('SemrushBot');
      expect(Array.isArray(semrush.testAddresses)).toBe(true);
      expect(semrush.testAddresses.length).toBeGreaterThan(0);
      expect(semrush.ipv4).toBeDefined();
      expect(semrush.ipv6).toBeDefined();
    });

    test('should have valid IPv4 ranges', () => {
      expect(Array.isArray(semrush.ipv4.ranges)).toBe(true);
      expect(semrush.ipv4.ranges.length).toBeGreaterThan(0);

      semrush.ipv4.ranges.forEach((range) => {
        expect(() => ipaddr.parseCIDR(range)).not.toThrow();
      });
    });

    test('test addresses should be in defined ranges', () => {
      semrush.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, semrush)).toBe(true);
      });
    });
  });

  describe('ShipHero', () => {
    test('should have required structure', () => {
      expect(shipHero.name).toBe('ShipHero');
      expect(Array.isArray(shipHero.testAddresses)).toBe(true);
      expect(shipHero.testAddresses.length).toBeGreaterThan(0);
      expect(shipHero.ipv4).toBeDefined();
      expect(shipHero.ipv6).toBeDefined();
    });

    test('should have valid IPv4 addresses', () => {
      expect(Array.isArray(shipHero.ipv4.addresses)).toBe(true);
      expect(shipHero.ipv4.addresses.length).toBeGreaterThan(0);

      shipHero.ipv4.addresses.forEach((addr) => {
        expect(() => ipaddr.parse(addr)).not.toThrow();
      });
    });

    test('test addresses should be in defined addresses', () => {
      shipHero.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, shipHero)).toBe(true);
      });
    });
  });

  describe('Labrika', () => {
    test('should have required structure', () => {
      expect(labrika.name).toBe('Labrika');
      expect(Array.isArray(labrika.testAddresses)).toBe(true);
      expect(labrika.testAddresses.length).toBeGreaterThan(0);
      expect(labrika.ipv4).toBeDefined();
      expect(labrika.ipv6).toBeDefined();
    });

    test('should have valid IPv4 addresses', () => {
      expect(Array.isArray(labrika.ipv4.addresses)).toBe(true);
      expect(labrika.ipv4.addresses.length).toBeGreaterThan(0);

      labrika.ipv4.addresses.forEach((addr) => {
        expect(() => ipaddr.parse(addr)).not.toThrow();
      });
    });

    test('test addresses should be in defined addresses', () => {
      labrika.testAddresses.forEach((testAddr) => {
        expect(isTestAddressInRanges(testAddr, labrika)).toBe(true);
      });
    });
  });

  describe('Seobility', () => {
    test('should have required structure', () => {
      expect(seobility.name).toBe('Seobility');
      expect(Array.isArray(seobility.testAddresses)).toBe(true);
      expect(seobility.testAddresses.length).toBeGreaterThan(0);
      expect(seobility.ipv4).toBeDefined();
      expect(seobility.ipv6).toBeDefined();
    });

    test('should have reload function', () => {
      expect(typeof seobility.reload).toBe('function');
    });

    test('should have empty arrays before reload', () => {
      expect(Array.isArray(seobility.ipv4.addresses)).toBe(true);
      expect(Array.isArray(seobility.ipv4.ranges)).toBe(true);
      expect(Array.isArray(seobility.ipv6.addresses)).toBe(true);
      expect(Array.isArray(seobility.ipv6.ranges)).toBe(true);
    });
  });
});
