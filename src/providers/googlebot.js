/**
 * googlebot.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google retired googlebot.json; its successor is common-crawlers.json.
const GOOGLE_ADDRESS_LIST_URL = 'https://developers.google.com/static/crawling/ipranges/common-crawlers.json';

const self = {
  name: 'Googlebot',
  testAddresses: ['66.249.66.87', '66.249.70.93'],
  reload: async () => {
    await loadBundledPrefixes(self, path.join(__dirname, '../assets/googlebot-ips.json'), 'googlebot');
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
