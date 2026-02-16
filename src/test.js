/**
 * test.js
 */

import trustedProviders from './index.js';

/**
 * Sleep utility for simulating delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enable diagnostic outputs.
 */
trustedProviders.isDiagnosticsEnabled = true;

/**
 * Add the built-in proicers including Googlebot, PayPal and a few others.
 */
trustedProviders.loadDefaultProviders();

/**
 * Add our fake provider. addProvider() should only add one instance,
 * even if we call it multiple times.
 */
import fakeProvider from './providers/fake-provider.js';
trustedProviders.addProvider(fakeProvider);
trustedProviders.addProvider(fakeProvider);
trustedProviders.addProvider(fakeProvider);
trustedProviders.addProvider(fakeProvider);

/**
 * Add a custom network.
 */
trustedProviders.addProvider({
  name: 'My Custom Network',
  reload: async () => {
    // Simulate a slow update of the addresses/ranges.
    await sleep(3000);
  },
  testAddresses: ['12.12.12.34'],
  ipv4: {
    addresses: ['12.12.12.34', '12.12.34.34'],
    ranges: [],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
});

if (trustedProviders.isDiagnosticsEnabled) {
  console.log();
}

(async () => {
  await trustedProviders.reloadAll();
  await trustedProviders.runTests();
  console.log('Finished all');
})();
