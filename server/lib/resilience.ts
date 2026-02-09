import { createModuleLogger } from './logger';

const log = createModuleLogger('resilience');

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      log.error({ label, timeoutMs }, 'External call timed out');
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    label: string;
  }
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, label } = options;
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        log.warn({ label, attempt: attempt + 1, maxRetries, delay: Math.round(delay) }, 'Retrying external call');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  log.error({ label, maxRetries }, 'All retry attempts exhausted');
  throw lastError!;
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly label: string,
    private readonly threshold: number = 5,
    private readonly resetTimeMs: number = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
        this.state = 'half-open';
        log.info({ label: this.label }, 'Circuit breaker half-open, allowing test request');
      } else {
        log.warn({ label: this.label }, 'Circuit breaker open, rejecting request');
        throw new Error(`Circuit breaker open for ${this.label}`);
      }
    }
    
    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        log.info({ label: this.label }, 'Circuit breaker closed, service recovered');
      }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
        log.error({ label: this.label, failures: this.failures }, 'Circuit breaker opened');
      }
      throw err;
    }
  }
}

export const repliersCircuit = new CircuitBreaker('repliers-api', 5, 60000);
export const slackCircuit = new CircuitBreaker('slack-api', 5, 30000);
export const openaiCircuit = new CircuitBreaker('openai-api', 3, 120000);
