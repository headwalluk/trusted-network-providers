/**
 * bingbot.js
 *
 * Microsoft Bingbot — the Bing search crawler (also powers Yahoo search).
 * Microsoft publishes the official IP ranges as a JSON file in the same
 * format Google uses for its crawlers.
 *
 * Source: https://www.bing.com/toolbox/bingbot.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BING_ADDRESS_LIST_URL = 'https://www.bing.com/toolbox/bingbot.json';

const self = {
  name: 'Bingbot',
  testAddresses: ['157.55.39.1', '207.46.13.1'],
  reload: async () => {
    await loadBundledPrefixes(self, path.join(__dirname, '../assets/bingbot-ips.json'), 'bingbot');
  },
  reloadFromWeb: async () => {
    await fetchPrefixes(self, BING_ADDRESS_LIST_URL);
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
