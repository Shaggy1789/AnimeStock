
(function (global) {
  'use strict';

  

  
  const nfInt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  const nfDec = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  
  function formatCurrency(value) {
    return '$' + nfInt.format(Math.round(Number(value) || 0));
  }

  
  function formatCurrencyDec(value) {
    return '$' + nfDec.format(Number(value) || 0);
  }

  
  function formatDate(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  
  function formatTime(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  
  function formatDateTime(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return formatDate(iso) + ' · ' + formatTime(iso);
  }

  
  const STATUS_LABELS = {
    PAGADO: 'Pagado',
    PENDIENTE: 'Pendiente',
    ENVIADO: 'Enviado',
    ANULADO: 'Anulado'
  };

  const PAYMENT_LABELS = {
    EFECTIVO: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
    MERCADOPAGO: 'MercadoPago',
    PAYPAL: 'PayPal',
    OTRO: 'Otro'
  };

  const PAYMENT_ICONS = {
    EFECTIVO: '💵',
    TRANSFERENCIA: '🏦',
    MERCADOPAGO: '💳',
    PAYPAL: '🅿️',
    OTRO: '📝'
  };

  const RANGE_LABELS = {
    hoy: 'Hoy',
    '7d': 'Últimos 7 días',
    mes: 'Este mes',
    anio: 'Este año',
    todo: 'Todo'
  };

  
  function statusLabel(status) {
    return STATUS_LABELS[String(status || '').toUpperCase()] || String(status || '');
  }

  
  function paymentLabel(method) {
    return PAYMENT_LABELS[String(method || '').toUpperCase()] || String(method || '');
  }

  
  function paymentIcon(method) {
    return PAYMENT_ICONS[String(method || '').toUpperCase()] || '📝';
  }

  
  const TOAST_MAX = 3;
  const TOAST_MS = 3500;

  function toastHost() {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.className = 'toasts';
      host.setAttribute('role', 'region');
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-label', 'Notificaciones');
      document.body.appendChild(host);
    }
    return host;
  }

  
  function toast(message, type) {
    const kind = type || 'info';
    const host = toastHost();

    
    while (host.children.length >= TOAST_MAX) host.removeChild(host.firstChild);

    const item = document.createElement('div');
    item.className = 'toast toast--' + kind;
    const icon = kind === 'success' ? '✅' : (kind === 'error' ? '⚠️' : 'ℹ️');
    item.innerHTML =
      '<span class="toast__icon" aria-hidden="true"></span>' +
      '<p class="toast__text"></p>';
    item.querySelector('.toast__icon').textContent = icon;
    item.querySelector('.toast__text').textContent = message;
    host.appendChild(item);

    window.setTimeout(function () {
      item.classList.add('is-leaving');
      window.setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 220);
    }, TOAST_MS);

    return item;
  }


  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) =>
    Array.prototype.slice.call((scope || document).querySelectorAll(selector));

  
  function el(tag, options) {
    const opts = options || {};
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined && opts.text !== null) node.textContent = String(opts.text);
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (name) {
        node.setAttribute(name, opts.attrs[name]);
      });
    }
    return node;
  }

  
  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(self, args); }, wait || 250);
    };
  }

  
  function csvCell(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  /* -------------------------------------------------------------------------
   * Foco atrapado + pila de modales
   * ------------------------------------------------------------------------- */
  const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const openModals = [];

  /** Presenta un modal: foco adentro, scroll bloqueado y devolucion del foco. */
  function openModal(modal) {
    if (modal.isOpen) return;

    modal.isOpen = true;
    modal.lastFocused = document.activeElement;
    openModals.push(modal);

    modal.el.hidden = false;
    // Reflow forzado para que la animacion de entrada se dispare siempre.
    void modal.el.offsetWidth;
    modal.el.classList.add('is-open');
    document.body.classList.add('is-modal-open');

    const target = (modal.opts.initialFocus
      ? $(modal.opts.initialFocus, modal.el)
      : null) || $$(FOCUSABLE, modal.el)[0] || modal.el;
    if (target) window.setTimeout(function () { target.focus(); }, 60);
  }

  /** Cierra un modal y devuelve el foco al elemento que lo abrio. */
  function closeModal(modal) {
    if (!modal.isOpen) return;

    modal.isOpen = false;
    const index = openModals.indexOf(modal);
    if (index !== -1) openModals.splice(index, 1);

    modal.el.classList.remove('is-open');

    // El scroll de fondo se bloquea solo mientras quede AL MENOS un modal
    // abierto. Sin esta comprobacion, cerrar el checkout justo antes de abrir
    // el comprobante dejaba la pagina scrolleable por detras del ticket.
    if (openModals.length === 0) {
      document.body.classList.remove('is-modal-open');
    }

    if (typeof modal.opts.onClose === 'function') modal.opts.onClose();
    window.setTimeout(function () { modal.el.hidden = true; }, 180);

    if (modal.lastFocused && typeof modal.lastFocused.focus === 'function') {
      modal.lastFocused.focus();
    }
  }

  /**
   * createModal(element, options)
   *   options.initialFocus : selector CSS del control que recibe el foco
   *   options.onClose      : callback al cerrar
   * Ya cablea el boton [data-modal-close] y el click en el overlay.
   */
  function createModal(element, options) {
    const opts = options || {};
    const modal = { el: element, opts: opts, isOpen: false, lastFocused: null };

    $$('[data-modal-close]', element).forEach(function (button) {
      button.addEventListener('click', function () { closeModal(modal); });
    });

    // Click en el overlay (pero no dentro de la caja del dialogo).
    element.addEventListener('mousedown', function (event) {
      if (event.target === element) closeModal(modal);
    });

    // Tab circulando dentro del dialogo.
    element.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      const focusables = $$(FOCUSABLE, element).filter(function (node) {
        return node.offsetParent !== null;
      });
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    return modal;
  }

  // ESC cierra el modal de arriba. Un solo listener para toda la app.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (!openModals.length) return;
    closeModal(openModals[openModals.length - 1]);
  });

  /* -------------------------------------------------------------------------
   * Confirmacion (reemplaza a window.confirm, que es feo e inescapable)
   * -------------------------------------------------------------------------
   * confirmDialog({ title, message, confirmText, danger }) -> Promise<boolean>
   * ------------------------------------------------------------------------- */
  function confirmDialog(options) {
    const opts = options || {};

    return new Promise(function (resolve) {
      const overlay = el('div', { className: 'modal-overlay' });
      overlay.innerHTML =
        '<div class="modal modal--sm" role="dialog" aria-modal="true" ' +
        '     aria-labelledby="confirmDialogTitle" aria-describedby="confirmDialogText">' +
        '  <div class="modal__head">' +
        '    <h3 class="modal__title" id="confirmDialogTitle"></h3>' +
        '    <button class="icon-btn" type="button" data-modal-close ' +
        '            aria-label="Cerrar"><span aria-hidden="true">✕</span></button>' +
        '  </div>' +
        '  <div class="modal__body">' +
        '    <p class="modal__text" id="confirmDialogText"></p>' +
        '  </div>' +
        '  <div class="modal__foot modal__foot--end">' +
        '    <button class="btn btn--ghost" type="button" data-modal-close></button>' +
        '    <button class="btn" type="button" data-confirm></button>' +
        '  </div>' +
        '</div>';

      $('#confirmDialogTitle', overlay).textContent = opts.title || 'Confirmar';
      $('#confirmDialogText', overlay).textContent = opts.message || '';
      const cancelBtn = $('[data-modal-close].btn', overlay);
      cancelBtn.textContent = opts.cancelText || 'Cancelar';
      const confirmBtn = $('[data-confirm]', overlay);
      confirmBtn.textContent = opts.confirmText || 'Confirmar';
      confirmBtn.className = 'btn ' + (opts.danger === false ? 'btn--primary' : 'btn--danger');

      document.body.appendChild(overlay);
      const modal = createModal(overlay, {
        initialFocus: '[data-confirm]',
        onClose: function () {
          window.setTimeout(function () {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          }, 200);
        }
      });

      confirmBtn.addEventListener('click', function () {
        closeModal(modal);
        resolve(true);
      });
      // Cualquier otra salida (ESC, overlay, ✕) resuelve false.
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) resolve(false);
      });
      $$('[data-modal-close]', overlay).forEach(function (node) {
        node.addEventListener('click', function () { resolve(false); });
      });

      openModal(modal);
    });
  }

  /** Reutiliza los chips/badges que ya estan definidos en dashboard.js. */
  function createPaymentChip(method) {
    const key = String(method || 'OTRO').toLowerCase();
    const chip = el('span', { className: 'pay pay--' + key });
    chip.textContent = paymentLabel(method);
    return chip;
  }

  function createStatusBadge(status) {
    const key = String(status || 'PENDIENTE').toLowerCase();
    const badge = el('span', {
      className: 'badge badge--' + key + ' status-badge status-badge--' + key
    });
    const dot = el('span', { className: 'badge__dot', attrs: { 'aria-hidden': 'true' } });
    badge.append(dot, document.createTextNode(statusLabel(status)));
    return badge;
  }

  /**
   * Dibuja el grid de mini-KPIs que comparten Ventas, Caja, Pedidos,
   * Proveedores y Configuración. Cada card: { icon, label, value, sub, tone }
   * con tone ∈ 'ok' | 'warn' | 'bad' | 'neutral' (colorea el borde/ícono).
   */
  function renderMiniKpis(host, cards) {
    if (!host) return;
    host.textContent = '';
    (cards || []).forEach(function (card, index) {
      const node = el('article', {
        className: 'mini-kpi mini-kpi--' + (card.tone || 'neutral'),
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
      $('.mini-kpi__icon', node).textContent = card.icon || '';
      $('.mini-kpi__label', node).textContent = card.label || '';
      $('.mini-kpi__value', node).textContent = card.value || '';
      $('.mini-kpi__sub', node).textContent = card.sub || '';
      host.appendChild(node);
    });
  }

  /** Descarga un Blob con nombre de archivo (sirve para CSV y comprobante). */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = el('a', { attrs: { href: url, download: filename } });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Se libera en el siguiente tick: si se revoca antes, Chrome cancela.
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* =========================================================================
   * API pública
   * ========================================================================= */
  global.AnimeStockUI = {
    // formateadores (los usan todos los paneles)
    formatCurrency: formatCurrency,
    formatCurrencyDec: formatCurrencyDec,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    statusLabel: statusLabel,
    paymentLabel: paymentLabel,
    paymentIcon: paymentIcon,
    RANGE_LABELS: RANGE_LABELS,

    // UI
    toast: toast,
    confirm: confirmDialog,
    createModal: createModal,
    openModal: openModal,
    closeModal: closeModal,

    // utilidades
    $: $,
    $$: $$,
    el: el,
    debounce: debounce,
    csvCell: csvCell,
    downloadBlob: downloadBlob,
    renderMiniKpis: renderMiniKpis,
    createPaymentChip: createPaymentChip,
    createStatusBadge: createStatusBadge
  };

})(typeof window !== 'undefined' ? window : globalThis);
