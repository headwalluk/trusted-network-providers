/**
 * index.js
 */

import { EventEmitter } from 'node:events';
import ipaddr from 'ipaddr.js';
import { LRUCache } from './lru-cache.js';
import { TTLCache } from './ttl-cache.js';
import logger from './utils/logger.js';
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

// Constants for provider states
const PROVIDER_STATE_READY = 'ready';
const PROVIDER_STATE_LOADING = 'loading';
const PROVIDER_STATE_ERROR = 'error';
const PROVIDER_STATE_STALE = 'stale';

// Input validation limits
const MAX_PROVIDERS = 100; // Maximum number of providers that can be registered
const MAX_IPS_PER_PROVIDER = 10000; // Maximum combined IPs and ranges per provider
const MAX_PARSED_ADDRESSES = 5000; // Maximum parsed CIDR ranges to cache (LRU)
const MAX_CACHED_RESULTS = 10000; // Maximum IP lookup results to cache (TTL + LRU)
const DEFAULT_RESULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour default TTL for IP lookup results

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

const parsedAddresses = new LRUCache(MAX_PARSED_ADDRESSES);

/**
 * Result cache for IP lookups with TTL.
 * Caches the result (provider name or null) for each IP address.
 * @type {TTLCache}
 */
let resultCacheTtlMs = DEFAULT_RESULT_CACHE_TTL_MS;
let resultCache = new TTLCache(MAX_CACHED_RESULTS, resultCacheTtlMs);

/**
 * Provider metadata tracking.
 * Maps provider name → { state, lastUpdated, lastError }
 * @type {Map<string, { state: string, lastUpdated: number|null, lastError: Error|null }>}
 */
const providerMetadata = new Map();

/**
 * Event emitter for provider lifecycle events.
 * Consumers can listen to events like 'reload', 'error', and 'stale'.
 * @type {EventEmitter}
 */
const events = new EventEmitter();

/**
 * Configurable staleness threshold in milliseconds.
 * Providers that haven't been updated within this duration are marked as stale.
 * Default: 24 hours (86400000 ms)
 * @type {number}
 */
let stalenessThresholdMs = 24 * 60 * 60 * 1000;

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

/**
 * Validates a provider configuration before adding it.
 * Checks:
 * - Provider count doesn't exceed MAX_PROVIDERS
 * - Total IPs per provider doesn't exceed MAX_IPS_PER_PROVIDER
 * - All CIDR ranges are valid
 *
 * @param {Provider} provider - The provider to validate
 * @param {number} currentProviderCount - The current number of registered providers
 * @throws {Error} If validation fails
 * @returns {void}
 */
function validateProvider(provider, currentProviderCount) {
  // Check max providers limit
  if (currentProviderCount >= MAX_PROVIDERS) {
    throw new Error(`Maximum provider limit reached (${MAX_PROVIDERS}). Cannot add provider: ${provider.name}`);
  }

  // Count total IPs and ranges
  const ipv4Addresses = provider.ipv4?.addresses?.length || 0;
  const ipv4Ranges = provider.ipv4?.ranges?.length || 0;
  const ipv6Addresses = provider.ipv6?.addresses?.length || 0;
  const ipv6Ranges = provider.ipv6?.ranges?.length || 0;
  const totalIps = ipv4Addresses + ipv4Ranges + ipv6Addresses + ipv6Ranges;

  if (totalIps > MAX_IPS_PER_PROVIDER) {
    throw new Error(
      `Provider "${provider.name}" exceeds maximum IP limit (${MAX_IPS_PER_PROVIDER}). Total IPs: ${totalIps}`
    );
  }

  // Validate all CIDR ranges
  const invalidRanges = [];

  if (provider.ipv4?.ranges) {
    for (const range of provider.ipv4.ranges) {
      if (!ipaddr.isValidCIDR(range)) {
        invalidRanges.push(range);
      }
    }
  }

  if (provider.ipv6?.ranges) {
    for (const range of provider.ipv6.ranges) {
      if (!ipaddr.isValidCIDR(range)) {
        invalidRanges.push(range);
      }
    }
  }

  if (invalidRanges.length > 0) {
    throw new Error(`Provider "${provider.name}" contains invalid CIDR ranges: ${invalidRanges.join(', ')}`);
  }
}

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
      // Validate provider before adding
      validateProvider(provider, self.providers.length);

      if (self.isDiagnosticsEnabled) {
        logger.debug(`➕ Add provider: ${provider.name}`);
      }

      self.providers.push(provider);

      // Initialize provider metadata
      providerMetadata.set(provider.name, {
        state: PROVIDER_STATE_READY,
        lastUpdated: null,
        lastError: null,
      });
    }
  },

  /**
   * Removes a provider from the trusted network list by name.
   * Clears all caches to prevent stale results from the deleted provider.
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
        providerMetadata.delete(providerName);
        
        // Clear caches to prevent stale results
        parsedAddresses.clear();
        resultCache.clear();
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
   * Registers an event listener for provider lifecycle events.
   *
   * Supported events:
   * - 'reload:start': Emitted when a provider begins reloading. Payload: { provider: string }
   * - 'reload:success': Emitted when a provider successfully reloads. Payload: { provider: string, timestamp: number }
   * - 'error': Emitted when a provider fails to reload. Payload: { provider: string, error: Error, timestamp: number }
   * - 'stale': Emitted when a provider becomes stale. Payload: { provider: string, lastUpdated: number, staleDuration: number, timestamp: number }
   *
   * @param {string} event - The event name to listen for
   * @param {Function} listener - The callback function to invoke when the event is emitted
   * @returns {EventEmitter} The event emitter (for chaining)
   *
   * @example
   * trustedProviders.on('reload:success', ({ provider, timestamp }) => {
   *   console.log(`Provider ${provider} reloaded successfully at ${new Date(timestamp)}`);
   * });
   *
   * trustedProviders.on('error', ({ provider, error }) => {
   *   console.error(`Provider ${provider} failed to reload: ${error.message}`);
   * });
   *
   * trustedProviders.on('stale', ({ provider, staleDuration }) => {
   *   console.warn(`Provider ${provider} is stale (${Math.floor(staleDuration / 3600000)}h old)`);
   * });
   */
  on: (event, listener) => {
    return events.on(event, listener);
  },

  /**
   * Registers a one-time event listener for provider lifecycle events.
   * The listener will be invoked once and then automatically removed.
   *
   * @param {string} event - The event name to listen for
   * @param {Function} listener - The callback function to invoke when the event is emitted
   * @returns {EventEmitter} The event emitter (for chaining)
   *
   * @example
   * trustedProviders.once('reload:success', ({ provider }) => {
   *   console.log(`First reload complete: ${provider}`);
   * });
   */
  once: (event, listener) => {
    return events.once(event, listener);
  },

  /**
   * Removes an event listener.
   *
   * @param {string} event - The event name
   * @param {Function} listener - The callback function to remove
   * @returns {EventEmitter} The event emitter (for chaining)
   *
   * @example
   * const handleError = ({ provider, error }) => {
   *   console.error(`Error in ${provider}: ${error.message}`);
   * };
   *
   * trustedProviders.on('error', handleError);
   * // ... later ...
   * trustedProviders.off('error', handleError);
   */
  off: (event, listener) => {
    return events.off(event, listener);
  },

  /**
   * Returns the current status of a provider including its state, last update time, and any errors.
   *
   * @param {string} providerName - The name of the provider to check
   * @returns {{ state: string, lastUpdated: number|null, lastError: Error|null }|null} Provider status object, or null if provider doesn't exist
   *
   * @example
   * const status = trustedProviders.getProviderStatus('Googlebot');
   * if (status) {
   *   console.log(`State: ${status.state}`);
   *   console.log(`Last updated: ${new Date(status.lastUpdated)}`);
   *   if (status.lastError) {
   *     console.error(`Error: ${status.lastError.message}`);
   *   }
   * }
   */
  getProviderStatus: (providerName) => {
    if (!self.hasProvider(providerName)) {
      return null;
    }

    const metadata = providerMetadata.get(providerName);
    if (!metadata) {
      return null;
    }

    // Return a copy to prevent external mutation
    return {
      state: metadata.state,
      lastUpdated: metadata.lastUpdated,
      lastError: metadata.lastError,
    };
  },

  /**
   * Sets the staleness threshold in milliseconds.
   * Providers that haven't been updated within this duration will be marked as stale.
   *
   * @param {number} thresholdMs - The staleness threshold in milliseconds
   * @returns {void}
   *
   * @example
   * // Set staleness threshold to 12 hours
   * trustedProviders.setStalenessThreshold(12 * 60 * 60 * 1000);
   */
  setStalenessThreshold: (thresholdMs) => {
    if (typeof thresholdMs === 'number' && thresholdMs > 0) {
      stalenessThresholdMs = thresholdMs;
    }
  },

  /**
   * Gets the current staleness threshold in milliseconds.
   *
   * @returns {number} The current staleness threshold in milliseconds
   *
   * @example
   * const threshold = trustedProviders.getStalenessThreshold();
   * console.log(`Providers become stale after ${threshold / (60 * 60 * 1000)} hours`);
   */
  getStalenessThreshold: () => {
    return stalenessThresholdMs;
  },

  /**
   * Sets the TTL (time-to-live) for IP lookup result caching in milliseconds.
   * Cached results older than this duration will be re-evaluated.
   * Changing the TTL recreates the cache (clearing all existing entries).
   *
   * @param {number} ttlMs - The cache TTL in milliseconds
   * @returns {void}
   *
   * @example
   * // Cache IP lookups for 30 minutes
   * trustedProviders.setResultCacheTTL(30 * 60 * 1000);
   */
  setResultCacheTTL: (ttlMs) => {
    if (typeof ttlMs === 'number' && ttlMs > 0) {
      resultCacheTtlMs = ttlMs;
      // Recreate cache with new TTL (clears existing entries)
      resultCache = new TTLCache(MAX_CACHED_RESULTS, resultCacheTtlMs);
    }
  },

  /**
   * Gets the current TTL for IP lookup result caching in milliseconds.
   *
   * @returns {number} The current result cache TTL in milliseconds
   *
   * @example
   * const ttl = trustedProviders.getResultCacheTTL();
   * console.log(`Results are cached for ${ttl / (60 * 1000)} minutes`);
   */
  getResultCacheTTL: () => {
    return resultCacheTtlMs;
  },

  /**
   * Checks all providers for staleness and updates their state if they exceed the staleness threshold.
   * Emits a 'stale' event for each provider that transitions to the stale state.
   * Should be called periodically (e.g., hourly) in long-running applications.
   *
   * @returns {string[]} Array of provider names that were marked as stale
   *
   * @example
   * // Check for stale providers every hour
   * setInterval(() => {
   *   const staleProviders = trustedProviders.checkStaleness();
   *   if (staleProviders.length > 0) {
   *     console.log(`Marked ${staleProviders.length} provider(s) as stale:`, staleProviders);
   *   }
   * }, 60 * 60 * 1000);
   */
  checkStaleness: () => {
    const now = Date.now();
    const staleProviders = [];

    for (const [providerName, metadata] of providerMetadata.entries()) {
      // Skip providers that haven't been updated yet or are already stale
      if (!metadata.lastUpdated || metadata.state === PROVIDER_STATE_STALE) {
        continue;
      }

      // Check if the provider exceeds the staleness threshold
      const timeSinceUpdate = now - metadata.lastUpdated;
      if (timeSinceUpdate > stalenessThresholdMs) {
        // Mark as stale
        metadata.state = PROVIDER_STATE_STALE;
        staleProviders.push(providerName);

        // Emit stale event
        events.emit('stale', {
          provider: providerName,
          lastUpdated: metadata.lastUpdated,
          staleDuration: timeSinceUpdate,
          timestamp: now,
        });

        if (self.isDiagnosticsEnabled) {
          logger.info(
            `⚠️  Provider ${providerName} marked as stale (${Math.floor(timeSinceUpdate / (60 * 60 * 1000))}h since update)`
          );
        }
      }
    }

    return staleProviders;
  },

  /**
   * Set the logging level for the library.
   * Controls which messages are output to the console.
   *
   * @param {string} level - One of: 'silent', 'error', 'warn', 'info', 'debug'
   * @returns {void}
   * @throws {Error} If level is invalid
   *
   * @example
   * trustedProviders.setLogLevel('info'); // Show errors, warnings, and info
   * trustedProviders.setLogLevel('silent'); // Suppress all output
   */
  setLogLevel: (level) => {
    logger.setLevel(level);
  },

  /**
   * Get the current logging level.
   *
   * @returns {string} Current log level ('silent', 'error', 'warn', 'info', or 'debug')
   *
   * @example
   * const level = trustedProviders.getLogLevel();
   * console.log(`Current log level: ${level}`); // 'error'
   */
  getLogLevel: () => {
    return logger.getLevel();
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
          logger.debug(`🔃 Reload: ${provider.name}`);
        }

        // Set provider state to LOADING
        const metadata = providerMetadata.get(provider.name);
        if (metadata) {
          metadata.state = PROVIDER_STATE_LOADING;
        }

        // Emit reload:start event
        events.emit('reload:start', { provider: provider.name });

        const reloadPromises = provider.reload();

        if (Array.isArray(reloadPromises)) {
          for (const promise of reloadPromises) {
            reloadRequests.push(
              promise
                .then(() => {
                  // Update metadata on success
                  const meta = providerMetadata.get(provider.name);
                  if (meta) {
                    meta.state = PROVIDER_STATE_READY;
                    meta.lastUpdated = Date.now();
                    meta.lastError = null;
                  }
                  // Emit reload:success event
                  events.emit('reload:success', { provider: provider.name, timestamp: Date.now() });
                })
                .catch((error) => {
                  // Update metadata on failure
                  const meta = providerMetadata.get(provider.name);
                  if (meta) {
                    meta.state = PROVIDER_STATE_ERROR;
                    meta.lastError = error;
                  }
                  // Emit error event
                  events.emit('error', { provider: provider.name, error, timestamp: Date.now() });
                  throw error; // Re-throw to maintain Promise.allSettled behavior
                })
            );
          }
        } else {
          reloadRequests.push(
            reloadPromises
              .then(() => {
                // Update metadata on success
                const meta = providerMetadata.get(provider.name);
                if (meta) {
                  meta.state = PROVIDER_STATE_READY;
                  meta.lastUpdated = Date.now();
                  meta.lastError = null;
                }
                // Emit reload:success event
                events.emit('reload:success', { provider: provider.name, timestamp: Date.now() });
              })
              .catch((error) => {
                // Update metadata on failure
                const meta = providerMetadata.get(provider.name);
                if (meta) {
                  meta.state = PROVIDER_STATE_ERROR;
                  meta.lastError = error;
                }
                // Emit error event
                events.emit('error', { provider: provider.name, error, timestamp: Date.now() });
                throw error; // Re-throw to maintain Promise.allSettled behavior
              })
          );
        }
      }
    }

    const results = await Promise.allSettled(reloadRequests);

    // Clear caches after all reloads complete
    // This prevents stale data from being used with updated provider ranges
    parsedAddresses.clear();
    resultCache.clear();

    return results;
  },

  /**
   * Identifies which trusted provider (if any) an IP address belongs to.
   * Returns the provider name on match, or null if the IP is not trusted.
   *
   * This function performs a linear search through providers in registration order.
   * First match wins, so provider order matters if ranges overlap.
   *
   * Results are cached with a configurable TTL to improve performance for repeated lookups.
   * The cache is automatically cleared when providers are reloaded.
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
    // Check result cache first
    if (resultCache.has(ipAddress)) {
      return resultCache.get(ipAddress);
    }

    let trustedSource = null;

    let parsedIp = null;
    try {
      parsedIp = ipaddr.parse(ipAddress);
    } catch (error) {
      logger.error(`Failed to parse IP: ${ipAddress}`);
      logger.error(error);
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

              if (!parsedAddresses.has(testRange)) {
                parsedAddresses.set(testRange, ipaddr.parseCIDR(testRange));
              }

              if (parsedIp.match(parsedAddresses.get(testRange))) {
                trustedSource = provider.name;
                break;
              }
            }
          }
        } catch (error) {
          logger.error(`ERROR: Failed to find trusted source of ${ipAddress}`);
          logger.error(error);
        }

        if (trustedSource) {
          break;
        } else {
          ++providerIndex;
        }
      }
    }

    // Cache the result (including null for negative lookups)
    resultCache.set(ipAddress, trustedSource);

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
          logger.info();
        }

        logger.info(`🔷 No tests for ${testProvider.name}`);
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

    logger.info();

    for (const test of tests) {
      const testProviderName = test.provider ?? '_wild_';
      const provider = self.getTrustedProvider(test.ip);
      const foundProviderName = provider ?? '_wild_';

      if (provider !== test.provider) {
        logger.info(`❌${test.ip} => ${foundProviderName} (should be ${testProviderName})`);
      } else {
        logger.info(`✅${test.ip} => ${foundProviderName}`);
      }
    }

    logger.info();
    logger.info('🏁 Finished tests');
    logger.info();
  },
};

// Export provider state constants for consumers
export { PROVIDER_STATE_READY, PROVIDER_STATE_LOADING, PROVIDER_STATE_ERROR, PROVIDER_STATE_STALE };

export default self;
