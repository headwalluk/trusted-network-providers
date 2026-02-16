/**
 * Tests for the logger module
 */

import { jest } from '@jest/globals';
import logger from '../../src/utils/logger.js';

describe('Logger', () => {
  // Store original console methods
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(() => {
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Reset to default level (error) before each test
    logger.setLevel('error');
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('setLevel / getLevel', () => {
    test('should set and get log level', () => {
      logger.setLevel('info');
      expect(logger.getLevel()).toBe('info');

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('silent');
      expect(logger.getLevel()).toBe('silent');
    });

    test('should throw error on invalid log level', () => {
      expect(() => {
        logger.setLevel('invalid');
      }).toThrow('Invalid log level: invalid');
    });

    test('should accept all valid log levels', () => {
      const validLevels = ['silent', 'error', 'warn', 'info', 'debug'];

      validLevels.forEach((level) => {
        expect(() => {
          logger.setLevel(level);
        }).not.toThrow();
        expect(logger.getLevel()).toBe(level);
      });
    });
  });

  describe('silent level', () => {
    beforeEach(() => {
      logger.setLevel('silent');
    });

    test('should suppress all output at silent level', () => {
      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('error level', () => {
    beforeEach(() => {
      logger.setLevel('error');
    });

    test('should only log errors at error level', () => {
      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(console.error).toHaveBeenCalledWith('error message');
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should pass multiple arguments to console.error', () => {
      const error = new Error('test error');
      logger.error('Failed:', error);

      expect(console.error).toHaveBeenCalledWith('Failed:', error);
    });
  });

  describe('warn level', () => {
    beforeEach(() => {
      logger.setLevel('warn');
    });

    test('should log errors and warnings at warn level', () => {
      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(console.error).toHaveBeenCalledWith('error message');
      expect(console.warn).toHaveBeenCalledWith('warn message');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('info level', () => {
    beforeEach(() => {
      logger.setLevel('info');
    });

    test('should log errors, warnings, and info at info level', () => {
      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(console.error).toHaveBeenCalledWith('error message');
      expect(console.warn).toHaveBeenCalledWith('warn message');
      expect(console.log).toHaveBeenCalledWith('info message');
      expect(console.log).toHaveBeenCalledTimes(1); // Not debug
    });
  });

  describe('debug level', () => {
    beforeEach(() => {
      logger.setLevel('debug');
    });

    test('should log all messages at debug level', () => {
      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(console.error).toHaveBeenCalledWith('error message');
      expect(console.warn).toHaveBeenCalledWith('warn message');
      expect(console.log).toHaveBeenCalledWith('info message');
      expect(console.log).toHaveBeenCalledWith('debug message');
      expect(console.log).toHaveBeenCalledTimes(2); // info + debug
    });
  });

  describe('default behavior', () => {
    test('should default to error level', () => {
      // Don't set level explicitly
      expect(logger.getLevel()).toBe('error');
    });
  });

  describe('multiple arguments', () => {
    beforeEach(() => {
      logger.setLevel('debug');
    });

    test('should pass multiple arguments to logger methods', () => {
      const obj = { foo: 'bar' };
      const arr = [1, 2, 3];

      logger.error('error:', obj, arr);
      expect(console.error).toHaveBeenCalledWith('error:', obj, arr);

      logger.warn('warn:', obj);
      expect(console.warn).toHaveBeenCalledWith('warn:', obj);

      logger.info('info:', arr);
      expect(console.log).toHaveBeenCalledWith('info:', arr);

      logger.debug('debug:', obj, arr);
      expect(console.log).toHaveBeenCalledWith('debug:', obj, arr);
    });
  });

  describe('default export', () => {
    test('should export all methods and constants', () => {
      expect(logger.setLevel).toBeDefined();
      expect(logger.getLevel).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.LOG_LEVELS).toBeDefined();
    });

    test('should export LOG_LEVELS constant', () => {
      expect(logger.LOG_LEVELS).toEqual({
        silent: 0,
        error: 1,
        warn: 2,
        info: 3,
        debug: 4,
      });
    });
  });
});
