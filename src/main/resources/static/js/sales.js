
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;

  
  const UI = global.AnimeStockUI;
  const {
    formatCurrency, formatCurrencyDec, formatDate, formatTime, formatDateTime,
    statusLabel, paymentLabel, paymentIcon, RANGE_LABELS,
    toast, createModal, openModal, closeModal,
    $, $$, el, debounce, csvCell,
    downloadBlob, createPaymentChip, createStatusBadge
  } = UI;


  const state = {
    filters: { q: '', payment: 'todos', status: 'todos', range: 'todo' },
    page: 1,            
    pageSize: 25,
    totalPages: 1,
    totalElements: 0,
    rows: [],
    loaded: false
  };

  let dom = {};         
  let bound = false;    

  
  function sumTotals(list) {
    return list.reduce(function (acc, sale) { return acc + sale.total; }, 0);
  }

  function computeKpis(all) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    
    const valid = all.filter(function (sale) { return sale.status !== 'ANULADO'; });

    const today = valid.filter(function (sale) {
      return new Date(sale.soldAt).getTime() >= todayStart.getTime();
    });

    const last30 = valid.filter(function (sale) {
      return new Date(sale.soldAt).getTime() >= thirtyDaysAgo.getTime();
    });

    const pending = valid.filter(function (sale) { return sale.status === 'PENDIENTE'; });

    
    const monthSales = valid.filter(function (sale) {
      return new Date(sale.soldAt).getTime() >= monthStart.getTime();
    });
    const byMethod = {};
    monthSales.forEach(function (sale) {
      byMethod[sale.paymentMethod] = (byMethod[sale.paymentMethod] || 0) + 1;
    });
    let topMethod = '';
    let topCount = 0;
    Object.keys(byMethod).forEach(function (key) {
      if (byMethod[key] > topCount) { topCount = byMethod[key]; topMethod = key; }
    });

    return {
      todayTotal: sumTotals(today),
      todayCount: today.length,
      avgTicket: last30.length ? sumTotals(last30) / last30.length : 0,
      avgTicketCount: last30.length,
      pendingTotal: sumTotals(pending),
      pendingCount: pending.length,
      topMethod: topMethod,
      topMethodCount: topCount
    };
  }

  
  function renderKpis(kpis) {
    const host = $('#salesKpis');
    if (!host) return;
    host.textContent = '';

    const cards = [
      {
        icon: '🛒',
        label: 'Ventas hoy',
        value: formatCurrency(kpis.todayTotal),
        sub: kpis.todayCount + (kpis.todayCount === 1 ? ' venta' : ' ventas'),
        tone: 'ok'
      },
      {
        icon: '🧾',
        label: 'Ticket promedio',
        value: formatCurrency(kpis.avgTicket),
        sub: 'últimos 30 días (' + kpis.avgTicketCount + ' ventas)',
        tone: 'neutral'
      },
      {
        icon: '⏳',
        label: 'Pendientes de cobro',
        value: formatCurrency(kpis.pendingTotal),
        sub: kpis.pendingCount + (kpis.pendingCount === 1 ? ' venta pendiente' : ' ventas pendientes'),
        tone: kpis.pendingTotal > 0 ? 'warn' : 'ok'
      },
      {
        icon: paymentIcon(kpis.topMethod),
        label: 'Método más usado',
        value: kpis.topMethod ? paymentLabel(kpis.topMethod) : '—',
        sub: kpis.topMethod ? kpis.topMethodCount + ' ventas este mes' : 'sin ventas este mes',
        tone: 'neutral'
      }
    ];

    cards.forEach(function (card, index) {
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
      host.appendChild(node);
    });
  }



  
  function summarizeItems(items) {
    const parts = items.map(function (item) {
      return item.name + ' x' + item.quantity;
    });
    if (parts.length <= 2) return parts.join(' + ');
    return parts.slice(0, 2).join(' + ') + ' +' + (parts.length - 2) + ' más';
  }

  
  function itemsDetail(items) {
    return items.map(function (item) {
      return item.quantity + ' x ' + item.name + ' (' + item.anime + ') - '
        + formatCurrency(item.subtotal);
    }).join(' | ');
  }

  
  function actionButton(action, sale) {
    const definitions = {
      view: { icon: '👁️', label: 'Ver detalle de la venta ' + sale.receiptNumber },
      reprint: { icon: '🖨️', label: 'Reimprimir comprobante ' + sale.receiptNumber },
      charge: { icon: '💵', label: 'Cobrar venta ' + sale.receiptNumber },
      edit: { icon: '✏️', label: 'Editar venta ' + sale.receiptNumber },
      cancel: { icon: '🗑️', label: 'Anular venta ' + sale.receiptNumber }
    };
    const def = definitions[action];
    const button = el('button', {
      className: 'row-action row-action--' + action,
      attrs: { type: 'button', 'aria-label': def.label, title: def.label }
    });
    button.textContent = def.icon;
    button.addEventListener('click', function () { handleRowAction(action, sale); });
    return button;
  }

  function buildRow(sale) {
    const tr = el('tr', { attrs: { 'data-sale-id': String(sale.id) } });

    
    const tdReceipt = el('td', { className: 'table__receipt' });
    const code = el('span', { className: 'receipt-code' });
    code.textContent = sale.receiptNumber;
    tdReceipt.appendChild(code);
    if (sale.status === 'ANULADO') {
      const flag = el('span', { className: 'receipt-flag' });
      flag.textContent = 'anulada';
      tdReceipt.appendChild(flag);
    }
    tr.appendChild(tdReceipt);

    
    const tdDate = el('td', { className: 'table__date' });
    tdDate.innerHTML = '<span class="table__date-main"></span>'
      + '<span class="table__date-time"></span>';
    $('.table__date-main', tdDate).textContent = formatDate(sale.soldAt);
    $('.table__date-time', tdDate).textContent = formatTime(sale.soldAt);
    tr.appendChild(tdDate);

    
    const tdCustomer = el('td');
    const user = el('div', { className: 'cell-user' });
    const avatar = el('span', { className: 'cell-user__avatar', attrs: { 'aria-hidden': 'true' } });
    avatar.textContent = sale.customer.initials;
    const name = el('span', { className: 'cell-user__name' });
    name.textContent = sale.customer.name;
    name.title = sale.customer.email || '';
    user.append(avatar, name);
    tdCustomer.appendChild(user);
    tr.appendChild(tdCustomer);

    
    const tdItems = el('td', { className: 'table__product table__items' });
    tdItems.textContent = summarizeItems(sale.items);
    tdItems.title = itemsDetail(sale.items);
    tr.appendChild(tdItems);

    
    const tdPay = el('td');
    tdPay.appendChild(createPaymentChip(sale.paymentMethod));
    tr.appendChild(tdPay);

    
    const tdTotal = el('td', { className: 'table__num' });
    tdTotal.textContent = formatCurrency(sale.total);
    tr.appendChild(tdTotal);

    
    const tdStatus = el('td');
    tdStatus.appendChild(createStatusBadge(sale.status));
    tr.appendChild(tdStatus);

    
    const tdActions = el('td', { className: 'table__actions' });
    tdActions.appendChild(actionButton('view', sale));
    tdActions.appendChild(actionButton('reprint', sale));
    if (sale.status === 'PENDIENTE') {
      tdActions.appendChild(actionButton('charge', sale));
      tdActions.appendChild(actionButton('edit', sale));
    }
    tdActions.appendChild(actionButton('cancel', sale));
    tr.appendChild(tdActions);

    return tr;
  }


  function renderTable(rows) {
    const body = $('#salesRows');
    const empty = $('#salesEmpty');
    const card = $('#salesTableCard');
    if (!body) return;

    body.textContent = '';

    const hasRows = rows.length > 0;
    if (card) card.hidden = !hasRows;
    if (empty) empty.hidden = hasRows;

    rows.forEach(function (sale) { body.appendChild(buildRow(sale)); });
  }

  
  function renderPagination() {
    const host = $('#salesPagination');
    const info = $('#salesInfo');
    if (!host) return;

    if (info) {
      const from = state.totalElements === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
      const to = Math.min(state.page * state.pageSize, state.totalElements);
      info.textContent = state.totalElements === 0
        ? 'Sin ventas para mostrar'
        : 'Mostrando ' + from + '-' + to + ' de ' + state.totalElements + ' ventas';
    }

    host.textContent = '';

    const prev = el('button', {
      className: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', 'aria-label': 'Página anterior' }
    });
    prev.innerHTML = '<span aria-hidden="true">←</span> Anterior';
    prev.disabled = state.page <= 1;
    prev.addEventListener('click', function () { goToPage(state.page - 1); });

    const next = el('button', {
      className: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', 'aria-label': 'Página siguiente' }
    });
    next.innerHTML = 'Siguiente <span aria-hidden="true">→</span>';
    next.disabled = state.page >= state.totalPages;

    const indicator = el('span', { className: 'pagination__info' });
    indicator.textContent = 'Página ' + state.page + ' de ' + state.totalPages;
    indicator.setAttribute('aria-live', 'polite');

    host.append(prev, indicator, next);
  }


  function setLoading(isLoading) {
    const table = $('#salesTableCard');
    const status = $('#salesStatus');
    if (status) {
      status.textContent = isLoading
        ? 'Actualizando ventas…'
        : '';
      status.hidden = !isLoading;
    }
    
    const panel = $('#panel-ventas');
    if (panel) panel.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    if (table) table.classList.toggle('is-loading', isLoading);
  }

  async function load() {
    setLoading(true);
    try {
      const tableRequest = Data.fetchSales({
        q: state.filters.q,
        payment: state.filters.payment,
        status: state.filters.status,
        range: state.filters.range,
        limit: state.pageSize,
        offset: (state.page - 1) * state.pageSize
      });

      
      
      const kpiRequest = Data.fetchSales({ limit: 500, offset: 0 });

      const [tableResult, kpiResult] = await Promise.all([tableRequest, kpiRequest]);

      state.rows = tableResult.content;
      state.totalElements = tableResult.totalElements;
      state.totalPages = tableResult.totalPages;

      
      if (state.page > state.totalPages) {
        state.page = state.totalPages;
        return load();
      }

      renderTable(state.rows);
      renderPagination();
      renderKpis(computeKpis(kpiResult.content));
      state.loaded = true;
    } catch (error) {
      console.error('[AnimeStock] No se pudieron cargar las ventas:', error);
      const status = $('#salesStatus');
      if (status) {
        status.hidden = false;
        status.textContent = 'No se pudo cargar el listado de ventas.';
      }
      renderTable([]);
      renderPagination();
    } finally {
      setLoading(false);
    }
  }

  function goToPage(page) {
    const target = Math.min(Math.max(1, page), state.totalPages);
    if (target === state.page) return;
    state.page = target;
    load();
  }

  
  function applyFilters(patch) {
    Object.keys(patch).forEach(function (key) {
      state.filters[key] = patch[key];
    });
    state.page = 1;
    load();
  }

  function clearFilters() {
    state.filters = { q: '', payment: 'todos', status: 'todos', range: 'todo' };
    state.page = 1;
    syncFilterInputs();
    load();
  }

  
  function syncFilterInputs() {
    const search = $('#salesSearch');
    const payment = $('#salesPaymentFilter');
    const status = $('#salesStatusFilter');
    const range = $('#salesRangeFilter');
    const size = $('#salesPageSize');

    if (search) search.value = state.filters.q;
    if (payment) payment.value = state.filters.payment;
    if (status) status.value = state.filters.status;
    if (range) range.value = state.filters.range;
    if (size) size.value = String(state.pageSize);
  }

  
  function handleRowAction(action, sale) {
    if (action === 'view' || action === 'reprint') {
      
      
      global.AnimeStockReceipt.open(sale, { focusPrint: action === 'reprint' });
      return;
    }

    if (action === 'charge') {
      
      global.AnimeStockCheckout.open({ sale: sale, status: 'PAGADO' });
      return;
    }

    if (action === 'edit') {
      global.AnimeStockCheckout.open({ sale: sale });
      return;
    }

    if (action === 'cancel') {
      requestCancel(sale);
    }
  }

  
  async function requestCancel(sale) {
    if (sale.status === 'ANULADO') {
      toast('La venta ' + sale.receiptNumber + ' ya estaba anulada.', 'info');
      return;
    }

    const confirmed = await global.AnimeStockUI.confirm({
      title: 'Anular venta ' + sale.receiptNumber,
      message: 'Se devolverá el stock al inventario'
        + (sale.status !== 'PENDIENTE' ? ' y se generará un egreso de reversión en la caja.' : '.')
        + ' Esta acción no se puede deshacer.',
      confirmText: 'Anular venta'
    });
    if (!confirmed) return;

    try {
      const cancelled = await Data.cancelSale(sale.id);
      toast('Venta ' + cancelled.receiptNumber + ' anulada · stock devuelto', 'success');
      load();
    } catch (error) {
      console.error('[AnimeStock] No se pudo anular la venta:', error);
      toast(error.message || 'No se pudo anular la venta', 'error');
    }
  }

  
  function csvHeader() {
    return [
      'Comprobante', 'Fecha', 'Hora', 'Cliente', 'Email', 'Productos',
      'Metodo de pago', 'Estado', 'Subtotal', 'Descuento', 'Total',
      'Recibido', 'Cambio', 'Referencia', 'Notas'
    ].map(csvCell).join(';');
  }

  function csvRow(sale) {
    return [
      sale.receiptNumber,
      formatDate(sale.soldAt),
      formatTime(sale.soldAt),
      sale.customer.name,
      sale.customer.email,
      sale.items.map(function (item) {
        return item.quantity + ' x ' + item.name;
      }).join(' + '),
      paymentLabel(sale.paymentMethod),
      statusLabel(sale.status),
      sale.subtotal,
      sale.discount,
      sale.total,
      sale.paymentMethod === 'EFECTIVO' ? sale.amountReceived : '',
      sale.paymentMethod === 'EFECTIVO' ? sale.change : '',
      sale.reference,
      sale.notes
    ].map(csvCell).join(';');
  }

  async function exportCsv() {
    try {
      const result = await Data.fetchSales({
        q: state.filters.q,
        payment: state.filters.payment,
        status: state.filters.status,
        range: state.filters.range,
        limit: 1000,
        offset: 0
      });

      if (!result.content.length) {
        toast('No hay ventas para exportar con estos filtros.', 'info');
        return;
      }

      const csv = [csvHeader()]
        .concat(result.content.map(csvRow))
        .join('\r\n');

      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(
        new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }),
        'ventas-animestock-' + stamp + '.csv'
      );

      toast(result.content.length + ' ventas exportadas a CSV', 'success');
    } catch (error) {
      console.error('[AnimeStock] No se pudo exportar:', error);
      toast('No se pudo generar el CSV', 'error');
    }
  }



  function cacheDom() {
    dom = {
      search: $('#salesSearch'),
      payment: $('#salesPaymentFilter'),
      status: $('#salesStatusFilter'),
      range: $('#salesRangeFilter'),
      size: $('#salesPageSize'),
      clear: $('#salesClearFilters'),
      exportBtn: $('#salesExportCsv'),
      newSale: $('#salesNewSale'),
      filtersToggle: $('#salesFiltersToggle'),
      filters: $('#salesFilters')
    };
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    
    if (dom.search) {
      dom.search.addEventListener('input', debounce(function () {
        applyFilters({ q: dom.search.value.trim() });
      }, 280));
    }

    if (dom.payment) {
      dom.payment.addEventListener('change', function () {
        applyFilters({ payment: dom.payment.value });
      });
    }
    if (dom.status) {
      dom.status.addEventListener('change', function () {
        applyFilters({ status: dom.status.value });
      });
    }
    if (dom.range) {
      dom.range.addEventListener('change', function () {
        applyFilters({ range: dom.range.value });
      });
    }
    if (dom.size) {
      dom.size.addEventListener('change', function () {
        state.pageSize = Number(dom.size.value) || 25;
        applyFilters({});
      });
    }

    if (dom.clear) dom.clear.addEventListener('click', clearFilters);
    if (dom.exportBtn) dom.exportBtn.addEventListener('click', exportCsv);

    if (dom.newSale) {
      dom.newSale.addEventListener('click', function () {
        global.AnimeStockCheckout.open();
      });
    }

    
    if (dom.filtersToggle && dom.filters) {
      dom.filtersToggle.addEventListener('click', function () {
        const collapsed = dom.filters.classList.toggle('is-collapsed');
        dom.filtersToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }

    
    const panel = $('#panel-ventas');
    if (panel) {
      panel.addEventListener('anime:hidden', function () {
        global.AnimeStockCheckout.close();
        global.AnimeStockReceipt.close();
      });
    }
  }

  function init() {
    cacheDom();
    bindEvents();
    syncFilterInputs();
  }

  
  function show() {
    init();
    
    if (!state.loaded) {
      const status = $('#salesStatus');
      if (status) {
        status.hidden = false;
        status.textContent = 'Cargando ventas…';
      }
    }
    load();
  }

  
  function refresh() {
    init();
    return load();
  }


  global.AnimeStockSales = {
    init: init,
    show: show,
    refresh: refresh,
    exportCsv: exportCsv,
    state: state
  };

  
  
  
  if (Data && typeof Data.onDataChange === 'function') {
    Data.onDataChange(function (reason) {
      if (reason.indexOf('sale:') === 0 && state.loaded) refresh();
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
