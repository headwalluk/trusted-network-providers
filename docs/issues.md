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

- [ ] Add HTTPS certificate validation/pinning for HTTP providers
- [ ] Implement checksum or signature verification for JSON endpoints
- [ ] Add DNSSEC validation for DNS-based providers (or document limitation)
- [ ] Consider fallback to bundled assets if external source fails validation
- [ ] Add configuration option to disable external updates for air-gapped environments

**Affected Files:**
- `src/providers/stripe-api.js`
- `src/providers/stripe-webhooks.js`
- `src/providers/googlebot.js` (reloadFromWeb)
- `src/spf-analyser.js`
- `scripts/update-assets.sh`

### BUG-1: Array Clearing Bug in spf-analyser.js
**Priority:** Critical  
**Impact:** Correctness

Lines 130-137 incorrectly clear ranges instead of addresses, causing IPv4 addresses to persist when they should be cleared.

- [ ] Fix line 131: Change `provider.ipv4.ranges.pop()` to `provider.ipv4.addresses.pop()`
- [ ] Fix line 135: Change `provider.ipv6.ranges.pop()` to `provider.ipv6.addresses.pop()`
- [ ] Add unit test to verify arrays are cleared correctly
- [ ] Review all other instances of array clearing for similar bugs

**Affected Files:**
- `src/spf-analyser.js` (lines 130-137)

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

Build scripts lack proper error handling and validation.

- [ ] Fix `build.sh` line 13: Change `[ $? -ne -0 ]` to `[ $? -ne 0 ]`
- [ ] Add error handling to `update-assets.sh` for each download
- [ ] Validate downloaded file formats before saving
- [ ] Add checksums for downloaded assets
- [ ] Exit with proper error codes on failure

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

Unbounded cache growth and inefficient array operations.

- [ ] Implement LRU eviction for `parsedAddresses` cache
- [ ] Replace `while().pop()` with `array.length = 0` throughout
- [ ] Add memory usage monitoring/reporting
- [ ] Consider WeakMap for cached data where appropriate
- [ ] Add maximum cache size configuration

**Affected Files:**
- `src/index.js`
- `src/providers/googlebot.js`
- `src/providers/bunnynet.js`
- `src/providers/stripe-api.js`
- `src/spf-analyser.js`

### QUALITY-1: Code Consistency & Standards
**Priority:** High  
**Impact:** Maintainability

Inconsistent coding patterns make maintenance difficult.

- [ ] Standardize on `async/await` instead of mixed Promise patterns
- [ ] Create utility function for array clearing
- [ ] Create constants for magic strings ('ipv4', 'ipv6', etc.)
- [ ] Remove all commented-out code
- [ ] Remove debug console.log statements
- [ ] Add ESLint configuration
- [ ] Run Prettier for consistent formatting
- [ ] Document why providers are commented out in index.js

**Affected Files:**
- All `.js` files

### QUALITY-2: JSDoc Documentation
**Priority:** Medium  
**Impact:** Developer Experience

Missing function documentation makes API unclear.

- [ ] Add JSDoc comments to all public functions in index.js
- [ ] Document function parameters and return types
- [ ] Add examples in JSDoc
- [ ] Document provider object schema with @typedef
- [ ] Generate API documentation with JSDoc tool
- [ ] Add inline comments for complex algorithms

**Affected Files:**
- `src/index.js`
- `src/spf-analyser.js`

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

Dependencies may have security vulnerabilities or be outdated.

- [ ] Run `npm audit` and review findings
- [ ] Update `superagent` to latest version
- [ ] Update `ipaddr.js` to latest version
- [ ] Update `fast-xml-parser` to latest version
- [ ] Set up automated dependency updates (Dependabot/Renovate)
- [ ] Test with Node.js v22 (latest LTS)
- [ ] Document supported Node.js versions

**Affected Files:**
- `package.json`

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
- [ ] Fix spf-analyser.js array clearing bug (BUG-1)
- [ ] Fix build.sh condition check (SEC-4)
- [ ] Run `npm audit fix`
- [ ] Replace `while().pop()` with `array.length = 0` everywhere
- [ ] Remove commented-out code
- [ ] Add JSDoc to main functions
- [ ] Create constants for 'ipv4' and 'ipv6' strings
- [ ] Add error handling to update-assets.sh
- [ ] Update README badges
- [ ] Add CONTRIBUTING.md file

**Estimated Time:** 2-4 hours  
**Impact:** Immediate code quality improvement

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
