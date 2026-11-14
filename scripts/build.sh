#!/bin/bash

##
# build-dist.sh
#

REQUIRED_BINS=('zip' 'jq' 'npm')

for REQUIRED_BIN in "${REQUIRED_BINS[@]}"; do
  echo -n "Looking for ${REQUIRED_BIN} ... "
  command -v "${REQUIRED_BIN}" > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "MISSING"
    exit 1
  else
    echo "found"
  fi
done

SCRIPT_DIR="$(realpath "$(dirname "${BASH_SOURCE}")")"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
PROJECT_NAME="$(basename "${PROJECT_DIR}")"
SOURCE_DIR="$(dirname "${PROJECT_DIR}")"
PACKAGE_FILE_NAME="${PROJECT_DIR}/package.json"
PROJECT_VERSION="$(cat "${PACKAGE_FILE_NAME}" | jq -r '.version')"
DIST_FOLDER_NAME="${PROJECT_DIR}/dist"

ACTION="${1}"

echo "PROJECT: ${PROJECT_NAME}"
echo "VERSION: ${PROJECT_VERSION}"
echo "SOURCE:  ${SOURCE_DIR}"

if [ -z "${ACTION}" ]; then
  echo "No action specified" >&2
  exit 1
fi

if [ "${ACTION}" == 'clean' ]; then
  rm -fr "${DIST_FOLDER_NAME}"
  rm -fr "${PROJECT_DIR}/node_modules"
elif [ "${ACTION}" == 'zip' ]; then
  mkdir -p "${DIST_FOLDER_NAME}"

  DIST_FILE_NAME="${DIST_FOLDER_NAME}/${PROJECT_NAME}-${PROJECT_VERSION}.zip"
  rm -f "${DIST_FILE_NAME}"

  # Same file list as the npm package, so ignored local files never ship
  PACKAGE_FILE_LIST="$(cd "${PROJECT_DIR}" && npm pack --dry-run --json --ignore-scripts | jq -r "(if type == \"array\" then .[0] else .[] end).files[].path")"
  if [ -z "${PACKAGE_FILE_LIST}" ]; then
    echo "Failed to list package files" >&2
    exit 1
  fi

  pushd "${SOURCE_DIR}" > /dev/null
  if ! sed "s|^|${PROJECT_NAME}/|" <<<"${PACKAGE_FILE_LIST}" | zip -q "${DIST_FILE_NAME}" -@; then
    echo "Failed to create zip file" >&2
    exit 1
  fi
  popd > /dev/null

  echo "DONE: ${DIST_FILE_NAME}"
else
  echo "Unknown action: ${ACTION}"
  exit 1
fi

exit 0
