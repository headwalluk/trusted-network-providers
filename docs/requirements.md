# Requirements Document

## Project Overview

**Project Name:** Trusted Network Providers  
**Package:** `@headwall/trusted-network-providers`  
**Version:** 1.8.2  
**Purpose:** Provide a lightweight, extensible library for identifying whether an IP address belongs to a trusted network provider.

## Target Audience

### Primary Users

- WordPress hosting network administrators
- Firewall configuration managers
- Security system developers
- Web application developers implementing IP-based access controls

### Use Cases

- **Firewall Whitelisting**: Prevent blocking legitimate service IPs (payment processors, crawlers, monitoring tools)
- **Access Control**: Allow trusted services to bypass rate limiting or authentication
- **Security Logging**: Identify and categorize traffic sources
- **Compliance**: Maintain trusted partner network configurations

### User Needs

- Avoid accidentally blocking critical services (Google crawlers, Stripe webhooks, payment processors)
- Maintain up-to-date IP ranges from providers that change frequently
- Quick, synchronous lookup of IP addresses during request processing
- Support for both IPv4 and IPv6 addresses
- Ability to add custom trusted networks specific to their infrastructure

## Functional Requirements

### FR-1: IP Address Lookup

**Priority:** Critical  
**Description:** Given an IP address (IPv4 or IPv6), determine if it belongs to a trusted provider.

**Acceptance Criteria:**

- Support IPv4 addresses in standard dotted decimal notation (e.g., `192.168.1.1`)
- Support IPv6 addresses in standard colon-hexadecimal notation (e.g., `2001:db8::1`)
- Return provider name if IP is trusted, `null` if not
- Handle both individual IP addresses and CIDR ranges
- Gracefully handle malformed IP addresses without crashing

**API:**

```javascript
getTrustedProvider(ipAddress: string): string | null
isTrusted(ipAddress: string): boolean
```

### FR-2: Provider Management

**Priority:** Critical  
**Description:** Manage a collection of trusted network providers with their associated IP ranges.

**Acceptance Criteria:**

- Load default built-in providers (Googlebot, Stripe, PayPal, Cloudflare, etc.)
- Add custom providers at runtime
- Remove providers by name
- Query if a specific provider exists
- Retrieve list of all loaded providers

**API:**

```javascript
loadDefaultProviders(): void
addProvider(provider: Provider): void
deleteProvider(providerName: string): void
hasProvider(providerName: string): boolean
getAllProviders(): Provider[]
```

### FR-3: Provider Data Structure

**Priority:** Critical  
**Description:** Standardized structure for defining trusted network providers.

**Provider Schema:**

```javascript
{
  name: string,                    // Unique identifier for the provider
  testAddresses: string[],         // Sample IPs for validation (optional)
  reload: () => Promise,           // Function to update IP list (optional)
  ipv4: {
    addresses: string[],           // Individual IPv4 addresses
    ranges: string[]               // CIDR ranges (e.g., '10.0.0.0/8')
  },
  ipv6: {
    addresses: string[],           // Individual IPv6 addresses
    ranges: string[]               // CIDR ranges (e.g., '2001:db8::/32')
  }
}
```

### FR-4: Dynamic Provider Updates

**Priority:** High  
**Description:** Support providers that need to update their IP lists from external sources.

**Acceptance Criteria:**

- Providers can implement optional `reload()` function
- `reloadAll()` triggers updates for all providers with reload capability
- Support both single promises and arrays of promises from reload functions
- Continue operation if individual provider reload fails
- Load from both static JSON assets and external HTTP endpoints

**API:**

```javascript
reloadAll(): Promise<void>
```

**Supported Update Methods:**

- HTTP JSON endpoints (Googlebot, Stripe)
- DNS SPF record parsing (Outlook, Mailgun, Brevo)
- Static bundled JSON files (BunnyNet, FacebookBot)
- Hardcoded CIDR ranges (Cloudflare, Private networks)

### FR-5: Built-in Provider Support

**Priority:** High  
**Description:** Include commonly needed trusted providers out of the box.

**Required Providers:**

- **Search Engines:** Googlebot, AhrefsBot, SemrushBot, Seobility
- **Social Media:** FacebookBot
- **Payment Processors:** Stripe (API & Webhooks), PayPal, Opayo
- **Email Services:** Outlook, Brevo, Mailgun
- **Infrastructure:** Cloudflare, BunnyNet (CDN)
- **Development Tools:** GTmetrix, GetTerms, Labrika
- **E-commerce:** ShipHero
- **Google Services:** Google Workspace, Google Services (DNS)
- **Network Types:** Private/Internal networks (RFC 1918)

### FR-6: Testing & Validation

**Priority:** High  
**Description:** Validate that provider configurations are working correctly.

**Acceptance Criteria:**

- Each provider should specify test addresses
- `runTests()` validates all providers against their test addresses
- Test unknown IPs to ensure they return `null`
- Display clear pass/fail results
- Support diagnostic mode for debugging

**API:**

```javascript
runTests(): Promise<void>
setLogLevel('debug') // Enable verbose output
```

### FR-7: IPv4 and IPv6 Support

**Priority:** Critical  
**Description:** Full support for both IPv4 and IPv6 addressing.

**Acceptance Criteria:**

- Parse and validate both IPv4 and IPv6 addresses
- Support CIDR notation for both address families
- Correctly match addresses against mixed ranges
- Handle IPv6 compressed notation (`::`)\*\*

### FR-8: Performance Requirements

**Priority:** Medium  
**Description:** Efficient lookup performance for production use.

**Acceptance Criteria:**

- Lookup should complete in < 10ms for typical provider lists
- Support at least 50 providers without degradation
- Cache parsed CIDR ranges to avoid re-parsing
- Minimize memory footprint during operation

## Non-Functional Requirements

### NFR-1: Ease of Use

- Simple, intuitive API with minimal configuration
- Works with plain `require()` in Node.js
- Clear documentation with code examples
- Sensible defaults (built-in providers)

### NFR-2: Extensibility

- Easy to add custom providers
- Support for dynamic IP list updates
- No hard-coded limits on number of providers
- Plugin-friendly architecture

### NFR-3: Reliability

- Handle network failures gracefully during reloads
- Continue operating with stale data if updates fail
- No crashes from malformed input
- Fail safely (deny access rather than allow on error)

### NFR-4: Maintainability

- Clear code structure with separation of concerns
- Each provider in its own module
- Consistent patterns across provider implementations
- Documented asset update process

### NFR-5: Compatibility

- Node.js compatibility (current LTS and previous LTS)
- No browser-specific code
- Minimal dependencies
- MIT license for broad usage

### NFR-6: Security

- Validate external data sources
- No arbitrary code execution
- Limit resource consumption during operations
- Clear trust boundaries

## Out of Scope

The following are explicitly **not** requirements for this project:

- **Authentication/Authorization**: This library only identifies IPs, doesn't enforce access rules
- **Browser Support**: Server-side only, no client-side JavaScript
- **Real-time Updates**: No automatic background refresh (user must call `reloadAll()`)
- **Reverse DNS Verification**: Only IP matching, no hostname verification
- **Geographic IP Location**: Not a geolocation service
- **IP Reputation Scoring**: Binary trusted/untrusted, no risk scoring
- **Persistent Storage**: No database or file-based caching
- **Web Interface**: CLI/programmatic only
- **Logging Infrastructure**: Basic console logging only

## Integration Requirements

### Installation

- Must be installable via npm
- Must work with standard Node.js `require()` statements
- Must not require build steps or compilation

### Startup Behavior

- Application must call `loadDefaultProviders()` to enable built-in providers
- Application must call `reloadAll()` to initialize dynamic providers
- Must be ready for lookups after initialization completes

### Runtime Usage

- Must support synchronous IP lookups during request handling
- Must allow periodic updates via `reloadAll()` without service interruption
- Must not block application threads during IP matching

### Update Strategy

- Dynamic providers should be refreshed periodically (recommended: 24 hours)
- Static asset updates should be performed before version releases
- Failed updates should not break existing functionality

## Success Criteria

The project is successful when:

1. ✅ Users can prevent false-positive blocks of legitimate services
2. ✅ IP lookups are fast enough for production request handling
3. ✅ Provider lists stay reasonably up-to-date
4. ✅ Adding custom providers requires minimal code
5. ✅ The library has minimal impact on application performance
6. ✅ Maintenance burden is low (infrequent updates needed)

## Known Limitations

Based on current implementation:

1. **Synchronous Lookup, Async Updates**: IP lookups are synchronous, but provider updates are async
2. **No Auto-refresh**: Applications must implement their own scheduling for `reloadAll()`
3. **Memory Storage Only**: No persistence between application restarts
4. **First Match Wins**: Provider order matters; first matching provider is returned
5. **No Partial Loads**: `reloadAll()` must complete before reliable lookups
6. **Console Logging Only**: Limited logging infrastructure
7. **No DNSSEC**: DNS-based providers vulnerable to DNS poisoning
8. **No HTTP Verification**: External JSON sources not integrity-checked

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-21  
**Status:** Draft for Review
