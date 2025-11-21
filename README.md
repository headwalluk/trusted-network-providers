# trusted-network-providers

A lightweight Node.js library for identifying IP addresses that belong to trusted network providers. Prevent your firewalls from blocking legitimate services like payment processors, search engine crawlers, and monitoring tools.

[![npm version](https://badge.fury.io/js/%40headwall%2Ftrusted-network-providers.svg)](https://www.npmjs.com/package/@headwall/trusted-network-providers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npm install @headwall/trusted-network-providers
```

```javascript
const trustedProviders = require('@headwall/trusted-network-providers');

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

Includes 20+ trusted providers out of the box:
- **Search Engines**: Googlebot, AhrefsBot, SemrushBot
- **Payment Processors**: Stripe, PayPal, Opayo
- **Email Services**: Outlook, Brevo, Mailgun
- **CDN/Infrastructure**: Cloudflare, BunnyNet
- **Development Tools**: GTmetrix, GetTerms, Labrika
- **Social Media**: FacebookBot
- **E-commerce**: ShipHero
- **Networks**: Private/Internal (RFC 1918)

## Key Features

- ✅ Fast synchronous IP lookups (< 1ms typical)
- ✅ Support for IPv4 and IPv6
- ✅ CIDR range matching
- ✅ Dynamic provider updates from external sources
- ✅ Easy custom provider integration
- ✅ Zero configuration with sensible defaults

## API

### Core Functions

```javascript
// Load default providers
loadDefaultProviders()

// Update all providers with dynamic data
await reloadAll()

// Check if IP is trusted (returns provider name or null)
getTrustedProvider(ipAddress)

// Check if IP is trusted (returns boolean)
isTrusted(ipAddress)

// Provider management
addProvider(provider)
deleteProvider(providerName)
hasProvider(providerName)
getAllProviders()

// Testing
await runTests()
```

## Documentation

- **[Requirements](docs/requirements.md)** - Project requirements and specifications
- **[Implementation](docs/implementation.md)** - Architecture and technical details
- **[Issues](docs/issues.md)** - Known issues and improvement opportunities

## Example: Custom Provider

```javascript
trustedProviders.addProvider({
  name: 'My Custom Network',
  testAddresses: ['10.0.0.1'],
  ipv4: {
    addresses: ['10.0.0.1'],
    ranges: ['10.0.0.0/24']
  },
  ipv6: {
    addresses: [],
    ranges: []
  }
});
```

## Example: Express.js Middleware

```javascript
app.use((req, res, next) => {
  const provider = trustedProviders.getTrustedProvider(req.ip);
  if (provider) {
    req.trustedProvider = provider;
    // Skip rate limiting, logging, etc.
  }
  next();
});
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
