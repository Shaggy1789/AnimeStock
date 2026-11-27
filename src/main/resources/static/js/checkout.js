
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;

  
  const $ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };
  const $$ = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };

  
  const USER = {
    name: 'Byron Chávez',
    role: 'vendedor-senior',
    canEditPrice: true
  };

  const NOTES_MAX = 200;

  
  const session = {
    mode: 'create',          
    saleId: null,            
    cart: [],                
                             
    customerId: null,        
    customer: null,          
    paymentMethod: 'EFECTIVO',
    status: 'PAGADO',
    reference: '',
    notes: '',
    amountReceived: '',
    discountMode: 'percent', 
    discountValue: '',

    
    productQuery: '',
    productResults: [],
    productIndex: -1,
    productOpen: false,

    
    customerQuery: '',
    customerResults: [],
    customerOpen: false,

    newCustomerFormOpen: false,
    submitted: false         
  };

  let modal = null;

  

  function lineFor(productId) {
    for (let i = 0; i < session.cart.length; i++) {
      if (session.cart[i].productId === productId) return session.cart[i];
    }
    return null;
  }

  
  function addToCart(product) {
    const existing = lineFor(product.id);
    const maxStock = Number(product.stock) || 0;
    if (maxStock <= 0) {
      UI_ERROR('No hay stock de ' + product.name);
      return false;
    }

    if (existing) {
      if (existing.quantity >= maxStock) {
        UI_ERROR('Stock máximo alcanzado de ' + product.name);
        shakeLine(existing.productId);
        return false;
      }
      existing.quantity += 1;
      return true;
    }

    session.cart.push({
      productId: product.id,
      name: product.name,
      anime: product.anime,
      imageUrl: product.imageUrl,
      quantity: 1,
      unitPrice: Number(product.price) || 0,
      maxStock: maxStock
    });
    return true;
  }

  
  function setQuantity(productId, quantity) {
    const line = lineFor(productId);
    if (!line) return false;

    const next = Math.floor(Number(quantity) || 0);
    if (next < 1) {
      removeLine(productId);
      return true;
    }
    if (next > line.maxStock) {
      shakeLine(productId);
      return false;
    }
    line.quantity = next;
    return true;
  }

  function removeLine(productId) {
    for (let i = 0; i < session.cart.length; i++) {
      if (session.cart[i].productId === productId) {
        session.cart.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  
  function setUnitPrice(productId, price) {
    if (!USER.canEditPrice) return false;
    const line = lineFor(productId);
    if (!line) return false;

    const next = Math.round(Number(price) || 0);
    if (next <= 0) return false;
    line.unitPrice = next;
    return true;
  }

  
  function availableFor(product) {
    const line = lineFor(product.id);
    const inCart = line ? line.quantity : 0;
    return (Number(product.stock) || 0) - inCart;
  }

  
  function totals() {
    const subtotal = session.cart.reduce(function (acc, line) {
      return acc + line.unitPrice * line.quantity;
    }, 0);

    let discount = 0;
    if (session.discountMode === 'percent') {
      discount = Math.round(subtotal * (Number(session.discountValue) || 0) / 100);
    } else if (session.discountMode === 'fixed') {
      discount = Math.round(Number(session.discountValue) || 0);
    }
    discount = Math.min(Math.max(discount, 0), subtotal);

    const total = Math.max(0, subtotal - discount);
    const itemCount = session.cart.reduce(function (acc, line) {
      return acc + line.quantity;
    }, 0);

    let received = 0;
    let change = 0;
    if (session.paymentMethod === 'EFECTIVO') {
      received = Math.round(Number(session.amountReceived) || 0);
      change = Math.max(0, received - total);
    }

    return {
      itemCount: itemCount,
      lineCount: session.cart.length,
      subtotal: subtotal,
      discount: discount,
      total: total,
      received: received,
      change: change
    };
  }



  
  function UI_ERROR(message) {
    const box = $('#checkoutCartError');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    global.AnimeStockUI.toast(message, 'error');
  }

  function clearCartError() {
    const box = $('#checkoutCartError');
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  
  function shakeLine(productId) {
    const node = document.querySelector('#checkoutCart [data-line="' + productId + '"]');
    if (!node) return;
    node.classList.remove('is-shaking');
    void node.offsetWidth;                 
    node.classList.add('is-shaking');
    window.setTimeout(function () {
      node.classList.remove('is-shaking');
    }, 320);
  }

  
  function productThumb(imageUrl, name, className) {
    const wrap = global.AnimeStockUI.el('span', {
      className: className || 'cart-line__thumb',
      attrs: { 'aria-hidden': 'true' }
    });
    const img = global.AnimeStockUI.el('img', {
      attrs: { src: imageUrl || '', alt: '', loading: 'lazy', decoding: 'async' }
    });
    
    img.addEventListener('error', function () {
      img.remove();
      const fallback = global.AnimeStockUI.el('span', { className: 'cart-line__thumb-text' });
      fallback.textContent = name.slice(0, 2).toUpperCase();
      wrap.appendChild(fallback);
    });
    wrap.appendChild(img);
    return wrap;
  }

  function buildCartLine(line) {
    const node = global.AnimeStockUI.el('div', {
      className: 'cart-line',
      attrs: { 'data-line': String(line.productId) }
    });

    node.appendChild(productThumb(line.imageUrl, line.name));

    
    const info = global.AnimeStockUI.el('div', { className: 'cart-line__info' });
    const name = global.AnimeStockUI.el('p', { className: 'cart-line__name', text: line.name });
    const anime = global.AnimeStockUI.el('p', { className: 'cart-line__anime', text: line.anime });

    
    let priceNode;
    if (USER.canEditPrice) {
      priceNode = global.AnimeStockUI.el('input', {
        className: 'cart-line__price',
        attrs: {
          type: 'number',
          min: '1',
          step: '1',
          inputmode: 'numeric',
          'aria-label': 'Precio unitario de ' + line.name
        }
      });
      priceNode.value = String(line.unitPrice);
      priceNode.addEventListener('change', function () {
        if (setUnitPrice(line.productId, priceNode.value)) {
          renderCart();
        } else {
          priceNode.value = String(line.unitPrice);
          UI_ERROR('El precio tiene que ser mayor a cero');
        }
      });
    } else {
      priceNode = global.AnimeStockUI.el('p', {
        className: 'cart-line__price cart-line__price--static',
        text: global.AnimeStockUI.formatCurrency(line.unitPrice)
      });
    }

    const stock = global.AnimeStockUI.el('span', { className: 'cart-line__stock' });
    stock.textContent = 'Stock ' + line.maxStock;

    info.append(name, anime, priceNode, stock);
    node.appendChild(info);

    
    const qty = global.AnimeStockUI.el('div', { className: 'qty' });

    const minus = global.AnimeStockUI.el('button', {
      className: 'qty__btn',
      text: '−',
      attrs: { type: 'button', 'aria-label': 'Quitar una unidad de ' + line.name }
    });
    minus.addEventListener('click', function () {
      clearCartError();
      setQuantity(line.productId, line.quantity - 1);
      renderCart();
    });

    const input = global.AnimeStockUI.el('input', {
      className: 'qty__input',
      attrs: {
        type: 'number',
        min: '1',
        max: String(line.maxStock),
        step: '1',
        inputmode: 'numeric',
        value: String(line.quantity),
        'aria-label': 'Cantidad de ' + line.name
      }
    });
    input.value = String(line.quantity);
    input.addEventListener('change', function () {
      clearCartError();
      if (setQuantity(line.productId, input.value)) renderCart();
      else input.value = String(line.quantity);
    });

    const plus = global.AnimeStockUI.el('button', {
      className: 'qty__btn',
      text: '+',
      attrs: { type: 'button', 'aria-label': 'Agregar una unidad de ' + line.name }
    });
    plus.addEventListener('click', function () {
      clearCartError();
      if (setQuantity(line.productId, line.quantity + 1)) renderCart();
    });

    
    minus.disabled = line.quantity <= 1;
    plus.disabled = line.quantity >= line.maxStock;

    qty.append(minus, input, plus);
    node.appendChild(qty);

    
    const subtotal = global.AnimeStockUI.el('p', { className: 'cart-line__subtotal' });
    subtotal.textContent = global.AnimeStockUI.formatCurrency(
      line.unitPrice * line.quantity
    );
    node.appendChild(subtotal);

    
    const remove = global.AnimeStockUI.el('button', {
      className: 'cart-line__remove',
      text: '✕',
      attrs: { type: 'button', 'aria-label': 'Quitar ' + line.name + ' del carrito' }
    });
    remove.addEventListener('click', function () {
      clearCartError();
      removeLine(line.productId);
      renderCart();
    });
    node.appendChild(remove);

    return node;
  }

  function renderCart() {
    const host = $('#checkoutCart');
    const empty = $('#checkoutCartEmpty');
    if (!host) return;

    host.textContent = '';

    const hasItems = session.cart.length > 0;
    if (empty) empty.hidden = hasItems;
    host.hidden = !hasItems;

    session.cart.forEach(function (line) {
      host.appendChild(buildCartLine(line));
    });

    renderTotals();
  }



  function setProductResultsOpen(isOpen) {
    session.productOpen = isOpen;
    const box = $('#checkoutProductResults');
    if (box) box.hidden = !isOpen;
  }

  function buildProductResult(product) {
    const available = availableFor(product);
    const disabled = available <= 0;

    const item = global.AnimeStockUI.el('button', {
      className: 'drop-item' + (disabled ? ' is-disabled' : ''),
      attrs: {
        type: 'button',
        role: 'option',
        'aria-selected': 'false',
        'data-product-id': String(product.id),
        'data-available': String(available),
        'aria-disabled': disabled ? 'true' : 'false'
      }
    });

    item.appendChild(productThumb(product.imageUrl, product.name, 'drop-item__thumb'));

    const info = global.AnimeStockUI.el('span', { className: 'drop-item__info' });
    info.appendChild(global.AnimeStockUI.el('span', {
      className: 'drop-item__name', text: product.name
    }));
    info.appendChild(global.AnimeStockUI.el('span', {
      className: 'drop-item__anime', text: product.anime
    }));
    item.appendChild(info);

    const meta = global.AnimeStockUI.el('span', { className: 'drop-item__meta' });
    meta.appendChild(global.AnimeStockUI.el('span', {
      className: 'drop-item__price',
      text: global.AnimeStockUI.formatCurrency(product.price)
    }));

    const stockTag = global.AnimeStockUI.el('span', {
      className: 'drop-item__stock' + (available <= 0 ? ' is-out' : (available < 3 ? ' is-low' : ''))
    });
    stockTag.textContent = available <= 0
      ? 'Sin stock'
      : (available < 3 ? 'Quedan ' + available : 'Stock ' + available);
    meta.appendChild(stockTag);
    item.appendChild(meta);

    if (!disabled) {
      item.addEventListener('click', function () {
        if (addToCart(product)) {
          renderCart();
          global.AnimeStockUI.toast(product.name + ' agregado al carrito', 'success');
        }
        setProductResultsOpen(false);
      });
    }

    return item;
  }

  function renderProductResults() {
    const box = $('#checkoutProductResults');
    if (!box) return;

    box.textContent = '';
    session.productResults.forEach(function (product) {
      box.appendChild(buildProductResult(product));
    });
    highlightProductIndex();
    setProductResultsOpen(session.productResults.length > 0);
  }

  
  function highlightProductIndex() {
    const box = $('#checkoutProductResults');
    if (!box) return;
    $$('.drop-item', box).forEach(function (node, index) {
      const active = index === session.productIndex;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  async function searchProducts(query) {
    session.productQuery = query;
    const result = await Data.fetchProducts(query, { limit: 8 });
    session.productResults = result.content;
    session.productIndex = -1;
    renderProductResults();
  }

  
  function moveProductIndex(step) {
    const count = session.productResults.length;
    if (!count) return;

    let next = session.productIndex + step;
    if (next < 0) next = count - 1;
    if (next >= count) next = 0;

    
    let attempts = 0;
    while (attempts < count) {
      const product = session.productResults[next];
      if (availableFor(product) > 0) break;
      next = (next + step + count) % count;
      attempts++;
    }

    session.productIndex = next;
    highlightProductIndex();
    const active = $('#checkoutProductResults .drop-item.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  
  function pickHighlightedProduct() {
    const product = session.productResults[session.productIndex];
    if (!product) return false;
    if (availableFor(product) <= 0) {
      UI_ERROR(product.name + ' no tiene stock disponible');
      return false;
    }
    if (addToCart(product)) renderCart();
    setProductResultsOpen(false);
    return true;
  }

  

  function setCustomerResultsOpen(isOpen) {
    session.customerOpen = isOpen;
    const box = $('#checkoutCustomerResults');
    if (box) box.hidden = !isOpen;
  }

  function buildCustomerOption(customer, isDefault) {
    const option = global.AnimeStockUI.el('button', {
      className: 'drop-item',
      attrs: {
        type: 'button',
        role: 'option',
        'aria-selected': 'false',
        'data-customer-id': customer.id === null ? '' : String(customer.id)
      }
    });

    const avatar = global.AnimeStockUI.el('span', {
      className: 'drop-item__avatar', text: customer.initials, attrs: { 'aria-hidden': 'true' }
    });
    option.appendChild(avatar);

    const info = global.AnimeStockUI.el('span', { className: 'drop-item__info' });
    info.appendChild(global.AnimeStockUI.el('span', {
      className: 'drop-item__name', text: customer.name
    }));
    const mail = isDefault ? 'Sin datos de contacto' : (customer.email || '—');
    info.appendChild(global.AnimeStockUI.el('span', {
      className: 'drop-item__anime', text: mail
    }));
    option.appendChild(info);

    option.addEventListener('click', function () {
      selectCustomer(customer);
      setCustomerResultsOpen(false);
    });

    return option;
  }

  function renderCustomerResults() {
    const box = $('#checkoutCustomerResults');
    if (!box) return;

    box.textContent = '';

    
    box.appendChild(buildCustomerOption({
      id: null, name: 'Consumidor final', email: '', initials: 'CF'
    }, true));

    session.customerResults.forEach(function (customer) {
      box.appendChild(buildCustomerOption(customer, false));
    });

    setCustomerResultsOpen(true);
  }

  async function searchCustomers(query) {
    session.customerQuery = query;
    const result = await Data.fetchCustomers(query);
    session.customerResults = result.content.slice(0, 6);
    renderCustomerResults();
  }

  
  function selectCustomer(customer) {
    if (!customer || customer.id === null || customer.id === undefined) {
      session.customerId = null;
      session.customer = null;
    } else {
      session.customerId = customer.id;
      session.customer = {
        id: customer.id,
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        initials: customer.initials || global.AnimeStockData.helpers.initialsOf(customer.name)
      };
    }
    renderCustomerChip();
  }

  
  function renderCustomerChip() {
    const host = $('#checkoutCustomerSelected');
    const search = $('#checkoutCustomerSearch');
    if (!host) return;

    host.textContent = '';

    if (session.customer) {
      const avatar = global.AnimeStockUI.el('span', {
        className: 'checkout-customer__avatar', text: session.customer.initials,
        attrs: { 'aria-hidden': 'true' }
      });
      const info = global.AnimeStockUI.el('span', { className: 'checkout-customer__info' });
      info.appendChild(global.AnimeStockUI.el('strong', { text: session.customer.name }));
      const mail = global.AnimeStockUI.el('small', {
        text: session.customer.email || session.customer.phone || ''
      });
      info.appendChild(mail);

      const change = global.AnimeStockUI.el('button', {
        className: 'btn btn--ghost btn--sm',
        text: 'Cambiar',
        attrs: { type: 'button' }
      });
      change.addEventListener('click', function () {
        selectCustomer(null);
        if (search) {
          search.value = '';
          search.focus();
        }
      });

      host.append(avatar, info, change);
      host.hidden = false;
      if (search) search.placeholder = 'Buscar otro cliente…';
      return;
    }

    host.hidden = true;
    if (search) {
      search.value = '';
      search.placeholder = 'Buscar por nombre o email…';
    }
  }


  const PAYMENT_OPTIONS = [
    { value: 'EFECTIVO', icon: '💵', label: 'Efectivo' },
    { value: 'TRANSFERENCIA', icon: '🏦', label: 'Transferencia' },
    { value: 'MERCADOPAGO', icon: '💳', label: 'MercadoPago' },
    { value: 'PAYPAL', icon: '🅿️', label: 'PayPal' },
    { value: 'OTRO', icon: '📝', label: 'Otro' }
  ];

  function renderPaymentCards() {
    const host = $('#checkoutPaymentCards');
    if (!host) return;

    host.textContent = '';
    PAYMENT_OPTIONS.forEach(function (option) {
      const label = global.AnimeStockUI.el('label', {
        className: 'pay-card',
        attrs: { 'data-payment': option.value }
      });

      const input = global.AnimeStockUI.el('input', {
        className: 'pay-card__input',
        attrs: {
          type: 'radio',
          name: 'checkoutPayment',
          value: option.value,
          'aria-label': option.label
        }
      });
      input.checked = session.paymentMethod === option.value;

      const icon = global.AnimeStockUI.el('span', {
        className: 'pay-card__icon', text: option.icon, attrs: { 'aria-hidden': 'true' }
      });
      const text = global.AnimeStockUI.el('span', { className: 'pay-card__label', text: option.label });

      label.append(input, icon, text);
      label.addEventListener('click', function () {
        setPaymentMethod(option.value);
      });
      host.appendChild(label);
    });
  }

  function setPaymentMethod(value) {
    session.paymentMethod = value;

    $$('#checkoutPaymentCards .pay-card').forEach(function (card) {
      const active = card.dataset.payment === value;
      card.classList.toggle('is-selected', active);
      const input = $('.pay-card__input', card);
      if (input) input.checked = active;
    });

    
    const cashFields = $('#checkoutCashFields');
    const referenceField = $('#checkoutReferenceField');
    if (cashFields) cashFields.hidden = value !== 'EFECTIVO';
    if (referenceField) referenceField.hidden = value === 'EFECTIVO';

    renderTotals();
  }

  
  const STATUS_HINTS = {
    PAGADO: 'Se registra el ingreso en caja al confirmar.',
    PENDIENTE: 'No entra a caja hasta que se cobre. Solo estas ventas se pueden editar.',
    ENVIADO: 'Se registra el ingreso en caja y se guarda la fecha de envío.'
  };

  function setStatus(value) {
    session.status = value;
    const hint = $('#checkoutStatusHint');
    if (hint) hint.textContent = STATUS_HINTS[value] || '';
  }

  

  function renderTotals() {
    const data = totals();

    const count = $('#checkoutItemCount');
    if (count) {
      count.textContent = data.itemCount + (data.itemCount === 1 ? ' ítem' : ' ítems');
    }

    const subtotal = $('#checkoutSubtotalText');
    if (subtotal) subtotal.textContent = global.AnimeStockUI.formatCurrency(data.subtotal);

    const discount = $('#checkoutDiscountText');
    if (discount) {
      discount.textContent = data.discount > 0
        ? '- ' + global.AnimeStockUI.formatCurrency(data.discount)
        : global.AnimeStockUI.formatCurrency(0);
    }

    const total = $('#checkoutTotalText');
    if (total) total.textContent = global.AnimeStockUI.formatCurrency(data.total);

    
    const change = $('#checkoutChange');
    if (change) {
      change.textContent = session.paymentMethod === 'EFECTIVO'
        ? global.AnimeStockUI.formatCurrency(data.change)
        : global.AnimeStockUI.formatCurrency(0);
      change.parentNode.classList.toggle('is-short', data.change < 0);
    }

    const discountRow = $('#checkoutDiscountRow');
    if (discountRow) discountRow.hidden = data.discount <= 0;
  }

  
  function renderPaymentFields() {
    const cashFields = $('#checkoutCashFields');
    const referenceField = $('#checkoutReferenceField');
    const isCash = session.paymentMethod === 'EFECTIVO';
    if (cashFields) cashFields.hidden = !isCash;
    if (referenceField) referenceField.hidden = isCash;
  }

  
  function setDiscountMode(mode) {
    session.discountMode = mode;

    const percentBtn = $('#discountPercent');
    const fixedBtn = $('#discountFixed');
    const input = $('#checkoutDiscountInput');

    if (percentBtn) {
      percentBtn.classList.toggle('is-active', mode === 'percent');
      percentBtn.setAttribute('aria-pressed', mode === 'percent' ? 'true' : 'false');
    }
    if (fixedBtn) {
      fixedBtn.classList.toggle('is-active', mode === 'fixed');
      fixedBtn.setAttribute('aria-pressed', mode === 'fixed' ? 'true' : 'false');
    }

    if (input) {
      input.hidden = mode === 'none';
      input.value = session.discountValue;
      input.max = mode === 'percent' ? '100' : '';
      input.step = '1';
      input.placeholder = mode === 'percent' ? '0' : '0';
      input.setAttribute('aria-label', mode === 'percent'
        ? 'Descuento en porcentaje'
        : 'Descuento en pesos');
    }

    renderTotals();
  }

  function setDiscountValue(value) {
    session.discountValue = value;
    renderTotals();
  }



  function showError(boxSelector, message) {
    const box = $(boxSelector);
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  function hideError(boxSelector) {
    const box = $(boxSelector);
    if (!box) return;
    box.hidden = true;
    box.textContent = '';
  }

  
  function validate() {
    hideError('#checkoutCartError');
    hideError('#checkoutCashError');
    hideError('#checkoutCustomerError');

    if (session.cart.length === 0) {
      showError('#checkoutCartError', 'Agregá al menos un producto al carrito.');
      return 'CARRITO_VACIO';
    }

    
    for (let i = 0; i < session.cart.length; i++) {
      const line = session.cart[i];
      if (line.quantity > line.maxStock) {
        showError('#checkoutCartError',
          'Stock insuficiente de ' + line.name + ' (disponible: ' + line.maxStock + ').');
        shakeLine(line.productId);
        return 'STOCK_INSUFICIENTE';
      }
    }

    if (session.paymentMethod === 'EFECTIVO') {
      const data = totals();
      if (!session.amountReceived || Number(session.amountReceived) <= 0) {
        showError('#checkoutCashError', 'Ingresá el monto recibido.');
        return 'MONTO_INVALIDO';
      }
      if (data.received < data.total) {
        showError('#checkoutCashError',
          'El monto recibido es menor al total (' + global.AnimeStockUI.formatCurrency(data.total) + ').');
        return 'MONTO_INSUFICIENTE';
      }
    }

    return '';
  }

  
  async function confirm() {
    if (session.submitted) return;

    const error = validate();
    if (error) {
      session.submitted = false;
      global.AnimeStockUI.toast('Revisá los campos marcados en rojo', 'error');
      return;
    }

    session.submitted = true;
    const button = $('#checkoutConfirm');
    const originalText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Registrando…';
    }

    const data = totals();
    const payload = {
      customerId: session.customerId,
      items: session.cart.map(function (line) {
        return {
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice
        };
      }),
      discount: data.discount,
      paymentMethod: session.paymentMethod,
      status: session.status,
      reference: session.paymentMethod === 'EFECTIVO' ? '' : session.reference,
      notes: session.notes,
      amountReceived: session.paymentMethod === 'EFECTIVO' ? data.received : null
    };

    try {
      const sale = session.mode === 'edit'
        ? await Data.updateSale(session.saleId, payload)
        : await Data.createSale(payload);

      close();
      global.AnimeStockUI.toast(
        (session.mode === 'edit' ? 'Venta actualizada · ' : 'Venta registrada · Comprobante ')
        + sale.receiptNumber,
        'success'
      );

      
      window.setTimeout(function () {
        global.AnimeStockReceipt.open(sale, { focusPrint: true });
      }, 220);

      resetSession();
    } catch (err) {
      console.error('[AnimeStock] No se pudo registrar la venta:', err);
      session.submitted = false;

      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }

      
      if (err.code === 'STOCK_INSUFICIENTE' && err.details) {
        showError('#checkoutCartError', err.message);
        shakeLine(err.details.productId);
      } else {
        showError('#checkoutCartError', err.message || 'No se pudo registrar la venta');
      }
      global.AnimeStockUI.toast(err.message || 'No se pudo registrar la venta', 'error');
    }
  }

  

  function setNewCustomerFormOpen(isOpen) {
    session.newCustomerFormOpen = isOpen;
    const form = $('#checkoutNewCustomerForm');
    const toggle = $('#checkoutNewCustomerToggle');
    if (form) form.hidden = !isOpen;
    if (toggle) toggle.hidden = isOpen;
    if (isOpen) {
      const nameInput = $('#newCustomerName');
      if (nameInput) window.setTimeout(function () { nameInput.focus(); }, 60);
    }
  }

  async function submitNewCustomer() {
    const nameInput = $('#newCustomerName');
    const emailInput = $('#newCustomerEmail');
    const phoneInput = $('#newCustomerPhone');
    const errorBox = $('#newCustomerError');

    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }

    const submit = $('#newCustomerSubmit');
    if (submit) submit.disabled = true;

    try {
      const customer = await Data.createCustomer({
        name: nameInput ? nameInput.value : '',
        email: emailInput ? emailInput.value : '',
        phone: phoneInput ? phoneInput.value : ''
      });

      selectCustomer(customer);
      setNewCustomerFormOpen(false);
      global.AnimeStockUI.toast('Cliente ' + customer.name + ' creado', 'success');

      [nameInput, emailInput, phoneInput].forEach(function (input) {
        if (input) input.value = '';
      });
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message || 'No se pudo crear el cliente';
        errorBox.hidden = false;
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  

  function resetSession() {
    session.mode = 'create';
    session.saleId = null;
    session.cart = [];
    session.customerId = null;
    session.customer = null;
    session.paymentMethod = 'EFECTIVO';
    session.status = 'PAGADO';
    session.reference = '';
    session.notes = '';
    session.amountReceived = '';
    session.discountMode = 'percent';
    session.discountValue = '';
    session.productQuery = '';
    session.productResults = [];
    session.productIndex = -1;
    session.productOpen = false;
    session.customerQuery = '';
    session.customerResults = [];
    session.customerOpen = false;
    session.newCustomerFormOpen = false;
    session.submitted = false;
  }

  
  function syncFromDom() {
    const query = $('#checkoutProductSearch');
    const customerSearch = $('#checkoutCustomerSearch');
    const received = $('#checkoutAmountReceived');
    const reference = $('#checkoutReference');
    const status = $('#checkoutStatus');
    const notes = $('#checkoutNotes');
    const counter = $('#checkoutNotesCount');
    const discountInput = $('#checkoutDiscountInput');

    if (query) session.productQuery = query.value;
    if (customerSearch) session.customerQuery = customerSearch.value;
    if (received) session.amountReceived = received.value;
    if (reference) session.reference = reference.value;
    if (status) session.status = status.value;
    if (discountInput) session.discountValue = discountInput.value;

    session.notes = notes ? notes.value.slice(0, NOTES_MAX) : '';
    if (notes && notes.value.length > NOTES_MAX) notes.value = session.notes;
    if (counter) counter.textContent = session.notes.length + ' / ' + NOTES_MAX;
  }

  
  function syncToDom() {
    const query = $('#checkoutProductSearch');
    const customerSearch = $('#checkoutCustomerSearch');
    const received = $('#checkoutAmountReceived');
    const reference = $('#checkoutReference');
    const status = $('#checkoutStatus');
    const notes = $('#checkoutNotes');
    const counter = $('#checkoutNotesCount');

    if (query) query.value = session.productQuery;
    if (customerSearch) customerSearch.value = session.customerQuery;
    if (received) received.value = session.amountReceived;
    if (reference) reference.value = session.reference;
    if (status) status.value = session.status;
    if (notes) notes.value = session.notes;
    if (counter) counter.textContent = session.notes.length + ' / ' + NOTES_MAX;

    renderPaymentCards();
    setPaymentMethod(session.paymentMethod);
    setStatus(session.status);
    setDiscountMode(session.discountMode);
    renderCustomerChip();
    renderCart();
    renderPaymentFields();
    hideError('#checkoutCartError');
    hideError('#checkoutCashError');
    hideError('#checkoutCustomerError');
    setNewCustomerFormOpen(false);

    const confirmBtn = $('#checkoutConfirm');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = session.mode === 'edit'
        ? 'Guardar cambios'
        : 'Confirmar y generar comprobante';
    }
  }

  
  function open(options) {
    const opts = options || {};
    const element = $('#checkoutModal');
    if (!element) return;

    resetSession();
    setProductResultsOpen(false);
    setCustomerResultsOpen(false);

    if (opts.sale) {
      const sale = opts.sale;
      session.mode = 'edit';
      session.saleId = sale.id;
      session.paymentMethod = sale.paymentMethod;
      session.status = sale.status;
      session.reference = sale.reference || '';
      session.notes = sale.notes || '';
      session.amountReceived = sale.paymentMethod === 'EFECTIVO'
        ? String(sale.amountReceived || '')
        : '';
      session.discountMode = sale.discount > 0 ? 'fixed' : 'percent';
      session.discountValue = sale.discount > 0 ? String(sale.discount) : '';

      
      
      sale.items.forEach(function (item) {
        const product = global.AnimeStockData.products.filter(function (p) {
          return p.id === item.productId;
        })[0];
        session.cart.push({
          productId: item.productId,
          name: item.name,
          anime: item.anime,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          maxStock: product ? product.stock : item.quantity
        });
      });

      selectCustomer(sale.customerId
        ? { id: sale.customerId, name: sale.customer.name, email: sale.customer.email,
            phone: sale.customer.phone, initials: sale.customer.initials }
        : null);
    }

    
    
    
    if (opts.status) session.status = opts.status;

    const title = $('#checkoutTitle');
    if (title) {
      title.textContent = session.mode === 'edit'
        ? 'Editar venta pendiente'
        : 'Nueva venta';
    }
    const subtitle = $('#checkoutSubtitle');
    if (subtitle) {
      subtitle.textContent = session.mode === 'edit'
        ? 'Comprobante ' + opts.sale.receiptNumber
        : 'Agregá productos, elegí cliente y cobrá';
    }

    syncToDom();

    if (!modal) {
      modal = global.AnimeStockUI.createModal(element, {
        initialFocus: '#checkoutProductSearch'
      });
    }
    global.AnimeStockUI.openModal(modal);

    
    const query = $('#checkoutProductSearch');
    if (query) {
      query.value = '';
      session.productQuery = '';
    }
  }

  function close() {
    if (modal) global.AnimeStockUI.closeModal(modal);
  }


  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    const element = $('#checkoutModal');
    if (!element) return;

    modal = global.AnimeStockUI.createModal(element, {
      initialFocus: '#checkoutProductSearch'
    });

    
    const productSearch = $('#checkoutProductSearch');
    if (productSearch) {
      const runSearch = global.AnimeStockUI.debounce(function () {
        searchProducts(productSearch.value.trim());
      }, 220);

      productSearch.addEventListener('input', runSearch);

      productSearch.addEventListener('focus', function () {
        if (session.productResults.length || session.productQuery) {
          renderProductResults();
        } else {
          searchProducts('');
        }
      });

      productSearch.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (!session.productOpen && !session.productResults.length) searchProducts(productSearch.value.trim());
          else moveProductIndex(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveProductIndex(-1);
        } else if (event.key === 'Enter') {
          if (session.productOpen) {
            event.preventDefault();
            pickHighlightedProduct();
          }
        } else if (event.key === 'Escape') {
          setProductResultsOpen(false);
        }
      });
    }

    
    const customerSearch = $('#checkoutCustomerSearch');
    if (customerSearch) {
      const runCustomerSearch = global.AnimeStockUI.debounce(function () {
        searchCustomers(customerSearch.value.trim());
      }, 250);

      customerSearch.addEventListener('input', runCustomerSearch);
      customerSearch.addEventListener('focus', function () { searchCustomers(''); });
      customerSearch.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') setCustomerResultsOpen(false);
      });
    }

    const newCustomerToggle = $('#checkoutNewCustomerToggle');
    if (newCustomerToggle) {
      newCustomerToggle.addEventListener('click', function () {
        setNewCustomerFormOpen(true);
      });
    }
    const newCustomerCancel = $('#newCustomerCancel');
    if (newCustomerCancel) {
      newCustomerCancel.addEventListener('click', function () {
        setNewCustomerFormOpen(false);
      });
    }
    const newCustomerSubmit = $('#newCustomerSubmit');
    if (newCustomerSubmit) {
      newCustomerSubmit.addEventListener('click', submitNewCustomer);
    }
    
    ['#newCustomerName', '#newCustomerEmail', '#newCustomerPhone'].forEach(function (sel) {
      const input = $(sel);
      if (input) {
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            submitNewCustomer();
          }
        });
      }
    });

    
    const received = $('#checkoutAmountReceived');
    if (received) {
      received.addEventListener('input', function () {
        session.amountReceived = received.value;
        hideError('#checkoutCashError');
        renderTotals();
      });
    }

    
    const reference = $('#checkoutReference');
    if (reference) {
      reference.addEventListener('input', function () {
        session.reference = reference.value;
      });
    }

    
    const status = $('#checkoutStatus');
    if (status) {
      status.addEventListener('change', function () { setStatus(status.value); });
    }

    
    const notes = $('#checkoutNotes');
    const counter = $('#checkoutNotesCount');
    if (notes) {
      notes.addEventListener('input', function () {
        if (notes.value.length > NOTES_MAX) {
          notes.value = notes.value.slice(0, NOTES_MAX);
        }
        session.notes = notes.value;
        if (counter) counter.textContent = session.notes.length + ' / ' + NOTES_MAX;
      });
    }

    
    const discountPercent = $('#discountPercent');
    const discountFixed = $('#discountFixed');
    const discountInput = $('#checkoutDiscountInput');
    if (discountPercent) discountPercent.addEventListener('click', function () { setDiscountMode('percent'); });
    if (discountFixed) discountFixed.addEventListener('click', function () { setDiscountMode('fixed'); });
    if (discountInput) {
      discountInput.addEventListener('input', function () {
        setDiscountValue(discountInput.value);
      });
    }

    
    const cancelBtn = $('#checkoutCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        const dirty = session.cart.length > 0;
        if (!dirty) { close(); return; }
        global.AnimeStockUI.confirm({
          title: 'Descartar la venta',
          message: 'El carrito se vaciará y no se registrará nada.',
          confirmText: 'Descartar'
        }).then(function (ok) { if (ok) close(); });
      });
    }

    const confirmBtn = $('#checkoutConfirm');
    if (confirmBtn) confirmBtn.addEventListener('click', confirm);

    
    if (received) {
      received.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          confirm();
        }
      });
    }

    
    document.addEventListener('click', function (event) {
      const productBox = $('#checkoutProductSearchBox');
      if (productBox && !productBox.contains(event.target)) {
        setProductResultsOpen(false);
      }
      const customerBox = $('#checkoutCustomerSearchBox');
      if (customerBox && !customerBox.contains(event.target)) {
        setCustomerResultsOpen(false);
      }
    });

    
    element.addEventListener('anime:closed', function () {
      hideError('#checkoutCartError');
      hideError('#checkoutCashError');
      hideError('#checkoutCustomerError');
      setProductResultsOpen(false);
      setCustomerResultsOpen(false);
      session.submitted = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  
  global.AnimeStockCheckout = {
    open: open,
    close: close,
    init: init,
    confirm: confirm,
    session: session,
    totals: totals,
    addToCart: addToCart,
    setQuantity: setQuantity,
    removeLine: removeLine,
    setPaymentMethod: setPaymentMethod,
    setStatus: setStatus,
    setDiscountMode: setDiscountMode,
    USER: USER
  };

})(typeof window !== 'undefined' ? window : globalThis);