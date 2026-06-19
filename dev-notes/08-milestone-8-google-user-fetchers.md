# Milestone 8: Google User-Triggered Fetchers

**Date:** 19 June 2026
**Milestone:** M8 — Google User-Triggered Fetchers provider
**Status:** ✅ Code complete — awaiting commit/tag + post-release validation
**Priority:** High (active customer impact — see Background)
**Target:** 2.2.0 on npm

---

## Background — why this exists

A client newsletter sent to a Gmail recipient rendered with broken images; the
images are hosted under `wp-content/uploads/` on the client's site. Investigation
traced the cause to our own RBL blocking Google's `google-proxy-*.google.com`
infrastructure (the `66.249.80.0/20` block).

The chain (full write-up in the Spam Shield consumer memory):

1. Chrome's **Privacy Preserving Prefetch Proxy** (UA `Chrome Privacy Preserving
Prefetch Proxy`, source IPs in `66.249.80.0/20`) probes `/.well-known/traffic-advice`
   on client sites.
2. On at least one site, Apache **403s** that path (`AH01630: client denied by
server configuration` — a dot-path / `.well-known` deny rule).
3. Per-server fail2ban/bash scanners read the 403 as a vulnerability probe and
   POST the source IP to Spam Shield → it lands in the ~400k-IP RBL. Confirmed in
   `ip_log` on `hhw6`: the entire `66.249.80.0/20` block was flagged
   `is_vuln_probe` (0 spam / 0 abuse / 0 crawler), across dozens of `caller`
   sites, e.g. `evolutiontreesurgeryltd.co.uk` (622 hits, still firing daily).
4. The **Gmail image proxy** (`GoogleImageProxy`) lives in the _same_ netblock.
   Once the range is RBL'd, the image proxy's image GETs are dropped at the
   `ipset`/firewall layer on non-Cloudflare sites — before Apache — which is why
   the image-proxy UA never appeared in the access logs and the newsletter images
   never loaded.

The fail2ban/`.well-known` root cause is being fixed separately on the origin
servers (Paul, out of scope for this repo). **This milestone is the
defence-in-depth fix that belongs here**: recognise Google's user-triggered
fetchers as trusted so Spam Shield filters them out of the RBL before `ipset`,
regardless of what relists them upstream. Catching exactly this class of
false-positive is the entire reason `trusted-network-providers` exists.

### Reverses an earlier assumption

The project tracker (M7, "Next crawlers") deferred user-triggered fetchers —
both `ChatGPT-User` and Google's — on the reasoning that user-triggered traffic
needn't be whitelisted. This investigation shows that reasoning is wrong for
Google: the Gmail image proxy and Chrome prefetch proxy are user-triggered
fetchers that **do** get RBL'd and **do** cause real breakage. Scope here is
Google only (we have concrete evidence). Whether `ChatGPT-User` / other vendors'
user fetchers deserve the same treatment is left to a later milestone.

---

## Goal

Add a bundled-asset provider, **Google User-Triggered Fetchers**, sourced from
Google's official `user-triggered-fetchers-google.json`, following the exact
pattern of `googlebot.js` / `google-special-crawlers.js` / `bingbot.js`.

**Bar for inclusion (unchanged):** official, machine-readable IP source, no
guessed ranges.

### Data source

- URL: `https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json`
- Format: standard Google `{ creationTime, prefixes[] }` JSON (same as
  common-crawlers / special-crawlers) — checksum-verifiable bundled asset.
- Verified 19 Jun 2026: **452 prefixes**, IPv4-only in the current payload
  (handle IPv6 anyway, per the existing providers, in case Google adds it).
- Contains the full `66.249.80.0/20` proxy block (as /27s) plus the classic
  Google edge ranges: `64.233.172/24`, `66.102.6-9`, `74.125.208-215`,
  `142.250.32-33`, `192.178.8-15`.
- Confirmed **no overlap** with the existing Googlebot provider (which covers only
  the `66.249.64-79` crawler half) or the Special Crawlers provider (`66.249.90`
  etc.) on the proxy /27s — this is genuinely new coverage.

### Definition of done

Spam Shield, after a reload, classifies the proxy IPs we found in the RBL
(e.g. `66.249.93.169`, `66.249.81.5`) as trusted and filters them out of the RBL
export, so they never reach `ipset`. Package lints/formats/tests clean, asset is
checksum-verified, `update-assets.sh` keeps it fresh, docs match the registry,
and 2.2.0 is tagged for Paul to publish.

---

## TODO

### Provider implementation

- [x] Download the asset to `src/assets/google-user-fetchers.json` (from the URL above)
- [x] Create `src/providers/google-user-fetchers.js` — clone of `google-special-crawlers.js`:
  - `name: 'Google User-Triggered Fetchers'`
  - `reload()` — verify checksum (`'google-user-fetchers'`), load bundled asset, push `ipv4Prefix`/`ipv6Prefix` ranges
  - `reloadFromWeb()` — `fetchJSON` from the source URL with the same `prefixes[]` validation
  - File header comment explaining what this covers (Gmail image proxy, Chrome
    prefetch proxy, Feedfetcher, Google Read Aloud, Site Verifier, etc.) and why
    it's distinct from the crawler providers — cite this milestone
- [x] `testAddresses` — use real proxy IPs from the RBL investigation that fall
      inside published /27s: `66.249.93.169` (in `66.249.93.160/27`) and
      `66.249.81.5` (in `66.249.81.0/27`); optionally an edge IP like `74.125.208.8`

### Wiring

- [x] Register in `defaultProviders` in `src/index.js` (import + array entry, near the other Google providers)
- [x] `scripts/update-assets.sh`:
  - [x] Add `GOOGLE_USER_FETCHERS_URL` constant
  - [x] Download + `validate_json '.prefixes | length > 0'`
  - [x] `commit_asset` line for `google-user-fetchers.json` (`prefixes prefixes`)
  - [x] Add a `google-user-fetchers` block to the generated `checksums.json` heredoc
- [x] Regenerate `src/assets/checksums.json` by running `./scripts/update-assets.sh`
      (or add the entry + sha by hand) and confirm the sha matches the bundled asset

### Tests

- [x] Add a provider test mirroring the Bingbot/Googlebot provider tests
      (resolves its `testAddresses`, rejects a non-Google IP)
- [x] Confirm `test/ip-lookup-report.test.js` (provider self-test report) picks up
      the new provider and all its test addresses resolve
- [x] `npm test` green
- [x] Sanity check: a known crawler-half IP (`66.249.66.87`) still resolves as
      **Googlebot**, not the new provider (no mis-attribution / overlap regression)

### Docs

- [x] `docs/providers.md` — add the provider row (matches `defaultProviders`)
- [x] `README.md` — add to the provider list
- [x] `CLAUDE.md` — add to the bundled-asset providers examples (currently lists
      Googlebot, Google Special Crawlers, Bingbot, BunnyNet, FacebookBot)
- [x] `docs/regular-maintenance.md` — add to the list of bundled-asset providers
      that drift and must be refreshed

### Quality gates & release

- [x] `npm run format:check` clean
- [x] `npm run lint` clean (0 warnings)
- [x] `npm test` green (322 passing, 18 suites — 18 new tests)
- [x] `npm pack --dry-run` — confirms `google-user-fetchers.json` ships (31.6 kB)
      and nothing unwanted leaked (48 files, 44.3 kB)
- [x] Bump `package.json` to **2.2.0** (new provider = minor)
- [x] Prepend a dated `CHANGELOG.md` entry (new provider + the RBL false-positive
      it fixes)
- [x] Update `00-project-tracker.md` (mark M8, current version)
- [x] Commit + tag `v2.2.0` (commit `e9e0729`, pushed to `origin/main`; Paul runs `npm publish`)

### Validation (post-build, with Paul)

- [x] Confirm Spam Shield reclassifies the proxy IPs as trusted (19 Jun 2026,
      after the spamshield2 deploy): `net-ip-lookup.sh 66.249.93.171` now returns
      `score: 1 "Trusted"`, `isAlwaysAllowed: true`, all abuse flags false, and
      `trustedSource: "Google User-Triggered Fetchers"` (was score 0 "The worst").
      The RBL export rebuilds on a 2-hourly cycle, so exclusion lands at the next
      build; origin `ipset` then picks it up on its own refresh.
- [ ] Confirm the client's newsletter images render in Gmail once the rebuilt RBL
      has propagated to the origin server's `ipset` (end-to-end proof — pending
      the next 2-hourly build + origin refresh)

---

## Sequencing note

This is independent of the M7 AI-crawler batch (Applebot / GPTBot / OAI-SearchBot,
also targeting 2.2.0). Given the active customer impact, M8 can ship as its own
2.2.0 ahead of the AI crawlers (pushing those to 2.3.0), or the two can land
together in 2.2.0. Decision deferred to release time.
