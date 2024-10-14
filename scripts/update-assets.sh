#!/bin/bash

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

# echo "TEST: ${BASE_DIR}"
# ls -al "${GOOGLEBOT_ASSETS}"
TEMP_DOWNLOAD="$(mktemp -q)"
if [ $? -ne 0 ]; then
  echo "Failed to make temp file for asset download" >&2
  exit 1
fi

#
# GoogleBot
#
wget -O "${TEMP_DOWNLOAD}" "${GOOGLEBOT_IPS}"
if [ $? -ne 0 ]; then
  echo "Failed to download: ${GOOGLEBOT_IPS}" >&2
  exit 1
fi

echo "Update $(basename "${GOOGLEBOT_ASSETS}")"
mv "${TEMP_DOWNLOAD}" "${GOOGLEBOT_ASSETS}"
touch "${GOOGLEBOT_ASSETS}"
rm -f "${TEMP_DOWNLOAD}"

#
# BunnyNet
#
wget -O "${TEMP_DOWNLOAD}" "${BUNNYNET_IP4_URL}"
if [ $? -ne 0 ]; then
  echo "Failed to download: ${BUNNYNET_IP4_URL}" >&2
  exit 1
fi

echo "Update $(basename "${BUNNYNET_IP4_ASSETS}")"
mv "${TEMP_DOWNLOAD}" "${BUNNYNET_IP4_ASSETS}"
touch "${BUNNYNET_IP4_ASSETS}"
rm -f "${TEMP_DOWNLOAD}"

wget -O "${TEMP_DOWNLOAD}" "${BUNNYNET_IP6_URL}"
if [ $? -ne 0 ]; then
  echo "Failed to download: ${BUNNYNET_IP6_URL}" >&2
  exit 1
fi

echo "Update $(basename "${BUNNYNET_IP4_ASSETS}")"
mv "${TEMP_DOWNLOAD}" "${BUNNYNET_IP6_ASSETS}"
touch "${BUNNYNET_IP6_ASSETS}"
rm -f "${TEMP_DOWNLOAD}"
