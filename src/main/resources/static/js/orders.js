
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;
  const UI = global.AnimeStockUI;

  const state = {
    pending: [],
    shipped: [],
    loaded: false,
    loading: false
  };

  let dom = {};
  let bound = false;

  
  function cacheDom() {
    dom = {
      status:       document.getElementById('ordersStatus'),
      kpis:         document.getElementById('ordersKpis'),
      refreshBtn:   document.getElementById('ordersRefresh'),
      newSaleBtn:   document.getElementById('ordersNewSale'),
      pendingList:  document.getElementById('ordersPendingList'),
      pendingCount: document.getElementById('ordersPendingCount'),
      pendingEmpty: document.getElementById('ordersPendingEmpty'),
      shippedList:  document.getElementById('ordersShippedList'),
      shippedCount: document.getElementById('ordersShippedCount'),
      shippedEmpty: document.getElementById('ordersShippedEmpty')
    };
  }

  function setStatus(text, visible) {
    if (!dom.status) return;
    dom.status.textContent = text || '';
    dom.status.hidden = !visible;
  }

  
  function itemsSummary(sale) {
    const items = sale.items || [];
    if (!items.length) return 'Sin productos';
    return items.map(function (item) {
      return item.quantity + '× ' + item.name;
    }).join('  ·  ');
  }

  function createOrderCard(sale, column) {
    const card = UI.el('article', { className: 'order-card' });

    const head = UI.el('div', { className: 'order-card__head' });
    head.appendChild(UI.el('span', {
      className: 'order-card__receipt',
      text: sale.receiptNumber || ('#' + sale.id)
    }));
    head.appendChild(UI.createStatusBadge(sale.status));
    card.appendChild(head);

    card.appendChild(UI.el('p', {
      className: 'order-card__date',
      text: UI.formatDateTime(sale.soldAt)
    }));

    const customer = UI.el('div', { className: 'order-card__customer' });
    customer.appendChild(UI.el('span', {
      className: 'order-card__avatar',
      text: (sale.customer && sale.customer.initials) || 'CF'
    }));
    customer.appendChild(UI.el('span', {
      text: (sale.customer && sale.customer.name) || 'Consumidor final'
    }));
    card.appendChild(customer);

    card.appendChild(UI.el('p', { className: 'order-card__items', text: itemsSummary(sale) }));

    const foot = UI.el('div', { className: 'order-card__foot' });
    foot.appendChild(UI.el('span', {
      className: 'order-card__total',
      text: UI.formatCurrency(sale.total)
    }));

    const actions = UI.el('div', { className: 'order-card__actions' });

    const viewBtn = UI.el('button', {
      className: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', 'aria-label': 'Ver comprobante del pedido ' + (sale.receiptNumber || sale.id) },
      text: '👁 Ver'
    });
    viewBtn.addEventListener('click', function () {
      if (global.AnimeStockReceipt) global.AnimeStockReceipt.open(sale, { focusPrint: false });
    });
    actions.appendChild(viewBtn);

    
    
    if (column === 'pending') {
      const chargeBtn = UI.el('button', {
        className: 'btn btn--primary btn--sm',
        attrs: { type: 'button', 'aria-label': 'Cobrar el pedido ' + (sale.receiptNumber || sale.id) },
        text: '💵 Cobrar'
      });
      chargeBtn.addEventListener('click', function () {
        if (global.AnimeStockCheckout) {
          global.AnimeStockCheckout.open({ sale: sale, status: 'PAGADO' });
        }
      });
      actions.appendChild(chargeBtn);
    }

    foot.appendChild(actions);
    card.appendChild(foot);

    return card;
  }

  function renderColumn(listEl, emptyEl, countEl, sales, column) {
    if (!listEl) return;
    listEl.textContent = '';
    if (countEl) countEl.textContent = String(sales.length);
    if (emptyEl) emptyEl.hidden = sales.length > 0;
    sales.forEach(function (sale) {
      listEl.appendChild(createOrderCard(sale, column));
    });
  }

  function sumTotals(list) {
    return list.reduce(function (acc, sale) {
      return acc + (Number(sale.total) || 0);
    }, 0);
  }

  function renderKpis() {
    UI.renderMiniKpis(dom.kpis, [
      {
        icon: '🧾',
        label: 'Por cobrar',
        value: String(state.pending.length),
        sub: state.pending.length === 1 ? 'pedido pendiente' : 'pedidos pendientes',
        tone: state.pending.length > 0 ? 'warn' : 'ok'
      },
      {
        icon: '💰',
        label: 'Monto por cobrar',
        value: UI.formatCurrency(sumTotals(state.pending)),
        sub: 'total sin acreditar',
        tone: 'warn'
      },
      {
        icon: '🚚',
        label: 'En camino',
        value: String(state.shipped.length),
        sub: state.shipped.length === 1 ? 'pedido enviado' : 'pedidos enviados',
        tone: 'neutral'
      },
      {
        icon: '📦',
        label: 'Monto en camino',
        value: UI.formatCurrency(sumTotals(state.shipped)),
        sub: 'por entregar',
        tone: 'neutral'
      }
    ]);
  }

  function render() {
    renderKpis();
    renderColumn(dom.pendingList, dom.pendingEmpty, dom.pendingCount, state.pending, 'pending');
    renderColumn(dom.shippedList, dom.shippedEmpty, dom.shippedCount, state.shipped, 'shipped');
  }

  
  async function load() {
    if (state.loading) return;
    state.loading = true;
    setStatus('Cargando pedidos…', true);

    try {
      const results = await Promise.all([
        Data.fetchSales({ status: 'PENDIENTE', limit: 200, offset: 0 }),
        Data.fetchSales({ status: 'ENVIADO', limit: 200, offset: 0 })
      ]);

      state.pending = results[0].content || [];
      state.shipped = results[1].content || [];
      state.loaded = true;

      render();
      setStatus('', false);
    } catch (error) {
      console.error('[AnimeStock] No se pudieron cargar los pedidos:', error);
      setStatus('No se pudieron cargar los pedidos. Revisá la conexión.', true);
    } finally {
      state.loading = false;
    }
  }

  function refresh() {
    return load();
  }

  
  function bindEvents() {
    if (bound) return;
    bound = true;

    if (dom.refreshBtn) dom.refreshBtn.addEventListener('click', refresh);
    if (dom.newSaleBtn) {
      dom.newSaleBtn.addEventListener('click', function () {
        if (global.AnimeStockCheckout) global.AnimeStockCheckout.open();
      });
    }

    
    
    if (Data && typeof Data.onDataChange === 'function') {
      Data.onDataChange(function (reason) {
        if (reason.indexOf('sale:') === 0 && state.loaded) refresh();
      });
    }
  }

  
  function init() {
    cacheDom();
    bindEvents();
  }

  function show() {
    init();
    load();
  }

  global.AnimeStockOrders = {
    init: init,
    show: show,
    refresh: refresh,
    state: state
  };

})(typeof window !== 'undefined' ? window : globalThis);
