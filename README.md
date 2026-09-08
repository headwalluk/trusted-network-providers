# trusted-network-providers

A lightweight Node.js library for identifying IP addresses that belong to trusted network providers. Prevent your firewalls from blocking legitimate services like payment processors, search engine crawlers, and monitoring tools.

[![npm version](https://badge.fury.io/js/%40headwall%2Ftrusted-network-providers.svg)](https://www.npmjs.com/package/@headwall/trusted-network-providers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0%20%7C%20tested%20v22.21.0-brightgreen)](https://nodejs.org/)
[![Test Status](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/headwalluk/trusted-network-providers)
[![Security](https://img.shields.io/badge/security-hardened-blue)](./docs/security.md)

> **⚠️ v2.0.0 Breaking Changes:** This version migrates from CommonJS to ES modules. Use `import` instead of `require()`. See the migration guide for details.

## Quick Start

```bash
npm install @headwall/trusted-network-providers
```

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

// Load built-in providers (Googlebot, Stripe, PayPal, Cloudflare, etc.)
trustedProviders.loadDefaultProviders();

// Initialize dynamic providers
await trustedProviders.reloadAll();

// Check an IP address
const provider = trustedProviders.getTrustedProvider('66.249.66.87');
console.log(provider); // "Googlebot"

const unknown = trustedProviders.getTrustedProvider('123.123.123.123');
console.log(unknown); // null
```

## Use Cases

- **Firewall Management**: Whitelist IPs for WordPress hosting networks
- **Rate Limiting**: Bypass rate limits for trusted crawlers
- **Access Control**: Allow trusted services through security layers
- **Traffic Analysis**: Identify and categorize legitimate traffic sources

## Built-in Providers

Includes 25+ trusted providers out of the box:

- **Search Engines**: Googlebot, Bingbot, Applebot, AhrefsBot, SemrushBot
- **AI Crawlers**: GPTBot, OAI-SearchBot (OpenAI) — with Applebot and ChatGPT-User, these carry the `ai-crawler` category and can be excluded as a set
- **Advertising**: Google AdsBot, AdSense (Google Special Crawlers)
- **User-Triggered Fetchers**: Google (Gmail image proxy, Chrome prefetch proxy, Feedfetcher, etc.), ChatGPT-User
- **Payment Processors**: Stripe, PayPal, Opayo
- **Email Services**: Outlook, Brevo, Mailgun
- **CDN/Infrastructure**: Cloudflare, BunnyNet
- **Development Tools**: GTmetrix, GetTerms, Labrika
- **Social Media**: FacebookBot
- **E-commerce**: ShipHero
- **Networks**: Private/Internal (RFC 1918)

## Key Features

- ✅ Fast synchronous IP lookups (< 1ms typical with caching)
- ✅ Support for IPv4 and IPv6
- ✅ CIDR range matching
- ✅ Dynamic provider updates from external sources
- ✅ Provider lifecycle events (reload, error, stale detection)
- ✅ Configurable result caching with TTL
- ✅ Easy custom provider integration
- ✅ Zero configuration with sensible defaults

## API

### Core Functions

```javascript
// Load default providers
loadDefaultProviders();

// Load them, leaving a whole category unregistered
loadDefaultProviders({ excludeCategories: ['ai-crawler'] });

// Update all providers with dynamic data
await reloadAll();

// Check if IP is trusted (returns provider name or null)
getTrustedProvider(ipAddress);

// Check if IP is trusted (returns boolean)
isTrusted(ipAddress);

// Provider management
addProvider(provider);
deleteProvider(providerName);
hasProvider(providerName);
getAllProviders();

// Category management (returns the names removed)
getProvidersByCategory(category);
deleteProvidersByCategory(category);

// Testing
await runTests();
```

### Lifecycle & Monitoring

```javascript
// Get provider status and metadata
const status = getProviderStatus('Googlebot');
// Returns: { name, state, lastUpdated, lastError }
// State: 'ready' | 'loading' | 'error' | 'stale'

// Listen to provider lifecycle events
trustedProviders.on('reload:success', ({ provider, timestamp }) => {
  console.log(`${provider} reloaded at ${new Date(timestamp)}`);
});

trustedProviders.on('reload:error', ({ provider, error }) => {
  console.error(`${provider} failed to reload:`, error);
});

trustedProviders.on('stale', ({ provider, lastUpdated, staleDuration }) => {
  console.warn(`${provider} is stale (last updated ${staleDuration}ms ago)`);
});

// Configure staleness detection (default: 24 hours)
trustedProviders.setStalenessThreshold(12 * 60 * 60 * 1000); // 12 hours
```

### Caching & Performance

```javascript
// Configure IP lookup result cache TTL (default: 1 hour)
trustedProviders.setResultCacheTTL(30 * 60 * 1000); // 30 minutes
const currentTtl = trustedProviders.getResultCacheTTL();
```

### Logging

```javascript
// Configure log level: 'silent' | 'error' | 'warn' | 'info' | 'debug'
trustedProviders.setLogLevel('info');
const level = trustedProviders.getLogLevel();
```

## Provider Categories

A category groups providers a consumer may want to act on as a set. The one
category defined today is `ai-crawler`, covering **Applebot**, **GPTBot**,
**OAI-SearchBot** and **ChatGPT-User**.

It exists because trusted status is a strong privilege — consumers use it to
bypass rate limits and blocklists — and whether an AI crawler has earned that is
a judgement each consumer makes for itself. Filtering by category rather than by
name means a crawler added to the category in a later release is picked up
automatically, where a hand-maintained list of names would silently keep
trusting it.

```javascript
import trustedProviders, { PROVIDER_CATEGORY_AI_CRAWLER } from '@headwall/trusted-network-providers';

// Preferred: never register them in the first place, so no lookup can resolve
// against one in between.
trustedProviders.loadDefaultProviders({ excludeCategories: [PROVIDER_CATEGORY_AI_CRAWLER] });

// Or withdraw them after the fact — reports what it removed, so a change to
// which networks are trusted need never be silent.
const removed = trustedProviders.deleteProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER);
console.error(`No longer trusting: ${removed.join(', ')}`);

// Inspect membership without changing anything.
trustedProviders.getProvidersByCategory(PROVIDER_CATEGORY_AI_CRAWLER);
```

Excluding a category does **not** mark those networks as bad — it only withdraws
the privilege, so they are judged on their own behaviour like any other network.

Providers you register yourself may carry a `category` of your own; a provider
with no category never matches a category filter.

## Provider State Constants

The library exports constants for checking provider states programmatically:

```javascript
import trustedProviders, {
  PROVIDER_STATE_READY,
  PROVIDER_STATE_LOADING,
  PROVIDER_STATE_ERROR,
  PROVIDER_STATE_STALE,
} from '@headwall/trusted-network-providers';

const status = trustedProviders.getProviderStatus('Stripe API');
if (status.state === PROVIDER_STATE_ERROR) {
  // Handle provider failure
}
```

## CLI

A `trusted-lookup` command is included for ad-hoc IP checks from the terminal.

Run it without installing, via `npx`:

```bash
# Check a single IP
npx -p @headwall/trusted-network-providers trusted-lookup 66.249.66.87

# Check several at once
npx -p @headwall/trusted-network-providers trusted-lookup 66.249.66.87 1.2.3.4
```

Or install globally to get the bare command:

```bash
npm install -g @headwall/trusted-network-providers
trusted-lookup 66.249.90.77
```

It prints the matching provider for each IP (or "not trusted"), and exits `0`
when every IP is trusted or `1` if any are untrusted — handy for scripts and CI:

```bash
if npx -p @headwall/trusted-network-providers trusted-lookup "$ip"; then
  echo "$ip is trusted"
fi
```

## Documentation

- **[Providers](docs/providers.md)** - Built-in provider reference and custom provider guide
- **[Security](docs/security.md)** - Security features and production recommendations
- **[DNS Security Guide](docs/dns-security-guide.md)** - DNS/SPF provider security considerations
- **[Migration Guide](docs/migration-v1-to-v2.md)** - Upgrading from v1.x to v2.x

## Example: Custom Provider

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

trustedProviders.addProvider({
  name: 'My Custom Network',
  testAddresses: ['10.0.0.1'],
  ipv4: {
    addresses: ['10.0.0.1'],
    ranges: ['10.0.0.0/24'],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
});
```

## Example: Express.js Middleware

```javascript
import express from 'express';
import trustedProviders from '@headwall/trusted-network-providers';

const app = express();

app.use((req, res, next) => {
  const provider = trustedProviders.getTrustedProvider(req.ip);
  if (provider) {
    req.trustedProvider = provider;
    // Skip rate limiting, logging, etc.
  }
  next();
});
```

## Example: Long-Running Service with Monitoring

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

// Configure logging for production
trustedProviders.setLogLevel('warn');

// Load providers
trustedProviders.loadDefaultProviders();
await trustedProviders.reloadAll();

// Monitor provider health
trustedProviders.on('stale', ({ provider, lastUpdated }) => {
  console.warn(`Provider ${provider} is stale, triggering reload...`);
  trustedProviders.reloadAll();
});

trustedProviders.on('reload:error', ({ provider, error }) => {
  // Alert your monitoring system
  console.error(`Critical: ${provider} reload failed:`, error.message);
});

// Check provider health periodically
setInterval(
  () => {
    const googlebot = trustedProviders.getProviderStatus('Googlebot');
    if (googlebot.state === 'error' || googlebot.state === 'stale') {
      console.warn(`Googlebot health check failed: ${googlebot.state}`);
    }
  },
  60 * 60 * 1000
); // Every hour
```

## Maintenance

Update bundled IP assets before releases:

```bash
./scripts/update-assets.sh
```

## License

MIT © Paul Faulkner

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/headwalluk/trusted-network-providers).
