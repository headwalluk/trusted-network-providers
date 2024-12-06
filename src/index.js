/**
 * index.js
 */

const ipaddr = require('ipaddr.js');

// const providers = [];

const defaultProviders = [
  require('./providers/private.js'),
  require('./providers/googlebot.js'),
  require('./providers/google-workspace.js'),
  require('./providers/google-services.js'),
  require('./providers/stripe-api.js'),
  require('./providers/stripe-webhooks.js'),
  require('./providers/opayo.js'),
  require('./providers/paypal.js'),
  require('./providers/outlook.js'),
  require('./providers/cloudflare.js'),
  require('./providers/ezoic.js'),
  require('./providers/ship-hero.js'),
  require('./providers/bunnynet.js'),
  require('./providers/semrush.js'),
  require('./providers/ahrefsbot.js'),
  require('./providers/facebookbot.js'),

  // require('./providers/mailgun.js'),
  // require('./providers/gtmetrix.js'),
  // require('./providers/seobility.js'), // Unreliable
];

const parsedAddresses = {};

const self = {
  providers: [],
  isDiagnosticsEnabled: false,
  addProvider: (provider) => {
    if (provider && typeof provider.name !== 'undefined' && !self.hasProvider(provider.name)) {
      if (self.isDiagnosticsEnabled) {
        console.log(`➕ Add provider: ${provider.name}`);
      }

      self.providers.push(provider);
    }
  },
  deleteProvider: (providerName) => {
    if (self.hasProvider(providerName)) {
      const providerIndex = self.providers.findIndex((testProvider) => testProvider.name == providerName);
      if (providerIndex >= 0) {
        self.providers.splice(providerIndex, 1);
      }
    }
  },
  getAllProviders: () => {
    return self.providers;
  },
  hasProvider: (providerName) => {
    let isFound = false;

    if (providerName) {
      self.providers.forEach((testProvider) => {
        isFound |= testProvider.name == providerName;
      });
    }

    return isFound;
  },
  loadDefaultProviders: () => {
    defaultProviders.forEach((defaultProvider) => {
      if (!self.hasProvider(defaultProvider.name)) {
        self.addProvider(defaultProvider);
      }
    });
  },
  reloadAll: () => {
    const reloadRequests = [];

    self.providers.forEach((provider) => {
      if (typeof provider.reload === 'function') {
        if (self.isDiagnosticsEnabled) {
          console.log(`🔃 Reload: ${provider.name}`);
        }

        const reloadPromises = provider.reload();

        if (Array.isArray(reloadPromises)) {
          // console.log( `Array of promises: ${provider.name}`);
          reloadPromises.forEach((promise) => {
            reloadRequests.push(promise);
          });
        } else {
          // console.log( `Single promise: ${provider.name}`);
          reloadRequests.push(reloadPromises);
        }
      }
    });

    return Promise.all(reloadRequests);
  },
  getTrustedProvider: (ipAddress) => {
    let trustedSource = null;

    let parsedIp = null;
    try {
      parsedIp = ipaddr.parse(ipAddress);
    } catch (error) {
      console.error(`Failed to parse IP: ${ipAddress}`);
      parsedIp = null;
    }

    if (parsedIp) {
      const ipAddressVersion = parsedIp.kind();

      const providerCount = self.providers.length;
      let providerIndex = 0;
      while (providerIndex < providerCount) {
        const provider = self.providers[providerIndex];

        // Diagnostics
        // console.log(`Check ${ipAddressVersion} : ${provider.name}`);

        let testPool = null;
        if (ipAddressVersion == 'ipv4') {
          testPool = provider.ipv4;
        } else if (ipAddressVersion == 'ipv6') {
          testPool = provider.ipv6;
        } else {
          // ...
        }

        try {
          if (testPool) {
            const addressCount = testPool.addresses.length;
            for (let addressIndex = 0; addressIndex < addressCount; ++addressIndex) {
              if (testPool.addresses[addressIndex] == ipAddress) {
                trustedSource = provider.name;
                break;
              }
            }

            const rangeCount = testPool.ranges.length;
            for (let rangeIndex = 0; rangeIndex < rangeCount; ++rangeIndex) {
              const testRange = testPool.ranges[rangeIndex];

              if (!parsedAddresses[testRange]) {
                parsedAddresses[testRange] = ipaddr.parseCIDR(testRange);
              }

              if (parsedIp.match(parsedAddresses[testRange])) {
                trustedSource = provider.name;
                break;
              }
            }
          }
        } catch (error) {
          console.error(`ERROR: Failed to find trusted source of ${ipAddress}`);
          console.error(error);
        }

        if (trustedSource) {
          break;
        } else {
          ++providerIndex;
        }
      }
    }

    return trustedSource;
  },
  isTrusted: (ipAddress) => {
    return getTrustedProvider(ipAddress) !== null;
  },
  runTests: () => {
    return new Promise((resolve, reject) => {
      const tests = [
        { ip: '192.42.116.182', provider: null },
        { ip: '123.123.123.123', provider: null },
      ];

      let failedProviderIndex = 0;
      self.getAllProviders().forEach((testProvider) => {
        if (!Array.isArray(testProvider.testAddresses)) {
          if (failedProviderIndex == 0) {
            console.log();
          }

          console.log(`🔷 No tests for ${testProvider.name}`);
          ++failedProviderIndex;
        } else {
          testProvider.testAddresses.forEach((testAddress) => {
            tests.push({
              ip: testAddress,
              provider: testProvider.name,
            });
          });
        }
      });

      console.log();

      tests.forEach((test) => {
        let testProviderName = test.provider;
        if (!testProviderName) {
          testProviderName = '_wild_';
        }

        const provider = self.getTrustedProvider(test.ip);

        let foundProviderName = provider;
        if (!foundProviderName) {
          foundProviderName = '_wild_';
        }

        if (provider !== test.provider) {
          console.log(`🟥 ${test.ip} => ${foundProviderName} (should be ${testProviderName})`);
        } else {
          console.log(`🟩 ${test.ip} => ${foundProviderName}`);
        }
      });

      console.log();
      console.log('🏁 Finished tests');
      console.log();

      resolve();
    });
  },
};

module.exports = self;
