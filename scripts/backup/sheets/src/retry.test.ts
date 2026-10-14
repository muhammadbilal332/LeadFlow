import { describe, it, expect, vi } from 'vitest';
import { withRetry, RetryableHttpError, isRetryableStatus } from './retry.js';

describe('isRetryableStatus', () => {
  it('treats 429 and 5xx as retryable', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('treats other statuses as non-retryable', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns immediately on first success, no retries', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await withRetry(fn, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a retryable error and eventually succeeds, with exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableHttpError(429, 'rate limited'))
      .mockRejectedValueOnce(new RetryableHttpError(500, 'server error'))
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await withRetry(fn, { sleep, baseDelayMs: 100 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 100); // 100 * 2^0
    expect(sleep).toHaveBeenNthCalledWith(2, 200); // 100 * 2^1
  });

  it('is bounded — stops after maxAttempts and throws, never retries forever', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError(503, 'always fails'));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(withRetry(fn, { sleep, maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('never retries a non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('bad request'));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(withRetry(fn, { sleep })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
