/**
 * gtmetrix.js
 */

import ipaddr from 'ipaddr.js';
import { fetchXML } from '../utils/secure-http-client.js';
import { XMLParser } from 'fast-xml-parser';

const GTMETRIX_ADDRESS_LIST_URL = 'https://gtmetrix.com/locations.xml';

const self = {
  name: 'GTmetrix',

  testAddresses: ['172.255.48.147'],

  reload: async () => {
    try {
      const xmlBody = await fetchXML(GTMETRIX_ADDRESS_LIST_URL, {
        timeout: 60000, // Allow 1 minute for XML download
      });

      const parser = new XMLParser();
      const gtmetrixData = parser.parse(xmlBody.toString());

      if (
        gtmetrixData.rss &&
        gtmetrixData.rss.channel &&
        gtmetrixData.rss.channel.item &&
        Array.isArray(gtmetrixData.rss.channel.item)
      ) {
        // Clear existing addresses
        self.ipv4.addresses.length = 0;
        self.ipv6.addresses.length = 0;

        gtmetrixData.rss.channel.item.forEach((serverMeta) => {
          try {
            const parsedIp = ipaddr.parse(serverMeta['gtmetrix:ip']);

            if (parsedIp.kind() === 'ipv4') {
              self.ipv4.addresses.push(parsedIp.toString());
            } else if (parsedIp.kind() === 'ipv6') {
              self.ipv6.addresses.push(parsedIp.toString());
            }
          } catch (error) {
            console.error(`Failed to parse GTmetrix IP address: ${error.message}`);
          }
        });
      } else {
        throw new Error('Invalid response format from GTmetrix');
      }
    } catch (error) {
      console.error(`Failed to reload GTmetrix IPs: ${error.message}`);
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
