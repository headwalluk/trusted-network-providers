/**
 * google-workspace.js
 *
 * REF: https://support.google.com/a/answer/60764
 */

const spfAnalyser = require('../spf-analyser');

const self = {
  name: 'Google Workspace',
  testAddresses: ['216.58.192.190'],
  ipv4: {
    addresses: [],
    ranges: [],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
  reload: () => {
    return spfAnalyser('_spf.google.com', self);
  },
};

module.exports = self;
