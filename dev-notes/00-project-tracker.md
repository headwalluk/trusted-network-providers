# Project Tracker - Trusted Network Providers

**Current Version:** 2.0.0
**Status:** M6 — final polish before npm publish
**Last Updated:** 30 May 2026

---

## Overview

`@headwall/trusted-network-providers` is a Node.js (ESM) library for identifying
IP addresses belonging to trusted network providers (Googlebot, Stripe,
Cloudflare, PayPal, etc.). Used for firewall whitelisting, rate-limit bypassing,
and traffic classification. Published on npm.

v2.0.0 is a major modernisation of the v1 line: CJS→ESM, `superagent`→native
`fetch`, async/await throughout, lifecycle events, state tracking, and a
two-tier caching layer. **v2.0.0 has not yet been published to npm** (latest
published is 1.9.0). M6 is the final milestone to get it shipped.

---

## Milestones

| #   | Milestone                                                 | Status         |
| --- | --------------------------------------------------------- | -------------- |
| M1  | Foundation (ESM, Jest, CI)                                | ✅ Complete    |
| M2  | Reduce dependencies (remove superagent)                   | ✅ Complete    |
| M3  | Modernise code patterns (async/await, Promise.allSettled) | ✅ Complete    |
| M3b | Test coverage (>80%)                                      | ✅ Complete    |
| M4a | Lifecycle & observability (events, state tracking)        | ✅ Complete    |
| M4b | Robustness (input validation, error handling)             | ✅ Complete    |
| M5  | Performance (LRU cache, TTL result cache)                 | ✅ Complete    |
| M6  | Documentation, polish & release                           | 🚧 In progress |

Detailed write-ups for completed milestones live alongside this file
(`05-milestone-5-performance.md`) and in `dev-notes/archive/`.

---

### Milestone 6: Documentation, Polish & Release 🚧

**Status:** In progress
**Priority:** High
**Started:** 3 April 2026
**Target:** 2.0.0 on npm

**Goal:** Take the code-complete v2 branch to a clean, published 2.0.0 — working
tree committed, docs consistent, lint/format/tests green, and the package
verified on npm.

**Definition of done:** A consumer can `npm install @headwall/trusted-network-providers`,
get the documented v2 ESM API, and the npm page renders correctly. No stale docs,
no broken internal links, no uncommitted release-relevant work.

#### Phase 1: Provider data currency

- [x] Add Google Special Crawlers provider (AdsBot, AdSense/Mediapartners, APIs-Google, Google-Safety) — fixes AdsBot mis-reporting (commit `1461a9e`)
- [x] `update-assets.sh` fetches `special-crawlers.json` and records its checksum
- [x] Confirm Google IP source host (`developers.google.com`, **not** gstatic — gstatic only serves `goog.json`)
- [ ] Refresh all bundled assets via `./scripts/update-assets.sh` and commit (googlebot, bunnynet v4/v6, facebookbot v4/v6 currently modified in tree)
- [ ] Verify `src/assets/checksums.json` matches every bundled asset after refresh
- [ ] Run provider self-tests (`runTests()` / `test/ip-lookup-report.test.js`) — all providers resolve their test addresses

#### Phase 2: Commit / clean the working tree

The branch carries a large uncommitted changeset that must be reviewed and
committed (or reverted) before tagging. Group into logical commits:

- [ ] Doc removals — `docs/implementation.md`, `docs/issues.md`, `docs/requirements.md` deleted (confirm intentional; they moved to `dev-notes/archive/`)
- [ ] Doc edits — `README.md`, `docs/security.md`, `docs/migration-v1-to-v2.md`, `CONTRIBUTING.md`
- [ ] Asset refreshes — bunnynet, facebookbot, googlebot (Phase 1)
- [ ] Provider edits — `facebookbot.js`, `seobility.js`
- [ ] Test additions — `test/ip-lookup-report.test.js` (untracked), `test/performance.test.js`
- [ ] Tooling/meta — `package-lock.json`, `package.json` (stray blank-line removal in `scripts` — keep version at **2.0.0**)
- [ ] `CLAUDE.md` (untracked) — decide whether to commit (it is checked-in project guidance)
- [ ] Confirm `git status` is clean except deliberate ignores before tagging

#### Phase 3: Documentation consistency

- [ ] Fix stale links to deleted docs — `CONTRIBUTING.md` references `docs/issues.md` in 3 places (lines ~140, ~167, ~371)
- [ ] Audit all internal doc links resolve (`README.md`, `CONTRIBUTING.md`, `docs/*`)
- [ ] Ensure `docs/providers.md` provider table matches the actual `defaultProviders` registry in `src/index.js` (incl. new Google Special Crawlers)
- [ ] README: confirm ESM import examples, lifecycle API, and provider list are current
- [ ] CHANGELOG: confirm the 2.0.0 entry is complete and all M6 changes are folded in (no premature 2.1.0 section)

#### Phase 4: Quality gates

- [ ] `npm run format:check` clean — **currently failing on `docs/providers.md`** (run `npm run format`)
- [ ] `npm run lint` clean (0 warnings)
- [ ] `npm test` green (was 306 passing; re-run after asset refresh)
- [ ] Confirm CI workflow (`.github/workflows/ci.yml`) passes on Node 18/20/22
- [ ] `npm audit` — 0 vulnerabilities

#### Phase 5: Package hygiene

- [ ] Verify `package.json` `files[]` allowlist ships the right paths (`bin/`, `src/`, `README.md`, `LICENSE`, `CHANGELOG.md`) — note `src/` includes `src/assets/*` data
- [ ] `npm pack --dry-run` — inspect the tarball contents (no dev-notes, no tests, no coverage)
- [ ] Confirm `bin/lookup.js` is executable and the `trusted-lookup` bin works post-install
- [ ] Confirm LICENSE present and correct (MIT) ✅
- [ ] Verify `"engines": { "node": ">=18" }` and `"type": "module"` are correct

#### Phase 6: Release

- [ ] Final `npm test` + `npm run lint` + `npm run format:check` on a clean tree
- [ ] Confirm `package.json` version is `2.0.0`
- [ ] Commit any final tracker/CHANGELOG updates
- [ ] Push `main` to remote
- [ ] Confirm git tag `v2.0.0` points at the release commit (a local `v2.0.0` tag already exists — re-tag/force if it predates M6 work)
- [ ] `npm publish` (scoped public package — `--access public` if first scoped publish)
- [ ] Verify the npm package page renders (README, version, links)
- [ ] Smoke test: `npm install @headwall/trusted-network-providers` in a scratch dir and run a lookup

**Notes:**

- The local `v2.0.0` git tag and the merged v2 PR predate the M6 polish; the tag will need to move to the actual release commit before publishing.
- npm publish is a one-way door — do the `npm pack --dry-run` inspection first.

---

## Future: Phase 2 (post-2.0.0)

Not in scope for v2.0.0. Revisit after release.

- TypeScript migration of core modules
- Ship `.d.ts` type definitions with the package
- Add type checking to CI
- Cache hit-rate metrics / observability hook (noted in `05-milestone-5-performance.md`)

---

## Architecture Notes

- **ES modules throughout** (`"type": "module"`). `import`/`export`, not `require`.
- **Core** (`src/index.js`): singleton with EventEmitter lifecycle, provider
  registry, two-tier caching (LRU for parsed CIDRs, TTL+LRU for lookup results),
  provider state machine (ready/loading/error/stale). Lookups are synchronous
  after load: linear scan, exact-match first then CIDR via `ipaddr.js`.
- **Providers** (`src/providers/`): each exports `{ name, testAddresses, reload?, ipv4, ipv6 }`.
  Four types — Static, Bundled asset (checksum-verified), HTTP API, DNS/SPF.
- **Utilities**: `secure-http-client.js` (HTTPS-only fetch w/ retries+checksums),
  `checksum-verifier.js` (SHA-256 vs `checksums.json`), `spf-analyser.js`,
  `lru-cache.js` / `ttl-cache.js`.

---

## Archived

Previous detailed milestone tracker and the original `docs/` (implementation,
issues, requirements, long-form security) moved to `dev-notes/archive/`.
