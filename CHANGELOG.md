# Changelog for @headwall/trusted-network-providers

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
