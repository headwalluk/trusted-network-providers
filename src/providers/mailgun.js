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

  // One address from each half of the include tree: 161.38.204.0/22 comes from
  // _spf.eu.mailgun.org, 69.72.32.0/20 from _spf1.mailgun.org two levels down.
  // A regression in nested-include resolution then fails the test rather than
  // silently halving the ranges.
  testAddresses: ['161.38.204.1', '69.72.36.213'],

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
