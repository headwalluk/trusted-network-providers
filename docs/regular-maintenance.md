# Regular Maintenance

Most providers in this library need **no** maintenance — their ranges are either
hardcoded (Cloudflare, PayPal, Private, …) or fetched fresh at runtime by the
consumer via `reloadAll()` (Stripe API/Webhooks, Google Workspace SPF). Those are
covered automatically and are not discussed here.

What _does_ need periodic attention is the set of **bundled-asset providers** —
the ones whose IP lists are shipped inside the package under `src/assets/` and
refreshed by `scripts/update-assets.sh`. Stale bundled data means legitimate
crawler/CDN traffic can be misclassified as untrusted until the next release.

## Bundled assets that need refreshing

| Provider                       | Source                                                                               | Asset file(s)                                  |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Googlebot                      | `developers.google.com/static/crawling/ipranges/common-crawlers.json`                | `googlebot-ips.json`                           |
| Google Special Crawlers        | `developers.google.com/static/crawling/ipranges/special-crawlers.json`               | `google-special-crawlers.json`                 |
| Google User-Triggered Fetchers | `developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json` | `google-user-fetchers.json`                    |
| Bingbot                        | `bing.com/toolbox/bingbot.json`                                                      | `bingbot-ips.json`                             |
| Applebot                       | `search.developer.apple.com/applebot.json`                                           | `applebot-ips.json`                            |
| GPTBot                         | `openai.com/gptbot.json`                                                             | `gptbot-ips.json`                              |
| OAI-SearchBot                  | `openai.com/searchbot.json`                                                          | `oai-searchbot-ips.json`                       |
| ChatGPT-User                   | `openai.com/chatgpt-user.json`                                                       | `chatgpt-user-ips.json`                        |
| BunnyNet                       | `bunnycdn.com/api/system/edgeserverlist[/IPv6]`                                      | `bunnynet-ip4s.json`, `bunnynet-ip6s.json`     |
| FacebookBot                    | `whois.radb.net` AS32934 routes                                                      | `facebookbot-ip4s.txt`, `facebookbot-ip6s.txt` |

All of these are SHA-256 verified on load against `src/assets/checksums.json`,
which the update script regenerates whenever the data changes.

## How often to run

Run **monthly**, and always **before cutting any release**. BunnyNet's CDN edge
list churns the most; the Google/Bing/Facebook lists change less frequently. A
monthly cadence comfortably covers all of them. Running more often is harmless —
when nothing has changed the script is a no-op and leaves the working tree clean.

## How to run

```bash
./scripts/update-assets.sh
echo "exit: $?"
```

The script downloads every source into a temporary staging directory, validates
each payload, and only writes a file back into `src/assets/` if its content has
actually changed. It then prints a summary block, for example:

```
=== ASSET UPDATE SUMMARY ===
Changed (2):
  - bunnynet-ip4s.json  (412 -> 418 addresses)
  - checksums.json
Unchanged (6): facebookbot-ip4s.txt facebookbot-ip6s.txt googlebot-ips.json ...
============================
```

### Exit codes

| Code | Meaning                              | What to do                                                |
| ---- | ------------------------------------ | --------------------------------------------------------- |
| `0`  | No assets changed                    | Nothing to commit. Done.                                  |
| `10` | One or more assets changed (written) | Review the diff, then patch-bump + changelog (see below). |
| `1`  | Error (network/validation failure)   | Nothing was written. Investigate; do **not** commit.      |

The flow is atomic: a failure midway leaves every live asset untouched, so you
never end up with a half-updated bundle.

## When assets change (exit 10)

This is the deterministic-script-plus-judgement part of the workflow:

1. **Review** the diff (`git diff src/assets/`) and sanity-check it — counts
   should move by a plausible amount, not collapse to near-zero.
2. **Patch-bump** the version in `package.json` (e.g. `2.1.0` → `2.1.1`). Asset
   refreshes are data updates, not API changes, so they take a patch bump.
3. **Add a CHANGELOG entry** naming the changed assets, dated today, e.g.:

   ```markdown
   ## 2.1.1 :: 2026-06-06

   - Refreshed bundled assets via `scripts/update-assets.sh`:
     - BunnyNet IPv4 (412 → 418 addresses)
   ```

4. **Commit, tag, and push.** (`npm publish` is run separately by the maintainer.)

For Claude-driven maintenance, this loop is codified in
[CLAUDE.md](../CLAUDE.md#regular-maintenance) so it can be executed end to end.

## Requirements

The script needs these tools on `PATH`: `wget`, `jq`, `whois`, `sha256sum`,
`mktemp`, `cmp`, `diff`, `awk`, `grep`. It checks for them up front and exits
with a clear message if any are missing.
