/**
 * spf-analyser.js
 *
 * Extracts IP addresses from DNS SPF (Sender Policy Framework) records.
 *
 * Handles both shapes an SPF record can take: `ip4:`/`ip6:` directives written
 * inline, and `include:` targets whose own records carry them. Google flattened
 * _spf.google.com from the second shape to the first, so reading only includes
 * silently yields nothing.
 *
 * SECURITY WARNING: This module does NOT perform DNSSEC validation.
 * DNS responses are not cryptographically verified and could be spoofed
 * via DNS poisoning attacks.
 *
 * Mitigations:
 * - Use DNSSEC-validating DNS resolvers (e.g., 1.1.1.1, 8.8.8.8)
 * - Unregister the provider entirely, if runtime DNS is unacceptable
 * - Verify DNS records out-of-band when possible
 *
 * See docs/dns-security-guide.md.
 */

import dns from 'node:dns/promises';
import logger from './utils/logger.js';

// RFC 7208 §4.6.4 caps an SPF evaluation at 10 DNS-querying mechanisms. Includes
// nest — mailgun.org points at _spf.mailgun.org, which points at _spf1/_spf2 —
// so resolution walks the chain rather than stopping at the first level.
const MAX_SPF_DNS_LOOKUPS = 10;

/**
 * Join one TXT answer's fragments into a single record string.
 * DNS splits TXT records longer than 255 characters across several strings.
 */
const joinTxtFragments = (txtAnswer) => {
  let record = '';

  if (Array.isArray(txtAnswer)) {
    record = txtAnswer.join('');
  } else if (typeof txtAnswer === 'string') {
    record = txtAnswer;
  }

  return record;
};

/**
 * Reduce a resolveTxt() result to the SPF records it contains.
 */
const extractSpfRecords = (txtAnswers) => {
  const spfRecords = [];

  for (const txtAnswer of txtAnswers) {
    const record = joinTxtFragments(txtAnswer);
    if (record.startsWith('v=spf1 ') || record === 'v=spf1') {
      spfRecords.push(record);
    }
  }

  return spfRecords;
};

/**
 * Read one SPF record, adding its inline IPs to `collected` and its include
 * targets to `includeTargets`.
 */
const readSpfRecord = (spfRecord, collected, includeTargets) => {
  const fields = spfRecord.split(' ');

  for (const field of fields) {
    const components = field.split(':');

    if (field.startsWith('include:')) {
      // Only a bare "include:domain" is usable; anything with further colons is malformed.
      if (components.length === 2 && !includeTargets.includes(components[1])) {
        includeTargets.push(components[1]);
      }
    } else if (components[0] === 'ip4') {
      const possibleAddress = components[1];
      if (possibleAddress !== undefined) {
        if (possibleAddress.indexOf('/') > 0) {
          collected.ipv4.ranges.push(possibleAddress);
        } else {
          collected.ipv4.addresses.push(possibleAddress);
        }
      }
    } else if (components[0] === 'ip6') {
      // IPv6 uses colon notation, so we can't split on ':' — use substring instead
      const possibleAddress = field.substring(4); // Skip "ip6:"
      if (possibleAddress.indexOf('/') > 0) {
        collected.ipv6.ranges.push(possibleAddress);
      } else {
        collected.ipv6.addresses.push(possibleAddress);
      }
    }
  }
};

/** Total number of addresses and ranges gathered across both IP versions. */
const countCollected = (collected) =>
  collected.ipv4.addresses.length +
  collected.ipv4.ranges.length +
  collected.ipv6.addresses.length +
  collected.ipv6.ranges.length;

export default async (domain, provider) => {
  try {
    const collected = {
      ipv4: {
        addresses: [],
        ranges: [],
      },
      ipv6: {
        addresses: [],
        ranges: [],
      },
    };
    const includeTargets = [];

    // Step 1: Read the root record — inline IPs count, and includes are queued
    const rootRecords = extractSpfRecords(await dns.resolveTxt(domain));
    for (const spfRecord of rootRecords) {
      readSpfRecord(spfRecord, collected, includeTargets);
    }

    // Step 2: Walk the include chain a level at a time, resolving each level in
    // parallel. readSpfRecord() appends anything it finds to includeTargets, so
    // the next level is whatever this one added. allSettled (not all) lets some
    // lookups fail without losing the rest.
    const resolvedTargets = new Set();
    let pendingTargets = includeTargets.filter((target) => !resolvedTargets.has(target));

    while (pendingTargets.length > 0 && resolvedTargets.size < MAX_SPF_DNS_LOOKUPS) {
      const currentLevel = pendingTargets.slice(0, MAX_SPF_DNS_LOOKUPS - resolvedTargets.size);
      for (const target of currentLevel) {
        resolvedTargets.add(target);
      }

      const lookupResults = await Promise.allSettled(currentLevel.map((target) => dns.resolveTxt(target)));

      for (let resultIndex = 0; resultIndex < lookupResults.length; resultIndex++) {
        const result = lookupResults[resultIndex];
        if (result.status === 'fulfilled') {
          for (const spfRecord of extractSpfRecords(result.value)) {
            readSpfRecord(spfRecord, collected, includeTargets);
          }
        } else {
          logger.error(
            `Failed to resolve SPF include ${currentLevel[resultIndex]} for ${provider.name}: ${result.reason.message}`
          );
        }
      }

      pendingTargets = includeTargets.filter((target) => !resolvedTargets.has(target));
    }

    if (pendingTargets.length > 0) {
      logger.error(
        `Stopped resolving SPF includes for ${provider.name} at the ${MAX_SPF_DNS_LOOKUPS}-lookup limit; ` +
          `not followed: ${pendingTargets.join(', ')}`
      );
    }

    // Step 3: Replace provider data, but never with nothing. An SPF record that
    // yields no IPs means the record changed shape or the lookup was poisoned;
    // either way the previous data is better than an empty provider that
    // silently reports every address as untrusted.
    if (countCollected(collected) > 0) {
      Object.assign(provider, collected);
    } else {
      logger.error(`Not updating ${provider.name} addresses because no SPF netblocks found`);
    }
  } catch (error) {
    logger.error(`Failed to analyse SPF records for ${provider.name}: ${error.message}`);
    throw error;
  }
};
