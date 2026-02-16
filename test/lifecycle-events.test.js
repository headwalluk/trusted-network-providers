/**
 * Lifecycle Events Tests
 *
 * Tests the EventEmitter functionality for provider lifecycle events (reload:start, reload:success, error).
 * Verifies that events are emitted at the correct times with the correct payloads.
 */

import trustedProviders from '../src/index.js';

describe('Lifecycle Events', () => {
  const listeners = [];

  beforeEach(() => {
    // Clean slate before each test - make a copy of the array to avoid mutation issues
    const providers = [...trustedProviders.getAllProviders()];
    providers.forEach((provider) => {
      trustedProviders.deleteProvider(provider.name);
    });
  });

  afterEach(() => {
    // Remove all registered listeners to prevent pollution
    listeners.forEach(({ event, listener }) => {
      trustedProviders.off(event, listener);
    });
    listeners.length = 0;
  });

  // Helper to register a listener and track it for cleanup
  const registerListener = (event, listener) => {
    trustedProviders.on(event, listener);
    listeners.push({ event, listener });
  };

  describe('reload:start event', () => {
    test('should emit reload:start when provider reload begins', async () => {
      const eventData = [];
      const listener = (data) => {
        eventData.push(data);
      };
      registerListener('reload:start', listener);

      const testProvider = {
        name: 'Test Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();

      expect(eventData.length).toBe(1);
      expect(eventData[0]).toEqual({
        provider: 'Test Provider',
      });
    });

    test('should emit reload:start for multiple providers', async () => {
      const eventData = [];
      const listener = (data) => {
        eventData.push(data);
      };
      registerListener('reload:start', listener);

      // Add two providers with reload functions
      const provider1 = {
        name: 'Test Provider 1',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      const provider2 = {
        name: 'Test Provider 2',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      trustedProviders.addProvider(provider1);
      trustedProviders.addProvider(provider2);
      await trustedProviders.reloadAll();

      expect(eventData.length).toBe(2);
      expect(eventData[0].provider).toBe('Test Provider 1');
      expect(eventData[1].provider).toBe('Test Provider 2');
    });
  });

  describe('reload:success event', () => {
    test('should emit reload:success when provider reload succeeds', async () => {
      const eventData = [];
      const listener = (data) => {
        eventData.push(data);
      };
      registerListener('reload:success', listener);

      const testProvider = {
        name: 'Test Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();

      expect(eventData.length).toBe(1);
      expect(eventData[0].provider).toBe('Test Provider');
      expect(eventData[0].timestamp).toBeDefined();
      expect(typeof eventData[0].timestamp).toBe('number');
      expect(eventData[0].timestamp).toBeGreaterThan(0);
    });

    test('should emit reload:success with recent timestamp', async () => {
      const beforeReload = Date.now();
      let eventTimestamp = null;

      const listener = (data) => {
        eventTimestamp = data.timestamp;
      };
      registerListener('reload:success', listener);

      const testProvider = {
        name: 'Test Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();

      const afterReload = Date.now();

      expect(eventTimestamp).toBeGreaterThanOrEqual(beforeReload);
      expect(eventTimestamp).toBeLessThanOrEqual(afterReload);
    });
  });

  describe('error event', () => {
    test('should emit error when provider reload fails', async () => {
      const eventData = [];
      const listener = (data) => {
        eventData.push(data);
      };
      registerListener('error', listener);

      // Create a provider that always fails
      const failingProvider = {
        name: 'Failing Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {
          throw new Error('Reload failed');
        },
      };

      trustedProviders.addProvider(failingProvider);
      await trustedProviders.reloadAll();

      expect(eventData.length).toBe(1);
      expect(eventData[0].provider).toBe('Failing Provider');
      expect(eventData[0].error).toBeInstanceOf(Error);
      expect(eventData[0].error.message).toBe('Reload failed');
      expect(eventData[0].timestamp).toBeDefined();
      expect(typeof eventData[0].timestamp).toBe('number');
    });

    test('should emit error for failing providers while successful ones still succeed', async () => {
      const errorEvents = [];
      const successEvents = [];

      const errorListener = (data) => {
        errorEvents.push(data);
      };
      const successListener = (data) => {
        successEvents.push(data);
      };

      registerListener('error', errorListener);
      registerListener('reload:success', successListener);

      const successfulProvider = {
        name: 'Successful Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      const failingProvider = {
        name: 'Failing Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {
          throw new Error('Reload failed');
        },
      };

      trustedProviders.addProvider(successfulProvider);
      trustedProviders.addProvider(failingProvider);
      await trustedProviders.reloadAll();

      expect(successEvents.length).toBe(1);
      expect(successEvents[0].provider).toBe('Successful Provider');

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].provider).toBe('Failing Provider');
    });
  });

  describe('Event listener management', () => {
    test('should support on() for registering listeners', () => {
      let called = false;
      const listener = () => {
        called = true;
      };

      const result = trustedProviders.on('reload:start', listener);
      listeners.push({ event: 'reload:start', listener });
      expect(result).toBeDefined();
    });

    test('should support once() for one-time listeners', async () => {
      let callCount = 0;
      const listener = () => {
        callCount++;
      };
      trustedProviders.once('reload:success', listener);
      // Don't track once() listeners - they auto-remove

      const testProvider = {
        name: 'Test Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();
      await trustedProviders.reloadAll();

      expect(callCount).toBe(1);
    });

    test('should support off() for removing listeners', async () => {
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      trustedProviders.on('reload:success', listener);
      listeners.push({ event: 'reload:success', listener });

      const testProvider = {
        name: 'Test Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: async () => {},
      };

      trustedProviders.addProvider(testProvider);
      await trustedProviders.reloadAll();

      expect(callCount).toBe(1);

      // Remove the listener
      trustedProviders.off('reload:success', listener);
      // Remove from tracking too
      const index = listeners.findIndex((l) => l.event === 'reload:success' && l.listener === listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }

      // Reload again - listener should not be called
      await trustedProviders.reloadAll();

      expect(callCount).toBe(1);
    });
  });

  describe('Event handling with provider arrays', () => {
    test('should emit events for providers with array reload functions', async () => {
      const successEvents = [];
      const listener = (data) => {
        successEvents.push(data);
      };
      registerListener('reload:success', listener);

      // Create a provider with an array of reload promises
      const multiReloadProvider = {
        name: 'Multi Reload Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: () => [Promise.resolve(), Promise.resolve()],
      };

      trustedProviders.addProvider(multiReloadProvider);
      await trustedProviders.reloadAll();

      // Should emit two success events (one per promise)
      expect(successEvents.length).toBe(2);
      expect(successEvents[0].provider).toBe('Multi Reload Provider');
      expect(successEvents[1].provider).toBe('Multi Reload Provider');
    });

    test('should emit error events for failing promises in array', async () => {
      const errorEvents = [];
      const successEvents = [];

      const errorListener = (data) => {
        errorEvents.push(data);
      };
      const successListener = (data) => {
        successEvents.push(data);
      };

      registerListener('error', errorListener);
      registerListener('reload:success', successListener);

      // Create a provider with mixed success/failure promises
      const mixedProvider = {
        name: 'Mixed Provider',
        ipv4: { addresses: [], ranges: [] },
        ipv6: { addresses: [], ranges: [] },
        reload: () => [
          Promise.resolve(),
          Promise.reject(new Error('Second promise failed')),
        ],
      };

      trustedProviders.addProvider(mixedProvider);
      await trustedProviders.reloadAll();

      expect(successEvents.length).toBe(1);
      expect(successEvents[0].provider).toBe('Mixed Provider');

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].provider).toBe('Mixed Provider');
      expect(errorEvents[0].error.message).toBe('Second promise failed');
    });
  });
});
