/**
 * offlineCache.js — IndexedDB-backed offline cache for GreenPath
 * =========================================================================
 * Provides a simple key-value store that persists route plans, trip history,
 * and traffic data for offline access. Falls back gracefully if IndexedDB is
 * unavailable (incognito mode edge cases).
 *
 * Usage:
 *   import { cacheSet, cacheGet, cacheDelete, cacheGetAll } from "./offlineCache.js";
 *   await cacheSet("trip_plan", "route_abc123", routeData);
 *   const plan = await cacheGet("trip_plan", "route_abc123");
 */

const DB_NAME    = "greenpath_offline";
const DB_VERSION = 2;

const STORES = {
  TRIP_PLAN:    "trip_plan",
  TRIP_HISTORY: "trip_history",
  TRAFFIC:      "traffic",
  WEATHER:      "weather",
  EV_STATIONS:  "ev_stations",
};

export { STORES };

// ── DB Initialization ─────────────────────────────────────────────────────────
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);

    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.values(STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "cacheKey" });
        }
      });
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────

/**
 * Store a value in the offline cache.
 * @param {string} storeName — one of STORES.*
 * @param {string} key       — unique identifier for the cached entry
 * @param {any}    value     — data to cache (will be JSON-serialized)
 * @param {number} ttlMs     — time-to-live in ms (default 30 min)
 */
export async function cacheSet(storeName, key, value, ttlMs = 30 * 60 * 1000) {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put({
      cacheKey:  key,
      data:      value,
      cachedAt:  Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror    = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("[OfflineCache] cacheSet failed:", err.message);
    return false;
  }
}

/**
 * Retrieve a value from the offline cache.
 * Returns null if not found or expired.
 * @param {string} storeName
 * @param {string} key
 */
export async function cacheGet(storeName, key) {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const record = event.target.result;
        if (!record) return resolve(null);
        if (record.expiresAt && Date.now() > record.expiresAt) {
          // Expired — delete and return null
          cacheDelete(storeName, key);
          return resolve(null);
        }
        resolve(record.data);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("[OfflineCache] cacheGet failed:", err.message);
    return null;
  }
}

/**
 * Delete a specific entry from the cache.
 */
export async function cacheDelete(storeName, key) {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    return new Promise((resolve) => { tx.oncomplete = () => resolve(true); });
  } catch (err) {
    console.warn("[OfflineCache] cacheDelete failed:", err.message);
    return false;
  }
}

/**
 * Get all non-expired entries from a store.
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export async function cacheGetAll(storeName) {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const now = Date.now();
        const valid = (event.target.result || [])
          .filter((r) => !r.expiresAt || now < r.expiresAt)
          .map((r) => ({ key: r.cacheKey, data: r.data, cachedAt: r.cachedAt }));
        resolve(valid);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn("[OfflineCache] cacheGetAll failed:", err.message);
    return [];
  }
}

/**
 * Clear all entries in a store (e.g., on logout).
 * @param {string} storeName — if omitted, clears ALL stores
 */
export async function cacheClear(storeName) {
  try {
    const db = await openDB();
    const stores = storeName ? [storeName] : Object.values(STORES);
    const tx = db.transaction(stores, "readwrite");
    stores.forEach((s) => tx.objectStore(s).clear());
    return new Promise((resolve) => { tx.oncomplete = () => resolve(true); });
  } catch (err) {
    console.warn("[OfflineCache] cacheClear failed:", err.message);
    return false;
  }
}

/**
 * Check if we have cached data for a given key.
 */
export async function cacheHas(storeName, key) {
  const val = await cacheGet(storeName, key);
  return val !== null;
}
