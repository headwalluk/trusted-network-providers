/**
 * facebookbot.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVerifiedAsset } from '../utils/checksum-verifier.js';
import { createEmptySnapshot, nonBlankLines, replaceProviderData } from '../utils/provider-data.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const self = {
  name: 'FacebookBot',
  testAddresses: ['57.141.0.3'],
  reload: async () => {
    try {
      const snapshot = createEmptySnapshot();
      snapshot.ipv4.ranges = nonBlankLines(
        await readVerifiedAsset(path.resolve(__dirname, '../assets/facebookbot-ip4s.txt'), 'facebookbot-ipv4')
      );
      snapshot.ipv6.ranges = nonBlankLines(
        await readVerifiedAsset(path.resolve(__dirname, '../assets/facebookbot-ip6s.txt'), 'facebookbot-ipv6')
      );

      replaceProviderData(self, snapshot);
    } catch (error) {
      logger.error(`Failed to load FacebookBot IPs: ${error.message}`);
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
