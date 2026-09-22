// ORBIT — الگوی Result
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

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false;
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

export function mapResult<T, U, E>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return r.ok ? Ok(fn(r.value)) : r;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

export function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.value;
  throw r.error;
}