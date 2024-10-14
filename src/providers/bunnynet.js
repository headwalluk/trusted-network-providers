/**
 * bunnynet.js
 */

const ipaddr = require('ipaddr.js');

const self = {
  name: 'BunnyNet',
  testAddresses: ['193.162.131.1', '200.25.16.103', '2400:52e0:1a01::907:1'],
  reload: () => {
    return new Promise((resolve, reject) => {
      while (self.ipv4.ranges.length > 0) {
        self.ipv4.ranges.pop();
      }

      while (self.ipv6.ranges.length > 0) {
        self.ipv6.ranges.pop();
      }

      const newIps = [];
      const sources = ['../assets/bunnynet-ip4s.json', '../assets/bunnynet-ip6s.json'];

      sources.forEach((source) => {
        newIps.push(...require(source));
      });

      newIps.forEach((address) => {
        const parsedIp = ipaddr.parse(address);

        if (parsedIp.kind() == 'ipv4') {
          // console.log(`${self.name} (ipv4) : ${address}`);
          self.ipv4.addresses.push(address);
        } else if (parsedIp.kind() == 'ipv6') {
          // console.log(`${self.name} (ipv6) : ${address}`);
          self.ipv6.addresses.push(address);
        } else {
          // Unsupported address type.
        }
      });

      resolve();
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
