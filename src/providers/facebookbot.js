/**
 * facebookbot.js
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const self = {
  name: 'FacebookBot',
  testAddresses: ['57.141.0.3'],
  reload: async () => {
    // Clear existing data
    self.ipv4.ranges.length = 0;
    self.ipv6.ranges.length = 0;

    try {
      const assetPath = path.resolve(__dirname, '../assets/facebookbot-ip4s.txt');
      await verifyAssetChecksum(assetPath, 'facebookbot-ipv4', false);
      const data = await readFile(assetPath, 'utf8');
      const ranges = data.split('\n');
      ranges.forEach((range) => {
        if (range.length) {
          self.ipv4.ranges.push(range);
        }
      });
    } catch (error) {
      logger.error(`Failed to load FacebookBot IPv4 IPs: ${error.message}`);
      throw error;
    }

    try {
      const assetPath = path.resolve(__dirname, '../assets/facebookbot-ip6s.txt');
      await verifyAssetChecksum(assetPath, 'facebookbot-ipv6', false);
      const data = await readFile(assetPath, 'utf8');
      const ranges = data.split('\n');
      ranges.forEach((range) => {
        if (range.length) {
          self.ipv6.ranges.push(range);
        }
      });
    } catch (error) {
      logger.error(`Failed to load FacebookBot IPv6 IPs: ${error.message}`);
      throw error;
    }
  },
  ipv4: {
    addresses: [],
    ranges: [],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
};

export default self;
