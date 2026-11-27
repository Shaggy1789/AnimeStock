
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;
  const $ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };
  const $$ = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };

  const state = {
    range: 'hoy',
    rows: [],
    summary: { income: 0, expense: 0, balance: 0 },
    loaded: false
  };

  let modal = null;
  let bound = false;

  
  const UI = global.AnimeStockUI;
  const SESSION_KEY = 'animestock:cash:session';

  let sessionModal = null;
  let sessionMode = 'abrir';   
  let sessionCierre = null;    

  function readSession() {
    try {
      const raw = global.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      global.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      
    }
  }

  function sumBy(rows, type) {
    return rows.reduce(function (acc, movement) {
      return movement.type === type ? acc + (Number(movement.amount) || 0) : acc;
    }, 0);
  }

  
  async function movementsSince(iso) {
    const result = await Data.fetchCashMovements('todo', { limit: 500 });
    const since = iso ? new Date(iso).getTime() : 0;
    return (result.content || []).filter(function (movement) {
      return new Date(movement.occurredAt).getTime() >= since;
    });
  }

  
  function renderSession() {
    const bar = $('#cashSessionBar');
    if (!bar) return;

    const icon = $('#cashSessionIcon');
    const stateEl = $('#cashSessionState');
    const detail = $('#cashSessionDetail');
    const action = $('#cashSessionAction');

    const session = readSession();
    const open = !!(session && session.abierta);

    bar.classList.toggle('is-open', open);
    if (icon) icon.textContent = open ? '🔓' : '🔒';
    if (stateEl) stateEl.textContent = open ? 'Caja abierta' : 'Caja cerrada';
    if (action) action.textContent = open ? 'Cerrar caja' : 'Abrir caja';

    if (open) {
      if (detail) {
        detail.textContent = 'Desde ' + UI.formatDateTime(session.abiertaEn)
          + ' · Fondo ' + UI.formatCurrency(session.fondoInicial);
      }
    } else if (session && session.ultimoCierre) {
      const diff = Number(session.ultimoCierre.diferencia) || 0;
      if (detail) {
        detail.textContent = 'Último cierre ' + UI.formatDateTime(session.ultimoCierre.cerradaEn)
          + ' · ' + (diff === 0 ? 'sin diferencias' : 'diferencia ' + UI.formatCurrency(diff));
      }
    } else if (detail) {
      detail.textContent = 'Abrí la caja para registrar el fondo inicial.';
    }
  }

  function summaryRow(label, value, strong) {
    return '<div class="cash-session-summary__row' + (strong ? ' is-strong' : '') + '">'
      + '<span>' + label + '</span>'
      + '<span class="cash-session-summary__value">' + value + '</span>'
      + '</div>';
  }

  function showSessionError(message) {
    const box = $('#cashSessionError');
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || '';
  }

  function updateCloseDiff() {
    const diffEl = $('#cashCloseDiff');
    const countedInput = $('#cashCloseCounted');
    if (!diffEl || !sessionCierre) return;
    const counted = Number(countedInput ? countedInput.value : 0) || 0;
    const diff = counted - sessionCierre.esperado;
    diffEl.textContent = diff === 0
      ? 'Sin diferencias respecto al esperado.'
      : 'Diferencia: ' + UI.formatCurrency(diff);
    diffEl.classList.toggle('is-warn', diff !== 0);
  }

  
  async function openSessionModal(mode) {
    const element = $('#cashSessionModal');
    if (!element) return;

    if (!sessionModal) {
      sessionModal = UI.createModal(element, { initialFocus: '#cashOpeningAmount' });
    }

    sessionMode = mode === 'cerrar' ? 'cerrar' : 'abrir';
    sessionCierre = null;

    const title = $('#cashSessionTitle');
    const subtitle = $('#cashSessionSubtitle');
    const submit = $('#cashSessionSubmit');
    const openFields = $('#cashOpenFields');
    const closeFields = $('#cashCloseFields');

    showSessionError('');

    if (sessionMode === 'abrir') {
      if (title) title.textContent = 'Abrir caja';
      if (subtitle) subtitle.textContent = 'Registrá el fondo inicial del turno';
      if (submit) { submit.textContent = 'Abrir caja'; submit.disabled = false; }
      if (openFields) openFields.hidden = false;
      if (closeFields) closeFields.hidden = true;
      const amount = $('#cashOpeningAmount');
      if (amount) amount.value = '';
      UI.openModal(sessionModal);
      return;
    }

    
    if (title) title.textContent = 'Cerrar caja';
    if (subtitle) subtitle.textContent = 'Arqueo del turno actual';
    if (submit) submit.textContent = 'Registrar cierre';
    if (openFields) openFields.hidden = true;
    if (closeFields) closeFields.hidden = false;

    const countedInput = $('#cashCloseCounted');
    if (countedInput) countedInput.value = '';
    const summaryHost = $('#cashCloseSummary');
    const diffEl = $('#cashCloseDiff');
    if (diffEl) { diffEl.textContent = ''; diffEl.classList.remove('is-warn'); }

    const session = readSession();
    if (!session || !session.abierta) {
      if (summaryHost) summaryHost.textContent = 'Primero tenés que abrir la caja.';
      if (submit) submit.disabled = true;
      UI.openModal(sessionModal);
      return;
    }
    if (submit) submit.disabled = false;

    if (summaryHost) summaryHost.textContent = 'Calculando movimientos…';
    UI.openModal(sessionModal);

    try {
      const rows = await movementsSince(session.abiertaEn);
      const income = sumBy(rows, 'INGRESO');
      const expense = sumBy(rows, 'EGRESO');
      const fondo = Number(session.fondoInicial) || 0;
      const esperado = fondo + income - expense;
      sessionCierre = { income: income, expense: expense, fondo: fondo, esperado: esperado };

      if (summaryHost) {
        summaryHost.innerHTML = [
          summaryRow('Fondo inicial', UI.formatCurrency(fondo)),
          summaryRow('Ingresos del turno', '+ ' + UI.formatCurrency(income)),
          summaryRow('Egresos del turno', '− ' + UI.formatCurrency(expense)),
          summaryRow('Esperado en caja', UI.formatCurrency(esperado), true)
        ].join('');
      }
      updateCloseDiff();
    } catch (error) {
      console.error('[AnimeStock] No se pudo calcular el arqueo:', error);
      if (summaryHost) summaryHost.textContent = 'No se pudieron calcular los movimientos del turno.';
    }
  }

  function closeSessionModal() {
    if (sessionModal) UI.closeModal(sessionModal);
  }

  function submitSession() {
    showSessionError('');

    if (sessionMode === 'abrir') {
      const input = $('#cashOpeningAmount');
      const amount = Math.round(Number(input ? input.value : 0) || 0);
      if (amount < 0) {
        showSessionError('El fondo inicial no puede ser negativo.');
        if (input) input.focus();
        return;
      }
      const previous = readSession();
      writeSession({
        abierta: true,
        abiertaEn: new Date().toISOString(),
        fondoInicial: amount,
        ultimoCierre: previous ? previous.ultimoCierre || null : null
      });
      closeSessionModal();
      renderSession();
      UI.toast('Caja abierta · fondo ' + UI.formatCurrency(amount), 'success');
      return;
    }

    if (!sessionCierre) {
      showSessionError('Todavía no se calculó el arqueo. Esperá un segundo.');
      return;
    }

    const input = $('#cashCloseCounted');
    const counted = Math.round(Number(input ? input.value : NaN));
    if (!isFinite(counted) || counted < 0) {
      showSessionError('Escribí el efectivo contado (0 o más).');
      if (input) input.focus();
      return;
    }

    const diferencia = counted - sessionCierre.esperado;
    writeSession({
      abierta: false,
      abiertaEn: null,
      fondoInicial: 0,
      ultimoCierre: {
        cerradaEn: new Date().toISOString(),
        fondo: sessionCierre.fondo,
        income: sessionCierre.income,
        expense: sessionCierre.expense,
        esperado: sessionCierre.esperado,
        contado: counted,
        diferencia: diferencia
      }
    });
    closeSessionModal();
    renderSession();
    UI.toast(
      'Caja cerrada · ' + (diferencia === 0 ? 'sin diferencias' : 'diferencia ' + UI.formatCurrency(diferencia)),
      diferencia === 0 ? 'success' : 'info'
    );
  }


  function renderKpis(summary) {
    const host = $('#cashKpis');
    if (!host) return;
    host.textContent = '';

    const cards = [
      {
        icon: '💵',
        label: 'Ingresos',
        value: global.AnimeStockUI.formatCurrency(summary.income),
        sub: 'ventas cobradas + ajustes',
        tone: 'ok'
      },
      {
        icon: '💸',
        label: 'Egresos',
        value: global.AnimeStockUI.formatCurrency(summary.expense),
        sub: 'compras + anulaciones',
        tone: summary.expense > 0 ? 'danger' : 'neutral'
      },
      {
        icon: '🏦',
        label: 'Saldo en caja',
        value: global.AnimeStockUI.formatCurrency(summary.balance),
        sub: global.AnimeStockUI.RANGE_LABELS[state.range].toLowerCase()
          + ' · ingresos − egresos',
        tone: summary.balance >= 0 ? 'ok' : 'danger'
      }
    ];

    cards.forEach(function (card, index) {
      const node = global.AnimeStockUI.el('article', {
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


  function buildReceiptLink(movement) {
    if (!movement.saleId) {
      const tag = global.AnimeStockUI.el('span', { className: 'cash-manual-tag' });
      tag.textContent = 'Manual';
      return tag;
    }

    const link = global.AnimeStockUI.el('button', {
      className: 'cash-link',
      attrs: {
        type: 'button',
        'aria-label': 'Ver comprobante ' + movement.receiptNumber
      }
    });
    link.textContent = movement.receiptNumber || 'Ver ticket';

    link.addEventListener('click', async function () {
      try {
        const sale = await Data.fetchSaleById(movement.saleId);
        if (sale) {
          global.AnimeStockReceipt.open(sale, { focusPrint: true });
        } else {
          global.AnimeStockUI.toast('La venta ya no está disponible', 'info');
        }
      } catch (error) {
        console.error('[AnimeStock] No se pudo abrir el comprobante:', error);
        global.AnimeStockUI.toast('No se pudo abrir el comprobante', 'error');
      }
    });

    return link;
  }

  function buildRow(movement) {
    const tr = global.AnimeStockUI.el('tr', {
      attrs: { 'data-movement-id': String(movement.id) }
    });

    const tdDate = global.AnimeStockUI.el('td', { className: 'table__date' });
    tdDate.innerHTML = '<span class="table__date-main"></span>'
      + '<span class="table__date-time"></span>';
    $('.table__date-main', tdDate).textContent =
      global.AnimeStockUI.formatDate(movement.occurredAt);
    $('.table__date-time', tdDate).textContent =
      global.AnimeStockUI.formatTime(movement.occurredAt);
    tr.appendChild(tdDate);

    
    const tdType = global.AnimeStockUI.el('td');
    const isIncome = movement.type === 'INGRESO';
    const chip = global.AnimeStockUI.el('span', {
      className: 'cash-chip cash-chip--' + (isIncome ? 'income' : 'expense')
    });
    chip.textContent = isIncome ? 'Ingreso' : 'Egreso';
    tdType.appendChild(chip);
    tr.appendChild(tdType);

    const tdDesc = global.AnimeStockUI.el('td', { className: 'table__description' });
    tdDesc.textContent = movement.description;
    tr.appendChild(tdDesc);


    const tdReceipt = global.AnimeStockUI.el('td');
    tdReceipt.appendChild(buildReceiptLink(movement));
    tr.appendChild(tdReceipt);


    const tdAmount = global.AnimeStockUI.el('td', {
      className: 'table__num ' + (isIncome ? 'cash-amount--in' : 'cash-amount--out')
    });
    tdAmount.textContent = (isIncome ? '+ ' : '− ')
      + global.AnimeStockUI.formatCurrency(movement.amount);
    tr.appendChild(tdAmount);

    return tr;
  }

  function renderTable(rows) {
    const body = $('#cashRows');
    const empty = $('#cashEmpty');
    const card = $('#cashTableCard');
    if (!body) return;

    body.textContent = '';

    const hasRows = rows.length > 0;
    if (card) card.hidden = !hasRows;
    if (empty) empty.hidden = hasRows;

    rows.forEach(function (movement) { body.appendChild(buildRow(movement)); });

    const info = $('#cashInfo');
    if (info) {
      const count = state.summary.total;
      info.textContent = count === 0
        ? 'Sin movimientos en este período'
        : count + (count === 1 ? ' movimiento' : ' movimientos') + ' · '
          + global.AnimeStockUI.RANGE_LABELS[state.range].toLowerCase();
    }
  }


  function setLoading(isLoading) {
    const status = $('#cashStatus');
    if (status) {
      status.textContent = isLoading ? 'Actualizando caja…' : '';
      status.hidden = !isLoading;
    }
    const panel = $('#panel-caja');
    if (panel) panel.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  async function load() {
    setLoading(true);
    try {
      const result = await Data.fetchCashMovements(state.range, { limit: 100 });

      state.rows = result.content;
      state.summary = {
        income: result.summary.income,
        expense: result.summary.expense,
        balance: result.summary.balance,
        total: result.totalElements
      };

      renderKpis(result.summary);
      renderTable(result.content);
      state.loaded = true;
    } catch (error) {
      console.error('[AnimeStock] No se pudo cargar la caja:', error);
      const status = $('#cashStatus');
      if (status) {
        status.hidden = false;
        status.textContent = 'No se pudo cargar el movimientos de caja.';
      }
      renderTable([]);
    } finally {
      setLoading(false);
    }
  }



  
  async function submitMovement() {
    const typeInput = $('#cashMovementType');
    const amountInput = $('#cashAmount');
    const descriptionInput = $('#cashDescription');
    const dateInput = $('#cashDate');
    const errorBox = $('#cashMovementError');
    const submitBtn = $('#cashSubmit');

    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }

    const type = typeInput ? typeInput.value : 'EGRESO';
    const amount = Math.round(Number(amountInput ? amountInput.value : 0) || 0);
    const description = descriptionInput ? descriptionInput.value.trim() : '';


    if (amount <= 0) {
      if (errorBox) {
        errorBox.textContent = 'El monto tiene que ser mayor a cero.';
        errorBox.hidden = false;
      }
      if (amountInput) amountInput.focus();
      return;
    }

    if (description.length < 3) {
      if (errorBox) {
        errorBox.textContent = 'Escribí una descripción de al menos 3 caracteres.';
        errorBox.hidden = false;
      }
      if (descriptionInput) descriptionInput.focus();
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      const occurredAt = dateInput && dateInput.value
        ? new Date(dateInput.value + 'T12:00:00').toISOString()
        : new Date().toISOString();

      const movement = await Data.createCashMovement({
        type: type,
        amount: amount,
        description: description,
        occurredAt: occurredAt
      });

      closeMovementModal();
      global.AnimeStockUI.toast(
        (movement.type === 'INGRESO' ? 'Ingreso' : 'Egreso')
        + ' de ' + global.AnimeStockUI.formatCurrency(movement.amount) + ' registrado',
        'success'
      );

      load();
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = error.message || 'No se pudo registrar el movimiento';
        errorBox.hidden = false;
      }
      global.AnimeStockUI.toast(error.message || 'No se pudo registrar', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function openMovementModal() {
    const element = $('#cashModal');
    if (!element) return;

    if (!modal) {
      modal = global.AnimeStockUI.createModal(element, { initialFocus: '#cashAmount' });
    }


    const amountInput = $('#cashAmount');
    const descriptionInput = $('#cashDescription');
    const dateInput = $('#cashDate');
    const typeInput = $('#cashMovementType');
    const errorBox = $('#cashMovementError');

    if (amountInput) amountInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (typeInput) typeInput.value = 'EGRESO';
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }

    if (dateInput) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      dateInput.value = y + '-' + m + '-' + d;
      dateInput.max = y + '-' + m + '-' + d;
    }

    global.AnimeStockUI.openModal(modal);
  }

  function closeMovementModal() {
    if (modal) global.AnimeStockUI.closeModal(modal);
  }


  function bindEvents() {
    if (bound) return;
    bound = true;

    const range = $('#cashRangeFilter');
    if (range) {
      range.addEventListener('change', function () {
        state.range = range.value;
        load();
      });
    }

    const newMovement = $('#cashNewMovement');
    if (newMovement) {
      newMovement.addEventListener('click', openMovementModal);
    }

    
    const newSale = $('#cashNewSale');
    if (newSale) {
      newSale.addEventListener('click', function () {
        if (global.AnimeStockCheckout) global.AnimeStockCheckout.open();
      });
    }

    
    const sessionAction = $('#cashSessionAction');
    if (sessionAction) {
      sessionAction.addEventListener('click', function () {
        const session = readSession();
        openSessionModal(session && session.abierta ? 'cerrar' : 'abrir');
      });
    }

    const sessionSubmit = $('#cashSessionSubmit');
    if (sessionSubmit) sessionSubmit.addEventListener('click', submitSession);

    const sessionCancel = $('#cashSessionCancel');
    if (sessionCancel) sessionCancel.addEventListener('click', closeSessionModal);

    const countedInput = $('#cashCloseCounted');
    if (countedInput) {
      countedInput.addEventListener('input', updateCloseDiff);
      countedInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          submitSession();
        }
      });
    }

    const submit = $('#cashSubmit');
    if (submit) submit.addEventListener('click', submitMovement);

    const cancel = $('#cashCancel');
    if (cancel) cancel.addEventListener('click', closeMovementModal);

    ['#cashAmount', '#cashDescription'].forEach(function (selector) {
      const input = $(selector);
      if (input) {
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            submitMovement();
          }
        });
      }
    });

    const panel = $('#panel-caja');
    if (panel) {
      panel.addEventListener('anime:hidden', function () {
        closeMovementModal();
        closeSessionModal();
      });
    }
  }

  function init() {
    bindEvents();
    renderSession();

    const range = $('#cashRangeFilter');
    if (range) range.value = state.range;
  }

  function show() {
    init();
    if (!state.loaded) {
      const status = $('#cashStatus');
      if (status) {
        status.hidden = false;
        status.textContent = 'Cargando caja…';
      }
    }
    load();
  }

  function refresh() {
    init();
    return load();
  }


  global.AnimeStockCash = {
    init: init,
    show: show,
    refresh: refresh,
    openMovementModal: openMovementModal,
    openSessionModal: openSessionModal,
    renderSession: renderSession,
    close: closeMovementModal,
    state: state
  };

  
  if (Data && typeof Data.onDataChange === 'function') {
    Data.onDataChange(function (reason) {
      if (reason === 'sale:created' || reason === 'sale:cancelled'
        || reason === 'sale:updated' || reason === 'cash:created') {
        if (state.loaded) load();
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);