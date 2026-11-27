/**
 * IndexedDB wrapper for AnimeStock Offline-First
 * Provides products, mutations, and meta stores with proper transaction handling.
 * No external dependencies - uses native IndexedDB API.
 */

(function (global) {
  'use strict';

  const DB_NAME = 'AnimeStockDB';
  const DB_VERSION = 1;

  // Store configurations
  const STORE_CONFIG = {
    products: {
      name: 'products',
      keyPath: 'localId',
      autoIncrement: false,
      indexes: [
        { name: 'by_server_id', keyPath: 'serverId', unique: true },
        { name: 'by_sku', keyPath: 'sku', unique: true },
        { name: 'by_status', keyPath: 'syncStatus' },
        { name: 'by_updated_at', keyPath: 'updatedAt' }
      ]
    },
    mutations: {
      name: 'mutations',
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'by_entity_op', keyPath: ['entity', 'operation'] },
        { name: 'by_status', keyPath: 'status' },
        { name: 'by_local_id', keyPath: 'localId' },
        { name: 'by_idempotency_key', keyPath: 'idempotencyKey', unique: true }
      ]
    },
    meta: {
      name: 'meta',
      keyPath: 'key',
      autoIncrement: false,
      indexes: []
    }
  };

  // Default meta keys
  const META_DEFAULTS = {
    lastSync: null,
    serverTimeOffset: 0,
    syncInProgress: false
  };

  // Internal state
  let db = null;
  let initPromise = null;
  const listeners = new Map();

  // Helper: emit event to listeners
  function emit(eventName, detail) {
    const event = new CustomEvent('indexeddb:' + eventName, { detail });
    global.dispatchEvent(event);
    const callbacks = listeners.get(eventName) || [];
    callbacks.forEach(cb => {
      try { cb(detail); } catch (e) { console.error('[IndexedDB] Listener error:', e); }
    });
  }

  // Helper: open database with schema creation/upgrade
  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);

      const request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('IndexedDB open failed: ' + request.error));
      request.onsuccess = () => {
        db = request.result;
        db.onerror = (e) => console.error('[IndexedDB] Database error:', e.target.error);
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // Create stores if they don't exist
        Object.values(STORE_CONFIG).forEach(config => {
          let store;
          if (!database.objectStoreNames.contains(config.name)) {
            store = database.createObjectStore(config.name, {
              keyPath: config.keyPath,
              autoIncrement: config.autoIncrement
            });
          } else {
            store = event.target.transaction.objectStore(config.name);
          }

          // Create indexes
          config.indexes.forEach(idx => {
            const indexName = idx.name;
            if (!store.indexNames.contains(indexName)) {
              try {
                store.createIndex(indexName, idx.keyPath, { unique: idx.unique || false });
              } catch (e) {
                console.warn('[IndexedDB] Could not create index', indexName, ':', e.message);
              }
            }
          });
        });
      };
    });
  }

  // Initialize database (idempotent)
  function init() {
    if (!initPromise) {
      initPromise = openDatabase().then(database => {
        // Ensure meta defaults exist
        return ensureMetaDefaults(database).then(() => database);
      });
    }
    return initPromise;
  }

  // Ensure meta keys exist
  function ensureMetaDefaults(database) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_CONFIG.meta.name, 'readwrite');
      const store = tx.objectStore(STORE_CONFIG.meta.name);

      Object.entries(META_DEFAULTS).forEach(([key, value]) => {
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          if (getReq.result === undefined) {
            store.put({ key, value });
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Generic transaction helper
  function runTransaction(storeNames, mode, callback) {
    return init().then(database => {
      return new Promise((resolve, reject) => {
        const tx = database.transaction(storeNames, mode);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted'));
        try {
          const result = callback(tx);
          tx.oncomplete = () => resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  // ==========================================
  // PRODUCTS STORE OPERATIONS
  // ==========================================

  /**
   * Insert or update a product (upsert by localId)
   * @param {Object} product - Product object with localId (UUID), optional serverId
   * @returns {Promise<string>} localId of the stored product
   */
  function putProduct(product) {
    if (!product || !product.localId) {
      return Promise.reject(new Error('Product must have a localId'));
    }

    const now = new Date().toISOString();
    const record = {
      ...product,
      updatedAt: now,
      createdAt: product.createdAt || now,
      syncStatus: product.syncStatus || 'pending',
      version: typeof product.version === 'number' ? product.version : 0
    };

    return runTransaction([STORE_CONFIG.products.name], 'readwrite', tx => {
      const store = tx.objectStore(STORE_CONFIG.products.name);
      store.put(record);
      return record.localId;
    }).then(localId => {
      emit('product-upserted', { localId, syncStatus: record.syncStatus });
      return localId;
    });
  }

  /**
   * Get a product by localId
   * @param {string} localId
   * @returns {Promise<Object|null>}
   */
  function getProduct(localId) {
    return runTransaction([STORE_CONFIG.products.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.products.name);
        const req = store.get(localId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get a product by serverId (index lookup)
   * @param {number} serverId
   * @returns {Promise<Object|null>}
   */
  function getProductByServerId(serverId) {
    if (serverId === null || serverId === undefined) return Promise.resolve(null);
    return runTransaction([STORE_CONFIG.products.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.products.name);
        const index = store.index('by_server_id');
        const req = index.get(serverId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get all products, optionally filtered by syncStatus
   * @param {string} [syncStatus] - 'synced' | 'pending' | 'error'
   * @returns {Promise<Array>}
   */
  function getAllProducts(syncStatus) {
    return runTransaction([STORE_CONFIG.products.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.products.name);
        const req = store.getAll();
        req.onsuccess = () => {
          let results = req.result || [];
          if (syncStatus) {
            results = results.filter(p => p.syncStatus === syncStatus);
          }
          // Sort by updatedAt descending (most recent first)
          results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get products by syncStatus using index
   * @param {string} syncStatus
   * @returns {Promise<Array>}
   */
  function getProductsByStatus(syncStatus) {
    return runTransaction([STORE_CONFIG.products.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.products.name);
        const index = store.index('by_status');
        const req = index.getAll(syncStatus);
        req.onsuccess = () => {
          const results = (req.result || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Update specific fields of a product (partial update)
   * @param {string} localId
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated product
   */
  function updateProduct(localId, updates) {
    return getProduct(localId).then(existing => {
      if (!existing) return Promise.reject(new Error('Product not found: ' + localId));
      const merged = { ...existing, ...updates, localId }; // Preserve localId
      return putProduct(merged).then(() => getProduct(localId));
    });
  }

  /**
   * Delete a product by localId
   * @param {string} localId
   * @returns {Promise<boolean>}
   */
  function deleteProduct(localId) {
    return runTransaction([STORE_CONFIG.products.name], 'readwrite', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.products.name);
        const req = store.delete(localId);
        req.onsuccess = () => {
          emit('product-deleted', { localId });
          resolve(true);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Count products by syncStatus
   * @param {string} [syncStatus]
   * @returns {Promise<number>}
   */
  function countProducts(syncStatus) {
    return getAllProducts(syncStatus).then(arr => arr.length);
  }

  // ==========================================
  // MUTATIONS STORE OPERATIONS
  // ==========================================

  /**
   * Add a mutation to the queue (or upsert by idempotencyKey)
   * @param {Object} mutation - { entity, operation, localId, payload, idempotencyKey, ... }
   * @returns {Promise<number>} mutation id (auto-increment)
   */
  function addMutation(mutation) {
    const record = {
      entity: mutation.entity || 'product',
      operation: mutation.operation, // 'create' | 'update'
      localId: mutation.localId,
      payload: mutation.payload,
      idempotencyKey: mutation.idempotencyKey,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return runTransaction([STORE_CONFIG.mutations.name], 'readwrite', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const req = store.put(record); // put with idempotencyKey unique index handles upsert
        req.onsuccess = () => {
          emit('mutation-added', { idempotencyKey: record.idempotencyKey });
          resolve(req.result); // returns the auto-increment id
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get a mutation by idempotencyKey
   * @param {string} idempotencyKey
   * @returns {Promise<Object|null>}
   */
  function getMutationByIdempotencyKey(idempotencyKey) {
    return runTransaction([STORE_CONFIG.mutations.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const index = store.index('by_idempotency_key');
        const req = index.get(idempotencyKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get pending mutations (status = 'pending')
   * @returns {Promise<Array>}
   */
  function getPendingMutations() {
    return runTransaction([STORE_CONFIG.mutations.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const index = store.index('by_status');
        const req = index.getAll('pending');
        req.onsuccess = () => {
          const results = (req.result || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get all mutations by status
   * @param {string} status - 'pending' | 'syncing' | 'done' | 'error'
   * @returns {Promise<Array>}
   */
  function getMutationsByStatus(status) {
    return runTransaction([STORE_CONFIG.mutations.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const index = store.index('by_status');
        const req = index.getAll(status);
        req.onsuccess = () => {
          const results = (req.result || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Get mutations for a specific localId
   * @param {string} localId
   * @returns {Promise<Array>}
   */
  function getMutationsByLocalId(localId) {
    return runTransaction([STORE_CONFIG.mutations.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const index = store.index('by_local_id');
        const req = index.getAll(localId);
        req.onsuccess = () => {
          const results = (req.result || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Update mutation status and fields
   * @param {number} mutationId
   * @param {Object} updates - { status, retryCount, lastError, nextRetryAt, serverId }
   * @returns {Promise<boolean>}
   */
  function updateMutation(mutationId, updates) {
    return runTransaction([STORE_CONFIG.mutations.name], 'readwrite', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const getReq = store.get(mutationId);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (!existing) return resolve(false);
          const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
          const putReq = store.put(merged);
          putReq.onsuccess = () => {
            emit('mutation-updated', { id: mutationId, status: merged.status });
            resolve(true);
          };
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    });
  }

  /**
   * Update mutation status by idempotencyKey (convenience)
   * @param {string} idempotencyKey
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  function updateMutationByIdempotencyKey(idempotencyKey, updates) {
    return getMutationByIdempotencyKey(idempotencyKey).then(mut => {
      if (!mut) return Promise.reject(new Error('Mutation not found: ' + idempotencyKey));
      return updateMutation(mut.id, updates);
    });
  }

  /**
   * Delete a mutation by id
   * @param {number} mutationId
   * @returns {Promise<boolean>}
   */
  function deleteMutation(mutationId) {
    return runTransaction([STORE_CONFIG.mutations.name], 'readwrite', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.mutations.name);
        const req = store.delete(mutationId);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Count pending mutations
   * @returns {Promise<number>}
   */
  function countPendingMutations() {
    return getPendingMutations().then(arr => arr.length);
  }

  // ==========================================
  // META STORE OPERATIONS
  // ==========================================

  /**
   * Get a meta value by key
   * @param {string} key
   * @returns {Promise<any>}
   */
  function getMeta(key) {
    return runTransaction([STORE_CONFIG.meta.name], 'readonly', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.meta.name);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : META_DEFAULTS[key]);
        req.onerror = () => reject(req.error);
      });
    });
  }

  /**
   * Set a meta value
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  function setMeta(key, value) {
    return runTransaction([STORE_CONFIG.meta.name], 'readwrite', tx => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(STORE_CONFIG.meta.name);
        const req = store.put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  // ==========================================
  // EVENT LISTENER HELPERS
  // ==========================================

  /**
   * Subscribe to IndexedDB events
   * @param {string} eventName - 'product-upserted' | 'product-deleted' | 'mutation-added' | 'mutation-updated'
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  function on(eventName, callback) {
    if (!listeners.has(eventName)) listeners.set(eventName, []);
    listeners.get(eventName).push(callback);
    return () => {
      const arr = listeners.get(eventName) || [];
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  // ==========================================
  // UTILITY: Generate localId (UUID v4)
  // ==========================================
  function generateLocalId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers (should not happen in modern environments)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  const idb = {
    // Lifecycle
    init,
    openDatabase,

    // Products
    putProduct,
    getProduct,
    getProductByServerId,
    getAllProducts,
    getProductsByStatus,
    updateProduct,
    deleteProduct,
    countProducts,

    // Mutations
    addMutation,
    getMutationByIdempotencyKey,
    getPendingMutations,
    getMutationsByStatus,
    getMutationsByLocalId,
    updateMutation,
    updateMutationByIdempotencyKey,
    deleteMutation,
    countPendingMutations,

    // Meta
    getMeta,
    setMeta,

    // Events
    on,

    // Utils
    generateLocalId,

    // Store names (for debugging)
    STORES: {
      PRODUCTS: STORE_CONFIG.products.name,
      MUTATIONS: STORE_CONFIG.mutations.name,
      META: STORE_CONFIG.meta.name
    }
  };

  // Expose globally
  global.AnimeStockIDB = idb;

  // Also support ES module style if needed
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = idb;
  }

  // Auto-initialize on load (non-blocking)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => idb.init().catch(console.error));
  } else {
    idb.init().catch(console.error);
  }

})(typeof window !== 'undefined' ? window : globalThis);