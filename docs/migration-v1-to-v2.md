# Migration Guide: v1.x → v2.x

This guide covers breaking changes and new features when upgrading from v1.x to v2.0.0.

---

## Breaking Changes

### 1. ES Modules (ESM) Migration

**v2.0.0 migrates from CommonJS to ES modules.** This is the primary breaking change.

#### Old (v1.x - CommonJS)

```javascript
const trustedProviders = require('@headwall/trusted-network-providers');

trustedProviders.loadDefaultProviders();
trustedProviders.reloadAll().then(() => {
  const provider = trustedProviders.getTrustedProvider('66.249.66.87');
  console.log(provider); // "Googlebot"
});
```

#### New (v2.x - ES Modules)

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

trustedProviders.loadDefaultProviders();
await trustedProviders.reloadAll();

const provider = trustedProviders.getTrustedProvider('66.249.66.87');
console.log(provider); // "Googlebot"
```

#### Required Changes

1. **Replace `require()` with `import`**
   ```javascript
   // Old
   const trustedProviders = require('@headwall/trusted-network-providers');
   
   // New
   import trustedProviders from '@headwall/trusted-network-providers';
   ```

2. **Use `await` instead of `.then()` for async operations**
   ```javascript
   // Old
   trustedProviders.reloadAll().then(() => {
     // ...
   });
   
   // New
   await trustedProviders.reloadAll();
   ```

3. **Update your package.json**
   
   If your project uses this library, ensure your `package.json` supports ES modules:
   ```json
   {
     "type": "module"
   }
   ```
   
   Alternatively, use `.mjs` file extensions for ES module files.

4. **Node.js Version Requirement**
   
   v2.0.0 requires **Node.js >= 18.0.0** (tested on v22.21.0). Upgrade if you're on an older version.

---

## Non-Breaking Changes

The following are **new features** in v2.0.0. They are optional — your existing code will continue to work without using them.

### 1. Provider Lifecycle Events

v2.0.0 adds an event emitter for observing provider reload cycles. Useful for long-running services that need to monitor provider health.

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

trustedProviders.on('reload:success', ({ provider, timestamp }) => {
  console.log(`${provider} reloaded at ${new Date(timestamp)}`);
});

trustedProviders.on('reload:error', ({ provider, error }) => {
  console.error(`${provider} failed to reload:`, error.message);
});

trustedProviders.on('stale', ({ provider, lastUpdated, staleDuration }) => {
  console.warn(`${provider} is stale (last updated ${staleDuration}ms ago)`);
});
```

**Events:**
- `reload:success` — fired when a provider successfully updates
- `reload:error` — fired when a provider fails to update
- `stale` — fired when a provider hasn't updated within the staleness threshold

### 2. Provider State Tracking

```javascript
const status = trustedProviders.getProviderStatus('Googlebot');
console.log(status);
// {
//   name: 'Googlebot',
//   state: 'ready',           // 'ready' | 'loading' | 'error' | 'stale'
//   lastUpdated: 1708123456,  // Unix timestamp (ms)
//   lastError: null           // Error object or null
// }
```

**Provider States:**
- `ready` — loaded and operational
- `loading` — currently fetching data
- `error` — last reload failed
- `stale` — hasn't been updated within the configured staleness threshold

**State Constants (exported):**
```javascript
import trustedProviders, {
  PROVIDER_STATE_READY,
  PROVIDER_STATE_LOADING,
  PROVIDER_STATE_ERROR,
  PROVIDER_STATE_STALE,
} from '@headwall/trusted-network-providers';

if (status.state === PROVIDER_STATE_ERROR) {
  // Handle error...
}
```

### 3. Staleness Detection

Configure how long a provider can go without updates before being marked `stale`:

```javascript
// Default: 24 hours (86400000 ms)
trustedProviders.setStalenessThreshold(12 * 60 * 60 * 1000); // 12 hours
```

When a provider becomes stale, a `stale` event is emitted. This is useful for triggering manual reloads or alerting your monitoring system.

### 4. Result Caching with TTL

v2.0.0 adds an **IP lookup result cache** with configurable TTL to reduce repeated lookups of the same IP.

```javascript
// Configure cache TTL (default: 1 hour = 3600000 ms)
trustedProviders.setResultCacheTtl(30 * 60 * 1000); // 30 minutes

// Get current TTL
const ttl = trustedProviders.getResultCacheTtl();
console.log(ttl); // 1800000
```

**How it works:**
- When `getTrustedProvider(ip)` or `isTrusted(ip)` is called, the result is cached for the configured TTL
- Cache is invalidated when providers are reloaded via `reloadAll()`
- Default TTL: 1 hour (appropriate for most use cases)

### 5. Configurable Logging

v2.0.0 adds a logging abstraction that replaces bare `console.log` / `console.error` calls.

```javascript
// Set log level: 'silent' | 'error' | 'warn' | 'info' | 'debug'
trustedProviders.setLogLevel('warn'); // Only errors and warnings

// Get current log level
const level = trustedProviders.getLogLevel();
console.log(level); // 'warn'
```

**Log Levels:**
- `silent` — no logging
- `error` — errors only
- `warn` — errors and warnings (recommended for production)
- `info` — errors, warnings, and informational messages (default)
- `debug` — verbose output for debugging

---

## Performance Improvements

v2.0.0 includes significant performance optimizations:

1. **LRU Cache for Parsed CIDR Ranges**
   - Replaces unbounded `parsedAddresses` map
   - Max size: 1000 entries
   - Reduces memory footprint in high-provider environments

2. **IP Lookup Result Cache**
   - Caches lookup results with configurable TTL (default: 1 hour)
   - Typical lookup time: **< 1ms** (with cache hit)
   - Cold lookup time: ~30ms for 15 providers
   - Warm lookup time: ~0.16ms (192x speedup)

See `dev-notes/05-milestone-5-performance.md` for detailed profiling.

---

## Dependency Changes

v2.0.0 removes **superagent** and replaces it with Node.js **native `fetch()`**.

**Before (v1.x):**
- Dependencies: `superagent`, `fast-xml-parser`, `ipaddr.js`

**After (v2.x):**
- Dependencies: `fast-xml-parser`, `ipaddr.js`
- HTTP requests now use `fetch()` (available in Node.js >=18)

**Why this matters:**
- Smaller package size
- Fewer supply-chain attack surfaces
- Leverages built-in Node.js HTTP client

---

## Step-by-Step Migration

### 1. Update Node.js

Ensure you're running **Node.js >= 18.0.0**:

```bash
node --version
```

If you're on an older version, upgrade via [nvm](https://github.com/nvm-sh/nvm) or your package manager.

### 2. Update the Package

```bash
npm install @headwall/trusted-network-providers@^2.0.0
```

### 3. Update Your Code

#### Example: Express.js Middleware

**Before (v1.x):**
```javascript
const express = require('express');
const trustedProviders = require('@headwall/trusted-network-providers');

const app = express();

trustedProviders.loadDefaultProviders();
trustedProviders.reloadAll().then(() => {
  console.log('Providers loaded');
});

app.use((req, res, next) => {
  const provider = trustedProviders.getTrustedProvider(req.ip);
  if (provider) {
    req.trustedProvider = provider;
  }
  next();
});

app.listen(3000);
```

**After (v2.x):**
```javascript
import express from 'express';
import trustedProviders from '@headwall/trusted-network-providers';

const app = express();

trustedProviders.loadDefaultProviders();
await trustedProviders.reloadAll();
console.log('Providers loaded');

app.use((req, res, next) => {
  const provider = trustedProviders.getTrustedProvider(req.ip);
  if (provider) {
    req.trustedProvider = provider;
  }
  next();
});

app.listen(3000);
```

**Changes:**
- `require()` → `import`
- `.then()` → `await`
- Added top-level `await` (requires `"type": "module"` in package.json or `.mjs` extension)

#### Example: Long-Running pm2 Service

**Before (v1.x):**
```javascript
const trustedProviders = require('@headwall/trusted-network-providers');

trustedProviders.loadDefaultProviders();
trustedProviders.reloadAll();

setInterval(() => {
  trustedProviders.reloadAll();
}, 60 * 60 * 1000); // Reload every hour
```

**After (v2.x):**
```javascript
import trustedProviders from '@headwall/trusted-network-providers';

// Configure logging for production
trustedProviders.setLogLevel('warn');

// Load providers
trustedProviders.loadDefaultProviders();
await trustedProviders.reloadAll();

// Monitor provider health
trustedProviders.on('stale', ({ provider }) => {
  console.warn(`Provider ${provider} is stale, triggering reload...`);
  trustedProviders.reloadAll();
});

trustedProviders.on('reload:error', ({ provider, error }) => {
  console.error(`Critical: ${provider} reload failed:`, error.message);
  // Alert your monitoring system here
});

// Periodic reload (optional with staleness detection)
setInterval(() => {
  trustedProviders.reloadAll();
}, 60 * 60 * 1000); // Every hour
```

**Changes:**
- `require()` → `import`
- Added lifecycle event listeners for better observability
- Added production logging configuration

### 4. Update Your package.json

Ensure your project supports ES modules:

```json
{
  "name": "your-project",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 5. Run Tests

After updating, run your test suite to verify everything works:

```bash
npm test
```

---

## Common Migration Issues

### Issue: `SyntaxError: Cannot use import statement outside a module`

**Cause:** Your project is still configured for CommonJS.

**Solution:** Add `"type": "module"` to your `package.json`, or rename your files to `.mjs`.

---

### Issue: `ReferenceError: require is not defined`

**Cause:** You have a mix of `require()` and `import` in your code.

**Solution:** Convert all `require()` statements to `import`.

---

### Issue: Top-level `await` not working

**Cause:** Top-level `await` requires ES modules.

**Solution:** Ensure `"type": "module"` is set in `package.json`, or wrap your code in an async IIFE:

```javascript
(async () => {
  await trustedProviders.reloadAll();
  // Rest of your code...
})();
```

---

## Rollback Plan

If you encounter issues and need to rollback to v1.x:

```bash
npm install @headwall/trusted-network-providers@^1.9.0
```

Then revert your code changes (replace `import` with `require()`, `.then()` instead of `await`).

---

## Getting Help

- **GitHub Issues:** https://github.com/headwalluk/trusted-network-providers/issues
- **Email:** paul@headwall.co.uk
- **Security Issues:** See [docs/security.md](./security.md) for responsible disclosure

---

## Summary

| Change                     | v1.x                      | v2.x                                  |
| -------------------------- | ------------------------- | ------------------------------------- |
| Module System              | CommonJS                  | ES Modules                            |
| Import Syntax              | `require()`               | `import`                              |
| Async Handling             | `.then()` / `.catch()`    | `await` / `try...catch`               |
| Node.js Version            | Not specified             | >= 18.0.0 (tested on v22.21.0)        |
| HTTP Client                | `superagent`              | Native `fetch()`                      |
| Provider Lifecycle Events  | Not available             | `reload:success`, `reload:error`, etc |
| Provider State Tracking    | Not available             | `getProviderStatus()`                 |
| Staleness Detection        | Not available             | Configurable via `setStalenessThreshold()` |
| Result Caching             | Not available             | Configurable TTL via `setResultCacheTtl()` |
| Logging                    | Bare `console` statements | Configurable via `setLogLevel()`      |
| Performance (warm lookups) | ~30ms                     | ~0.16ms (192x faster)                 |

**Bottom line:** v2.0.0 is faster, more observable, and more maintainable. The migration is straightforward if you follow this guide.
