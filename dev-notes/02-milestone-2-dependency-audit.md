# Milestone 2: Dependency Audit

**Date:** 16 February 2026  
**Milestone:** M2 — Reduce Dependencies  
**Status:** Complete

---

## Summary

Milestone 2 focused on reducing external dependencies by replacing third-party HTTP libraries with native Node.js capabilities and auditing remaining dependencies.

### Key Changes

1. **Replaced `superagent` with native `fetch`**
   - Removed superagent dependency entirely
   - Migrated `secure-http-client.js` to use Node.js native fetch API (v18+)
   - Native fetch provides strict HTTPS certificate validation by default
   - No functionality lost; all security features maintained

2. **Updated all providers using secure-http-client**
   - All providers already migrated to new API
   - Verified compatibility via test suite (122/122 tests passing)
   - Providers affected:
     - stripe-api.js (fetchJSON)
     - stripe-webhooks.js (fetchJSON)
     - seobility.js (fetchText)
     - gtmetrix.js (fetchXML)
     - googlebot.js (fetchJSON)
     - checksum-verifier.js (calculateSHA256)

3. **Dependency audit results**
   - **fast-xml-parser** (^5.3.2) — **KEEP**: Used by gtmetrix provider for parsing XML location data
   - **ipaddr.js** (^2.0.1) — **KEEP**: Core dependency for IP address parsing and CIDR range handling; used in index.js and multiple providers

4. **Security audit**
   - `npm audit` reports 0 vulnerabilities
   - All dependencies up to date

---

## Dependency Rationale

### fast-xml-parser

**Status:** Required  
**Used by:** src/providers/gtmetrix.js

GTmetrix provides server location data via XML feed. This parser is necessary to extract IP addresses from the structured XML response. No suitable replacement in Node.js stdlib.

**Usage:**

```javascript
import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser();
const gtmetrixData = parser.parse(xmlBody.toString());
```

### ipaddr.js

**Status:** Required  
**Used by:**

- src/index.js (core IP parsing and CIDR matching)
- src/providers/seobility.js
- src/providers/bunnynet.js
- src/providers/gtmetrix.js

This library provides robust IP address validation, parsing, and CIDR range matching for both IPv4 and IPv6. It's fundamental to the library's core functionality. While Node.js has some IP utilities, ipaddr.js provides more comprehensive CIDR support and consistent API across versions.

---

## Removed Dependencies

- **superagent** — Replaced with native fetch (Node.js 18+)

---

## Testing

All 122 tests pass after dependency changes:

- Unit tests: ✓
- Integration tests: ✓
- Provider-specific tests: ✓
- Edge case tests: ✓

Coverage: 55.52% (baseline; targeted improvement deferred to M3b)

---

## Recommendations for Future Milestones

1. Continue monitoring for vulnerabilities via `npm audit`
2. Revisit ipaddr.js in future Node.js versions if native IP/CIDR utilities improve
3. Keep dependency count minimal; prefer stdlib where feasible
4. Document any new dependencies with clear rationale

---

## Related Files

- src/utils/secure-http-client.js (refactored in M2)
- package.json (dependencies section)
- dev-notes/00-project-tracker.md (milestone tracking)
