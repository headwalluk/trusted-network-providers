/**
 * chatgpt-user.js
 *
 * ChatGPT-User — OpenAI's user-triggered fetcher. Unlike GPTBot (training) and
 * OAI-SearchBot (indexing), these requests are made on demand when a user asks
 * ChatGPT to visit a page, so they behave like a proxied human visit rather
 * than a crawl.
 *
 * User-triggered fetchers were originally out of scope for this package, but
 * that reasoning was reversed for Google's fetchers in 2.2.0 after they were
 * being RBL'd and breaking real traffic. The same argument applies here: the
 * requests are legitimate, and blocking them silently breaks a user's action.
 *
 * Source: https://openai.com/chatgpt-user.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { fetchJSON } from '../utils/secure-http-client.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHATGPT_USER_ADDRESS_LIST_URL = 'https://openai.com/chatgpt-user.json';

const self = {
  name: 'ChatGPT-User',
  testAddresses: ['104.208.184.193', '104.210.139.193'],
  reload: async () => {
    try {
      // Verify checksum of bundled asset
      const assetPath = path.join(__dirname, '../assets/chatgpt-user-ips.json');
      await verifyAssetChecksum(assetPath, 'chatgpt-user', false);

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
      logger.error(`Failed to load ChatGPT-User IPs: ${error.message}`);
      throw error;
    }
  },
  reloadFromWeb: async () => {
    try {
      const data = await fetchJSON(CHATGPT_USER_ADDRESS_LIST_URL);

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
        throw new Error('Invalid response format from ChatGPT-User API');
      }
    } catch (error) {
      logger.error(`Failed to reload ChatGPT-User IPs from web: ${error.message}`);
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
