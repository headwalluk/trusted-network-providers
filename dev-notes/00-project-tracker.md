# Project Tracker - Trusted Network Providers Modernisation

**Status:** Planning  
**Current Version:** 1.9.0  
**Target Version:** 2.0.0  
**Current Phase:** Pre-development  
**Last Updated:** 14 February 2026  
**Progress:** 0% (0 of 7 milestones complete)

## Current Status

**Working on:** Milestone 1 — Foundation tasks  
**Last commit:** [M1] Mark test porting complete  
**Blockers:** None  
**Next action:** Improve test coverage from 50.72% to >80%. Focus on: provider files (ahrefsbot, brevo, cloudflare, etc.), spf-analyser.js (39.68%), secure-http-client.js (22.38%), checksum-verifier.js (48.71%)  
**Notes:** ESM migration complete ✓. GitHub Actions CI workflow added ✓. Test porting complete ✓. All tests passing (35 tests). Current coverage: 50.72% (need >80%). Main coverage gaps: 17 provider files at 0%, plus spf-analyser, secure-http-client, and checksum-verifier.  
**Last updated:** 2026-02-16 08:42

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
- [ ] Achieve >80% code coverage
- [x] Update ESLint config for ESM
- [x] Ensure clean lint cycle (0 errors, 0 warnings)
- [x] Add GitHub Actions CI workflow (test on Node 18, 20, 22)
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 2: Reduce Dependencies

Strip out unnecessary packages. Use what Node gives us for free.

- [ ] Replace `superagent` with native `fetch` in secure-http-client.js
- [ ] Update all providers that use secure-http-client
- [ ] Audit `fast-xml-parser` usage — remove if unused
- [ ] Remove any other unused dependencies
- [ ] Run `npm audit` — target 0 vulnerabilities
- [ ] Verify all tests pass after dependency changes
- [ ] Update dev-notes with dependency decisions
- [ ] Commit milestone completion to `v2-modernisation` branch

---

## Milestone 3: Modernise Code Patterns

Bring the JavaScript up to 2026 standards.

- [ ] Convert all Promise chains and `new Promise()` wrappers to async/await
- [ ] Refactor `spf-analyser.js` — replace nested promise callbacks with async/await
- [ ] Refactor `reloadAll()` — use `Promise.allSettled()` instead of `Promise.all()`
- [ ] Refactor `index.js` — replace `forEach` with `for...of` where appropriate
- [ ] Replace `hasProvider()` bitwise OR pattern with `.some()` or `.find()`
- [ ] Use optional chaining and nullish coalescing where appropriate
- [ ] Ensure consistent error handling (no swallowed errors)
- [ ] Clean lint cycle after all changes
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

| Date       | Milestone | Notes                                              |
| ---------- | --------- | -------------------------------------------------- |
| 2026-02-14 | —         | Project tracker created. Codebase review complete. |
