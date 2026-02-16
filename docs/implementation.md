# Implementation Document

## Technical Architecture

### Overview

Trusted Network Providers is a Node.js library that provides in-memory IP address matching against configured trusted provider lists. The architecture emphasizes simplicity, extensibility, and runtime performance.

### Design Principles

1. **Synchronous Lookups**: IP matching must be fast and non-blocking for request processing
2. **Asynchronous Updates**: Provider data updates happen out-of-band via promises
3. **Zero Configuration**: Works with sensible defaults, customizable when needed
4. **Provider Isolation**: Each provider is a self-contained module
5. **Fail-Safe**: Errors during updates don't crash the application

---

## Technology Stack

### Runtime Environment

- **Node.js**: LTS versions (v18+, v20+ recommended, v22+ preferred)
- **ES Module Support**: Native ESM (`import`/`export`) as of v2.0.0
- **Shell Scripts**: Bash for asset management

### Core Dependencies

#### ipaddr.js (^2.0.1)

**Purpose**: IP address parsing and CIDR range matching  
**Usage**:

- Parse IPv4 and IPv6 addresses
- Parse CIDR notation ranges
- Match IP addresses against CIDR ranges
- Handle compressed IPv6 notation

**Key Functions Used**:

```javascript
ipaddr.parse(address); // Parse IP string to object
ipaddr.parseCIDR(range); // Parse CIDR range
parsedIp.match(cidr); // Check if IP matches CIDR
parsedIp.kind(); // Returns 'ipv4' or 'ipv6'
```

#### fast-xml-parser (^4.5.0)

**Purpose**: XML/HTML parsing for GTmetrix provider  
**Usage**:

- Parse GTmetrix IP list HTML page
- Extract IP addresses from table structure

**Status**: Required dependency for GTmetrix provider; no replacement planned

### Node.js Built-in Modules

#### Native fetch (Node.js 18+)

**Purpose**: HTTP client for fetching provider data  
**Usage**:

- Fetch JSON data from provider APIs (Googlebot, Stripe, etc.)
- HTTPS by default with Node.js TLS validation
- Promise-based, native to runtime

**Implementation**: See `src/secure-http-client.js`

**Example**:

```javascript
const response = await fetch(url, {
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(timeout),
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
return await response.json();
```

**Advantages over third-party HTTP clients**:

- Zero dependencies
- Built-in timeout support via AbortController
- Standard web API (portable knowledge)
- Maintained by Node.js core team

#### dns/promises

**Purpose**: DNS TXT record resolution for SPF-based providers  
**Usage**:

- Resolve SPF records for email service providers
- Parse `include:` directives
- Extract IP ranges from `ip4:` and `ip6:` mechanisms

**Implementation**: See `src/spf-analyser.js`

---

## Module Architecture

### Core Module: `src/index.js`

**Responsibilities**:

- Provider registry management
- IP address lookup logic
- Test execution framework
- Diagnostic output control

**State Management**:

```javascript
{
  providers: [],                    // Array of provider objects
  isDiagnosticsEnabled: false,      // Debug output flag (deprecated, use logger)
  logger: console,                  // Configurable logging abstraction
  eventEmitter: EventEmitter,       // Lifecycle event emitter
  parsedAddresses: LRUCache,        // CIDR range cache (max 10,000 entries)
  resultCache: LRUCache,            // IP lookup result cache (max 10,000, 5min TTL)
  stalenessThresholdMs: 86400000,   // 24h staleness threshold
  limits: {
    maxProviders: 100,
    maxIPsPerProvider: 100000,
    maxCIDRSize: { ipv4: 8, ipv6: 32 }
  }
}
```

**Provider Object Structure** (v2.0.0):

```javascript
{
  name: 'Provider Name',
  state: 'ready',              // ready | loading | error | stale
  lastUpdated: 1708113600000,  // Unix timestamp (ms)
  lastError: null,             // Error object or null
  testAddresses: ['1.2.3.4'],
  reload: () => Promise,       // Optional
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] }
}
```

**Key Design Decisions**:

1. **Dual-Layer LRU Caching** (v2.0.0):
   - **CIDR Cache**: Parsed ranges (max 10,000 entries, no TTL)
   - **Result Cache**: IP lookup results (max 10,000 entries, 5min TTL)
   - Both caches invalidate on provider reload
   - **Performance Impact**: 192x speedup on warm cache (30.5ms → 0.16ms for 15 lookups)

   ```javascript
   // CIDR cache (bounded by LRU eviction)
   if (!parsedAddresses.has(testRange)) {
     parsedAddresses.set(testRange, ipaddr.parseCIDR(testRange));
   }

   // Result cache (time-bound + size-bound)
   const cacheKey = `${ipAddress}`;
   if (resultCache.has(cacheKey)) {
     return resultCache.get(cacheKey);
   }
   ```

2. **Linear Search**: Providers are checked sequentially until first match
   - Simple and predictable
   - Performance adequate for typical provider counts (< 50)
   - First match wins (provider order matters)
   - Result cache eliminates repeated searches for same IPs

3. **Separate IPv4/IPv6 Pools**: Each provider maintains distinct address collections
   - Reduces search space
   - Simplifies matching logic
   - Clear separation of concerns

4. **Lifecycle State Tracking** (v2.0.0):
   - Each provider has `state`, `lastUpdated`, `lastError` fields
   - States: `ready`, `loading`, `error`, `stale`
   - Staleness detection after configurable threshold (default 24h)
   - EventEmitter for observability: `providerReloadStart`, `providerReloadSuccess`, `providerReloadError`, `providerStale`

5. **Input Validation** (v2.0.0):
   - Max 100 providers (configurable)
   - Max 100,000 IPs per provider (configurable)
   - CIDR size limits: /8 minimum for IPv4, /32 minimum for IPv6
   - Protects against accidental DoS via misconfiguration

### Provider Modules: `src/providers/*.js`

**Standard Provider Structure** (v2.0.0 ESM):

```javascript
export default {
  name: 'Provider Name',
  state: 'ready',
  lastUpdated: null,
  lastError: null,
  testAddresses: ['1.2.3.4'],
  reload: async () => {
    // Fetch and update provider data
  }, // Optional
  ipv4: {
    addresses: [],
    ranges: [],
  },
  ipv6: {
    addresses: [],
    ranges: [],
  },
};
```

**v1.x (CommonJS)**:

```javascript
module.exports = { /* same structure */ };
```

**Provider Categories**:

#### Static Providers

Hardcoded CIDR ranges that rarely change:

- `cloudflare.js` - CDN IP ranges
- `private.js` - RFC 1918 private networks
- `outlook.js` - Microsoft mail servers
- `brevo.js` - Email service IPs

**Advantages**: No external dependencies, instant availability  
**Maintenance**: Manual updates when provider announces changes

#### JSON Asset Providers

Load from bundled JSON files:

- `googlebot.js` - Loads from `assets/googlebot-ips.json`
- `bunnynet.js` - Loads from `assets/bunnynet-ip4s.json` and `bunnynet-ip6s.json`
- `facebookbot.js` - Loads from `assets/facebookbot-ip4s.txt` and `facebookbot-ip6s.txt`

**Advantages**: Faster than HTTP, versioned with package  
**Maintenance**: Update assets via `scripts/update-assets.sh`

#### HTTP Dynamic Providers

Fetch data from external APIs:

- `stripe-api.js` - `https://stripe.com/files/ips/ips_api.json`
- `stripe-webhooks.js` - `https://stripe.com/files/ips/ips_webhooks.json`
- `googlebot.js` (reloadFromWeb) - Google's published IP ranges

**Advantages**: Always current data  
**Disadvantages**: Network dependency, potential for rate limiting or service changes

#### SPF-based Providers

Parse DNS TXT records using SPF protocol:

- `google-workspace.js` - Via `_spf.google.com`
- `mailgun.js` - Via SPF records
- Uses `src/spf-analyser.js` helper

**Advantages**: Authoritative source, maintained by provider  
**Disadvantages**: DNS lookup latency, no DNSSEC validation

### Helper Modules

#### `src/spf-analyser.js`

**Purpose**: Extract IP ranges from SPF DNS records

**Algorithm** (v2.0.0 async/await):

1. Resolve TXT records for domain
2. Find records starting with `v=spf1`
3. Parse `include:` directives to find netblock domains
4. Resolve TXT records for each netblock (parallel via `Promise.allSettled`)
5. Extract `ip4:` and `ip6:` mechanisms
6. Handle CIDR notation automatically
7. Atomically swap provider data on success

**Key Implementation Details**:

- Async/await throughout (refactored in M3)
- Recursive DNS lookups via `Promise.allSettled()` (resilient to partial failures)
- Error handling for missing/malformed records with detailed logging
- Supports both individual IPs and CIDR ranges
- Validates minimum record count before updating
- Atomic data swap (no race conditions)

**Usage Pattern** (v2.0.0):

```javascript
import spfAnalyser from './spf-analyser.js';

const provider = {
  name: 'Email Service',
  reload: async () => {
    await spfAnalyser('_spf.google.com', provider);
  },
  // ... rest of provider object
};
```

**v1.x (CommonJS)**:

```javascript
const spfAnalyser = require('./spf-analyser');
reload: () => spfAnalyser('_spf.google.com', self);
```

#### `src/test.js`

**Purpose**: Integration testing and examples

**Features**:

- Enables diagnostic mode
- Loads default and custom providers
- Simulates slow reload with timeout
- Runs full test suite
- Demonstrates API usage

---

## Algorithm Details

### IP Lookup Algorithm (`getTrustedProvider`)

```
Input: ipAddress (string)
Output: providerName (string) or null

1. Parse IP address using ipaddr.js
   - On parse error: log and return null

2. Determine IP version (ipv4 or ipv6)

3. For each provider (in order):
   a. Select appropriate pool (ipv4 or ipv6)

   b. Check individual addresses:
      - Simple string equality match
      - If match: return provider name

   c. Check CIDR ranges:
      - Parse range if not cached
      - Match IP against range
      - If match: return provider name

   d. Continue to next provider if no match

4. If no provider matched: return null
```

**Performance Characteristics**:

- Best case: O(1) - first provider, first address matches
- Average case: O(n×m) - n providers, m average addresses per provider
- Worst case: O(n×(a+r)) - all providers checked, all addresses and ranges

**Optimization Opportunities**:

- Index by first octet for fast filtering
- Build interval tree for range queries
- Cache recent lookups (memoization)

### Provider Reload Algorithm (`reloadAll`) — v2.0.0

```
1. Clear both caches (CIDR + result)

2. Initialize empty array for reload promises

3. For each provider:
   a. Set provider state to 'loading'
   b. Emit 'providerReloadStart' event
   c. Check if provider has reload() function
   d. If yes, call reload() and add to array

4. Use Promise.allSettled(reloadRequests)
   - Waits for all reloads to complete
   - Captures both successes and failures
   - Resilient to partial failures

5. Process results:
   a. For each fulfilled promise:
      - Set provider state to 'ready'
      - Update lastUpdated timestamp
      - Emit 'providerReloadSuccess' event
   b. For each rejected promise:
      - Set provider state to 'error'
      - Store error in lastError field
      - Emit 'providerReloadError' event

6. Return summary object with success/failure counts
```

**Design Change** (v1.x → v2.0.0): Changed from `Promise.all()` to `Promise.allSettled()` for resilience. One failed provider reload no longer blocks all others.

---

## Lifecycle Events & Observability (v2.0.0)

### Event Emitter

The library now extends `EventEmitter` to provide observability into provider lifecycle operations.

**Available Events**:

| Event | Payload | Description |
|-------|---------|-------------|
| `providerReloadStart` | `{ provider }` | Provider reload initiated |
| `providerReloadSuccess` | `{ provider }` | Provider reload completed successfully |
| `providerReloadError` | `{ provider, error }` | Provider reload failed |
| `providerStale` | `{ provider }` | Provider data exceeds staleness threshold |

**Usage Example**:

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

trustedProviders.on('providerReloadError', ({ provider, error }) => {
  // Send alert to monitoring system
  alerting.notify(`Provider ${provider.name} failed: ${error.message}`);
});

trustedProviders.on('providerStale', ({ provider }) => {
  // Log warning
  console.warn(`Provider ${provider.name} is stale (last updated: ${new Date(provider.lastUpdated)})`);
});
```

### Provider State Machine

Each provider transitions through these states:

```
ready → loading → ready (success)
            ↓
          error (failure)
            ↓
          stale (timeout threshold exceeded)
```

**State Transitions**:

- `ready`: Normal operating state, data is fresh
- `loading`: Reload in progress
- `error`: Last reload failed (provider still usable with old data if available)
- `stale`: Data exceeds `stalenessThresholdMs` (default 24h)

**Query Provider Status**:

```javascript
const status = trustedProviders.getProviderStatus('googlebot');
console.log(status);
// {
//   name: 'googlebot',
//   state: 'ready',
//   lastUpdated: 1708113600000,
//   lastError: null,
//   ipv4Count: 150,
//   ipv6Count: 42
// }
```

### Logging Abstraction

Configure custom logger (default is `console`):

```javascript
import trustedProviders from '@headwall/trusted-network-providers';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'providers.log' })],
});

trustedProviders.logger = logger;
```

**Logger Interface** (must implement):

- `log(...args)` - General logging
- `error(...args)` - Error logging

---

## Asset Management

### Update Scripts

#### `scripts/update-assets.sh`

**Purpose**: Fetch latest IP lists and save to `src/assets/`

**Process**:

1. **FacebookBot IPs**:
   - Query WHOIS for AS32934 (Facebook)
   - Extract route entries
   - Separate IPv4 and IPv6 to separate files

2. **GoogleBot IPs**:
   - Download JSON from Google's API
   - Save directly to `googlebot-ips.json`

3. **BunnyNet IPs**:
   - Fetch IPv4 list from BunnyCDN API
   - Fetch IPv6 list from BunnyCDN API
   - Save as separate JSON files

**Usage**: Run manually before version releases

```bash
./scripts/update-assets.sh
```

**Error Handling**:

- Validates minimum record counts
- Uses temp files to avoid corrupting existing assets
- Only replaces files on successful download

#### `scripts/build.sh`

**Purpose**: Build distribution packages

**Commands**:

- `./scripts/build.sh zip` - Create versioned zip file in `dist/`
- `./scripts/build.sh clean` - Remove build artifacts and node_modules

**Excludes**: node_modules, dist, scripts, .git

---

## Memory Management

### LRU Caches (v2.0.0)

#### CIDR Cache (`parsedAddresses`)

**Implementation** (using custom LRU):

```javascript
import LRUCache from './lru-cache.js';

const parsedAddresses = new LRUCache(10000); // max 10k entries

if (!parsedAddresses.has(testRange)) {
  parsedAddresses.set(testRange, ipaddr.parseCIDR(testRange));
}
```

**Behavior**:

- Max size: 10,000 entries (configurable)
- Eviction: Least-recently-used when full
- Lifetime: Until provider reload (cache cleared)
- Typical size: ~200-500 entries for default providers
- Memory impact: ~10-50KB typical, ~500KB max

**Advantages over v1.x unbounded cache**:

- Bounded memory usage
- Protection against memory leaks
- Automatic cleanup of stale entries

#### Result Cache (`resultCache`)

**Implementation**:

```javascript
const resultCache = new LRUCache(10000, 300000); // 10k entries, 5min TTL

const cacheKey = `${ipAddress}`;
if (resultCache.has(cacheKey)) {
  return resultCache.get(cacheKey); // Cache hit
}
// ... perform lookup ...
resultCache.set(cacheKey, result);
```

**Behavior**:

- Max size: 10,000 entries (configurable)
- TTL: 5 minutes (300,000ms, configurable)
- Eviction: LRU + age-based
- Cleared on: Provider reload, staleness detection
- Memory impact: ~100KB typical, ~500KB max

**Performance Impact**:

- Cold cache: ~30.5ms for 15 IP lookups (2.03ms avg)
- Warm cache: ~0.16ms for 15 IP lookups (0.01ms avg)
- **Speedup: 192x on repeated lookups**

See `dev-notes/05-milestone-5-performance.md` for detailed profiling.

### Provider Arrays

**Clearing Pattern** (v2.0.0 — atomic swap):

```javascript
// Old (v1.x): O(n) clearing via pop()
while (self.ipv4.ranges.length > 0) {
  self.ipv4.ranges.pop();
}

// New (v2.0.0): O(1) atomic swap
const newIpv4 = { addresses: [], ranges: [] };
const newIpv6 = { addresses: [], ranges: [] };
// ... populate new arrays ...
self.ipv4 = newIpv4; // Atomic reference swap
self.ipv6 = newIpv6;
```

**Benefits**:

- **No race conditions**: Lookups always see consistent state
- **O(1) performance**: Single reference assignment
- **Cleaner code**: No mutation during reload

---

## Error Handling Strategy

### Philosophy

- **Fail gracefully**: Never crash on bad input
- **Log and continue**: Use `console.error()` for diagnostics
- **Safe defaults**: Return `null` on uncertainty (deny access by default)
- **Preserve state**: Failed reloads don't clear existing data

### Error Scenarios

1. **Invalid IP Address**:
   - Try-catch around `ipaddr.parse()`
   - Log error, return `null`

2. **Network Failures**:
   - superagent handles HTTP errors
   - Promise rejection propagates
   - Application decides handling strategy

3. **Malformed Provider Data**:
   - Try-catch in provider reload functions
   - Console error logged
   - Existing data preserved

4. **DNS Failures** (SPF):
   - Caught by promise rejection
   - Error count tracked
   - Won't update if errors occurred

---

## Configuration & Customization

### Diagnostic Mode

Enable verbose logging:

```javascript
trustedProviders.isDiagnosticsEnabled = true;
```

**Output**:

- Provider additions
- Reload operations
- Test results

### Custom Providers

Three patterns supported:

#### 1. Static Configuration (v2.0.0)

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

trustedProviders.addProvider({
  name: 'My Network',
  state: 'ready',
  lastUpdated: Date.now(),
  lastError: null,
  testAddresses: ['10.0.0.1'],
  ipv4: {
    addresses: ['10.0.0.1'],
    ranges: ['10.0.0.0/24'],
  },
  ipv6: { addresses: [], ranges: [] },
});
```

#### 2. With Reload Function (async/await)

```javascript
const myProvider = {
  name: 'Dynamic Network',
  state: 'ready',
  lastUpdated: null,
  lastError: null,
  reload: async () => {
    const response = await fetch('https://api.example.com/ips');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Atomic swap pattern
    myProvider.ipv4 = {
      addresses: data.ips,
      ranges: [],
    };
  },
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
};

export default myProvider;
```

#### 3. Using SPF Analyser (v2.0.0)

```javascript
import spfAnalyser from './spf-analyser.js';

const provider = {
  name: 'Email Service',
  state: 'ready',
  lastUpdated: null,
  lastError: null,
  reload: async () => {
    await spfAnalyser('spf.example.com', provider);
  },
  testAddresses: ['1.2.3.4'],
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
};

export default provider;
```

---

## Testing Strategy

### Test Framework

**Implementation**: Custom test runner in `src/test.js`

**Test Data Sources**:

1. Unknown IPs (should return `null`)
2. Provider `testAddresses` (should return provider name)

**Test Execution**:

```javascript
trustedProviders.runTests().then(() => console.log('Tests complete'));
```

**Output Format**:

- ✅ `192.168.1.1 => Private` (success)
- ❌ `8.8.8.8 => Googlebot (should be _wild_)` (failure)
- 🔷 `No tests for Provider Name` (warning)

### Validation Approach

1. **Structural**: Each provider has required fields
2. **Functional**: Test addresses match correctly
3. **Negative**: Unknown IPs return `null`
4. **Integration**: Full reload + test cycle

---

## Deployment Process

### Package Publishing

1. Update assets: `./scripts/update-assets.sh`
2. Update version in `package.json`
3. Update `CHANGELOG.md`
4. Commit changes
5. Create git tag: `git tag v1.x.x`
6. Push to GitHub: `git push origin main --tags`
7. Publish to npm: `npm publish`

### Consumer Integration

**Installation**:

```bash
npm install @headwall/trusted-network-providers
```

**Typical Startup Sequence** (v2.0.0 ESM):

```javascript
import trustedProviders from '@headwall/trusted-network-providers';

async function initializeTrustedProviders() {
  trustedProviders.loadDefaultProviders();
  
  // Optional: Listen for lifecycle events
  trustedProviders.on('providerReloadError', ({ provider, error }) => {
    console.error(`Failed to reload ${provider.name}:`, error);
  });
  
  const results = await trustedProviders.reloadAll();
  console.log(`Providers ready: ${results.successful} ok, ${results.failed} failed`);
}

initializeTrustedProviders().catch(console.error);
```

**v1.x (CommonJS)**:

```javascript
const trustedProviders = require('@headwall/trusted-network-providers');
// Same pattern, no event emitter
```

**Recommended Update Schedule**:

- Call `reloadAll()` every 24 hours for HTTP/DNS providers
- Monitor staleness via `providerStale` events
- Manual asset updates with package version bumps as needed
- Monitor provider announcements for IP range changes

---

## Performance Considerations

### Benchmarks (v2.0.0 Profiled)

**IP Lookup Performance**:

- **Cold cache**: 2.03ms avg (30.5ms total for 15 lookups)
- **Warm cache**: 0.01ms avg (0.16ms total for 15 lookups)
- **Cache hit rate**: ~95% in production workloads
- **Speedup: 192x** with result cache enabled

**Load Times**:

- **Initial load**: 100-500ms (depends on DNS/HTTP latency)
- **Reload all**: 1-5 seconds (network dependent)
- **Memory footprint**: ~5-10MB with all default providers

**Test Environment**: Node.js v22.12.0, 20 providers, 15 diverse IPs (Googlebot, Stripe, Cloudflare, etc.)

See `dev-notes/05-milestone-5-performance.md` for detailed profiling methodology and results.

### Scalability Limits

- **Providers**: Tested with ~20, should handle 100+
- **IP ranges per provider**: 1000s supported
- **Concurrent lookups**: Read-only, fully thread-safe
- **Request rate**: Millions per second possible (memory-only reads)

### Optimization Techniques Used

1. **CIDR Caching**: Avoid re-parsing ranges
2. **Early Exit**: Return on first match
3. **IP Version Filtering**: Only check relevant address family
4. **Simple Data Structures**: Arrays for predictable performance

### Known Bottlenecks

1. **Linear Search**: O(n) provider iteration
2. **Array Iteration**: O(m) for addresses/ranges within provider
3. **No Indexing**: Every lookup checks from beginning

---

## Security Implementation

### Current Security Measures (v2.0.0)

1. **Input Validation**:
   - IP parsing with try-catch
   - Malformed IPs rejected gracefully
   - **Max providers**: 100 (configurable, prevents resource exhaustion)
   - **Max IPs per provider**: 100,000 (configurable)
   - **CIDR size limits**: /8 minimum for IPv4, /32 minimum for IPv6 (prevents overly broad ranges)

2. **Error Containment**:
   - Provider reload failures logged but don't crash
   - Bad provider data doesn't affect other providers
   - Atomic swap pattern prevents partial state exposure

3. **Memory Safety**:
   - No eval() or dynamic code execution
   - Bounded data structures (LRU caches with hard limits)
   - Protection against unbounded growth

### Known Security Limitations

1. **No HTTPS Certificate Verification**: Relies on Node.js defaults (generally secure)
2. **No DNSSEC**: DNS responses not validated
3. **No Integrity Checks**: External JSON not checksummed
4. **No Rate Limiting**: Reload can trigger many simultaneous HTTP requests

**Fixed in v2.0.0**:

- ~~Unbounded cache~~ → LRU caches with hard limits
- ~~Race conditions in provider updates~~ → Atomic swap pattern
- ~~No input validation~~ → Provider/IP/CIDR limits enforced

### Trust Model

**Assumptions**:

- External provider APIs serve correct data
- DNS responses are authentic
- Network path is secure (HTTPS)
- Provider modules are trusted code

**Recommendations**:

- Use on trusted networks
- Monitor provider sources for changes
- Regular security audits of dependencies
- Consider checksum validation for critical deployments

---

## Technical Debt & Future Considerations

### Architecture Evolution

**Completed in v2.0.0**:

1. ✅ ESM migration (from CommonJS)
2. ✅ Async/await refactoring (consistent throughout)
3. ✅ Event emitter for lifecycle events
4. ✅ LRU caching for performance
5. ✅ Input validation and security hardening
6. ✅ Promise.allSettled for resilient reloads
7. ✅ Atomic swap pattern for race-free updates
8. ✅ Native fetch (removed superagent dependency)

**Future Considerations** (post-v2.0.0):

1. TypeScript migration for type safety
2. Plugin system for provider types
3. Performance monitoring hooks (beyond events)
4. DNSSEC validation for DNS providers
5. Checksum validation for bundled assets

### Compatibility Commitments

**v2.0.0 Breaking Changes**:

- **ESM only** (dropped CommonJS support)
- **Node.js 18+ required** (uses native fetch)
- **Async/await patterns** (not breaking for consumers, but internal change)

**Maintained**:

- Synchronous lookup API (`getTrustedProvider`)
- Provider object structure (backward compatible)
- Node.js LTS support (18, 20, 22+)

**May Change**:

- Internal caching strategy (already changed to LRU in v2.0)
- Error handling details
- Event names and payloads
- Lifecycle state machine
- Build tooling

---

**Document Version:** 2.0  
**Last Updated:** 2026-02-16  
**Status:** Updated for v2.0.0 Release
