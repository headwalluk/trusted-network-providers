/**
 * facebookbot.js
 */

const fs = require('node:fs');
const path = require('node:path');

const self = {
  name: 'FacebookBot',
  testAddresses: ['57.141.0.3'],
  reload: () => {
    return new Promise((resolve, reject) => {
      while (self.ipv4.ranges.length > 0) {
        self.ipv4.ranges.pop();
      }

      while (self.ipv6.ranges.length > 0) {
        self.ipv6.ranges.pop();
      }

      try {
        const ranges = fs.readFileSync(path.resolve(__dirname, '../assets/facebookbot-ip4s.txt'), 'utf8').split('\n');
        ranges.forEach((range) => {
          if (range.length) {
            self.ipv4.ranges.push(range);
          }
        });
      } catch (err) {
        console.error(err);
      }

      try {
        const ranges = fs.readFileSync(path.resolve(__dirname, '../assets/facebookbot-ip6s.txt'), 'utf8').split('\n');
        ranges.forEach((range) => {
          if (range.length) {
            self.ipv6.ranges.push(range);
          }
        });
      } catch (err) {
        console.error(err);
      }

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
