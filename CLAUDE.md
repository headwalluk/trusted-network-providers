# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js library (`@headwall/trusted-network-providers`) for identifying IP addresses belonging to trusted network providers (Googlebot, Stripe, Cloudflare, PayPal, etc.). Used for firewall whitelisting, rate-limit bypassing, and traffic classification. Published on npm as an ES module (v2.0.0+).

## Commands

```bash
# Install dependencies
npm install

# Run full test suite (requires --experimental-vm-modules for Jest ESM support)
npm test

# Run a single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js test/lru-cache.test.js

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# CLI lookup tool (ad-hoc IP check)
npm run lookup -- <ip-address>

# Update bundled IP assets from external sources
./scripts/update-assets.sh
```

## Architecture

**ES modules throughout** (`"type": "module"` in package.json). Use `import`/`export`, not `require`.

### Core (`src/index.js`)

Singleton object with an EventEmitter for lifecycle events. Manages a provider registry, two-tier caching (LRU for parsed CIDR ranges, TTL+LRU for lookup results), and provider state machine (ready/loading/error/stale). IP lookups are synchronous after initial load: linear scan through providers, exact-match first, then CIDR range matching via `ipaddr.js`.

### Provider System (`src/providers/`)

Each provider is a module exporting `{ name, testAddresses, reload?, ipv4: { addresses, ranges }, ipv6: { addresses, ranges } }`. Four provider types:

- **Static**: Hardcoded ranges, no `reload` (e.g., `private.js`, `cloudflare.js`)
- **Bundled asset**: Loads from `src/assets/*.json` with checksum verification (e.g., `googlebot.js`, `bunnynet.js`)
- **HTTP API**: Fetches from external APIs via `secure-http-client.js` (e.g., `stripe-api.js`)
- **DNS/SPF**: Resolves SPF records via `spf-analyser.js` (e.g., `google-workspace.js`, `outlook.js`)

To add a provider: create file in `src/providers/`, add import and entry to `defaultProviders` array in `src/index.js`, include test addresses.

### Utilities

- `src/utils/secure-http-client.js` - HTTPS-only fetch with timeouts, retries, checksum verification
- `src/utils/checksum-verifier.js` - SHA-256 verification for bundled JSON assets against `src/assets/checksums.json`
- `src/spf-analyser.js` - Extracts IPs from DNS SPF records (no DNSSEC validation)
- `src/lru-cache.js` / `src/ttl-cache.js` - Custom cache implementations

### Tests (`test/`)

Jest with ESM support. Tests organized by concern: unit tests, integration tests, provider tests, edge cases, performance, lifecycle events. Test files use `.test.js` suffix.

## Regular Maintenance

The bundled-asset providers (Googlebot, Google Special Crawlers, Google User-Triggered Fetchers, Bingbot, BunnyNet, FacebookBot) ship IP lists under `src/assets/` that drift over time and must be refreshed periodically — monthly, and before any release. See [docs/regular-maintenance.md](docs/regular-maintenance.md) for the full guide. Runtime providers (Stripe, Google Workspace SPF) self-refresh and need no maintenance.

`scripts/update-assets.sh` is deterministic: it stages downloads, validates them, writes back only files that actually changed, regenerates `src/assets/checksums.json`, and reports via exit code — `0` = no change, `10` = assets changed, `1` = error (nothing written).

When asked to run maintenance, execute this loop:

1. Run `./scripts/update-assets.sh` and read its exit code + summary block.
2. **Exit 0** — report "no changes" and stop. Nothing to commit.
3. **Exit 1** — report the failure; do not commit. Nothing was written.
4. **Exit 10** — assets changed:
   - Review `git diff src/assets/`; sanity-check the counts (plausible deltas, not a collapse to near-zero).
   - **Patch-bump** `package.json` (asset refreshes are data-only, e.g. `2.1.0` → `2.1.1`).
   - Prepend a dated `CHANGELOG.md` entry naming the changed assets and their count deltas.
   - Commit and tag (Paul runs `npm publish` himself — do not publish).

## Style

- Single quotes, semicolons required, 2-space indent
- Arrow functions for callbacks; `const`/`let` only (no `var`)
- Prettier + ESLint (flat config in `eslint.config.js`)
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
