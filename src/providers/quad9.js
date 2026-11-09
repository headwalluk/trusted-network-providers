/**
 * quad9.js
 *
 * Quad9 public DNS resolvers, including the unfiltered (.10) and ECS (.11) variants.
 */

export default {
  name: 'Quad9',
  testAddresses: ['9.9.9.9', '149.112.112.112', '9.9.9.10', '2620:fe::fe', '2620:fe::9'],
  ipv4: {
    addresses: [],
    ranges: ['9.9.9.0/24', '149.112.112.0/24'],
  },
  ipv6: {
    addresses: [],
    ranges: ['2620:fe::/48'],
  },
};
