/**
 * google-workspace.js
 *
 * REF: https://support.google.com/a/answer/60764
 *
 * SECURITY NOTE: This provider uses DNS SPF lookups which are NOT DNSSEC-validated.
 * For production use in high-security environments, consider using bundled assets
 * instead of runtime DNS lookups.
 *
 * See: docs/security.md - DNS-Based Providers section
 */

import spfAnalyser from '../spf-analyser.js';

const self = {
  name: 'Google Workspace',
  testAddresses: ['74.125.0.1'],
  ipv4: {
    addresses: [],
    ranges: [],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
  reload: async () => {
    return await spfAnalyser('_spf.google.com', self);
  },
};

export default self;
