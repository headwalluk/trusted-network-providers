/**
 * private.js
 */

module.exports = {
  name: 'Private',
  testAddresses: ['127.0.0.1', '192.168.0.20', '192.168.100.20', '10.1.2.3'],
  ipv4: {
    addresses: [],
    ranges: ['10.0.0.0/8', '127.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4'],
  },
  ipv6: {
    addresses: [],
    ranges: ['fc00::/7', 'fd00::/8'],
  },
};
