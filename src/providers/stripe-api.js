/**
 * stripe-api.js
 */

import { fetchJSON } from '../utils/secure-http-client.js';

const STRIPE_ADDRESSES_URL = 'https://stripe.com/files/ips/ips_api.json';

const self = {
  name: 'Stripe API',
  reload: async () => {
    try {
      // Structure verification function for Stripe API response
      const verifyStructure = (data) => {
        return (
          data &&
          data.API &&
          Array.isArray(data.API) &&
          data.API.length > 0 &&
          data.API.every((ip) => typeof ip === 'string' && ip.match(/^\d+\.\d+\.\d+\.\d+$/))
        );
      };

      const data = await fetchJSON(STRIPE_ADDRESSES_URL, { verifyStructure });

      if (data && data.API && Array.isArray(data.API)) {
        // Clear existing addresses
        self.ipv4.addresses.length = 0;

        data.API.forEach((ipAddress) => {
          self.ipv4.addresses.push(ipAddress);
        });
      } else {
        throw new Error('Invalid response format from Stripe API');
      }
    } catch (error) {
      console.error(`Failed to reload Stripe API IPs: ${error.message}`);
      throw error;
    }
  },
  testAddresses: ['34.237.253.141'],
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
