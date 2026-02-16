/**
 * Tests for secure-http-client.js
 * 
 * Covers the native fetch implementation with:
 * - HTTPS enforcement
 * - Timeout handling
 * - Retry logic
 * - Checksum verification
 * - Error handling
 */

import {
  fetchJSON,
  fetchText,
  fetchXML,
  calculateSHA256,
  verifyChecksum,
  DEFAULT_CONFIG,
} from '../src/utils/secure-http-client.js';

// Mock global fetch
global.fetch = jest.fn();

// Helper to create mock Response
const createMockResponse = (body, status = 200, statusText = 'OK') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  text: jest.fn().mockResolvedValue(body),
  arrayBuffer: jest.fn().mockResolvedValue(Buffer.from(body)),
});

describe('calculateSHA256', () => {
  it('should calculate correct SHA-256 hash', () => {
    const hash = calculateSHA256('test data');
    expect(hash).toBe('916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
  });

  it('should handle Buffer input', () => {
    const hash = calculateSHA256(Buffer.from('test data'));
    expect(hash).toBe('916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
  });
});

describe('verifyChecksum', () => {
  it('should pass for matching checksum', () => {
    const data = 'test data';
    const checksum = '916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9';
    expect(() => verifyChecksum(data, checksum, 'https://example.com')).not.toThrow();
  });

  it('should throw for mismatched checksum', () => {
    const data = 'test data';
    const wrongChecksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(() => verifyChecksum(data, wrongChecksum, 'https://example.com')).toThrow(
      /Checksum verification failed/
    );
  });
});

describe('fetchJSON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully fetch and parse JSON', async () => {
    const mockData = { test: 'value' };
    global.fetch.mockResolvedValue(createMockResponse(JSON.stringify(mockData)));

    const result = await fetchJSON('https://example.com/data.json');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/data.json',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
  });

  it('should reject HTTP URLs', async () => {
    await expect(fetchJSON('http://example.com/data.json')).rejects.toThrow(
      /Insecure URL rejected.*Only HTTPS URLs are allowed/
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle 404 errors without retry', async () => {
    global.fetch.mockResolvedValue(createMockResponse('Not Found', 404, 'Not Found'));

    await expect(fetchJSON('https://example.com/missing.json')).rejects.toThrow(/HTTP 404 error/);
    expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('should handle 403 errors without retry', async () => {
    global.fetch.mockResolvedValue(createMockResponse('Forbidden', 403, 'Forbidden'));

    await expect(fetchJSON('https://example.com/forbidden.json')).rejects.toThrow(/HTTP 403 error/);
    expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('should handle 401 errors without retry', async () => {
    global.fetch.mockResolvedValue(createMockResponse('Unauthorized', 401, 'Unauthorized'));

    await expect(fetchJSON('https://example.com/auth.json')).rejects.toThrow(/HTTP 401 error/);
    expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
  });

  it('should retry on 500 errors', async () => {
    global.fetch
      .mockResolvedValueOnce(createMockResponse('Server Error', 500, 'Internal Server Error'))
      .mockResolvedValueOnce(createMockResponse(JSON.stringify({ success: true })));

    const result = await fetchJSON('https://example.com/retry.json');

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('should throw on empty response body', async () => {
    global.fetch.mockResolvedValue(createMockResponse(''));

    await expect(fetchJSON('https://example.com/empty.json')).rejects.toThrow(
      /Empty response body received/
    );
  });

  it('should throw on invalid JSON', async () => {
    global.fetch.mockResolvedValue(createMockResponse('not valid json'));

    await expect(fetchJSON('https://example.com/invalid.json')).rejects.toThrow(
      /Failed to parse JSON/
    );
  });

  it('should verify checksum when provided', async () => {
    const mockData = { test: 'value' };
    const jsonString = JSON.stringify(mockData);
    const checksum = calculateSHA256(jsonString);

    global.fetch.mockResolvedValue(createMockResponse(jsonString));

    const result = await fetchJSON('https://example.com/data.json', {
      expectedChecksum: checksum,
    });

    expect(result).toEqual(mockData);
  });

  it('should throw on checksum mismatch', async () => {
    const mockData = { test: 'value' };
    const wrongChecksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    global.fetch.mockResolvedValue(createMockResponse(JSON.stringify(mockData)));

    await expect(
      fetchJSON('https://example.com/data.json', {
        expectedChecksum: wrongChecksum,
      })
    ).rejects.toThrow(/Checksum verification failed/);
  });

  it('should verify structure when callback provided', async () => {
    const mockData = { requiredField: 'value' };
    global.fetch.mockResolvedValue(createMockResponse(JSON.stringify(mockData)));

    const verifyStructure = (body) => body && body.requiredField;

    const result = await fetchJSON('https://example.com/data.json', {
      verifyStructure,
    });

    expect(result).toEqual(mockData);
  });

  it('should throw on structure verification failure', async () => {
    const mockData = { wrongField: 'value' };
    global.fetch.mockResolvedValue(createMockResponse(JSON.stringify(mockData)));

    const verifyStructure = (body) => body && body.requiredField;

    await expect(
      fetchJSON('https://example.com/data.json', {
        verifyStructure,
      })
    ).rejects.toThrow(/Structure verification failed/);
  });

  it('should respect custom timeout', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch.mockRejectedValue(abortError);

    await expect(
      fetchJSON('https://example.com/slow.json', {
        timeout: 100,
        retries: 0,
      })
    ).rejects.toThrow(/Request timeout.*after 100ms/);
  });

  it('should retry with exponential backoff', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    global.fetch
      .mockRejectedValueOnce(abortError)
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(createMockResponse(JSON.stringify({ success: true })));

    const startTime = Date.now();
    const result = await fetchJSON('https://example.com/timeout.json', {
      retries: 2,
      retryDelay: 100,
    });
    const duration = Date.now() - startTime;

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    // Should have delays: 100ms + 200ms = 300ms minimum
    expect(duration).toBeGreaterThanOrEqual(250);
  });

  it('should exhaust retries and throw', async () => {
    const networkError = new Error('Network failure');
    global.fetch.mockRejectedValue(networkError);

    await expect(
      fetchJSON('https://example.com/fail.json', {
        retries: 1,
        retryDelay: 10,
      })
    ).rejects.toThrow(/Failed to fetch.*after 2 attempts/);

    expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });
});

describe('fetchText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully fetch text', async () => {
    const mockText = 'plain text response';
    global.fetch.mockResolvedValue(createMockResponse(mockText));

    const result = await fetchText('https://example.com/data.txt');

    expect(result).toBe(mockText);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/data.txt',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'text/plain' },
      })
    );
  });

  it('should reject HTTP URLs', async () => {
    await expect(fetchText('http://example.com/data.txt')).rejects.toThrow(
      /Insecure URL rejected/
    );
  });

  it('should handle 404 errors without retry', async () => {
    global.fetch.mockResolvedValue(createMockResponse('Not Found', 404));

    await expect(fetchText('https://example.com/missing.txt')).rejects.toThrow(/HTTP 404 error/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(createMockResponse('success'));

    const result = await fetchText('https://example.com/retry.txt');

    expect(result).toBe('success');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('fetchXML', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully fetch XML as buffer', async () => {
    const mockXML = '<root><data>value</data></root>';
    global.fetch.mockResolvedValue(createMockResponse(mockXML));

    const result = await fetchXML('https://example.com/data.xml');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe(mockXML);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/data.xml',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/xml' },
      })
    );
  });

  it('should reject HTTP URLs', async () => {
    await expect(fetchXML('http://example.com/data.xml')).rejects.toThrow(
      /Insecure URL rejected/
    );
  });

  it('should handle 404 errors without retry', async () => {
    global.fetch.mockResolvedValue(createMockResponse('Not Found', 404));

    await expect(fetchXML('https://example.com/missing.xml')).rejects.toThrow(/HTTP 404 error/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    const mockXML = '<root><data>value</data></root>';
    global.fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(createMockResponse(mockXML));

    const result = await fetchXML('https://example.com/retry.xml');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe(mockXML);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('should export default configuration', () => {
    expect(DEFAULT_CONFIG).toEqual({
      timeout: 30000,
      retries: 2,
      retryDelay: 1000,
    });
  });
});
