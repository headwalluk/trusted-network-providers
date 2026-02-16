/**
 * mailgun.js
 *
 * SECURITY NOTE: This provider uses DNS SPF lookups which are NOT DNSSEC-validated.
 * For production use in high-security environments, consider using bundled assets
 * instead of runtime DNS lookups.
 *
 * See: docs/security.md - DNS-Based Providers section
 */

import spfAnalyser from '../spf-analyser.js';

const self = {
  name: 'Mailgun',

  testAddresses: ['69.72.36.213'],

  ipv4: {
    addresses: [],
    ranges: [],
  },

  ipv6: {
    addresses: [],
    ranges: [],
  },

  reload: async () => {
    return await spfAnalyser('mailgun.org', self);
  },
};

export default self;
