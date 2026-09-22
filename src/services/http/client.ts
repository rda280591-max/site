// ORBIT — کلاینت HTTP
import { ENDPOINTS, NETWORK } from '@/core/config';
import { NetworkError, TimeoutError, OrbitError, ErrorCode } from '@/core/errors';
import { Result, Err, tryCatch } from '@/core/result';
import { createLogger } from '@/core/logger';

const log = createLogger('services.http');

export interface RequestOptions extends RequestInit {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  retries?: number;
  apiKey?: string;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = path.startsWith('http') ? path : `${ENDPOINTS.newsApi}${path}`;
  if (!query) return base;
  const url = new URL(base);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new TimeoutError('زمان درخواست به پایان رسید.', { url, timeoutMs });
    }
    throw new NetworkError('اتصال به سرور برقرار نشد.', { url }, e);
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(error: unknown, response?: Response): boolean {
  if (response) return response.status >= 500 || response.status === 429;
  return error instanceof NetworkError || error instanceof TimeoutError;
}

export async function request<T = unknown>(options: RequestOptions): Promise<Result<T>> {
  const { path, query, timeoutMs = NETWORK.timeoutMs, retries = NETWORK.retryCount, apiKey, ...init } = options;
  const url = buildUrl(path, query);
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (apiKey) headers.set('X-Api-Key', apiKey);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await tryCatch(async () => {
      const res = await fetchWithTimeout(url, { ...init, headers }, timeoutMs);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new OrbitError(
          `پاسخ نامعتبر از سرور (${res.status})`,
          res.status === 401 ? ErrorCode.UNAUTHORIZED
            : res.status === 403 ? ErrorCode.FORBIDDEN
            : res.status === 404 ? ErrorCode.NOT_FOUND
            : res.status === 429 ? ErrorCode.RATE_LIMIT
            : res.status >= 500 ? ErrorCode.SERVER
            : ErrorCode.UNKNOWN,
          { context: { url, status: res.status, body: body.slice(0, 300) } },
        );
        (err as OrbitError & { response?: Response }).response = res;
        throw err;
      }
      return (await res.json()) as T;
    });

    if (result.ok) return result;

    lastError = result.error;
    const response = (result.error as OrbitError & { response?: Response }).response;

    if (attempt < retries && isRetryable(result.error, response)) {
      const delay = NETWORK.retryDelayMs * Math.pow(2, attempt);
      log.warn(`تلاش مجدد (${attempt + 1}/${retries}) پس از ${delay}ms`, { url });
      await sleep(delay);
      continue;
    }

    log.error('درخواست ناموفق', { url, error: result.error.toJSON() });
    return Err(result.error);
  }

  return Err(lastError instanceof OrbitError
    ? lastError
    : new NetworkError('درخواست پس از چند تلاش ناموفق ماند.', { url }));
}

export function get<T = unknown>(path: string, query?: RequestOptions['query'], apiKey?: string): Promise<Result<T>> {
  return request<T>({ path, query, method: 'GET', apiKey });
}

export const HttpClient = { request, get };