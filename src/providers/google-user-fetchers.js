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
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_ADDRESS_LIST_URL =
  'https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json';

const self = {
  name: 'Google User-Triggered Fetchers',
  testAddresses: ['66.249.93.169', '66.249.81.5'],
  reload: async () => {
    await loadBundledPrefixes(
      self,
      path.join(__dirname, '../assets/google-user-fetchers.json'),
      'google-user-fetchers'
    );
  },
  reloadFromWeb: async () => {
    await fetchPrefixes(self, GOOGLE_ADDRESS_LIST_URL);
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
