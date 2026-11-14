# Security

This document covers the security measures in trusted-network-providers and recommendations for production deployments.

## How External Data is Protected

The library fetches IP ranges from external sources (APIs, DNS, bundled JSON assets). Several layers protect against bad data:

### HTTPS Only

All HTTP requests are routed through `secure-http-client.js` which enforces:

- **HTTPS-only** — plain HTTP URLs are rejected, including a redirect that lands on one
- **Strict certificate validation** — expired, self-signed, and untrusted certificates are rejected without retry
- **Timeouts** — requests abort after 30 seconds (configurable), and the deadline covers reading the body, not just the headers
- **Size limit** — response bodies over 5 MiB are rejected (`maxResponseBytes`)
- **Retries** — transient failures (5xx, network errors) are retried up to 2 times with linear backoff

### Checksum Verification

Every bundled asset — the Google crawler feeds, Bingbot, Applebot, the three OpenAI crawler feeds, BunnyNet and FacebookBot — is verified against SHA-256 checksums stored in `src/assets/checksums.json`. An asset whose hash does not match, or that has no manifest entry, is refused: the reload fails and the provider keeps its previous data. This detects file corruption or an edited asset; it does not authenticate where the data came from, since the manifest ships alongside the assets. See [providers.md](providers.md) for the full list.

Every reload — bundled, HTTP or SPF — builds a complete snapshot and validates it (address syntax, CIDR syntax, family, entry count, non-empty) before swapping it in. A failed or incomplete reload never empties or half-replaces a provider.

Update checksums when refreshing bundled assets:

```bash
./scripts/update-assets.sh
```

### Structure Validation

API responses (e.g., Stripe) are validated at runtime to confirm they match expected formats before updating provider data.

### Input Validation

- Maximum 100 providers
- Maximum 10,000 IPs/ranges per provider
- All CIDR ranges and exact addresses validated on registration, including that each sits in the right family pool
- Lookups normalise the address first: IPv4-mapped IPv6 (`::ffff:192.0.2.1`) is matched as IPv4, and any spelling of an IPv6 address matches its exact entry
- Non-string lookup input returns `null`; overlong input is truncated in error logs

## DNS-Based Providers

Two providers in the default set — **Google Workspace** and **Mailgun** —
resolve their IP ranges from DNS SPF records at runtime. Every other provider is
either static or fetched over HTTPS; MS Outlook, Brevo and PayPal in particular
are hardcoded ranges, not DNS lookups.

**DNS responses are not cryptographically verified** — they could be spoofed via
DNS poisoning.

Mitigations:

1. Use DNSSEC-validating resolvers (e.g., `1.1.1.1`, `8.8.8.8`)
2. Drop them — `deleteProvider('Google Workspace')` and
   `deleteProvider('Mailgun')` — and no runtime DNS lookup happens at all
3. In high-security environments, rely on the bundled and static providers only

Note that `./scripts/update-assets.sh` does **not** cover this: it refreshes the
bundled assets, and Google Workspace is not one of them.

See [dns-security-guide.md](dns-security-guide.md) for detailed guidance.

## Production Recommendations

- Set log level to `'warn'` or `'error'` to avoid leaking internal details
- Call `reloadAll()` periodically (e.g., daily) to keep provider data fresh
- Monitor provider health via lifecycle events (`reload:error`, `stale`)
- Run `npm audit` before deploying updates
- Use `setStalenessThreshold()` to detect providers that haven't refreshed
