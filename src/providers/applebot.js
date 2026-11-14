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
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';
import { PROVIDER_CATEGORY_AI_CRAWLER } from '../categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPLEBOT_ADDRESS_LIST_URL = 'https://search.developer.apple.com/applebot.json';

const self = {
  name: 'Applebot',
  category: PROVIDER_CATEGORY_AI_CRAWLER,
  testAddresses: ['17.241.208.161', '17.241.193.161'],
  reload: async () => {
    await loadBundledPrefixes(self, path.join(__dirname, '../assets/applebot-ips.json'), 'applebot');
  },
  reloadFromWeb: async () => {
    await fetchPrefixes(self, APPLEBOT_ADDRESS_LIST_URL);
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
