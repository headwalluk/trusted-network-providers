/**
 * opendns.js
 *
 * Cisco OpenDNS / Umbrella public DNS resolvers, including FamilyShield.
 */

export default {
  name: 'OpenDNS',
  testAddresses: ['208.67.222.222', '208.67.220.220', '208.67.222.123', '2620:119:35::35', '2620:0:ccc::2'],
  ipv4: {
    addresses: [],
    ranges: ['208.67.222.0/24', '208.67.220.0/24'],
  },
  ipv6: {
    addresses: [],
    ranges: ['2620:119:35::/48', '2620:119:53::/48', '2620:0:ccc::/48', '2620:0:ccd::/48'],
  },
};
