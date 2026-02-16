# Project Tracker - Trusted Network Providers Modernisation

**Status:** In Progress
**Current Version:** 1.9.0
**Target Version:** 2.0.0
**Current Phase:** Milestone 3b — Test Coverage
**Last Updated:** 16 February 2026
**Progress:** 37.5% (3 of 8 milestones complete)

## Current Status

**Working on:** Milestone 3b — Test Coverage
**Last commit:** [M3] Mark tasks complete
**Blockers:** None
**Next action:** Begin M3b: achieve >80% code coverage across all modules.
**Notes:** M1 complete ✓. M2 complete ✓. M3 complete ✓. Removed superagent dependency (replaced with native fetch). Audited all remaining dependencies: fast-xml-parser (required by gtmetrix) and ipaddr.js (core IP parsing) both retained. 0 vulnerabilities. All 122 tests passing. M3 complete: All Promise chains and new Promise() wrappers converted to async/await ✓ (spf-analyser.js, provider reload() methods, index.js reloadAll(), runTests(), test.js). forEach loops converted to for...of ✓. Nullish coalescing operator applied ✓. hasProvider() already used .some() (converted by Paul in Oct 2024) ✓. Error handling fixed: getTrustedProvider catch block now captures error details ✓. Clean lint cycle achieved ✓. All 122 tests passing ✓. Testing sprint verified all changes: npm test (122/122 passing), format check (clean), lint (clean). Starting M3b: current baseline 55.52% coverage, target >80%. Focus areas: secure-http-client.js (22.38%), spf-analyser.js (39.68%), and index.js edge cases. Note: Gemini 2.0 Flash and 2.5 Flash are currently avoided for this project due to reasoning issues with complex mocking; Zee-CodeLite (Claude 3.5 Sonnet) or Gemini 3 Flash Preview are the preferred models.
**Last updated:** 2026-02-16 13:20

---

## Context

This library underpins firewall management for ~300 WordPress hosting clients. It determines whether incoming traffic is from trusted sources (Googlebot, Stripe, PayPal, Cloudflare, etc.) or should be blocked.

**If we get this wrong:**

- Blocking Googlebot → clients lose SEO indexing
- Blocking PayPal/Stripe → clients can't take payments
- Trusting malicious IPs → firewall bypass, security breach

For v2.0.0, we want to ship significant lifecycle improvements, reduce dependencies, and migrate to modern code patterns, while remaining API-compatible.

**These milestones involve breaking changes**

---

## Milestone 1: Foundation

Get the tooling right before touching runtime code. Nothing here changes behaviour.

- [x] Add integration test suite (load providers → reload → check IP → get result)
- [x] Snapshot responses from external provider APIs (Stripe, Cloudflare, Google)
- [x] Tag v1.9.0 as `v1-stable` before branching
- [x] Run `npm audit fix` to resolve known vulnerabilities (fast-xml-parser, qs)
- [x] Migrate from CommonJS (`require`/`module.exports`) to ESM (`import`/`export`)
- [x] Update `package.json` with `"type": "module"`
- [x] Add `.nvmrc` pinned to Node 22 LTS
- [x] Replace hand-rolled `src/test.js` with Jest test framework
- [x] Port all existing test cases to Jest
- [~] ~~Achieve >80% code coverage~~ — deferred to post-M3 (see notes below)
- [x] Update ESLint config for ESM
- [x] Ensure clean lint cycle (0 errors, 0 warnings)
- [x] Add GitHub Actions CI workflow (test on Node 18, 20, 22)
- [ ] Commit milestone completion to `v2-modernisation` branch

> **Coverage note:** 80% target deferred. Current coverage is 55.52% (122 tests). The lowest-covered modules — `secure-http-client.js` (22.38%) and `spf-analyser.js` (39.68%) — are being rewritten in M2 and M3 respectively. Writing mock-heavy tests for code that's about to change is wasted effort. Coverage will be revisited after M3 when the codebase has stabilised and the new code is inherently more testable.

---

## Milestone 2: Reduce Dependencies

Strip out unnecessary packages. Use what Node gives us for free.

- [x] Replace `superagent` with native `fetch` in secure-http-client.js
- [x] Update all providers that use secure-http-client
- [x] Audit `fast-xml-parser` usage — keep (required by gtmetrix)
- [x] Remove any other unused dependencies — none found (only fast-xml-parser and ipaddr.js, both required)
- [x] Run `npm audit` — 0 vulnerabilities ✓
- [x] Verify all tests pass after dependency changes — 122/122 passing ✓
- [x] Update dev-notes with dependency decisions
- [x] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 3: Modernise Code Patterns

Bring the JavaScript up to 2026 standards.

- [x] Convert all Promise chains and `new Promise()` wrappers to async/await
- [x] Refactor `spf-analyser.js` — replace nested promise callbacks with async/await
- [x] Refactor `reloadAll()` — use `Promise.allSettled()` instead of `Promise.all()`
- [x] Refactor `index.js` — replace `forEach` with `for...of` where appropriate
- [x] Replace `hasProvider()` bitwise OR pattern with `.some()` or `.find()`
- [x] Use optional chaining and nullish coalescing where appropriate
- [x] Ensure consistent error handling (no swallowed errors)
- [x] Clean lint cycle after all changes
- [x] All tests pass
- [x] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 3b: Test Coverage

Now that the code is modernised, write durable tests against the stable codebase.

- [ ] Achieve >80% code coverage across all modules
- [ ] Add tests for refactored secure-http-client.js (native fetch)
- [ ] Add tests for refactored spf-analyser.js (async/await)
- [ ] Add tests for index.js uncovered edge cases
- [ ] All tests pass
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 4a: Lifecycle & State Management — Observability

Make providers observable for long-running pm2 apps.

- [ ] Add provider state tracking (ready / loading / error / stale)
- [ ] Add `lastUpdated` timestamp per provider
- [ ] Add `lastError` field per provider
- [ ] Add EventEmitter for provider lifecycle events (reload, error, stale)
- [ ] Add configurable staleness threshold (e.g., mark stale after 24h without update)
- [ ] Add `getProviderStatus(name)` API
- [ ] Add configurable logging abstraction (replace bare console.log/error)
- [ ] All tests pass, including new lifecycle tests
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 4b: Lifecycle & State Management — Robustness

Make providers resilient to failures and misuse.

- [ ] Fix SPF analyser error handling — add `.catch()` on DNS resolution
- [ ] Fix race condition in provider data clearing (atomic swap)
- [ ] Add input validation: max IPs per provider, max providers, CIDR validation
- [ ] All tests pass
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 5: Performance

Lower priority, but worth doing while we're in here.

- [ ] Implement LRU cache with max size for parsed CIDR ranges (replace unbounded `parsedAddresses`)
- [ ] Add LRU result cache with configurable TTL for IP lookups
- [ ] Invalidate caches on provider reload
- [ ] Profile lookup performance before/after with 20+ providers
- [ ] Document performance characteristics
- [ ] All tests pass
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 6: Documentation & Release

Polish and ship.

- [ ] Update README for v2.0.0 (ESM imports, new APIs, lifecycle events)
- [ ] Write migration guide (v1.x → v2.x)
- [ ] Update docs/security.md
- [ ] Update docs/implementation.md
- [ ] Add inline code comments for complex logic
- [ ] Update CHANGELOG.md
- [ ] Final clean lint cycle + full test suite
- [ ] Tag and publish v2.0.0
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Future: Phase 2 (TypeScript)

Not in scope for v2.0.0. Revisit after release.

- TypeScript migration of core modules
- Ship .d.ts type definitions with package
- Add type checking to CI

---

## Branching Strategy

All development happens on a single branch: `v2-modernisation`

- Branch from `main` at the start
- Commit regularly with clear messages referencing milestones (e.g., `[M1] Migrate to ESM`)
- **Do not merge back to main** — Paul will review the full changeset before merging
- Keep the branch rebased on main if main receives hotfixes
- The public API must remain non-breaking: same function names, same parameters, same return values

## Principles

1. **Safety first.** Every change gets tested. We never ship with failing tests.
2. **One milestone at a time.** Complete and verify before moving on.
3. **No merging without review.** All work stays on `v2-modernisation` until Paul approves.
4. **No YOLO.** This library protects real businesses.
5. **Reduce, don't add.** Fewer dependencies = fewer attack surfaces.
6. **Non-breaking API.** Consumers should be able to upgrade without code changes.
7. **Document breaking changes immediately.** If a change could break dependents, log it in CHANGELOG.md under the v2.0.0 section. We'll decide on shims before the final merge.

---

## Risk Register

| Risk                                        | Impact | Mitigation                                       |
| ------------------------------------------- | ------ | ------------------------------------------------ |
| ESM migration breaks downstream consumers   | High   | Test with actual hosting stack before publishing |
| Removing superagent changes HTTP behaviour  | Medium | Match timeout/retry/TLS behaviour exactly        |
| async/await refactor introduces subtle bugs | Medium | Comprehensive test coverage before and after     |
| Cache invalidation bugs cause stale IP data | High   | Conservative TTLs, clear-on-reload               |
| SPF/DNS changes break Google Workspace      | High   | Keep bundled asset fallback                      |

---

## Log

| Date       | Milestone | Notes                                                                                                                                                                                                                                                      |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-14 | —         | Project tracker created. Codebase review complete.                                                                                                                                                                                                         |
| 2026-02-16 | M1        | M1 closed. 80% coverage deferred to post-M3 — low-coverage modules are being rewritten in M2/M3. Added M3b (Test Coverage) milestone. Prioritising dependency reduction and code modernisation.                                                            |
| 2026-02-16 | M2        | M2 closed. Removed superagent (replaced with native fetch). Audited all dependencies: fast-xml-parser and ipaddr.js both required and retained. 0 vulnerabilities. All 122 tests passing. See dev-notes/02-milestone-2-dependency-audit.md for full audit. |
