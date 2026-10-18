import type { Env } from '../env';
import { HttpError } from '../lib/util';

const SQUARE_VERSION = '2025-01-23';

const base = (env: Env) =>
  env.SQUARE_ENV === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';

export async function sq<T = any>(env: Env, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!env.SQUARE_ACCESS_TOKEN) throw new HttpError(500, 'square_not_configured');
  const res = await fetch(base(env) + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'square-version': SQUARE_VERSION,
      'content-type': 'application/json'
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error('square error', path, res.status, text);
    throw new HttpError(502, 'square_error', data?.errors?.[0]?.detail ?? `HTTP ${res.status}`);
  }
  return data as T;
}
