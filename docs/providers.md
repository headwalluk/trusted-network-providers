# Built-in Providers

This document lists all built-in providers and explains how to add your own.

## Provider Reference

| Provider                | Type          | Data Source                               | Update Method                |
| ----------------------- | ------------- | ----------------------------------------- | ---------------------------- |
| Private                 | Static        | RFC 1918/4193 ranges                      | None (fixed)                 |
| Googlebot               | Bundled asset | `src/assets/googlebot-ips.json`           | `./scripts/update-assets.sh` |
| Google Special Crawlers | Bundled asset | `src/assets/google-special-crawlers.json` | `./scripts/update-assets.sh` |
| Google Workspace        | DNS/SPF       | `_spf.google.com`                         | `reloadAll()`                |
| Google Services         | Static        | `8.8.8.8`, `8.8.4.4`                      | None (fixed)                 |
| Stripe API              | HTTP API      | `stripe.com/files/ips/ips_api.json`       | `reloadAll()`                |
| Stripe Webhooks         | HTTP API      | `stripe.com/files/ips/ips_webhooks.json`  | `reloadAll()`                |
| Opayo                   | Static        | Hardcoded ranges                          | None (fixed)                 |
| PayPal                  | Static        | Hardcoded ranges                          | None (fixed)                 |
| MS Outlook              | Static        | Hardcoded ranges                          | None (fixed)                 |
| Cloudflare              | Static        | Hardcoded ranges                          | None (fixed)                 |
| Ezoic                   | Static        | Hardcoded ranges                          | None (fixed)                 |
| ShipHero                | Static        | Hardcoded addresses                       | None (fixed)                 |
| BunnyNet                | Bundled asset | `src/assets/bunnynet-ip*.json`            | `./scripts/update-assets.sh` |
| SemrushBot              | Static        | Hardcoded ranges                          | None (fixed)                 |
| AhrefsBot               | Static        | Hardcoded ranges                          | None (fixed)                 |
| FacebookBot             | Bundled asset | `src/assets/facebookbot-ip*.txt`          | `./scripts/update-assets.sh` |
| Brevo                   | Static        | Hardcoded ranges                          | None (fixed)                 |
| GetTerms                | Static        | Hardcoded address                         | None (fixed)                 |
| Labrika                 | Static        | Hardcoded addresses                       | None (fixed)                 |

### Disabled Providers

These providers exist in `src/providers/` but are commented out in the default provider list:

- **Mailgun** — DNS/SPF based (`mailgun.org`)
- **GTmetrix** — HTTP API (`gtmetrix.com/locations.xml`), removed due to Cloudflare proxy issue
- **Seobility** — HTTP API, unreliable data source

## Provider Types

**Static** — IP ranges are hardcoded in the provider file. No network calls needed. Always available.

**Bundled asset** — IP ranges loaded from JSON/text files shipped with the package. Updated by running `./scripts/update-assets.sh` before release. Verified with SHA-256 checksums.

**HTTP API** — IP ranges fetched from external HTTPS endpoints at runtime via `reloadAll()`. Responses are validated for structure and format.

**DNS/SPF** — IP ranges resolved from DNS SPF records at runtime via `reloadAll()`. Not DNSSEC-validated. See [dns-security-guide.md](dns-security-guide.md) for security implications.

## Adding a Custom Provider

Create a file in `src/providers/` following this template:

```javascript
/**
 * my-provider.js
 */

const self = {
  name: 'My Provider',
  testAddresses: ['1.2.3.4'],

  reload: async () => {
    // Clear existing data
    self.ipv4.addresses.length = 0;
    self.ipv4.ranges.length = 0;
    self.ipv6.addresses.length = 0;
    self.ipv6.ranges.length = 0;

    // Populate with new data
    self.ipv4.ranges.push('1.2.3.0/24');
  },

  ipv4: {
    addresses: [],
    ranges: [],
  },

  ipv6: {
    addresses: [],
    ranges: [],
  },
};

export default self;
```

Then register it in `src/index.js`:

```javascript
import myProvider from './providers/my-provider.js';

// Add to the defaultProviders array
const defaultProviders = [
  // ... existing providers
  myProvider,
];
```

Or register it at runtime without modifying library code:

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

trustedProviders.addProvider({
  name: 'My Provider',
  testAddresses: ['1.2.3.4'],
  ipv4: {
    addresses: ['1.2.3.4'],
    ranges: ['1.2.3.0/24'],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
});
```

### Provider Checklist

- Include at least one `testAddresses` entry for verification
- Implement `reload()` if data is dynamic
- Clear existing data before repopulating in `reload()`
- Use `secure-http-client.js` for any HTTPS requests
- Use `spf-analyser.js` for DNS/SPF-based providers
- Log errors with descriptive messages and re-throw
