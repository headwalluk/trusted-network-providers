/**
 * Configurable logging abstraction for trusted-network-providers
 *
 * Replaces bare console.log/error/warn calls with a structured logger
 * that can be configured at runtime.
 *
 * Log levels (in order of severity):
 * - silent: No output
 * - error: Only errors
 * - warn: Errors and warnings
 * - info: Errors, warnings, and informational messages
 * - debug: All messages including debug output
 *
 * @module utils/logger
 */

const LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLevel = LOG_LEVELS.error; // Default: only show errors

/**
 * Set the logging level
 *
 * @param {string} level - One of: 'silent', 'error', 'warn', 'info', 'debug'
 * @throws {Error} If level is invalid
 *
 * @example
 * logger.setLevel('info'); // Show errors, warnings, and info
 * logger.setLevel('silent'); // Suppress all output
 */
export const setLevel = (level) => {
  if (!(level in LOG_LEVELS)) {
    throw new Error(`Invalid log level: ${level}. Must be one of: ${Object.keys(LOG_LEVELS).join(', ')}`);
  }
  currentLevel = LOG_LEVELS[level];
};

/**
 * Get the current logging level
 *
 * @returns {string} Current log level name
 *
 * @example
 * const level = logger.getLevel();
 * console.log(level); // 'error'
 */
export const getLevel = () => {
  return Object.keys(LOG_LEVELS).find((key) => LOG_LEVELS[key] === currentLevel);
};

/**
 * Log an error message
 *
 * @param {...*} args - Arguments to log
 *
 * @example
 * logger.error('Failed to reload provider:', error);
 */
export const error = (...args) => {
  if (currentLevel >= LOG_LEVELS.error) {
    console.error(...args);
  }
};

/**
 * Log a warning message
 *
 * @param {...*} args - Arguments to log
 *
 * @example
 * logger.warn('Provider is stale:', providerName);
 */
export const warn = (...args) => {
  if (currentLevel >= LOG_LEVELS.warn) {
    console.warn(...args);
  }
};

/**
 * Log an informational message
 *
 * @param {...*} args - Arguments to log
 *
 * @example
 * logger.info('Provider reloaded successfully:', providerName);
 */
export const info = (...args) => {
  if (currentLevel >= LOG_LEVELS.info) {
    console.log(...args);
  }
};

/**
 * Log a debug message
 *
 * @param {...*} args - Arguments to log
 *
 * @example
 * logger.debug('Checking IP:', ipAddress);
 */
export const debug = (...args) => {
  if (currentLevel >= LOG_LEVELS.debug) {
    console.log(...args);
  }
};

export default {
  setLevel,
  getLevel,
  error,
  warn,
  info,
  debug,
  LOG_LEVELS,
};
