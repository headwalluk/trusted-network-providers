/**
 * cloudflare-dns.js
 *
 * Cloudflare public DNS resolvers (1.1.1.1 and the 1.1.1.2/.3 filtered variants).
 * Must be registered before the Cloudflare CDN provider: its IPv6 range sits inside 2606:4700::/32.
 */

export default {
  name: 'Cloudflare DNS',
  testAddresses: ['1.1.1.1', '1.0.0.1', '1.1.1.3', '2606:4700:4700::1111', '2606:4700:4700::1001'],
  ipv4: {
    addresses: [],
    ranges: ['1.1.1.0/24', '1.0.0.0/24'],
  },
  ipv6: {
    addresses: [],
    ranges: ['2606:4700:4700::/48'],
  },
};
