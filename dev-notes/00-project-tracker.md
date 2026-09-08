# Project Tracker - Trusted Network Providers

**Current Version:** 2.4.0 (**awaiting publish — requires Paul / npm auth**; 2.3.0 live on npm)
**Status:** M9 complete — provider categories + `ai-crawler` (2.4.0)
**Last Updated:** 8 September 2026

> ⚠ **2.4.0 is a release blocker for spamshield3.** ss3 consumes
> `loadDefaultProviders({ excludeCategories })` to implement its
> `EXCLUDE_AI_CRAWLERS_FROM_TRUSTED` switch, and its `package.json` asks for
> `^2.4.0`. Publishing this version is a handoff step before ss3 can be
> installed from a clean checkout.
>
> An earlier line here said 2.3.0 was "tagged, awaiting publish". That was
> stale — `npm view` lists 2.3.0 as published, and both spamshield2 and
> spamshield3 resolve it from the registry.

---

## Overview

`@headwall/trusted-network-providers` is a Node.js (ESM) library for identifying
IP addresses belonging to trusted network providers (Googlebot, Stripe,
Cloudflare, PayPal, etc.). Used for firewall whitelisting, rate-limit bypassing,
and traffic classification. Published on npm.

v2.0.0 is a major modernisation of the v1 line: CJS→ESM, `superagent`→native
`fetch`, async/await throughout, lifecycle events, state tracking, and a
two-tier caching layer. **v2.0.0 is published on npm** (it also added the Google
Special Crawlers / AdsBot provider). M7 grew the trusted-crawler coverage across
2.1.0 (Bingbot) and 2.3.0 (Applebot + OpenAI's crawlers).

---

## Milestones

| #   | Milestone                                                      | Status      |
| --- | -------------------------------------------------------------- | ----------- |
| M1  | Foundation (ESM, Jest, CI)                                     | ✅ Complete |
| M2  | Reduce dependencies (remove superagent)                        | ✅ Complete |
| M3  | Modernise code patterns (async/await, Promise.allSettled)      | ✅ Complete |
| M3b | Test coverage (>80%)                                           | ✅ Complete |
| M4a | Lifecycle & observability (events, state tracking)             | ✅ Complete |
| M4b | Robustness (input validation, error handling)                  | ✅ Complete |
| M5  | Performance (LRU cache, TTL result cache)                      | ✅ Complete |
| M6  | Documentation, polish & release (2.0.0 shipped)                | ✅ Complete |
| M7  | Additional trusted crawlers (Bingbot 2.1.0; AI crawlers 2.3.0) | ✅ Complete |
| M8  | Google user-triggered fetchers (2.2.0)                         | ✅ Complete |
| M9  | Provider categories + `ai-crawler` (2.4.0)                     | ✅ Complete |

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
- [ ] Confirm CI workflow (`.github/workflows/ci.yml`) passes on Node 22/24/26 — verify after push
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

### Milestone 7: Additional Trusted Crawlers ✅

**Status:** Complete
**Priority:** Medium
**Started:** 30 May 2026
**Completed:** 29 Aug 2026
**Target:** Bingbot in 2.1.0; AI crawlers + Applebot in 2.3.0

**Goal:** Broaden default coverage of legitimate, officially-published crawler IP
ranges so they aren't mistakenly firewalled/RBL'd. Bar for inclusion: an
**official, machine-readable** IP source (no guessed ranges).

#### Bingbot ✅ (this release, 2.1.0)

- [x] Add `bingbot` provider — `src/assets/bingbot-ips.json` from `bing.com/toolbox/bingbot.json` (Google-style JSON, checksum-verified)
- [x] Wire into `defaultProviders`, `update-assets.sh`, `checksums.json`
- [x] Test addresses, `docs/providers.md`, README provider list
- [x] Bump to 2.1.0, CHANGELOG entry

#### AI crawlers + Applebot ✅ (2.3.0)

> **Re-scoped 19 Jun 2026:** kicked from 2.2.0 to 2.3.0. 2.2.0 shipped the
> Google User-Triggered Fetchers provider instead (M8), which took priority due
> to active customer impact (Gmail newsletter images blocked).
> **Delivered 29 Aug 2026.**

All publish the same `{creationTime, prefixes[]}` JSON format as Google, so each
is a near-clone of `bingbot.js` (bundled asset + checksum):

- [x] **Applebot** — `https://search.developer.apple.com/applebot.json` (33 prefixes, not ~12 as first estimated). Apple's crawler (Siri/Spotlight/Safari suggestions).
- [x] **GPTBot** (OpenAI) — `https://openai.com/gptbot.json` (21 prefixes). AI training crawler.
- [x] **OAI-SearchBot** (OpenAI) — `https://openai.com/searchbot.json` (35 prefixes). ⚠️ The feed is at `searchbot.json`; the intuitive `oai-searchbot.json` path 404s.
- [x] **ChatGPT-User** — `https://openai.com/chatgpt-user.json` (204 prefixes). **Included, reversing the earlier deferral**: M8 had already overturned the blanket "skip user-triggered fetchers" rule for Google on evidence of real breakage, and this is by some way the most actively maintained of the four feeds.

**Findings worth keeping:**

- All four feeds are **IPv4-only** — no `ipv6Prefix` entries at all, so these
  providers ship an empty `ipv6.ranges`. Documented in `docs/providers.md` so it
  isn't later mistaken for a loading bug.
- **GPTBot and OAI-SearchBot share 6 egress prefixes.** Harmless (both trusted,
  first-registered wins the linear scan) but it means provider names can't be
  used to tell OpenAI's crawlers apart. Pinned by a test in
  `test/ai-crawlers.test.js`.

**Dropped from scope:**

- ~~Anthropic **ClaudeBot**~~ — no machine-readable IP source could be found
  (all plausible URLs 404 as of 29 Aug 2026). Fails the inclusion bar; revisit
  only if Anthropic publishes a feed.
- **PerplexityBot** — `https://www.perplexity.ai/perplexitybot.json` exists and
  is valid (8 prefixes), but the feed has not been updated since Feb 2025. Left
  out as low value for now; cheap to add if it starts moving.

**Per-provider checklist (repeat for each):** create `src/providers/<name>.js`
(clone of `bingbot.js`), download asset, add to `defaultProviders` +
`update-assets.sh` + `checksums.json`, add test addresses + provider test, update
`docs/providers.md` and README, run lint/format/test, bump version + CHANGELOG.

### Milestone 9: Provider Categories ✅ (2.4.0)

**Delivered 8 September 2026.** Providers may carry a `category`; the registry
can filter and remove by it. One category defined: `ai-crawler` — Applebot,
GPTBot, OAI-SearchBot, ChatGPT-User.

**Why it exists.** spamshield2 2.28.0 added an `EXCLUDE_AI_CRAWLERS_FROM_TRUSTED`
switch implemented as four `deleteProvider()` calls against a **hardcoded list of
names in its own `config.js`**. It works, and its own comment concedes the
weakness: a stale name in that list is a harmless no-op — but a _missing_ one is
not. Add a fifth AI crawler to this package and every consumer holding four
names keeps trusting it, silently, with nothing anywhere to notice. That is a
defect this package is better placed to prevent than its consumers are, because
this package is the thing that adds the fifth crawler.

**Shape:**

- `src/categories.js` — the constants, in their own module so providers can
  import them without a circular dependency through `src/index.js`.
- `category` on the four AI-crawler providers; optional everywhere else and
  validated in `validateProvider()` if present (non-empty string, else throw —
  a non-string category would silently never match a filter).
- `loadDefaultProviders({ excludeCategories })` — the preferred path, since it
  never registers them, so no lookup can resolve against one in between.
  `deleteProvidersByCategory()` covers removal after the fact and **returns the
  names removed**, so the consumer can log the change rather than have which
  networks are trusted change in silence.
- 18 tests in `test/provider-categories.test.js`.

**Deliberately not done: a full taxonomy.** Only the AI crawlers are
categorised; the other 22 providers have no `category`. Grouping the rest
(search / CDN / payments / email) is easy to add and nothing needs it yet —
inventing categories with no consumer would be guessing at what a filter should
mean. The field is optional precisely so it can be filled in as uses appear.

**Handoff:** publish 2.4.0 to npm (requires Paul's auth), then spamshield3's
`^2.4.0` resolves from the registry.

---

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
