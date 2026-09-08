# Built-in Providers

This document lists all built-in providers and explains how to add your own.

## Provider Reference

| Provider                       | Type          | Data Source                               | Update Method                |
| ------------------------------ | ------------- | ----------------------------------------- | ---------------------------- |
| Private                        | Static        | RFC 1918/4193 ranges                      | None (fixed)                 |
| Googlebot                      | Bundled asset | `src/assets/googlebot-ips.json`           | `./scripts/update-assets.sh` |
| Google Special Crawlers        | Bundled asset | `src/assets/google-special-crawlers.json` | `./scripts/update-assets.sh` |
| Google User-Triggered Fetchers | Bundled asset | `src/assets/google-user-fetchers.json`    | `./scripts/update-assets.sh` |
| Bingbot                        | Bundled asset | `src/assets/bingbot-ips.json`             | `./scripts/update-assets.sh` |
| Applebot                       | Bundled asset | `src/assets/applebot-ips.json`            | `./scripts/update-assets.sh` |
| GPTBot                         | Bundled asset | `src/assets/gptbot-ips.json`              | `./scripts/update-assets.sh` |
| OAI-SearchBot                  | Bundled asset | `src/assets/oai-searchbot-ips.json`       | `./scripts/update-assets.sh` |
| ChatGPT-User                   | Bundled asset | `src/assets/chatgpt-user-ips.json`        | `./scripts/update-assets.sh` |
| Google Workspace               | DNS/SPF       | `_spf.google.com`                         | `reloadAll()`                |
| Google Services                | Static        | `8.8.8.8`, `8.8.4.4`                      | None (fixed)                 |
| Stripe API                     | HTTP API      | `stripe.com/files/ips/ips_api.json`       | `reloadAll()`                |
| Stripe Webhooks                | HTTP API      | `stripe.com/files/ips/ips_webhooks.json`  | `reloadAll()`                |
| Opayo                          | Static        | Hardcoded ranges                          | None (fixed)                 |
| PayPal                         | Static        | Hardcoded ranges                          | None (fixed)                 |
| MS Outlook                     | Static        | Hardcoded ranges                          | None (fixed)                 |
| Cloudflare                     | Static        | Hardcoded ranges                          | None (fixed)                 |
| Ezoic                          | Static        | Hardcoded ranges                          | None (fixed)                 |
| ShipHero                       | Static        | Hardcoded addresses                       | None (fixed)                 |
| BunnyNet                       | Bundled asset | `src/assets/bunnynet-ip*.json`            | `./scripts/update-assets.sh` |
| SemrushBot                     | Static        | Hardcoded ranges                          | None (fixed)                 |
| AhrefsBot                      | Static        | Hardcoded ranges                          | None (fixed)                 |
| FacebookBot                    | Bundled asset | `src/assets/facebookbot-ip*.txt`          | `./scripts/update-assets.sh` |
| Brevo                          | Static        | Hardcoded ranges                          | None (fixed)                 |
| GetTerms                       | Static        | Hardcoded address                         | None (fixed)                 |
| Labrika                        | Static        | Hardcoded addresses                       | None (fixed)                 |
| Mailgun                        | DNS/SPF       | `mailgun.org`                             | `reloadAll()`                |
| Seobility                      | HTTP API      | `seobility.net/bots.json`                 | `reloadAll()`                |

### AI Crawlers

Four of the bundled-asset providers cover AI and assistant traffic, all of them
published as the same Google-style `{creationTime, prefixes[]}` JSON:

- **Applebot** — Apple's crawler behind Siri, Spotlight Suggestions and Safari
  search suggestions.
- **GPTBot** — OpenAI's training crawler.
- **OAI-SearchBot** — OpenAI's search/indexing crawler. Note the feed is
  published at `openai.com/searchbot.json`; the more obvious
  `oai-searchbot.json` path does not exist.
- **ChatGPT-User** — OpenAI's user-triggered fetcher, i.e. a request made
  because someone asked ChatGPT to visit a page. Included for the same reason as
  Google's user-triggered fetchers: the traffic is legitimate and blocking it
  silently breaks a real user's action.

All four feeds are **IPv4-only** at present — none publishes an `ipv6Prefix`
entry — so an empty `ipv6.ranges` on these providers is expected, not a fault.

**Overlapping prefixes:** OpenAI reuses egress infrastructure across its
crawlers, so a small number of prefixes appear in both the GPTBot and
OAI-SearchBot feeds. Lookups scan providers in registration order, so a shared
prefix reports whichever is registered first (GPTBot, by default). Both are
trusted, so this affects only the reported name, never the trust decision — but
don't rely on the provider name to distinguish OpenAI's crawlers from one
another.

**All four carry `category: 'ai-crawler'`** (2.4.0), so a consumer can withdraw
trusted status from the set without naming them:

```javascript
trustedProviders.loadDefaultProviders({ excludeCategories: ['ai-crawler'] });
```

Filter by the category rather than by name. A crawler added to this section in a
later release joins the category with it, where a hand-maintained list of four
names would silently keep trusting the fifth. Excluding them does not mark the
networks as bad — it withdraws a privilege, leaving them to be judged on their
own behaviour. See the README's _Provider Categories_ section.

### Previously Disabled Providers

Every provider in `src/providers/` is now registered by default.

**Mailgun** and **Seobility** were re-enabled in 3.1.0. Neither was broken in the
way its comment claimed — both had simply gone stale:

- **Mailgun** resolved fine, but its `testAddresses` entry had left the SPF
  record, so `runTests()` failed. The address is now taken from a range inside
  Mailgun's own ARIN allocation, which outlives a re-cut SPF record.
- **Seobility** fetched two `.txt` lists that now 404. It publishes
  `bots.json` instead, in the `{prefixes:[…]}` shape Google uses.

> **Seobility's IPv6 list is incomplete.** Measured 8 Sep 2026 against a day of
> live traffic: of 60 unique IPv6 hosts sending `SeobilityBot` in 19 hours, the
> feed matched **5**, all via its eight `/64` blocks — not one of its 64 bare
> IPv6 host entries appeared in the log. Seobility's crawler fleet rotates
> Hetzner `/64`s faster than it publishes them, and the hosts carry no PTR
> record, so forward-confirmed reverse DNS is not available as a fallback.
>
> The provider is still correct: it trusts exactly what Seobility vouches for.
> Do **not** widen the match to the enclosing `/48` or to Hetzner's
> `2a01:4f8::/32` — that would extend trusted status to every Hetzner customer.
> The practical consequence is that whitelisting Seobility catches a minority of
> its IPv6 crawling, which for an SEO crawler is a tolerable outcome.

**GTmetrix** was deleted in 3.0.1 — its locations feed went behind a Cloudflare
proxy, and it was the only reason the package carried `fast-xml-parser`.

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
- Set `category` if the provider belongs to a group consumers act on as a set (see `src/categories.js`); leave it unset otherwise
- Implement `reload()` if data is dynamic
- Clear existing data before repopulating in `reload()`
- Use `secure-http-client.js` for any HTTPS requests
- Use `spf-analyser.js` for DNS/SPF-based providers
- Log errors with descriptive messages and re-throw
