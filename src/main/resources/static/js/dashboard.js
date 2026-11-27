
(function (global) {
  'use strict';

  

  
  const nfInt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  
  const nfDec = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  
  function formatCurrency(value) {
    return '$' + nfInt.format(Number(value) || 0);
  }

  
  function formatNumber(value) {
    return nfInt.format(Number(value) || 0);
  }

  
  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  

  
  const KPI_ICONS = {
    'mdi-cart-outline': '🛒',
    'mdi-package-variant-closed': '📦',
    'mdi-alert-outline': '⚠️',
    'mdi-account-group-outline': '👥'
  };

  
  function iconOf(kpi) {
    const raw = kpi.icon || '';
    return KPI_ICONS[raw] || raw || '📦';
  }

  
  function kpiValueText(kpi) {
    return typeof kpi.value === 'string' ? kpi.value : formatNumber(kpi.value);
  }

  
  function kpiGrowthText(kpi) {
    if (typeof kpi.growth === 'string') return kpi.growth;
    return `${nfDec.format(Math.abs(Number(kpi.delta) || 0))}%`;
  }

  
  function isPositiveGrowth(kpi) {
    if (kpi.growthType) return kpi.growthType === 'positive';
    return Number(kpi.growth ?? kpi.delta ?? 0) >= 0;
  }

  
  function customerName(sale) {
    if (typeof sale.customer === 'string') return sale.customer;
    return sale.customer?.name || 'Cliente';
  }

  
  function customerInitials(sale) {
    if (sale.initials) return sale.initials;
    return sale.customer?.initials || '??';
  }

  
  function dateText(sale) {
    return typeof sale.date === 'string' && sale.date.includes(' ')
      ? sale.date
      : formatDate(sale.date);
  }

  
  function amountText(sale) {
    return typeof sale.amount === 'string' ? sale.amount : formatCurrency(sale.amount);
  }

  
  function paymentKey(sale) {
    return String(sale.metodoPago ?? sale.payment ?? 'otro').toLowerCase();
  }

  
  function statusKey(sale) {
    return String(sale.estado ?? sale.status ?? 'pendiente').toLowerCase();
  }

  
  function renderKpis(container, kpis = []) {
    container.textContent = '';

    kpis.forEach((kpi, i) => {
      const positive = isPositiveGrowth(kpi);
      
      const arrow = positive ? '▲' : '▼';

      const card = document.createElement('article');
      card.className = 'kpi';
      card.setAttribute('role', 'listitem');
      
      card.style.setProperty('--i', String(i));

      card.innerHTML = `
        <div class="kpi__top">
          <div>
            <p class="kpi__title"></p>
          </div>
          <div class="kpi__icon" aria-hidden="true"></div>
        </div>
        <p class="kpi__value"></p>
        <div class="kpi__foot">
          <span class="chip ${positive ? 'chip--up' : 'chip--down'}">
            <span aria-hidden="true">${arrow}</span>
            <span class="chip__value"></span>
          </span>
          <span class="kpi__sub"></span>
        </div>
      `;

      
      card.querySelector('.kpi__title').textContent = kpi.title || '';
      card.querySelector('.kpi__icon').textContent = iconOf(kpi);
      card.querySelector('.kpi__value').textContent = kpiValueText(kpi);
      card.querySelector('.chip__value').textContent = kpiGrowthText(kpi);
      card.querySelector('.kpi__sub').textContent = kpi.subtitle || kpi.comparisonLabel || '';

      
      if (kpi.color) card.style.setProperty('--kpi-color', kpi.color);

      container.appendChild(card);
    });
  }

  

  
  function createPaymentChip(method) {
    const key = String(method || 'otro').toLowerCase();
    const span = document.createElement('span');
    span.className = `pay pay--${key}`;
    span.textContent = key;
    return span;
  }

  
  function createStatusBadge(status) {
    const key = String(status || 'pendiente').toLowerCase();
    const span = document.createElement('span');
    span.className = `badge badge--${key}`;
    span.innerHTML = '<span class="badge__dot" aria-hidden="true"></span>';
    span.appendChild(document.createTextNode(key));
    return span;
  }

  
  function createStockIndicator(stock) {
    const n = Number(stock) || 0;
    const level = n <= 2 ? 'low' : n <= 6 ? 'mid' : 'ok';
    const pct = Math.min((n / 20) * 100, 100);

    const wrap = document.createElement('span');
    wrap.className = `stock stock--${level}`;

    const bar = document.createElement('span');
    bar.className = 'stock__bar';
    bar.setAttribute('aria-hidden', 'true');

    const fill = document.createElement('span');
    fill.className = 'stock__fill';
    fill.style.width = `${pct}%`;

    bar.appendChild(fill);

    const num = document.createElement('span');
    num.textContent = String(n);

    wrap.append(bar, num);
    wrap.setAttribute('aria-label', `Stock: ${n} unidades`);
    return wrap;
  }

  
  function renderSalesTable(tbody, sales = []) {
    tbody.textContent = '';

    sales.forEach((sale) => {
      const tr = document.createElement('tr');

      
      const tdCustomer = document.createElement('td');
      const user = document.createElement('div');
      user.className = 'cell-user';

      const avatar = document.createElement('span');
      avatar.className = 'cell-user__avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = customerInitials(sale);

      const name = document.createElement('span');
      name.className = 'cell-user__name';
      name.textContent = customerName(sale);

      user.append(avatar, name);
      tdCustomer.appendChild(user);

      
      const tdProduct = document.createElement('td');
      tdProduct.className = 'table__product';
      tdProduct.textContent = sale.product || '';

      
      const tdDate = document.createElement('td');
      tdDate.className = 'table__date';
      tdDate.textContent = dateText(sale);

      
      const tdPay = document.createElement('td');
      tdPay.appendChild(createPaymentChip(paymentKey(sale)));

      
      const tdStock = document.createElement('td');
      tdStock.appendChild(createStockIndicator(sale.stock));

      
      const tdAmount = document.createElement('td');
      tdAmount.className = 'table__num';
      tdAmount.textContent = amountText(sale);

      
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(createStatusBadge(statusKey(sale)));

      tr.append(tdCustomer, tdProduct, tdDate, tdPay, tdStock, tdAmount, tdStatus);
      tbody.appendChild(tr);
    });
  }

  
  function renderDashboard(data) {
    const monthly = data.monthlyRevenue || [];
    const categories = data.categorySales || [];

    
    const kpiGrid = document.getElementById('kpiGrid');
    renderKpis(kpiGrid, data.kpis || []);

    
    
    const total = monthly.reduce((acc, m) => acc + (Number(m.value) || 0), 0);
    const subtitle = document.getElementById('chartRevenueSubtitle');
    if (subtitle) {
      subtitle.textContent = `Total del año · ${formatCurrency(total)}`;
    }
    global.AnimeStockCharts.areaChart(
      document.getElementById('revenueChart'),
      monthly,
      { ariaLabel: 'Ingresos mensuales en pesos' }
    );

    
    global.AnimeStockCharts.donutChart(
      document.getElementById('categoryChart'),
      categories,
      { ariaLabel: 'Ventas por categoría' }
    );

    
    renderSalesTable(document.getElementById('salesTableBody'), data.recentSales || []);

    
    const loading = document.getElementById('dashboardLoading');
    const content = document.getElementById('dashboardContent');
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }

  
  global.AnimeStockDashboard = {
    renderDashboard,
    
    renderKpis,
    renderSalesTable,
    createPaymentChip,
    createStatusBadge,
    createStockIndicator,
    formatters: { formatCurrency, formatNumber, formatDate },
    
    readers: {
      iconOf,
      kpiValueText,
      kpiGrowthText,
      isPositiveGrowth,
      customerName,
      customerInitials,
      dateText,
      amountText,
      paymentKey,
      statusKey
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);