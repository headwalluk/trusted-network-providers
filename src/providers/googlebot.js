/**
 * googlebot.js
 */

const superagent = require('superagent');

const GOOGLE_ADDRESS_LIST_URL = 'https://developers.google.com/static/search/apis/ipranges/googlebot.json';

const self = {
  name: 'Googlebot',
  testAddresses: ['66.249.66.87', '66.249.70.93'],
  reload: () => {
    return new Promise((resolve, reject) => {
      while (self.ipv4.ranges.length > 0) {
        self.ipv4.ranges.pop();
      }

      while (self.ipv6.ranges.length > 0) {
        self.ipv6.ranges.pop();
      }

      const newIps = require('../assets/googlebot-ips.json');
      newIps.prefixes.forEach((range) => {
        if (range.ipv4Prefix) {
          // console.log(`${self.name} (ipv4) : ${range.ipv4Prefix}`);
          self.ipv4.ranges.push(range.ipv4Prefix);
        }

        if (range.ipv6Prefix) {
          // console.log(`${self.name} (ipv6) : ${range.ipv6Prefix}`);
          self.ipv6.ranges.push(range.ipv6Prefix);
        }
      });

      resolve();
    });
  },
  reloadFromWeb: () => {
    return superagent
      .get(`${GOOGLE_ADDRESS_LIST_URL}`)
      .accept('json')
      .then((result) => {
        if (result.body && result.body.prefixes && Array.isArray(result.body.prefixes)) {
          while (self.ipv4.ranges.length > 0) {
            self.ipv4.ranges.pop();
          }

          while (self.ipv6.ranges.length > 0) {
            self.ipv6.ranges.pop();
          }

          result.body.prefixes.forEach((range) => {
            if (range.ipv4Prefix) {
              // console.log(`${self.name} (ipv4) : ${range.ipv4Prefix}`);
              self.ipv4.ranges.push(range.ipv4Prefix);
            }

            if (range.ipv6Prefix) {
              // console.log(`${self.name} (ipv6) : ${range.ipv6Prefix}`);
              self.ipv6.ranges.push(range.ipv6Prefix);
            }
          });
        }
      });
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

module.exports = self;
