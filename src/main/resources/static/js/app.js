
(function () {
  'use strict';

  const page = document.body.dataset.page || 'dashboard';

  
  const sidebar    = document.getElementById('sidebar');
  const scrim      = document.getElementById('sidebarScrim');
  const menuToggle = document.getElementById('menuToggle');

  function isMobile() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('is-open');
    if (scrim) scrim.hidden = false;
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    if (scrim) scrim.hidden = true;
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    if (!sidebar) return;
    if (sidebar.classList.contains('is-open')) closeSidebar();
    else openSidebar();
  }

  
  async function initDashboard() {
    const loading = document.getElementById('dashboardLoading');
    const content = document.getElementById('dashboardContent');

    try {
      
      
      const data = await window.AnimeStockData.fetchDashboardData();
      if (window.AnimeStockDashboard) window.AnimeStockDashboard.renderDashboard(data);
      if (content) content.hidden = false;
      if (loading) loading.hidden = true;
    } catch (error) {
      console.error('[AnimeStock] No se pudo cargar el dashboard:', error);
      if (loading) {
        loading.textContent = 'No se pudo cargar el panel. Revisá la conexión e intentá de nuevo.';
      }
    }
  }

  
  let checkoutReady = false;

  function openCheckout() {
    const checkout = window.AnimeStockCheckout;
    if (!checkout) return;
    if (!checkoutReady) {
      checkout.init();
      checkoutReady = true;
    }
    checkout.open();
  }

  
  function mount(module) {
    if (module && typeof module.show === 'function') module.show();
  }

  const PAGE_INIT = {
    dashboard:     initDashboard,
    inventario:    () => mount(window.AnimeStockInventory),
    proveedores:   () => mount(window.AnimeStockSuppliers),
    ventas:        () => mount(window.AnimeStockSales),
    pedidos:       () => mount(window.AnimeStockOrders),
    caja:          () => mount(window.AnimeStockCash),
    reports:       () => mount(window.AnimeStockReports),
    configuracion: () => mount(window.AnimeStockSettings)
  };

  
  function init() {
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
    if (scrim) scrim.addEventListener('click', closeSidebar);

    const topbarNewSale = document.getElementById('newSaleBtn');
    if (topbarNewSale) topbarNewSale.addEventListener('click', openCheckout);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSidebar();
    });

    
    const nav = document.querySelector('.nav');
    if (nav) {
      nav.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const items = Array.from(nav.querySelectorAll('.nav__item'));
        const current = items.indexOf(document.activeElement);
        if (current === -1) return;
        event.preventDefault();
        const next = event.key === 'ArrowDown'
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
        items[next].focus();
      });
    }

    
    const run = PAGE_INIT[page];
    if (run) run();

    
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
