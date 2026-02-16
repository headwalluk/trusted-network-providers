/**
 * Integration tests for logger API exposed via index.js
 */

import { jest } from '@jest/globals';
import trustedProviders from '../../src/index.js';

describe('Logger API (index.js)', () => {
  let originalConsoleDebug;
  let originalConsoleError;

  beforeEach(() => {
    // Mock console methods
    originalConsoleDebug = console.debug;
    originalConsoleError = console.error;

    console.debug = jest.fn();
    console.error = jest.fn();

    // Reset to default level
    trustedProviders.setLogLevel('error');

    // Clear providers to ensure test isolation
    while (trustedProviders.getAllProviders().length > 0) {
      trustedProviders.deleteProvider(trustedProviders.getAllProviders()[0].name);
    }
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsoleDebug;
    console.error = originalConsoleError;
  });

  test('should expose setLogLevel and getLogLevel methods', () => {
    expect(trustedProviders.setLogLevel).toBeDefined();
    expect(trustedProviders.getLogLevel).toBeDefined();
  });

  test('should set and get log level via API', () => {
    trustedProviders.setLogLevel('info');
    expect(trustedProviders.getLogLevel()).toBe('info');

    trustedProviders.setLogLevel('debug');
    expect(trustedProviders.getLogLevel()).toBe('debug');

    trustedProviders.setLogLevel('silent');
    expect(trustedProviders.getLogLevel()).toBe('silent');
  });

  test('should throw error on invalid log level', () => {
    expect(() => {
      trustedProviders.setLogLevel('invalid');
    }).toThrow('Invalid log level: invalid');
  });

  test('should suppress diagnostic output at error level', () => {
    trustedProviders.setLogLevel('error');

    // addProvider should not log at error level
    trustedProviders.addProvider({
      name: 'Test Provider',
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    });

    // The debug message from addProvider should not appear
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('should show diagnostic output at debug level', () => {
    trustedProviders.setLogLevel('debug');

    // addProvider should log at debug level
    trustedProviders.addProvider({
      name: 'Test Provider Debug',
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    });

    // The debug message from addProvider should appear
    expect(console.debug).toHaveBeenCalledWith('➕ Add provider: Test Provider Debug');
  });

  test('should suppress all output at silent level', () => {
    trustedProviders.setLogLevel('silent');

    // Even at silent, nothing should log
    trustedProviders.addProvider({
      name: 'Test Provider Silent',
      ipv4: { addresses: [], ranges: [] },
      ipv6: { addresses: [], ranges: [] },
    });

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('should control logging during IP parsing errors', () => {
    trustedProviders.setLogLevel('silent');

    // This should try to parse an invalid IP, but not log anything
    const result = trustedProviders.getTrustedProvider('invalid-ip-silent-test');

    expect(result).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('should log parsing errors at error level', () => {
    trustedProviders.setLogLevel('error');

    // This should try to parse an invalid IP and log the error
    const result = trustedProviders.getTrustedProvider('invalid-ip-error-test');

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
