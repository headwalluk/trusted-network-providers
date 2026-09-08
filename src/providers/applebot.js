/**
 * applebot.js
 *
 * Applebot — Apple's web crawler, powering Siri, Spotlight Suggestions and
 * Safari search suggestions. Apple publishes the official IP ranges as a JSON
 * file in the same format Google uses for its crawlers.
 *
 * Source: https://search.developer.apple.com/applebot.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { fetchJSON } from '../utils/secure-http-client.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';
import { PROVIDER_CATEGORY_AI_CRAWLER } from '../categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPLEBOT_ADDRESS_LIST_URL = 'https://search.developer.apple.com/applebot.json';

const self = {
  name: 'Applebot',
  category: PROVIDER_CATEGORY_AI_CRAWLER,
  testAddresses: ['17.241.208.161', '17.241.193.161'],
  reload: async () => {
    try {
      // Verify checksum of bundled asset
      const assetPath = path.join(__dirname, '../assets/applebot-ips.json');
      await verifyAssetChecksum(assetPath, 'applebot', false);

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
      logger.error(`Failed to load Applebot IPs: ${error.message}`);
      throw error;
    }
  },
  reloadFromWeb: async () => {
    try {
      const data = await fetchJSON(APPLEBOT_ADDRESS_LIST_URL);

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
        throw new Error('Invalid response format from Applebot API');
      }
    } catch (error) {
      logger.error(`Failed to reload Applebot IPs from web: ${error.message}`);
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
