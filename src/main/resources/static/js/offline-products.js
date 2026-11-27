/**
 * AnimeStock - Repositorio local de Productos (Offline-First).
 *
 * Traduce entre el contrato de la API (ProductoRequest / ProductoResponse)
 * y los registros guardados en IndexedDB. Mantiene la API publica de
 * AnimeStockData (fetchProducts, createProduct, updateProduct, ...) pero
 * persistiendo primero en local y encolando mutaciones para el motor de
 * sincronizacion.
 *
 * No sincroniza imagenes ni implementa DELETE offline.
 */

(function (global) {
  'use strict';

  const IDB = global.AnimeStockIDB;
  const API_BASE = '';
  const DEFAULT_LIMIT = 24;
  const CATALOG_LIMIT = 1000;
  const NETWORK_TIMEOUT = 8000;

  const STATUS_PENDING = 'pending';
  const STATUS_SYNCING = 'syncing';
  const STATUS_SYNCED = 'synced';
  const STATUS_ERROR = 'error';
  const STATUS_DONE = 'done';

  let categoryMap = {};
  let categoryCacheLoaded = false;
  let categoryCachePromise = null;

  // -------------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------------

  function nowIso() {
    return new Date().toISOString();
  }

  function isOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  }

  function dataError(message, code) {
    const error = new Error(message);
    error.code = code || 'ERROR';
    return error;
  }

  function offlineError(message) {
    return dataError(message || 'No hay conexion con el servidor.', 'OFFLINE');
  }

  function toNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : (fallback === undefined ? 0 : fallback);
  }

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function abortError() {
    const error = new Error('Operacion cancelada');
    error.name = 'AbortError';
    return error;
  }

  function request(url, options, externalSignal, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, timeoutMs || NETWORK_TIMEOUT);

    function forwardAbort() {
      controller.abort();
    }

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', forwardAbort);
    }

    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .catch(function (error) {
        if (externalSignal && externalSignal.aborted) throw abortError();
        if (timedOut) {
          const timeout = new Error('La solicitud tard\u00f3 demasiado');
          timeout.timeout = true;
          throw timeout;
        }
        throw error;
      })
      .finally(function () {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
      });
  }

  async function apiError(res) {
    let message = 'La API respondi\u00f3 ' + res.status;
    let body = null;
    try {
      body = await res.json();
      if (body && typeof body.message === 'string' && body.message) {
        message = body.message;
      }
    } catch (err) { /* respuesta sin JSON */ }
    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    return error;
  }

  function emitChange(reason, detail) {
    try {
      const event = new CustomEvent('animestock:products-changed', {
        detail: Object.assign({ reason: reason }, detail || {})
      });
      global.dispatchEvent(event);
    } catch (err) { /* entorno sin CustomEvent */ }
  }

  // -------------------------------------------------------------------------
  // Cache de categorias (solo para mostrar el nombre en local)
  // -------------------------------------------------------------------------

  function rememberCategories(rows, persist) {
    let changed = false;
    (rows || []).forEach(function (category) {
      if (!category || category.id === null || category.id === undefined) return;
      if (!category.nombre) return;
      const key = String(category.id);
      if (categoryMap[key] !== category.nombre) {
        categoryMap[key] = category.nombre;
        changed = true;
      }
    });
    if (changed && persist !== false && IDB) {
      const list = Object.keys(categoryMap).map(function (id) {
        return { id: Number(id), nombre: categoryMap[id] };
      });
      IDB.setMeta('categories', list).catch(function () { /* noop */ });
    }
    return listFromMap();
  }

  function listFromMap() {
    return Object.keys(categoryMap).map(function (id) {
      return { id: Number(id), nombre: categoryMap[id] };
    });
  }

  async function loadCategoryCache() {
    if (categoryCacheLoaded || !IDB) return categoryMap;
    if (!categoryCachePromise) {
      categoryCachePromise = IDB.getMeta('categories')
        .then(function (rows) {
          rememberCategories(Array.isArray(rows) ? rows : [], false);
          categoryCacheLoaded = true;
          return categoryMap;
        })
        .catch(function () {
          categoryCacheLoaded = true;
          return categoryMap;
        });
    }
    return categoryCachePromise;
  }

  async function getCachedCategories() {
    await loadCategoryCache();
    return listFromMap();
  }

  function categoryName(categoryId) {
    if (categoryId === null || categoryId === undefined) return null;
    return categoryMap[String(categoryId)] || null;
  }

  function resolveCategoryIdByName(name, fallbackId) {
    if (!name) return null;
    const keys = Object.keys(categoryMap);
    for (let i = 0; i < keys.length; i++) {
      if (categoryMap[keys[i]] === name) return Number(keys[i]);
    }
    return fallbackId === undefined ? null : fallbackId;
  }

  // -------------------------------------------------------------------------
  // Mapeo API <-> registro local
  // -------------------------------------------------------------------------

  function emptyRecord(localId) {
    return {
      localId: localId,
      serverId: null,
      sku: null,
      name: '',
      anime: null,
      category: null,
      categoryId: null,
      emoji: null,
      cost: 0,
      price: 0,
      stock: 0,
      minStock: 0,
      active: true,
      imageUrl: null,
      syncStatus: STATUS_PENDING,
      lastError: null
    };
  }

  function serverFields(server) {
    return {
      sku: server.sku === undefined ? null : server.sku,
      name: server.name === undefined || server.name === null ? '' : String(server.name),
      anime: server.anime === undefined ? null : server.anime,
      category: server.category === undefined ? null : server.category,
      emoji: server.emoji === undefined ? null : server.emoji,
      cost: toNumber(server.cost, 0),
      price: toNumber(server.price, 0),
      stock: toNumber(server.stock, 0),
      minStock: toNumber(server.minStock, 0),
      active: server.active !== false,
      imageUrl: server.imageUrl === undefined ? null : server.imageUrl
    };
  }

  function applyPayload(record, payload) {
    const input = payload || {};
    let has = function (key) { return Object.prototype.hasOwnProperty.call(input, key); };

    if (has('nombre')) record.name = input.nombre === null ? '' : String(input.nombre);
    else if (has('name')) record.name = input.name === null ? '' : String(input.name);

    if (has('anime')) record.anime = input.anime === undefined ? null : input.anime;
    if (has('sku')) record.sku = input.sku ? String(input.sku) : null;

    if (has('costo')) record.cost = toNumber(input.costo, 0);
    else if (has('cost')) record.cost = toNumber(input.cost, 0);

    if (has('precio')) record.price = toNumber(input.precio, 0);
    else if (has('price')) record.price = toNumber(input.price, 0);

    if (has('stock')) record.stock = toNumber(input.stock, 0);
    if (has('stockMinimo')) record.minStock = toNumber(input.stockMinimo, 0);
    else if (has('minStock')) record.minStock = toNumber(input.minStock, 0);

    if (has('activo')) record.active = input.activo !== false;
    else if (has('active')) record.active = input.active !== false;

    if (has('categoriaId')) {
      record.categoryId = toNumberOrNull(input.categoriaId);
      record.category = record.categoryId === null ? null : categoryName(record.categoryId);
    }
    if (has('category')) record.category = input.category === undefined ? null : input.category;
    if (has('emoji')) record.emoji = input.emoji === undefined ? null : input.emoji;
    if (has('imageUrl')) record.imageUrl = input.imageUrl === undefined ? null : input.imageUrl;

    return record;
  }

  /**
   * Construye el cuerpo que espera ProductoRequest.
   * Solo copia campos conocidos; descarta localId, syncStatus, id, etc.
   */
  function serverPayload(payload, base) {
    const output = {};
    copyServerFields(base, output);
    copyServerFields(payload, output);
    return output;
  }

  function copyServerFields(source, target) {
    if (!source) return;
    const map = {
      sku: 'sku',
      nombre: 'nombre',
      name: 'nombre',
      anime: 'anime',
      categoriaId: 'categoriaId',
      costo: 'costo',
      cost: 'costo',
      precio: 'precio',
      price: 'precio',
      stock: 'stock',
      stockMinimo: 'stockMinimo',
      minStock: 'stockMinimo',
      activo: 'activo',
      active: 'activo'
    };
    Object.keys(source).forEach(function (key) {
      const targetKey = map[key];
      if (targetKey) target[targetKey] = source[key];
    });
  }

  function recordToServerPayload(record) {
    return {
      sku: record.sku || null,
      nombre: record.name || '',
      anime: record.anime || null,
      categoriaId: record.categoryId === undefined ? null : record.categoryId,
      costo: record.cost === undefined ? 0 : record.cost,
      precio: record.price === undefined ? 0 : record.price,
      stock: record.stock === undefined ? 0 : record.stock,
      stockMinimo: record.minStock === undefined ? 0 : record.minStock,
      activo: record.active !== false
    };
  }

  function clientProduct(record) {
    if (!record) return null;
    const serverId = record.serverId === undefined ? null : record.serverId;
    return {
      id: serverId !== null ? serverId : record.localId,
      serverId: serverId,
      localId: record.localId,
      sku: record.sku === undefined ? null : record.sku,
      name: record.name === undefined ? '' : record.name,
      anime: record.anime === undefined ? null : record.anime,
      category: record.category === undefined ? null : record.category,
      categoryId: record.categoryId === undefined ? null : record.categoryId,
      emoji: record.emoji === undefined ? null : record.emoji,
      cost: record.cost === undefined ? 0 : record.cost,
      price: record.price === undefined ? 0 : record.price,
      stock: record.stock === undefined ? 0 : record.stock,
      minStock: record.minStock === undefined ? 0 : record.minStock,
      active: record.active !== false,
      imageUrl: record.imageUrl === undefined ? null : record.imageUrl,
      syncStatus: record.syncStatus || STATUS_SYNCED,
      lastError: record.lastError || null,
      updatedAt: record.updatedAt || null
    };
  }

  function isPending(record) {
    return record && (record.syncStatus === STATUS_PENDING
      || record.syncStatus === STATUS_SYNCING
      || record.syncStatus === STATUS_ERROR);
  }

  /**
   * Fusiona una respuesta del backend en un registro local existente.
   * No toca localId ni createdAt.
   */
  function mergeServerResponse(record, server) {
    const fields = serverFields(server);
    Object.keys(fields).forEach(function (key) {
      record[key] = fields[key];
    });
    record.serverId = server.id;
    if (server.category) {
      record.categoryId = resolveCategoryIdByName(server.category, record.categoryId);
    }
    return record;
  }

  async function markSkuConflict(local, server) {
    const message = 'Conflicto de SKU "' + server.sku + '": el servidor ya tiene otro producto con ese código. '
      + 'Revisalo manualmente antes de sincronizar.';
    const mutations = await IDB.getMutationsByLocalId(local.localId);
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].status === STATUS_DONE || mutations[i].status === STATUS_ERROR) continue;
      await IDB.updateMutation(mutations[i].id, {
        status: STATUS_ERROR,
        lastError: message,
        updatedAt: nowIso()
      });
    }
    const marked = Object.assign({}, local, {
      syncStatus: STATUS_ERROR,
      lastError: message,
      updatedAt: nowIso()
    });
    await IDB.putProduct(marked);
    emitChange('product:sku-conflict', {
      localId: local.localId,
      serverId: server.id,
      sku: server.sku
    });
    return IDB.getProduct(local.localId);
  }

  async function cacheServerProduct(server) {
    if (!server || server.id === null || server.id === undefined) return null;

    const existing = await IDB.getProductByServerId(server.id);
    if (existing) {
      // Nunca pisar cambios locales pendientes o con error.
      if (isPending(existing)) return existing;
      const merged = mergeServerResponse(Object.assign({}, existing), server);
      merged.localId = existing.localId;
      merged.syncStatus = STATUS_SYNCED;
      merged.lastError = null;
      await IDB.putProduct(merged);
      return await IDB.getProduct(existing.localId);
    }

    // Un SKU repetido en un registro local sin serverId es ambiguo: no es seguro
    // asumir que son el mismo producto. Conservamos el registro local, marcamos
    // el conflicto y NO cacheamos la fila del servidor.
    if (server.sku) {
      const all = await IDB.getAllProducts();
      const conflict = all.filter(function (product) {
        return !product.serverId && product.sku && product.sku === server.sku;
      })[0];
      if (conflict) {
        await markSkuConflict(conflict, server);
        return null;
      }
    }

    const record = emptyRecord(IDB.generateLocalId());
    mergeServerResponse(record, server);
    record.syncStatus = STATUS_SYNCED;
    record.lastError = null;
    await IDB.putProduct(record);
    return await IDB.getProduct(record.localId);
  }

  async function cacheServerPage(content) {
    if (!Array.isArray(content)) return;
    for (let i = 0; i < content.length; i++) {
      try {
        await cacheServerProduct(content[i]);
      } catch (error) {
        console.warn('[AnimeStock] No se pudo guardar el producto del servidor:', error);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mutaciones
  // -------------------------------------------------------------------------

  function byCreated(a, b) {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (diff !== 0) return diff;
    return (a.id || 0) - (b.id || 0);
  }

  async function queueMutation(mutation) {
    // IDB realiza lectura + escritura en una sola transaccion (H1).
    return IDB.upsertMutation(mutation);
  }

  async function resolveRecord(productId) {
    if (productId === null || productId === undefined) return null;
    if (typeof productId === 'string') {
      const direct = await IDB.getProduct(productId);
      if (direct) return direct;
    }
    const numeric = Number(productId);
    if (Number.isFinite(numeric) && String(productId).trim() !== '') {
      return IDB.getProductByServerId(numeric);
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // API publica de productos
  // -------------------------------------------------------------------------

  async function fetchProducts(query, options) {
    const opts = options || {};
    const includeLocal = opts.includeLocal === true;
    const signal = opts.signal;
    let networkError = null;
    let serverPage = null;

    if (!isOnline()) {
      networkError = offlineError('No hay conexion con el servidor.');
    } else {
      try {
        const params = new URLSearchParams();
        const queryText = query === undefined || query === null ? '' : String(query);
        if (queryText) params.set('query', queryText);
        if (opts.category) params.set('category', opts.category);
        if (opts.inStockOnly) params.set('inStockOnly', 'true');
        const limit = opts.limit ? Math.max(1, Number(opts.limit)) : DEFAULT_LIMIT;
        params.set('limit', String(limit));

        const res = await request(
          API_BASE + '/api/products?' + params.toString(),
          { headers: { Accept: 'application/json' } },
          signal,
          NETWORK_TIMEOUT
        );
        if (res.ok) {
          const page = await res.json();
          if (page && Array.isArray(page.content)) {
            await cacheServerPage(page.content);
            serverPage = page;
          } else {
            networkError = new Error('Respuesta invalida del servidor.');
          }
        } else {
          networkError = await apiError(res);
        }
      } catch (error) {
        if ((signal && signal.aborted) || (error && error.name === 'AbortError')) {
          throw abortError();
        }
        networkError = error;
      }
    }

    // Otros modulos (Ventas, Proveedores) conservan el comportamiento anterior:
    // si no hay red, reciben el error en lugar de datos locales parciales.
    if (!includeLocal) {
      if (!serverPage) throw networkError || offlineError('No hay conexion con el servidor.');
      return Object.assign({}, serverPage, { source: 'network', offline: false });
    }

    // includeLocal:true (Inventario/exportacion) incluye tambien los registros
    // pendientes; el resto de modulos no llega a esta rama.
    const records = await IDB.getAllProducts();
    let rows = records.map(clientProduct);

    const queryText = query === undefined || query === null
      ? '' : String(query).trim().toLowerCase();
    if (queryText) {
      rows = rows.filter(function (product) {
        const haystack = [product.name, product.anime, product.sku, product.category]
          .map(function (value) { return String(value || '').toLowerCase(); })
          .join(' ');
        return haystack.indexOf(queryText) !== -1;
      });
    }
    if (opts.category) {
      rows = rows.filter(function (product) {
        return String(product.category || '') === String(opts.category);
      });
    }
    if (opts.inStockOnly) {
      rows = rows.filter(function (product) { return toNumber(product.stock) > 0; });
    }

    rows.sort(function (a, b) {
      const stockOrder = (toNumber(a.stock) > 0 ? -1 : 1) - (toNumber(b.stock) > 0 ? -1 : 1);
      if (stockOrder !== 0) return stockOrder;
      return String(a.name || '').localeCompare(String(b.name || ''), 'es');
    });

    const limit = opts.limit ? Math.max(1, Number(opts.limit)) : DEFAULT_LIMIT;
    const offset = opts.offset ? Math.max(0, Number(opts.offset)) : 0;
    const totalElements = rows.length;
    const content = rows.slice(offset, offset + limit);

    return {
      content: content,
      page: Math.floor(offset / limit),
      size: limit,
      totalElements: totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / limit)),
      from: null,
      to: null,
      source: serverPage ? 'network' : 'cache',
      offline: !isOnline()
    };
  }

  async function fetchProductById(productId) {
    const numeric = Number(productId);
    const isNumeric = Number.isFinite(numeric) && String(productId).trim() !== '';

    if (isNumeric && isOnline()) {
      try {
        const res = await request(
          API_BASE + '/api/products/' + numeric,
          { headers: { Accept: 'application/json' } },
          null,
          NETWORK_TIMEOUT
        );
        if (res.status === 404) return null;
        if (res.ok) {
          const server = await res.json();
          const record = await cacheServerProduct(server);
          return record ? clientProduct(record) : null;
        }
      } catch (error) {
        // Fallback a la copia local.
      }
    }

    const record = isNumeric
      ? await IDB.getProductByServerId(numeric)
      : await IDB.getProduct(String(productId));
    return record ? clientProduct(record) : null;
  }

  async function createProduct(payload) {
    await loadCategoryCache();

    const localId = IDB.generateLocalId();
    const record = emptyRecord(localId);
    applyPayload(record, payload);

    const mutationPayload = serverPayload(payload, null);
    record.syncStatus = STATUS_PENDING;
    record.lastError = null;

    await IDB.putProduct(record);
    await queueMutation({
      entity: 'product',
      operation: 'create',
      localId: localId,
      idempotencyKey: 'product-create-' + localId,
      payload: mutationPayload
    });

    emitChange('product:created', { localId: localId });
    const saved = await IDB.getProduct(localId);
    return clientProduct(saved);
  }

  async function updateProduct(productId, payload) {
    await loadCategoryCache();

    let record = await resolveRecord(productId);

    // Si no esta cacheado pero existe en el servidor, mantenemos el
    // comportamiento online anterior (PUT directo) y guardamos la respuesta.
    if (!record) {
      const numeric = Number(productId);
      if (!Number.isFinite(numeric) || String(productId).trim() === '') {
        throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
      }
      if (!isOnline()) {
        throw offlineError('No hay conexion y el producto no esta guardado en este dispositivo.');
      }
      const res = await request(
        API_BASE + '/api/products/' + numeric,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(serverPayload(payload, null))
        },
        null,
        NETWORK_TIMEOUT
      );
      if (res.status === 404) throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
      if (!res.ok) throw await apiError(res);
      const server = await res.json();
      const cached = await cacheServerProduct(server);
      emitChange('product:updated', { localId: cached ? cached.localId : null });
      return clientProduct(cached);
    }

    const originalPayload = recordToServerPayload(record);
    applyPayload(record, payload);

    const mutations = await IDB.getMutationsByLocalId(record.localId);
    const pending = mutations.filter(function (mutation) {
      return mutation.status !== 'done';
    }).sort(byCreated);

    const createMutation = pending.filter(function (mutation) {
      return mutation.operation === 'create';
    })[0];
    const updateMutation = pending.filter(function (mutation) {
      return mutation.operation === 'update';
    })[0];

    if (createMutation) {
      // CREATE + UPDATE(s): una sola operacion CREATE con el estado final.
      const mergedPayload = serverPayload(payload, createMutation.payload);
      const wasError = createMutation.status === STATUS_ERROR;
      const wasSyncing = createMutation.status === STATUS_SYNCING;
      // El producto y su mutacion deben mostrar siempre el mismo estado (M1).
      const nextStatus = wasError ? STATUS_ERROR
        : (wasSyncing ? STATUS_SYNCING : STATUS_PENDING);

      await IDB.updateMutation(createMutation.id, {
        payload: mergedPayload,
        status: nextStatus,
        lastError: wasError ? createMutation.lastError : null,
        updatedAt: nowIso()
      });

      record.syncStatus = nextStatus;
      record.lastError = wasError ? createMutation.lastError : null;
    } else if (record.serverId !== null && record.serverId !== undefined) {
      // UPDATE + UPDATE(s): una sola mutacion UPDATE consolidada.
      const basePayload = updateMutation ? updateMutation.payload : originalPayload;
      const mergedPayload = serverPayload(payload, basePayload);
      let nextStatus = STATUS_PENDING;

      if (updateMutation) {
        const wasError = updateMutation.status === STATUS_ERROR;
        const wasSyncing = updateMutation.status === STATUS_SYNCING;
        nextStatus = wasSyncing ? STATUS_SYNCING : STATUS_PENDING;
        await IDB.updateMutation(updateMutation.id, {
          payload: mergedPayload,
          status: nextStatus,
          retryCount: wasError ? 0 : updateMutation.retryCount,
          nextRetryAt: null,
          lastError: null,
          updatedAt: nowIso()
        });
      } else {
        await IDB.upsertMutation({
          entity: 'product',
          operation: 'update',
          localId: record.localId,
          idempotencyKey: 'product-update-' + record.localId + '-' + Date.now(),
          payload: mergedPayload
        });
      }

      record.syncStatus = nextStatus;
      record.lastError = null;
    } else {
      // Registro local sin serverId ni CREATE pendiente: estado inconsistente.
      record.syncStatus = STATUS_ERROR;
      record.lastError = 'No se pudo determinar la operacion pendiente del producto.';
    }

    await IDB.putProduct(record);
    emitChange('product:updated', { localId: record.localId });
    const saved = await IDB.getProduct(record.localId);
    return clientProduct(saved);
  }

  async function deleteProduct(productId) {
    const record = await resolveRecord(productId);

    if (record && (record.serverId === null || record.serverId === undefined)) {
      throw dataError(
        'No se puede eliminar un producto que todavia no se sincronizo. Esta accion requiere conexion.',
        'DELETE_OFFLINE_NO_SOPORTADO'
      );
    }

    const numeric = record && record.serverId !== null && record.serverId !== undefined
      ? record.serverId
      : Number(productId);

    if (!Number.isFinite(numeric)) {
      throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
    }
    if (!isOnline()) {
      throw offlineError('No hay conexion. No se puede eliminar un producto sin conexion.');
    }

    const res = await request(
      API_BASE + '/api/products/' + numeric,
      { method: 'DELETE' },
      null,
      NETWORK_TIMEOUT
    );
    if (res.status === 404) {
      throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
    }
    if (!res.ok) throw await apiError(res);

    if (record) {
      const mutations = await IDB.getMutationsByLocalId(record.localId);
      for (let i = 0; i < mutations.length; i++) {
        await IDB.deleteMutation(mutations[i].id);
      }
      await IDB.deleteProduct(record.localId);
    }

    emitChange('product:deleted', { id: numeric, localId: record ? record.localId : null });
    return { id: numeric, deleted: true };
  }

  /**
   * Tras una operacion de imagen online, actualiza solo la copia local.
   * No encola nada: las imagenes no se sincronizan en esta fase.
   */
  async function updateCachedImage(productId, imageUrl) {
    const record = await resolveRecord(productId);
    if (!record || imageUrl === undefined) return null;
    record.imageUrl = imageUrl || null;
    await IDB.putProduct(record);
    emitChange('product:image', { localId: record.localId });
    return clientProduct(await IDB.getProduct(record.localId));
  }

  // -------------------------------------------------------------------------
  // Sincronizacion: lectura del servidor y reintentos seguros
  // -------------------------------------------------------------------------

  async function refreshFromServer(options) {
    const opts = options || {};
    if (!isOnline()) {
      return { ok: false, offline: true, error: null, count: 0 };
    }
    try {
      const limit = opts.limit ? Math.max(1, Number(opts.limit)) : CATALOG_LIMIT;
      const res = await request(
        API_BASE + '/api/products?limit=' + limit,
        { headers: { Accept: 'application/json' } },
        null,
        NETWORK_TIMEOUT
      );
      if (!res.ok) {
        return { ok: false, error: (await apiError(res)).message, count: 0 };
      }
      const page = await res.json();
      const content = page && Array.isArray(page.content) ? page.content : [];
      await cacheServerPage(content);
      await IDB.setMeta('lastSync', nowIso());
      emitChange('products:refreshed', { count: content.length });
      return { ok: true, count: content.length, total: page ? page.totalElements : content.length };
    } catch (error) {
      return { ok: false, error: (error && error.message) || 'No se pudo leer el catalogo del servidor.', count: 0 };
    }
  }

  async function retryProduct(localId) {
    const record = await IDB.getProduct(localId);
    if (!record) {
      return { retryable: false, message: 'El producto no esta guardado en este dispositivo.' };
    }

    const mutations = await IDB.getMutationsByLocalId(localId);
    const errors = mutations.filter(function (mutation) {
      return mutation.status === STATUS_ERROR;
    });

    const safe = errors.filter(function (mutation) {
      return mutation.operation === 'update'
        && record.serverId !== null && record.serverId !== undefined;
    });

    if (!safe.length) {
      if (errors.some(function (mutation) { return mutation.operation === 'create'; })) {
        return {
          retryable: false,
          message: 'La creacion no se reintenta automaticamente para evitar duplicados. Requiere revision manual (Fase 3).'
        };
      }
      return { retryable: false, message: 'No hay operaciones seguras para reintentar.' };
    }

    for (let i = 0; i < safe.length; i++) {
      await IDB.updateMutation(safe[i].id, {
        status: STATUS_PENDING,
        retryCount: 0,
        lastError: null,
        nextRetryAt: null,
        updatedAt: nowIso()
      });
    }

    record.syncStatus = STATUS_PENDING;
    record.lastError = null;
    await IDB.putProduct(record);
    emitChange('product:retry', { localId: localId });

    return { retryable: true, count: safe.length };
  }

  async function getSummary() {
    const all = await IDB.getAllProducts();
    return {
      total: all.length,
      pending: all.filter(function (p) {
        return p.syncStatus === STATUS_PENDING || p.syncStatus === STATUS_SYNCING;
      }).length,
      error: all.filter(function (p) { return p.syncStatus === STATUS_ERROR; }).length,
      synced: all.filter(function (p) {
        return p.syncStatus === STATUS_SYNCED || !p.syncStatus;
      }).length
    };
  }

  const api = {
    // Lectura / escritura (compatible con AnimeStockData)
    fetchProducts: fetchProducts,
    fetchProductById: fetchProductById,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,

    // Categorias (cache local para mostrar nombres offline)
    rememberCategories: rememberCategories,
    getCachedCategories: getCachedCategories,

    // Soporte para el motor de sincronizacion
    refreshFromServer: refreshFromServer,
    retryProduct: retryProduct,
    updateCachedImage: updateCachedImage,
    getSummary: getSummary,
    cacheServerProduct: cacheServerProduct,
    recordToServerPayload: recordToServerPayload,
    serverPayload: serverPayload,
    mergeServerResponse: mergeServerResponse,
    clientProduct: clientProduct,
    resolveRecord: resolveRecord,

    STATUS: {
      PENDING: STATUS_PENDING,
      SYNCING: STATUS_SYNCING,
      SYNCED: STATUS_SYNCED,
      ERROR: STATUS_ERROR
    }
  };

  global.AnimeStockProducts = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
