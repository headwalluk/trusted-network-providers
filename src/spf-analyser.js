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

export default (domain, provider) => {
  return new Promise((resolve) => {
    dns.resolveTxt(domain).then((records) => {
      const sourceNetblocks = [];
      const errorCount = 0;

      records.forEach((record) => {
        if (Array.isArray(record)) {
          record.forEach((subRecord) => {
            const fields = subRecord.split(' ');
            let isSpf = false;
            let fieldIndex = 0;
            fields.forEach((field) => {
              if (isSpf && field.startsWith('include:')) {
                const components = field.split(':');
                if (components.length === 2) {
                  const potentialNetblock = components[1];
                  if (!sourceNetblocks.includes(potentialNetblock)) {
                    sourceNetblocks.push(potentialNetblock);
                  }
                }
              }

              if (fieldIndex === 0 && field === 'v=spf1') {
                isSpf = true;
              }

              ++fieldIndex;
            });
          });
        }
      });

      // console.log();
      // console.log(sourceNetblocks);
      // console.log();

      const lookups = [];

      sourceNetblocks.forEach((sourceNetblock) => {
        lookups.push(dns.resolveTxt(sourceNetblock));
      });

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

      Promise.all(lookups).then((lookupResults) => {
        // console.log(lookupResults);
        // console.log();
        //
        const spfRecords = [];

        lookupResults.forEach((lookupResult) => {
          // console.log(`Result`);
          // console.log(lookupResult);
          // console.log();

          if (Array.isArray(lookupResult)) {
            lookupResult.forEach((subRecord) => {
              // DIAGNOSTICS
              let txtRecord = '';
              if (Array.isArray(subRecord) && subRecord.length > 0) {
                subRecord.forEach((partialTxtRecord) => {
                  txtRecord += partialTxtRecord;
                });

                if (txtRecord.length > 0 && txtRecord.startsWith('v=spf1 ')) {
                  spfRecords.push(txtRecord);
                }
              }
            });
          }
        });

        // DIAGNOSTICS
        // console.log(`SPFRECORDS: ${spfRecords.length}`);
        // console.log(spfRecords);
        // console.log();

        spfRecords.forEach((spfRecord) => {
          const fields = spfRecord.split(' ');
          fields.forEach((field) => {
            const components = field.split(':');
            if (components.length < 1) {
              // ...
            } else if (components[0] === 'ip4') {
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
            } else if (components[0] === 'include') {
              // Handle include directives (recursive SPF lookups)
              // Not implemented in this version
            } else {
              // ...
            }
          });
        });

        if (sourceNetblocks.length === 0) {
          console.log(`Not updating ${domain.name} addresses because of initial SPF error`);
          resolve();
        } else if (errorCount > 0) {
          console.log(`Not updating ${domain.name} addresses because of errors (${errorCount})`);
          resolve();
        } else {
          // Clear existing data
          provider.ipv4.ranges.length = 0;
          provider.ipv4.addresses.length = 0;
          provider.ipv6.ranges.length = 0;
          provider.ipv6.addresses.length = 0;

          Object.assign(provider, newAddresses);

          resolve();
        }
      });
    });
  });
};
