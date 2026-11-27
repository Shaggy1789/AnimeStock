
(function (global) {
  'use strict';

  const Data = global.AnimeStockData;
  const UI = global.AnimeStockUI;

  const STORAGE_KEY = 'animestock:settings';

  const DEFAULT_SETTINGS = {
    storeName: 'AnimeStock',
    email: '',
    phone: '',
    address: '',
    currency: 'ARS',
    lowStock: 3,
    tax: 21,
    pageSize: 25,
    showOutOfStock: true
  };

  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let dom = {};
  let bound = false;

  
  function readStored() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (error) {
      console.warn('[AnimeStock] Preferencias ilegibles, se usan las de fábrica.');
      return {};
    }
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('[AnimeStock] No se pudieron guardar las preferencias:', error);
      UI.toast('No se pudieron guardar las preferencias en este navegador', 'error');
      return false;
    }
  }

  
  function cacheDom() {
    dom = {
      form:            document.getElementById('settingsForm'),
      status:          document.getElementById('settingsStatus'),
      saveBtn:         document.getElementById('settingsSave'),
      resetBtn:        document.getElementById('settingsReset'),
      storeName:       document.getElementById('settingsStoreName'),
      email:           document.getElementById('settingsEmail'),
      phone:           document.getElementById('settingsPhone'),
      address:         document.getElementById('settingsAddress'),
      currency:        document.getElementById('settingsCurrency'),
      lowStock:        document.getElementById('settingsLowStock'),
      tax:             document.getElementById('settingsTax'),
      pageSize:        document.getElementById('settingsPageSize'),
      showOutOfStock:  document.getElementById('settingsShowOutOfStock'),
      version:         document.getElementById('settingsVersion'),
      apiBase:         document.getElementById('settingsApiBase')
    };
  }

  function fillForm() {
    if (dom.storeName) dom.storeName.value = settings.storeName;
    if (dom.email) dom.email.value = settings.email;
    if (dom.phone) dom.phone.value = settings.phone;
    if (dom.address) dom.address.value = settings.address;
    if (dom.currency) dom.currency.value = settings.currency;
    if (dom.lowStock) dom.lowStock.value = settings.lowStock;
    if (dom.tax) dom.tax.value = settings.tax;
    if (dom.pageSize) dom.pageSize.value = String(settings.pageSize);
    if (dom.showOutOfStock) dom.showOutOfStock.checked = !!settings.showOutOfStock;
  }

  function fillAbout() {
    if (dom.version) dom.version.textContent = 'AnimeStock 1.0 · panel multipágina';
    if (dom.apiBase) {
      const base = Data && Data.apiBase;
      dom.apiBase.textContent = (base === '' || base === null || base === undefined)
        ? 'API local (mismo origen, /api/…)'
        : String(base);
    }
  }

  function setStatus(text, visible) {
    if (!dom.status) return;
    dom.status.textContent = text || '';
    dom.status.hidden = !visible;
  }

  
  function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function readForm() {
    const storeName = dom.storeName ? dom.storeName.value.trim() : '';
    if (!storeName) return { error: 'El nombre de la tienda es obligatorio.' };

    const email = dom.email ? dom.email.value.trim() : '';
    if (email && email.indexOf('@') === -1) {
      return { error: 'El email no parece válido.' };
    }

    return {
      value: {
        storeName: storeName,
        email: email,
        phone: dom.phone ? dom.phone.value.trim() : '',
        address: dom.address ? dom.address.value.trim() : '',
        currency: dom.currency ? dom.currency.value : 'ARS',
        lowStock: clampInt(dom.lowStock && dom.lowStock.value, 0, 999, DEFAULT_SETTINGS.lowStock),
        tax: clampInt(dom.tax && dom.tax.value, 0, 100, DEFAULT_SETTINGS.tax),
        pageSize: clampInt(dom.pageSize && dom.pageSize.value, 1, 100, DEFAULT_SETTINGS.pageSize),
        showOutOfStock: dom.showOutOfStock ? !!dom.showOutOfStock.checked : true
      }
    };
  }

  
  function save(event) {
    if (event) event.preventDefault();

    const parsed = readForm();
    if (parsed.error) {
      setStatus(parsed.error, true);
      if (dom.storeName) dom.storeName.focus();
      UI.toast(parsed.error, 'error');
      return;
    }

    settings = Object.assign({}, settings, parsed.value);
    if (persist()) {
      setStatus('', false);
      UI.toast('Configuración guardada', 'success');
    }
  }

  async function reset() {
    const confirmed = await UI.confirm({
      title: 'Restablecer configuración',
      message: 'Se vuelven los valores de fábrica. Las preferencias guardadas en este navegador se pierden.',
      confirmText: 'Restablecer',
      danger: true
    });
    if (!confirmed) return;

    settings = Object.assign({}, DEFAULT_SETTINGS);
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      
    }
    fillForm();
    setStatus('', false);
    UI.toast('Configuración restablecida', 'info');
  }

  
  function get() {
    return Object.assign({}, settings);
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    if (dom.form) dom.form.addEventListener('submit', save);
    if (dom.saveBtn) dom.saveBtn.addEventListener('click', save);
    if (dom.resetBtn) dom.resetBtn.addEventListener('click', reset);
  }

  function init() {
    cacheDom();
    settings = Object.assign({}, DEFAULT_SETTINGS, readStored());
    fillForm();
    fillAbout();
    bindEvents();
  }

  function show() {
    init();
  }

  global.AnimeStockSettings = {
    init: init,
    show: show,
    get: get,
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };

})(typeof window !== 'undefined' ? window : globalThis);
