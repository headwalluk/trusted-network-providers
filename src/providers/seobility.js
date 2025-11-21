/**
 * seobility.js
 */

const { fetchText } = require('../utils/secure-http-client');
const ipaddr = require('ipaddr.js');

const self = {
  name: 'Seobility',
  sources: {
    ipv4: 'https://www.seobility.net/static/ip_lists/bots/ipv4.txt',
    ipv6: 'https://www.seobility.net/static/ip_lists/bots/ipv6.txt',
  },
  reload: () => {
    const requests = [];

    for (const addressListType in self.sources) {
      const addressListUrl = self.sources[addressListType];

      requests.push(
        fetchText(addressListUrl)
          .then((text) => {
            if (!text) {
              console.error(`Failed to fetch ${addressListType} from ${addressListUrl}`);
            } else {
              // Clear existing data
              self[addressListType].addresses.length = 0;
              self[addressListType].ranges.length = 0;

              const records = text.split('\n');
              records.forEach((record) => {
                const trimmed = record.trim();
                if (trimmed && ipaddr.isValid(trimmed) && !self[addressListType].addresses.includes(trimmed)) {
                  self[addressListType].addresses.push(trimmed);
                }
              });
            }
          })
          .catch((error) => {
            console.error(`Failed to reload Seobility ${addressListType} IPs: ${error.message}`);
            throw error;
          })
      );
    }

    return requests;
  },
  testAddresses: ['159.69.152.187', '2a01:4f8:1c1c:4064::1'],
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
