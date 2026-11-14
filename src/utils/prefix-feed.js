/**
 * prefix-feed.js
 *
 * Loaders for providers whose data is a Google-style `{ prefixes: [...] }`
 * feed, either bundled under src/assets/ or fetched from the publisher.
 */

import { fetchJSON } from './secure-http-client.js';
import { readVerifiedAsset } from './checksum-verifier.js';
import { replaceProviderData, snapshotFromPrefixes } from './provider-data.js';
import logger from './logger.js';

/** Loads a provider's ranges from its checksum-verified bundled prefix feed. */
const loadBundledPrefixes = async (provider, assetPath, checksumKey) => {
  try {
    const assetData = JSON.parse(await readVerifiedAsset(assetPath, checksumKey));
    replaceProviderData(provider, snapshotFromPrefixes(assetData?.prefixes));
  } catch (error) {
    logger.error(`Failed to load ${provider.name} IPs: ${error.message}`);
    throw error;
  }
};

/** Loads a provider's ranges from its publisher's live prefix feed. */
const fetchPrefixes = async (provider, url) => {
  try {
    const data = await fetchJSON(url);
    if (!Array.isArray(data?.prefixes)) {
      throw new Error(`Invalid response format from ${provider.name} API`);
    }
    replaceProviderData(provider, snapshotFromPrefixes(data.prefixes));
  } catch (error) {
    logger.error(`Failed to reload ${provider.name} IPs from web: ${error.message}`);
    throw error;
  }
};

export { fetchPrefixes, loadBundledPrefixes };
