/**
 * stripe-webhooks.js
 */

const superagent = require('superagent');

const STRIPE_ADDRESSES_URL = 'https://stripe.com/files/ips/ips_webhooks.json';

const self = {
  name: 'Stripe Webhooks',
  reload: () => {
    return superagent
      .get(STRIPE_ADDRESSES_URL)
      .accept('json')
      .then((result) => {
        if (result.body && result.body.WEBHOOKS && Array.isArray(result.body.WEBHOOKS)) {
          while (self.ipv4.addresses.length > 0) {
            self.ipv4.addresses.pop();
          }

          result.body.WEBHOOKS.forEach((ipAddress) => {
            self.ipv4.addresses.push(ipAddress);
          });
        }
      });
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

module.exports = self;
