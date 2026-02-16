# Changelog for @headwall/trusted-network-providers

## 2.0.0 :: 2026-02-16

### ⚠️ Breaking Changes

- **ES Modules Migration**: Migrated from CommonJS to ES modules (ESM)
  - Replace `require()` with `import` statements
  - Use `await` instead of `.then()` for async operations
  - Requires `"type": "module"` in package.json or `.mjs` file extensions
  - See [docs/migration-v1-to-v2.md](docs/migration-v1-to-v2.md) for detailed migration guide
- **Node.js Version Requirement**: Now requires Node.js >= 18.0.0 (tested on v22.21.0)

### 🚀 New Features

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
  - Default TTL: 1 hour (configurable via `setResultCacheTtl(ms)`)
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
