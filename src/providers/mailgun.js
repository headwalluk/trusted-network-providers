/**
 * mailgun.js
 */

const spfAnalyser = require('../spf-analyser');

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

  reload: () => {
    return spfAnalyser('mailgun.org', self);
  },
};

module.exports = self;
