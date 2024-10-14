/**
 * test.js
 */

const trustedProviders = require('./index');

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
trustedProviders.addProvider(require('./providers/fake-provider.js'));
trustedProviders.addProvider(require('./providers/fake-provider.js'));
trustedProviders.addProvider(require('./providers/fake-provider.js'));
trustedProviders.addProvider(require('./providers/fake-provider.js'));

/**
 * Add a custom network.
 */
trustedProviders.addProvider({
  name: 'My Custom Network',
  reload: () => {
    return new Promise((resolve, reject) => {
      // Simulate a slow update of the addresses/ranges.
      setTimeout(resolve, 3000);
    });
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

trustedProviders
  .reloadAll()
  .then(() => {
    return trustedProviders.runTests();
  })
  .then(() => {
    console.log('Finished all');
  });
