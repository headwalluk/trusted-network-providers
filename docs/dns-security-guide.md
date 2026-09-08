# DNS Security Guide

This guide helps you understand and mitigate DNS security risks when using trusted-network-providers.

## Quick Start: Securing DNS-Based Providers

If you're using the Google Workspace provider — or Mailgun, which ships
disabled and has to be registered deliberately — follow these steps.

### For Production (Recommended)

Point the host at a DNSSEC-validating resolver (below), or drop the provider
entirely if you don't need it:

```javascript
trustedProviders.loadDefaultProviders();
trustedProviders.deleteProvider('Google Workspace');
await trustedProviders.reloadAll();
```

With it unregistered, the library makes no DNS queries at all — every remaining
provider is static or fetched over HTTPS.

> **`./scripts/update-assets.sh` does not help here.** It refreshes the bundled
> assets listed in [providers.md](providers.md), and the SPF-based providers are
> not among them. Bundling their data would take the work sketched under
> _Solution 1_ below, which is a proposal, not something the package does today.

### For Development

Use DNSSEC-validating DNS resolvers:

```bash
# Configure Cloudflare DNS (recommended)
echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
echo "nameserver 1.0.0.1" | sudo tee -a /etc/resolv.conf
```

---

## Understanding the Risk

### What Providers Are Affected?

Only providers that use DNS SPF lookups:

- ✅ **Google Workspace** - Uses DNS (registered by default)
- ✅ **Mailgun** - Uses DNS (**disabled by default**; only affects you if you
  register it yourself)

These providers are NOT affected:

- ❌ **Googlebot** - Uses bundled JSON (checksummed)
- ❌ **Stripe** - Uses HTTPS API (certificate validated)
- ❌ **Cloudflare** - Hardcoded ranges
- ❌ **BunnyNet** - Uses bundled JSON (checksummed)
- ❌ All other providers - Use HTTPS or static data

### What Could Go Wrong?

**Scenario:** DNS poisoning attack injects fake IP ranges

**Before attack:**

```javascript
const provider = trustedProviders.getTrustedProvider('35.190.247.1');
console.log(provider); // "Google Workspace" ✅ Correct
```

**After attack (DNS poisoned):**

```javascript
const provider = trustedProviders.getTrustedProvider('198.51.100.1');
console.log(provider); // "Google Workspace" ❌ Attacker's IP!
```

**Impact:** Attacker's IPs bypass your firewall/rate limiting.

**Likelihood:** Low but not zero, especially on untrusted networks.

---

## Solution 1: Bundled Assets (Best Security)

> **Status: proposal, not a feature.** The SPF providers have no bundled-asset
> support today. This section sketches what adding it would involve, for anyone
> who needs it in their own fork or in a custom provider. Nothing below works
> out of the box.

### How It Would Work

1. `update-assets.sh` resolves the SPF records at build time
2. Records stored as JSON files with SHA-256 checksums
3. Application loads from disk, not DNS
4. No runtime DNS = No DNS poisoning risk

### Implementation

#### Create Bundled Asset for Google Workspace

```javascript
// src/providers/google-workspace.js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyAssetChecksum } from '../utils/checksum-verifier.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const self = {
  name: 'Google Workspace',
  testAddresses: ['216.58.192.190'],

  // Load from bundled asset instead of DNS
  reload: async () => {
    const assetPath = path.join(currentDirectory, '../assets/google-workspace-ips.json');
    await verifyAssetChecksum(assetPath, 'google-workspace', false);

    const data = JSON.parse(await readFile(assetPath, 'utf8'));

    self.ipv4.addresses.length = 0;
    self.ipv4.ranges.length = 0;
    self.ipv6.addresses.length = 0;
    self.ipv6.ranges.length = 0;

    self.ipv4.addresses.push(...data.ipv4.addresses);
    self.ipv4.ranges.push(...data.ipv4.ranges);
    self.ipv6.addresses.push(...data.ipv6.addresses);
    self.ipv6.ranges.push(...data.ipv6.ranges);
  },

  ipv4: { addresses: [], ranges: [] },
  ipv6: { addresses: [], ranges: [] },
};

export default self;
```

#### Update update-assets.sh to Fetch SPF Records

```bash
# Add to scripts/update-assets.sh

##
# Google Workspace (from SPF)
#
echo "Fetching Google Workspace IPs from DNS..."
WORKSPACE_ASSET="${SRC_DIR}/assets/google-workspace-ips.json"

# Use dig to query SPF records
dig +short _spf.google.com TXT | \
  grep "v=spf1" | \
  # Parse and extract IPs...
  # Save to JSON format
  > "${WORKSPACE_ASSET}"

# Calculate checksum
WORKSPACE_CHECKSUM=$(sha256sum "${WORKSPACE_ASSET}" | cut -d' ' -f1)
```

### Advantages

- ✅ No DNS dependency at runtime
- ✅ Checksummed for integrity
- ✅ Version controlled
- ✅ Reproducible builds
- ✅ No DNS poisoning risk

### Disadvantages

- ⚠️ Must update regularly (weekly/monthly recommended)
- ⚠️ Slightly stale data (but providers rarely change)
- ⚠️ Extra build step

---

## Solution 2: DNSSEC-Validating Resolvers

### How It Works

Use DNS resolvers that validate DNSSEC signatures:

- Resolver checks cryptographic signatures on DNS records
- Invalid/missing signatures are rejected
- Your application trusts the resolver's validation

### Setup

#### Cloudflare DNS (1.1.1.1) - Recommended

```bash
# On Linux
sudo nano /etc/resolv.conf

# Add these lines
nameserver 1.1.1.1
nameserver 1.0.0.1
```

```bash
# On macOS
sudo networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1
```

```bash
# On Windows (PowerShell as Administrator)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses ("1.1.1.1","1.0.0.1")
```

#### Google Public DNS (8.8.8.8)

```bash
# Linux/macOS
sudo nano /etc/resolv.conf

# Add these lines
nameserver 8.8.8.8
nameserver 8.8.4.4
```

#### Quad9 DNS (9.9.9.9) - Privacy-focused

```bash
# Linux/macOS
sudo nano /etc/resolv.conf

# Add these lines
nameserver 9.9.9.9
nameserver 149.112.112.112
```

### Verification

Test that DNSSEC validation is working:

```bash
# Should return SERVFAIL (broken DNSSEC)
dig sigfail.verteiltesysteme.net @1.1.1.1

# Should return an IP address (valid DNSSEC)
dig sigok.verteiltesysteme.net @1.1.1.1
```

### Advantages

- ✅ Easy to implement
- ✅ Transparent to application
- ✅ No code changes needed
- ✅ Works for all DNS queries

### Disadvantages

- ⚠️ Trusts the resolver
- ⚠️ Resolver could be compromised
- ⚠️ Application can't verify validation happened

---

## Solution 3: Hybrid Approach (Recommended)

Combine both solutions for defense in depth:

### Development

- Use DNSSEC-validating resolvers (1.1.1.1)
- Runtime DNS lookups for faster iteration

### Production

- Use bundled assets (checksummed)
- Configure DNSSEC resolvers as backup
- Monitor for unexpected changes

### Configuration

```javascript
// In your deployment config
if (process.env.NODE_ENV === 'production') {
  // Production: Use bundled assets only
  trustedProviders.loadDefaultProviders();
  await trustedProviders.reloadAll();
} else {
  // Development: Allow runtime DNS
  trustedProviders.loadDefaultProviders();
  await trustedProviders.reloadAll();
}
```

---

## Monitoring & Alerting

### Detect Unexpected Changes

Monitor provider data for suspicious changes:

```javascript
import crypto from 'node:crypto';

// Store previous state
const previousState = JSON.stringify(trustedProviders.getAllProviders());
const previousHash = crypto.createHash('sha256').update(previousState).digest('hex');

// After reload
await trustedProviders.reloadAll();

const newState = JSON.stringify(trustedProviders.getAllProviders());
const newHash = crypto.createHash('sha256').update(newState).digest('hex');

if (previousHash !== newHash) {
  console.warn('Provider data changed!');
  // Alert security team
  // Log the change
  // Require manual approval before accepting
}
```

### Log DNS Responses

Add logging to spf-analyser.js:

```javascript
// After DNS lookup
const ipRanges = extractedRanges;
console.log(`Fetched ${providerName} from DNS: ${ipRanges.length} ranges`);

// Compare with expected
if (ipRanges.length < 5 || ipRanges.length > 100) {
  console.warn(`Unexpected range count for ${providerName}: ${ipRanges.length}`);
}
```

---

## Testing Your Setup

### Test 1: Verify DNSSEC Resolver

```bash
# Should fail (broken DNSSEC)
dig sigfail.verteiltesysteme.net @1.1.1.1
# Expected: SERVFAIL status

# Should succeed (valid DNSSEC)
dig sigok.verteiltesysteme.net @1.1.1.1
# Expected: IP address returned
```

### Test 2: Verify Bundled Assets

```bash
# Check checksum matches
sha256sum src/assets/googlebot-ips.json
cat src/assets/checksums.json | jq '.providers.googlebot.sha256'

# Should be identical
```

### Test 3: Verify Runtime Behavior

```javascript
// Run with debug logging
trustedProviders.setLogLevel('debug');
await trustedProviders.reloadAll();

// Check output for DNS queries
// "🔃 Reload: Google Workspace" should appear
```

---

## FAQ

### Q: Do I need to worry about this?

**A:** If you're using Google Workspace or Mailgun providers and security is critical, yes. Otherwise, the risk is low.

### Q: Can attackers really poison DNS?

**A:** Yes, though modern DNS has protections (query randomization, DNSSEC). It's rare but possible, especially on untrusted networks.

### Q: Which solution should I use?

**A:**

- **High security:** Bundled assets only
- **Moderate security:** DNSSEC resolvers + monitoring
- **Low risk / development:** DNSSEC resolvers

### Q: How often do provider IPs change?

**A:** Rarely. Google Workspace IPs are stable for months. Check git history:

```bash
git log --oneline src/assets/google-workspace-ips.json
```

### Q: What if I can't change DNS resolvers?

**A:** Use bundled assets. This is the most secure approach anyway.

### Q: Does this affect all providers?

**A:** No. Only Google Workspace and Mailgun use DNS. All others use HTTPS or static data.

---

## Migration Guide

### Step 1: Audit Usage

Check which providers you use:

```javascript
trustedProviders.getAllProviders().forEach((p) => {
  console.log(p.name);
});
```

Look for:

- Google Workspace
- Mailgun

### Step 2: Choose Strategy

| Environment | Strategy         |
| ----------- | ---------------- |
| Production  | Bundled assets   |
| Staging     | DNSSEC resolvers |
| Development | DNSSEC resolvers |

### Step 3: Implement

Follow Solution 1 (bundled assets) or Solution 2 (DNSSEC resolvers) above.

### Step 4: Test

Run full test suite:

```bash
npm run test
```

Verify IPs are correct:

```bash
node --input-type=module -e "
import trustedProviders from './src/index.js';
trustedProviders.loadDefaultProviders();
await trustedProviders.reloadAll();

const workspace = trustedProviders.getAllProviders().find((provider) => provider.name === 'Google Workspace');
console.log('ranges loaded:', workspace.ipv4.ranges.length + workspace.ipv6.ranges.length);
// A count of 0 means the SPF lookup resolved nothing — check your resolver.
"
```

Checking the range count rather than one hardcoded IP is deliberate: the SPF
record is Google's to change, so any address named here can stop being theirs.
The count answers the question that actually matters — did the lookup produce
data at all.

### Step 5: Monitor

Set up alerting for changes (see Monitoring section above).

---

## Additional Resources

- [DNSSEC Explained](https://www.cloudflare.com/dns/dnssec/how-dnssec-works/)
- [Cloudflare DNS (1.1.1.1)](https://1.1.1.1/)
- [Google Public DNS](https://developers.google.com/speed/public-dns)
- [SPF Record Format](https://datatracker.ietf.org/doc/html/rfc7208)
- [DNS Poisoning Attacks](https://en.wikipedia.org/wiki/DNS_spoofing)

---

**Last Updated:** 2025-11-21  
**Version:** 1.0
