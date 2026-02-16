#!/usr/bin/env node

/**
 * CLI lookup tool for ad-hoc IP checks.
 *
 * Usage:
 *   node bin/lookup.js <ip> [ip...]
 *   trusted-lookup <ip> [ip...]      (after npm link)
 *
 * Exit codes:
 *   0 - all IPs are trusted
 *   1 - one or more IPs are untrusted
 */

import trustedProviders from '../src/index.js';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

const ips = process.argv.slice(2);

if (ips.length === 0) {
  process.stdout.write(
    '\nUsage: trusted-lookup <ip> [ip...]\n\n' +
      '  Check whether IP addresses belong to a known trusted provider.\n\n' +
      'Examples:\n' +
      '  trusted-lookup 66.249.66.87\n' +
      '  trusted-lookup 66.249.66.87 123.123.123.123\n\n'
  );
  process.exitCode = 1;
} else {
  trustedProviders.setLogLevel('silent');
  trustedProviders.loadDefaultProviders();

  const start = performance.now();
  process.stdout.write('\nLoading providers... ');

  await trustedProviders.reloadAll();

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  const count = trustedProviders.getAllProviders().length;
  process.stdout.write(`done (${count} providers, ${elapsed}s)\n\n`);

  let hasUntrusted = false;

  for (const ip of ips) {
    const provider = trustedProviders.getTrustedProvider(ip);
    const padded = ip.padEnd(24);

    if (provider) {
      process.stdout.write(`  ${padded} ${GREEN}\u2705 ${provider}${RESET}\n`);
    } else {
      process.stdout.write(`  ${padded} ${RED}\u274C not trusted${RESET}\n`);
      hasUntrusted = true;
    }
  }

  process.stdout.write('\n');

  if (hasUntrusted) {
    process.exitCode = 1;
  }
}
