/**
 * oai-searchbot.js
 *
 * OAI-SearchBot — OpenAI's search crawler, which indexes pages for surfacing
 * and linking in ChatGPT search results (distinct from GPTBot, which crawls
 * for model training). Published in the same format Google uses.
 *
 * Note: OpenAI's crawlers share egress infrastructure, so a handful of prefixes
 * appear in both this list and GPTBot's. Both are trusted, so a lookup landing
 * on a shared prefix simply reports whichever provider is registered first —
 * see docs/providers.md.
 *
 * Source: https://openai.com/searchbot.json
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

const OAI_SEARCHBOT_ADDRESS_LIST_URL = 'https://openai.com/searchbot.json';

const self = {
  name: 'OAI-SearchBot',
  category: PROVIDER_CATEGORY_AI_CRAWLER,
  testAddresses: ['135.234.64.1', '104.210.140.129'],
  reload: async () => {
    try {
      // Verify checksum of bundled asset
      const assetPath = path.join(__dirname, '../assets/oai-searchbot-ips.json');
      await verifyAssetChecksum(assetPath, 'oai-searchbot', false);

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
      logger.error(`Failed to load OAI-SearchBot IPs: ${error.message}`);
      throw error;
    }
  },
  reloadFromWeb: async () => {
    try {
      const data = await fetchJSON(OAI_SEARCHBOT_ADDRESS_LIST_URL);

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
        throw new Error('Invalid response format from OAI-SearchBot API');
      }
    } catch (error) {
      logger.error(`Failed to reload OAI-SearchBot IPs from web: ${error.message}`);
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
