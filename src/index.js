/**
 * index.js
 */

import { EventEmitter } from 'node:events';
import ipaddr from 'ipaddr.js';
import { LRUCache } from './lru-cache.js';
import { TTLCache } from './ttl-cache.js';
import logger from './utils/logger.js';
import { addressFamily, onProviderDataReplaced, rangeFamily } from './utils/provider-data.js';
import { PROVIDER_CATEGORIES, PROVIDER_CATEGORY_AI_CRAWLER } from './categories.js';
import privateProvider from './providers/private.js';
import googlebotProvider from './providers/googlebot.js';
import googleSpecialCrawlersProvider from './providers/google-special-crawlers.js';
import googleUserFetchersProvider from './providers/google-user-fetchers.js';
import bingbotProvider from './providers/bingbot.js';
import applebotProvider from './providers/applebot.js';
import gptbotProvider from './providers/gptbot.js';
import oaiSearchbotProvider from './providers/oai-searchbot.js';
import chatgptUserProvider from './providers/chatgpt-user.js';
import googleWorkspaceProvider from './providers/google-workspace.js';
import googleServicesProvider from './providers/google-services.js';
import stripeApiProvider from './providers/stripe-api.js';
import stripeWebhooksProvider from './providers/stripe-webhooks.js';
import opayoProvider from './providers/opayo.js';
import paypalProvider from './providers/paypal.js';
import outlookProvider from './providers/outlook.js';
import cloudflareDnsProvider from './providers/cloudflare-dns.js';
import cloudflareProvider from './providers/cloudflare.js';
import openDnsProvider from './providers/opendns.js';
import quad9Provider from './providers/quad9.js';
import ezoicProvider from './providers/ezoic.js';
import shipHeroProvider from './providers/ship-hero.js';
import bunnynetProvider from './providers/bunnynet.js';
import semrushProvider from './providers/semrush.js';
import ahrefsbotProvider from './providers/ahrefsbot.js';
import facebookbotProvider from './providers/facebookbot.js';
import brevoProvider from './providers/brevo.js';
import getTermsProvider from './providers/get-terms.js';
import labrikaProvider from './providers/labrika.js';
import mailgunProvider from './providers/mailgun.js';

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
const MAX_LOGGED_INPUT_LENGTH = 64; // Longest lookup input echoed into an error log
const DEFAULT_RESULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour default TTL for IP lookup results

const defaultProviders = [
  privateProvider,
  googlebotProvider,
  googleSpecialCrawlersProvider,
  googleUserFetchersProvider,
  bingbotProvider,
  applebotProvider,
  gptbotProvider,
  oaiSearchbotProvider,
  chatgptUserProvider,
  googleWorkspaceProvider,
  googleServicesProvider,
  stripeApiProvider,
  stripeWebhooksProvider,
  opayoProvider,
  paypalProvider,
  outlookProvider,
  cloudflareDnsProvider, // must precede cloudflareProvider: overlapping IPv6 range
  cloudflareProvider,
  openDnsProvider,
  quad9Provider,
  ezoicProvider,
  shipHeroProvider,
  bunnynetProvider,
  semrushProvider,
  ahrefsbotProvider,
  facebookbotProvider,
  brevoProvider,
  getTermsProvider,
  labrikaProvider,
  mailgunProvider,
];

const parsedAddresses = new LRUCache(MAX_PARSED_ADDRESSES);

// Provider exact-address string → canonical form (or null if unparseable)
const canonicalAddresses = new LRUCache(MAX_PARSED_ADDRESSES);

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

/** Clears every cache derived from provider data. */
const clearLookupCaches = () => {
  parsedAddresses.clear();
  canonicalAddresses.clear();
  resultCache.clear();
};

// Built-in providers replace their data through provider-data.js, including
// direct reload()/reloadFromWeb() calls that bypass reloadAll()
onProviderDataReplaced(clearLookupCaches);

/** Returns the address in the form used for matching: IPv4-mapped IPv6 becomes IPv4. */
const toMatchingForm = (parsedIp) => {
  let matchingIp = parsedIp;
  if (parsedIp.kind() === IP_VERSION_V6 && parsedIp.isIPv4MappedAddress()) {
    matchingIp = parsedIp.toIPv4Address();
  }
  return matchingIp;
};

/** Returns the canonical string for a provider's exact address, or null if it does not parse. */
const canonicalAddress = (address) => {
  if (!canonicalAddresses.has(address)) {
    let canonical = null;
    if (typeof address === 'string' && ipaddr.isValid(address)) {
      canonical = toMatchingForm(ipaddr.parse(address)).toString();
    }
    canonicalAddresses.set(address, canonical);
  }
  return canonicalAddresses.get(address);
};

/** Returns a log-safe rendering of an arbitrary lookup input. */
const describeInput = (input) => {
  let description = typeof input;
  if (typeof input === 'string') {
    description = JSON.stringify(input.slice(0, MAX_LOGGED_INPUT_LENGTH));
    if (input.length > MAX_LOGGED_INPUT_LENGTH) {
      description += ` (${input.length} characters)`;
    }
  }
  return description;
};

/**
 * @typedef {Object} Provider
 * @property {string} name - The display name of the provider
 * @property {string} [category] - Group this provider belongs to, e.g. 'ai-crawler'. See src/categories.js
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

  // Each list is optional (absent lists become empty on registration) but must be an array
  const lists = [];
  const structureProblems = [];
  for (const family of [IP_VERSION_V4, IP_VERSION_V6]) {
    for (const listName of ['addresses', 'ranges']) {
      const entries = provider[family]?.[listName] ?? [];
      if (Array.isArray(entries)) {
        lists.push({ family, listName, entries });
      } else {
        structureProblems.push(`${family}.${listName} is not an array`);
      }
    }
  }

  if (structureProblems.length > 0) {
    throw new Error(`Provider "${provider.name}" is malformed: ${structureProblems.join('; ')}`);
  }

  const totalIps = lists.reduce((total, list) => total + list.entries.length, 0);
  if (totalIps > MAX_IPS_PER_PROVIDER) {
    throw new Error(
      `Provider "${provider.name}" exceeds maximum IP limit (${MAX_IPS_PER_PROVIDER}). Total IPs: ${totalIps}`
    );
  }

  const invalidRanges = lists
    .filter((list) => list.listName === 'ranges')
    .flatMap((list) => list.entries.filter((range) => !ipaddr.isValidCIDR(range)));

  if (invalidRanges.length > 0) {
    throw new Error(`Provider "${provider.name}" contains invalid CIDR ranges: ${invalidRanges.join(', ')}`);
  }

  // Every entry must parse and belong to its pool's family
  const entryProblems = [];
  for (const { family, listName, entries } of lists) {
    const familyOf = listName === 'addresses' ? addressFamily : rangeFamily;
    for (const entry of entries) {
      const entryFamily = familyOf(entry);
      if (entryFamily === null) {
        entryProblems.push(`${family}.${listName}: invalid entry ${JSON.stringify(entry)}`);
      } else if (entryFamily !== family) {
        entryProblems.push(`${family}.${listName}: ${entry} is ${entryFamily}`);
      }
    }
  }

  if (entryProblems.length > 0) {
    throw new Error(`Provider "${provider.name}" contains invalid entries: ${entryProblems.join('; ')}`);
  }

  // `category` is optional, but a non-string one would never match a category
  // filter, so it is rejected here rather than silently ignored at lookup time.
  if (provider.category !== undefined) {
    if (typeof provider.category !== 'string' || provider.category.trim() === '') {
      throw new Error(`Provider "${provider.name}" has an invalid category: expected a non-empty string`);
    }
  }
}

/** Emits a reload failure, plus the deprecated 'error' alias only when someone listens for it. */
const emitReloadError = (payload) => {
  events.emit('reload:error', payload);

  // An 'error' event with no listener makes EventEmitter throw, so it is never emitted unheard
  if (events.listenerCount('error') > 0) {
    events.emit('error', payload);
  }
};

/**
 * Runs one provider's reload and records a single outcome for it. reload() may
 * return a promise, an array of promises (all must succeed) or nothing.
 */
const reloadProvider = async (provider) => {
  const metadata = providerMetadata.get(provider.name);
  if (metadata) {
    metadata.state = PROVIDER_STATE_LOADING;
  }

  events.emit('reload:start', { provider: provider.name });

  try {
    // Inside the try, so a synchronous throw is this provider's failure alone
    const reloadOutcome = await provider.reload();

    if (Array.isArray(reloadOutcome)) {
      const taskResults = await Promise.allSettled(reloadOutcome);
      const failedTask = taskResults.find((taskResult) => taskResult.status === 'rejected');
      if (failedTask) {
        throw failedTask.reason;
      }
    }
  } catch (error) {
    if (metadata) {
      metadata.state = PROVIDER_STATE_ERROR;
      metadata.lastError = error;
    }
    emitReloadError({ provider: provider.name, error, timestamp: Date.now() });
    throw error;
  }

  if (metadata) {
    metadata.state = PROVIDER_STATE_READY;
    metadata.lastUpdated = Date.now();
    metadata.lastError = null;
  }
  events.emit('reload:success', { provider: provider.name, timestamp: Date.now() });
};

const self = {
  providers: [],

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

      logger.debug(`➕ Add provider: ${provider.name}`);

      // Absent pools and lists become empty arrays so lookups can rely on them
      for (const family of [IP_VERSION_V4, IP_VERSION_V6]) {
        provider[family] = provider[family] ?? {};
        provider[family].addresses = provider[family].addresses ?? [];
        provider[family].ranges = provider[family].ranges ?? [];
      }

      self.providers.push(provider);

      // Initialize provider metadata
      providerMetadata.set(provider.name, {
        state: PROVIDER_STATE_READY,
        lastUpdated: null,
        lastError: null,
      });

      // A cached miss from before registration would otherwise hide the new provider
      clearLookupCaches();
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
        clearLookupCaches();
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
    return [...self.providers];
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
   * Returns every registered provider in the given category, in registration
   * order. Uncategorised providers never match.
   *
   * @param {string} category - The category to filter by, e.g. 'ai-crawler'
   * @returns {Provider[]} The matching providers, or an empty array
   *
   * @example
   * import { PROVIDER_CATEGORY_AI_CRAWLER } from '@headwall/trusted-network-providers';
   * const crawlers = trustedProviders.getProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER);
   */
  getProvidersByCategory: (category) => {
    if (!category) {
      return [];
    }

    return self.providers.filter((testProvider) => testProvider.category === category);
  },

  /**
   * Removes every registered provider in the given category and reports what
   * was removed, so a caller can log a change to which networks are trusted
   * rather than have it happen silently.
   *
   * Prefer `loadDefaultProviders({ excludeCategories })` where the providers are
   * not wanted at all — this exists for removing them after the fact, and for
   * consumers that register providers of their own.
   *
   * @param {string} category - The category to remove, e.g. 'ai-crawler'
   * @returns {string[]} The names removed, in registration order; empty if none matched
   *
   * @example
   * const removed = trustedProviders.deleteProvidersByCategory('ai-crawler');
   * console.error(`No longer trusting: ${removed.join(', ')}`);
   */
  deleteProvidersByCategory: (category) => {
    const removedNames = self.getProvidersByCategory(category).map((matchedProvider) => matchedProvider.name);

    // deleteProvider clears the parsed-address and result caches, so no stale
    // "trusted" verdict can survive the removal.
    for (const providerName of removedNames) {
      self.deleteProvider(providerName);
    }

    return removedNames;
  },

  /**
   * Registers an event listener for provider lifecycle events.
   *
   * Supported events:
   * - 'reload:start': Emitted when a provider begins reloading. Payload: { provider: string }
   * - 'reload:success': Emitted when a provider successfully reloads. Payload: { provider: string, timestamp: number }
   * - 'reload:error': Emitted when a provider fails to reload. Payload: { provider: string, error: Error, timestamp: number }
   * - 'error': Deprecated alias of 'reload:error', emitted only while an 'error' listener is registered
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
   * trustedProviders.on('reload:error', ({ provider, error }) => {
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
   * trustedProviders.on('reload:error', handleError);
   * // ... later ...
   * trustedProviders.off('reload:error', handleError);
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
    if (Number.isFinite(thresholdMs) && thresholdMs > 0) {
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
    // TTLCache requires a positive integer; build it before committing the setting
    if (Number.isInteger(ttlMs) && ttlMs > 0) {
      resultCache = new TTLCache(MAX_CACHED_RESULTS, ttlMs);
      resultCacheTtlMs = ttlMs;
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

        logger.debug(
          `⚠️  Provider ${providerName} marked as stale (${Math.floor(timeSinceUpdate / (60 * 60 * 1000))}h since update)`
        );
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
   * @param {Object} [options] - Load options
   * @param {string[]} [options.excludeCategories] - Categories to leave unregistered, e.g. ['ai-crawler']
   * @returns {void}
   *
   * @example
   * import trustedProviders from '@headwall/trusted-network-providers';
   * trustedProviders.loadDefaultProviders();
   * await trustedProviders.reloadAll();
   *
   * @example
   * // Load everything except the AI crawlers, so those ranges are judged on
   * // their own behaviour rather than trusted outright.
   * import trustedProviders, { PROVIDER_CATEGORY_AI_CRAWLER } from '@headwall/trusted-network-providers';
   * trustedProviders.loadDefaultProviders({ excludeCategories: [PROVIDER_CATEGORY_AI_CRAWLER] });
   */
  loadDefaultProviders: ({ excludeCategories = [] } = {}) => {
    // Excluded providers are never registered, rather than registered and then
    // removed, so no lookup can resolve against one in between.
    const excludedCategories = new Set(excludeCategories.filter((category) => !!category));

    for (const defaultProvider of defaultProviders) {
      if (excludedCategories.has(defaultProvider.category)) {
        logger.debug(`⏭️  Skip provider (category "${defaultProvider.category}"): ${defaultProvider.name}`);
        continue;
      }

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
   * A failed reload keeps the provider's previous data.
   *
   * @returns {Promise<PromiseSettledResult<void>[]>} One result per provider with a reload(), in registration order
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
        logger.debug(`🔃 Reload: ${provider.name}`);
        reloadRequests.push(reloadProvider(provider));
      }
    }

    // allSettled, so one provider's failure never stops the others
    const results = await Promise.allSettled(reloadRequests);

    // Providers that mutate their arrays directly do not notify the registry
    clearLookupCaches();

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
    let trustedSource = null;

    let parsedIp = null;
    if (typeof ipAddress !== 'string') {
      logger.error(`Failed to parse IP: expected a string, got ${describeInput(ipAddress)}`);
    } else {
      try {
        parsedIp = toMatchingForm(ipaddr.parse(ipAddress));
      } catch (error) {
        // parsedIp stays null, so the miss is cached below like any other
        logger.error(`Failed to parse IP: ${describeInput(ipAddress)}: ${error.message}`);
      }
    }

    // Equivalent spellings of one address share a cache entry
    const cacheKey = parsedIp ? parsedIp.toString() : ipAddress;

    // One read: a separate has()/get() pair can straddle the expiry instant
    const cachedSource = typeof ipAddress === 'string' ? resultCache.get(cacheKey) : undefined;

    if (cachedSource !== undefined) {
      trustedSource = cachedSource;
    } else if (parsedIp) {
      const ipAddressVersion = parsedIp.kind(); // 'ipv4' or 'ipv6'
      const canonicalIp = parsedIp.toString();

      // Linear search in registration order; first match wins
      const providerCount = self.providers.length;
      let providerIndex = 0;
      while (providerIndex < providerCount) {
        const provider = self.providers[providerIndex];
        const testPool = ipAddressVersion === IP_VERSION_V4 ? provider.ipv4 : provider.ipv6;

        try {
          if (testPool) {
            // Exact addresses, compared in canonical form
            const addressCount = testPool.addresses.length;
            for (let addressIndex = 0; addressIndex < addressCount; ++addressIndex) {
              if (canonicalAddress(testPool.addresses[addressIndex]) === canonicalIp) {
                trustedSource = provider.name;
                break;
              }
            }

            // CIDR ranges, parsed once and cached
            const rangeCount = trustedSource ? 0 : testPool.ranges.length;
            for (let rangeIndex = 0; rangeIndex < rangeCount; ++rangeIndex) {
              const testRange = testPool.ranges[rangeIndex];

              if (!parsedAddresses.has(testRange)) {
                parsedAddresses.set(testRange, ipaddr.parseCIDR(testRange));
              }

              const parsedRange = parsedAddresses.get(testRange);
              if (parsedRange[0].kind() === ipAddressVersion && parsedIp.match(parsedRange)) {
                trustedSource = provider.name;
                break;
              }
            }
          }
        } catch (error) {
          logger.error(`ERROR: Failed to find trusted source of ${describeInput(ipAddress)} in ${provider.name}`);
          logger.error(error);
        }

        if (trustedSource) {
          break;
        } else {
          ++providerIndex;
        }
      }
    }

    // Negative results are cached too, so repeated unknown addresses stay cheap
    if (cachedSource === undefined && typeof ipAddress === 'string') {
      resultCache.set(cacheKey, trustedSource);
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
    return typeof self.getTrustedProvider(ipAddress) === 'string';
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

// Export provider category constants for consumers
export { PROVIDER_CATEGORIES, PROVIDER_CATEGORY_AI_CRAWLER };

export default self;
