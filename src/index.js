/**
 * index.js
 */

import ipaddr from 'ipaddr.js';
import privateProvider from './providers/private.js';
import googlebotProvider from './providers/googlebot.js';
import googleWorkspaceProvider from './providers/google-workspace.js';
import googleServicesProvider from './providers/google-services.js';
import stripeApiProvider from './providers/stripe-api.js';
import stripeWebhooksProvider from './providers/stripe-webhooks.js';
import opayoProvider from './providers/opayo.js';
import paypalProvider from './providers/paypal.js';
import outlookProvider from './providers/outlook.js';
import cloudflareProvider from './providers/cloudflare.js';
import ezoicProvider from './providers/ezoic.js';
import shipHeroProvider from './providers/ship-hero.js';
import bunnynetProvider from './providers/bunnynet.js';
import semrushProvider from './providers/semrush.js';
import ahrefsbotProvider from './providers/ahrefsbot.js';
import facebookbotProvider from './providers/facebookbot.js';
import brevoProvider from './providers/brevo.js';
import getTermsProvider from './providers/get-terms.js';
import labrikaProvider from './providers/labrika.js';
// import mailgunProvider from './providers/mailgun.js';
// import gtmetrixProvider from './providers/gtmetrix.js';
// import seobilityProvider from './providers/seobility.js'; // Unreliable

// Constants for IP address versions
const IP_VERSION_V4 = 'ipv4';
const IP_VERSION_V6 = 'ipv6';

const defaultProviders = [
  privateProvider,
  googlebotProvider,
  googleWorkspaceProvider,
  googleServicesProvider,
  stripeApiProvider,
  stripeWebhooksProvider,
  opayoProvider,
  paypalProvider,
  outlookProvider,
  cloudflareProvider,
  ezoicProvider,
  shipHeroProvider,
  bunnynetProvider,
  semrushProvider,
  ahrefsbotProvider,
  facebookbotProvider,
  brevoProvider,
  getTermsProvider,
  labrikaProvider,
  // mailgunProvider,
  // gtmetrixProvider,
  // seobilityProvider, // Unreliable
];

const parsedAddresses = {};

/**
 * @typedef {Object} Provider
 * @property {string} name - The display name of the provider
 * @property {string[]} [testAddresses] - Sample IP addresses for testing
 * @property {Function|Function[]} [reload] - Function(s) to reload provider data
 * @property {Object} ipv4 - IPv4 configuration
 * @property {string[]} ipv4.addresses - Individual IPv4 addresses
 * @property {string[]} ipv4.ranges - IPv4 CIDR ranges
 * @property {Object} ipv6 - IPv6 configuration
 * @property {string[]} ipv6.addresses - Individual IPv6 addresses
 * @property {string[]} ipv6.ranges - IPv6 CIDR ranges
 */

const self = {
  providers: [],
  isDiagnosticsEnabled: false,

  /**
   * Adds a new provider to the trusted network list.
   * Providers must have a unique name and will be checked in order during IP lookups.
   *
   * @param {Provider} provider - The provider configuration object
   * @returns {void}
   *
   * @example
   * trustedProviders.addProvider({
   *   name: 'My CDN',
   *   ipv4: {
   *     addresses: ['1.2.3.4'],
   *     ranges: ['10.0.0.0/8']
   *   },
   *   ipv6: {
   *     addresses: [],
   *     ranges: ['2001:db8::/32']
   *   }
   * });
   */
  addProvider: (provider) => {
    if (provider && provider.name && !self.hasProvider(provider.name)) {
      if (self.isDiagnosticsEnabled) {
        console.log(`➕ Add provider: ${provider.name}`);
      }

      self.providers.push(provider);
    }
  },

  /**
   * Removes a provider from the trusted network list by name.
   *
   * @param {string} providerName - The name of the provider to remove
   * @returns {void}
   *
   * @example
   * trustedProviders.deleteProvider('My CDN');
   */
  deleteProvider: (providerName) => {
    if (self.hasProvider(providerName)) {
      const providerIndex = self.providers.findIndex((testProvider) => testProvider.name === providerName);
      if (providerIndex >= 0) {
        self.providers.splice(providerIndex, 1);
      }
    }
  },

  /**
   * Returns an array of all registered providers.
   *
   * @returns {Provider[]} Array of provider objects
   *
   * @example
   * const providers = trustedProviders.getAllProviders();
   * console.log(`Loaded ${providers.length} providers`);
   */
  getAllProviders: () => {
    return self.providers;
  },

  /**
   * Checks if a provider with the given name is already registered.
   *
   * @param {string} providerName - The name of the provider to check
   * @returns {boolean} True if the provider exists, false otherwise
   *
   * @example
   * if (trustedProviders.hasProvider('Cloudflare')) {
   *   console.log('Cloudflare provider is loaded');
   * }
   */
  hasProvider: (providerName) => {
    if (!providerName) {
      return false;
    }

    return self.providers.some((testProvider) => testProvider.name === providerName);
  },

  /**
   * Loads all built-in providers (Googlebot, Stripe, Cloudflare, etc.).
   * This is typically called once during application initialization.
   *
   * @returns {void}
   *
   * @example
   * const trustedProviders = require('@headwall/trusted-network-providers');
   * trustedProviders.loadDefaultProviders();
   * await trustedProviders.reloadAll();
   */
  loadDefaultProviders: () => {
    for (const defaultProvider of defaultProviders) {
      if (!self.hasProvider(defaultProvider.name)) {
        self.addProvider(defaultProvider);
      }
    }
  },

  /**
   * Reloads data for all providers that support dynamic updates.
   * This fetches fresh IP ranges from external sources (APIs, DNS, bundled assets).
   * Should be called periodically (e.g., daily) to keep provider data current.
   *
   * Uses Promise.allSettled() to ensure all providers are attempted, even if some fail.
   * Failed reloads are logged but don't prevent other providers from updating.
   *
   * @returns {Promise<PromiseSettledResult<void>[]>} Promise that resolves with results for all providers
   *
   * @example
   * // Initial load
   * trustedProviders.loadDefaultProviders();
   * await trustedProviders.reloadAll();
   *
   * // Periodic update (once per day)
   * setInterval(async () => {
   *   try {
   *     const results = await trustedProviders.reloadAll();
   *     const failed = results.filter(r => r.status === 'rejected');
   *     if (failed.length > 0) {
   *       console.error(`Failed to reload ${failed.length} provider(s)`);
   *     } else {
   *       console.log('All provider data updated');
   *     }
   *   } catch (error) {
   *     console.error('Failed to reload providers:', error);
   *   }
   * }, 24 * 60 * 60 * 1000);
   */
  reloadAll: async () => {
    const reloadRequests = [];

    for (const provider of self.providers) {
      if (typeof provider.reload === 'function') {
        if (self.isDiagnosticsEnabled) {
          console.log(`🔃 Reload: ${provider.name}`);
        }

        const reloadPromises = provider.reload();

        if (Array.isArray(reloadPromises)) {
          for (const promise of reloadPromises) {
            reloadRequests.push(promise);
          }
        } else {
          reloadRequests.push(reloadPromises);
        }
      }
    }

    return Promise.allSettled(reloadRequests);
  },

  /**
   * Identifies which trusted provider (if any) an IP address belongs to.
   * Returns the provider name on match, or null if the IP is not trusted.
   *
   * This function performs a linear search through providers in registration order.
   * First match wins, so provider order matters if ranges overlap.
   *
   * @param {string} ipAddress - The IP address to check (IPv4 or IPv6)
   * @returns {string|null} The name of the trusted provider, or null if not found
   *
   * @example
   * const provider = trustedProviders.getTrustedProvider('66.249.66.1');
   * if (provider === 'Googlebot') {
   *   console.log('Request is from Googlebot');
   * }
   *
   * @example
   * // Express.js middleware example
   * app.use((req, res, next) => {
   *   const provider = trustedProviders.getTrustedProvider(req.ip);
   *   if (provider) {
   *     req.trustedProvider = provider;
   *   }
   *   next();
   * });
   */
  getTrustedProvider: (ipAddress) => {
    let trustedSource = null;

    let parsedIp = null;
    try {
      parsedIp = ipaddr.parse(ipAddress);
    } catch {
      console.error(`Failed to parse IP: ${ipAddress}`);
      parsedIp = null;
    }

    if (parsedIp) {
      const ipAddressVersion = parsedIp.kind();

      const providerCount = self.providers.length;
      let providerIndex = 0;
      while (providerIndex < providerCount) {
        const provider = self.providers[providerIndex];

        let testPool = null;
        if (ipAddressVersion === IP_VERSION_V4) {
          testPool = provider.ipv4;
        } else if (ipAddressVersion === IP_VERSION_V6) {
          testPool = provider.ipv6;
        } else {
          // ...
        }

        try {
          if (testPool) {
            const addressCount = testPool.addresses.length;
            for (let addressIndex = 0; addressIndex < addressCount; ++addressIndex) {
              if (testPool.addresses[addressIndex] === ipAddress) {
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

  /**
   * Checks if an IP address belongs to any trusted provider.
   * This is a convenience wrapper around getTrustedProvider().
   *
   * @param {string} ipAddress - The IP address to check (IPv4 or IPv6)
   * @returns {boolean} True if the IP belongs to a trusted provider, false otherwise
   *
   * @example
   * if (trustedProviders.isTrusted('34.237.253.141')) {
   *   console.log('IP is from a trusted source');
   * }
   */
  isTrusted: (ipAddress) => {
    return self.getTrustedProvider(ipAddress) !== null;
  },

  /**
   * Runs tests against all registered providers using their configured test addresses.
   * Outputs results to console with ✅ for passing tests and ❌ for failures.
   * Useful for verifying provider configuration after loading or reloading.
   *
   * @returns {Promise<void>} Promise that resolves when all tests complete
   *
   * @example
   * trustedProviders.loadDefaultProviders();
   * await trustedProviders.reloadAll();
   * await trustedProviders.runTests();
   */
  runTests: async () => {
    const tests = [
      { ip: '192.42.116.182', provider: null },
      { ip: '123.123.123.123', provider: null },
    ];

    let failedProviderIndex = 0;
    for (const testProvider of self.getAllProviders()) {
      if (!Array.isArray(testProvider.testAddresses)) {
        if (failedProviderIndex === 0) {
          console.log();
        }

        console.log(`🔷 No tests for ${testProvider.name}`);
        ++failedProviderIndex;
      } else {
        for (const testAddress of testProvider.testAddresses) {
          tests.push({
            ip: testAddress,
            provider: testProvider.name,
          });
        }
      }
    }

    console.log();

    for (const test of tests) {
      const testProviderName = test.provider ?? '_wild_';
      const provider = self.getTrustedProvider(test.ip);
      const foundProviderName = provider ?? '_wild_';

      if (provider !== test.provider) {
        console.log(`❌${test.ip} => ${foundProviderName} (should be ${testProviderName})`);
      } else {
        console.log(`✅${test.ip} => ${foundProviderName}`);
      }
    }

    console.log();
    console.log('🏁 Finished tests');
    console.log();
  },
};

export default self;
