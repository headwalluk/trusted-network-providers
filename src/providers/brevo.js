/**
 * brevo.js
 *
 * REF: https://help.brevo.com/hc/en-us/articles/208848409--Brevo-IP-ranges-improve-the-deliverability-of-B2B-emails
 */

export default {
  name: 'Brevo',
  testAddresses: ['1.179.112.12', '212.146.244.34'],
  ipv4: {
    addresses: [],
    ranges: ['1.179.112.0/20', '77.32.148.0/24', '77.32.149.0/24', '185.41.28.0/24', '212.146.244.0/24'],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
};
