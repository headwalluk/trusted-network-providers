/**
 * google-user-fetchers.js
 *
 * Google's "user-triggered fetchers" — products that fetch a URL because an
 * end user (not a crawl schedule) caused the request: the Gmail image proxy
 * (`GoogleImageProxy`), Chrome's Privacy Preserving Prefetch Proxy, Feedfetcher,
 * Google Read Aloud, Google Site Verifier, etc. They all egress from the
 * `google-proxy-*.google.com` infrastructure (notably the `66.249.80.0/20`
 * block) plus Google's edge ranges.
 *
 * These ranges are published separately from Googlebot's common-crawlers list
 * and the special-crawlers list (no overlap on the proxy /27s), so a dedicated
 * provider is required to recognise them.
 *
 * Why this provider exists: the same proxy IPs were being added to a downstream
 * RBL (a fail2ban false-positive on Chrome prefetch probes to
 * `/.well-known/traffic-advice`), which then blocked the Gmail image proxy and
 * broke newsletter images in Gmail. See dev-notes/08-milestone-8-google-user-fetchers.md.
 *
 * Source: https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { fetchJSON } from '../utils/secure-http-client.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_ADDRESS_LIST_URL =
  'https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json';

const self = {
  name: 'Google User-Triggered Fetchers',
  testAddresses: ['66.249.93.169', '66.249.81.5'],
  reload: async () => {
    try {
      // Verify checksum of bundled asset
      const assetPath = path.join(__dirname, '../assets/google-user-fetchers.json');
      await verifyAssetChecksum(assetPath, 'google-user-fetchers', false);

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
      logger.error(`Failed to load Google User-Triggered Fetchers IPs: ${error.message}`);
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
        throw new Error('Invalid response format from Google User-Triggered Fetchers API');
      }
    } catch (error) {
      logger.error(`Failed to reload Google User-Triggered Fetchers IPs from web: ${error.message}`);
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
