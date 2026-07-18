#!/bin/bash

##
# update-assets.sh
#
# Refreshes the bundled IP address lists from their provider sources.
#
# Flow: download every source into a temporary staging directory, validate it,
# then compare each staged file to the live asset. Only files that actually
# changed are written back into src/assets/. The checksums manifest is
# regenerated whenever the bundled data changes.
#
# All downloads use HTTPS with TLS 1.2+ and certificate validation.
#
# Exit codes:
#   0  - success, no assets changed (nothing to commit)
#   10 - success, one or more assets changed (review, version-bump, changelog)
#   1  - error (network/validation failure; nothing was written)
#
# See docs/regular-maintenance.md for the surrounding maintenance workflow.
#

set -e # Exit on error
set -u # Exit on undefined variable

THIS_FULL_PATH=$(realpath "${BASH_SOURCE[0]}")
BASE_DIR=$(dirname "${THIS_FULL_PATH}")
BASE_DIR=$(dirname "${BASE_DIR}")

SRC_DIR="${BASE_DIR}/src"
ASSETS_DIR="${SRC_DIR}/assets"
CHECKSUMS_FILE="${ASSETS_DIR}/checksums.json"

# Source URLs.
# Note: Google retired the /static/search/apis/ipranges/ paths; googlebot.json was
# replaced by common-crawlers.json under /static/crawling/ipranges/.
GOOGLEBOT_URL=https://developers.google.com/static/crawling/ipranges/common-crawlers.json
GOOGLE_SPECIAL_URL=https://developers.google.com/static/crawling/ipranges/special-crawlers.json
GOOGLE_USER_FETCHERS_URL=https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json
BINGBOT_URL=https://www.bing.com/toolbox/bingbot.json
BUNNYNET_IP4_URL=https://bunnycdn.com/api/system/edgeserverlist
BUNNYNET_IP6_URL=https://bunnycdn.com/api/system/edgeserverlist/IPv6

# wget options for secure downloads
WGET_OPTS="--secure-protocol=TLSv1_2 --https-only --timeout=30 --tries=3"

# Accumulators (populated by commit_asset / the checksums step)
CHANGED=()
UNCHANGED=()

##
# Preflight: make sure every external tool we depend on is available.
#
for cmd in wget jq whois sha256sum mktemp cmp diff awk grep; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: required command not found: ${cmd}" >&2
    exit 1
  fi
done

##
# Staging directory. Everything is downloaded here first; the live assets are
# only touched once a file has been validated AND found to differ.
#
if ! STAGE_DIR="$(mktemp -d)" || [ -z "${STAGE_DIR}" ]; then
  echo "ERROR: Failed to create staging directory" >&2
  exit 1
fi

cleanup() {
  rm -rf "${STAGE_DIR}"
}
trap cleanup EXIT

##
# Helpers
#

# download <url> <dest> <label>
download() {
  local url="$1" dest="$2" label="$3"
  echo "Downloading ${label}..."
  # shellcheck disable=SC2086  # WGET_OPTS is intentionally word-split into flags
  if ! wget ${WGET_OPTS} -O "${dest}" "${url}"; then
    echo "ERROR: Failed to download ${url}" >&2
    exit 1
  fi
}

# validate_json <file> <jq-expr> <label>
# jq-expr must evaluate truthy for a structurally-valid payload.
validate_json() {
  local file="$1" expr="$2" label="$3"
  if ! jq -e "${expr}" "${file}" >/dev/null 2>&1; then
    echo "ERROR: ${label} failed structure validation (${expr})" >&2
    exit 1
  fi
}

# record_count <file> <prefixes|array|lines> -> prints a count
record_count() {
  case "$2" in
  prefixes) jq '.prefixes | length' "$1" 2>/dev/null || echo '?' ;;
  array) jq 'length' "$1" 2>/dev/null || echo '?' ;;
  lines) wc -l <"$1" 2>/dev/null | tr -d ' ' || echo '?' ;;
  esac
}

# content_same <staged> <live> <count-type>
# True when the two assets carry the same provider content. For "prefixes" JSON
# (Google/Bing crawler feeds) the upstream embeds a per-fetch `creationTime`
# that changes every run; comparing that verbatim would churn the file on a
# timestamp with identical IPs, so we compare the payload with creationTime
# stripped. Everything else is a byte-exact compare.
content_same() {
  local staged="$1" live="$2" ctype="$3"
  if [ "${ctype}" = 'prefixes' ]; then
    cmp -s \
      <(jq -S 'del(.creationTime)' "${staged}" 2>/dev/null) \
      <(jq -S 'del(.creationTime)' "${live}" 2>/dev/null)
  else
    cmp -s "${staged}" "${live}"
  fi
}

# commit_asset <staged> <live> <count-type> <unit>
# Diffs the staged file against the live asset; only writes (and records as
# CHANGED) when they differ. Otherwise records as UNCHANGED.
commit_asset() {
  local staged="$1" live="$2" ctype="$3" unit="$4"
  local name old new
  name=$(basename "${live}")
  new=$(record_count "${staged}" "${ctype}")

  if [ -f "${live}" ] && content_same "${staged}" "${live}" "${ctype}"; then
    echo "  unchanged: ${name} (${new} ${unit})"
    UNCHANGED+=("${name}")
  else
    old='new'
    [ -f "${live}" ] && old=$(record_count "${live}" "${ctype}")
    mv "${staged}" "${live}"
    echo "  UPDATED:   ${name}  (${old} -> ${new} ${unit})"
    CHANGED+=("${name}  (${old} -> ${new} ${unit})")
  fi
}

##
# FacebookBot (via WHOIS) — one fetch, split into IPv4/IPv6 CIDR lists.
#
echo "Fetching FacebookBot IPs from WHOIS..."
FB_RAW="${STAGE_DIR}/facebook-raw.txt"
if ! whois -h whois.radb.net -- '-i origin AS32934' | grep ^route | awk '{print $2}' | awk '!seen[$0]++' >"${FB_RAW}"; then
  echo "ERROR: Failed to fetch FacebookBot IPs from WHOIS" >&2
  exit 1
fi

FB_COUNT=$(wc -l <"${FB_RAW}" | tr -d ' ')
if [ "${FB_COUNT}" -lt 10 ]; then
  echo "ERROR: FacebookBot returned an implausible route count (${FB_COUNT})" >&2
  exit 1
fi

FB_STAGE_V4="${STAGE_DIR}/facebookbot-ip4s.txt"
FB_STAGE_V6="${STAGE_DIR}/facebookbot-ip6s.txt"
grep -E '\..*/[0-9]+$' "${FB_RAW}" >"${FB_STAGE_V4}" || true
grep -E ':.*/[0-9]+$' "${FB_RAW}" >"${FB_STAGE_V6}" || true
if [ ! -s "${FB_STAGE_V4}" ] || [ ! -s "${FB_STAGE_V6}" ]; then
  echo "ERROR: FacebookBot split produced an empty IPv4 or IPv6 list" >&2
  exit 1
fi

##
# GoogleBot
#
GOOGLEBOT_STAGE="${STAGE_DIR}/googlebot-ips.json"
download "${GOOGLEBOT_URL}" "${GOOGLEBOT_STAGE}" "GoogleBot"
validate_json "${GOOGLEBOT_STAGE}" '.prefixes | length > 0' "GoogleBot"

##
# Google Special Crawlers (AdsBot, AdSense/Mediapartners, APIs-Google, Google-Safety)
#
GOOGLE_SPECIAL_STAGE="${STAGE_DIR}/google-special-crawlers.json"
download "${GOOGLE_SPECIAL_URL}" "${GOOGLE_SPECIAL_STAGE}" "Google Special Crawlers"
validate_json "${GOOGLE_SPECIAL_STAGE}" '.prefixes | length > 0' "Google Special Crawlers"

##
# Google User-Triggered Fetchers (Gmail image proxy, Chrome prefetch proxy, Feedfetcher, etc.)
#
GOOGLE_USER_FETCHERS_STAGE="${STAGE_DIR}/google-user-fetchers.json"
download "${GOOGLE_USER_FETCHERS_URL}" "${GOOGLE_USER_FETCHERS_STAGE}" "Google User-Triggered Fetchers"
validate_json "${GOOGLE_USER_FETCHERS_STAGE}" '.prefixes | length > 0' "Google User-Triggered Fetchers"

##
# Bingbot
#
BINGBOT_STAGE="${STAGE_DIR}/bingbot-ips.json"
download "${BINGBOT_URL}" "${BINGBOT_STAGE}" "Bingbot"
validate_json "${BINGBOT_STAGE}" '.prefixes | length > 0' "Bingbot"

##
# BunnyNet IPv4 (JSON array of addresses)
#
BUNNYNET_IP4_STAGE="${STAGE_DIR}/bunnynet-ip4s.json"
download "${BUNNYNET_IP4_URL}" "${BUNNYNET_IP4_STAGE}" "BunnyNet IPv4"
validate_json "${BUNNYNET_IP4_STAGE}" 'type == "array" and length > 0' "BunnyNet IPv4"

##
# BunnyNet IPv6 (JSON array of addresses)
#
BUNNYNET_IP6_STAGE="${STAGE_DIR}/bunnynet-ip6s.json"
download "${BUNNYNET_IP6_URL}" "${BUNNYNET_IP6_STAGE}" "BunnyNet IPv6"
validate_json "${BUNNYNET_IP6_STAGE}" 'type == "array" and length > 0' "BunnyNet IPv6"

##
# All downloads validated — now diff each against the live asset and commit
# only what changed.
#
echo ""
echo "Comparing against bundled assets..."
commit_asset "${FB_STAGE_V4}" "${ASSETS_DIR}/facebookbot-ip4s.txt" lines routes
commit_asset "${FB_STAGE_V6}" "${ASSETS_DIR}/facebookbot-ip6s.txt" lines routes
commit_asset "${GOOGLEBOT_STAGE}" "${ASSETS_DIR}/googlebot-ips.json" prefixes prefixes
commit_asset "${GOOGLE_SPECIAL_STAGE}" "${ASSETS_DIR}/google-special-crawlers.json" prefixes prefixes
commit_asset "${GOOGLE_USER_FETCHERS_STAGE}" "${ASSETS_DIR}/google-user-fetchers.json" prefixes prefixes
commit_asset "${BINGBOT_STAGE}" "${ASSETS_DIR}/bingbot-ips.json" prefixes prefixes
commit_asset "${BUNNYNET_IP4_STAGE}" "${ASSETS_DIR}/bunnynet-ip4s.json" array addresses
commit_asset "${BUNNYNET_IP6_STAGE}" "${ASSETS_DIR}/bunnynet-ip6s.json" array addresses

##
# Regenerate the checksums manifest from the (post-commit) live assets. The
# manifest is treated like any other tracked asset: we only rewrite it when its
# provider content actually differs, ignoring the lastUpdated timestamp so an
# unchanged run stays a no-op in git.
#
sha() { sha256sum "$1" | cut -d' ' -f1; }

NEW_CHECKSUMS="${STAGE_DIR}/checksums.json"
CURRENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat >"${NEW_CHECKSUMS}" <<EOF
{
  "comment": "SHA-256 checksums for provider data sources. Updated by update-assets.sh",
  "providers": {
    "googlebot": {
      "url": "${GOOGLEBOT_URL}",
      "sha256": "$(sha "${ASSETS_DIR}/googlebot-ips.json")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "google-special-crawlers": {
      "url": "${GOOGLE_SPECIAL_URL}",
      "sha256": "$(sha "${ASSETS_DIR}/google-special-crawlers.json")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "google-user-fetchers": {
      "url": "${GOOGLE_USER_FETCHERS_URL}",
      "sha256": "$(sha "${ASSETS_DIR}/google-user-fetchers.json")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "bingbot": {
      "url": "${BINGBOT_URL}",
      "sha256": "$(sha "${ASSETS_DIR}/bingbot-ips.json")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "bunnynet-ipv4": {
      "url": "${BUNNYNET_IP4_URL}",
      "sha256": "$(sha "${ASSETS_DIR}/bunnynet-ip4s.json")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "bunnynet-ipv6": {
      "url": "${BUNNYNET_IP6_URL}",
      "sha256": "$(sha "${ASSETS_DIR}/bunnynet-ip6s.json")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "facebookbot-ipv4": {
      "url": "whois.radb.net -i origin AS32934 (IPv4 routes)",
      "sha256": "$(sha "${ASSETS_DIR}/facebookbot-ip4s.txt")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "facebookbot-ipv6": {
      "url": "whois.radb.net -i origin AS32934 (IPv6 routes)",
      "sha256": "$(sha "${ASSETS_DIR}/facebookbot-ip6s.txt")",
      "comment": "Bundled asset - checksum verified on load"
    },
    "stripe-api": {
      "url": "https://stripe.com/files/ips/ips_api.json",
      "sha256": null,
      "comment": "Runtime verification - structure validation used instead (data changes frequently)"
    },
    "stripe-webhooks": {
      "url": "https://stripe.com/files/ips/ips_webhooks.json",
      "sha256": null,
      "comment": "Runtime verification - structure validation used instead (data changes frequently)"
    }
  },
  "lastUpdated": "${CURRENT_DATE}"
}
EOF

# Validate the manifest we just generated, then diff (ignoring lastUpdated).
validate_json "${NEW_CHECKSUMS}" '.providers | length > 0' "checksums.json"
if [ -f "${CHECKSUMS_FILE}" ] &&
  diff -q <(jq -S 'del(.lastUpdated)' "${NEW_CHECKSUMS}") \
    <(jq -S 'del(.lastUpdated)' "${CHECKSUMS_FILE}") >/dev/null 2>&1; then
  echo "  unchanged: checksums.json"
  UNCHANGED+=("checksums.json")
else
  mv "${NEW_CHECKSUMS}" "${CHECKSUMS_FILE}"
  echo "  UPDATED:   checksums.json"
  CHANGED+=("checksums.json")
fi

##
# Summary + exit code
#
echo ""
echo "=== ASSET UPDATE SUMMARY ==="
if [ ${#CHANGED[@]} -eq 0 ]; then
  echo "No assets changed. (${#UNCHANGED[@]} checked)"
  echo "============================"
  exit 0
fi

echo "Changed (${#CHANGED[@]}):"
for item in "${CHANGED[@]}"; do
  echo "  - ${item}"
done
if [ ${#UNCHANGED[@]} -gt 0 ]; then
  echo "Unchanged (${#UNCHANGED[@]}): ${UNCHANGED[*]}"
fi
echo "============================"
echo ""
echo "Assets changed — review the diff, then patch-bump the version and add a"
echo "CHANGELOG entry naming the changed assets (see docs/regular-maintenance.md)."
exit 10
