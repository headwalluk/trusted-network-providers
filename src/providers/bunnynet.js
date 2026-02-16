/**
 * bunnynet.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import ipaddr from 'ipaddr.js';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const self = {
  name: 'BunnyNet',
  testAddresses: ['193.162.131.1', '200.25.16.103', '2400:52e0:1a01::907:1'],
  reload: async () => {
    try {
      // Verify checksums of bundled assets
      const ipv4Path = path.join(__dirname, '../assets/bunnynet-ip4s.json');
      const ipv6Path = path.join(__dirname, '../assets/bunnynet-ip6s.json');
      verifyAssetChecksum(ipv4Path, 'bunnynet-ipv4', false);
      verifyAssetChecksum(ipv6Path, 'bunnynet-ipv6', false);

      // Clear existing data
      self.ipv4.ranges.length = 0;
      self.ipv6.ranges.length = 0;
      self.ipv4.addresses.length = 0;
      self.ipv6.addresses.length = 0;

      const newIps = [];
      const sources = [
        path.join(__dirname, '../assets/bunnynet-ip4s.json'),
        path.join(__dirname, '../assets/bunnynet-ip6s.json'),
      ];

      sources.forEach((source) => {
        newIps.push(...JSON.parse(readFileSync(source, 'utf8')));
      });

      newIps.forEach((address) => {
        const parsedIp = ipaddr.parse(address);

        if (parsedIp.kind() === 'ipv4') {
          self.ipv4.addresses.push(address);
        } else if (parsedIp.kind() === 'ipv6') {
          self.ipv6.addresses.push(address);
        }
      });
    } catch (error) {
      logger.error(`Failed to load BunnyNet IPs: ${error.message}`);
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
