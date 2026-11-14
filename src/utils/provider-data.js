/**
 * provider-data.js
 *
 * Builds, validates and installs provider IP data. A reload builds a complete
 * snapshot first and installs it in one synchronous step, so a failed reload
 * leaves the previous data untouched rather than empty or half-replaced.
 */

import ipaddr from 'ipaddr.js';

const IP_FAMILIES = ['ipv4', 'ipv6'];

// Maximum combined addresses and ranges per provider
const MAX_ENTRIES_PER_PROVIDER = 10000;

// Problems listed individually in an error message before the rest are counted
const MAX_REPORTED_PROBLEMS = 10;

const dataReplacedListeners = new Set();

/** Registers a callback that runs after any provider's data is replaced. */
const onProviderDataReplaced = (listener) => {
  dataReplacedListeners.add(listener);
};

/** Returns an empty snapshot: both families, no addresses, no ranges. */
const createEmptySnapshot = () => ({
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
});

/** Returns the family ('ipv4' | 'ipv6') of an address string, or null if it does not parse. */
const addressFamily = (address) => {
  let family = null;
  if (typeof address === 'string' && ipaddr.isValid(address)) {
    family = ipaddr.parse(address).kind();
  }
  return family;
};

/** Returns the family of a CIDR string, or null if it is not a valid CIDR. */
const rangeFamily = (range) => {
  let family = null;
  if (typeof range === 'string' && ipaddr.isValidCIDR(range)) {
    family = ipaddr.parseCIDR(range)[0].kind();
  }
  return family;
};

/** Lists every structural, syntax and family problem in a snapshot. */
const findSnapshotProblems = (snapshot) => {
  const problems = [];
  let entryCount = 0;

  for (const family of IP_FAMILIES) {
    const pool = snapshot?.[family];
    if (!pool || typeof pool !== 'object') {
      problems.push(`${family}: missing`);
      continue;
    }

    for (const listName of ['addresses', 'ranges']) {
      if (!Array.isArray(pool[listName])) {
        problems.push(`${family}.${listName}: not an array`);
        continue;
      }

      entryCount += pool[listName].length;
      const familyOf = listName === 'addresses' ? addressFamily : rangeFamily;
      for (const entry of pool[listName]) {
        const entryFamily = familyOf(entry);
        if (entryFamily === null) {
          problems.push(`${family}.${listName}: invalid entry ${JSON.stringify(entry)}`);
        } else if (entryFamily !== family) {
          problems.push(`${family}.${listName}: ${entry} is ${entryFamily}`);
        }
      }
    }
  }

  if (entryCount > MAX_ENTRIES_PER_PROVIDER) {
    problems.push(`${entryCount} entries exceeds the limit of ${MAX_ENTRIES_PER_PROVIDER}`);
  }

  return { problems, entryCount };
};

/** Formats a problem list for an error message, truncating long lists. */
const describeProblems = (problems) => {
  const shown = problems.slice(0, MAX_REPORTED_PROBLEMS).join('; ');
  const hiddenCount = problems.length - MAX_REPORTED_PROBLEMS;
  return hiddenCount > 0 ? `${shown}; and ${hiddenCount} more` : shown;
};

/** Throws, listing every problem, unless the snapshot is valid (and non-empty when required). */
const validateSnapshot = (providerName, snapshot, { requireData = true } = {}) => {
  const { problems, entryCount } = findSnapshotProblems(snapshot);

  if (requireData && problems.length === 0 && entryCount === 0) {
    problems.push('no addresses or ranges');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid IP data for ${providerName}: ${describeProblems(problems)}`);
  }
};

/**
 * Validates a snapshot, then copies it into the provider's existing arrays in
 * one synchronous step and notifies listeners. Throws without touching the
 * provider if the snapshot is invalid.
 */
const replaceProviderData = (provider, snapshot, options = {}) => {
  validateSnapshot(provider.name, snapshot, options);

  for (const family of IP_FAMILIES) {
    if (!provider[family]) {
      provider[family] = { addresses: [], ranges: [] };
    }

    for (const listName of ['addresses', 'ranges']) {
      if (!Array.isArray(provider[family][listName])) {
        provider[family][listName] = [];
      }

      // In place, so callers holding a reference to the array see the new data
      const target = provider[family][listName];
      target.length = 0;
      for (const entry of snapshot[family][listName]) {
        target.push(entry);
      }
    }
  }

  for (const listener of dataReplacedListeners) {
    listener(provider);
  }
};

/** Builds a snapshot from a Google-style `prefixes` array of { ipv4Prefix } / { ipv6Prefix } objects. */
const snapshotFromPrefixes = (prefixes) => {
  if (!Array.isArray(prefixes)) {
    throw new Error('Expected a "prefixes" array');
  }

  const snapshot = createEmptySnapshot();
  const problems = [];

  for (const [entryIndex, entry] of prefixes.entries()) {
    const hasPrefix = entry?.ipv4Prefix !== undefined || entry?.ipv6Prefix !== undefined;
    if (!entry || typeof entry !== 'object' || !hasPrefix) {
      problems.push(`prefixes[${entryIndex}]: no ipv4Prefix or ipv6Prefix`);
      continue;
    }

    if (entry.ipv4Prefix !== undefined) {
      snapshot.ipv4.ranges.push(entry.ipv4Prefix);
    }

    if (entry.ipv6Prefix !== undefined) {
      snapshot.ipv6.ranges.push(entry.ipv6Prefix);
    }
  }

  if (problems.length > 0) {
    throw new Error(describeProblems(problems));
  }

  return snapshot;
};

/** Builds a snapshot from a flat array of exact addresses of either family. */
const snapshotFromAddressList = (addresses) => {
  if (!Array.isArray(addresses)) {
    throw new Error('Expected an array of addresses');
  }

  const snapshot = createEmptySnapshot();
  const problems = [];

  for (const address of addresses) {
    const family = addressFamily(address);
    if (family === null) {
      problems.push(`invalid address ${JSON.stringify(address)}`);
    } else {
      snapshot[family].addresses.push(address);
    }
  }

  if (problems.length > 0) {
    throw new Error(describeProblems(problems));
  }

  return snapshot;
};

/** Returns the non-blank, trimmed lines of a text asset. */
const nonBlankLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export {
  MAX_ENTRIES_PER_PROVIDER,
  addressFamily,
  createEmptySnapshot,
  findSnapshotProblems,
  nonBlankLines,
  onProviderDataReplaced,
  rangeFamily,
  replaceProviderData,
  snapshotFromAddressList,
  snapshotFromPrefixes,
  validateSnapshot,
};
