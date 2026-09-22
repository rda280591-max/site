// ORBIT — ذخیره‌سازی IndexedDB
import { StorageError } from '@/core/errors';
import { Result, Ok, Err } from '@/core/result';
const DB_NAME = 'orbit-db';
const DB_VERSION = 1;

export type StoreName = 'articles' | 'notes' | 'cache';
const STORES: StoreName[] = ['articles', 'notes', 'cache'];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('IndexedDB در این محیط پشتیبانی نمی‌شود.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const os = db.createObjectStore(store, { keyPath: 'id' });
          if (store === 'notes') os.createIndex('updatedAt', 'updatedAt');
          if (store === 'articles') os.createIndex('publishedAt', 'publishedAt');
          if (store === 'cache') os.createIndex('expiresAt', 'expiresAt');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new StorageError('باز کردن IndexedDB ناموفق بود.', {}, req.error));
  });
  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<Result<T>> {
  try {
    const db = await openDb();
    return await new Promise<Result<T>>((resolve) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(Ok(req.result));
      req.onerror = () => resolve(Err(new StorageError('عملیات IndexedDB ناموفق بود.', { storeName }, req.error)));
    });
  } catch (e) {
    return Err(e instanceof StorageError ? e : new StorageError('خطای ناشناخته در IndexedDB.', { storeName }, e));
  }
}

export async function idbPut<T extends { id: string }>(store: StoreName, value: T): Promise<Result<void>> {
  const res = await withStore<IDBValidKey>(store, 'readwrite', (s) => s.put(value));
  return res.ok ? Ok(undefined) : Err(res.error);
}

export async function idbGet<T>(store: StoreName, id: string): Promise<Result<T | undefined>> {
  return withStore<T | undefined>(store, 'readonly', (s) => s.get(id));
}

export async function idbGetAll<T>(store: StoreName): Promise<Result<T[]>> {
  return withStore<T[]>(store, 'readonly', (s) => s.getAll());
}

export async function idbDelete(store: StoreName, id: string): Promise<Result<void>> {
  const res = await withStore<undefined>(store, 'readwrite', (s) => s.delete(id));
  return res.ok ? Ok(undefined) : Err(res.error);
}

export async function idbClear(store: StoreName): Promise<Result<void>> {
  const res = await withStore<undefined>(store, 'readwrite', (s) => s.clear());
  return res.ok ? Ok(undefined) : Err(res.error);
}

export const indexedDbService = {
  put: idbPut,
  get: idbGet,
  getAll: idbGetAll,
  delete: idbDelete,
  clear: idbClear,
};