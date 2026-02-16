/**
 * spf-analyser.js
 *
 * Extracts IP addresses from DNS SPF (Sender Policy Framework) records.
 *
 * SECURITY WARNING: This module does NOT perform DNSSEC validation.
 * DNS responses are not cryptographically verified and could be spoofed
 * via DNS poisoning attacks.
 *
 * Mitigations:
 * - Use DNSSEC-validating DNS resolvers (e.g., 1.1.1.1, 8.8.8.8)
 * - Run update-assets.sh to fetch SPF data at build time instead of runtime
 * - Use bundled assets in high-security environments
 * - Verify DNS records out-of-band when possible
 *
 * For production use, consider disabling runtime DNS lookups and relying
 * on bundled assets that are updated via the build process.
 */

import dns from 'node:dns/promises';

export default async (domain, provider) => {
  try {
    const records = await dns.resolveTxt(domain);
    const sourceNetblocks = [];

    for (const record of records) {
      if (Array.isArray(record)) {
        for (const subRecord of record) {
          const fields = subRecord.split(' ');
          let isSpf = false;

          for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
            const field = fields[fieldIndex];

            if (fieldIndex === 0 && field === 'v=spf1') {
              isSpf = true;
            }

            if (isSpf && field.startsWith('include:')) {
              const components = field.split(':');
              if (components.length === 2) {
                const potentialNetblock = components[1];
                if (!sourceNetblocks.includes(potentialNetblock)) {
                  sourceNetblocks.push(potentialNetblock);
                }
              }
            }
          }
        }
      }
    }

    if (sourceNetblocks.length === 0) {
      console.log(`Not updating ${provider.name} addresses because no SPF netblocks found`);
      return;
    }

    const lookups = sourceNetblocks.map((sourceNetblock) => dns.resolveTxt(sourceNetblock));
    const lookupResults = await Promise.all(lookups);

    const newAddresses = {
      ipv4: {
        addresses: [],
        ranges: [],
      },
      ipv6: {
        addresses: [],
        ranges: [],
      },
    };

    const spfRecords = [];

    for (const lookupResult of lookupResults) {
      if (Array.isArray(lookupResult)) {
        for (const subRecord of lookupResult) {
          let txtRecord = '';
          if (Array.isArray(subRecord) && subRecord.length > 0) {
            for (const partialTxtRecord of subRecord) {
              txtRecord += partialTxtRecord;
            }

            if (txtRecord.length > 0 && txtRecord.startsWith('v=spf1 ')) {
              spfRecords.push(txtRecord);
            }
          }
        }
      }
    }

    for (const spfRecord of spfRecords) {
      const fields = spfRecord.split(' ');
      for (const field of fields) {
        const components = field.split(':');
        if (components.length < 1) {
          continue;
        }

        if (components[0] === 'ip4') {
          const possibleAddress = components[1];
          if (possibleAddress.indexOf('/') > 0) {
            newAddresses.ipv4.ranges.push(possibleAddress);
          } else {
            newAddresses.ipv4.addresses.push(possibleAddress);
          }
        } else if (components[0] === 'ip6') {
          const possibleAddress = field.substring(4);
          if (possibleAddress.indexOf('/') > 0) {
            newAddresses.ipv6.ranges.push(possibleAddress);
          } else {
            newAddresses.ipv6.addresses.push(possibleAddress);
          }
        }
      }
    }

    // Clear existing data
    provider.ipv4.ranges.length = 0;
    provider.ipv4.addresses.length = 0;
    provider.ipv6.ranges.length = 0;
    provider.ipv6.addresses.length = 0;

    Object.assign(provider, newAddresses);
  } catch (error) {
    console.error(`Failed to analyse SPF records for ${provider.name}: ${error.message}`);
    throw error;
  }
};
