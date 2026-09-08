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

  // 161.38.204.0/22, inside Mailgun's own ARIN allocation 161.38.192.0/20, so
  // this survives the SPF record being re-cut in a way a host address would not.
  testAddresses: ['161.38.204.1'],

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
