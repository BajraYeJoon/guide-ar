// Tiny promise-based IndexedDB wrapper used for offline-first storage.
// Stores:
//   targets  — the full target documents (keyed by `_id`)
//   images   — image blobs (keyed by their URL) so the app works offline
//   meta     — key/value metadata (e.g. last successful sync time)

import type { TargetInfo } from "@/lib/types";

const DB_NAME = "guide-ar";
const DB_VERSION = 1;

const STORE_TARGETS = "targets";
const STORE_IMAGES = "images";
const STORE_META = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TARGETS)) {
        db.createObjectStore(STORE_TARGETS, { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: "url" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest | void
): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const objectStore = transaction.objectStore(store);
        let result: T | undefined;
        const request = run(objectStore);
        if (request) {
          request.onsuccess = () => {
            result = request.result as T;
          };
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

// ---- targets ---------------------------------------------------------------

export function putTargets(targets: TargetInfo[]): Promise<unknown> {
  return tx(STORE_TARGETS, "readwrite", (store) => {
    for (const target of targets) store.put(target);
  });
}

export function getTargets(): Promise<TargetInfo[]> {
  return tx<unknown>(STORE_TARGETS, "readonly", (store) => store.getAll()).then(
    (rows) => (rows as TargetInfo[]) ?? []
  );
}

export function clearTargets(): Promise<unknown> {
  return tx(STORE_TARGETS, "readwrite", (store) => store.clear());
}

// ---- images ----------------------------------------------------------------

export function putImage(url: string, blob: Blob): Promise<unknown> {
  return tx(STORE_IMAGES, "readwrite", (store) =>
    store.put({ url, blob })
  );
}

export function getImage(url: string): Promise<Blob | null> {
  return tx<unknown>(STORE_IMAGES, "readonly", (store) => store.get(url)).then(
    (row) => (row && typeof row === "object" && "blob" in row ? (row as { blob: Blob }).blob : null)
  );
}

export function deleteImage(url: string): Promise<unknown> {
  return tx(STORE_IMAGES, "readwrite", (store) => store.delete(url));
}

// ---- meta ------------------------------------------------------------------

export function setMeta(key: string, value: unknown): Promise<unknown> {
  return tx(STORE_META, "readwrite", (store) => store.put({ key, value }));
}

export function getMeta<T>(key: string): Promise<T | null> {
  return tx<unknown>(STORE_META, "readonly", (store) => store.get(key)).then(
    (row) =>
      row && typeof row === "object" && "value" in row
        ? (row as { value: T }).value
        : null
  );
}

// ---- misc ------------------------------------------------------------------

export function clearAll(): Promise<unknown> {
  return Promise.all([
    tx(STORE_TARGETS, "readwrite", (store) => store.clear()),
    tx(STORE_IMAGES, "readwrite", (store) => store.clear()),
    tx(STORE_META, "readwrite", (store) => store.clear()),
  ]);
}
