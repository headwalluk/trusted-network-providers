/**
 * stripe-webhooks.js
 */

import { fetchJSON } from '../utils/secure-http-client.js';
import logger from '../utils/logger.js';

const STRIPE_ADDRESSES_URL = 'https://stripe.com/files/ips/ips_webhooks.json';

const self = {
  name: 'Stripe Webhooks',
  reload: async () => {
    try {
      // Structure verification function for Stripe Webhooks response
      const verifyStructure = (data) => {
        return (
          data &&
          data.WEBHOOKS &&
          Array.isArray(data.WEBHOOKS) &&
          data.WEBHOOKS.length > 0 &&
          data.WEBHOOKS.every((ip) => typeof ip === 'string' && ip.match(/^\d+\.\d+\.\d+\.\d+$/))
        );
      };

      const data = await fetchJSON(STRIPE_ADDRESSES_URL, { verifyStructure });

      if (data && data.WEBHOOKS && Array.isArray(data.WEBHOOKS)) {
        // Clear existing addresses
        self.ipv4.addresses.length = 0;

        data.WEBHOOKS.forEach((ipAddress) => {
          self.ipv4.addresses.push(ipAddress);
        });
      } else {
        throw new Error('Invalid response format from Stripe Webhooks');
      }
    } catch (error) {
      logger.error(`Failed to reload Stripe Webhooks IPs: ${error.message}`);
      throw error;
    }
  },
  testAddresses: ['35.154.171.200'],
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
