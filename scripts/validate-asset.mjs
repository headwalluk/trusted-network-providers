#!/usr/bin/env node
/**
 * validate-asset.mjs
 *
 * Validates a staged bundled asset with the same parsing and validation the
 * library applies at load time, plus checks aimed at a tampered or truncated
 * feed: no implausibly broad prefix, and no sudden growth against the live copy.
 *
 * Usage: validate-asset.mjs <prefixes|addresses|lines-ipv4|lines-ipv6> <staged-file> [live-file]
 * Exits 0 when valid, 1 with every problem listed on stderr otherwise.
 */

import { existsSync, readFileSync } from 'node:fs';
import {
  createEmptySnapshot,
  findSnapshotProblems,
  nonBlankLines,
  snapshotFromAddressList,
  snapshotFromPrefixes,
} from '../src/utils/provider-data.js';

// Shortest prefix accepted; the widest current routes are IPv4 /14 and IPv6 /29
const MIN_PREFIX_LENGTH = { ipv4: 12, ipv6: 24 };

// Entry count may grow by this factor (plus a small allowance) before the run fails
const MAX_GROWTH_FACTOR = 1.5;
const GROWTH_ALLOWANCE = 20;

const [assetFormat, stagedPath, livePath] = process.argv.slice(2);

/** Parses an asset file into a provider snapshot. */
const readSnapshot = (filePath) => {
  const text = readFileSync(filePath, 'utf8');
  let snapshot;

  if (assetFormat === 'prefixes') {
    snapshot = snapshotFromPrefixes(JSON.parse(text)?.prefixes);
  } else if (assetFormat === 'addresses') {
    snapshot = snapshotFromAddressList(JSON.parse(text));
  } else if (assetFormat === 'lines-ipv4' || assetFormat === 'lines-ipv6') {
    snapshot = createEmptySnapshot();
    snapshot[assetFormat === 'lines-ipv4' ? 'ipv4' : 'ipv6'].ranges = nonBlankLines(text);
  } else {
    throw new Error(`Unknown asset format: ${assetFormat}`);
  }

  return snapshot;
};

/** Counts every address and range in a snapshot. */
const countEntries = (snapshot) =>
  ['ipv4', 'ipv6'].reduce((total, family) => total + snapshot[family].addresses.length + snapshot[family].ranges.length, 0);

const problems = [];

try {
  const stagedSnapshot = readSnapshot(stagedPath);
  const { problems: snapshotProblems, entryCount } = findSnapshotProblems(stagedSnapshot);
  problems.push(...snapshotProblems);

  if (entryCount === 0) {
    problems.push('no entries');
  }

  for (const family of ['ipv4', 'ipv6']) {
    for (const range of stagedSnapshot[family].ranges) {
      const prefixLength = Number(String(range).split('/')[1]);
      if (prefixLength < MIN_PREFIX_LENGTH[family]) {
        problems.push(`${range} is broader than /${MIN_PREFIX_LENGTH[family]}`);
      }
    }
  }

  if (livePath && existsSync(livePath)) {
    const liveCount = countEntries(readSnapshot(livePath));
    const growthLimit = Math.ceil(liveCount * MAX_GROWTH_FACTOR) + GROWTH_ALLOWANCE;
    if (entryCount > growthLimit) {
      problems.push(`${entryCount} entries against ${liveCount} live (limit ${growthLimit}); review the upstream change`);
    }
  }
} catch (error) {
  problems.push(error.message);
}

if (problems.length > 0) {
  console.error(`INVALID ${stagedPath}:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exitCode = 1;
}
