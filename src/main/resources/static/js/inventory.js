
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;
  const UI = global.AnimeStockUI;

  
  
  const USE_LOCAL_IMAGES = false;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;                 
  const ACCEPTED_IMAGE = /^image\/(jpeg|png|webp)$/i;
  const CATALOG_LIMIT = 1000;                              
  const REFERENCE_STOCK = 12;                              
  const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

  
  const DEFAULT_FILTERS = {
    q: '', category: 'todos', stock: 'todos', order: 'name_asc'
  };

  const state = {
    filters: { q: '', category: 'todos', stock: 'todos', order: 'name_asc' },
    page: 1,              
    pageSize: 25,
    totalElements: 0,
    totalPages: 1,
    all: [],              
    rows: [],             
    categories: [],
    categoriesLoaded: false,
    loaded: false,
    abort: null,          
    editing: null,        
    readonly: false,      
    imageFile: null,      
    imagePreviewUrl: null,
    imageExistingUrl: null, 
    imageRemoved: false,  
    saving: false
  };

  let dom = {};
  let bound = false;
  let modal = null;       

  
  const $ = UI.$;
  const $$ = UI.$$;
  const el = UI.el;
  const toast = UI.toast;
  const confirmDialog = UI.confirm;
  const money = UI.formatCurrency;

  
  function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function decimal(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return (Math.round(number * 100) / 100).toString();
  }

  
  function marginPercent(product) {
    const price = toNumber(product.price);
    const cost = toNumber(product.cost);
    if (price <= 0) return '';
    return Math.round(((price - cost) / price) * 100);
  }

  function marginLabel(product) {
    const percent = marginPercent(product);
    return percent === '' ? '—' : percent + '%';
  }

  
  function stockTone(product) {
    const stock = toNumber(product.stock);
    const min = toNumber(product.minStock);
    if (stock <= 0) return 'out';
    if (min > 0 && stock < min) return 'low';
    return 'ok';
  }

  function stockBarWidth(stock) {
    const value = toNumber(stock);
    if (value <= 0) return 0;
    return Math.max(8, Math.min(100, (value / REFERENCE_STOCK) * 100));
  }

  
  function matchesQuery(product) {
    const needle = state.filters.q.trim().toLowerCase();
    if (!needle) return true;
    const haystack = [product.name, product.anime, product.sku, product.category]
      .map(function (value) { return String(value || '').toLowerCase(); })
      .join(' ');
    return haystack.indexOf(needle) !== -1;
  }

  function matchesCategory(product) {
    if (state.filters.category === 'todos') return true;
    return String(product.category || '') === state.filters.category;
  }

  function matchesStock(product) {
    const tone = stockTone(product);
    if (state.filters.stock === 'sin') return tone === 'out';
    if (state.filters.stock === 'bajo') return tone === 'low';
    if (state.filters.stock === 'ok') return tone === 'ok';
    return true;
  }

  function compareProducts(a, b) {
    switch (state.filters.order) {
      case 'stock_asc':
        return toNumber(a.stock) - toNumber(b.stock);
      case 'price_desc':
        return toNumber(b.price) - toNumber(a.price);
      case 'recent':
        return toNumber(b.id) - toNumber(a.id);
      case 'name_asc':
      default:
        return String(a.name || '').localeCompare(String(b.name || ''), 'es');
    }
  }

  
  function applyClientFilters() {
    const filtered = state.all
      .filter(matchesQuery)
      .filter(matchesCategory)
      .filter(matchesStock)
      .sort(compareProducts);

    state.totalElements = filtered.length;
    state.totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > state.totalPages) state.page = state.totalPages;

    const start = (state.page - 1) * state.pageSize;
    state.rows = filtered.slice(start, start + state.pageSize);
    return filtered;
  }

  
  function miniKpi(card, index) {
    const node = el('article', {
      className: 'mini-kpi mini-kpi--' + card.tone,
      attrs: { role: 'listitem' }
    });
    node.style.setProperty('--i', String(index));
    node.innerHTML =
      '<span class="mini-kpi__icon" aria-hidden="true"></span>' +
      '<div class="mini-kpi__body">' +
      '  <p class="mini-kpi__label"></p>' +
      '  <p class="mini-kpi__value"></p>' +
      '  <p class="mini-kpi__sub"></p>' +
      '</div>';
    $('.mini-kpi__icon', node).textContent = card.icon;
    $('.mini-kpi__label', node).textContent = card.label;
    $('.mini-kpi__value', node).textContent = card.value;
    $('.mini-kpi__sub', node).textContent = card.sub;
    return node;
  }

  function renderKpis(catalog) {
    const host = $('#inventoryKpis');
    if (!host) return;

    const list = catalog || [];
    const active = list.filter(function (product) { return product.active !== false; });

    const inventoryValue = active.reduce(function (sum, product) {
      return sum + toNumber(product.cost) * toNumber(product.stock);
    }, 0);

    const saleValue = active.reduce(function (sum, product) {
      return sum + toNumber(product.price) * toNumber(product.stock);
    }, 0);

    const lowStock = list.filter(function (product) {
      const tone = stockTone(product);
      return tone === 'low' || tone === 'out';
    });

    const cards = [
      { icon: '📦', label: 'Productos activos', value: String(active.length),
        sub: list.length + ' en el catálogo', tone: 'neutral' },
      { icon: '💼', label: 'Valor de inventario', value: money(inventoryValue),
        sub: 'Σ costo × stock', tone: 'neutral' },
      { icon: '⚠️', label: 'Stock bajo', value: String(lowStock.length),
        sub: lowStock.length ? 'por reponer' : 'todo en orden',
        tone: lowStock.length ? 'warn' : 'ok' },
      { icon: '🏷️', label: 'Valor de venta', value: money(saleValue),
        sub: 'Σ precio × stock', tone: 'neutral' }
    ];

    host.textContent = '';
    cards.forEach(function (card, index) { host.appendChild(miniKpi(card, index)); });
  }

  
  function productThumb(product) {
    const wrap = el('span', { className: 'product-thumb' });
    const fallback = function () {
      wrap.classList.add('product-thumb--fallback');
      wrap.textContent = product.emoji || initialsOf(product.name);
    };

    if (product.imageUrl) {
      const img = el('img', { attrs: { src: product.imageUrl, alt: '', loading: 'lazy' } });
      img.addEventListener('error', function () {
        wrap.textContent = '';
        wrap.classList.remove('product-thumb');
        wrap.classList.add('product-thumb', 'product-thumb--fallback');
        fallback();
      });
      wrap.appendChild(img);
    } else {
      fallback();
    }
    return wrap;
  }

  function stockCell(product) {
    const tone = stockTone(product);
    const modifier = tone === 'ok' ? 'stock--ok' : (tone === 'low' ? 'stock--mid' : 'stock--low');
    const wrap = el('span', { className: 'stock ' + modifier });

    const bar = el('span', { className: 'stock__bar' });
    const fill = el('span', { className: 'stock__fill' });
    fill.style.width = stockBarWidth(product.stock) + '%';
    bar.appendChild(fill);

    const text = el('span', { className: 'stock__text' });
    text.textContent = toNumber(product.stock) + ' / min ' + toNumber(product.minStock);

    wrap.append(bar, text);
    return wrap;
  }

  function actionButton(action, product) {
    const definitions = {
      view: { icon: '👁️', label: 'Ver ' + product.name },
      edit: { icon: '✏️', label: 'Editar ' + product.name },
      remove: { icon: '🗑️', label: 'Eliminar ' + product.name }
    };
    const def = definitions[action];
    const button = el('button', {
      className: 'row-action row-action--' + action,
      attrs: { type: 'button', 'aria-label': def.label, title: def.label }
    });
    button.textContent = def.icon;
    button.addEventListener('click', function () {
      if (action === 'view') openProductModal(product, { readonly: true });
      else if (action === 'edit') openProductModal(product);
      else handleDelete(product);
    });
    return button;
  }

  function buildRow(product) {
    const tr = el('tr', { attrs: { 'data-product-id': String(product.id) } });
    if (stockTone(product) === 'out') tr.classList.add('is-out-of-stock');

    
    const tdProduct = el('td');
    const cell = el('div', { className: 'cell-product' });
    cell.appendChild(productThumb(product));

    const info = el('div', { className: 'cell-product__info' });
    const name = el('span', { className: 'cell-product__name' });
    name.textContent = product.name || '(sin nombre)';
    info.appendChild(name);

    if (product.sku) {
      const sku = el('span', { className: 'cell-product__sku' });
      sku.textContent = product.sku;
      info.appendChild(sku);
    }

    if (stockTone(product) === 'out') {
      const badge = el('span', { className: 'stock-badge stock-badge--out' });
      badge.textContent = 'Agotado';
      info.appendChild(badge);
    }

    cell.appendChild(info);
    tdProduct.appendChild(cell);
    tr.appendChild(tdProduct);

    
    tr.appendChild(el('td', { className: 'table__anime', text: product.anime || '—' }));

    
    tr.appendChild(el('td', { text: product.category || '—' }));

    
    tr.appendChild(el('td', { className: 'table__num', text: money(product.cost) }));

    
    tr.appendChild(el('td', { className: 'table__num', text: money(product.price) }));

    
    tr.appendChild(el('td', { className: 'table__num', text: marginLabel(product) }));

    
    const tdStock = el('td');
    tdStock.appendChild(stockCell(product));
    tr.appendChild(tdStock);

    
    const tdActions = el('td', { className: 'table__actions' });
    tdActions.appendChild(actionButton('view', product));
    tdActions.appendChild(actionButton('edit', product));
    tdActions.appendChild(actionButton('remove', product));
    tr.appendChild(tdActions);

    return tr;
  }

  function renderTable() {
    const body = $('#inventoryRows');
    const empty = $('#inventoryEmpty');
    const card = $('#inventoryTableCard');
    if (!body) return;

    body.textContent = '';
    const hasRows = state.rows.length > 0;
    if (card) card.hidden = !hasRows;
    if (empty) empty.hidden = hasRows;

    state.rows.forEach(function (product) { body.appendChild(buildRow(product)); });
  }

  
  function renderPagination() {
    const host = $('#inventoryPagination');
    const info = $('#inventoryInfo');
    if (!host) return;

    if (info) {
      if (state.totalElements === 0) {
        info.textContent = 'Sin productos para mostrar';
      } else {
        const from = (state.page - 1) * state.pageSize + 1;
        const to = Math.min(state.page * state.pageSize, state.totalElements);
        info.textContent = 'Mostrando ' + from + '-' + to + ' de ' + state.totalElements;
      }
    }

    host.textContent = '';

    const prev = el('button', {
      className: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', 'aria-label': 'Página anterior' }
    });
    prev.innerHTML = '<span aria-hidden="true">←</span> Anterior';
    prev.disabled = state.page <= 1;
    prev.addEventListener('click', function () { goToPage(state.page - 1); });

    const indicator = el('span', { className: 'pagination__info' });
    indicator.textContent = 'Página ' + state.page + ' de ' + state.totalPages;
    indicator.setAttribute('aria-live', 'polite');

    const next = el('button', {
      className: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', 'aria-label': 'Página siguiente' }
    });
    next.innerHTML = 'Siguiente <span aria-hidden="true">→</span>';
    next.disabled = state.page >= state.totalPages;
    next.addEventListener('click', function () { goToPage(state.page + 1); });

    host.append(prev, indicator, next);
  }

  function goToPage(page) {
    const target = Math.min(Math.max(1, page), state.totalPages);
    if (target === state.page) return;
    state.page = target;
    applyClientFilters();
    renderTable();
    renderPagination();
  }

  
  function setLoading(isLoading) {
    const status = $('#inventoryStatus');
    if (status) {
      status.textContent = isLoading ? 'Actualizando inventario…' : '';
      status.hidden = !isLoading;
    }
    const card = $('#inventoryTableCard');
    if (card) card.classList.toggle('is-loading', isLoading);
    const panel = $('#panel-inventario');
    if (panel) panel.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  function showStatus(message) {
    const status = $('#inventoryStatus');
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
  }

  
  function applyFilters(patch) {
    Object.keys(patch || {}).forEach(function (key) {
      state.filters[key] = patch[key];
    });
    state.page = 1;
    applyClientFilters();
    renderTable();
    renderPagination();
  }

  function syncFilterInputs() {
    if (dom.search) dom.search.value = state.filters.q;
    if (dom.category) dom.category.value = state.filters.category;
    if (dom.stock) dom.stock.value = state.filters.stock;
    if (dom.order) dom.order.value = state.filters.order;
    if (dom.pageSize) dom.pageSize.value = String(state.pageSize);
  }

  function clearFilters() {
    state.filters = Object.assign({}, DEFAULT_FILTERS);
    state.page = 1;
    syncFilterInputs();
    applyFilters({});
  }

  
  function fillCategorySelects() {
    
    if (dom.category) {
      const current = state.filters.category;
      dom.category.textContent = '';
      dom.category.appendChild(new Option('Todas las categorías', 'todos'));
      state.categories.forEach(function (category) {
        dom.category.appendChild(new Option(category.nombre, category.nombre));
      });
      dom.category.value = current;
      if (dom.category.value !== current) {
        
        state.filters.category = 'todos';
        dom.category.value = 'todos';
      }
    }
    
    if (dom.formCategory) {
      const current = dom.formCategory.value;
      dom.formCategory.textContent = '';
      dom.formCategory.appendChild(new Option('Sin categoría', ''));
      state.categories.forEach(function (category) {
        dom.formCategory.appendChild(new Option(category.nombre, String(category.id)));
      });
      dom.formCategory.value = current;
    }
  }

  async function loadCategories(force) {
    if (state.categoriesLoaded && !force) return state.categories;
    const rows = await Data.fetchCategories();
    state.categories = Array.isArray(rows) ? rows.slice() : [];
    state.categoriesLoaded = true;
    fillCategorySelects();
    return state.categories;
  }

  
  async function fetchCatalog() {
    if (state.abort) state.abort.abort();
    const controller = new AbortController();
    state.abort = controller;

    const result = await Data.fetchProducts('', {
      limit: CATALOG_LIMIT,
      signal: controller.signal
    });
    return (result && Array.isArray(result.content)) ? result.content : [];
  }

  async function load() {
    setLoading(true);
    try {
      const results = await Promise.all([fetchCatalog(), loadCategories()]);
      state.all = results[0] || [];

      applyClientFilters();
      renderTable();
      renderPagination();
      renderKpis(state.all);

      state.loaded = true;
      setLoading(false);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      console.error('[AnimeStock] No se pudo cargar el inventario:', error);
      state.all = [];
      applyClientFilters();
      renderTable();
      renderPagination();
      renderKpis([]);
      setLoading(false);
      showStatus('No se pudo cargar el inventario. Revisá la conexión con el servidor.');
    }
  }

  
  async function exportCsv() {
    if (dom.exportBtn) dom.exportBtn.disabled = true;
    try {
      const result = await Data.fetchProducts('', { limit: CATALOG_LIMIT });
      const all = (result && Array.isArray(result.content)) ? result.content : [];
      const list = all
        .filter(matchesQuery)
        .filter(matchesCategory)
        .filter(matchesStock)
        .sort(compareProducts);

      if (!list.length) {
        toast('No hay productos para exportar con estos filtros.', 'info');
        return;
      }

      const header = ['SKU', 'Nombre', 'Anime', 'Categoría', 'Costo', 'Precio', 'Margen', 'Stock']
        .map(UI.csvCell).join(';');

      const rows = list.map(function (product) {
        return [
          product.sku || '',
          product.name || '',
          product.anime || '',
          product.category || '',
          decimal(product.cost),
          decimal(product.price),
          marginPercent(product) === '' ? '' : marginPercent(product) + '%',
          toNumber(product.stock)
        ].map(UI.csvCell).join(';');
      });

      const csv = [header].concat(rows).join('\r\n');
      const stamp = new Date().toISOString().slice(0, 10);
      UI.downloadBlob(
        new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
        'inventario-' + stamp + '.csv'
      );

      toast(list.length + ' productos exportados a CSV', 'success');
    } catch (error) {
      console.error('[AnimeStock] No se pudo exportar el inventario:', error);
      toast('No se pudo generar el CSV', 'error');
    } finally {
      if (dom.exportBtn) dom.exportBtn.disabled = false;
    }
  }

  
  function setFieldError(fieldId, hasError) {
    const field = document.getElementById(fieldId);
    if (field) field.classList.toggle('field--error', !!hasError);
  }

  function showFormError(message) {
    if (!dom.formError) return;
    dom.formError.hidden = !message;
    dom.formError.textContent = message || '';
    if (message) dom.formError.setAttribute('role', 'alert');
  }

  function clearImagePreview() {
    if (state.imagePreviewUrl) {
      URL.revokeObjectURL(state.imagePreviewUrl);
      state.imagePreviewUrl = null;
    }
    state.imageFile = null;
    if (dom.imageInput) dom.imageInput.value = '';
    if (dom.imagePreview) {
      dom.imagePreview.removeAttribute('src');
      dom.imagePreview.hidden = true;
    }
    if (dom.imagePlaceholder) dom.imagePlaceholder.hidden = false;
    if (dom.imageClear) dom.imageClear.hidden = true;
  }

  function showImagePreview(src) {
    if (dom.imagePreview) {
      dom.imagePreview.src = src;
      dom.imagePreview.hidden = false;
    }
    if (dom.imagePlaceholder) dom.imagePlaceholder.hidden = true;
    if (dom.imageClear) dom.imageClear.hidden = false;
  }

  function handleImageSelect(file) {
    if (!file) return;
    if (!ACCEPTED_IMAGE.test(file.type)) {
      showFormError('Formato no soportado. Usá JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showFormError('La imagen supera los 5 MB.');
      return;
    }
    showFormError('');
    if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
    state.imageFile = file;
    state.imageRemoved = false;
    state.imagePreviewUrl = URL.createObjectURL(file);
    showImagePreview(state.imagePreviewUrl);
  }

  function clearImage() {
    
    state.imageRemoved = !!state.imageExistingUrl;
    clearImagePreview();
  }

  function setReadonly(readonly) {
    state.readonly = readonly;
    const form = $('#productForm');
    if (!form) return;
    $$('input, select, textarea, button', form).forEach(function (node) {
      node.disabled = readonly;
    });
    if (dom.imageDrop) {
      dom.imageDrop.classList.toggle('is-readonly', readonly);
    }
    if (dom.submit) dom.submit.hidden = readonly;
    if (dom.modalTitle) dom.modalTitle.textContent = readonly ? 'Detalle del producto' : (state.editing ? 'Editar producto' : 'Nuevo producto');
    if (dom.modalSubtitle) {
      dom.modalSubtitle.textContent = readonly
        ? 'Vista de solo lectura'
        : 'Cargá los datos del producto';
    }
  }

  function openProductModal(product, options) {
    const opts = options || {};
    const editing = !!product && !opts.readonly;

    state.editing = editing ? product : null;
    state.imageExistingUrl = product && product.imageUrl ? product.imageUrl : null;
    state.imageRemoved = false;
    clearImagePreview();
    showFormError('');

    
    ['productNameField', 'productCostField', 'productPriceField',
      'productStockField', 'productMinStockField'].forEach(function (id) {
      setFieldError(id, false);
    });

    if (dom.form) dom.form.reset();
    if (dom.formActive) dom.formActive.checked = true;

    if (product) {
      setFieldValue(dom.formName, product.name);
      setFieldValue(dom.formAnime, product.anime);
      setFieldValue(dom.formSku, product.sku);
      setFieldValue(dom.formCost, decimal(product.cost));
      setFieldValue(dom.formPrice, decimal(product.price));
      setFieldValue(dom.formStock, product.stock);
      setFieldValue(dom.formMinStock, product.minStock);
      if (dom.formActive) dom.formActive.checked = product.active !== false;
      selectCategoryByName(product.category);

      if (product.imageUrl) showImagePreview(product.imageUrl);
    } else {
      selectCategoryByName('');
    }

    setReadonly(!!opts.readonly);
    if (modal) UI.openModal(modal);
  }

  function setFieldValue(field, value) {
    if (field) field.value = value === undefined || value === null ? '' : String(value);
  }

  function selectCategoryByName(name) {
    if (!dom.formCategory) return;
    if (!name) { dom.formCategory.value = ''; return; }
    const match = state.categories.filter(function (category) {
      return category.nombre === name;
    })[0];
    dom.formCategory.value = match ? String(match.id) : '';
  }

  function closeProductModal() {
    if (modal) UI.closeModal(modal);
  }

  
  function validateForm() {
    const errors = [];
    const name = dom.formName ? dom.formName.value.trim() : '';
    const cost = dom.formCost.value;
    const price = dom.formPrice.value;
    const stock = dom.formStock.value;
    const minStock = dom.formMinStock.value;

    const nameOk = name.length >= 2 && name.length <= 80;
    setFieldError('productNameField', !nameOk);
    if (!nameOk) errors.push('El nombre debe tener entre 2 y 80 caracteres.');

    const costNumber = cost === '' ? 0 : Number(cost);
    const costOk = Number.isFinite(costNumber) && costNumber >= 0;
    setFieldError('productCostField', !costOk);
    if (!costOk) errors.push('El costo debe ser un número mayor o igual a 0.');

    const priceNumber = price === '' ? 0 : Number(price);
    const priceOk = Number.isFinite(priceNumber) && priceNumber >= 0;
    setFieldError('productPriceField', !priceOk);
    if (!priceOk) errors.push('El precio debe ser un número mayor o igual a 0.');

    const stockOk = /^\d+$/.test(String(stock).trim());
    setFieldError('productStockField', !stockOk);
    if (!stockOk) errors.push('El stock debe ser un entero mayor o igual a 0.');

    const minStockOk = /^\d+$/.test(String(minStock).trim());
    setFieldError('productMinStockField', !minStockOk);
    if (!minStockOk) errors.push('El stock mínimo debe ser un entero mayor o igual a 0.');

    return {
      ok: errors.length === 0,
      errors: errors,
      priceBelowCost: priceOk && costOk && priceNumber < costNumber,
      name: name
    };
  }

  function buildPayload() {
    const categoryValue = dom.formCategory ? dom.formCategory.value : '';
    const payload = {
      nombre: dom.formName.value.trim(),
      anime: dom.formAnime.value.trim() || null,
      categoriaId: categoryValue ? Number(categoryValue) : null,
      costo: dom.formCost.value === '' ? null : Number(dom.formCost.value),
      precio: dom.formPrice.value === '' ? null : Number(dom.formPrice.value),
      stock: dom.formStock.value === '' ? 0 : Number(dom.formStock.value),
      stockMinimo: dom.formMinStock.value === '' ? 0 : Number(dom.formMinStock.value),
      activo: dom.formActive ? dom.formActive.checked : true,
      sku: (dom.formSku.value || '').trim() || null
    };
    return payload;
  }

  
  function markFieldsFromMessage(message) {
    const text = String(message || '').toLowerCase();
    if (text.indexOf('nombre') !== -1) setFieldError('productNameField', true);
    if (text.indexOf('costo') !== -1) setFieldError('productCostField', true);
    if (text.indexOf('precio') !== -1) setFieldError('productPriceField', true);
    if (text.indexOf('stock') !== -1) setFieldError('productStockField', true);
  }

  async function handleSubmit(event) {
    if (event) event.preventDefault();
    if (state.readonly || state.saving) return;

    const validation = validateForm();
    if (!validation.ok) {
      showFormError(validation.errors[0]);
      return;
    }
    showFormError('');

    
    if (validation.priceBelowCost) {
      toast('El precio es menor que el costo. Se guardará igual.', 'info');
    }

    const payload = buildPayload();
    const editing = state.editing;

    state.saving = true;
    if (dom.submit) dom.submit.disabled = true;

    try {
      let saved;
      if (editing) {
        saved = await Data.updateProduct(editing.id, payload);
      } else {
        saved = await Data.createProduct(payload);
      }

      
      await persistImage(saved);

      toast(editing ? 'Producto actualizado' : 'Producto creado', 'success');
      closeProductModal();
      await load();
    } catch (error) {
      handleSaveError(error);
    } finally {
      state.saving = false;
      if (dom.submit) dom.submit.disabled = false;
    }
  }

  
  async function persistImage(product) {
    if (!product || !product.id) return;
    try {
      if (state.imageFile) {
        await Data.uploadProductImage(product.id, state.imageFile);
      } else if (state.imageRemoved) {
        await Data.deleteProductImage(product.id);
      }
    } catch (error) {
      if (error && error.status === 405) {
        toast('El servidor todavía no acepta subir imágenes: se ve solo en esta sesión.', 'info');
      } else if (error && error.status === 413) {
        toast('La imagen es demasiado grande para el servidor.', 'error');
      } else {
        toast((error && error.message) || 'No se pudo guardar la imagen', 'error');
      }
    }
  }

  function handleSaveError(error) {
    const status = error && error.status;
    const message = (error && error.message) || 'No se pudo guardar el producto';

    if (status === 400) {
      showFormError(message);
      markFieldsFromMessage(message);
      return;
    }
    if (status === 409) {
      toast(message, 'info');
      return;
    }
    console.error('[AnimeStock] Error al guardar el producto:', error);
    toast('Ocurrió un error al guardar. Intentá de nuevo.', 'error');
  }

  
  async function handleDelete(product) {
    const confirmed = await confirmDialog({
      title: 'Eliminar producto',
      message: 'Se eliminará "' + (product.name || 'el producto') + '" del inventario. '
        + 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar'
    });
    if (!confirmed) return;

    try {
      await Data.deleteProduct(product.id);
      toast('Producto eliminado', 'success');
      await load();
    } catch (error) {
      console.error('[AnimeStock] No se pudo eliminar el producto:', error);
      toast((error && error.message) || 'No se pudo eliminar el producto', 'error');
    }
  }

  
  async function handleAddCategory() {
    const name = global.prompt('Nombre de la nueva categoría:');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await Data.createCategory(trimmed);
      await loadCategories(true);
      if (created && dom.formCategory) {
        dom.formCategory.value = String(created.id);
      }
      toast('Categoría "' + trimmed + '" creada', 'success');
    } catch (error) {
      console.error('[AnimeStock] No se pudo crear la categoría:', error);
      toast((error && error.message) || 'No se pudo crear la categoría', 'error');
    }
  }

  
  function cacheDom() {
    dom = {
      search: $('#inventorySearch'),
      category: $('#inventoryCategory'),
      stock: $('#inventoryStock'),
      order: $('#inventoryOrder'),
      pageSize: $('#inventoryPageSize'),
      clear: $('#inventoryClearFilters'),
      exportBtn: $('#inventoryExportCsv'),
      newProduct: $('#inventoryNewProduct'),
      filtersToggle: $('#inventoryFiltersToggle'),
      filters: $('#inventoryFilters'),
      kpis: $('#inventoryKpis'),
      tableCard: $('#inventoryTableCard'),

      
      form: $('#productForm'),
      formError: $('#productError'),
      formName: $('#productName'),
      formAnime: $('#productAnime'),
      formCategory: $('#productCategory'),
      formSku: $('#productSku'),
      formCost: $('#productCost'),
      formPrice: $('#productPrice'),
      formStock: $('#productStock'),
      formMinStock: $('#productMinStock'),
      formActive: $('#productActive'),
      formCategoryAdd: $('#productCategoryAdd'),
      submit: $('#productSubmit'),
      modalTitle: $('#productModalTitle'),
      modalSubtitle: $('#productModalSubtitle'),
      imageDrop: $('#productImageDrop'),
      imageInput: $('#productImageInput'),
      imagePreview: $('#productImagePreview'),
      imagePlaceholder: $('#productImagePlaceholder'),
      imageClear: $('#productImageClear')
    };
  }

  function initModal() {
    const element = $('#productModal');
    if (!element || modal) return;
    modal = UI.createModal(element, {
      initialFocus: '#productName',
      onClose: function () {
        clearImagePreview();
        showFormError('');
      }
    });
  }

  function bindImageDrop() {
    const drop = dom.imageDrop;
    const input = dom.imageInput;
    if (!drop || !input) return;

    drop.addEventListener('click', function () {
      if (state.readonly) return;
      input.click();
    });

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleImageSelect(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        if (!state.readonly) drop.classList.add('is-dragover');
      });
    });

    ['dragleave', 'dragend', 'drop'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.remove('is-dragover');
      });
    });

    drop.addEventListener('drop', function (event) {
      if (state.readonly) return;
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    });
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    
    
    if (dom.search) {
      dom.search.addEventListener('input', UI.debounce(function () {
        applyFilters({ q: dom.search.value.trim() });
      }, 300));
    }

    if (dom.category) {
      dom.category.addEventListener('change', function () {
        applyFilters({ category: dom.category.value });
      });
    }
    if (dom.stock) {
      dom.stock.addEventListener('change', function () {
        applyFilters({ stock: dom.stock.value });
      });
    }
    if (dom.order) {
      dom.order.addEventListener('change', function () {
        applyFilters({ order: dom.order.value });
      });
    }
    if (dom.pageSize) {
      dom.pageSize.addEventListener('change', function () {
        state.pageSize = Number(dom.pageSize.value) || 25;
        applyFilters({});
      });
    }

    if (dom.clear) dom.clear.addEventListener('click', clearFilters);
    if (dom.exportBtn) dom.exportBtn.addEventListener('click', exportCsv);

    if (dom.newProduct) {
      dom.newProduct.addEventListener('click', function () { openProductModal(null); });
    }

    if (dom.filtersToggle && dom.filters) {
      dom.filtersToggle.addEventListener('click', function () {
        const collapsed = dom.filters.classList.toggle('is-collapsed');
        dom.filtersToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }

    
    if (dom.form) dom.form.addEventListener('submit', handleSubmit);
    if (dom.formCategoryAdd) dom.formCategoryAdd.addEventListener('click', handleAddCategory);
    if (dom.imageClear) {
      dom.imageClear.addEventListener('click', function (event) {
        event.preventDefault();
        clearImage();
      });
    }
    bindImageDrop();

    
    const panel = $('#panel-inventario');
    if (panel) {
      panel.addEventListener('anime:hidden', closeProductModal);
    }

    
    if (Data && typeof Data.onDataChange === 'function') {
      Data.onDataChange(function (reason) {
        if (!state.loaded) return;
        if (reason.indexOf('sale:') === 0 || reason.indexOf('product:') === 0) {
          load();
        }
      });
    }
  }

  function init() {
    cacheDom();
    initModal();
    bindEvents();
    syncFilterInputs();
  }

  
  function show() {
    init();
    if (!state.loaded) showStatus('Cargando inventario…');
    load();
  }

  function refresh() {
    init();
    return load();
  }

  global.AnimeStockInventory = {
    USE_LOCAL_IMAGES: USE_LOCAL_IMAGES,
    IMAGE_ACCEPT: IMAGE_ACCEPT,
    init: init,
    show: show,
    refresh: refresh,
    load: load,
    exportCsv: exportCsv,
    state: state
  };

})(typeof window !== 'undefined' ? window : globalThis);
