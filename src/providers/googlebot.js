/**
 * googlebot.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { fetchJSON } from '../utils/secure-http-client.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_ADDRESS_LIST_URL = 'https://developers.google.com/static/search/apis/ipranges/googlebot.json';

const self = {
  name: 'Googlebot',
  testAddresses: ['66.249.66.87', '66.249.70.93'],
  reload: () => {
    return new Promise((resolve, reject) => {
      try {
        // Verify checksum of bundled asset
        const assetPath = path.join(__dirname, '../assets/googlebot-ips.json');
        verifyAssetChecksum(assetPath, 'googlebot', false);

        // Clear existing ranges
        self.ipv4.ranges.length = 0;
        self.ipv6.ranges.length = 0;

        const newIps = JSON.parse(readFileSync(assetPath, 'utf8'));
        newIps.prefixes.forEach((range) => {
          if (range.ipv4Prefix) {
            self.ipv4.ranges.push(range.ipv4Prefix);
          }

          if (range.ipv6Prefix) {
            self.ipv6.ranges.push(range.ipv6Prefix);
          }
        });

        resolve();
      } catch (error) {
        console.error(`Failed to load Googlebot IPs: ${error.message}`);
        reject(error);
      }
    });
  },
  reloadFromWeb: async () => {
    try {
      const data = await fetchJSON(GOOGLE_ADDRESS_LIST_URL);

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
        throw new Error('Invalid response format from Googlebot API');
      }
    } catch (error) {
      console.error(`Failed to reload Googlebot IPs from web: ${error.message}`);
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
