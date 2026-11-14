/**
 * bunnynet.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVerifiedAsset } from '../utils/checksum-verifier.js';
import { replaceProviderData, snapshotFromAddressList } from '../utils/provider-data.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const self = {
  name: 'BunnyNet',
  testAddresses: ['193.162.131.1', '200.25.16.103', '2400:52e0:1a01::907:1'],
  reload: async () => {
    try {
      const ipv4Addresses = JSON.parse(
        await readVerifiedAsset(path.join(__dirname, '../assets/bunnynet-ip4s.json'), 'bunnynet-ipv4')
      );
      const ipv6Addresses = JSON.parse(
        await readVerifiedAsset(path.join(__dirname, '../assets/bunnynet-ip6s.json'), 'bunnynet-ipv6')
      );

      if (!Array.isArray(ipv4Addresses) || !Array.isArray(ipv6Addresses)) {
        throw new Error('Expected each BunnyNet asset to be an array of addresses');
      }

      replaceProviderData(self, snapshotFromAddressList([...ipv4Addresses, ...ipv6Addresses]));
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
