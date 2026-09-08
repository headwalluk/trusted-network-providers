# Changelog for @headwall/trusted-network-providers

## 3.2.1 :: 2026-09-08

### 📝 README provider list corrected

The Built-in Providers section omitted three providers that have been registered
all along — **Google Workspace**, **Google Services** and **Ezoic** — and still
advertised "25+". It now lists all 27, cross-checked against
`getAllProviders()`.

No code change.

## 3.2.0 :: 2026-09-08

### 🐛 SPF includes are followed to the bottom, not one level down

`spf-analyser.js` resolved `include:` targets a single level deep. Where the
includes nest, everything below the first level was silently dropped.

Mailgun is exactly that shape:

```
mailgun.org
├── include:_spf.mailgun.org
│   ├── include:_spf1.mailgun.org   → 4 ranges   ← never resolved
│   └── include:_spf2.mailgun.org   → 7 ranges   ← never resolved
└── include:_spf.eu.mailgun.org     → 11 ranges  ← the only ones we saw
```

The provider loaded 11 of its 22 ranges and looked healthy doing it. Checked
against a day of real deliveries (875 messages from 109 distinct Mailgun sender
IPs), it matched **38 of 109 IPs — 29.7% by volume**. After the fix it matches
**109 of 109, 100%**, and the range count goes 11 → 22.

Resolution now walks the include chain a level at a time, capped at the RFC 7208
§4.6.4 limit of ten DNS-querying mechanisms, which also bounds an include loop.
Hitting the cap logs the unfollowed targets rather than passing over them.

This also corrects **3.1.0**, which claimed Mailgun's `testAddresses` entry had
dropped out of the SPF record. It had not: `69.72.36.213` was in
`_spf1.mailgun.org` the whole time, two levels down. The provider had been
disabled for a fault in this analyser, not for a stale constant. Its test
addresses are now one from each half of the include tree, so a regression here
fails the test instead of quietly halving the ranges.

### 🗑️ Seobility removed

Removed and **not to be re-added** without new evidence. Its `bots.json` feed
does not describe its own crawler: against a day of live traffic, 5 of 60 unique
IPv6 hosts sending `SeobilityBot` matched, none of them via the feed's 64 bare
host entries. No PTR records exist on either side, so forward-confirmed reverse
DNS is unavailable, and the only widening that would close the gap is Hetzner's
`2a01:4f8::/32` — every Hetzner customer.

The full measurement, the reasoning, and what would change the answer are in
[docs/providers.md](docs/providers.md#seobility--removed-320-do-not-re-add) so
this does not get investigated a third time.

Default providers: 28 → 27.

## 3.1.0 :: 2026-09-08

### ✨ Mailgun and Seobility are registered by default

Both had been commented out of `defaultProviders`, and in both cases the comment
misdescribed the problem. The default set goes from 26 providers to 28.

**Mailgun** was never broken. Its SPF record resolves cleanly and yields 11 IPv4
ranges — but its single `testAddresses` entry, `69.72.36.213`, had dropped out of
that record, so `runTests()` failed and the provider was disabled rather than the
test address refreshed. The address is now `161.38.204.1`, inside
`161.38.204.0/22`, which sits within Mailgun's own ARIN allocation
`161.38.192.0/20` — it survives the SPF record being re-cut in a way an arbitrary
host address does not.

**Seobility** was labelled an unreliable data source. Its two `.txt` endpoints
under `/static/ip_lists/bots/` now return 404; Seobility publishes
[`bots.json`](https://www.seobility.net/bots.json) instead, linked from its own
[bot page](https://www.seobility.net/en/bot/) for automated discovery. The
provider is rewritten against it and loads 277 entries (205 IPv4, 72 IPv6).

The feed reuses Google's `{prefixes: [{ipv4Prefix | ipv6Prefix}]}` schema, but
unlike Google's it is mostly **bare host addresses rather than CIDR blocks**, so
each entry is routed on whether it carries a mask — pushing an unmasked address
into `ranges` would throw on the first `parseCIDR()`. Its response is
structure-checked, and a payload with an empty or missing `prefixes` array is
rejected rather than silently emptying the provider.

Both providers' test addresses had rotted the same way, which is worth noting for
anything similar: a provider whose data is fetched at runtime needs a test
address chosen for longevity, or it disables itself by degrees.

## 3.0.1 :: 2026-09-08

### 🧹 GTmetrix removed; `fast-xml-parser` dropped

`src/providers/gtmetrix.js` is deleted. It had been commented out of
`defaultProviders` since its locations feed went behind a Cloudflare proxy, so
it never loaded — but it was the sole importer of `fast-xml-parser`, meaning
every consumer installed an XML parser for a provider that could not run.

**`ipaddr.js` is now the only runtime dependency.**

Also removed `fetchXML()` from `secure-http-client.js`. It existed solely to
feed the GTmetrix provider and nothing else fetches XML; `fetchJSON()` and
`fetchText()` are unaffected. It was internal — only `.` is exported from the
package — so no consumer can have been using it.

No registered provider changed: the default set is the same 26 as in 3.0.0, and
lookups are unaffected. Mailgun and Seobility remain in `src/providers/`,
disabled.

## 3.0.0 :: 2026-09-08

### ⚠️ Breaking: Node.js >= 22.0.0

`engines` moves from `>=18.0.0` to `>=22.0.0`. Node 18 has been end-of-life
since April 2025 and Node 20 since April 2026. CI now tests on Node 22, 24 and
26.

No API changed and no runtime feature depends on Node 22 — this only stops the
package claiming support for versions that no longer receive security fixes.

### 🐛 Google Workspace resolved no addresses at all

`spf-analyser.js` only read IPs from `include:` targets, never from `ip4:`/`ip6:`
directives written directly on the record it was given. Google has since
flattened `_spf.google.com` from

```
v=spf1 include:_netblocks.google.com include:_netblocks2.google.com ... ~all
```

to inline directives:

```
v=spf1 ip4:74.125.0.0/16 ip4:209.85.128.0/17 ip6:2001:4860:4864::/56 ... ~all
```

With no `include:` left to follow, the analyser returned early and the **Google
Workspace provider held zero ranges** — every Google Workspace address was
reported as untrusted. The provider still reported `state: 'ready'` with no
error, and the one log line it did emit was at `info`, below the default level
of `error`, so nothing surfaced.

- The analyser now reads inline `ip4:`/`ip6:` directives from the root record as
  well as from includes, and combines both.
- It **no longer replaces provider data with nothing.** A lookup that yields no
  IPs keeps the previous data and logs at `error`, because an empty provider is
  indistinguishable from a working one that trusts nobody.
- Google Workspace's `testAddresses` is re-enabled, so `runTests()` covers it.

Fragmented (>255 character) TXT records are now reassembled for the root record
too, not just for includes.

### 📝 Documentation corrections

Audited `docs/**` against the code:

- **`security.md`** named MS Outlook, Brevo and PayPal as DNS/SPF providers.
  They are static hardcoded ranges; Google Workspace is the only SPF provider in
  the default set. It also claimed `update-assets.sh` could fetch that data at
  build time — it never has.
- **`dns-security-guide.md`** was still written for v1: six `require()` calls
  and a `module.exports` in a package that has been ESM-only since 2.0.0. Its
  "Solution 1" described bundled SPF assets as how the library works, three
  lines above admitting the support doesn't exist; it is now marked as a
  proposal. Its verification snippet asserted an IP that no longer resolves.
- **`README.md`** listed Mailgun and GTmetrix among the built-in providers —
  both are commented out of `defaultProviders`. `getProviderStatus()` was
  documented as returning a `name` key it has never returned. Added the missing
  link to `regular-maintenance.md`, and documented `once()`, `off()`,
  `checkStaleness()` and `getStalenessThreshold()`.
- **`migration-v1-to-v2.md`** pointed at `security.md` for a responsible
  disclosure policy that isn't there.

`providers.md` and `regular-maintenance.md` were checked line by line against
the registry and the update script and needed no corrections.

## 2.4.2 :: 2026-09-08

### 🔗 Thrown errors now carry their cause

Errors that wrap a lower-level failure now attach the original via the standard
`cause` option, so the chain survives to the consumer instead of being flattened
into a message string:

- `secure-http-client.js` — SSL validation failures, request timeouts, JSON
  parse failures, and the "all retries exhausted" error.
- `checksum-verifier.js` — the `ENOENT` behind "Asset file not found".

Messages are unchanged, so anything matching on error text still works.

### 🔧 ESLint 10

Upgraded `eslint` 9.39.5 → 10.10.0 (9.x is end-of-life) and promoted
`@eslint/js` to a direct devDependency — `eslint.config.js` imports it, so
relying on it arriving transitively was a latent break.

Two rules new to `recommended` in v10 found the four real defects fixed above
(`preserve-caught-error`) plus a redundant assignment in `getTrustedProvider()`
(`no-useless-assignment`).

The seven core formatting rules the config carried (`semi`, `quotes`,
`brace-style`, `arrow-parens`, `comma-dangle`, `no-trailing-spaces`,
`no-multiple-empty-lines`) are deprecated in v10 in favour of the `@stylistic`
plugin. They were dropped rather than replaced: Prettier already enforces all
seven from `.prettierrc.json`, and CI runs `format:check` alongside `lint`, so
this removes a duplicated concern rather than a check.

**CI:** lint and formatting moved out of the Node version matrix into their own
job on Node 22. ESLint 10 requires Node >= 20.19, which the matrix's Node 18 leg
cannot satisfy — but that is a toolchain floor, not a runtime one. The library
still supports and is still tested on Node 18, 20 and 22, and `engines` is
unchanged at `>=18.0.0`.

## 2.4.1 :: 2026-09-08

### 🔄 Asset refresh

Routine refresh of bundled IP lists from upstream sources:

- **Googlebot** (`googlebot-ips.json`): 315 → 317 prefixes
- **Google Special Crawlers** (`google-special-crawlers.json`): 270 → 272
  prefixes
- **Google User-Triggered Fetchers** (`google-user-fetchers.json`): 494 → 496
  prefixes
- **ChatGPT-User** (`chatgpt-user-ips.json`): 204 → 207 prefixes
- **BunnyNet IPv4** (`bunnynet-ip4s.json`): 590 → 586 addresses
- **BunnyNet IPv6** (`bunnynet-ip6s.json`): 324 → 322 addresses

Bingbot, Applebot, GPTBot, OAI-SearchBot and both FacebookBot lists were
unchanged. Checksum manifest regenerated.

### 🔒 Dependency maintenance

- Lockfile refreshed within the existing semver ranges: `ipaddr.js` 2.2.0 →
  2.5.0, `fast-xml-parser` 5.8.0 → 5.11.1, plus dev toolchain (`eslint` 9.39.1 →
  9.39.5, `jest` 30.2.0 → 30.5.1, `prettier` 3.6.2 → 3.9.6). Clears one moderate
  advisory in `@humanfs/node` (a transitive ESLint dependency); `npm audit` is
  now clean. No declared ranges changed and no public API impact.

## 2.4.0 :: 2026-09-08

### ✨ Provider categories, and an `ai-crawler` category

Providers may now carry a `category`, and the registry can act on a category as
a set. One category is defined: **`ai-crawler`**, covering **Applebot**,
**GPTBot**, **OAI-SearchBot** and **ChatGPT-User**.

The motivating case is a consumer withdrawing trusted status from the AI
crawlers. That was already possible by calling `deleteProvider()` four times
from a hand-maintained list of names — and that list is the problem: it goes
stale in silence. Add a fifth crawler here and every consumer holding four names
keeps trusting it, with nothing to notice. The category travels with the
provider instead, so a provider joining a category is picked up by every
consumer that filters on it.

**New API:**

- **`loadDefaultProviders({ excludeCategories })`** — leaves a category
  unregistered rather than registering and then removing it, so no lookup can
  resolve against one in between. Called with no arguments it behaves exactly as
  before.
- **`getProvidersByCategory(category)`** — the matching providers in
  registration order; `[]` for an unknown category.
- **`deleteProvidersByCategory(category)`** — removes them and **returns the
  names removed**, so a consumer can log a change to which networks are trusted
  rather than have it happen silently. Clears the parsed-address and result
  caches through `deleteProvider()`, so no stale "trusted" verdict survives.
- **`PROVIDER_CATEGORY_AI_CRAWLER`** and **`PROVIDER_CATEGORIES`** exported from
  the package root; the definitions live in `src/categories.js`.

**Notes:**

- **Nothing is excluded by default.** All 26 providers still load, and every
  existing call site behaves identically — this release only makes the exclusion
  *expressible*. Whether an AI crawler has earned trusted status is a judgement
  for the consumer, not for this package.
- Excluding a category does **not** mark those networks as bad. It withdraws a
  privilege, leaving them to be judged on their own behaviour like any other
  network.
- `category` is **optional** on a provider. Consumers registering their own
  providers may set one of their own; uncategorised providers never match a
  category filter. A non-string or blank `category` is now rejected by
  `addProvider()` rather than silently never matching.

### 🧪 Tests

- **`test/provider-categories.test.js`** — 18 tests covering membership (exactly
  those four, and explicitly *not* Googlebot, Bingbot, Cloudflare, Stripe API or
  Private), both removal paths, idempotency, unknown and blank categories, and
  consumer-registered providers with and without a category.

No breaking changes.

## 2.3.0 :: 2026-08-29

### ✨ New providers — AI crawlers and Applebot (Milestone 7)

Four new bundled-asset providers, each reading the same Google-style
`{creationTime, prefixes[]}` feed and SHA-256 verified on load:

- **Applebot** (`applebot-ips.json`, 33 prefixes) — Apple's crawler behind Siri,
  Spotlight Suggestions and Safari search suggestions.
  Source: `search.developer.apple.com/applebot.json`
- **GPTBot** (`gptbot-ips.json`, 21 prefixes) — OpenAI's training crawler.
  Source: `openai.com/gptbot.json`
- **OAI-SearchBot** (`oai-searchbot-ips.json`, 35 prefixes) — OpenAI's
  search/indexing crawler. Source: `openai.com/searchbot.json`
- **ChatGPT-User** (`chatgpt-user-ips.json`, 204 prefixes) — OpenAI's
  user-triggered fetcher, i.e. requests made because a user asked ChatGPT to
  visit a page. Source: `openai.com/chatgpt-user.json`

ChatGPT-User was previously deferred on the grounds that user-triggered fetchers
were out of scope. That reasoning was already overturned for Google's fetchers
in 2.2.0, after they were being RBL'd and breaking Gmail newsletter images; the
same argument applies here, so it is included.

### 📌 Notes for consumers

- **All four feeds are IPv4-only.** None publishes an `ipv6Prefix` entry today,
  so these providers ship an empty `ipv6.ranges`. That is the expected state,
  not a loading failure.
- **GPTBot and OAI-SearchBot share 6 egress prefixes.** OpenAI reuses egress
  infrastructure across its crawlers. Lookups scan in registration order, so a
  shared prefix reports `GPTBot`. Both are trusted, so this affects only the
  reported name and never the trust decision — but don't use the provider name
  to tell OpenAI's crawlers apart.

No breaking changes; the public API is unchanged.

## 2.2.2 :: 2026-08-29

### 🔄 Asset refresh

Routine refresh of bundled IP lists from upstream sources:

- **Google User-Triggered Fetchers** (`google-user-fetchers.json`): 452 → 494
  prefixes
- **BunnyNet IPv4** (`bunnynet-ip4s.json`): 627 → 590 addresses
- **BunnyNet IPv6** (`bunnynet-ip6s.json`): 355 → 324 addresses
- **FacebookBot IPv4** (`facebookbot-ip4s.txt`): 417 → 416 routes (removed
  `189.247.71.0/24`)
- **FacebookBot IPv6** (`facebookbot-ip6s.txt`): 635 → 633 routes (removed
  `2806:1090:cbff::/48`, `2806:10a0:cbff::/48`)

Googlebot, Google Special Crawlers, and Bingbot were unchanged (identical prefix
sets). Checksum manifest regenerated.

### 🔒 Dependency maintenance

- `npm audit fix` applied to the dev toolchain, clearing 3 advisories (2 high, 1
  low) in transitive dev dependencies — `brace-expansion`, `js-yaml`, and
  `@babel/core`. Lockfile-only; no runtime dependencies changed and no public
  API impact.

## 2.2.1 :: 2026-07-18

### 🔄 Asset refresh

Routine refresh of bundled IP lists from upstream sources:

- **BunnyNet IPv4** (`bunnynet-ip4s.json`): 582 → 627 addresses
- **BunnyNet IPv6** (`bunnynet-ip6s.json`): 336 → 355 addresses
- **FacebookBot IPv6** (`facebookbot-ip6s.txt`): +2 routes (`2803:6080::/29`,
  `2a03:2880:ff04::/47`)

Googlebot, Google Special Crawlers, Google User-Triggered Fetchers, and Bingbot
were unchanged (identical prefix sets). Checksum manifest regenerated.

### 🐛 Maintenance-script fixes

- **FacebookBot WHOIS de-duplication**: the RADB mirror had begun returning each
  route object multiple times, inflating `facebookbot-ip4s.txt` (436 → 772
  lines) and `facebookbot-ip6s.txt` (633 → 1215 lines) with pure duplicates on
  the previous run. `update-assets.sh` now de-duplicates the WHOIS output
  (order-preserving), so the IPv4 list drops back to its true 417 unique routes
  and IPv6 to 635. No IP coverage was lost — only duplicate lines removed.
- **Google feed timestamp churn**: the Google crawler JSON feeds embed a
  per-fetch `creationTime`, so `commit_asset`'s byte-exact compare rewrote those
  files on every run even when the prefix set was identical. It now compares the
  payload with `creationTime` stripped, keeping unchanged Google feeds a true
  git no-op.

## 2.2.0 :: 2026-06-19

### ✨ New provider

- **Google User-Triggered Fetchers** (`google-user-fetchers.json`, 452 prefixes):
  recognises Google's user-triggered fetcher infrastructure — the Gmail image
  proxy (`GoogleImageProxy`), Chrome's Privacy Preserving Prefetch Proxy,
  Feedfetcher, Google Read Aloud, Site Verifier, etc. — egressing from the
  `google-proxy-*.google.com` ranges (notably `66.249.80.0/20`) plus Google's
  edge blocks. Source:
  `developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json`
  (bundled asset, SHA-256 verified on load).

  **Why:** these IPs were being added to a downstream RBL via a fail2ban
  false-positive (Chrome prefetch probes to `/.well-known/traffic-advice`
  returning 403), which then blocked the Gmail image proxy and broke newsletter
  images in Gmail. The ranges don't overlap the Googlebot or Google Special
  Crawlers providers (those cover the crawler half of `66.249.64.0/19`); this is
  genuinely new coverage. See `dev-notes/08-milestone-8-google-user-fetchers.md`.

- Wired into `defaultProviders`, `update-assets.sh`, and `checksums.json`; docs
  (`README.md`, `docs/providers.md`, `docs/regular-maintenance.md`, `CLAUDE.md`)
  updated.

## 2.1.2 :: 2026-06-17

### 🔄 Asset refresh

Routine refresh of bundled IP lists from upstream sources:

- **Googlebot** (`googlebot-ips.json`): 313 → 315 prefixes
- **Google Special Crawlers** (`google-special-crawlers.json`): 268 → 270 prefixes
- **BunnyNet IPv4** (`bunnynet-ip4s.json`): 567 → 582 addresses
- **BunnyNet IPv6** (`bunnynet-ip6s.json`): 333 → 336 addresses
- **FacebookBot IPv6** (`facebookbot-ip6s.txt`): 632 → 633 routes

Bingbot and FacebookBot IPv4 were unchanged. Checksum manifest regenerated.

## 2.1.1 :: 2026-06-06

### 🐛 Fixes

- **Google crawler endpoints relocated**: Google retired the
  `/static/search/apis/ipranges/` paths — `googlebot.json` is now
  `common-crawlers.json` under `/static/crawling/ipranges/`, and
  `special-crawlers.json` moved to the same path. The old URLs had begun
  returning a "temporarily broken" stub. Updated the source URLs in
  `update-assets.sh`, the Googlebot and Google Special Crawlers providers, and
  the checksum manifest. (The Googlebot provider name and asset filename are
  unchanged; `common-crawlers.json` is the direct successor to `googlebot.json`.)

### 🔒 Security

- **FacebookBot assets now SHA-256 verified on load**: `facebookbot-ip4s.txt`
  and `facebookbot-ip6s.txt` were previously shipped without checksum
  verification (they were absent from `checksums.json`, which the verifier
  silently skips). Added their entries to the manifest and wired
  `facebookbot.js` to verify on load, matching the other bundled-asset providers.

### 🔧 Tooling

- **`update-assets.sh` reworked** into a download → validate → diff → report
  flow: downloads stage to a temp dir and only replace a live asset once
  validated **and** found to differ (atomic — a mid-run failure no longer leaves
  a half-updated bundle); per-source structure validation (not just "valid
  JSON"); prints `unchanged`/`UPDATED` with record-count deltas; exit codes
  `0` = no change, `10` = changes applied, `1` = error. See
  [docs/regular-maintenance.md](docs/regular-maintenance.md).

### 📦 Assets

- Refreshed bundled assets via `scripts/update-assets.sh`:
  - Googlebot (`common-crawlers.json`, 313 prefixes)
  - Google Special Crawlers (268 prefixes)
  - BunnyNet IPv4 (573 → 567 addresses)

### 📚 Documentation

- New [docs/regular-maintenance.md](docs/regular-maintenance.md) and a
  "Regular Maintenance" section in `CLAUDE.md` describing the run → review →
  patch-bump → changelog workflow.

## 2.1.0 :: 2026-05-30

### 🚀 New Features

- **Bingbot provider**: New bundled-asset provider for Microsoft's Bing search
  crawler (also powers Yahoo search). Recognises the official Bingbot IP ranges
  so legitimate Bing crawl traffic is classified as trusted.
  - Source: `https://www.bing.com/toolbox/bingbot.json` (same JSON format as Google's crawler lists)
  - Bundled as `src/assets/bingbot-ips.json`, SHA-256 verified on load
  - `update-assets.sh` now downloads `bingbot.json` and records its checksum
  - Registered after the Google providers in `defaultProviders`

## 2.0.0 :: 2026-02-16

### ⚠️ Breaking Changes

- **ES Modules Migration**: Migrated from CommonJS to ES modules (ESM)
  - Replace `require()` with `import` statements
  - Use `await` instead of `.then()` for async operations
  - Requires `"type": "module"` in package.json or `.mjs` file extensions
  - See [docs/migration-v1-to-v2.md](docs/migration-v1-to-v2.md) for detailed migration guide
- **Node.js Version Requirement**: Now requires Node.js >= 18.0.0 (tested on v22.21.0)

### 🚀 New Features

#### Providers

- **Google Special Crawlers provider**: New bundled-asset provider covering Google's special-case crawlers, which publish their IP ranges separately from Googlebot and are **not** present in `googlebot.json`. This fixes mis-reporting of Google Ads (AdsBot) traffic as untrusted.
  - Covers AdsBot-Google and AdsBot-Google-Mobile (Ads landing-page quality checks), Mediapartners-Google (AdSense), APIs-Google, and Google-Safety
  - Source: `developers.google.com/static/search/apis/ipranges/special-crawlers.json`
  - Bundled as `src/assets/google-special-crawlers.json`, SHA-256 verified on load
  - Registered immediately after Googlebot; user-triggered fetchers are intentionally excluded
  - `update-assets.sh` now downloads `special-crawlers.json` and records its checksum

#### Lifecycle & Observability

- **Provider State Tracking**: Track provider health with `getProviderStatus(name)`
  - States: `ready`, `loading`, `error`, `stale`
  - Includes `lastUpdated` timestamp and `lastError` for each provider
  - Exported state constants: `PROVIDER_STATE_READY`, `PROVIDER_STATE_LOADING`, `PROVIDER_STATE_ERROR`, `PROVIDER_STATE_STALE`
- **Lifecycle Events**: Monitor provider operations via EventEmitter
  - `reload:success` — fired when a provider successfully updates
  - `reload:error` — fired when a provider fails to update
  - `stale` — fired when a provider exceeds staleness threshold
- **Staleness Detection**: Configurable via `setStalenessThreshold(ms)`
  - Default: 24 hours (86400000ms)
  - Useful for long-running pm2 services to detect outdated provider data
- **Configurable Logging**: Replace bare console statements with log levels
  - Levels: `silent`, `error`, `warn`, `info`, `debug`
  - Configure via `setLogLevel(level)` and `getLogLevel()`
  - Default: `info`

#### Performance

- **LRU Cache for CIDR Parsing**: Max 5,000 parsed ranges
  - Reduces memory footprint vs unbounded `parsedAddresses` map
  - Automatic eviction of least-recently-used entries
- **Result Caching with TTL**: Cache IP lookup results
  - Default TTL: 1 hour (configurable via `setResultCacheTTL(ms)`)
  - Max 10,000 cached IPs
  - **192x speedup** for warm cache vs cold cache (30.5ms → 0.16ms for 15 IP lookups)
  - **1,394x speedup** for repeated lookups of the same IP (2.3ms → 0.0016ms)
  - Automatic invalidation on `reloadAll()` and `deleteProvider()`
  - See [dev-notes/05-milestone-5-performance.md](dev-notes/05-milestone-5-performance.md) for detailed profiling

### 🛠️ Code Quality & Modernisation

- **Async/Await Refactoring**: Replaced all Promise chains and `new Promise()` wrappers with async/await
  - Refactored `spf-analyser.js` — replaced nested promise callbacks
  - Refactored `reloadAll()` — now uses `Promise.allSettled()` instead of `Promise.all()`
  - Improved error handling consistency (no swallowed errors)
- **Modern JavaScript Patterns**:
  - Replaced `forEach` with `for...of` where appropriate
  - Replaced `hasProvider()` bitwise OR pattern with `.some()` / `.find()`
  - Use optional chaining and nullish coalescing operators
- **Improved Robustness**:
  - Fixed SPF analyser error handling — added `.catch()` on DNS resolution
  - Fixed race condition in provider data clearing (atomic swap)
  - Added input validation: max IPs per provider, max providers, CIDR validation
- **Test Coverage**: Achieved >80% coverage across all modules
  - 278 tests passing (up from 122 in v1.9.0)
  - Added comprehensive tests for refactored modules (secure-http-client, spf-analyser)
  - Added lifecycle and state tracking tests
  - Added performance benchmarks

### 📦 Dependencies

- **Removed**: `superagent` — replaced with Node.js native `fetch()`
  - Reduces package size and supply-chain attack surface
  - Maintains same timeout, retry, and TLS behaviour
- **Retained**: `fast-xml-parser` (required by GTmetrix), `ipaddr.js` (core IP parsing)
- **Audit**: 0 vulnerabilities ✓

### 📚 Documentation

- **New Files**:
  - [docs/migration-v1-to-v2.md](docs/migration-v1-to-v2.md) — Comprehensive migration guide
  - [dev-notes/05-milestone-5-performance.md](dev-notes/05-milestone-5-performance.md) — Performance profiling and analysis
- **Updated Files**:
  - README.md — Updated for ESM imports, new lifecycle APIs, and events
  - docs/security.md — Updated security considerations for v2.0
  - docs/implementation.md — Documented ESM, native fetch, async/await patterns, lifecycle events, LRU caching, input validation
- **Inline Comments**: Added comprehensive JSDoc comments for complex logic
  - `getTrustedProvider()` — IP lookup flow
  - `reloadAll()` — lifecycle event handling
  - `secure-http-client.js` — retry logic and error handling

### 🔧 Development Tools

- **npm Scripts**: Added `format`, `format:check`, `lint`, `lint:fix`
- **.nvmrc**: Pinned to Node.js 22 LTS
- **CI**: GitHub Actions workflow tests on Node.js 18, 20, 22
- **Test Framework**: Migrated from hand-rolled `src/test.js` to Jest

### ⚙️ Internal Changes

- Replaced `hasProvider()` bitwise OR pattern with `.some()` for readability
- Optimised array clearing operations (`array.length = 0`)
- Consistent use of strict equality (`===` vs `==`)
- Better Promise error handling patterns

---

## 1.9.0 :: 2025-11-21

### 🔒 Security Enhancements

- **HTTPS Certificate Validation**: All HTTP requests now enforce TLS 1.2+ with strict certificate validation
- **Checksum Verification**: SHA-256 checksums for all bundled assets (Googlebot, BunnyNet)
- **Structure Validation**: Runtime validation for API responses (Stripe)
- **Enhanced update-assets.sh**: Secure wget options, JSON validation, automatic checksum calculation
- **DNS Security Documentation**: Comprehensive guide for DNSSEC limitations and mitigations

### 🛠️ Code Quality Improvements

- **ESLint Integration**: Full ESLint v9 setup with flat config, 0 warnings
- **Prettier Formatting**: Consistent code formatting across all files
- **JSDoc Documentation**: Complete API documentation for all public functions with examples
- **Code Cleanup**: Removed debug statements, commented code, replaced inefficient array operations
- **Constants**: Magic strings replaced with named constants (IP_VERSION_V4, IP_VERSION_V6)

### 🐛 Bug Fixes

- **Critical**: Fixed array clearing bug in spf-analyser.js (addresses were not being cleared correctly)
- **Critical**: Fixed build.sh typo `[ $? -ne -0 ]` → `[ $? -ne 0 ]`
- **Logic Error**: Fixed ipv4/ipv6 mismatch in spf-analyser.js
- **Strict Equality**: Replaced all `==` with `===` for type-safe comparisons

### 📚 Documentation

- **New Files**: CONTRIBUTING.md, docs/security.md, docs/dns-security-guide.md, docs/issues.md, docs/implementation.md, docs/requirements.md
- **Enhanced README**: Added badges (Node.js version, test status, security), improved examples
- **Security Best Practices**: Comprehensive guide for DNS security and HTTPS validation

### 🔧 Development Tools

- **npm Scripts**: Added `format`, `format:check`, `lint`, `lint:fix`
- **Updated .gitignore**: Added IDE files, OS-specific files, Prettier cache
- **Dependencies Updated**: fast-xml-parser 4.x → 5.x, all packages on latest versions
- **Dev Dependencies**: Added ESLint 9.x and Prettier 3.x

### 📦 Package Improvements

- **Keywords**: Expanded for better npm discoverability
- **Engines**: Specified Node.js >=18.0.0 requirement
- **Files**: Optimized package contents

### ⚙️ Internal Changes

- Improved error handling and removed unused variables
- Optimized array clearing operations (`array.length = 0`)
- Better Promise patterns with unused parameter handling

## 1.8.1 :: 2025-08-13

* Updated the ShipHero provider.
* Updated assets with scripts/update-assets.sh

## 1.8.0 :: 2025-07-13

* Added Labrika provider
* Updated assets with scripts/update-assets.sh

## 1.7.0 :: 2025-06-02

* Added GetTerms provider
* Updated assets with scripts/update-assets.sh

## 1.6.0 :: 2024-12-15

* Added Brevo provider
* Updated assets with scripts/update-assets.sh

## 1.5.1 :: 2024-12-06

* Tidy up

## 1.5.0 :: 2024-12-06

* Added SemrushBot provider
* Added AHrefsBot provider
* Added FacebookBot provider

## 1.4.5 :: 2024-10-15

* Version bump to push the new readme to npm

## 1.4.4 :: 2024-10-14

* Tidied up assets.
* Moved the repos to Github. 
* Updated deps.

## 1.4.3 :: 2024-08-03

* Removed GTmetrix from the list of trusted servers because of a Cloudflare issue.

## 1.4.2 :: 2023-11-12

* Version bump, update changelog and republish to npm.

## 1.4.1 :: 2023-11-12

* Updated bundled IP address list assets.

## 1.4.0 :: 2023-07-28

* Added new function deleteProvider(providerName)
* In index.js, moved the providers array into self

## 1.3.7 :: 2023-07-10

* Minor : Updated bundled assets and version-bumped the package.

## 1.3.6 :: 2023-05-26

* New provider : BunnyNet IPs. Currently supplied as static files that can be updated by the update-assets.sh script, but we might rejig this as an auto-updater.

## 1.3.5 :: 2023-05-22

* Added a small bash script to fetch/udpate src/assets/googlebot-ips.json

## 1.3.4 :: 2023-05-19

* Ship a built-in set of GoogleBot IPs so we don't need to keep hitting Google for the JSON download at regular intervals.

## 1.3.2 & 1.3.3 :: 2023-05-15

* New provider : Seobility web crawlers
* Fixed a bug where some providers "self" wasn't set to const.

## 1.3.1 :: 2023-04-26

* New provider : GTmetrix test locations

## 1.3.0 :: 2023-04-25

* New provider : Mailgun
* Added a new helper, "spf-analyser" to make it easier to create trusted providers that store their IP addresses in (potentially dynamic) DNS/TXT (SPF) records, such as Google and Mailgun. NOTE: We need to move Outlook over to this new methodology too.
* Fixed some promise-based logic issues when moving the Google Workspace code over to the spf-analyser code.

## 1.2.0 :: 2023-04-21

* New provider : ShipHero

## 1.1.1 :: 2023-04-11

* Improved "README.md" with more info on how to create your own trusted network provider, complete with dynamic update.

## 1.1.0 :: 2023-04-11

* Added a new provider called "Google Services", with their DNS resolvers.
* Tidied up the tests a little bit.
