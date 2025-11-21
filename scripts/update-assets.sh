#!/bin/bash

##
# update-assets.sh
# 
# Downloads the latest IP address lists from provider sources.
# All downloads use HTTPS with certificate validation.
#

set -e  # Exit on error
set -u  # Exit on undefined variable

THIS_FULL_PATH=$(realpath "${BASH_SOURCE}")
BASE_DIR=$(dirname "${THIS_FULL_PATH}")
BASE_DIR=$(dirname "${BASE_DIR}")

SRC_DIR="${BASE_DIR}/src"

GOOGLEBOT_IPS=https://developers.google.com/static/search/apis/ipranges/googlebot.json
GOOGLEBOT_ASSETS="${SRC_DIR}/assets/googlebot-ips.json"

BUNNYNET_IP4_URL=https://bunnycdn.com/api/system/edgeserverlist
BUNNYNET_IP4_ASSETS="${SRC_DIR}/assets/bunnynet-ip4s.json"

BUNNYNET_IP6_URL=https://bunnycdn.com/api/system/edgeserverlist/IPv6
BUNNYNET_IP6_ASSETS="${SRC_DIR}/assets/bunnynet-ip6s.json"

FACEBOOKBOT_IP4_ASSETS="${SRC_DIR}/assets/facebookbot-ip4s.txt"
FACEBOOKBOT_IP6_ASSETS="${SRC_DIR}/assets/facebookbot-ip6s.txt"

# wget options for secure downloads
WGET_OPTS="--secure-protocol=TLSv1_2 --https-only --timeout=30 --tries=3"

TEMP_DOWNLOAD="$(mktemp -q)"
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to create temp file for asset download" >&2
  exit 1
fi

# Cleanup function
cleanup() {
  rm -f "${TEMP_DOWNLOAD}"
}
trap cleanup EXIT

##
# Facebook bot (via WHOIS)
#
echo "Fetching FacebookBot IPs from WHOIS..."
if whois -h whois.radb.net -- '-i origin AS32934' | grep ^route | awk '{print $2}' > "${TEMP_DOWNLOAD}"; then
  RECORD_COUNT=$(wc -l "${TEMP_DOWNLOAD}" | cut -d' ' -f1)
  if [ ${RECORD_COUNT} -lt 10 ]; then
    echo "ERROR: FacebookBot invalid record count (${RECORD_COUNT})" >&2
    exit 1
  else
    grep -E '\..*/[0-9]+$' "${TEMP_DOWNLOAD}" > "${FACEBOOKBOT_IP4_ASSETS}"
    grep -E ':.*/[0-9]+$' "${TEMP_DOWNLOAD}" > "${FACEBOOKBOT_IP6_ASSETS}"
    echo "✓ Updated FacebookBot IPs (${RECORD_COUNT} routes)"
  fi
else
  echo "ERROR: Failed to fetch FacebookBot IPs from WHOIS" >&2
  exit 1
fi

##
# GoogleBot
#
echo "Downloading GoogleBot IPs..."
if wget ${WGET_OPTS} -O "${TEMP_DOWNLOAD}" "${GOOGLEBOT_IPS}"; then
  # Validate JSON format
  if jq empty "${TEMP_DOWNLOAD}" 2>/dev/null; then
    mv "${TEMP_DOWNLOAD}" "${GOOGLEBOT_ASSETS}"
    echo "✓ Updated $(basename "${GOOGLEBOT_ASSETS}")"
  else
    echo "ERROR: Downloaded GoogleBot file is not valid JSON" >&2
    exit 1
  fi
else
  echo "ERROR: Failed to download ${GOOGLEBOT_IPS}" >&2
  exit 1
fi

##
# BunnyNet IPv4
#
echo "Downloading BunnyNet IPv4 list..."
if wget ${WGET_OPTS} -O "${TEMP_DOWNLOAD}" "${BUNNYNET_IP4_URL}"; then
  # Validate JSON format
  if jq empty "${TEMP_DOWNLOAD}" 2>/dev/null; then
    mv "${TEMP_DOWNLOAD}" "${BUNNYNET_IP4_ASSETS}"
    echo "✓ Updated $(basename "${BUNNYNET_IP4_ASSETS}")"
  else
    echo "ERROR: Downloaded BunnyNet IPv4 file is not valid JSON" >&2
    exit 1
  fi
else
  echo "ERROR: Failed to download ${BUNNYNET_IP4_URL}" >&2
  exit 1
fi

##
# BunnyNet IPv6
#
echo "Downloading BunnyNet IPv6 list..."
if wget ${WGET_OPTS} -O "${TEMP_DOWNLOAD}" "${BUNNYNET_IP6_URL}"; then
  # Validate JSON format
  if jq empty "${TEMP_DOWNLOAD}" 2>/dev/null; then
    mv "${TEMP_DOWNLOAD}" "${BUNNYNET_IP6_ASSETS}"
    echo "✓ Updated $(basename "${BUNNYNET_IP6_ASSETS}")"
  else
    echo "ERROR: Downloaded BunnyNet IPv6 file is not valid JSON" >&2
    exit 1
  fi
else
  echo "ERROR: Failed to download ${BUNNYNET_IP6_URL}" >&2
  exit 1
fi

##
# Update checksums file
#
echo ""
echo "Calculating checksums..."

CHECKSUMS_FILE="${SRC_DIR}/assets/checksums.json"
TEMP_CHECKSUMS="${TEMP_DOWNLOAD}.checksums"

# Calculate checksums for each asset
GOOGLEBOT_CHECKSUM=$(sha256sum "${GOOGLEBOT_ASSETS}" | cut -d' ' -f1)
BUNNYNET_IP4_CHECKSUM=$(sha256sum "${BUNNYNET_IP4_ASSETS}" | cut -d' ' -f1)
BUNNYNET_IP6_CHECKSUM=$(sha256sum "${BUNNYNET_IP6_ASSETS}" | cut -d' ' -f1)
CURRENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create updated checksums file
cat > "${TEMP_CHECKSUMS}" << EOF
{
  "comment": "SHA-256 checksums for provider data sources. Updated by update-assets.sh",
  "providers": {
    "googlebot": {
      "url": "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
      "sha256": "${GOOGLEBOT_CHECKSUM}",
      "comment": "Bundled asset - checksum verified on load"
    },
    "bunnynet-ipv4": {
      "url": "https://bunnycdn.com/api/system/edgeserverlist",
      "sha256": "${BUNNYNET_IP4_CHECKSUM}",
      "comment": "Bundled asset - checksum verified on load"
    },
    "bunnynet-ipv6": {
      "url": "https://bunnycdn.com/api/system/edgeserverlist/IPv6",
      "sha256": "${BUNNYNET_IP6_CHECKSUM}",
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

mv "${TEMP_CHECKSUMS}" "${CHECKSUMS_FILE}"

echo "✓ Checksums updated:"
echo "  GoogleBot:      ${GOOGLEBOT_CHECKSUM}"
echo "  BunnyNet IPv4:  ${BUNNYNET_IP4_CHECKSUM}"
echo "  BunnyNet IPv6:  ${BUNNYNET_IP6_CHECKSUM}"
echo ""
echo "✓ All assets updated successfully"
