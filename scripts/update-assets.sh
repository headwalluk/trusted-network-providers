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

FACEBOOKBOT_IP4_ASSETS="${SRC_DIR}/assets/facebookbot-ip4s.txt"
FACEBOOKBOT_IP6_ASSETS="${SRC_DIR}/assets/facebookbot-ip6s.txt"

# echo "TEST: ${BASE_DIR}"
# ls -al "${GOOGLEBOT_ASSETS}"
TEMP_DOWNLOAD="$(mktemp -q)"
if [ $? -ne 0 ]; then
  echo "Failed to make temp file for asset download" >&2
  exit 1
fi

##
# Facebook bot
#
whois -h whois.radb.net -- '-i origin AS32934' | grep ^route | awk '{print $2}' > "${TEMP_DOWNLOAD}"
RECORD_COUNT=$(wc -l "${TEMP_DOWNLOAD}" | cut -d' ' -f1)
if [ ${RECORD_COUNT} -lt 10 ]; then
  echo "FacebookBot: invalid record count" >&2
else
  grep -E '\..*/[0-9]+$' "${TEMP_DOWNLOAD}" > "${FACEBOOKBOT_IP4_ASSETS}"
  grep -E ':.*/[0-9]+$' "${TEMP_DOWNLOAD}" > "${FACEBOOKBOT_IP6_ASSETS}"
  rm -f "${TEMP_DOWNLOAD}"
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
rm -f "${TEMP_DOWNLOAD}"

wget -O "${TEMP_DOWNLOAD}" "${BUNNYNET_IP6_URL}"
if [ $? -ne 0 ]; then
  echo "Failed to download: ${BUNNYNET_IP6_URL}" >&2
  exit 1
fi

echo "Update $(basename "${BUNNYNET_IP4_ASSETS}")"
mv "${TEMP_DOWNLOAD}" "${BUNNYNET_IP6_ASSETS}"
rm -f "${TEMP_DOWNLOAD}"
