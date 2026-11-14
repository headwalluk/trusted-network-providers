/**
 * gptbot.js
 *
 * GPTBot — OpenAI's training crawler. OpenAI publishes the official IP ranges
 * as a JSON file in the same format Google uses for its crawlers.
 *
 * Note: OpenAI's crawlers share egress infrastructure, so a handful of prefixes
 * appear in both this list and OAI-SearchBot's. Both are trusted, so a lookup
 * landing on a shared prefix simply reports whichever provider is registered
 * first — see docs/providers.md.
 *
 * Source: https://openai.com/gptbot.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';
import { PROVIDER_CATEGORY_AI_CRAWLER } from '../categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GPTBOT_ADDRESS_LIST_URL = 'https://openai.com/gptbot.json';

const self = {
  name: 'GPTBot',
  category: PROVIDER_CATEGORY_AI_CRAWLER,
  testAddresses: ['132.196.86.1', '172.182.202.1'],
  reload: async () => {
    await loadBundledPrefixes(self, path.join(__dirname, '../assets/gptbot-ips.json'), 'gptbot');
  },
  reloadFromWeb: async () => {
    await fetchPrefixes(self, GPTBOT_ADDRESS_LIST_URL);
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
