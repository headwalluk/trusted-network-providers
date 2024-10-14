/**
 * stripe-api.js
 */

const superagent = require('superagent');

const STRIPE_ADDRESSES_URL = 'https://stripe.com/files/ips/ips_api.json';

const self = {
  name: 'Stripe API',
  reload: () => {
    return superagent
      .get(`${STRIPE_ADDRESSES_URL}`)
      .accept('json')
      .then((result) => {
        if (result.body && result.body.API && Array.isArray(result.body.API)) {
          while (self.ipv4.addresses.length > 0) {
            self.ipv4.addresses.pop();
          }

          result.body.API.forEach((ipAddress) => {
            self.ipv4.addresses.push(ipAddress);
          });
        }
      });
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

module.exports = self;
