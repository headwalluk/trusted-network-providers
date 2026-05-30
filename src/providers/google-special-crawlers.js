/**
 * google-special-crawlers.js
 *
 * Google's "special-case crawlers" — products that crawl from their own IP
 * ranges by agreement with the crawled site. This covers AdsBot-Google and
 * AdsBot-Google-Mobile (Google Ads landing-page quality checks),
 * Mediapartners-Google (AdSense), APIs-Google and Google-Safety.
 *
 * These ranges are published separately from Googlebot's and are NOT present
 * in googlebot.json, so a dedicated provider is required to recognise them.
 *
 * Source: https://developers.google.com/static/search/apis/ipranges/special-crawlers.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { fetchJSON } from '../utils/secure-http-client.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_ADDRESS_LIST_URL = 'https://developers.google.com/static/search/apis/ipranges/special-crawlers.json';

const self = {
  name: 'Google Special Crawlers',
  testAddresses: ['66.249.90.77', '74.125.148.1'],
  reload: async () => {
    try {
      // Verify checksum of bundled asset
      const assetPath = path.join(__dirname, '../assets/google-special-crawlers.json');
      await verifyAssetChecksum(assetPath, 'google-special-crawlers', false);

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
      logger.error(`Failed to load Google Special Crawlers IPs: ${error.message}`);
      throw error;
    }
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
        throw new Error('Invalid response format from Google Special Crawlers API');
      }
    } catch (error) {
      logger.error(`Failed to reload Google Special Crawlers IPs from web: ${error.message}`);
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
