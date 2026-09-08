/**
 * Provider category tests (2.4.0)
 *
 * Categories exist so a consumer can act on a *set* of providers without
 * holding its own list of names — the motivating case being spamshield's
 * withdrawal of trusted status from the AI crawlers. The point of the feature
 * is that a provider added to a category later is picked up automatically, so
 * these tests pin membership and the two ways of acting on it, and assert that
 * nothing outside the category moves.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import trustedProviders, { PROVIDER_CATEGORIES, PROVIDER_CATEGORY_AI_CRAWLER } from '../src/index.js';

// The registry is a singleton, so every test starts from an empty one.
const clearRegistry = () => {
  trustedProviders.getAllProviders().forEach((registeredProvider) => {
    trustedProviders.deleteProvider(registeredProvider.name);
  });
};

const AI_CRAWLER_NAMES = ['Applebot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User'];

// A sample of providers that must never be caught by the AI-crawler filter.
// Deliberately spans a search crawler, a CDN, a payment API and the private
// ranges, because an over-broad category would be worst exactly there.
const NON_CRAWLER_NAMES = ['Googlebot', 'Bingbot', 'Cloudflare', 'Stripe API', 'Private'];

describe('Provider categories', () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('exported constants', () => {
    test('should export the AI-crawler category', () => {
      expect(PROVIDER_CATEGORY_AI_CRAWLER).toBe('ai-crawler');
    });

    test('should list the AI-crawler category among the known categories', () => {
      expect(PROVIDER_CATEGORIES).toContain(PROVIDER_CATEGORY_AI_CRAWLER);
    });
  });

  describe('membership', () => {
    beforeEach(() => {
      trustedProviders.loadDefaultProviders();
    });

    test('should tag exactly the four AI crawlers', () => {
      const categorised = trustedProviders
        .getProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER)
        .map((matchedProvider) => matchedProvider.name);

      expect(categorised.sort()).toEqual([...AI_CRAWLER_NAMES].sort());
    });

    test('should not tag any other built-in provider as an AI crawler', () => {
      const allProviders = trustedProviders.getAllProviders();
      const categorised = allProviders
        .filter((registeredProvider) => registeredProvider.category === PROVIDER_CATEGORY_AI_CRAWLER)
        .map((registeredProvider) => registeredProvider.name);

      NON_CRAWLER_NAMES.forEach((providerName) => {
        expect(categorised).not.toContain(providerName);
      });
    });

    test('should return an empty array for an unknown category', () => {
      expect(trustedProviders.getProvidersByCategory('no-such-category')).toEqual([]);
    });

    test('should return an empty array when no category is given', () => {
      expect(trustedProviders.getProvidersByCategory()).toEqual([]);
      expect(trustedProviders.getProvidersByCategory('')).toEqual([]);
    });
  });

  describe('loadDefaultProviders({ excludeCategories })', () => {
    test('should register every provider when no exclusions are given', () => {
      trustedProviders.loadDefaultProviders();

      const names = trustedProviders.getAllProviders().map((registeredProvider) => registeredProvider.name);

      AI_CRAWLER_NAMES.forEach((providerName) => {
        expect(names).toContain(providerName);
      });
    });

    test('should leave an excluded category unregistered', () => {
      trustedProviders.loadDefaultProviders({ excludeCategories: [PROVIDER_CATEGORY_AI_CRAWLER] });

      const names = trustedProviders.getAllProviders().map((registeredProvider) => registeredProvider.name);

      AI_CRAWLER_NAMES.forEach((providerName) => {
        expect(names).not.toContain(providerName);
      });
    });

    test('should keep every other provider when a category is excluded', () => {
      trustedProviders.loadDefaultProviders();
      const fullCount = trustedProviders.getAllProviders().length;

      clearRegistry();
      trustedProviders.loadDefaultProviders({ excludeCategories: [PROVIDER_CATEGORY_AI_CRAWLER] });

      const names = trustedProviders.getAllProviders().map((registeredProvider) => registeredProvider.name);

      NON_CRAWLER_NAMES.forEach((providerName) => {
        expect(names).toContain(providerName);
      });
      expect(names.length).toBe(fullCount - AI_CRAWLER_NAMES.length);
    });

    test('should ignore an unknown or empty category in the exclusion list', () => {
      trustedProviders.loadDefaultProviders({ excludeCategories: ['no-such-category', '', null, undefined] });

      const names = trustedProviders.getAllProviders().map((registeredProvider) => registeredProvider.name);

      // An undefined entry must not match the uncategorised providers.
      NON_CRAWLER_NAMES.forEach((providerName) => {
        expect(names).toContain(providerName);
      });
      AI_CRAWLER_NAMES.forEach((providerName) => {
        expect(names).toContain(providerName);
      });
    });
  });

  describe('deleteProvidersByCategory()', () => {
    beforeEach(() => {
      trustedProviders.loadDefaultProviders();
    });

    test('should remove exactly the category and report the names', () => {
      const startingCount = trustedProviders.getAllProviders().length;
      const removed = trustedProviders.deleteProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER);

      expect(removed.sort()).toEqual([...AI_CRAWLER_NAMES].sort());
      expect(trustedProviders.getAllProviders().length).toBe(startingCount - AI_CRAWLER_NAMES.length);

      NON_CRAWLER_NAMES.forEach((providerName) => {
        expect(trustedProviders.hasProvider(providerName)).toBe(true);
      });
    });

    test('should leave the category empty afterwards', () => {
      trustedProviders.deleteProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER);

      expect(trustedProviders.getProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER)).toEqual([]);
    });

    test('should be a no-op for an unknown category', () => {
      const startingCount = trustedProviders.getAllProviders().length;

      expect(trustedProviders.deleteProvidersByCategory('no-such-category')).toEqual([]);
      expect(trustedProviders.getAllProviders().length).toBe(startingCount);
    });

    test('should be idempotent', () => {
      trustedProviders.deleteProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER);
      const countAfterFirst = trustedProviders.getAllProviders().length;

      expect(trustedProviders.deleteProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER)).toEqual([]);
      expect(trustedProviders.getAllProviders().length).toBe(countAfterFirst);
    });
  });

  describe('consumer-registered providers', () => {
    test('should accept a category of the consumer’s own', () => {
      trustedProviders.addProvider({
        name: 'Consumer Provider',
        category: 'consumer-category',
        ipv4: { addresses: ['203.0.113.1'], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
      });

      const categorised = trustedProviders
        .getProvidersByCategory('consumer-category')
        .map((matchedProvider) => matchedProvider.name);

      expect(categorised).toEqual(['Consumer Provider']);
    });

    test('should still accept a provider with no category', () => {
      trustedProviders.addProvider({
        name: 'Uncategorised Provider',
        ipv4: { addresses: ['203.0.113.2'], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
      });

      expect(trustedProviders.hasProvider('Uncategorised Provider')).toBe(true);
    });

    test('should reject a non-string category', () => {
      expect(() =>
        trustedProviders.addProvider({
          name: 'Bad Category Provider',
          category: 42,
          ipv4: { addresses: ['203.0.113.3'], ranges: [] },
          ipv6: { addresses: [], ranges: [] },
        })
      ).toThrow(/invalid category/);
    });

    test('should reject an empty-string category', () => {
      expect(() =>
        trustedProviders.addProvider({
          name: 'Blank Category Provider',
          category: '   ',
          ipv4: { addresses: ['203.0.113.4'], ranges: [] },
          ipv6: { addresses: [], ranges: [] },
        })
      ).toThrow(/invalid category/);
    });
  });
});
