/**
 * checksum-verifier.js
 *
 * Utilities for verifying checksums of bundled assets
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateSHA256 } from './secure-http-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedChecksums = null;

/**
 * Load checksums from the checksums.json file
 * @returns {object} - The checksums configuration
 */
function loadChecksums() {
  if (cachedChecksums) {
    return cachedChecksums;
  }

  try {
    const checksumsPath = path.join(__dirname, '../assets/checksums.json');
    const checksumsData = fs.readFileSync(checksumsPath, 'utf8');
    cachedChecksums = JSON.parse(checksumsData);
    return cachedChecksums;
  } catch (error) {
    console.warn(`Warning: Could not load checksums file: ${error.message}`);
    return { providers: {} };
  }
}

/**
 * Verify the checksum of a bundled asset file
 * @param {string} filePath - Path to the file to verify
 * @param {string} providerKey - Key in checksums.json (e.g., 'googlebot')
 * @param {boolean} strict - If true, throw error on mismatch; if false, log warning
 * @returns {boolean} - True if checksum matches or verification disabled
 * @throws {Error} - If strict=true and checksum doesn't match
 */
function verifyAssetChecksum(filePath, providerKey, strict = false) {
  const checksums = loadChecksums();
  const providerConfig = checksums.providers[providerKey];

  // If no checksum configured, skip verification
  if (!providerConfig || !providerConfig.sha256) {
    if (strict) {
      console.warn(`Warning: No checksum configured for ${providerKey}`);
    }
    return true;
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const actualChecksum = calculateSHA256(fileContent);
    const expectedChecksum = providerConfig.sha256;

    if (actualChecksum !== expectedChecksum) {
      const message =
        `Checksum mismatch for ${providerKey} at ${filePath}\n` +
        `Expected: ${expectedChecksum}\n` +
        `Got:      ${actualChecksum}\n` +
        'This may indicate file corruption or tampering.';

      if (strict) {
        throw new Error(message);
      } else {
        console.warn(`Warning: ${message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const message = `Asset file not found: ${filePath}`;
      if (strict) {
        throw new Error(message);
      } else {
        console.warn(`Warning: ${message}`);
        return false;
      }
    }
    throw error;
  }
}

/**
 * Get the expected checksum for a provider
 * @param {string} providerKey - Key in checksums.json
 * @returns {string|null} - The expected checksum or null
 */
function getExpectedChecksum(providerKey) {
  const checksums = loadChecksums();
  const providerConfig = checksums.providers[providerKey];
  return providerConfig ? providerConfig.sha256 : null;
}

export { loadChecksums, verifyAssetChecksum, getExpectedChecksum };
