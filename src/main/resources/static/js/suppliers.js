
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;
  const UI = global.AnimeStockUI;

  const STORAGE_KEY = 'animestock:purchases';

  const state = {
    purchases: [],
    products: [],
    categories: [],
    catalogLoaded: false,
    loaded: false,
    saving: false
  };

  let dom = {};
  let modal = null;
  let bound = false;

  
  function readStored() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[AnimeStock] Compras ilegibles, se arranca vacío.');
      return [];
    }
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.purchases));
      return true;
    } catch (error) {
      console.error('[AnimeStock] No se pudieron guardar las compras:', error);
      UI.toast('No se pudieron guardar las compras en este navegador', 'error');
      return false;
    }
  }

  
  function cacheDom() {
    dom = {
      status:       document.getElementById('purchasesStatus'),
      kpis:         document.getElementById('purchasesKpis'),
      rows:         document.getElementById('purchasesRows'),
      empty:        document.getElementById('purchasesEmpty'),
      info:         document.getElementById('purchasesInfo'),
      newBtn:       document.getElementById('purchasesNew'),

      modalEl:      document.getElementById('purchaseModal'),
      error:        document.getElementById('purchaseError'),
      supplier:     document.getElementById('purchaseSupplier'),
      date:         document.getElementById('purchaseDate'),
      stateSel:     document.getElementById('purchaseState'),
      paidSel:      document.getElementById('purchasePaid'),
      lines:        document.getElementById('purchaseLines'),
      addLineBtn:   document.getElementById('purchaseAddLine'),
      totalText:    document.getElementById('purchaseTotalText'),
      updateCost:   document.getElementById('purchaseUpdateCost'),
      confirmBtn:   document.getElementById('purchaseConfirm')
    };
  }

  function setStatus(text, visible) {
    if (!dom.status) return;
    dom.status.textContent = text || '';
    dom.status.hidden = !visible;
  }

  function showError(message) {
    if (!dom.error) return;
    dom.error.textContent = message || '';
    dom.error.hidden = !message;
  }

  
  function todayInput() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function sameMonth(dateInputValue) {
    if (!dateInputValue) return false;
    const parts = String(dateInputValue).split('-');
    if (parts.length < 2) return false;
    const now = new Date();
    return Number(parts[0]) === now.getFullYear() && Number(parts[1]) === (now.getMonth() + 1);
  }

  function formatInputDate(value) {
    if (!value) return '—';
    const parts = String(value).split('-');
    if (parts.length !== 3) return value;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function categoryIdByName(name) {
    if (!name) return null;
    const found = state.categories.find(function (category) {
      return String(category.nombre || category.name).toLowerCase() === String(name).toLowerCase();
    });
    return found ? found.id : null;
  }

  function productById(id) {
    return state.products.find(function (product) {
      return Number(product.id) === Number(id);
    });
  }

  function summaryProducts(lineas) {
    const names = (lineas || []).map(function (line) { return line.nombre; });
    if (names.length <= 2) return names.join(', ');
    return names.slice(0, 2).join(', ') + ' +' + (names.length - 2) + ' más';
  }

  function sumUnits(lineas) {
    return (lineas || []).reduce(function (acc, line) {
      return acc + (Number(line.cantidad) || 0);
    }, 0);
  }

  
  async function ensureCatalog(force) {
    if (state.catalogLoaded && !force) return;
    try {
      const results = await Promise.all([
        Data.fetchProducts('', { limit: 1000 }),
        Data.fetchCategories()
      ]);
      const productsRes = results[0];
      state.products = (productsRes && Array.isArray(productsRes.content)) ? productsRes.content : [];
      state.categories = Array.isArray(results[1]) ? results[1] : [];
      state.catalogLoaded = true;
    } catch (error) {
      console.error('[AnimeStock] No se pudo cargar el catálogo de productos:', error);
      state.products = [];
      state.categories = [];
    }
  }

  
  function renderKpis() {
    const monthPurchases = state.purchases.filter(function (purchase) {
      return sameMonth(purchase.fecha);
    });
    const invested = monthPurchases.reduce(function (acc, purchase) {
      return acc + (Number(purchase.total) || 0);
    }, 0);
    const units = monthPurchases.reduce(function (acc, purchase) {
      return acc + (Number(purchase.unidades) || 0);
    }, 0);
    const suppliers = {};
    state.purchases.forEach(function (purchase) {
      if (purchase.proveedor) suppliers[purchase.proveedor.toLowerCase()] = true;
    });

    UI.renderMiniKpis(dom.kpis, [
      { icon: '🧾', label: 'Compras del mes', value: String(monthPurchases.length),
        sub: monthPurchases.length === 1 ? 'compra registrada' : 'compras registradas', tone: 'neutral' },
      { icon: '💸', label: 'Invertido este mes', value: UI.formatCurrency(invested),
        sub: 'costo de reposición', tone: 'warn' },
      { icon: '📦', label: 'Unidades ingresadas', value: String(units),
        sub: 'en el mes actual', tone: 'ok' },
      { icon: '🚚', label: 'Proveedores', value: String(Object.keys(suppliers).length),
        sub: 'distintos registrados', tone: 'neutral' }
    ]);
  }

  function createRow(purchase) {
    const tr = UI.el('tr', { attrs: { 'data-purchase': purchase.id } });

    tr.appendChild(UI.el('td', { className: 'table__date', text: formatInputDate(purchase.fecha) }));

    const tdSupplier = UI.el('td');
    tdSupplier.appendChild(UI.el('strong', { text: purchase.proveedor }));
    tr.appendChild(tdSupplier);

    tr.appendChild(UI.el('td', { className: 'table__muted', text: summaryProducts(purchase.lineas) }));
    tr.appendChild(UI.el('td', { className: 'table__num', text: String(purchase.unidades) }));
    tr.appendChild(UI.el('td', { className: 'table__num', text: UI.formatCurrency(purchase.total) }));

    const tdState = UI.el('td');
    tdState.appendChild(createStateBadge(purchase));
    tr.appendChild(tdState);

    const tdActions = UI.el('td', { className: 'table__num' });
    const actions = UI.el('div', { className: 'table__actions' });

    if (purchase.estado === 'pendiente') {
      const receiveBtn = UI.el('button', {
        className: 'btn btn--ghost btn--sm',
        attrs: { type: 'button', 'aria-label': 'Recibir la compra de ' + purchase.proveedor },
        text: '📥 Recibir'
      });
      receiveBtn.addEventListener('click', function () { receivePurchase(purchase.id); });
      actions.appendChild(receiveBtn);
    }

    const deleteBtn = UI.el('button', {
      className: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', 'aria-label': 'Eliminar la compra de ' + purchase.proveedor },
      text: '🗑'
    });
    deleteBtn.addEventListener('click', function () { deletePurchase(purchase.id); });
    actions.appendChild(deleteBtn);

    tdActions.appendChild(actions);
    tr.appendChild(tdActions);

    return tr;
  }

  function createStateBadge(purchase) {
    const isReceived = purchase.estado === 'recibida';
    const badge = UI.el('span', {
      className: 'badge ' + (isReceived ? 'badge--pagado' : 'badge--pendiente') + ' status-badge'
    });
    badge.appendChild(UI.el('span', { className: 'badge__dot', attrs: { 'aria-hidden': 'true' } }));
    badge.appendChild(document.createTextNode(
      (isReceived ? 'Recibida' : 'Pendiente') + (purchase.pagada ? ' · pagada' : '')
    ));
    return badge;
  }

  function render() {
    renderKpis();

    if (dom.rows) {
      dom.rows.textContent = '';
      state.purchases
        .slice()
        .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
        .forEach(function (purchase) { dom.rows.appendChild(createRow(purchase)); });
    }

    if (dom.empty) dom.empty.hidden = state.purchases.length > 0;
    if (dom.info) {
      dom.info.textContent = state.purchases.length === 1
        ? '1 compra registrada'
        : state.purchases.length + ' compras registradas';
    }
  }

  
  function productOptions() {
    return state.products.map(function (product) {
      return { value: String(product.id), label: product.name + (product.sku ? ' · ' + product.sku : '') };
    });
  }

  function addLine() {
    if (!dom.lines) return;

    const row = UI.el('div', { className: 'purchase-line', attrs: { 'data-line': '' } });

    const productField = UI.el('div', { className: 'field' });
    productField.appendChild(UI.el('label', { className: 'field__label', text: 'Producto' }));
    const select = UI.el('select', { className: 'select', attrs: { 'data-line-product': '' } });
    select.appendChild(UI.el('option', { text: state.products.length ? 'Elegí un producto…' : 'Sin productos cargados', attrs: { value: '' } }));
    productOptions().forEach(function (option) {
      select.appendChild(UI.el('option', { text: option.label, attrs: { value: option.value } }));
    });
    productField.appendChild(select);
    row.appendChild(productField);

    const qtyField = UI.el('div', { className: 'field' });
    qtyField.appendChild(UI.el('label', { className: 'field__label', text: 'Cant.' }));
    qtyField.appendChild(UI.el('input', { className: 'input', attrs: { type: 'number', min: '1', step: '1', value: '1', 'data-line-qty': '' } }));
    row.appendChild(qtyField);

    const costField = UI.el('div', { className: 'field' });
    costField.appendChild(UI.el('label', { className: 'field__label', text: 'Costo unit.' }));
    costField.appendChild(UI.el('input', { className: 'input', attrs: { type: 'number', min: '0', step: '0.01', value: '0', 'data-line-cost': '' } }));
    row.appendChild(costField);

    row.appendChild(UI.el('span', { className: 'purchase-line__sub', text: '$0', attrs: { 'data-line-sub': '' } }));

    const removeBtn = UI.el('button', {
      className: 'btn btn--ghost btn--icon purchase-line__remove',
      attrs: { type: 'button', 'aria-label': 'Quitar esta línea' },
      text: '✕'
    });
    removeBtn.addEventListener('click', function () {
      row.remove();
      recalcTotal();
    });
    row.appendChild(removeBtn);

    
    select.addEventListener('change', function () {
      const product = productById(select.value);
      const costInput = row.querySelector('[data-line-cost]');
      if (product && costInput && (!Number(costInput.value))) {
        costInput.value = product.cost ? String(product.cost) : '0';
      }
      recalcTotal();
    });

    row.querySelectorAll('[data-line-qty], [data-line-cost]').forEach(function (input) {
      input.addEventListener('input', recalcTotal);
    });

    dom.lines.appendChild(row);
    recalcTotal();
  }

  function currentLines() {
    if (!dom.lines) return [];
    return Array.prototype.slice.call(dom.lines.querySelectorAll('[data-line]')).map(function (row) {
      const select = row.querySelector('[data-line-product]');
      const qty = row.querySelector('[data-line-qty]');
      const cost = row.querySelector('[data-line-cost]');
      const product = productById(select ? select.value : null);
      const cantidad = Math.max(1, parseInt(qty ? qty.value : '1', 10) || 1);
      const costo = Math.max(0, Number(cost ? cost.value : 0) || 0);

      return {
        productId: product ? product.id : null,
        nombre: product ? product.name : '',
        cantidad: cantidad,
        costo: costo,
        subtotal: cantidad * costo
      };
    });
  }

  function recalcTotal() {
    const total = currentLines().reduce(function (acc, line) { return acc + line.subtotal; }, 0);
    if (dom.totalText) dom.totalText.textContent = UI.formatCurrency(total);
    if (dom.lines) {
      Array.prototype.slice.call(dom.lines.querySelectorAll('[data-line]')).forEach(function (row) {
        const select = row.querySelector('[data-line-product]');
        const qty = row.querySelector('[data-line-qty]');
        const cost = row.querySelector('[data-line-cost]');
        const sub = row.querySelector('[data-line-sub]');
        const value = (parseInt(qty ? qty.value : '0', 10) || 0) * (Number(cost ? cost.value : 0) || 0);
        if (sub) sub.textContent = UI.formatCurrency(value);
        if (select) select.setAttribute('aria-label', 'Producto de la línea');
      });
    }
    return total;
  }

  
  async function openModal() {
    showError('');
    await ensureCatalog(false);

    if (dom.supplier) dom.supplier.value = '';
    if (dom.date) dom.date.value = todayInput();
    if (dom.stateSel) dom.stateSel.value = 'recibida';
    if (dom.paidSel) dom.paidSel.value = 'si';
    if (dom.updateCost) dom.updateCost.checked = true;
    if (dom.lines) dom.lines.textContent = '';

    addLine();

    if (!state.products.length) {
      showError('No hay productos cargados: creá productos en Inventario antes de registrar una compra.');
    }

    UI.openModal(modal);
  }

  function closeModal() {
    if (modal) UI.closeModal(modal);
  }

  
  async function applyPurchaseLines(purchase, updateCost) {
    
    await ensureCatalog(true);

    let applied = 0;
    const errors = [];

    for (let i = 0; i < purchase.lineas.length; i++) {
      const line = purchase.lineas[i];
      const product = productById(line.productId);
      if (!product) {
        errors.push(line.nombre || ('Producto #' + line.productId) + ' ya no existe');
        continue;
      }

      const payload = {
        sku: product.sku || null,
        nombre: product.name,
        anime: product.anime || null,
        categoriaId: categoryIdByName(product.category),
        costo: updateCost ? line.costo : (product.cost === null || product.cost === undefined ? null : Number(product.cost)),
        precio: product.price === null || product.price === undefined ? null : Number(product.price),
        stock: (Number(product.stock) || 0) + (Number(line.cantidad) || 0),
        stockMinimo: Number(product.minStock) || 0,
        activo: product.active !== false
      };

      try {
        await Data.updateProduct(product.id, payload);
        applied++;
      } catch (error) {
        errors.push(product.name + ': ' + (error && error.message ? error.message : 'no se pudo actualizar'));
      }
    }

    return { applied: applied, errors: errors };
  }

  async function submitPurchase() {
    if (state.saving) return;

    const proveedor = dom.supplier ? dom.supplier.value.trim() : '';
    if (!proveedor) {
      showError('Indicá el proveedor de la compra.');
      if (dom.supplier) dom.supplier.focus();
      return;
    }

    const lineas = currentLines().filter(function (line) { return line.productId; });
    if (!lineas.length) {
      showError('Agregá al menos un producto con cantidad.');
      return;
    }

    const fecha = dom.date && dom.date.value ? dom.date.value : todayInput();
    const estado = dom.stateSel ? dom.stateSel.value : 'recibida';
    const pagada = (dom.paidSel ? dom.paidSel.value : 'si') === 'si';
    const updateCost = dom.updateCost ? !!dom.updateCost.checked : true;
    const total = lineas.reduce(function (acc, line) { return acc + line.subtotal; }, 0);
    const unidades = sumUnits(lineas);

    const purchase = {
      id: 'p-' + Date.now().toString(36),
      proveedor: proveedor,
      fecha: fecha,
      estado: estado,
      pagada: pagada,
      lineas: lineas,
      unidades: unidades,
      total: total,
      createdAt: Date.now()
    };

    state.saving = true;
    if (dom.confirmBtn) dom.confirmBtn.disabled = true;
    showError('');

    let stockResult = { applied: 0, errors: [] };

    try {
      if (estado === 'recibida') {
        stockResult = await applyPurchaseLines(purchase, updateCost);
      }

      if (pagada && total > 0) {
        await Data.createCashMovement({
          type: 'EGRESO',
          amount: total,
          description: 'Compra a ' + proveedor + ' (' + lineas.length + (lineas.length === 1 ? ' producto)' : ' productos)'),
          occurredAt: new Date(fecha + 'T12:00:00').toISOString()
        });
      }

      state.purchases.push(purchase);
      persist();
      render();
      closeModal();

      if (stockResult.errors.length) {
        UI.toast('Compra guardada con avisos: ' + stockResult.errors[0], 'error');
      } else if (estado === 'recibida') {
        UI.toast('Compra registrada · stock actualizado (' + stockResult.applied + ')', 'success');
      } else {
        UI.toast('Compra registrada como pendiente', 'success');
      }
    } catch (error) {
      console.error('[AnimeStock] No se pudo registrar la compra:', error);
      showError(error && error.message ? error.message : 'No se pudo registrar la compra.');
    } finally {
      state.saving = false;
      if (dom.confirmBtn) dom.confirmBtn.disabled = false;
    }
  }

  
  async function receivePurchase(id) {
    const purchase = state.purchases.find(function (item) { return item.id === id; });
    if (!purchase) return;

    const confirmed = await UI.confirm({
      title: 'Recibir compra',
      message: 'Se va a subir el stock de ' + purchase.lineas.length +
        (purchase.lineas.length === 1 ? ' producto' : ' productos') + ' y la compra pasa a "Recibida".',
      confirmText: 'Recibir'
    });
    if (!confirmed) return;

    setStatus('Aplicando stock…', true);
    try {
      const result = await applyPurchaseLines(purchase, true);
      purchase.estado = 'recibida';
      persist();
      render();
      setStatus('', false);
      if (result.errors.length) {
        UI.toast('Stock actualizado con avisos: ' + result.errors[0], 'error');
      } else {
        UI.toast('Compra recibida · stock actualizado', 'success');
      }
    } catch (error) {
      console.error('[AnimeStock] No se pudo recibir la compra:', error);
      setStatus('No se pudo aplicar el stock. Revisá la conexión.', true);
    }
  }

  async function deletePurchase(id) {
    const purchase = state.purchases.find(function (item) { return item.id === id; });
    if (!purchase) return;

    const confirmed = await UI.confirm({
      title: 'Eliminar compra',
      message: 'Se quita del registro local. El stock ya aplicado NO se revierte.',
      confirmText: 'Eliminar',
      danger: true
    });
    if (!confirmed) return;

    state.purchases = state.purchases.filter(function (item) { return item.id !== id; });
    persist();
    render();
    UI.toast('Compra eliminada', 'info');
  }

  
  function bindEvents() {
    if (bound) return;
    bound = true;

    if (dom.newBtn) dom.newBtn.addEventListener('click', openModal);
    if (dom.addLineBtn) dom.addLineBtn.addEventListener('click', addLine);
    if (dom.confirmBtn) dom.confirmBtn.addEventListener('click', submitPurchase);
  }

  
  async function init() {
    cacheDom();
    bindEvents();

    if (dom.modalEl && !modal) {
      modal = UI.createModal(dom.modalEl, { initialFocus: '#purchaseSupplier' });
    }
  }

  async function show() {
    state.purchases = readStored().map(function (purchase) {
      
      return Object.assign({ unidades: sumUnits(purchase.lineas) }, purchase);
    });

    await init();
    render();
    state.loaded = true;

    
    ensureCatalog(false).catch(function () {});
  }

  global.AnimeStockSuppliers = {
    init: init,
    show: show,
    state: state,
    STORAGE_KEY: STORAGE_KEY
  };

})(typeof window !== 'undefined' ? window : globalThis);
