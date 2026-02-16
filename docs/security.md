# Security Features

This document describes the security features implemented in trusted-network-providers to protect against malicious IP data and maintain data integrity.

## Overview

The library implements multiple layers of security for external data sources:

1. **HTTPS Certificate Validation** - Strict TLS verification for all HTTP requests
2. **Checksum Verification** - SHA-256 hashing to detect file corruption or tampering
3. **Structure Validation** - Runtime validation of data formats
4. **Timeout Protection** - Prevents hanging requests
5. **Retry Logic** - Handles transient failures gracefully

---

## HTTPS Certificate Validation

### Implementation

All HTTP requests use the centralized `secure-http-client.js` module which enforces:

- **HTTPS-only**: Non-HTTPS URLs are rejected immediately
- **Strict Certificate Validation**: Native Node.js fetch (v18+) validates certificates by default
- **Modern TLS**: Fetch uses the system's TLS stack with modern cipher suites
- **Certificate Errors**: Expired, untrusted, or self-signed certificates are rejected

### v2.0 Migration Note

**Prior to v2.0** (using superagent):
- Required explicit `https.Agent` configuration
- Manual TLS version and certificate validation settings

**v2.0+ (using native fetch)**:
- No configuration needed — strict certificate validation is enabled by default
- Fetch inherits TLS settings from Node.js runtime
- Simplified codebase with fewer dependencies
- See Milestone 2 notes for migration details

### Error Handling

Certificate validation errors are detected and reported:

```
SSL certificate validation failed for https://example.com: CERT_HAS_EXPIRED
```

Certificate errors that abort requests without retry:
- `CERT_HAS_EXPIRED` - Certificate has expired
- `CERT_UNTRUSTED` - Certificate chain not trusted
- `DEPTH_ZERO_SELF_SIGNED_CERT` - Self-signed certificate

---

## Checksum Verification

### SHA-256 Checksums

The library uses SHA-256 hashing to verify data integrity for bundled assets.

### Checksum Storage

Checksums are stored in `src/assets/checksums.json`:

```json
{
  "providers": {
    "googlebot": {
      "url": "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
      "sha256": "1cc6d5f5326ed3914308f0c2cdc35a4cfaee69d5d853dbe273ac187920315346",
      "comment": "Bundled asset - checksum verified on load"
    }
  },
  "lastUpdated": "2025-11-21T20:06:42Z"
}
```

### Verification Process

#### Bundled Assets (Googlebot, BunnyNet)

1. Asset loaded from `src/assets/` directory
2. SHA-256 checksum calculated
3. Compared against expected checksum in `checksums.json`
4. Mismatch logged as warning (non-blocking)

**Example:**

```javascript
const { verifyAssetChecksum } = require('./utils/checksum-verifier');

// Verify bundled asset
const assetPath = path.join(__dirname, '../assets/googlebot-ips.json');
verifyAssetChecksum(assetPath, 'googlebot', false);
```

#### Runtime Downloads (Stripe APIs)

For APIs that change frequently, structure validation is used instead:

```javascript
const verifyStructure = (data) => {
  return (
    data &&
    data.API &&
    Array.isArray(data.API) &&
    data.API.length > 0 &&
    data.API.every((ip) => typeof ip === 'string' && ip.match(/^\d+\.\d+\.\d+\.\d+$/))
  );
};

const data = await fetchJSON(url, { verifyStructure });
```

### Updating Checksums

Checksums are automatically updated when running `scripts/update-assets.sh`:

```bash
./scripts/update-assets.sh
```

This script:

1. Downloads latest assets from provider sources
2. Validates JSON format
3. Calculates SHA-256 checksums
4. Updates `checksums.json` with new values

**Manual Checksum Calculation:**

```bash
sha256sum src/assets/googlebot-ips.json
```

---

## Structure Validation

### Purpose

For providers whose data changes frequently (like Stripe), structure validation ensures the response format is correct without requiring exact checksums.

### Implementation

```javascript
const verifyStructure = (data) => {
  // Validate expected structure
  return (
    data &&
    data.WEBHOOKS &&
    Array.isArray(data.WEBHOOKS) &&
    data.WEBHOOKS.length > 0 &&
    // Validate each IP is a valid format
    data.WEBHOOKS.every((ip) => typeof ip === 'string' && ip.match(/^\d+\.\d+\.\d+\.\d+$/))
  );
};
```

### Providers Using Structure Validation

- **Stripe API** - `ips_api.json`
- **Stripe Webhooks** - `ips_webhooks.json`

---

## Timeout Protection

### Default Configuration

```javascript
const DEFAULT_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 2, // 2 retry attempts
  retryDelay: 1000, // 1 second between retries
  strictSSL: true, // Enforce certificate validation
};
```

### Timeout Types

- **Response Timeout**: 30 seconds to receive first byte
- **Deadline Timeout**: 35 seconds total request time

### Custom Timeouts

For large files (like GTmetrix XML):

```javascript
const xmlBody = await fetchXML(url, {
  timeout: 60000, // 1 minute for large XML files
});
```

---

## Retry Logic

### Retry Strategy

- **Exponential Backoff**: Delay increases with each retry (1s, 2s, 3s...)
- **Transient Errors**: Network failures are retried
- **Fatal Errors**: Certificate validation failures are not retried

### Non-Retryable Errors

- HTTP 401, 403, 404 (client errors)
- Certificate validation failures
- `CERT_HAS_EXPIRED`
- `CERT_UNTRUSTED`
- `DEPTH_ZERO_SELF_SIGNED_CERT`

---

## Security Best Practices

### For Library Users

1. **Run Update Script Regularly**

   ```bash
   ./scripts/update-assets.sh
   ```

   Updates bundled assets and checksums before each release.

2. **Monitor Warnings**
   Checksum mismatches are logged as warnings:

   ```
   Warning: Checksum mismatch for googlebot at ...
   Expected: abc123...
   Got:      def456...
   ```

3. **Review Changes**
   Check git diff after running update-assets.sh to see what changed.

4. **Use HTTPS Only**
   Never configure custom providers with HTTP URLs.

### For Custom Providers

When adding custom providers:

```javascript
// ✅ Good - HTTPS with structure validation
const myProvider = {
  name: 'My Service',
  reload: async () => {
    const verifyStructure = (data) => {
      return data && Array.isArray(data.ips) && data.ips.length > 0;
    };

    const data = await fetchJSON('https://api.example.com/ips', {
      verifyStructure,
      timeout: 30000,
    });

    // Process data...
  },
};

// ❌ Bad - HTTP URL
const badProvider = {
  reload: () => fetchJSON('http://insecure.example.com/ips'),
  // This will throw: "Insecure URL rejected"
};
```

---

## Input Validation & Resource Limits

### Overview

v2.0 introduces input validation and resource limits to prevent denial-of-service attacks and unbounded memory growth.

### Provider Limits

**Maximum Providers**: 100

Prevents registration of excessive providers that could exhaust memory or slow down lookups.

```javascript
const MAX_PROVIDERS = 100;

// Enforced during provider registration
if (currentProviderCount >= MAX_PROVIDERS) {
  throw new Error(`Maximum provider limit reached (${MAX_PROVIDERS}). Cannot add provider: ${provider.name}`);
}
```

**Maximum IPs Per Provider**: 10,000

Limits the total number of IP addresses and CIDR ranges per provider (combined IPv4 and IPv6).

```javascript
const MAX_IPS_PER_PROVIDER = 10000;

const totalIps = 
  (provider.ipv4?.addresses?.length || 0) +
  (provider.ipv4?.ranges?.length || 0) +
  (provider.ipv6?.addresses?.length || 0) +
  (provider.ipv6?.ranges?.length || 0);

if (totalIps > MAX_IPS_PER_PROVIDER) {
  throw new Error(
    `Provider "${provider.name}" exceeds maximum IP limit (${MAX_IPS_PER_PROVIDER}). Total IPs: ${totalIps}`
  );
}
```

### CIDR Validation

All CIDR ranges are validated before accepting provider data:

```javascript
import ipaddr from 'ipaddr.js';

if (provider.ipv4?.ranges) {
  for (const range of provider.ipv4.ranges) {
    if (!ipaddr.isValidCIDR(range)) {
      throw new Error(`Invalid IPv4 CIDR range in provider "${provider.name}": ${range}`);
    }
  }
}

if (provider.ipv6?.ranges) {
  for (const range of provider.ipv6.ranges) {
    if (!ipaddr.isValidCIDR(range)) {
      throw new Error(`Invalid IPv6 CIDR range in provider "${provider.name}": ${range}`);
    }
  }
}
```

### Cache Limits (Memory Protection)

**Parsed Address Cache**: 5,000 entries (LRU)

Caches parsed CIDR ranges to avoid re-parsing. Least Recently Used (LRU) eviction prevents unbounded growth.

```javascript
const MAX_PARSED_ADDRESSES = 5000;
const parsedAddresses = new LRUCache(MAX_PARSED_ADDRESSES);
```

**Result Cache**: 10,000 entries (LRU + TTL)

Caches IP lookup results with Time-To-Live (TTL) expiration. Default TTL: 1 hour.

```javascript
const MAX_CACHED_RESULTS = 10000;
const DEFAULT_RESULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const resultCache = new TTLCache(MAX_CACHED_RESULTS, resultCacheTtlMs);
```

### Security Benefits

1. **DoS Protection**: Limits prevent malicious providers from consuming excessive memory or CPU
2. **Resource Predictability**: Maximum memory usage is bounded and predictable
3. **Validation**: Invalid CIDR ranges are rejected early, preventing runtime errors
4. **Cache Poisoning Mitigation**: Cache size limits reduce the impact of cache poisoning attacks

### Attack Scenarios Mitigated

**Scenario 1: Malicious Provider Registration**

An attacker attempts to register a provider with 1 million IP addresses to exhaust memory.

```javascript
// This will be rejected:
const maliciousProvider = {
  name: 'evil',
  ipv4: {
    ranges: Array(1000000).fill('0.0.0.0/0'),
  },
};

// Throws: Provider "evil" exceeds maximum IP limit (10000). Total IPs: 1000000
```

**Scenario 2: Invalid CIDR Exploitation**

An attacker provides malformed CIDR ranges to crash the parser.

```javascript
// This will be rejected:
const badProvider = {
  name: 'bad',
  ipv4: {
    ranges: ['256.256.256.256/99', 'not-an-ip'],
  },
};

// Throws: Invalid IPv4 CIDR range in provider "bad": 256.256.256.256/99
```

**Scenario 3: Cache Exhaustion**

An attacker floods the system with unique IPs to fill the cache.

```javascript
// Only the 10,000 most recent lookups are cached
// Older entries are evicted automatically (LRU)
// Impact: Limited to MAX_CACHED_RESULTS memory usage
```

---

## Threat Model

### Threats Addressed

1. ✅ **Man-in-the-Middle Attacks**
   - Mitigated by HTTPS certificate validation (native fetch strict mode)
   - Modern TLS encryption enforced by Node.js runtime

2. ✅ **File Corruption**
   - Detected by SHA-256 checksum verification
   - Logged as warnings

3. ✅ **Data Tampering**
   - Bundled assets verified on load
   - Runtime downloads validated structurally

4. ✅ **Malformed Data**
   - Structure validation catches format errors
   - CIDR validation rejects invalid ranges
   - Type checking for all IP addresses

5. ✅ **Hanging Requests**
   - 30-second timeout prevents resource exhaustion
   - Retry logic with exponential backoff handles transient failures

6. ✅ **Denial-of-Service via Oversized Provider Data** (v2.0+)
   - Maximum 100 providers can be registered
   - Maximum 10,000 IPs per provider enforced
   - Invalid data rejected at registration time

7. ✅ **Memory Exhaustion** (v2.0+)
   - LRU cache limits for parsed addresses (5,000 entries)
   - TTL + LRU cache limits for IP lookups (10,000 entries)
   - Predictable, bounded memory usage

### Threats NOT Addressed

1. ❌ **DNS Poisoning**
   - No DNSSEC validation (see DNS-based providers)
   - Consider using bundled assets in high-security environments

2. ❌ **Compromised Provider Sources**
   - If official provider API is compromised, we fetch malicious data
   - Mitigation: Regular security audits, structure validation limits impact

3. ❌ **Time-of-Check to Time-of-Use (TOCTOU)**
   - Checksums verified at load time, could change during execution
   - Low risk: assets loaded once at startup

---

## DNS-Based Providers

### Overview

Some providers (Google Workspace, Mailgun) fetch IP addresses from DNS SPF (Sender Policy Framework) records. While this provides up-to-date information, it introduces additional security considerations.

**Affected Providers:**

- **Google Workspace** - Queries `_spf.google.com`
- **Mailgun** - Queries `mailgun.org`

### Security Limitations

#### No DNSSEC Validation

**The Problem:**

- Node.js built-in `dns` module does NOT support DNSSEC validation
- DNS responses are not cryptographically verified
- Attackers could inject false IP ranges via DNS poisoning

**Why Not Implement DNSSEC?**

1. **Node.js Limitation**: Native DNS module lacks DNSSEC support
2. **Complexity**: External DNSSEC libraries (e.g., `dnssecjs`) add significant complexity
3. **Dependencies**: Would require native bindings or complex JavaScript implementations
4. **Maintenance Burden**: DNSSEC spec is complex and evolving
5. **Resolver Dependency**: Even with validation, you trust your recursive resolver

**Industry Context:**

- Most applications using Node.js DNS don't validate DNSSEC
- Major cloud providers recommend DNSSEC-validating resolvers instead
- Defense-in-depth approach is more practical than perfect validation

### Attack Scenarios

#### 1. DNS Cache Poisoning

**Attack:** Malicious actor injects false DNS records into resolver cache.

**Impact:** Application accepts fake IP addresses as trusted.

**Example:**

```
Legitimate: _spf.google.com -> ip4:35.190.247.0/24
Poisoned:   _spf.google.com -> ip4:198.51.100.0/24 (attacker's IPs)
```

**Probability:** Low (modern resolvers have randomization, but possible)

#### 2. Man-in-the-Middle on DNS

**Attack:** Attacker intercepts DNS queries and returns false responses.

**Impact:** Application trusts attacker's IP ranges.

**Probability:** Low on trusted networks, higher on public WiFi

#### 3. Compromised Recursive Resolver

**Attack:** DNS resolver itself is compromised.

**Impact:** All DNS responses could be malicious.

**Probability:** Very low for major providers (Google DNS, Cloudflare), higher for untrusted resolvers

### Mitigations

#### Option 1: Use Bundled Assets (Recommended for High Security)

Instead of runtime DNS lookups, fetch SPF records at build time:

```bash
# During your build/deployment process
./scripts/update-assets.sh

# This fetches DNS records and stores them as bundled assets
git add src/assets/
git commit -m "Update provider assets"
```

**Advantages:**

- No runtime DNS dependency
- Assets verified with checksums
- Reproducible builds
- No DNS poisoning risk at runtime

**Disadvantages:**

- Must update periodically
- Slightly stale data (but providers rarely change IPs)

**Implementation:**
To disable runtime DNS for Google Workspace, modify the provider to load from a bundled asset instead of calling `spfAnalyser()`.

#### Option 2: Use DNSSEC-Validating DNS Resolvers

Configure your system to use resolvers that perform DNSSEC validation:

**Cloudflare DNS (1.1.1.1):**

```bash
# /etc/resolv.conf
nameserver 1.1.1.1
nameserver 1.0.0.1
```

**Google Public DNS (8.8.8.8):**

```bash
# /etc/resolv.conf
nameserver 8.8.8.8
nameserver 8.8.4.4
```

**Advantages:**

- Transparent to application
- Resolver validates DNSSEC chains
- Easy to implement

**Disadvantages:**

- Trust is moved to the resolver
- Application doesn't control validation
- Resolver could be compromised or MitM'd

#### Option 3: Out-of-Band Verification

Manually verify DNS records through multiple channels:

```bash
# Query multiple resolvers
dig @1.1.1.1 _spf.google.com TXT +dnssec
dig @8.8.8.8 _spf.google.com TXT +dnssec
dig @9.9.9.9 _spf.google.com TXT +dnssec  # Quad9

# Check DNSSEC validation
dig @1.1.1.1 _spf.google.com TXT +dnssec | grep "ad"  # Authenticated Data flag
```

If all return the same results and show DNSSEC validation (AD flag), confidence increases.

#### Option 4: Network-Level Security

Deploy application in secure network environment:

- Private VPC with controlled DNS resolvers
- Network segmentation
- DNS query logging and monitoring
- Intrusion detection systems

#### Option 5: Rate of Change Monitoring

Monitor for unexpected changes in DNS responses:

```javascript
// Pseudocode
const previousIPs = loadPreviousIPList();
const currentIPs = await fetchFromDNS();

if (calculateDifference(previousIPs, currentIPs) > THRESHOLD) {
  alertSecurityTeam();
  useBackupData(previousIPs);
}
```

This detects sudden, large changes that might indicate poisoning.

### Best Practices

#### For Production Deployments

1. **Use Bundled Assets**
   - Run `update-assets.sh` before each deployment
   - Commit assets to version control
   - Disable runtime DNS lookups in production

2. **Configure Trusted DNS Resolvers**
   - Use Cloudflare (1.1.1.1) or Google (8.8.8.8)
   - Ensure resolvers perform DNSSEC validation
   - Test with `dig +dnssec`

3. **Monitor for Changes**
   - Log when provider IPs change
   - Alert on unexpected changes
   - Review changes before accepting

4. **Update Regularly**
   - Schedule weekly or monthly asset updates
   - Review changes in git diff
   - Test before deploying

#### For Development

1. **Accept DNS Limitations**
   - Runtime DNS lookups are acceptable for development
   - Faster iteration without build steps

2. **Test with Production Assets**
   - Periodically test with bundled assets
   - Verify behavior matches runtime DNS

3. **Document Dependencies**
   - Note reliance on DNS resolver
   - Document security tradeoffs

### Configuration Options

#### Disable Runtime DNS (Future Enhancement)

Potential configuration to disable DNS-based providers:

```javascript
// Future API (not yet implemented)
trustedProviders.configure({
  disableDNSLookups: true, // Only use bundled assets
  strictMode: true, // Fail if DNS provider can't load
});
```

This would skip providers that require DNS and use only HTTP/bundled sources.

### Testing DNSSEC

#### Check if Your Resolver Validates DNSSEC

```bash
# Query a domain with broken DNSSEC
dig sigfail.verteiltesysteme.net @1.1.1.1

# If DNSSEC is working, you should get SERVFAIL
# If you get an IP address, DNSSEC is not being validated
```

#### Verify SPF Record Signatures

```bash
# Get SPF record with DNSSEC
dig _spf.google.com TXT +dnssec @1.1.1.1

# Look for:
# - RRSIG records (signatures)
# - AD flag in response (authenticated data)
```

Example output:

```
;; flags: qr rd ra ad; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1
                       ^^ AD flag indicates DNSSEC validation succeeded
```

### Alternative: Implement DNSSEC (Not Recommended)

For completeness, here's why we didn't implement DNSSEC validation:

#### Option A: Native DNSSEC Library

**Library:** `getdns` (Node.js bindings)

```javascript
// Requires native compilation
const getdns = require('getdns');

const context = getdns.createContext({
  resolution_type: getdns.RESOLUTION_STUB,
  dnssec_trust_anchors: '/etc/unbound/root.key',
});
```

**Problems:**

- Requires native compilation (C library)
- Platform-specific dependencies
- Complex build process
- Limited cross-platform support
- Maintenance burden

#### Option B: Pure JavaScript DNSSEC

**Library:** `dnssecjs` or similar

**Problems:**

- Incomplete implementations
- Performance overhead
- Still requires trust anchor management
- Rarely maintained
- Complex cryptographic operations in JS

#### Option C: External DNSSEC Resolver

**Service:** Query a DNSSEC-validating DNS-over-HTTPS provider

```javascript
// Query Cloudflare DNS-over-HTTPS with DNSSEC
const response = await fetch('https://1.1.1.1/dns-query?name=_spf.google.com&type=TXT', {
  headers: { Accept: 'application/dns-json' },
});
```

**Problems:**

- Adds HTTP dependency for DNS
- Trust moved to DoH provider
- Additional latency
- Complexity without clear benefit

### Conclusion

**Current Approach:**

- Document limitations clearly
- Recommend trusted DNS resolvers
- Provide bundled asset workflow
- Accept reasonable risk for most use cases

**Future Enhancements:**

- Add configuration to disable DNS providers
- Add change detection and alerting
- Implement bundled asset fallback
- Monitor for suspicious DNS responses

For most deployments, using DNSSEC-validating resolvers (1.1.1.1, 8.8.8.8) and bundling assets at build time provides sufficient security without the complexity of implementing DNSSEC validation in-application.

---

## Audit Trail

### Checksum Updates

The `checksums.json` file includes:

```json
{
  "lastUpdated": "2025-11-21T20:06:42Z"
}
```

Track when checksums were last updated.

### Git History

All checksum updates should be committed to git:

```bash
git add src/assets/checksums.json src/assets/*.json
git commit -m "Update provider assets and checksums"
```

Review changes before committing:

```bash
git diff src/assets/checksums.json
```

---

## Testing Security Features

### Manual Checksum Verification

Test checksum detection:

```bash
# Calculate current checksum
sha256sum src/assets/googlebot-ips.json

# Compare with stored checksum
cat src/assets/checksums.json | jq '.providers.googlebot.sha256'
```

### Simulate Corruption

```bash
# Backup original
cp src/assets/googlebot-ips.json googlebot-ips.json.backup

# Corrupt file
echo '{"corrupted": true}' > src/assets/googlebot-ips.json

# Run tests - should see warning
npm run test

# Restore
mv googlebot-ips.json.backup src/assets/googlebot-ips.json
```

Expected output:

```
Warning: Checksum mismatch for googlebot at ...
Expected: 1cc6d5f5...
Got:      a25ce3f1...
```

### Test HTTPS Enforcement

```javascript
// This will throw an error
const { fetchJSON } = require('./src/utils/secure-http-client');
await fetchJSON('http://insecure.example.com/data.json');
// Error: Insecure URL rejected: http://... Only HTTPS URLs are allowed.
```

---

## Configuration Options

### Checksum Verification Mode

Currently checksum mismatches are warnings (non-blocking). To make them blocking:

```javascript
// In checksum-verifier.js
verifyAssetChecksum(assetPath, 'googlebot', true); // strict=true
```

With `strict=true`, checksum mismatches throw errors and stop execution.

### Disable Certificate Validation (NOT AVAILABLE in v2.0+)

**Prior to v2.0**: The superagent-based client supported a `strictSSL: false` option.

**v2.0+**: Native fetch does not support disabling certificate validation via fetch options. This is a security feature — certificate validation cannot be accidentally disabled.

For local testing with self-signed certificates, use Node.js environment variables (not recommended for production):

```bash
# Development/testing only — bypasses certificate validation globally
NODE_TLS_REJECT_UNAUTHORIZED=0 node your-script.js
```

⚠️ **Never use in production!** This affects all HTTPS connections, not just this library.

---

## Future Enhancements

Potential security improvements for future versions:

1. **DNSSEC Validation**
   - Validate DNS responses with DNSSEC for SPF-based providers
   - Requires DNSSEC-aware DNS library or DoH integration

2. **Provider Signatures**
   - Support for cryptographically signed data from providers
   - Public key verification for provider API responses

3. **Fallback to Bundled Assets**
   - If remote fetch fails validation, automatically use bundled version
   - Configuration option for strict mode (fail-closed vs. fail-open)

4. **Air-Gapped Mode**
   - Disable all external fetches at initialization
   - Use only bundled assets
   - Useful for high-security deployments

5. **Enhanced Security Monitoring**
   - Export security events (checksum failures, validation errors)
   - Integration with structured logging frameworks
   - Prometheus-compatible metrics for checksum/validation failures

**Implemented in v2.0**:
- ✅ Input validation and resource limits
- ✅ Memory exhaustion protection via LRU caches
- ✅ CIDR validation at registration time
- ✅ Native fetch with strict certificate validation

---

## References

- [OWASP Transport Layer Protection](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
- [SHA-256 Hashing](https://en.wikipedia.org/wiki/SHA-2)
- [TLS Best Practices](https://wiki.mozilla.org/Security/Server_Side_TLS)
- [Node.js HTTPS Module](https://nodejs.org/api/https.html)

---

**Last Updated:** 2026-02-16  
**Version:** 2.0
