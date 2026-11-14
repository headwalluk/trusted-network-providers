/**
 * google-special-crawlers.js
 *
 * Google's "special-case crawlers" — products that crawl from their own IP
 * ranges by agreement with the crawled site. This covers AdsBot-Google and
 * AdsBot-Google-Mobile (Google Ads landing-page quality checks),
 * Mediapartners-Google (AdSense), APIs-Google and Google-Safety.
 *
 * These ranges are published separately from Googlebot's and are NOT present
 * in the common-crawlers list, so a dedicated provider is required to recognise them.
 *
 * Source: https://developers.google.com/static/crawling/ipranges/special-crawlers.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_ADDRESS_LIST_URL = 'https://developers.google.com/static/crawling/ipranges/special-crawlers.json';

const self = {
  name: 'Google Special Crawlers',
  testAddresses: ['66.249.90.77', '74.125.148.1'],
  reload: async () => {
    await loadBundledPrefixes(
      self,
      path.join(__dirname, '../assets/google-special-crawlers.json'),
      'google-special-crawlers'
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
