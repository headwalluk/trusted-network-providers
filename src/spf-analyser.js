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
import logger from './utils/logger.js';

export default async (domain, provider) => {
  try {
    const records = await dns.resolveTxt(domain);
    const sourceNetblocks = [];

    // Step 1: Parse the root TXT records to find SPF includes
    // DNS TXT records can be arrays of strings (for long records split across multiple DNS strings)
    for (const record of records) {
      if (Array.isArray(record)) {
        for (const subRecord of record) {
          const fields = subRecord.split(' ');
          let isSpf = false;

          // Walk through each SPF field (space-delimited)
          for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
            const field = fields[fieldIndex];

            // First field must be "v=spf1" to be a valid SPF record
            if (fieldIndex === 0 && field === 'v=spf1') {
              isSpf = true;
            }

            // Extract "include:" domains to resolve (e.g., "include:_netblocks.google.com")
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

    // Early exit: If no SPF includes found, the DNS record is incomplete or invalid
    if (sourceNetblocks.length === 0) {
      logger.info(`Not updating ${provider.name} addresses because no SPF netblocks found`);
      return;
    }

    // Step 2: Resolve all include domains in parallel
    // Use allSettled (not all) to allow some lookups to fail without aborting the whole operation
    const lookups = sourceNetblocks.map((sourceNetblock) => dns.resolveTxt(sourceNetblock));
    const lookupResults = await Promise.allSettled(lookups);

    // Filter out failed DNS lookups and log them
    // This is resilient to partial failures (e.g., one netblock domain is down)
    const successfulResults = [];
    for (let i = 0; i < lookupResults.length; i++) {
      const result = lookupResults[i];
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        logger.error(
          `Failed to resolve SPF include ${sourceNetblocks[i]} for ${provider.name}: ${result.reason.message}`
        );
      }
    }

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

    // Step 3: Reconstruct full TXT records from DNS response fragments
    // DNS TXT records can be split into multiple strings (255 char limit per string)
    const spfRecords = [];

    for (const lookupResult of successfulResults) {
      if (Array.isArray(lookupResult)) {
        for (const subRecord of lookupResult) {
          let txtRecord = '';
          // Concatenate fragmented TXT record strings into a single record
          if (Array.isArray(subRecord) && subRecord.length > 0) {
            for (const partialTxtRecord of subRecord) {
              txtRecord += partialTxtRecord;
            }

            // Only process valid SPF records
            if (txtRecord.length > 0 && txtRecord.startsWith('v=spf1 ')) {
              spfRecords.push(txtRecord);
            }
          }
        }
      }
    }

    // Step 4: Extract IP addresses and CIDR ranges from SPF records
    for (const spfRecord of spfRecords) {
      const fields = spfRecord.split(' ');
      for (const field of fields) {
        const components = field.split(':');
        if (components.length < 1) {
          continue;
        }

        // Parse IPv4 addresses and ranges (e.g., "ip4:35.190.247.0/24")
        if (components[0] === 'ip4') {
          const possibleAddress = components[1];
          // CIDR range if it contains a slash (e.g., /24)
          if (possibleAddress.indexOf('/') > 0) {
            newAddresses.ipv4.ranges.push(possibleAddress);
          } else {
            newAddresses.ipv4.addresses.push(possibleAddress);
          }
        } else if (components[0] === 'ip6') {
          // Parse IPv6 addresses and ranges (e.g., "ip6:2001:4860:4000::/36")
          // IPv6 uses colon notation, so we can't split on ':' — use substring instead
          const possibleAddress = field.substring(4); // Skip "ip6:"
          if (possibleAddress.indexOf('/') > 0) {
            newAddresses.ipv6.ranges.push(possibleAddress);
          } else {
            newAddresses.ipv6.addresses.push(possibleAddress);
          }
        }
      }
    }

    // Step 5: Atomically replace provider data
    // Clear arrays in place to maintain references, then copy new data
    provider.ipv4.ranges.length = 0;
    provider.ipv4.addresses.length = 0;
    provider.ipv6.ranges.length = 0;
    provider.ipv6.addresses.length = 0;

    Object.assign(provider, newAddresses);
  } catch (error) {
    logger.error(`Failed to analyse SPF records for ${provider.name}: ${error.message}`);
    throw error;
  }
};
