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

- **Node.js**: LTS versions (v18+, v20+ recommended)
- **ES Module Support**: Uses CommonJS (`require`/`module.exports`)
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

#### superagent (^10.1.1)

**Purpose**: HTTP client for fetching provider data  
**Usage**:

- Fetch JSON data from provider APIs (Googlebot, Stripe, etc.)
- Handle HTTP errors gracefully
- Promise-based request handling

**Example**:

```javascript
superagent
  .get(url)
  .accept('json')
  .then((result) => result.body);
```

#### fast-xml-parser (^4.2.2)

**Purpose**: XML/HTML parsing for provider data sources  
**Usage**: Currently included but not actively used in main codebase
**Status**: May be used by disabled providers or future enhancements

### Node.js Built-in Modules

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
  providers: [],              // Array of provider objects
  isDiagnosticsEnabled: false, // Debug output flag
  parsedAddresses: {}         // CIDR range cache
}
```

**Key Design Decisions**:

1. **CIDR Caching**: Parsed CIDR ranges are cached in `parsedAddresses` object to avoid re-parsing on every lookup

   ```javascript
   if (!parsedAddresses[testRange]) {
     parsedAddresses[testRange] = ipaddr.parseCIDR(testRange);
   }
   ```

2. **Linear Search**: Providers are checked sequentially until first match
   - Simple and predictable
   - Performance adequate for typical provider counts (< 50)
   - First match wins (provider order matters)

3. **Separate IPv4/IPv6 Pools**: Each provider maintains distinct address collections
   - Reduces search space
   - Simplifies matching logic
   - Clear separation of concerns

### Provider Modules: `src/providers/*.js`

**Standard Provider Structure**:

```javascript
module.exports = {
  name: 'Provider Name',
  testAddresses: ['1.2.3.4'],
  reload: () => Promise, // Optional
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

**Algorithm**:

1. Resolve TXT records for domain
2. Find records starting with `v=spf1`
3. Parse `include:` directives to find netblock domains
4. Resolve TXT records for each netblock
5. Extract `ip4:` and `ip6:` mechanisms
6. Handle CIDR notation automatically
7. Update provider object with discovered IPs

**Key Implementation Details**:

- Recursive DNS lookups via `Promise.all()`
- Error handling for missing/malformed records
- Supports both individual IPs and CIDR ranges
- Validates minimum record count before updating

**Usage Pattern**:

```javascript
const spfAnalyser = require('./spf-analyser');

reload: () => {
  return spfAnalyser('_spf.google.com', self);
};
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

### Provider Reload Algorithm (`reloadAll`)

```
1. Initialize empty array for reload promises

2. For each provider:
   a. Check if provider has reload() function
   b. If yes, call reload()
   c. If returns array of promises:
      - Add each promise to array
   d. If returns single promise:
      - Add to array

3. Return Promise.all(reloadRequests)
   - Waits for all reloads to complete
   - One failure fails entire operation
```

**Design Tradeoff**: Currently one failed reload fails entire `reloadAll()`. Could be changed to `Promise.allSettled()` for more resilience.

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

### CIDR Cache (`parsedAddresses`)

**Implementation**:

```javascript
const parsedAddresses = {};

if (!parsedAddresses[testRange]) {
  parsedAddresses[testRange] = ipaddr.parseCIDR(testRange);
}
```

**Behavior**:

- Lifetime: Application lifetime (never cleared)
- Growth: One entry per unique CIDR string across all providers
- Typical size: ~200-500 entries for default providers
- Memory impact: ~10-50KB

**Known Issue**: No eviction policy; unbounded growth if providers change frequently

### Provider Arrays

**Clearing Pattern**:

```javascript
while (self.ipv4.ranges.length > 0) {
  self.ipv4.ranges.pop();
}
```

**Performance**: O(n) where n = array length  
**Alternative**: `array.length = 0` or `array.splice(0)` - O(1)

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

#### 1. Static Configuration

```javascript
trustedProviders.addProvider({
  name: 'My Network',
  testAddresses: ['10.0.0.1'],
  ipv4: {
    addresses: ['10.0.0.1'],
    ranges: ['10.0.0.0/24'],
  },
  ipv6: { addresses: [], ranges: [] },
});
```

#### 2. With Reload Function

```javascript
const myProvider = {
  name: 'Dynamic Network',
  reload: () => {
    return fetch('https://api.example.com/ips').then((data) => {
      myProvider.ipv4.addresses = data.ips;
    });
  },
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
};
```

#### 3. Using SPF Analyser

```javascript
const spfAnalyser = require('./spf-analyser');

module.exports = {
  name: 'Email Service',
  reload: () => spfAnalyser('spf.example.com', self),
  testAddresses: ['1.2.3.4'],
  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
};
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

**Typical Startup Sequence**:

```javascript
const trustedProviders = require('@headwall/trusted-network-providers');

async function initializeTrustedProviders() {
  trustedProviders.loadDefaultProviders();
  await trustedProviders.reloadAll();
  console.log('Trusted providers ready');
}

initializeTrustedProviders().catch(console.error);
```

**Recommended Update Schedule**:

- Call `reloadAll()` every 24 hours for HTTP/DNS providers
- Manual asset updates with package version bumps as needed
- Monitor provider announcements for IP range changes

---

## Performance Considerations

### Benchmarks (Estimated)

- **Single lookup**: < 1ms typical, < 10ms worst case
- **Initial load**: 100-500ms (depends on DNS/HTTP latency)
- **Reload all**: 1-5 seconds (network dependent)
- **Memory footprint**: ~5-10MB with all default providers

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

### Current Security Measures

1. **Input Validation**:
   - IP parsing with try-catch
   - Malformed IPs rejected gracefully

2. **Error Containment**:
   - Provider reload failures logged but don't crash
   - Bad provider data doesn't affect other providers

3. **Memory Safety**:
   - No eval() or dynamic code execution
   - Bounded data structures (per provider)

### Known Security Limitations

1. **No HTTPS Certificate Verification**: Relies on Node.js defaults
2. **No DNSSEC**: DNS responses not validated
3. **No Integrity Checks**: External JSON not checksummed
4. **No Rate Limiting**: Reload can trigger many requests
5. **Unbounded Cache**: `parsedAddresses` grows indefinitely

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

**Potential Improvements**:

1. TypeScript migration for type safety
2. Async/await refactoring for consistency
3. Event emitter for reload status
4. Plugin system for provider types
5. Performance monitoring hooks

### Compatibility Commitments

**Maintained**:

- CommonJS exports
- Node.js LTS support
- Synchronous lookup API
- Provider object structure

**May Change**:

- Internal caching strategy
- Error handling details
- Diagnostic output format
- Build tooling

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-21  
**Status:** Draft for Review
