
(function (global) {
  'use strict';

  
  const API_BASE = '';            
  const LATENCY_MIN = 150;       
  const LATENCY_MAX = 250;
  const RECEIPT_COUNTER_KEY = 'animestock.receipt.counter';
  const RECEIPT_PREFIX = 'A-';
  const NOTES_MAX = 200;

  

  
  function clone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (err) {  }
    }
    return JSON.parse(JSON.stringify(value));
  }

  
  function delay() {
    const ms = LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  
  function dataError(message, code, details) {
    const error = new Error(message);
    error.code = code || 'ERROR';
    error.details = details || null;
    return error;
  }
  
  async function apiError(res) {
    let message = 'La API respondio ' + res.status;
    let body = null;
    try {
      body = await res.json();
      if (body && typeof body.message === 'string' && body.message) {
        message = body.message;
      }
    } catch (err) {  }
    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  
  function parseReceiptNumber(receiptNumber) {
    const match = /^A-(\d{4})-(\d{4,})$/.exec(String(receiptNumber || ''));
    if (!match) return null;
    return { year: Number(match[1]), seq: Number(match[2]) };
  }

  
  function productImage(emoji, bg) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="16" fill="' + bg + '"/>' +
      '<text x="32" y="44" font-size="30" text-anchor="middle">' + emoji + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  
  function dateLabel(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  
  const money = (value) => '$' + new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(Math.round(Number(value) || 0));

  
  const STATUS_PAGADO = 'PAGADO';
  const STATUS_PENDIENTE = 'PENDIENTE';
  const STATUS_ENVIADO = 'ENVIADO';
  const STATUS_ANULADO = 'ANULADO';

  const PAYMENT_EFECTIVO = 'EFECTIVO';
  const PAYMENT_TRANSFERENCIA = 'TRANSFERENCIA';
  const PAYMENT_MERCADOPAGO = 'MERCADOPAGO';
  const PAYMENT_PAYPAL = 'PAYPAL';
  const PAYMENT_OTRO = 'OTRO';

  const STATUSES = [STATUS_PAGADO, STATUS_PENDIENTE, STATUS_ENVIADO, STATUS_ANULADO];
  const PAYMENTS = [
    PAYMENT_EFECTIVO, PAYMENT_TRANSFERENCIA,
    PAYMENT_MERCADOPAGO, PAYMENT_PAYPAL, PAYMENT_OTRO
  ];

  
  function normalizeStatus(value) {
    const key = String(value || '').trim().toUpperCase();
    if (STATUSES.indexOf(key) !== -1) return key;
    if (key === 'PAGADA' || key === 'COBRADO' || key === 'COMPLETADO') return STATUS_PAGADO;
    if (key === 'ENVIO' || key === 'ENTREGADO') return STATUS_ENVIADO;
    return STATUS_PENDIENTE;
  }

  
  function normalizePayment(value) {
    const key = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const map = {
      efectivo: PAYMENT_EFECTIVO,
      transferencia: PAYMENT_TRANSFERENCIA,
      transfer: PAYMENT_TRANSFERENCIA,
      mercadopago: PAYMENT_MERCADOPAGO,
      mp: PAYMENT_MERCADOPAGO,
      paypal: PAYMENT_PAYPAL,
      pp: PAYMENT_PAYPAL,
      otro: PAYMENT_OTRO,
      otros: PAYMENT_OTRO
    };
    return map[key] || PAYMENT_OTRO;
  }

  
  function writeReceiptState(state) {
    try {
      global.localStorage.setItem(RECEIPT_COUNTER_KEY, JSON.stringify(state));
    } catch (err) {  }
  }

  function readReceiptState() {
    const year = new Date().getFullYear();
    try {
      const raw = global.localStorage.getItem(RECEIPT_COUNTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.next === 'number' && parsed.next > 0) {
          return { year: Number(parsed.year) || year, next: parsed.next };
        }
      }
    } catch (err) {  }

    
    
    let max = 0;
    sales.forEach((sale) => {
      const parsed = parseReceiptNumber(sale.receiptNumber);
      if (parsed && parsed.year === year) max = Math.max(max, parsed.seq);
    });

    const state = { year: year, next: max + 1 };
    writeReceiptState(state);
    return state;
  }

  
  function nextReceiptNumber(isoDate) {
    const year = isoDate ? new Date(isoDate).getFullYear() : new Date().getFullYear();
    let state = readReceiptState();
    if (state.year !== year) state = { year: year, next: 1 };

    const seq = state.next;
    state.next = seq + 1;
    writeReceiptState(state);

    return RECEIPT_PREFIX + year + '-' + String(seq).padStart(4, '0');
  }


  const products = [
    { id: 1,  name: 'Gojo chibi',   anime: 'Jujutsu Kaisen',   category: 'Figuras',  emoji: '🟢', cost: 120, price: 250, stock: 7 },
    { id: 2,  name: 'Sukuna',        anime: 'Jujutsu Kaisen',   category: 'Figuras',  emoji: '🔴', cost: 150, price: 320, stock: 2 },
    { id: 3,  name: 'Itadori',       anime: 'Jujutsu Kaisen',   category: 'Figuras',  emoji: '🧑', cost: 100, price: 210, stock: 9 },
    { id: 4,  name: 'Goku SSJ3',     anime: 'Dragon Ball',      category: 'Figuras',  emoji: '🟠', cost: 240, price: 450, stock: 5 },
    { id: 5,  name: 'Vegeta',        anime: 'Dragon Ball',      category: 'Figuras',  emoji: '💥', cost: 180, price: 380, stock: 1 },
    { id: 6,  name: 'Luffy Gear 5',  anime: 'One Piece',        category: 'Figuras',  emoji: '🎩', cost: 220, price: 420, stock: 3 },
    { id: 7,  name: 'Zoro',          anime: 'One Piece',        category: 'Figuras',  emoji: '⚔️', cost: 90,  price: 180, stock: 11 },
    { id: 8,  name: 'Naruto',        anime: 'Naruto',           category: 'Figuras',  emoji: '🌀', cost: 110, price: 230, stock: 6 },
    { id: 9,  name: 'Sasuke',        anime: 'Naruto',           category: 'Figuras',  emoji: '🔵', cost: 95,  price: 190, stock: 0 },
    { id: 10, name: 'Tanjiro',       anime: 'Kimetsu no Yaiba', category: 'Figuras',  emoji: '🌊', cost: 130, price: 260, stock: 4 },
    { id: 11, name: 'Nezuko',        anime: 'Kimetsu no Yaiba', category: 'Figuras',  emoji: '🎋', cost: 160, price: 300, stock: 2 },
    { id: 12, name: 'Levi',          anime: 'Attack on Titan',  category: 'Figuras',  emoji: '🪖', cost: 140, price: 280, stock: 8 },
    { id: 13, name: 'Eren',          anime: 'Attack on Titan',  category: 'Figuras',  emoji: '👹', cost: 125, price: 255, stock: 3 },
    { id: 14, name: 'Totoro 40cm',   anime: 'Totoro',           category: 'Peluches', emoji: '🐻', cost: 200, price: 400, stock: 0 },
    { id: 15, name: 'Pikachu',       anime: 'Pokemon',          category: 'Peluches', emoji: '⚡', cost: 85,  price: 170, stock: 12 }
  ];

  
  products.forEach(function (product, index) {
    const bgs = ['#f4eef9', '#fdf1f5', '#eef6f3', '#fbf5e9'];
    product.imageUrl = productImage(product.emoji, bgs[index % bgs.length]);
    product.active = true;
  });

  
  const customers = [
    { id: 1, name: 'Lucia Fernandez',  email: 'lucia.fernandez@gmail.com',  phone: '+54 11 4521-8834' },
    { id: 2, name: 'Mateo Rios',        email: 'mateo.rios@outlook.com',      phone: '+54 11 5233-1177' },
    { id: 3, name: 'Sofia Alvarez',     email: 'sofia.alvarez@gmail.com',     phone: '+54 11 4812-9930' },
    { id: 4, name: 'Diego Nakamura',    email: 'diego.nakamura@gmail.com',    phone: '+54 341 422-7788' },
    { id: 5, name: 'Carla Mendoza',     email: 'carla.mendoza@yahoo.com.ar',  phone: '+54 11 4788-3021' },
    { id: 6, name: 'Bruno Ferrari',     email: 'bruno.ferrari@gmail.com',     phone: '+54 11 6043-5520' },
    { id: 7, name: 'Julieta Ponce',     email: 'julieta.ponce@gmail.com',     phone: '+54 11 3901-2244' },
    { id: 8, name: 'Tomas Aguirre',     email: 'tomas.aguirre@outlook.com',   phone: '+54 11 6677-8899' }
  ];

  
  customers.forEach(function (customer, index) {
    const monthsAgo = 5 + index * 2;
    customer.initials = initialsOf(customer.name);
    customer.createdAt = new Date(
      Date.now() - (monthsAgo * 30 + index * 3) * 24 * 60 * 60 * 1000
    ).toISOString();
  });

  
  function buildSeedSales() {
    const rand = mulberry32(20261005);
    const pick = function (pool) { return pool[Math.floor(rand() * pool.length)]; };

    
    const statusPool = [
      STATUS_PAGADO, STATUS_PAGADO, STATUS_PAGADO, STATUS_PAGADO, STATUS_PAGADO,
      STATUS_PAGADO, STATUS_PAGADO,
      STATUS_ENVIADO, STATUS_ENVIADO, STATUS_ENVIADO,
      STATUS_PENDIENTE, STATUS_PENDIENTE, STATUS_PENDIENTE
    ];
    const paymentPool = [
      PAYMENT_EFECTIVO, PAYMENT_EFECTIVO, PAYMENT_EFECTIVO, PAYMENT_EFECTIVO,
      PAYMENT_TRANSFERENCIA, PAYMENT_TRANSFERENCIA,
      PAYMENT_MERCADOPAGO, PAYMENT_MERCADOPAGO,
      PAYMENT_PAYPAL, PAYMENT_OTRO
    ];
    const referencePrefix = {
      TRANSFERENCIA: 'TX', MERCADOPAGO: 'MP', PAYPAL: 'PP', OTRO: 'OP'
    };
    const notesPool = [
      'Enviar antes del viernes',
      'El cliente pide empaque para regalo',
      'Retirar en el local despues de las 18h',
      'Second chance, precio de galeria',
      'Combinar con el proximo pedido'
    ];

    const sellable = products.filter(function (product) { return product.stock > 0; });
    const now = new Date();
    const rows = [];

    for (let index = 0; index < 25; index++) {
      
      const daysAgo = index < 3 ? Math.floor(index / 2) : 3 + Math.floor(rand() * 87);
      const soldAt = new Date(
        now.getFullYear(), now.getMonth(), now.getDate() - daysAgo,
        10 + Math.floor(rand() * 11), Math.floor(rand() * 60)
      );

      const customer = pick(customers);

      
      const wanted = rand() < 0.55 ? 1 : (rand() < 0.8 ? 2 : 3);
      const chosen = [];
      while (chosen.length < wanted) {
        const product = pick(sellable);
        if (!chosen.some(function (item) { return item.id === product.id; })) {
          chosen.push(product);
        }
      }

      const items = chosen.map(function (product) {
        const maxQty = Math.min(3, product.stock);
        const quantity = 1 + Math.floor(rand() * maxQty);
        return {
          productId: product.id,
          name: product.name,
          anime: product.anime,
          imageUrl: product.imageUrl,
          quantity: quantity,
          unitPrice: product.price,
          subtotal: product.price * quantity
        };
      });

      const subtotal = items.reduce(function (acc, item) { return acc + item.subtotal; }, 0);
      const discount = rand() < 0.28
        ? Math.round(subtotal * (rand() < 0.5 ? 0.05 : 0.1))
        : 0;
      const total = subtotal - discount;

      const status = index === 0 ? STATUS_PAGADO
        : (index === 1 ? STATUS_PAGADO : (index === 2 ? STATUS_ENVIADO : pick(statusPool)));
      const paymentMethod = pick(paymentPool);

      
      const amountReceived = paymentMethod === PAYMENT_EFECTIVO
        ? (rand() < 0.55 ? total : Math.ceil(total / 500) * 500)
        : total;

      
      const reference = paymentMethod === PAYMENT_EFECTIVO ? ''
        : referencePrefix[paymentMethod] + '-' + (1000 + Math.floor(rand() * 8999));

      rows.push({
        id: 0,                 
        receiptNumber: '',     
        customerId: customer.id,
        customer: customerSnapshot(customer),
        items: items,
        subtotal: subtotal,
        discount: discount,
        total: total,
        paymentMethod: paymentMethod,
        status: status,
        reference: reference,
        notes: rand() < 0.22 ? pick(notesPool) : '',
        amountReceived: amountReceived,
        change: amountReceived - total,
        soldAt: soldAt.toISOString(),
        sentAt: status === STATUS_ENVIADO
          ? new Date(soldAt.getTime() + 26 * 60 * 60 * 1000).toISOString()
          : null,
        cancelledAt: null
      });
    }

    
    rows.sort(function (a, b) { return new Date(a.soldAt) - new Date(b.soldAt); });

    rows.forEach(function (sale, index) {
      sale.id = index + 1;
      sale.receiptNumber = RECEIPT_PREFIX
        + new Date(sale.soldAt).getFullYear()
        + '-' + String(index + 1).padStart(4, '0');
    });

    return rows;
  }

  const sales = buildSeedSales();


  function buildSeedCashMovements() {
    const rows = [];

    function push(type, amount, description, saleId, occurredAt) {
      rows.push({
        id: rows.length + 1,
        type: type,
        amount: amount,
        description: description,
        saleId: saleId === undefined ? null : saleId,
        occurredAt: occurredAt
      });
    }

    
    sales.forEach(function (sale) {
      if (sale.status === STATUS_PENDIENTE || sale.status === STATUS_ANULADO) return;
      push('INGRESO', sale.total,
        'Venta ' + sale.receiptNumber + ' - ' + sale.customer.name,
        sale.id, sale.soldAt);
    });

    
    sales.filter(function (sale) { return sale.status === STATUS_PENDIENTE; })
      .forEach(function (sale, index) {
        if (index % 2 !== 0) return;
        push('INGRESO', Math.round(sale.total * 0.4 / 50) * 50,
          'Sena venta ' + sale.receiptNumber + ' - ' + sale.customer.name,
          sale.id,
          new Date(new Date(sale.soldAt).getTime() + 2 * 60 * 60 * 1000).toISOString());
      });

    
    const ajustes = [
      ['Ajuste de caja - reposicion de fondo fijo', 8000, 2],
      ['Cobro en mostrador (sin comprobante fiscal)', 4500, 4],
      ['Ajuste por cambio de turno', 3000, 5],
      ['Reposicion de fondo fijo', 12000, 7],
      ['Cobro de sena online', 6500, 9],
      ['Ajuste de caja - diferencia de vuelto', 2500, 11],
      ['Recargo por envio cobrado en mostrador', 3500, 13],
      ['Reposicion de fondo fijo', 10000, 16],
      ['Ajuste de caja - apertura del dia', 5000, 18],
      ['Cobro de sena online', 7500, 21],
      ['Reposicion de fondo fijo', 9000, 24],
      ['Ajuste de caja - cierre de turno', 4000, 27]
    ];
    ajustes.forEach(function (ajuste) {
      if (rows.length >= 30) return;
      push('INGRESO', ajuste[1], ajuste[0], null,
        new Date(Date.now() - ajuste[2] * 24 * 60 * 60 * 1000).toISOString());
    });

    
    const egresos = [
      ['Compra de stock al proveedor', 148000, 26],
      ['Envio internacional de mercaderia', 32600, 14],
      ['Material de empaque (bolsas y cinta)', 18750, 6]
    ];
    egresos.forEach(function (egreso) {
      push('EGRESO', egreso[1], egreso[0], null,
        new Date(Date.now() - egreso[2] * 24 * 60 * 60 * 1000).toISOString());
    });

    rows.sort(function (a, b) { return new Date(b.occurredAt) - new Date(a.occurredAt); });
    return rows;
  }

  const cashMovements = buildSeedCashMovements();

  
  function findProduct(productId) {
    const id = Number(productId);
    return products.filter(function (p) { return p.id === id; })[0] || null;
  }

  function findCustomer(customerId) {
    const id = Number(customerId);
    return customers.filter(function (c) { return c.id === id; })[0] || null;
  }

  function findSale(saleId) {
    const id = Number(saleId);
    return sales.filter(function (s) { return s.id === id; })[0] || null;
  }

  function maxId(list) {
    return list.reduce(function (max, item) { return Math.max(max, item.id); }, 0);
  }

  
  function customerSnapshot(customer) {
    if (!customer) {
      return { id: null, name: 'Consumidor final', email: '', phone: '', initials: 'CF' };
    }
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      initials: customer.initials
    };
  }

  
  const RANGES = ['hoy', '7d', 'mes', 'anio', 'todo'];

  
  function resolveRange(range) {
    const key = RANGES.indexOf(range) !== -1 ? range : 'todo';
    if (key === 'todo') return null;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (key === 'hoy') return { from: start.toISOString(), to: now.toISOString() };

    if (key === '7d') {
      start.setDate(start.getDate() - 6);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (key === 'mes') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: now.toISOString()
      };
    }
    return {
      from: new Date(now.getFullYear(), 0, 1).toISOString(),
      to: now.toISOString()
    };
  }

  function inRange(iso, range) {
    if (!range) return true;
    const time = new Date(iso).getTime();
    return time >= new Date(range.from).getTime() && time <= new Date(range.to).getTime();
  }

  
  
  async function fetchProducts(query, options) {
    const queryText = query === undefined ? '' : query;
    const opts = options || {};

    if (API_BASE !== null) {
      const params = new URLSearchParams();
      if (queryText) params.set('query', queryText);
      if (opts.category) params.set('category', opts.category);
      if (opts.inStockOnly) params.set('inStockOnly', 'true');
      if (opts.limit) params.set('limit', opts.limit);
      
      
      if (opts.offset) params.set('offset', opts.offset);
      const fetchOpts = {};
      if (opts.signal) fetchOpts.signal = opts.signal;
      const res = await fetch(API_BASE + '/api/products?' + params.toString(), fetchOpts);
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();

    const needle = String(queryText || '').trim().toLowerCase();
    let rows = products.filter(function (product) {
      if (opts.category && product.category !== opts.category) return false;
      if (opts.inStockOnly && product.stock <= 0) return false;
      if (!needle) return true;
      const haystack = (product.name + ' ' + product.anime + ' ' + product.category)
        .toLowerCase();
      return haystack.indexOf(needle) !== -1;
    });

    
    rows.sort(function (a, b) {
      const stockOrder = (a.stock > 0 ? -1 : 1) - (b.stock > 0 ? -1 : 1);
      if (stockOrder !== 0) return stockOrder;
      return a.name.localeCompare(b.name, 'es');
    });

    const result = clone(rows);
    const limit = opts.limit || 24;
    return { content: result.slice(0, limit), totalElements: result.length };
  }

  
  async function fetchProductById(productId) {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/products/' + productId);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('La API respondio ' + res.status);
      return res.json();
    }
    await delay();
    const product = findProduct(productId);
    return product ? clone(product) : null;
  }

  

  
  const localCategories = [];

  
  function categoriesFromProducts() {
    const names = [];
    products.forEach(function (product) {
      if (product.category && names.indexOf(product.category) === -1) {
        names.push(product.category);
      }
    });
    localCategories.forEach(function (category) {
      if (names.indexOf(category.nombre) === -1) names.push(category.nombre);
    });
    return names.map(function (name, index) {
      return { id: index + 1, nombre: name };
    });
  }

  
  async function fetchCategories() {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/categories');
      if (!res.ok) await apiError(res);
      return res.json();
    }
    await delay();
    return clone(categoriesFromProducts());
  }

  
  async function createCategory(nombre) {
    const name = String(nombre === undefined || nombre === null ? '' : nombre).trim();
    if (!name) throw dataError('El nombre es obligatorio', 'CATEGORIA_NOMBRE');

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: name })
      });
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();
    const created = { id: localCategories.length + 1, nombre: name };
    localCategories.push(created);
    emitDataChange('category:created', clone(created));
    return clone(created);
  }

  
  async function createProduct(payload) {
    const input = payload || {};

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();
    const nextId = products.reduce(function (max, product) {
      return Math.max(max, product.id);
    }, 0) + 1;
    const created = Object.assign({}, input, { id: nextId, active: input.activo !== false });
    products.push(created);
    emitDataChange('product:created', clone(created));
    return clone(created);
  }

  
  async function updateProduct(productId, payload) {
    const input = payload || {};

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/products/' + productId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();
    const product = findProduct(productId);
    if (!product) throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
    Object.assign(product, input);
    emitDataChange('product:updated', clone(product));
    return clone(product);
  }

  
  async function deleteProduct(productId) {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/products/' + productId, { method: 'DELETE' });
      if (!res.ok) await apiError(res);
      return { id: Number(productId), deleted: true };
    }

    await delay();
    const index = products.findIndex(function (product) {
      return product.id === Number(productId);
    });
    if (index === -1) throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
    const removed = products.splice(index, 1)[0];
    emitDataChange('product:deleted', clone(removed));
    return { id: removed.id, deleted: true };
  }

  

  
  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(dataError('No se pudo leer la imagen', 'IMAGEN_LECTURA')); };
      reader.readAsDataURL(file);
    });
  }

  
  async function uploadProductImage(productId, file) {
    if (!file) throw dataError('No elegiste ninguna imagen', 'IMAGEN_VACIA');

    if (API_BASE !== null) {
      const form = new FormData();
      
      form.append('file', file, file.name || 'imagen');
      const res = await fetch(API_BASE + '/api/products/' + productId + '/image', {
        method: 'POST',
        body: form
      });
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();
    const product = findProduct(productId);
    if (!product) throw dataError('Producto inexistente: ' + productId, 'PRODUCTO_INEXISTENTE');
    product.imageUrl = await fileToDataUrl(file);
    emitDataChange('product:image', clone(product));
    return clone(product);
  }

  
  async function deleteProductImage(productId) {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/products/' + productId + '/image', {
        method: 'DELETE'
      });
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();
    const product = findProduct(productId);
    if (!product) return null;
    product.imageUrl = null;
    emitDataChange('product:image', clone(product));
    return clone(product);
  }

  
  
  async function fetchCustomers(query) {
    const queryText = query === undefined ? '' : query;

    if (API_BASE !== null) {
      const params = new URLSearchParams();
      if (queryText) params.set('q', queryText);
      const res = await fetch(API_BASE + '/api/customers?' + params.toString());
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();

    const needle = String(queryText || '').trim().toLowerCase();
    const rows = customers.filter(function (customer) {
      if (!needle) return true;
      const haystack = (customer.name + ' ' + customer.email + ' ' + customer.phone)
        .toLowerCase();
      return haystack.indexOf(needle) !== -1;
    });

    rows.sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
    const result = clone(rows);
    return { content: result, totalElements: result.length };
  }

  
  async function createCustomer(payload) {
    const input = payload || {};

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!res.ok) await apiError(res);
      return res.json();
    }

    await delay();

    const name = String(input.name || '').trim();
    if (name.length < 2) throw dataError('El nombre es obligatorio', 'NOMBRE_INVALIDO');
    if (name.length > 80) throw dataError('El nombre es demasiado largo', 'NOMBRE_INVALIDO');

    const email = String(input.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw dataError('El email no tiene un formato valido', 'EMAIL_INVALIDO');
    }

    const customer = {
      id: maxId(customers) + 1,
      name: name,
      email: email,
      phone: String(input.phone || '').trim(),
      initials: initialsOf(name),
      createdAt: new Date().toISOString()
    };

    customers.push(customer);
    emitDataChange('customer:created', { customerId: customer.id });
    return clone(customer);
  }



  
  function buildLines(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw dataError('El carrito esta vacio', 'CARRITO_VACIO');
    }

    return items.map(function (line) {
      const product = findProduct(line.productId);
      if (!product) {
        throw dataError('Producto inexistente: ' + line.productId, 'PRODUCTO_INEXISTENTE');
      }

      const quantity = Math.max(1, Math.round(Number(line.quantity) || 1));
      if (quantity > product.stock) {
        throw dataError(
          'Stock insuficiente de ' + product.name + ' (disponible: ' + product.stock + ')',
          'STOCK_INSUFICIENTE',
          { productId: product.id, available: product.stock }
        );
      }

      const requested = Number(line.unitPrice);
      const unitPrice = isFinite(requested) && requested > 0
        ? Math.round(requested)
        : product.price;

      return {
        productId: product.id,
        name: product.name,
        anime: product.anime,
        imageUrl: product.imageUrl,
        quantity: quantity,
        unitPrice: unitPrice,
        subtotal: unitPrice * quantity
      };
    });
  }

  function computeTotals(lines, rawDiscount) {
    const subtotal = lines.reduce(function (acc, line) { return acc + line.subtotal; }, 0);
    const discount = clamp(Math.round(Number(rawDiscount) || 0), 0, subtotal);
    return { subtotal: subtotal, discount: discount, total: Math.max(0, subtotal - discount) };
  }

  
  async function fetchSales(filters) {
    const query = filters || {};

    if (API_BASE !== null) {
      const params = new URLSearchParams();
      params.set('limit', query.limit || 25);
      params.set('offset', query.offset || 0);
      if (query.status && query.status !== 'todos') params.set('status', query.status);
      if (query.payment && query.payment !== 'todos') params.set('payment', query.payment);
      if (query.q) params.set('q', query.q);
      const range = resolveRange(query.range);
      if (range) {
        params.set('from', range.from);
        params.set('to', range.to);
      }
      const res = await fetch(API_BASE + '/api/sales?' + params.toString());
      if (!res.ok) throw new Error('La API respondio ' + res.status);
      return res.json();
    }

    await delay();

    let rows = sales.slice();

    
    const needle = String(query.q || '').trim().toLowerCase();
    if (needle) {
      rows = rows.filter(function (sale) {
        const items = sale.items.map(function (item) {
          return item.name + ' ' + item.anime;
        }).join(' ');
        const haystack = (sale.customer.name + ' ' + sale.customer.email + ' '
          + items + ' ' + sale.receiptNumber).toLowerCase();
        return haystack.indexOf(needle) !== -1;
      });
    }

    
    if (query.status && query.status !== 'todos') {
      const status = normalizeStatus(query.status);
      rows = rows.filter(function (sale) { return sale.status === status; });
    }
    if (query.payment && query.payment !== 'todos') {
      const payment = normalizePayment(query.payment);
      rows = rows.filter(function (sale) { return sale.paymentMethod === payment; });
    }

    
    const range = resolveRange(query.range);
    rows = rows.filter(function (sale) { return inRange(sale.soldAt, range); });

    
    rows.sort(function (a, b) { return new Date(b.soldAt) - new Date(a.soldAt); });

    const totalElements = rows.length;
    const size = Math.max(1, Number(query.limit) || 25);
    const offset = Math.max(0, Number(query.offset) || 0);
    const content = rows.slice(offset, offset + size);

    return {
      content: clone(content),
      page: Math.floor(offset / size),
      size: size,
      totalElements: totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / size)),
      from: range ? range.from : null,
      to: range ? range.to : null
    };
  }

  
  async function fetchSaleById(saleId) {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/sales/' + saleId);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('La API respondio ' + res.status);
      return res.json();
    }
    await delay();
    const sale = findSale(saleId);
    return sale ? clone(sale) : null;
  }

  
  async function createSale(payload) {
    const input = payload || {};

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!res.ok) await apiError(res);
      const saved = await res.json();
      emitDataChange('sale:created', { saleId: saved.id });
      return saved;
    }

    await delay();

    const lines = buildLines(input.items);
    const status = normalizeStatus(input.status);
    const paymentMethod = normalizePayment(input.paymentMethod);
    const totals = computeTotals(lines, input.discount);

    const soldAt = input.soldAt || new Date().toISOString();
    const customer = findCustomer(input.customerId);

    
    const receivedRaw = Number(input.amountReceived);
    const amountReceived = paymentMethod === PAYMENT_EFECTIVO
      ? Math.max(totals.total, isFinite(receivedRaw) ? Math.round(receivedRaw) : totals.total)
      : totals.total;

    const sale = {
      id: maxId(sales) + 1,
      receiptNumber: nextReceiptNumber(soldAt),
      customerId: customer ? customer.id : null,
      customer: customerSnapshot(customer),
      items: lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      paymentMethod: paymentMethod,
      status: status,
      reference: String(input.reference || '').trim(),
      notes: String(input.notes || '').trim().slice(0, NOTES_MAX),
      amountReceived: amountReceived,
      change: amountReceived - totals.total,
      soldAt: soldAt,
      sentAt: status === STATUS_ENVIADO ? new Date().toISOString() : null,
      cancelledAt: null
    };

    
    lines.forEach(function (line) {
      const product = findProduct(line.productId);
      if (product) product.stock = Math.max(0, product.stock - line.quantity);
    });

    
    sales.push(sale);

    
    let movement = null;
    if (status !== STATUS_PENDIENTE) {
      movement = pushMovement({
        type: 'INGRESO',
        amount: sale.total,
        description: 'Venta ' + sale.receiptNumber + ' - ' + sale.customer.name,
        saleId: sale.id,
        occurredAt: sale.soldAt
      });
    }

    emitDataChange('sale:created', { saleId: sale.id });
    const result = clone(sale);
    result.cashMovement = movement ? clone(decorateMovement(movement)) : null;
    return result;
  }


  async function updateSale(saleId, payload) {
    const input = payload || {};

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/sales/' + saleId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!res.ok) await apiError(res);
      const saved = await res.json();
      emitDataChange('sale:updated', { saleId: saved.id });
      return saved;
    }

    await delay();

    const sale = findSale(saleId);
    if (!sale) throw dataError('La venta no existe', 'NO_ENCONTRADO');
    if (sale.status !== STATUS_PENDIENTE) {
      throw dataError('Solo se pueden editar ventas pendientes', 'VENTA_NO_EDITABLE',
        { status: sale.status });
    }

    
    sale.items.forEach(function (line) {
      const product = findProduct(line.productId);
      if (product) product.stock += line.quantity;
    });

    let lines;
    try {
      lines = buildLines(input.items);
    } catch (error) {
      
      sale.items.forEach(function (line) {
        const product = findProduct(line.productId);
        if (product) product.stock = Math.max(0, product.stock - line.quantity);
      });
      throw error;
    }

    const status = normalizeStatus(input.status);
    const paymentMethod = normalizePayment(input.paymentMethod);
    const totals = computeTotals(lines, input.discount);

    lines.forEach(function (line) {
      const product = findProduct(line.productId);
      if (product) product.stock = Math.max(0, product.stock - line.quantity);
    });

    sale.items = lines;
    sale.subtotal = totals.subtotal;
    sale.discount = totals.discount;
    sale.total = totals.total;
    sale.paymentMethod = paymentMethod;
    sale.status = status;
    sale.reference = String(input.reference || '').trim();
    sale.notes = String(input.notes || '').trim().slice(0, NOTES_MAX);

    const receivedRaw = Number(input.amountReceived);
    sale.amountReceived = paymentMethod === PAYMENT_EFECTIVO
      ? Math.max(totals.total, isFinite(receivedRaw) ? Math.round(receivedRaw) : totals.total)
      : totals.total;
    sale.change = sale.amountReceived - totals.total;

    if (input.customerId !== undefined) {
      const customer = findCustomer(input.customerId);
      sale.customerId = customer ? customer.id : null;
      sale.customer = customerSnapshot(customer);
    }
    if (status === STATUS_ENVIADO && !sale.sentAt) {
      sale.sentAt = new Date().toISOString();
    }

    
    let movement = null;
    if (status !== STATUS_PENDIENTE) {
      movement = pushMovement({
        type: 'INGRESO',
        amount: sale.total,
        description: 'Venta ' + sale.receiptNumber + ' - ' + sale.customer.name,
        saleId: sale.id,
        occurredAt: new Date().toISOString()
      });
    }

    emitDataChange('sale:updated', { saleId: sale.id });
    const result = clone(sale);
    result.cashMovement = movement ? clone(decorateMovement(movement)) : null;
    return result;
  }

  
  async function cancelSale(saleId) {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/sales/' + saleId, { method: 'DELETE' });
      if (!res.ok) await apiError(res);
      const saved = await res.json();
      emitDataChange('sale:cancelled', { saleId: saved.id });
      return saved;
    }

    await delay();

    const sale = findSale(saleId);
    if (!sale) throw dataError('La venta no existe', 'NO_ENCONTRADO');
    if (sale.status === STATUS_ANULADO) throw dataError('La venta ya estaba anulada', 'YA_ANULADA');

    const wasCharged = sale.status !== STATUS_PENDIENTE;

    sale.items.forEach(function (line) {
      const product = findProduct(line.productId);
      if (product) product.stock += line.quantity;
    });

    sale.status = STATUS_ANULADO;
    sale.cancelledAt = new Date().toISOString();

    let movement = null;
    if (wasCharged) {
      movement = pushMovement({
        type: 'EGRESO',
        amount: sale.total,
        description: 'Anulacion venta ' + sale.receiptNumber,
        saleId: sale.id,
        occurredAt: sale.cancelledAt
      });
    }

    emitDataChange('sale:cancelled', { saleId: sale.id });
    const result = clone(sale);
    result.cashMovement = movement ? clone(decorateMovement(movement)) : null;
    return result;
  }

  

  
  function pushMovement(payload) {
    const movement = {
      id: maxId(cashMovements) + 1,
      type: payload.type === 'EGRESO' ? 'EGRESO' : 'INGRESO',
      amount: Math.abs(Math.round(Number(payload.amount) || 0)),
      description: String(payload.description || '').trim(),
      saleId: payload.saleId === undefined ? null : payload.saleId,
      occurredAt: payload.occurredAt || new Date().toISOString()
    };
    cashMovements.push(movement);
    return movement;
  }

  
  function decorateMovement(movement) {
    const sale = movement.saleId ? findSale(movement.saleId) : null;
    return {
      id: movement.id,
      type: movement.type,
      amount: movement.amount,
      description: movement.description,
      saleId: movement.saleId,
      occurredAt: movement.occurredAt,
      receiptNumber: sale ? sale.receiptNumber : null,
      customerName: sale ? sale.customer.name : null
    };
  }

  
  async function fetchCashMovements(range, options) {
    const key = range === undefined ? 'todo' : range;
    const opts = options || {};

    if (API_BASE !== null) {
      const params = new URLSearchParams();
      const window_ = resolveRange(key);
      if (window_) {
        params.set('from', window_.from);
        params.set('to', window_.to);
      }
      const res = await fetch(API_BASE + '/api/cash/movements?' + params.toString());
      if (!res.ok) throw new Error('La API respondio ' + res.status);
      return res.json();
    }

    await delay();

    const window_ = resolveRange(key);
    const rows = cashMovements.filter(function (movement) {
      return inRange(movement.occurredAt, window_);
    });

    const summary = rows.reduce(function (acc, movement) {
      if (movement.type === 'EGRESO') acc.expense += movement.amount;
      else acc.income += movement.amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    }, { income: 0, expense: 0, balance: 0 });

    rows.sort(function (a, b) { return new Date(b.occurredAt) - new Date(a.occurredAt); });

    const totalElements = rows.length;
    const size = Math.max(1, Number(opts.limit) || 50);
    const offset = Math.max(0, Number(opts.offset) || 0);

    return {
      content: clone(rows.slice(offset, offset + size).map(decorateMovement)),
      page: Math.floor(offset / size),
      size: size,
      totalElements: totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / size)),
      summary: summary,
      from: window_ ? window_.from : null,
      to: window_ ? window_.to : null
    };
  }

  
  async function createCashMovement(payload) {
    const input = payload || {};

    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/cash/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!res.ok) await apiError(res);
      const saved = await res.json();
      emitDataChange('cash:created', { movementId: saved.id });
      return saved;
    }

    await delay();

    const type = String(input.type || 'INGRESO').toUpperCase() === 'EGRESO'
      ? 'EGRESO'
      : 'INGRESO';
    const amount = Math.round(Number(input.amount) || 0);
    if (amount <= 0) {
      throw dataError('El monto tiene que ser mayor a cero', 'MONTO_INVALIDO');
    }

    const description = String(input.description || '').trim();
    if (description.length < 3) {
      throw dataError('Escribi una descripcion de al menos 3 caracteres', 'DESCRIPCION_INVALIDA');
    }

    const movement = pushMovement({
      type: type,
      amount: amount,
      description: description,
      saleId: null,
      occurredAt: input.occurredAt || new Date().toISOString()
    });

    emitDataChange('cash:created', { movementId: movement.id });
    return clone(decorateMovement(movement));
  }

  
  const changeListeners = [];

  function onDataChange(listener) {
    if (typeof listener !== 'function') return function () {};
    changeListeners.push(listener);
    return function off() {
      const index = changeListeners.indexOf(listener);
      if (index !== -1) changeListeners.splice(index, 1);
    };
  }

  function emitDataChange(reason, payload) {
    changeListeners.slice().forEach(function (listener) {
      try {
        listener(reason, payload);
      } catch (error) {
        console.error('[AnimeStock] listener de datos fallo:', error);
      }
    });
  }


  const dashboardData = {
    kpis: [
      {
        title: 'Ventas de este Mes', value: '$12.450', icon: 'mdi-cart-outline',
        growth: '15.2%', growthType: 'positive', color: '#a78bfa',
        subtitle: 'vs mes anterior'
      },
      {
        title: 'Pedidos Activos', value: '34', icon: 'mdi-package-variant-closed',
        growth: '5.1%', growthType: 'positive', color: '#f0abfc',
        subtitle: 'creados este mes'
      },
      {
        title: 'Stock Bajo', value: '12', icon: 'mdi-alert-outline',
        growth: '-2.4%', growthType: 'negative', color: '#f5cf8b',
        subtitle: 'productos con stock < 3'
      },
      {
        title: 'Nuevos Clientes', value: '156', icon: 'mdi-account-group-outline',
        growth: '8.7%', growthType: 'positive', color: '#a8d5ba',
        subtitle: 'registrados este mes'
      }
    ],

    monthlyRevenue: [
      { label: 'Nov', value: 4200 },
      { label: 'Dic', value: 5100 },
      { label: 'Ene', value: 4700 },
      { label: 'Feb', value: 6300 },
      { label: 'Mar', value: 5800 },
      { label: 'Abr', value: 7200 },
      { label: 'May', value: 6700 },
      { label: 'Jun', value: 8100 },
      { label: 'Jul', value: 7600 },
      { label: 'Ago', value: 9400 },
      { label: 'Sep', value: 8900 },
      { label: 'Oct', value: 12450 }
    ],

    categorySales: [
      { label: 'Figuras', value: 42, color: '#a78bfa' },
      { label: 'Manga', value: 26, color: '#c084fc' },
      { label: 'Ropa', value: 19, color: '#d946ef' },
      { label: 'Accesorios', value: 13, color: '#f0abfc' }
    ],

    recentSales: [
      {
        customer: 'Lucia Fernandez', initials: 'LF', product: 'Peluchito Totoro 40cm',
        date: '18 Sep 2026', amount: '$18.900', estado: 'pagado',
        metodoPago: 'mercadopago', stock: 12
      },
      {
        customer: 'Mateo Rios', initials: 'MR', product: 'Peluchito Goku SSJ3',
        date: '12 Sep 2026', amount: '$24.500', estado: 'pendiente',
        metodoPago: 'efectivo', stock: 4
      },
      {
        customer: 'Sofia Alvarez', initials: 'SA', product: 'Peluchito Sakura 30cm',
        date: '09 Sep 2026', amount: '$12.750', estado: 'enviado',
        metodoPago: 'transferencia', stock: 9
      },
      {
        customer: 'Diego Nakamura', initials: 'DN', product: 'Set 3 peluchitos Chibi',
        date: '05 Sep 2026', amount: '$31.200', estado: 'pagado',
        metodoPago: 'paypal', stock: 2
      },
      {
        customer: 'Carla Mendoza', initials: 'CM', product: 'Peluchito Levi 25cm',
        date: '02 Sep 2026', amount: '$16.800', estado: 'pendiente',
        metodoPago: 'efectivo', stock: 1
      }
    ]
  };

  
  function sumSales(list) {
    return list.reduce(function (acc, sale) {
      if (sale.status === STATUS_ANULADO) return acc;
      return acc + sale.total;
    }, 0);
  }

  
  function hydrateDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const valid = sales.filter(function (sale) { return sale.status !== STATUS_ANULADO; });
    const thisMonth = valid.filter(function (sale) {
      return new Date(sale.soldAt).getTime() >= monthStart.getTime();
    });
    const prevMonth = valid.filter(function (sale) {
      const time = new Date(sale.soldAt).getTime();
      return time >= prevMonthStart.getTime() && time < monthStart.getTime();
    });

    const monthTotal = sumSales(thisMonth);
    const prevTotal = sumSales(prevMonth);
    const growth = prevTotal > 0 ? ((monthTotal - prevTotal) / prevTotal) * 100 : 0;

    
    const kpiRevenue = dashboardData.kpis[0];
    kpiRevenue.value = money(monthTotal);
    kpiRevenue.growth = (growth >= 0 ? '+' : '-')
      + Math.abs(growth).toFixed(1).replace('.', ',') + '%';
    kpiRevenue.growthType = growth >= 0 ? 'positive' : 'negative';
    kpiRevenue.subtitle = thisMonth.length + ' ventas en el mes';

    
    const kpiOrders = dashboardData.kpis[1];
    kpiOrders.value = String(valid.filter(function (sale) {
      return sale.status === STATUS_PENDIENTE || sale.status === STATUS_ENVIADO;
    }).length);
    kpiOrders.subtitle = 'pendientes + enviados';

    
    const kpiStock = dashboardData.kpis[2];
    const lowStock = products.filter(function (p) { return p.stock < 3; });
    kpiStock.value = String(lowStock.length);
    kpiStock.growth = String(products.length) + ' productos';
    kpiStock.growthType = 'neutral';
    kpiStock.subtitle = 'con stock < 3';

    
    const kpiCustomers = dashboardData.kpis[3];
    kpiCustomers.value = String(customers.length);
    kpiCustomers.growth = '+' + customers.filter(function (customer) {
      return new Date(customer.createdAt).getTime() >= monthStart.getTime();
    }).length + ' este mes';
    kpiCustomers.growthType = 'positive';
    kpiCustomers.subtitle = 'en la base de clientes';

    
    dashboardData.recentSales = valid.slice()
      .sort(function (a, b) { return new Date(b.soldAt) - new Date(a.soldAt); })
      .slice(0, 5)
      .map(function (sale) {
        const firstProduct = findProduct(sale.items[0].productId);
        return {
          customer: sale.customer.name,
          initials: sale.customer.initials,
          product: sale.items.map(function (item) { return item.name; }).join(' + '),
          date: dateLabel(sale.soldAt),
          amount: money(sale.total),
          estado: sale.status.toLowerCase(),
          metodoPago: sale.paymentMethod.toLowerCase(),
          stock: firstProduct ? firstProduct.stock : 0
        };
      });
  }

  
  async function fetchDashboardData() {
    if (API_BASE !== null) {
      const res = await fetch(API_BASE + '/api/dashboard', {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) {
        throw new Error('La API respondio ' + res.status + ' ' + res.statusText);
      }
      return res.json();
    }

    
    hydrateDashboard();
    await delay();
    return clone(dashboardData);
  }

  
  function resetDemo() {
    try {
      global.localStorage.removeItem(RECEIPT_COUNTER_KEY);
    } catch (err) {  }
    global.location.reload();
  }

  
  const AnimeStockData = {
    apiBase: API_BASE,
    receiptCounterKey: RECEIPT_COUNTER_KEY,

    dashboardData: dashboardData,
    fetchDashboardData: fetchDashboardData,

    products: products,
    customers: customers,
    sales: sales,
    cashMovements: cashMovements,

    fetchSales: fetchSales,
    fetchSaleById: fetchSaleById,
    createSale: createSale,
    updateSale: updateSale,
    cancelSale: cancelSale,

    fetchProducts: fetchProducts,
    fetchProductById: fetchProductById,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    uploadProductImage: uploadProductImage,
    deleteProductImage: deleteProductImage,

    fetchCategories: fetchCategories,
    createCategory: createCategory,

    fetchCustomers: fetchCustomers,
    createCustomer: createCustomer,

    fetchCashMovements: fetchCashMovements,
    createCashMovement: createCashMovement,

    fetchReports: fetchReports,

    onDataChange: onDataChange,
    emitDataChange: emitDataChange,

    constants: {
      STATUSES: STATUSES,
      PAYMENTS: PAYMENTS,
      RANGES: RANGES,
      STATUS_PAGADO: STATUS_PAGADO,
      STATUS_PENDIENTE: STATUS_PENDIENTE,
      STATUS_ENVIADO: STATUS_ENVIADO,
      STATUS_ANULADO: STATUS_ANULADO,
      PAYMENT_EFECTIVO: PAYMENT_EFECTIVO,
      PAYMENT_TRANSFERENCIA: PAYMENT_TRANSFERENCIA,
      PAYMENT_MERCADOPAGO: PAYMENT_MERCADOPAGO,
      PAYMENT_PAYPAL: PAYMENT_PAYPAL,
      PAYMENT_OTRO: PAYMENT_OTRO
    },
    helpers: {
      normalizeStatus: normalizeStatus,
      normalizePayment: normalizePayment,
      parseReceiptNumber: parseReceiptNumber,
      initialsOf: initialsOf,
      dateLabel: dateLabel,
      money: money
    },
    resetDemo: resetDemo
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimeStockData;           
  }
  global.AnimeStockData = AnimeStockData;        

})(typeof window !== 'undefined' ? window : globalThis);

function parseDate(s) {
  if (!s) return new Date();
  var d = new Date(s);
  if (isNaN(d.getTime())) {
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(m[1], m[2]-1, m[3]);
  }
  return d;
}

function formatDateISO(d) {
  var y = d.getFullYear();
  var mo = String(d.getMonth()+1).padStart(2,'0');
  var da = String(d.getDate()).padStart(2,'0');
  return y + '-' + mo + '-' + da;
}

function startOfDay(d) { var x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { var x=new Date(d); x.setHours(23,59,59,999); return x; }
function startOfMonth(d){ var x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d){ var x=new Date(d.getFullYear(), d.getMonth()+1, 0); x.setHours(23,59,59,999); return x; }
function addMonths(d,n){ var x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function monthLabel(d){ var names=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return names[d.getMonth()] + ' ' + d.getFullYear(); }
function isValidRange(f,t){ if (!f||!t) return false; return f<=t; }
function normalizePayment(m) {
  if (!m) return null;
  var s = String(m).trim().toLowerCase();
  if (s === 'mercadopago' || s === 'mercado_pago') return 'mercadopago';
  if (s === 'transferencia' || s === 'transfer') return 'transferencia';
  if (s === 'efectivo' || s === 'cash') return 'efectivo';
  if (s === 'paypal') return 'paypal';
  if (s === 'otro' || s === 'other') return 'otro';
  return s;
}

function productById(id) {
  for (var i=0;i<products.length;i++) { if (products[i].id === id) return products[i]; }
  return null;
}

function customerById(id) {
  for (var i=0;i<customers.length;i++) { if (customers[i].id === id) return customers[i]; }
  return null;
}
async function fetchReports(opts) {
  if (!opts) opts = {};

  
  
  var reportsGlobal = (typeof window !== 'undefined' ? window : globalThis).AnimeStockData;
  if (reportsGlobal && reportsGlobal.apiBase !== null && reportsGlobal.apiBase !== undefined) {
    var params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    var res = await fetch(reportsGlobal.apiBase + '/api/reports?' + params.toString());
    if (!res.ok) {
      var message = 'La API respondio ' + res.status;
      try {
        var errBody = await res.clone().json();
        if (errBody && typeof errBody.message === 'string' && errBody.message) message = errBody.message;
      } catch (err) {  }
      throw new Error(message);
    }
    return res.json();
  }

  var now = new Date();
  var to = opts.to ? parseDate(opts.to) : endOfDay(now);
  var from = opts.from ? parseDate(opts.from) : startOfMonth(now);
  if (!isValidRange(from,to)) {
    var tmp = from; from = to; to = tmp;
  }
  var groupBy = opts.groupBy || 'month';

  var prevFrom = addMonths(from, -1);
  var prevTo = addMonths(to, -1);

  var incomeStatuses = [STATUS_PAGADO, STATUS_ENVIADO];
  function inRange(d, f, t) { var x=startOfDay(d); return x>=startOfDay(f) && x<=endOfDay(t); }

  var list = [];
  for (var i=0;i<sales.length;i++) {
    var s = sales[i];
    if (s.status === STATUS_ANULADO) continue;
    var sd = parseDate(s.soldAt||s.date||s.createdAt);
    if (inRange(sd, from, to)) list.push(s);
  }
  list.sort(function(a,b){ var da=parseDate(a.soldAt||a.date); var db=parseDate(b.soldAt||b.date); return da-db; });

  var listPrev = [];
  for (var i=0;i<sales.length;i++) {
    var s = sales[i];
    if (s.status === STATUS_ANULADO) continue;
    var sd = parseDate(s.soldAt||s.date||s.createdAt);
    if (inRange(sd, prevFrom, prevTo)) listPrev.push(s);
  }

  var revenue = 0, profit = 0, count = 0;
  for (var i=0;i<list.length;i++) {
    var s = list[i];
    if (incomeStatuses.indexOf(s.status) === -1) continue;
    revenue += s.total || 0;
    count++;
    var items = s.items||[];
    for (var j=0;j<items.length;j++) {
      var it = items[j];
      var p = productById(it.productId);
      var cost = (it.unitCost !== undefined && it.unitCost !== null) ? it.unitCost : (p ? (p.cost||0) : 0);
      var qty = it.quantity||0;
      var up = it.unitPrice||0;
      profit += (up - cost)*qty;
    }
  }

  var revenuePrev = 0, countPrev = 0;
  for (var i=0;i<listPrev.length;i++) {
    var s = listPrev[i];
    if (incomeStatuses.indexOf(s.status) === -1) continue;
    revenuePrev += s.total || 0;
    countPrev++;
  }
  var profitPrev = 0;
  for (var i=0;i<listPrev.length;i++) {
    var s = listPrev[i];
    if (incomeStatuses.indexOf(s.status) === -1) continue;
    var items = s.items||[];
    for (var j=0;j<items.length;j++) {
      var it = items[j];
      var p = productById(it.productId);
      var cost = (it.unitCost!==undefined&&it.unitCost!==null)?it.unitCost:(p?(p.cost||0):0);
      var qty=it.quantity||0; var up=it.unitPrice||0;
      profitPrev += (up-cost)*qty;
    }
  }

  var avgTicket = count ? Math.round(revenue/count) : 0;
  var avgTicketPrev = countPrev ? Math.round(revenuePrev/countPrev) : 0;
  var margin = revenue ? (profit/revenue)*100 : 0;
  var marginPrev = revenuePrev ? (profitPrev/revenuePrev)*100 : 0;

  function pct(a,b){ if (b===0) return a===0?0:100; return (a-b)/b*100; }

  var kpis = {
    revenue: revenue,
    profit: profit,
    avgTicket: avgTicket,
    margin: margin,
    deltas: {
      revenue: pct(revenue,revenuePrev),
      profit: pct(profit,profitPrev),
      avgTicket: pct(avgTicket,avgTicketPrev),
      margin: pct(margin,marginPrev)
    }
  };
  
  var profitByMonth = [];
  var base = new Date(to.getFullYear(), to.getMonth(), 1);
  for (var m=-11; m<=0; m++) {
    var d0 = addMonths(base, m);
    var df = startOfMonth(d0), dt = endOfMonth(d0);
    var cst=0, prf=0;
    for (var i=0;i<sales.length;i++) {
      var s=sales[i]; if (s.status===STATUS_ANULADO) continue;
      var sd=parseDate(s.soldAt||s.date||s.createdAt);
      if (sd<df||sd>dt) continue;
      if (incomeStatuses.indexOf(s.status)===-1) continue;
      var items=s.items||[];
      for (var j=0;j<items.length;j++) {
        var it=items[j]; var p=productById(it.productId);
        var cost=(it.unitCost!==undefined&&it.unitCost!==null)?it.unitCost:(p?(p.cost||0):0);
        var qty=it.quantity||0, up=it.unitPrice||0;
        cst += cost*qty; prf += (up-cost)*qty;
      }
    }
    profitByMonth.push({ label: monthLabel(d0).replace(/\s\d{4}$/,'').trim(), year:d0.getFullYear(), month:d0.getMonth(), cost:cst, profit:prf });
  }

  
  var mapProd = {};
  for (var i=0;i<list.length;i++) {
    var s=list[i]; if (incomeStatuses.indexOf(s.status)===-1) continue;
    var items=s.items||[];
    for (var j=0;j<items.length;j++) {
      var it=items[j]; var pid=it.productId||('x'+j); var p=productById(pid);
      if (!mapProd[pid]) {
        mapProd[pid] = { productId:pid, name:p?p.name:'Producto', anime:p?p.anime:'', units:0, revenue:0, imageUrl:p?p.imageUrl:'' };
      }
      mapProd[pid].units += (it.quantity||0);
      mapProd[pid].revenue += (it.quantity||0)*(it.unitPrice||0);
    }
  }
  var topProducts = Object.values ? Object.values(mapProd) : (function(){var r=[]; for(var k in mapProd) if(mapProd.hasOwnProperty(k)) r.push(mapProd[k]); return r;})();
  topProducts.sort(function(a,b){ if(b.units!==a.units) return b.units-a.units; return b.revenue-a.revenue; });
  topProducts = topProducts.slice(0,5);
  
  var mapCust = {};
  for (var i=0;i<list.length;i++) {
    var s=list[i]; if (incomeStatuses.indexOf(s.status)===-1) continue;
    var cid=s.customerId||('anon'); var c=customerById(cid);
    if (!mapCust[cid]) {
      mapCust[cid] = { customerId:cid, name:(s.customer&&s.customer.name)?s.customer.name:(c?c.name:'Consumidor final'), purchases:0, total:0, lastPurchase:null };
    }
    mapCust[cid].purchases++;
    mapCust[cid].total += s.total||0;
    var sd=parseDate(s.soldAt||s.date);
    if (!mapCust[cid].lastPurchase || sd>mapCust[cid].lastPurchase) mapCust[cid].lastPurchase = sd;
  }
  var topCustomers = Object.values ? Object.values(mapCust) : (function(){var r=[]; for(var k in mapCust) if(mapCust.hasOwnProperty(k)) r.push(mapCust[k]); return r;})();
  topCustomers.sort(function(a,b){ if(b.total!==a.total) return b.total-a.total; return b.purchases-a.purchases; });
  topCustomers = topCustomers.slice(0,5);
  for (var i=0;i<topCustomers.length;i++) topCustomers[i].avgTicket = topCustomers[i].purchases ? Math.round(topCustomers[i].total/topCustomers[i].purchases) : 0;

  
  var mapPay={};
  var payTotal=0;
  for (var i=0;i<list.length;i++) {
    var s=list[i]; if (incomeStatuses.indexOf(s.status)===-1) continue; payTotal += s.total||0;
    var m=normalizePayment(s.paymentMethod||s.payment);
    if (!m) m='otro';
    if (!mapPay[m]) mapPay[m]={method:m,count:0,total:0};
    mapPay[m].count++; mapPay[m].total += s.total||0;
  }
  var byPaymentMethod = Object.values ? Object.values(mapPay) : (function(){var r=[]; for(var k in mapPay) if(mapPay.hasOwnProperty(k)) r.push(mapPay[k]); return r;})();
  byPaymentMethod.forEach(function(x){ x.percentage = payTotal ? (x.total/payTotal)*100 : 0; });
  byPaymentMethod.sort(function(a,b){ return b.total-a.total; });
  
  var lowStock=[];
  for (var i=0;i<products.length;i++) { var p=products[i]; if ((p.stock||0)<3 && p.active!==false) lowStock.push({productId:p.id,name:p.name,anime:p.anime,stock:p.stock||0,price:p.price||0}); }
  lowStock.sort(function(a,b){ if(a.stock!==b.stock) return a.stock-b.stock; return a.name.localeCompare(b.name); });

  
  var incomeCM=0, expenseCM=0;
  for (var i=0;i<cashMovements.length;i++) {
    var cm=cashMovements[i]; var cd=parseDate(cm.occurredAt||cm.date);
    if (cd<startOfDay(from)||cd>endOfDay(to)) continue;
    if (cm.type==='INGRESO') incomeCM += cm.amount||0; else expenseCM += cm.amount||0;
  }
  var daily=[];
  if (list.length>0 || cashMovements.length>0) {
    var cur=new Date(from); var bal=0;
    while (cur<=to) {
      for (var i=0;i<cashMovements.length;i++) {
        var cm=cashMovements[i]; var cd=parseDate(cm.occurredAt||cm.date);
        if (cd>=startOfDay(cur)&&cd<=endOfDay(cur)) { if (cm.type==='INGRESO') bal += cm.amount||0; else bal -= cm.amount||0; }
      }
      daily.push({date: formatDateISO(cur), balance: Math.round(bal)});
      cur = addDays(cur,1);
    }
  }

  return Promise.resolve({
    from: formatDateISO(from),
    to: formatDateISO(to),
    kpis: kpis,
    profitByMonth: profitByMonth,
    topProducts: topProducts,
    topCustomers: topCustomers,
    byPaymentMethod: byPaymentMethod,
    lowStock: lowStock,
    cashFlow: { income: incomeCM, expense: expenseCM, net: incomeCM-expenseCM, daily: daily },
    sales: list
  });
}
