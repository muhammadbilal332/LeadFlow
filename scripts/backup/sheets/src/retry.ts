/**
 * Bounded retry with exponential backoff, for transient Sheets API errors
 * (HTTP 429 rate-limit, 5xx server errors) only. Everything else (4xx other
 * than 429, auth failures, malformed requests) fails immediately — retrying
 * a request that's wrong by construction just delays reporting the real
 * problem.
 */

export class RetryableHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'RetryableHttpError';
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/** Retries `fn` up to maxAttempts times (default 4, i.e. up to 3 retries) only when it throws RetryableHttpError. Backoff: baseDelayMs * 2^attempt, capped implicitly by maxAttempts. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!(err instanceof RetryableHttpError) || isLastAttempt) {
        throw err;
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  // Unreachable (loop always returns or throws), but satisfies the type checker.
  throw lastError;
}
