#!/bin/bash

##
# build-dist.sh
#

REQUIRED_BINS=('zip' 'jq')

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

  pushd "${PROJECT_DIR}" > /dev/null

  cd ..

  DIST_FILE_NAME="${PROJECT_NAME}/dist/${PROJECT_NAME}-${PROJECT_VERSION}.zip"
  if [ -f "${DIST_FILE_NAME}" ]; then
    rm -f "${DIST_FILE_NAME}"
  fi

  zip -r "${DIST_FILE_NAME}" "${PROJECT_NAME}" -x "${PROJECT_NAME}/node_modules/*" -x "${PROJECT_NAME}/dist/*" -x "${PROJECT_NAME}/scripts/*" -x "${PROJECT_NAME}/.git/*" -x "${PROJECT_NAME}/.gitignore"

  echo

  if [ $? -ne 0 ]; then
    echo "Failed to create zip file"
  else
    echo "DONE: ${DIST_FILE_NAME}"
  fi

  popd > /dev/null
else
  echo "Unknown action: ${ACTION}"
  exit 1
fi

exit 0
