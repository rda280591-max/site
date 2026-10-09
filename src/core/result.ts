// ORBIT — Result pattern
import { normalizeError, OrbitError } from './errors';

export interface Ok<T> { readonly ok: true; readonly value: T }
export interface Err<E = OrbitError> { readonly ok: false; readonly error: E }
export type Result<T, E = OrbitError> = Ok<T> | Err<E>;

export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function Err<E = OrbitError>(error: E): Err<E> {
  return { ok: false, error };
}

export async function tryCatch<T>(fn: () => T | Promise<T>): Promise<Result<T>> {
  try {
    return Ok(await fn());
  } catch (e) {
    return Err(normalizeError(e));
  }
}

export function tryCatchSync<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn());
  } catch (e) {
    return Err(normalizeError(e));
  }
}