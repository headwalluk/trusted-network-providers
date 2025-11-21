# Issues & Improvement Roadmap

This document tracks known issues, bugs, and opportunities for improvement in the trusted-network-providers project.

**Last Updated:** 2025-11-21  
**Status:** Active Development Planning

---

## 🔴 Critical: Security & Bugs

Issues that could affect security, data integrity, or cause runtime failures.

### SEC-1: External Data Source Validation

**Priority:** Critical  
**Impact:** Security

External HTTP endpoints and DNS queries lack integrity verification, making the system vulnerable to man-in-the-middle attacks or DNS poisoning.

- [x] Add HTTPS certificate validation/pinning for HTTP providers
- [x] Implement checksum or signature verification for JSON endpoints
- [x] Add DNSSEC validation for DNS-based providers (or document limitation)
- [ ] Consider fallback to bundled assets if external source fails validation
- [ ] Add configuration option to disable external updates for air-gapped environments

**Implementation Notes (2025-11-21):**

**Phase 1 - HTTPS Validation:**

- Created `src/utils/secure-http-client.js` with strict HTTPS enforcement
- All HTTP providers now use secure client with TLS 1.2+ and certificate validation
- Added timeouts (30s default) and retry logic with exponential backoff
- Updated providers: stripe-api, stripe-webhooks, googlebot, seobility, gtmetrix
- Enhanced update-assets.sh with secure wget options and JSON validation
- Non-HTTPS URLs are explicitly rejected with error messages

**Phase 2 - Checksum Verification:**

- Created `src/utils/checksum-verifier.js` for SHA-256 checksum validation
- Created `src/assets/checksums.json` to store expected checksums
- Enhanced secure-http-client to support checksum verification
- Bundled assets (Googlebot, BunnyNet) now verified on load
- Runtime providers (Stripe) use structure validation instead (data changes frequently)
- update-assets.sh automatically calculates and stores checksums
- Checksum mismatches logged as warnings (non-blocking by default)

**Phase 3 - DNSSEC Documentation:**

- Node.js built-in DNS module does not support DNSSEC validation
- External DNSSEC libraries exist but add significant complexity and dependencies
- Documented DNS security limitations in security.md
- Recommended mitigations: use bundled assets, DNSSEC-validating resolvers, out-of-band verification
- Added warnings to DNS-based provider documentation
- Providers affected: Google Workspace, Mailgun (via SPF records)

**Affected Files:**

- `src/providers/stripe-api.js`
- `src/providers/stripe-webhooks.js`
- `src/providers/googlebot.js` (reloadFromWeb)
- `src/spf-analyser.js`
- `scripts/update-assets.sh`

### BUG-1: Array Clearing Bug in spf-analyser.js

**Priority:** Critical  
**Impact:** Correctness  
**Status:** ✅ FIXED (2025-11-21)

Lines 163 and 169 incorrectly cleared ranges instead of addresses, causing IPv4/IPv6 addresses to persist when they should be cleared.

- [x] Fix line 163: Changed `provider.ipv4.ranges.pop()` to `provider.ipv4.addresses.pop()`
- [x] Fix line 169: Changed `provider.ipv6.ranges.pop()` to `provider.ipv6.addresses.pop()`
- [x] Verified with test suite (all 40+ tests passing)
- [ ] Add unit test to verify arrays are cleared correctly
- [ ] Review all other instances of array clearing for similar bugs

**Affected Files:**

- `src/spf-analyser.js` (lines 160-170)

### SEC-2: Input Validation & Resource Limits

**Priority:** High  
**Impact:** Security, Stability

Missing limits on data sizes could lead to memory exhaustion or ReDoS attacks.

- [ ] Add maximum IP count per provider (e.g., 10,000)
- [ ] Add maximum SPF record length validation
- [ ] Add maximum provider count limit
- [ ] Implement timeout for DNS queries in spf-analyser
- [ ] Add timeout for HTTP requests in providers
- [ ] Validate CIDR notation before parsing

**Affected Files:**

- `src/index.js` (addProvider, getTrustedProvider)
- `src/spf-analyser.js`
- All provider files with reload functions

### SEC-3: Error Handling & State Management

**Priority:** High  
**Impact:** Reliability

Failed reloads silently continue with potentially stale data, and errors are only logged without proper tracking.

- [ ] Add provider state tracking (loading, ready, error, stale)
- [ ] Add timestamp for last successful update
- [ ] Expose provider health status via API
- [ ] Change `reloadAll()` to use `Promise.allSettled()` for resilience
- [ ] Add error callback/event emitter for failed reloads
- [ ] Consider marking providers as "stale" after X hours without successful update

**Affected Files:**

- `src/index.js`
- All provider files with reload functions

### SEC-4: Build Script Validation

**Priority:** Medium  
**Impact:** Build Process  
**Status:** 🟢 PARTIALLY COMPLETE (2025-11-21)

Build scripts lack proper error handling and validation.

- [x] Fix `build.sh` line 13: Changed `[ $? -ne -0 ]` to `[ $? -ne 0 ]` ✅
- [x] Add checksums for downloaded assets ✅ (completed in SEC-1 Phase 2)
- [x] Validate downloaded file formats before saving ✅ (completed in SEC-1)
- [x] Exit with proper error codes on failure ✅ (update-assets.sh uses set -e)
- [ ] Add error handling to `update-assets.sh` for each individual download (additional improvements)

**Affected Files:**

- `scripts/build.sh`
- `scripts/update-assets.sh`

---

## 🟡 High Priority: Performance & Code Quality

Issues affecting performance, maintainability, and developer experience.

### PERF-1: IP Lookup Optimization

**Priority:** High  
**Impact:** Performance

Current linear search is O(n×m) which becomes slow with many providers and ranges.

- [ ] Profile current performance with 20+ providers
- [ ] Implement first-octet indexing for IPv4 (256 buckets)
- [ ] Consider interval tree or radix tree for CIDR ranges
- [ ] Benchmark different data structures
- [ ] Add performance metrics/instrumentation
- [ ] Document performance characteristics in implementation.md

**Affected Files:**

- `src/index.js` (getTrustedProvider function)

### PERF-2: Result Caching & Memoization

**Priority:** Medium  
**Impact:** Performance

Same IPs are looked up repeatedly without caching results.

- [ ] Implement LRU cache for lookup results
- [ ] Add configurable cache size (default: 1000 entries)
- [ ] Add configurable TTL (default: 5 minutes)
- [ ] Invalidate cache on provider reload
- [ ] Add cache hit/miss metrics
- [ ] Make caching optional via configuration

**Affected Files:**

- `src/index.js`

### PERF-3: Memory Management

**Priority:** Medium  
**Impact:** Memory Usage  
**Status:** 🟢 PARTIALLY COMPLETE (2025-11-21)

Unbounded cache growth and inefficient array operations.

- [x] Replace `while().pop()` with `array.length = 0` throughout ✅
  - Updated `src/spf-analyser.js` (4 arrays)
  - Updated `src/providers/facebookbot.js` (2 arrays)
- [ ] Implement LRU eviction for `parsedAddresses` cache
- [ ] Add memory usage monitoring/reporting
- [ ] Consider WeakMap for cached data where appropriate
- [ ] Add maximum cache size configuration

**Affected Files:**

- `src/spf-analyser.js` ✅
- `src/providers/facebookbot.js` ✅
- `src/index.js` (cache management pending)
- `src/providers/googlebot.js` (not needed - uses bundled assets)
- `src/providers/bunnynet.js` (not needed - uses bundled assets)
- `src/providers/stripe-api.js` (not needed - no array clearing)

### QUALITY-1: Code Consistency & Standards

**Priority:** High  
**Impact:** Maintainability  
**Status:** 🟢 PARTIALLY COMPLETE (2025-11-21)

Inconsistent coding patterns make maintenance difficult.

- [x] Remove debug console.log statements ✅ (removed from spf-analyser.js)
- [x] Remove commented-out code ✅ (removed from index.js, spf-analyser.js)
- [x] Create constants for magic strings ('ipv4', 'ipv6', etc.) ✅
- [x] Add ESLint configuration ✅ (eslint.config.js with recommended rules)
- [x] Run Prettier for consistent formatting ✅ (all files formatted)
- [x] Fix all ESLint warnings ✅ (0 errors, 0 warnings)
- [ ] Standardize on `async/await` instead of mixed Promise patterns
- [ ] Create utility function for array clearing (now using array.length = 0 directly)

**ESLint Fixes Applied:**
- Replaced all `==` with `===` for strict equality
- Removed unused variables (`IP_VERSION_ALL`, `resolvedNetblocks`, `error` catch parameters)
- Renamed unused `reject` parameters to indicate intentional omission
- Fixed incorrect IP version logic in spf-analyser.js (ipv4 vs ipv6 mismatch)
- Removed double braces syntax error
- [ ] Document why providers are commented out in index.js

**Affected Files:**

- `src/index.js` ✅
- `src/spf-analyser.js` ✅
- Other `.js` files (remaining work)

### QUALITY-2: JSDoc Documentation

**Priority:** Medium  
**Impact:** Developer Experience  
**Status:** 🟢 PARTIALLY COMPLETE (2025-11-21)

Missing function documentation makes API unclear.

- [x] Add JSDoc comments to all public functions in index.js ✅
- [x] Document function parameters and return types ✅
- [x] Add examples in JSDoc ✅
- [x] Document provider object schema with @typedef ✅
- [ ] Generate API documentation with JSDoc tool
- [ ] Add inline comments for complex algorithms
- [ ] Add JSDoc to spf-analyser.js

**Completed Documentation:**

- `addProvider()` - Add new providers with validation
- `deleteProvider()` - Remove providers by name
- `getAllProviders()` - Get all registered providers
- `hasProvider()` - Check if provider exists
- `loadDefaultProviders()` - Load built-in providers
- `reloadAll()` - Refresh provider data from sources
- `getTrustedProvider()` - Main lookup function with examples
- `isTrusted()` - Boolean check for trusted IPs
- `runTests()` - Test runner for validation
- Provider typedef with complete schema

**Affected Files:**

- `src/index.js` ✅
- `src/spf-analyser.js` (pending)

---

## 🟢 Medium Priority: Testing & Type Safety

Issues affecting test coverage and type safety.

### TEST-1: Unit Testing Framework

**Priority:** High  
**Impact:** Quality Assurance

No proper unit test framework, only integration tests.

- [ ] Add Jest or Mocha as test framework
- [ ] Write unit tests for `getTrustedProvider()`
- [ ] Write unit tests for `addProvider()`, `deleteProvider()`, etc.
- [ ] Write unit tests for CIDR matching edge cases
- [ ] Write unit tests for IPv6 addresses
- [ ] Write unit tests for error conditions
- [ ] Write unit tests for spf-analyser
- [ ] Achieve >80% code coverage
- [ ] Add test script to package.json (separate from current test.js)

**Affected Files:**

- New: `test/` directory
- Update: `package.json`

### TEST-2: Integration & E2E Testing

**Priority:** Medium  
**Impact:** Quality Assurance

Current test.js is limited and doesn't cover all scenarios.

- [ ] Expand test addresses for each provider
- [ ] Add negative tests (IPs that shouldn't match)
- [ ] Test IPv6 matching for all providers
- [ ] Test concurrent reload operations
- [ ] Test provider load failures
- [ ] Mock HTTP requests for reliable testing
- [ ] Test memory leaks with long-running scenarios

**Affected Files:**

- `src/test.js`
- New: `test/integration/` directory

### TEST-3: CI/CD Pipeline

**Priority:** Medium  
**Impact:** Development Process

No automated testing on commits or pull requests.

- [ ] Add GitHub Actions workflow for testing
- [ ] Run tests on Node.js LTS versions (18, 20, 22)
- [ ] Add `npm audit` check to CI
- [ ] Add linting to CI
- [ ] Add code coverage reporting
- [ ] Automate asset updates on schedule
- [ ] Add semantic release for versioning

**Affected Files:**

- New: `.github/workflows/test.yml`
- New: `.github/workflows/update-assets.yml`

### TYPE-1: TypeScript Migration

**Priority:** Medium  
**Impact:** Type Safety, Developer Experience

JavaScript lacks type safety, leading to potential runtime errors.

- [ ] Create TypeScript definitions (.d.ts) for current codebase
- [ ] Publish types with package
- [ ] Plan full TypeScript migration strategy
- [ ] Migrate core index.js to TypeScript
- [ ] Migrate providers to TypeScript
- [ ] Add type checking to CI
- [ ] Update documentation for TypeScript usage

**Affected Files:**

- New: `types/index.d.ts`
- All `.js` files (future migration)

---

## 🔵 Low Priority: Features & Enhancements

New features and quality-of-life improvements.

### FEAT-1: Provider Lifecycle Management

**Priority:** Medium  
**Impact:** Feature Enhancement

No visibility into provider status or update schedules.

- [ ] Add `getProviderStatus(name)` API
- [ ] Add `lastUpdated` timestamp to providers
- [ ] Add `lastError` field to providers
- [ ] Add provider enable/disable functionality
- [ ] Add event emitter for provider state changes
- [ ] Add provider metadata (version, source URL, etc.)
- [ ] Document provider lifecycle in implementation.md

**Affected Files:**

- `src/index.js`

### FEAT-2: Automatic Update Scheduling

**Priority:** Medium  
**Impact:** User Experience

Users must manually schedule `reloadAll()` calls.

- [ ] Add optional auto-reload with configurable interval
- [ ] Add `startAutoReload(intervalMs)` function
- [ ] Add `stopAutoReload()` function
- [ ] Make auto-reload opt-in (disabled by default)
- [ ] Add jitter to prevent thundering herd
- [ ] Emit events on reload start/complete/error
- [ ] Document auto-reload in README

**Affected Files:**

- `src/index.js`

### FEAT-3: Enhanced Diagnostics

**Priority:** Low  
**Impact:** Developer Experience

Limited visibility into lookup performance and behavior.

- [ ] Add `getProviderForIP(ip)` that returns provider + matching rule
- [ ] Add lookup performance metrics (time, cache hit/miss)
- [ ] Add provider statistics (IP count, range count, hit count)
- [ ] Add `explain(ip)` function showing why IP matched
- [ ] Add debug logging levels (error, warn, info, debug, trace)
- [ ] Consider integration with debug module
- [ ] Add performance dashboard/reporter

**Affected Files:**

- `src/index.js`

### FEAT-4: Logging Abstraction

**Priority:** Low  
**Impact:** Integration Flexibility

Direct `console.log` usage prevents integration with logging frameworks.

- [ ] Accept optional logger instance in configuration
- [ ] Support common logger interface (info, warn, error, debug)
- [ ] Integrate with popular loggers (winston, pino, bunyan)
- [ ] Document logging configuration
- [ ] Replace all console.log/error calls with logger
- [ ] Make logging optional (silent mode)

**Affected Files:**

- `src/index.js`
- All provider files

### FEAT-5: Provider Priority & Ordering

**Priority:** Low  
**Impact:** Behavior Control

First-match-wins with implicit ordering is not flexible.

- [ ] Add optional `priority` field to providers (default: 0)
- [ ] Sort providers by priority on load
- [ ] Add `setProviderPriority(name, priority)` API
- [ ] Document priority behavior
- [ ] Consider explicit ordering API
- [ ] Add tests for priority ordering

**Affected Files:**

- `src/index.js`

### FEAT-6: Configuration Object

**Priority:** Low  
**Impact:** API Design

Global state and scattered configuration is hard to manage.

- [ ] Design configuration object schema
- [ ] Add `configure(options)` function
- [ ] Support options: caching, auto-reload, logging, limits
- [ ] Maintain backwards compatibility
- [ ] Document all configuration options
- [ ] Add configuration validation
- [ ] Consider multiple instances with different configs

**Affected Files:**

- `src/index.js`

---

## 📦 Dependencies & Maintenance

### DEP-1: Dependency Updates

**Priority:** High  
**Impact:** Security, Compatibility  
**Status:** ✅ COMPLETED (2025-11-21)

Dependencies may have security vulnerabilities or be outdated.

- [x] Run `npm audit` - ✅ 0 vulnerabilities found
- [x] Update `superagent` to latest compatible version
- [x] Update `ipaddr.js` to latest compatible version
- [x] Run `npm update` - 2 packages updated successfully
- [x] Verified with test suite (all 40+ tests passing)
- [x] Update `fast-xml-parser` to v5.x - ✅ Updated and tested successfully
- [ ] Set up automated dependency updates (Dependabot/Renovate)
- [ ] Test with Node.js v22 (latest LTS)
- [ ] Document supported Node.js versions

**Notes:**

- All dependencies now on latest versions
- `fast-xml-parser` upgraded from 4.5.3 → 5.x without breaking changes

**Affected Files:**

- `package.json`
- `package-lock.json`

### DEP-2: Unused Dependencies

**Priority:** Low  
**Impact:** Bundle Size

Some dependencies may not be actively used.

- [ ] Audit `fast-xml-parser` usage (appears unused)
- [ ] Remove unused dependencies
- [ ] Consider tree-shaking opportunities
- [ ] Document why each dependency is needed

**Affected Files:**

- `package.json`

---

## 📝 Documentation

### DOC-1: Code Examples & Guides

**Priority:** Medium  
**Impact:** User Experience

Users need more practical examples and integration guides.

- [ ] Add "Getting Started" guide with full example
- [ ] Add Express.js integration guide (expand current example)
- [ ] Add Fastify integration example
- [ ] Add custom provider examples (HTTP, DNS, static)
- [ ] Add troubleshooting guide
- [ ] Add performance tuning guide
- [ ] Add security best practices guide

**Affected Files:**

- New: `docs/guides/` directory
- Update: `README.md`

### DOC-2: Provider Documentation

**Priority:** Low  
**Impact:** Transparency

Users should know what each provider covers and how to update it.

- [ ] Document each built-in provider (purpose, source, update method)
- [ ] Add provider testing recommendations
- [ ] Document known limitations per provider
- [ ] Add provider update schedule recommendations
- [ ] List commented-out providers and why they're disabled

**Affected Files:**

- New: `docs/providers.md`

### DOC-3: Architecture Diagrams

**Priority:** Low  
**Impact:** Understanding

Visual representations would help new contributors.

- [ ] Create module dependency diagram
- [ ] Create provider lifecycle diagram
- [ ] Create IP lookup flowchart
- [ ] Create reload process diagram
- [ ] Add diagrams to implementation.md

**Affected Files:**

- `docs/implementation.md`
- New: `docs/diagrams/` directory

---

## 🎯 Quick Wins

These are easy-to-implement fixes that provide immediate value.

### Quick Win Checklist

- [x] Fix spf-analyser.js array clearing bug (BUG-1) ✅
- [x] Run `npm audit` and `npm update` ✅
- [x] Fix build.sh condition check (SEC-4) ✅
- [x] Replace `while().pop()` with `array.length = 0` everywhere ✅
- [x] Remove commented-out code ✅
- [x] Add JSDoc to main functions ✅
- [x] Create constants for 'ipv4' and 'ipv6' strings ✅
- [x] Update README badges ✅
- [x] Add CONTRIBUTING.md file ✅

**Estimated Time:** 2-4 hours ✅ **ALL COMPLETED**  
**Impact:** Immediate code quality improvement ✅

---

## Issue Status Legend

**Priority Levels:**

- 🔴 **Critical**: Security issues, data corruption, crashes
- 🟡 **High**: Performance problems, significant bugs
- 🟢 **Medium**: Feature gaps, testing needs
- 🔵 **Low**: Nice-to-have improvements

**Status Indicators:**

- [ ] Not Started
- [~] In Progress
- [x] Completed
- [!] Blocked

---

## Contributing to Issues

When working on issues:

1. Update checkbox status in this document
2. Reference issue number in commit messages (e.g., `[BUG-1] Fix array clearing`)
3. Add tests for bug fixes
4. Update relevant documentation
5. Run full test suite before committing

For new issues, add them to the appropriate section with:

- Unique ID (e.g., BUG-2, FEAT-7)
- Priority and impact assessment
- Task checklist
- Affected files list
