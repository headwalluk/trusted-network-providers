/**
 * categories.js
 *
 * Provider categories. A category groups providers a consumer may want to treat
 * as a set rather than name one by one — the motivating case being the
 * withdrawal of trusted status from the AI crawlers.
 *
 * Naming each provider at the call site works until the set changes: a consumer
 * holding its own list of four names silently keeps trusting the fifth crawler
 * this package adds. The category travels with the provider, so a provider
 * joining a category is picked up by every consumer that filters on it.
 *
 * `category` is optional on a provider. Providers registered by consumers
 * (`addProvider`) may set one of their own; anything uncategorised simply never
 * matches a category filter.
 */

/**
 * Crawlers and fetchers operated by AI companies.
 *
 * Trusted status is a strong privilege — consumers use it to bypass rate limits
 * and blocklists — and whether an AI crawler has earned it is a judgement each
 * consumer makes for itself, so the category exists to make that switchable.
 * Membership is about who operates the crawler, not how it behaves.
 */
export const PROVIDER_CATEGORY_AI_CRAWLER = 'ai-crawler';

/** Every category this package assigns to its own built-in providers. */
export const PROVIDER_CATEGORIES = [PROVIDER_CATEGORY_AI_CRAWLER];
