/**
 * chatgpt-user.js
 *
 * ChatGPT-User — OpenAI's user-triggered fetcher. Unlike GPTBot (training) and
 * OAI-SearchBot (indexing), these requests are made on demand when a user asks
 * ChatGPT to visit a page, so they behave like a proxied human visit rather
 * than a crawl.
 *
 * User-triggered fetchers were originally out of scope for this package, but
 * that reasoning was reversed for Google's fetchers in 2.2.0 after they were
 * being RBL'd and breaking real traffic. The same argument applies here: the
 * requests are legitimate, and blocking them silently breaks a user's action.
 *
 * Source: https://openai.com/chatgpt-user.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPrefixes, loadBundledPrefixes } from '../utils/prefix-feed.js';
import { PROVIDER_CATEGORY_AI_CRAWLER } from '../categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHATGPT_USER_ADDRESS_LIST_URL = 'https://openai.com/chatgpt-user.json';

const self = {
  name: 'ChatGPT-User',
  category: PROVIDER_CATEGORY_AI_CRAWLER,
  testAddresses: ['104.208.184.193', '104.210.139.193'],
  reload: async () => {
    await loadBundledPrefixes(self, path.join(__dirname, '../assets/chatgpt-user-ips.json'), 'chatgpt-user');
  },
  reloadFromWeb: async () => {
    await fetchPrefixes(self, CHATGPT_USER_ADDRESS_LIST_URL);
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
