/**
 * oai-searchbot.js
 *
 * OAI-SearchBot — OpenAI's search crawler, which indexes pages for surfacing
 * and linking in ChatGPT search results (distinct from GPTBot, which crawls
 * for model training). Published in the same format Google uses.
 *
 * Note: OpenAI's crawlers share egress infrastructure, so a handful of prefixes
 * appear in both this list and GPTBot's. Both are trusted, so a lookup landing
 * on a shared prefix simply reports whichever provider is registered first —
 * see docs/providers.md.
 *
 * Source: https://openai.com/searchbot.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';
import { PROVIDER_CATEGORY_AI_CRAWLER } from '../categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OAI_SEARCHBOT_ADDRESS_LIST_URL = 'https://openai.com/searchbot.json';

const self = {
  name: 'OAI-SearchBot',
  category: PROVIDER_CATEGORY_AI_CRAWLER,
  testAddresses: ['135.234.64.1', '104.210.140.129'],
  reload: async () => {
    await loadBundledPrefixes(self, path.join(__dirname, '../assets/oai-searchbot-ips.json'), 'oai-searchbot');
  },
  reloadFromWeb: async () => {
    await fetchPrefixes(self, OAI_SEARCHBOT_ADDRESS_LIST_URL);
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
