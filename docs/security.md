# Security

This document covers the security measures in trusted-network-providers and recommendations for production deployments.

## How External Data is Protected

The library fetches IP ranges from external sources (APIs, DNS, bundled JSON assets). Several layers protect against bad data:

### HTTPS Only

All HTTP requests are routed through `secure-http-client.js` which enforces:

- **HTTPS-only** — plain HTTP URLs are rejected
- **Strict certificate validation** — expired, self-signed, and untrusted certificates are rejected without retry
- **Timeouts** — requests abort after 30 seconds (configurable)
- **Retries** — transient failures (5xx, network errors) are retried up to 2 times with linear backoff

### Checksum Verification

Bundled JSON assets (Googlebot, BunnyNet IP ranges) are verified against SHA-256 checksums stored in `src/assets/checksums.json`. This detects file corruption or tampering.

Update checksums when refreshing bundled assets:

```bash
./scripts/update-assets.sh
```

### Structure Validation

API responses (e.g., Stripe) are validated at runtime to confirm they match expected formats before updating provider data.

### Input Validation

- Maximum 100 providers
- Maximum 10,000 IPs/ranges per provider
- All CIDR ranges validated on registration

## DNS-Based Providers

Some providers (Google Workspace, MS Outlook, Brevo, PayPal) resolve IP ranges from DNS SPF records at runtime. **DNS responses are not cryptographically verified** — they could be spoofed via DNS poisoning.

Mitigations:

1. Use DNSSEC-validating resolvers (e.g., `1.1.1.1`, `8.8.8.8`)
2. Run `./scripts/update-assets.sh` to fetch data at build time instead of runtime
3. In high-security environments, use bundled assets only and disable runtime DNS lookups

See [dns-security-guide.md](dns-security-guide.md) for detailed guidance.

## Production Recommendations

- Set log level to `'warn'` or `'error'` to avoid leaking internal details
- Call `reloadAll()` periodically (e.g., daily) to keep provider data fresh
- Monitor provider health via lifecycle events (`reload:error`, `stale`)
- Run `npm audit` before deploying updates
- Use `setStalenessThreshold()` to detect providers that haven't refreshed
