/**
 * seobility.js
 *
 * REF: https://www.seobility.net/en/bot/
 *
 * The older https://www.seobility.net/static/ip_lists/bots/*.txt endpoints are
 * gone (404). Seobility now publishes bots.json for automated discovery, in the
 * same {prefixes:[{ipv4Prefix|ipv6Prefix}]} shape Google uses — except that most
 * entries are bare host addresses rather than CIDR blocks, so each one is routed
 * on whether it carries a mask.
 */

import { fetchJSON } from '../utils/secure-http-client.js';
import logger from '../utils/logger.js';

const SEOBILITY_ADDRESS_LIST_URL = 'https://www.seobility.net/bots.json';

/** Reject a payload that parsed but isn't the feed we expect. */
const hasExpectedStructure = (data) => Boolean(data) && Array.isArray(data.prefixes) && data.prefixes.length > 0;

const self = {
  name: 'Seobility',
  // The feed lists individual crawler hosts, which Seobility rotates. If
  // runTests() starts failing here, re-pick from https://www.seobility.net/bots.json.
  testAddresses: ['116.202.182.111', '2a01:4f8:1c0c:4018::1'],
  reload: async () => {
    try {
      const data = await fetchJSON(SEOBILITY_ADDRESS_LIST_URL, { verifyStructure: hasExpectedStructure });

      const newAddresses = {
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
      };

      for (const prefix of data.prefixes) {
        if (prefix.ipv4Prefix) {
          const target = prefix.ipv4Prefix.includes('/') ? newAddresses.ipv4.ranges : newAddresses.ipv4.addresses;
          target.push(prefix.ipv4Prefix);
        }

        if (prefix.ipv6Prefix) {
          const target = prefix.ipv6Prefix.includes('/') ? newAddresses.ipv6.ranges : newAddresses.ipv6.addresses;
          target.push(prefix.ipv6Prefix);
        }
      }

      self.ipv4 = newAddresses.ipv4;
      self.ipv6 = newAddresses.ipv6;
    } catch (error) {
      logger.error(`Failed to reload Seobility IPs: ${error.message}`);
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
