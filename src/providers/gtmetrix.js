/**
 * gtmetrix.js
 */

const ipaddr = require('ipaddr.js');

const superagent = require('superagent');
const { XMLParser } = require('fast-xml-parser');

const GTMETRIX_ADDRESS_LIST_URL = 'https://gtmetrix.com/locations.xml';

const self = {
  name: 'GTmetrix',

  testAddresses: ['172.255.48.147'],

  reload: () => {
    return superagent
      .get(`${GTMETRIX_ADDRESS_LIST_URL}`)
      .accept('xml')
      .timeout({
        response: 5000, // Wait 5 seconds for the server to start sending,
        deadline: 60000, // but allow 1 minute for the file to finish loading.
      })
      .then((result) => {
        const parser = new XMLParser();
        const gtmetrixData = parser.parse(result.body.toString());

        if (gtmetrixData.rss && gtmetrixData.rss.channel && gtmetrixData.rss.channel.item && Array.isArray(gtmetrixData.rss.channel.item)) {
          // DIAGNOSTICS
          // console.log(gtmetrixData);

          while (self.ipv4.addresses.length > 0) {
            self.ipv4.addresses.pop();
          }

          while (self.ipv6.addresses.length > 0) {
            self.ipv6.addresses.pop();
          }

          gtmetrixData.rss.channel.item.forEach((serverMeta) => {
            try {
              const parsedIp = ipaddr.parse(serverMeta['gtmetrix:ip']);

              // DIAGNOSTICS
              // console.log( `${parsedIp.toString()} (${parsedIp.kind()})` );

              if (parsedIp.kind() == 'ipv4') {
                self.ipv4.addresses.push(parsedIp.toString());
              } else if (parsedIp.kind() == 'ipv6') {
                self.ipv6.addresses.push(parsedIp.toString());
              } else {
                // Unsupported address type.
              }
            } catch (error) {
              console.error('Failed to parse GTmetrix IP address');
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
