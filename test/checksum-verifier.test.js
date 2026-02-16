/**
 * Checksum Verifier Tests
 *
 * Tests for checksum verification utilities
 */

import { jest } from '@jest/globals';
import { loadChecksums, verifyAssetChecksum, getExpectedChecksum } from '../src/utils/checksum-verifier.js';
import logger from '../src/utils/logger.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Checksum Verifier', () => {
  describe('loadChecksums()', () => {
    test('should load checksums from checksums.json', async () => {
      const checksums = await loadChecksums();

      expect(checksums).toBeDefined();
      expect(checksums.providers).toBeDefined();
      expect(typeof checksums.providers).toBe('object');
    });

    test('should cache checksums after first load', async () => {
      const checksums1 = await loadChecksums();
      const checksums2 = await loadChecksums();

      // Should return the same object reference (cached)
      expect(checksums1).toBe(checksums2);
    });

    test('should have checksums for known providers', async () => {
      const checksums = await loadChecksums();

      // Check for some known providers
      expect(checksums.providers.googlebot).toBeDefined();
      expect(checksums.providers.googlebot.sha256).toBeDefined();
      expect(typeof checksums.providers.googlebot.sha256).toBe('string');
    });
  });

  describe('getExpectedChecksum()', () => {
    test('should return checksum for valid provider', async () => {
      const checksum = await getExpectedChecksum('googlebot');

      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64); // SHA-256 is 64 hex chars
    });

    test('should return null for unknown provider', async () => {
      const checksum = await getExpectedChecksum('nonexistent-provider');

      expect(checksum).toBeNull();
    });
  });

  describe('verifyAssetChecksum()', () => {
    test('should verify valid asset checksum', async () => {
      const assetPath = path.join(__dirname, '../src/assets/googlebot-ips.json');
      const result = await verifyAssetChecksum(assetPath, 'googlebot', false);

      expect(result).toBe(true);
    });

    test('should return true if no checksum configured (non-strict)', async () => {
      const assetPath = path.join(__dirname, '../src/assets/googlebot-ips.json');
      const result = await verifyAssetChecksum(assetPath, 'unconfigured-provider', false);

      expect(result).toBe(true);
    });

    test('should warn but return true if no checksum configured (strict)', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const assetPath = path.join(__dirname, '../src/assets/googlebot-ips.json');

      // Set log level to warn so the warning appears
      logger.setLevel('warn');

      const result = await verifyAssetChecksum(assetPath, 'unconfigured-provider', true);

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      logger.setLevel('error'); // Reset to default
      consoleSpy.mockRestore();
    });

    test('should return false for missing file (non-strict)', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const assetPath = path.join(__dirname, '../src/assets/nonexistent-file.json');

      // Set log level to warn so the warning appears
      logger.setLevel('warn');

      const result = await verifyAssetChecksum(assetPath, 'googlebot', false);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Asset file not found'));

      logger.setLevel('error'); // Reset to default
      consoleSpy.mockRestore();
    });

    test('should throw error for missing file (strict)', async () => {
      const assetPath = path.join(__dirname, '../src/assets/nonexistent-file.json');

      await expect(verifyAssetChecksum(assetPath, 'googlebot', true)).rejects.toThrow('Asset file not found');
    });

    test('should detect checksum mismatch (non-strict)', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Set log level to warn so the warning appears
      logger.setLevel('warn');

      // Use bunnynet's ipv4 file with googlebot's checksum (will mismatch)
      const result = await verifyAssetChecksum(
        path.join(__dirname, '../src/assets/bunnynet-ip4s.json'),
        'googlebot', // Using googlebot's checksum for bunnynet's file (mismatch)
        false
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Checksum mismatch'));

      logger.setLevel('error'); // Reset to default
      consoleSpy.mockRestore();
    });

    test('should throw error for checksum mismatch (strict)', async () => {
      await expect(
        verifyAssetChecksum(
          path.join(__dirname, '../src/assets/bunnynet-ip4s.json'),
          'googlebot', // Using googlebot's checksum for bunnynet's file (mismatch)
          true
        )
      ).rejects.toThrow('Checksum mismatch');
    });
  });
});
