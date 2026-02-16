/**
 * facebookbot.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const self = {
  name: 'FacebookBot',
  testAddresses: ['57.141.0.3'],
  reload: async () => {
    // Clear existing data
    self.ipv4.ranges.length = 0;
    self.ipv6.ranges.length = 0;

    try {
      const ranges = fs.readFileSync(path.resolve(__dirname, '../assets/facebookbot-ip4s.txt'), 'utf8').split('\n');
      ranges.forEach((range) => {
        if (range.length) {
          self.ipv4.ranges.push(range);
        }
      });
    } catch (err) {
      logger.error(err);
    }

    try {
      const ranges = fs.readFileSync(path.resolve(__dirname, '../assets/facebookbot-ip6s.txt'), 'utf8').split('\n');
      ranges.forEach((range) => {
        if (range.length) {
          self.ipv6.ranges.push(range);
        }
      });
    } catch (err) {
      logger.error(err);
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
