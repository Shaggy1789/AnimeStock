/**
 * AnimeStock - Motor de sincronizacion Offline-First.
 *
 * - Detecta conexion con eventos online/offline.
 * - Procesa en orden las mutaciones pendientes de IndexedDB.
 * - Reintenta solo operaciones seguras (UPDATE idempotente).
 * - No reintenta CREATE: el backend todavia no garantiza idempotencia
 *   (se implementara en la Fase 3). El adaptador ya envia la cabecera
 *   X-Idempotency-Key para cuando el backend la soporte.
 * - No usa Background Sync.
 */

(function (global) {
  'use strict';

  const IDB = global.AnimeStockIDB;
  const Products = global.AnimeStockProducts;

  const API_BASE = '';
  // 3 reintentos DESPUES del intento inicial (4 intentos en total).
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [5000, 15000, 60000];
  // Una mutacion 'syncing' mas antigua se considera abandonada. Evita robarle
  // una operacion a otra pestaña que todavia esta esperando la respuesta.
  const STALE_SYNCING_MS = 2 * 60 * 1000;
  const AUTO_INTERVAL = 45000;
  const REQUEST_TIMEOUT = 12000;

  const STATUS_PENDING = 'pending';
  const STATUS_SYNCING = 'syncing';
  const STATUS_DONE = 'done';
  const STATUS_ERROR = 'error';
  const PRODUCT_PENDING = 'pending';
  const PRODUCT_SYNCED = 'synced';
  const PRODUCT_ERROR = 'error';

  const state = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    syncing: false,
    lastSync: null,
    lastError: null,
    counts: { total: 0, pending: 0, error: 0, synced: 0, mutations: 0 },
    started: false
  };

  let running = null;
  let timer = null;
  let scheduled = null;
  let recoveryPromise = null;
  let lastEmitted = '';

  // -------------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------------

  function nowIso() {
    return new Date().toISOString();
  }

  function isOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  }

  function byCreated(a, b) {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (diff !== 0) return diff;
    return (a.id || 0) - (b.id || 0);
  }

  function request(url, options) {
    const controller = new AbortController();
    const timerId = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .catch(function (error) {
        if (error && error.name === 'AbortError') {
          const timeout = new Error('La solicitud tard\u00f3 demasiado');
          timeout.timeout = true;
          timeout.retryable = true;
          throw timeout;
        }
        if (error) error.retryable = true;
        throw error;
      })
      .finally(function () { clearTimeout(timerId); });
  }

  async function callApi(url, options) {
    const res = await request(url, options);
    if (res.ok) return res;

    let message = 'La API respondi\u00f3 ' + res.status;
    let body = null;
    try {
      body = await res.json();
      if (body && typeof body.message === 'string' && body.message) {
        message = body.message;
      }
    } catch (error) { /* respuesta sin JSON */ }

    const failure = new Error(message);
    failure.status = res.status;
    failure.body = body;
    failure.retryable = res.status === 408 || res.status === 425
      || res.status === 429 || res.status >= 500;
    throw failure;
  }

  function emitStatus() {
    const detail = {
      online: state.online,
      syncing: state.syncing,
      lastSync: state.lastSync,
      lastError: state.lastError,
      counts: Object.assign({}, state.counts)
    };
    const signature = JSON.stringify(detail);
    if (signature === lastEmitted) return;
    lastEmitted = signature;
    try {
      global.dispatchEvent(new CustomEvent('animestock:sync-status', { detail: detail }));
    } catch (error) { /* entorno sin CustomEvent */ }
  }

  async function refreshStatus(extra) {
    try {
      if (Products && typeof Products.getSummary === 'function') {
        state.counts = await Products.getSummary();
      }
      state.counts.mutations = await IDB.countPendingMutations();
      state.lastSync = await IDB.getMeta('lastSync');
    } catch (error) {
      console.warn('[AnimeStock Sync] No se pudo leer el estado local:', error);
    }
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'lastError')) {
      state.lastError = extra.lastError;
    }
    emitStatus();
  }

  // -------------------------------------------------------------------------
  // Adaptador HTTP
  // -------------------------------------------------------------------------

  const adapter = {
    createProduct: function (payload, mutation) {
      return callApi(API_BASE + '/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Preparado para Fase 3: el backend actual todavia la ignora.
          'X-Idempotency-Key': mutation.idempotencyKey || ''
        },
        body: JSON.stringify(payload || {})
      });
    },
    updateProduct: function (serverId, payload, mutation) {
      return callApi(API_BASE + '/api/products/' + serverId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Idempotency-Key': mutation.idempotencyKey || ''
        },
        body: JSON.stringify(payload || {})
      });
    }
  };

  // -------------------------------------------------------------------------
  // Recuperacion de estados inciertos (pestana cerrada a mitad de envio)
  // -------------------------------------------------------------------------

  function ensureRecovered() {
    if (!recoveryPromise) {
      recoveryPromise = recoverStale().finally(function () { recoveryPromise = null; });
    }
    return recoveryPromise;
  }

  async function recoverStale() {
    const stale = await IDB.getMutationsByStatus(STATUS_SYNCING);
    const now = Date.now();

    for (let i = 0; i < stale.length; i++) {
      const mutation = stale[i];
      const attemptedAt = mutation.lastAttemptAt || mutation.updatedAt || mutation.createdAt;
      const age = attemptedAt ? now - new Date(attemptedAt).getTime() : Infinity;
      if (Number.isFinite(age) && age < STALE_SYNCING_MS) continue;

      if (mutation.operation === 'create') {
        const message = 'La creación quedó en estado incierto: la aplicación se cerró durante el envío. '
          + 'No se reintenta para evitar duplicados; requiere revisión manual (Fase 3).';
        await IDB.updateMutation(mutation.id, {
          status: STATUS_ERROR,
          retryCount: (mutation.retryCount || 0) + 1,
          lastError: message,
          nextRetryAt: null,
          updatedAt: nowIso()
        });
        const product = await IDB.getProduct(mutation.localId);
        if (product) {
          product.syncStatus = PRODUCT_ERROR;
          product.lastError = message;
          await IDB.putProduct(product);
        }
      } else {
        // Un UPDATE abandonado vuelve a encolarse con metadatos limpios (M5).
        await IDB.updateMutation(mutation.id, {
          status: STATUS_PENDING,
          retryCount: 0,
          lastError: null,
          nextRetryAt: null,
          updatedAt: nowIso()
        });
        const product = await IDB.getProduct(mutation.localId);
        if (product) {
          product.syncStatus = PRODUCT_PENDING;
          product.lastError = null;
          await IDB.putProduct(product);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Procesamiento de la cola
  // -------------------------------------------------------------------------

  async function claimMutation(mutation) {
    // Lectura + cambio a 'syncing' en una unica transaccion (H2).
    return IDB.claimMutation(mutation.idempotencyKey);
  }

  async function queueFollowUpUpdate(product) {
    const payload = Products.recordToServerPayload(product);
    const mutations = await IDB.getMutationsByLocalId(product.localId);
    const pending = mutations.filter(function (mutation) {
      return mutation.operation === 'update' && mutation.status !== STATUS_DONE;
    }).sort(byCreated)[0];

    if (pending) {
      await IDB.updateMutation(pending.id, {
        payload: payload,
        status: STATUS_PENDING,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        updatedAt: nowIso()
      });
      return;
    }

    await IDB.upsertMutation({
      entity: 'product',
      operation: 'update',
      localId: product.localId,
      idempotencyKey: 'product-update-' + product.localId + '-' + Date.now(),
      payload: payload
    });
  }

  async function completeSuccess(mutation, server, snapshot) {
    const currentMutation = await IDB.getMutationByIdempotencyKey(mutation.idempotencyKey);
    const currentProduct = await IDB.getProduct(mutation.localId);

    const payloadChanged = !currentMutation
      || JSON.stringify(currentMutation.payload || {}) !== snapshot.payload;
    // Si al reclamar no habia producto (snapshot null), no hubo cambio que
    // detectar: solo compara cuando existia una copia local previa (M3).
    const productChanged = !!(currentProduct && snapshot.productUpdatedAt !== null
      && currentProduct.updatedAt !== snapshot.productUpdatedAt);

    await IDB.updateMutation(mutation.id, {
      status: STATUS_DONE,
      lastError: null,
      serverId: server && server.id !== undefined ? server.id : snapshot.serverId,
      syncedAt: nowIso(),
      updatedAt: nowIso()
    });

    if (!currentProduct || !server) return;

    if (payloadChanged || productChanged) {
      // Llego una edicion mientras la peticion estaba en vuelo: el servidor
      // ya tiene el estado anterior. Conservamos el estado local y encolamos
      // un UPDATE con el estado final.
      if (server.id !== undefined && server.id !== null) currentProduct.serverId = server.id;
      currentProduct.syncStatus = PRODUCT_PENDING;
      currentProduct.lastError = null;
      await IDB.putProduct(currentProduct);
      await queueFollowUpUpdate(currentProduct);
      return;
    }

    Products.mergeServerResponse(currentProduct, server);
    currentProduct.syncStatus = PRODUCT_SYNCED;
    currentProduct.lastError = null;
    await IDB.putProduct(currentProduct);
  }

  async function completeFailure(mutation, error) {
    const product = await IDB.getProduct(mutation.localId);
    // Leer el estado actual evita usar un contador obsoleto si otra pestaña
    // o una edicion local reencolo la mutacion mientras estaba en vuelo.
    const current = await IDB.getMutationByIdempotencyKey(mutation.idempotencyKey) || mutation;
    const isCreate = mutation.operation === 'create';
    const retryable = !!error.retryable && !isCreate;
    const retryCount = (current.retryCount || 0) + 1;

    let message = (error && error.message) || 'No se pudo sincronizar la operacion.';
    if (isCreate) {
      message += ' No se reintenta automaticamente para evitar duplicados.';
    }

    // retryCount cuenta los reintentos ya programados: 1 -> 5s, 2 -> 15s, 3 -> 60s.
    if (retryable && retryCount <= MAX_RETRIES) {
      const delay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)];
      await IDB.updateMutation(mutation.id, {
        status: STATUS_PENDING,
        retryCount: retryCount,
        lastError: message,
        nextRetryAt: new Date(Date.now() + delay).toISOString(),
        updatedAt: nowIso()
      });
      if (product) {
        product.syncStatus = PRODUCT_PENDING;
        product.lastError = message;
        await IDB.putProduct(product);
      }
      return;
    }

    await IDB.updateMutation(mutation.id, {
      status: STATUS_ERROR,
      retryCount: retryCount,
      lastError: message,
      updatedAt: nowIso()
    });
    if (product) {
      product.syncStatus = PRODUCT_ERROR;
      product.lastError = message;
      await IDB.putProduct(product);
    }
    state.lastError = message;
  }

  async function processMutation(mutation) {
    const claimed = await claimMutation(mutation);
    if (!claimed) return 'skipped';

    const product = await IDB.getProduct(claimed.localId);
    const snapshot = {
      payload: JSON.stringify(claimed.payload || {}),
      productUpdatedAt: product ? product.updatedAt : null,
      serverId: product && product.serverId !== undefined ? product.serverId : null
    };

    try {
      let res;
      if (claimed.operation === 'create') {
        res = await adapter.createProduct(claimed.payload, claimed);
      } else if (claimed.operation === 'update') {
        const serverId = product && product.serverId !== null && product.serverId !== undefined
          ? product.serverId
          : claimed.serverId;
        if (serverId === null || serverId === undefined) {
          const failure = new Error('No se conoce el id del servidor para este producto.');
          failure.retryable = false;
          throw failure;
        }
        res = await adapter.updateProduct(serverId, claimed.payload, claimed);
      } else {
        const failure = new Error('Operacion no soportada: ' + claimed.operation);
        failure.retryable = false;
        throw failure;
      }

      // Confirmacion real del backend antes de marcar nada como sincronizado.
      const server = await res.json();
      await completeSuccess(claimed, server, snapshot);
      return 'processed';
    } catch (error) {
      await completeFailure(claimed, error);
      return 'failed';
    }
  }

  async function runSync(reason, options) {
    const opts = options || {};

    if (!isOnline()) {
      state.online = false;
      await refreshStatus();
      return { skipped: true, reason: 'offline' };
    }

    if (state.syncing) return { skipped: true, reason: 'busy' };

    state.online = true;
    state.syncing = true;
    state.lastError = null;
    await refreshStatus();
    emitStatus();

    let processed = 0;
    let failed = 0;

    try {
      await ensureRecovered();
      const handled = new Set();

      // M4: se relee la cola en cada vuelta para procesar de inmediato el
      // UPDATE de seguimiento que completeSuccess pudo encolar.
      for (let guard = 0; guard < 100; guard++) {
        if (!isOnline()) break;
        const pending = (await IDB.getPendingMutations()).sort(byCreated);
        const next = pending.filter(function (mutation) {
          // Las mutaciones con reintento futuro no se tocan; si vuelven a
          // encolarse en esta corrida quedan disponibles para la siguiente vuelta.
          return !handled.has(mutation.id)
            && (!mutation.nextRetryAt || new Date(mutation.nextRetryAt).getTime() <= Date.now());
        })[0];
        if (!next) break;
        handled.add(next.id);
        const result = await processMutation(next);
        if (result === 'processed') processed++;
        if (result === 'failed') failed++;
      }

      if (opts.refresh !== false && Products && typeof Products.refreshFromServer === 'function') {
        const refresh = await Products.refreshFromServer();
        if (!refresh.ok && !refresh.offline && refresh.error) {
          state.lastError = refresh.error;
        } else if (refresh.ok) {
          state.lastSync = await IDB.getMeta('lastSync');
        }
      }
    } catch (error) {
      state.lastError = (error && error.message) || 'Error inesperado durante la sincronizacion.';
      console.error('[AnimeStock Sync]', error);
    } finally {
      state.syncing = false;
      await refreshStatus();
      emitStatus();
    }

    return { processed: processed, failed: failed, reason: reason };
  }

  // -------------------------------------------------------------------------
  // API publica
  // -------------------------------------------------------------------------

  function syncNow(reason, options) {
    if (running) return running;
    running = runSync(reason || 'manual', options || {}).finally(function () {
      running = null;
    });
    return running;
  }

  async function retryAll() {
    const errors = await IDB.getMutationsByStatus(STATUS_ERROR);
    let safe = 0;
    let skipped = 0;

    for (let i = 0; i < errors.length; i++) {
      const mutation = errors[i];
      if (mutation.operation !== 'update') {
        skipped++;
        continue;
      }
      await IDB.updateMutation(mutation.id, {
        status: STATUS_PENDING,
        retryCount: 0,
        lastError: null,
        nextRetryAt: null,
        updatedAt: nowIso()
      });
      const product = await IDB.getProduct(mutation.localId);
      if (product) {
        product.syncStatus = PRODUCT_PENDING;
        product.lastError = null;
        await IDB.putProduct(product);
      }
      safe++;
    }

    await refreshStatus();
    if (safe > 0) syncNow('manual-retry');
    return { retryable: safe, skipped: skipped };
  }

  async function retryProduct(localId) {
    if (!Products || typeof Products.retryProduct !== 'function') {
      return { retryable: false, message: 'El almacenamiento local no esta disponible.' };
    }
    const result = await Products.retryProduct(localId);
    if (result && result.retryable) syncNow('manual-retry-product');
    return result;
  }

  function getStatus() {
    return {
      online: state.online,
      syncing: state.syncing,
      lastSync: state.lastSync,
      lastError: state.lastError,
      counts: Object.assign({}, state.counts)
    };
  }

  function scheduleSync(delayMs) {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(function () {
      scheduled = null;
      if (isOnline()) syncNow('auto-debounced', { refresh: false });
    }, delayMs || 800);
  }

  function attachListeners() {
    global.addEventListener('online', function () {
      state.online = true;
      state.lastError = null;
      refreshStatus();
      scheduleSync(600);
    });

    global.addEventListener('offline', function () {
      state.online = false;
      refreshStatus();
    });

    global.addEventListener('indexeddb:mutation-added', function () {
      refreshStatus();
      scheduleSync(800);
    });

    global.addEventListener('animestock:products-changed', function () {
      refreshStatus();
    });
  }

  function start() {
    if (state.started) return;
    state.started = true;
    attachListeners();

    ensureRecovered()
      .then(function () { return refreshStatus(); })
      .then(function () {
        if (isOnline()) {
          setTimeout(function () { syncNow('startup'); }, 700);
        }
      })
      .catch(function (error) {
        console.warn('[AnimeStock Sync] No se pudieron recuperar mutaciones en curso:', error);
      });

    timer = setInterval(function () {
      if (isOnline()) syncNow('auto', { refresh: false });
    }, AUTO_INTERVAL);
  }

  global.AnimeStockSync = {
    start: start,
    syncNow: syncNow,
    retryAll: retryAll,
    retryProduct: retryProduct,
    getStatus: getStatus,
    refreshStatus: refreshStatus
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.AnimeStockSync;
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
