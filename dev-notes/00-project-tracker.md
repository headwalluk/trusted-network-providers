# Project Tracker - Trusted Network Providers

**Current Version:** 2.1.0 (unpublished; 2.0.0 is live on npm)
**Status:** M7 — additional trusted crawlers
**Last Updated:** 30 May 2026

---

## Overview

`@headwall/trusted-network-providers` is a Node.js (ESM) library for identifying
IP addresses belonging to trusted network providers (Googlebot, Stripe,
Cloudflare, PayPal, etc.). Used for firewall whitelisting, rate-limit bypassing,
and traffic classification. Published on npm.

v2.0.0 is a major modernisation of the v1 line: CJS→ESM, `superagent`→native
`fetch`, async/await throughout, lifecycle events, state tracking, and a
two-tier caching layer. **v2.0.0 is published on npm** (it also added the Google
Special Crawlers / AdsBot provider). M7 grows the trusted-crawler coverage for a
2.1.0 release.

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
| M6  | Documentation, polish & release (2.0.0 shipped)           | ✅ Complete    |
| M7  | Additional trusted crawlers (2.1.0)                       | 🚧 In progress |

Detailed write-ups for completed milestones live alongside this file
(`05-milestone-5-performance.md`) and in `dev-notes/archive/`.

---

### Milestone 6: Documentation, Polish & Release ✅

**Status:** Complete — 2.0.0 published to npm 30 May 2026
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
- [x] Refresh all bundled assets via `./scripts/update-assets.sh` and commit (googlebot, bunnynet v4/v6, facebookbot v4/v6)
- [x] Verify `src/assets/checksums.json` matches every bundled asset after refresh
- [x] Run provider self-tests (`runTests()` / `test/ip-lookup-report.test.js`) — all providers resolve their test addresses (36/36, 20 providers)

#### Phase 2: Commit / clean the working tree

The branch carried a large uncommitted changeset, now committed in logical
groups (commits `60af8b6`…`4f39a2e`):

- [x] Doc removals — `docs/{implementation,issues,requirements}.md` moved to `dev-notes/archive/` (tracked as renames)
- [x] Doc edits — `README.md`, `docs/security.md`, `docs/migration-v1-to-v2.md`, `CONTRIBUTING.md`
- [x] Asset refreshes — bunnynet, facebookbot, googlebot (Phase 1)
- [x] Provider edits — `facebookbot.js` (CRLF + error handling), `seobility.js` (whitespace)
- [x] Test additions — `test/ip-lookup-report.test.js`, `test/performance.test.js`
- [x] Tooling/meta — `package-lock.json`, `package.json` (version kept at **2.0.0**)
- [x] `CLAUDE.md` committed (checked-in project guidance)
- [x] `git status` clean

#### Phase 3: Documentation consistency

- [x] Fix stale links to deleted docs — `CONTRIBUTING.md` `docs/issues.md` references replaced with GitHub issue tracker
- [x] Audit all internal doc links resolve (`README.md`, `CONTRIBUTING.md`, `docs/*`) — all OK
- [x] `docs/providers.md` provider table matches the `defaultProviders` registry (incl. Google Special Crawlers)
- [x] README: ESM import examples, lifecycle API current (provider detail lives in `docs/providers.md`)
- [x] CHANGELOG: 2.0.0 entry complete, M6 changes folded in, no premature 2.1.0 section

#### Phase 4: Quality gates

- [x] `npm run format:check` clean
- [x] `npm run lint` clean (0 warnings)
- [x] `npm test` green (306 passing, 17 suites)
- [ ] Confirm CI workflow (`.github/workflows/ci.yml`) passes on Node 18/20/22 — verify after push
- [x] `npm audit` — 0 vulnerabilities (fast-xml-parser advisory fixed via lockfile; dev-only picomatch advisories not shipped)

#### Phase 5: Package hygiene

- [x] `files[]` allowlist ships the right paths — `npm pack --dry-run` = 44 files, 39.2 kB
- [x] `npm pack --dry-run` — no dev-notes/tests/coverage/.github leaked; `google-special-crawlers.json` included
- [x] `bin/lookup.js` executable (shebang present), resolves Googlebot + Google Special Crawlers IPs
- [x] LICENSE present and correct (MIT)
- [x] `"engines": { "node": ">=18" }` and `"type": "module"` correct

#### Phase 6: Release — **handoff (requires Paul / npm auth)**

- [x] Final `npm test` + `npm run lint` + `npm run format:check` on a clean tree
- [x] `package.json` version is `2.0.0`
- [x] Tracker/CHANGELOG updates committed
- [x] Push `main` to remote
- [x] Move git tag `v2.0.0` to the release commit
- [x] `npm publish --access public` (first scoped publish)
- [x] Verify the npm package page renders (README, version, links)
- [x] Smoke test: `npm install` + lookup (validated end-to-end via Spam Shield API)

**Notes:**

- Publish hit one snag: npm rejected the `./bin/lookup.js` bin path (leading `./`). Fixed to `bin/lookup.js`; 2.0.0 published cleanly on the retry.
- The `trusted-lookup` CLI works via `npx -p @headwall/trusted-network-providers trusted-lookup <ip>`.

---

### Milestone 7: Additional Trusted Crawlers 🚧

**Status:** In progress
**Priority:** Medium
**Started:** 30 May 2026
**Target:** 2.1.0 on npm

**Goal:** Broaden default coverage of legitimate, officially-published crawler IP
ranges so they aren't mistakenly firewalled/RBL'd. Bar for inclusion: an
**official, machine-readable** IP source (no guessed ranges).

#### Bingbot ✅ (this release, 2.1.0)

- [x] Add `bingbot` provider — `src/assets/bingbot-ips.json` from `bing.com/toolbox/bingbot.json` (Google-style JSON, checksum-verified)
- [x] Wire into `defaultProviders`, `update-assets.sh`, `checksums.json`
- [x] Test addresses, `docs/providers.md`, README provider list
- [x] Bump to 2.1.0, CHANGELOG entry

#### Next crawlers (candidate for 2.2.0 — verified official sources)

All confirmed to publish the same `{creationTime, prefixes[]}` JSON format as
Google, so each is a near-clone of `googlebot.js` (bundled asset + checksum):

- [ ] **Applebot** — `https://search.developer.apple.com/applebot.json` (~12 prefixes). Apple's crawler (Siri/Spotlight/Safari suggestions).
- [ ] **GPTBot** (OpenAI) — `https://openai.com/gptbot.json` (~21 prefixes). AI training crawler; fast-growing legit bot traffic.
- [ ] **OAI-SearchBot** (OpenAI) — OpenAI's search crawler, separate published file.
- [ ] _(considered, deferred)_ `ChatGPT-User` — user-triggered fetcher; skip by the same reasoning as Google's user-triggered fetchers.
- [ ] _(stretch)_ Anthropic **ClaudeBot**, **PerplexityBot** — also publish ranges; natural "AI crawler" group if we want fuller coverage.

**Per-provider checklist (repeat for each):** create `src/providers/<name>.js`
(clone of `bingbot.js`), download asset, add to `defaultProviders` +
`update-assets.sh` + `checksums.json`, add test addresses + provider test, update
`docs/providers.md` and README, run lint/format/test, bump version + CHANGELOG.

---

## Future: Phase 2 (post-2.0.0)

Not in scope for v2.0.0. Revisit after release.

- **Dependency refresh (first post-release task)** — deferred from M6 to keep the
  release tree audit-clean and tested. None are security fixes (`npm audit` = 0).
  As of 30 May 2026:
  - `ipaddr.js` 2.2.0 → 2.4.0 (ships; in-range minor — retest IP parsing carefully)
  - `eslint` 9.39.1 → 10.4.1 (dev; **major**, needs flat-config review)
  - `jest` 30.2.0 → 30.4.2 (dev; in-range patch)
  - `prettier` 3.6.2 → 3.8.3 (dev; in-range minor — may reformat files)
- **README refactor — lean entry point + `docs/` index.** Slim `README.md` down to:
  badges at the top, a short description of what the package is and who it's for,
  then a set of links into focused `docs/` files. Move the detailed Configuration,
  API Reference, Examples, Provider Management, and Performance sections out of the
  README and into (or merged with) dedicated `docs/` pages, leaving the README as a
  concise overview that points at them. (Not urgent — docs are accurate today.)
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
