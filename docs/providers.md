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

### Removed Providers

Providers that were tried and taken out. **Read this before adding one back.**

#### Seobility — removed 3.2.0, do not re-add

Seobility is not addable on the evidence available, and has cost time twice.
Adding it a third time needs new evidence, not a new attempt.

It was first disabled as an "unreliable data source". That was half right: its
`/static/ip_lists/bots/*.txt` endpoints now 404. It does publish a current feed
at `seobility.net/bots.json`, linked from its own bot page, so the provider was
briefly rebuilt against that in 3.1.0 — and the feed turns out not to describe
the crawler.

Measured 8 Sep 2026 against a day of live traffic (85 hits, 19 hours):

|                                              |                                 |
| -------------------------------------------- | ------------------------------- |
| Unique IPv6 hosts sending `SeobilityBot`     | 60                              |
| Feed IPv6 entries (64 bare hosts + 8 `/64`s) | 72                              |
| Observed hosts matching the feed             | **5**, all via the `/64` blocks |
| Observed hosts matching a bare feed entry    | **0**                           |

Every observed address was the `::1` of a Hetzner `/64`, and so is every bare
entry in the feed — different `/64`s. Two `/48`s carrying 50 of the 60 hosts had
no feed presence at all. Neither the observed hosts nor the feed's own entries
carry a PTR record, so forward-confirmed reverse DNS is not available as a
fallback. There is no other published source.

The consequences are what settle it:

- Trusting the feed as published matches under 10% of the real crawler, so the
  provider does not do the job it exists to do.
- Widening to the enclosing `/48` or to Hetzner's `2a01:4f8::/32` would extend
  trusted status to every Hetzner customer. A spoofed `SeobilityBot`
  user-agent from any Hetzner VM would then be trusted. This is disqualifying,
  not a trade-off — see the standing rule against guessing ranges below.
- With the user-agent spoofable and rDNS unavailable, a genuine unlisted
  Seobility host and an impostor are **indistinguishable**.

Being rate-limited costs an SEO crawler little, so the honest position is to
leave it untrusted.

**What would change the answer:** Seobility publishing a feed that actually
covers its fleet, or PTR records enabling FCrDNS. Re-measure against live logs
before trusting either claim — that is the check that caught this.

#### GTmetrix — removed 3.0.1

Its locations feed went behind a Cloudflare proxy. It was also the only reason
the package carried the `fast-xml-parser` dependency.

### Previously Disabled Providers

**Mailgun** was re-enabled in 3.1.0 and is registered by default. It was never
broken: the fault was in `spf-analyser.js`, which resolved `include:` targets
only one level deep. `mailgun.org` includes `_spf.mailgun.org`, which includes
`_spf1`/`_spf2` — where most of the ranges live. Fixed in 3.2.0; see the
changelog.

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
