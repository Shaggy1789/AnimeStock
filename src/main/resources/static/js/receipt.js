
(function (global) {
  'use strict';

  const UI = global.AnimeStockUI;
  const Data = global.AnimeStockData;

  
  const STORE = {
    name: 'AnimeStock',
    logo: '🧸',
    address: 'Av. Corrientes 3456, CABA',
    phone: '+54 11 4321-8765',
    email: 'hola@animestock.com.ar'
  };

  
  let current = null;
  let modal = null;

  

  
  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  
  function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      return state / 4294967296;
    };
  }

  const QR_MODULES = 21;          
  const QR_CELL = 4;              
  const QR_QUIET = 2;             

  
  function finderCell(row, col) {
    const boxes = [
      [0, 0],
      [0, QR_MODULES - 7],
      [QR_MODULES - 7, 0]
    ];

    for (let b = 0; b < boxes.length; b++) {
      const r0 = boxes[b][0];
      const c0 = boxes[b][1];
      if (row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7) {
        const dr = row - r0;
        const dc = col - c0;
        const borde = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const centro = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        
        return { inFinder: true, dark: borde || centro };
      }
      
      if (row >= r0 - 1 && row <= r0 + 7 && col >= c0 - 1 && col <= c0 + 7) {
        return { inFinder: true, dark: false };
      }
    }
    return { inFinder: false, dark: false };
  }

  
  function buildQrSvg(seedText) {
    const rand = seededRandom(hashString(String(seedText || '')));
    const lado = QR_MODULES * QR_CELL;
    const full = lado + QR_QUIET * QR_CELL * 2;
    const offset = QR_QUIET * QR_CELL;

    let rects = '';
    let dark = 0;

    for (let row = 0; row < QR_MODULES; row++) {
      for (let col = 0; col < QR_MODULES; col++) {
        const finder = finderCell(row, col);
        const isDark = finder.inFinder ? finder.dark : rand() > 0.52;
        if (!isDark) continue;
        dark++;
        rects += '<rect x="' + (offset + col * QR_CELL) + '" y="'
          + (offset + row * QR_CELL) + '" width="' + QR_CELL + '" height="'
          + QR_CELL + '"/>';
      }
    }

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + full + ' ' + full + '" '
      + 'width="' + full + '" height="' + full + '" role="img" '
      + 'aria-labelledby="qrTitle qrDesc" shape-rendering="crispEdges">'
      + '<title id="qrTitle">Codigo de verificacion</title>'
      + '<desc id="qrDesc">Patron identificatorio del comprobante '
      + seedText + '. Es decorativo, no es un codigo QR legible.</desc>'
      + '<rect width="' + full + '" height="' + full + '" fill="#ffffff"/>'
      + '<g fill="#3d3452">' + rects + '</g>'
      + '</svg>';

    return { svg: svg, dark: dark };
  }



  
  function fill(node, value) {
    if (node) node.textContent = value === undefined || value === null ? '' : String(value);
    return value;
  }

  
  function fullDateTime(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  
  function receiptTemplate(sale) {
    const itemsRows = sale.items.map(function (item) {
      return [
        '<tr>',
        '  <td class="ticket__item-name">',
        '    <span class="ticket__item-name-text"></span>',
        '    <small class="ticket__item-anime"></small>',
        '  </td>',
        '  <td class="ticket__num" data-role="qty"></td>',
        '  <td class="ticket__num" data-role="unit"></td>',
        '  <td class="ticket__num" data-role="subtotal"></td>',
        '</tr>'
      ].join('');
    }).join('');

    return [
      '<article class="ticket" aria-label="Comprobante de venta">',
      '  <header class="ticket__head">',
      '    <p class="ticket__brand">',
      '      <span class="ticket__logo" aria-hidden="true">' + STORE.logo + '</span>',
      '      <span data-role="store-name"></span>',
      '    </p>',
      '    <address class="ticket__contact">',
      '      <span data-role="store-address"></span><br>',
      '      <span data-role="store-phone"></span><br>',
      '      <span data-role="store-email"></span>',
      '    </address>',
      '    <h4 class="ticket__doc-title">Comprobante de venta</h4>',
      '    <p class="ticket__number" data-role="receipt"></p>',
      '    <p class="ticket__issued">Emitido el <span data-role="issued"></span></p>',
      '  </header>',

      '  <section class="ticket__customer" aria-labelledby="receiptCustomerTitle">',
      '    <h5 class="ticket__section-title" id="receiptCustomerTitle">Cliente</h5>',
      '    <dl class="ticket__data">',
      '      <div><dt>Nombre</dt><dd data-role="customer-name"></dd></div>',
      '      <div><dt>Email</dt><dd data-role="customer-email"></dd></div>',
      '      <div><dt>Teléfono</dt><dd data-role="customer-phone"></dd></div>',
      '    </dl>',
      '  </section>',

      '  <table class="ticket__items">',
      '    <caption class="sr-only">Detalle de los productos vendidos</caption>',
      '    <thead>',
      '      <tr>',
      '        <th scope="col">Producto</th>',
      '        <th scope="col" class="ticket__num">Cant.</th>',
      '        <th scope="col" class="ticket__num">P. unit.</th>',
      '        <th scope="col" class="ticket__num">Subtotal</th>',
      '      </tr>',
      '    </thead>',
      '    <tbody>' + itemsRows + '</tbody>',
      '  </table>',

      '  <section class="ticket__totals" aria-label="Totales de la venta">',
      '    <p class="ticket__line"><span>Subtotal</span> <b data-role="subtotal"></b></p>',
      '    <p class="ticket__line ticket__line--discount" data-role="discount-row">',
      '      <span>Descuento</span> <b data-role="discount"></b>',
      '    </p>',
      '    <p class="ticket__total"><span>Total</span> <b data-role="total"></b></p>',
      '  </section>',

      '  <section class="ticket__payment" aria-label="Forma de pago">',
      '    <dl class="ticket__data">',
      '      <div><dt>Método</dt><dd data-role="method"></dd></div>',
      '      <div data-role="reference-row"><dt>Referencia</dt><dd data-role="reference"></dd></div>',
      '      <div data-role="received-row"><dt>Recibido</dt><dd data-role="received"></dd></div>',
      '      <div data-role="change-row"><dt>Cambio</dt><dd data-role="change"></dd></div>',
      '      <div data-role="status-row"><dt>Estado</dt><dd data-role="status"></dd></div>',
      '    </dl>',
      '  </section>',

      '  <p class="ticket__notes" data-role="notes-row">',
      '    <span class="ticket__notes-label">Notas:</span> ',
      '    <span data-role="notes"></span>',
      '  </p>',

      '  <footer class="ticket__foot">',
      '    <p class="ticket__thanks">¡Gracias por tu compra! ' + STORE.logo + '</p>',
      '    <div class="ticket__qr" data-role="qr"></div>',
      '    <p class="ticket__qr-code" data-role="qr-code"></p>',
      '    <p class="ticket__legal">Este documento no es válido como factura fiscal.</p>',
      '  </footer>',
      '</article>'
    ].join('\n');
  }

  
  function buildReceiptHtml(sale) {
    if (!sale) return '';

    const mount = document.createElement('div');
    mount.innerHTML = receiptTemplate(sale);

    const role = function (name) { return mount.querySelector('[data-role="' + name + '"]'); };
    const money = UI.formatCurrency;

    
    fill(role('store-name'), STORE.name);
    fill(role('store-address'), STORE.address);
    fill(role('store-phone'), 'Tel. ' + STORE.phone);
    fill(role('store-email'), STORE.email);
    fill(role('receipt'), sale.receiptNumber);
    fill(role('issued'), fullDateTime(sale.soldAt));

    
    fill(role('customer-name'), sale.customer.name);
    fill(role('customer-email'), sale.customer.email || '—');
    fill(role('customer-phone'), sale.customer.phone || '—');

    
    const rows = UI.$$('tbody tr', mount);
    sale.items.forEach(function (item, index) {
      const row = rows[index];
      if (!row) return;
      fill(row.querySelector('[data-role="qty"]'), item.quantity);
      fill(row.querySelector('[data-role="unit"]'), money(item.unitPrice));
      fill(row.querySelector('[data-role="subtotal"]'), money(item.subtotal));
      fill(row.querySelector('.ticket__item-name-text'), item.name);
      fill(row.querySelector('.ticket__item-anime'), item.anime);
    });

    
    fill(role('subtotal'), money(sale.subtotal));
    fill(role('discount'), '- ' + money(sale.discount));
    fill(role('total'), money(sale.total));

    
    const discountRow = role('discount-row');
    if (!sale.discount) discountRow.hidden = true;

    
    fill(role('method'), UI.paymentLabel(sale.paymentMethod) + ' '
      + UI.paymentIcon(sale.paymentMethod));

    const referenceRow = role('reference-row');
    if (sale.reference) fill(role('reference'), sale.reference);
    else referenceRow.hidden = true;

    const isCash = sale.paymentMethod === 'EFECTIVO';
    if (!isCash) {
      role('received-row').hidden = true;
      role('change-row').hidden = true;
    } else {
      fill(role('received'), money(sale.amountReceived));
      fill(role('change'), money(sale.change));
    }

    fill(role('status'), UI.statusLabel(sale.status));

    
    if (sale.notes) fill(role('notes'), sale.notes);
    else role('notes-row').hidden = true;

    
    const qr = buildQrSvg(sale.receiptNumber);
    role('qr').innerHTML = qr.svg;   
    fill(role('qr-code'), sale.receiptNumber);

    return mount.innerHTML;
  }



  let format = 'ticket';        

  
  function render(sale) {
    const mount = document.getElementById('receipt-mount');
    if (!mount) return;

    mount.innerHTML = buildReceiptHtml(sale);
    mount.classList.toggle('is-a4', format === 'a4');

    
    
    const title = document.getElementById('receiptModalTitle');
    if (title) {
      title.textContent = 'Comprobante ' + sale.receiptNumber;
    }
    const subtitle = document.getElementById('receiptModalSubtitle');
    if (subtitle) {
      subtitle.textContent = sale.customer.name + ' · '
        + UI.formatDateTime(sale.soldAt);
    }
  }

  
  function setFormat(next) {
    format = next === 'a4' ? 'a4' : 'ticket';
    if (current) render(current);

    
    
    document.body.classList.toggle('receipt-format-a4', format === 'a4');

    UI.$$('[data-receipt-format]').forEach(function (button) {
      const active = button.dataset.receiptFormat === format;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  
  function open(sale, options) {
    const opts = options || {};
    const element = document.getElementById('receiptModal');
    if (!element || !sale) return;

    current = sale;
    render(sale);
    setFormat(format);

    if (!modal) modal = UI.createModal(element, { initialFocus: '[data-modal-close]' });
    UI.openModal(modal);

    if (opts.focusPrint) {
      window.setTimeout(function () {
        const printBtn = document.querySelector('#receiptModal [data-receipt-print]');
        if (printBtn) printBtn.focus();
      }, 120);
    }
  }

  function close() {
    if (modal) UI.closeModal(modal);
  }

  
  function print() {
    if (!current) return;
    window.setTimeout(function () { window.print(); }, 60);
  }

  
  function downloadHtml() {
    if (!current) return;

    const css = receiptPrintStyles();
    const html = [
      '<!DOCTYPE html>',
      '<html lang="es">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <title>Comprobante ' + current.receiptNumber + '</title>',
      '  <style>' + css + '</style>',
      '</head>',
      '<body class="is-download">',
      '  <div class="receipt-mount">' + buildReceiptHtml(current) + '</div>',
      '</body>',
      '</html>'
    ].join('\n');

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    
    const filename = 'comprobante-' + current.receiptNumber.toLowerCase() + '.html';
    UI.downloadBlob(blob, filename);
    UI.toast('Comprobante descargado: ' + filename, 'success');
  }

  
  function receiptPrintStyles() {
    const width = format === 'a4' ? '190mm' : '72mm';
    return [
      'body.is-download{margin:0;padding:8mm;background:#f7eef8;',
      '  font-family:"Courier New",Courier,monospace;color:#3d3452;}',
      '.receipt-mount{display:flex;justify-content:center;}',
      '.ticket{width:' + width + ';max-width:100%;background:#fff;color:#3d3452;',
      '  padding:4mm;border:1px solid #ece2f3;font:12px/1.45 "Courier New",Courier,monospace;}',
      '.ticket__brand{font-weight:bold;font-size:14px;margin:0 0 2mm;}',
      '.ticket__contact{font-style:normal;font-size:10px;color:#6b5f80;margin:0 0 3mm;}',
      '.ticket__doc-title{font-size:11px;margin:0;letter-spacing:.08em;',
      '  text-transform:uppercase;color:#8a7fa0;}',
      '.ticket__number{font-size:20px;font-weight:bold;margin:1mm 0 0;}',
      '.ticket__issued{font-size:10px;margin:0 0 3mm;color:#6b5f80;}',
      '.ticket__section-title{font-size:10px;text-transform:uppercase;letter-spacing:.08em;',
      '  margin:3mm 0 1mm;color:#8a7fa0;}',
      '.ticket__data{margin:0 0 2mm;}',
      '.ticket__data>div{display:flex;justify-content:space-between;gap:2mm;',
      '  font-size:11px;}',
      '.ticket__data dt{color:#8a7fa0;}',
      '.ticket__data dd{margin:0;text-align:right;word-break:break-word;}',
      '.ticket__items{width:100%;border-collapse:collapse;font-size:11px;margin:2mm 0;}',
      '.ticket__items th{border-bottom:1px dashed #ece2f3;padding:1mm 0;',
      '  font-size:9px;text-transform:uppercase;color:#8a7fa0;text-align:left;}',
      '.ticket__items td{border-bottom:1px dotted #f3ebf7;padding:1.4mm 0;',
      '  vertical-align:top;break-inside:avoid;}',
      '.ticket__num{text-align:right;white-space:nowrap;}',
      '.ticket__item-name small{display:block;font-size:9px;color:#8a7fa0;}',
      '.ticket__totals{margin-top:2mm;}',
      '.ticket__line{display:flex;justify-content:space-between;font-size:11px;margin:.6mm 0;}',
      '.ticket__total{display:flex;justify-content:space-between;font-size:14px;',
      '  font-weight:bold;border-top:1px solid #3d3452;padding-top:1.5mm;margin-top:1.5mm;}',
      '.ticket__notes{font-size:10px;color:#6b5f80;margin:2mm 0 0;}',
      '.ticket__foot{text-align:center;margin-top:3mm;border-top:1px dashed #ece2f3;',
      '  padding-top:2mm;}',
      '.ticket__thanks{font-size:11px;margin:0 0 2mm;}',
      '.ticket__qr{display:flex;justify-content:center;}',
      '.ticket__qr-code{font-size:9px;letter-spacing:.12em;color:#8a7fa0;margin:1mm 0;}',
      '.ticket__legal{font-size:9px;color:#8a7fa0;margin:0;}',
      '@media print{body.is-download{padding:0;background:#fff;}}'
    ].join('');
  }

  
  function sendByEmail() {
    if (!current) return;
    UI.toast(
      'Envío por email próximamente · comprobante ' + current.receiptNumber,
      'info'
    );
  }

  
  function init() {
    const element = document.getElementById('receiptModal');
    if (!element) return;

    modal = UI.createModal(element, { initialFocus: '[data-modal-close]' });

    const printBtn = element.querySelector('[data-receipt-print]');
    if (printBtn) printBtn.addEventListener('click', print);

    const downloadBtn = element.querySelector('[data-receipt-download]');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadHtml);

    const emailBtn = element.querySelector('[data-receipt-email]');
    if (emailBtn) emailBtn.addEventListener('click', sendByEmail);

    UI.$$('[data-receipt-format]', element).forEach(function (button) {
      button.addEventListener('click', function () {
        setFormat(button.dataset.receiptFormat);
      });
    });

    setFormat(format);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  
  global.AnimeStockReceipt = {
    open: open,
    close: close,
    print: print,
    downloadHtml: downloadHtml,
    sendByEmail: sendByEmail,
    render: render,
    setFormat: setFormat,
    buildReceiptHtml: buildReceiptHtml,
    buildQrSvg: buildQrSvg,
    getCurrent: function () { return current; },
    STORE: STORE
  };

})(typeof window !== 'undefined' ? window : globalThis);