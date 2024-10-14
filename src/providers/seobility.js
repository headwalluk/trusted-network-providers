/**
 * seobility.js
 */

const superagent = require('superagent');
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
        superagent
          .get(addressListUrl)
          .accept('text/plain')
          .then((result) => {
            if (!result.text) {
              console.error(`Failed to fetch ${addressListType} from ${addressListUrl}`);
            } else {
              while (self[addressListType].addresses.length > 0) {
                self[addressListType].addresses.pop();
              }

              while (self[addressListType].ranges.length > 0) {
                self[addressListType].ranges.pop();
              }

              records = result.text.split('\n');
              records.forEach((record) => {
                if (ipaddr.isValid(record) && !self[addressListType].addresses.includes(record)) {
                  // console.log( `Add ${addressListType} => ${record}`);
                  self[addressListType].addresses.push(record);
                }
              });
            }
          }),
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
