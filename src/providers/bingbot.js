/**
 * bingbot.js
 *
 * Microsoft Bingbot — the Bing search crawler (also powers Yahoo search).
 * Microsoft publishes the official IP ranges as a JSON file in the same
 * format Google uses for its crawlers.
 *
 * Source: https://www.bing.com/toolbox/bingbot.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { fetchJSON } from '../utils/secure-http-client.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BING_ADDRESS_LIST_URL = 'https://www.bing.com/toolbox/bingbot.json';

const self = {
  name: 'Bingbot',
  testAddresses: ['157.55.39.1', '207.46.13.1'],
  reload: async () => {
    try {
      // Verify checksum of bundled asset
      const assetPath = path.join(__dirname, '../assets/bingbot-ips.json');
      await verifyAssetChecksum(assetPath, 'bingbot', false);

      // Clear existing ranges
      self.ipv4.ranges.length = 0;
      self.ipv6.ranges.length = 0;

      const newIps = JSON.parse(await readFile(assetPath, 'utf8'));
      newIps.prefixes.forEach((range) => {
        if (range.ipv4Prefix) {
          self.ipv4.ranges.push(range.ipv4Prefix);
        }

        if (range.ipv6Prefix) {
          self.ipv6.ranges.push(range.ipv6Prefix);
        }
      });
    } catch (error) {
      logger.error(`Failed to load Bingbot IPs: ${error.message}`);
      throw error;
    }
  },
  reloadFromWeb: async () => {
    try {
      const data = await fetchJSON(BING_ADDRESS_LIST_URL);

      if (data && data.prefixes && Array.isArray(data.prefixes)) {
        // Clear existing ranges
        self.ipv4.ranges.length = 0;
        self.ipv6.ranges.length = 0;

        data.prefixes.forEach((range) => {
          if (range.ipv4Prefix) {
            self.ipv4.ranges.push(range.ipv4Prefix);
          }

          if (range.ipv6Prefix) {
            self.ipv6.ranges.push(range.ipv6Prefix);
          }
        });
      } else {
        throw new Error('Invalid response format from Bingbot API');
      }
    } catch (error) {
      logger.error(`Failed to reload Bingbot IPs from web: ${error.message}`);
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
