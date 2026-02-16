# Test Fixtures

This directory contains snapshot responses from external provider APIs. These fixtures are used in tests to avoid hitting live APIs during CI/CD and to ensure deterministic test results.

## Files

### stripe-api-response.json

**Source:** https://stripe.com/files/ips/ips_api.json  
**Format:** JSON object with an `API` array containing IPv4 addresses  
**Last Updated:** 2026-02-15  
**Purpose:** Test data for Stripe API provider without network calls

Example structure:

```json
{
  "API": [
    "13.112.224.240",
    "13.115.13.148",
    ...
  ]
}
```

### googlebot-response.json

**Source:** https://developers.google.com/static/search/apis/ipranges/googlebot.json  
**Format:** JSON object with a `prefixes` array containing `ipv4Prefix` and `ipv6Prefix` objects  
**Last Updated:** 2026-02-15  
**Purpose:** Test data for Googlebot provider without network calls

Example structure:

```json
{
  "creationTime": "2026-02-13T15:46:14.000000",
  "prefixes": [
    { "ipv6Prefix": "2001:4860:4801:10::/64" },
    { "ipv4Prefix": "66.249.64.0/19" },
    ...
  ]
}
```

## Updating Fixtures

To refresh these snapshots with current live data:

```bash
# Stripe API
curl -s https://stripe.com/files/ips/ips_api.json -o test/fixtures/stripe-api-response.json

# Googlebot
curl -s https://developers.google.com/static/search/apis/ipranges/googlebot.json -o test/fixtures/googlebot-response.json
```

Update the "Last Updated" date in this README after refreshing.

## Usage in Tests

Import fixtures in test files:

```javascript
const stripeFixture = require('./fixtures/stripe-api-response.json');
const googlebotFixture = require('./fixtures/googlebot-response.json');
```

Use them to mock external API responses or validate provider reload logic.

## Notes

- These snapshots represent real API responses at a point in time
- Provider IP lists change periodically — fixtures may become stale
- Refresh fixtures when provider APIs change format or when IP lists need updating
- Do not commit API keys or sensitive data to these fixtures
- Cloudflare provider uses static data and does not need fixtures
