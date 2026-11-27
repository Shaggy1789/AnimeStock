
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  

  
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const key in attrs) {
      if (attrs[key] !== null && attrs[key] !== undefined) {
        el.setAttribute(key, String(attrs[key]));
      }
    }
    return el;
  }

  
  const r2 = (n) => Math.round(n * 100) / 100;

  
  function shortMoney(n) {
    if (n === 0) return '$0';
    if (Math.abs(n) >= 1000) {
      const k = n / 1000;
      
      return '$' + (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
    }
    return '$' + n;
  }

  
  function smoothPath(points, tension = 0.32) {
    if (points.length === 0) return '';
    if (points.length < 3) {
      
      return 'M' + points.map((p) => `${r2(p.x)} ${r2(p.y)}`).join(' L');
    }

    let d = `M${r2(points[0].x)} ${r2(points[0].y)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * (tension * 2);
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * (tension * 2);
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * (tension * 2);
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * (tension * 2);

      d += ` C${r2(cp1x)} ${r2(cp1y)}, ${r2(cp2x)} ${r2(cp2y)}, ${r2(p2.x)} ${r2(p2.y)}`;
    }
    return d;
  }

  
  function areaChart(container, data, options = {}) {
    const o = {
      width: 680,
      height: 260,
      padL: 56,
      padR: 22,
      padT: 22,
      padB: 36,
      ticks: 5,
      formatValue: options.formatValue || ((v) => shortMoney(v)),
      ...options
    };

    container.textContent = '';

    const { width: W, height: H, padL, padR, padT, padB } = o;
    const innerW = W - padL - padR;      
    const innerH = H - padT - padB;      

    const values = data.map((d) => Number(d.value) || 0);
    const rawMax = Math.max(...values, 0);
    
    const stepGuess = rawMax > 0 ? rawMax / (o.ticks - 1) : 1;
    const niceStep = niceCeil(stepGuess);
    const maxY = niceStep * (o.ticks - 1);
    const scaleY = (v) => padT + innerH - (v / maxY) * innerH;
    const scaleX = (i) => padL + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));

    const svg = svgEl('svg', {
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      'aria-label': o.ariaLabel || 'Gráfico de ingresos mensuales',
      preserveAspectRatio: 'xMidYMid meet'
    });

    
    const defs = svgEl('defs');
    const gradId = 'areaGrad';

    
    const areaGrad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    areaGrad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': '#b8a4d9', 'stop-opacity': '.45' }));
    areaGrad.appendChild(svgEl('stop', { offset: '60%',  'stop-color': '#c9b6e6', 'stop-opacity': '.16' }));
    areaGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#f7b7c8', 'stop-opacity': '0' }));

    
    const lineGrad = svgEl('linearGradient', { id: 'lineGrad', x1: '0', y1: '0', x2: '1', y2: '0' });
    lineGrad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': '#8a6fb8' }));
    lineGrad.appendChild(svgEl('stop', { offset: '55%',  'stop-color': '#b8a4d9' }));
    lineGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#e89aae' }));

    
    const filter = svgEl('filter', {
      id: 'lineGlow', x: '-20%', y: '-40%', width: '140%', height: '180%'
    });
    filter.appendChild(svgEl('feDropShadow', {
      dx: '0', dy: '3', stdDeviation: '4',
      'flood-color': '#b8a4d9', 'flood-opacity': '.45'
    }));

    defs.appendChild(areaGrad);
    defs.appendChild(lineGrad);
    defs.appendChild(filter);
    svg.appendChild(defs);

    
    const gridGroup = svgEl('g', { class: 'chart-grid' });
    for (let t = 0; t < o.ticks; t++) {
      const value = (niceStep * t);
      const y = scaleY(value);

      gridGroup.appendChild(svgEl('line', {
        x1: padL, y1: y, x2: W - padR, y2: y,
        stroke: 'rgba(184,164,217,.28)',
        'stroke-width': '1',
        'stroke-dasharray': '3 5',
        'stroke-linecap': 'round'
      }));

      const label = svgEl('text', {
        x: padL - 12,
        y: y + 4,
        'text-anchor': 'end',
        fill: '#8a7fa0',
        'font-size': '11',
        'font-weight': '600',
        'font-family': 'inherit'
      });
      label.textContent = o.formatValue(value);
      gridGroup.appendChild(label);
    }
    svg.appendChild(gridGroup);

    
    const points = data.map((d, i) => ({
      x: r2(scaleX(i)),
      y: r2(scaleY(Number(d.value) || 0)),
      cx: scaleX(i),
      cy: scaleY(Number(d.value) || 0),
      data: d,
      index: i
    }));

    const lineD = smoothPath(points);
    const areaD = `${lineD} L ${r2(points[points.length - 1].x)} ${r2(padT + innerH)} L ${r2(points[0].x)} ${r2(padT + innerH)} Z`;

    
    const area = svgEl('path', {
      d: areaD,
      fill: `url(#${gradId})`,
      opacity: '0',
      class: 'chart-area'
    });
    svg.appendChild(area);

    
    const line = svgEl('path', {
      d: lineD,
      fill: 'none',
      stroke: 'url(#lineGrad)',
      'stroke-width': '3',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      filter: 'url(#lineGlow)',
      class: 'chart-line'
    });
    svg.appendChild(line);

    
    const xGroup = svgEl('g');
    points.forEach((p) => {
      const t = svgEl('text', {
        x: p.cx,
        y: H - padB + 20,
        'text-anchor': 'middle',
        fill: '#8a7fa0',
        'font-size': '11',
        'font-weight': '600',
        'font-family': 'inherit'
      });
      t.textContent = p.data.label;
      xGroup.appendChild(t);
    });
    svg.appendChild(xGroup);

    
    const dotsGroup = svgEl('g');
    const hitGroup = svgEl('g');

    points.forEach((p) => {
      
      const g = svgEl('g', { class: 'chart-dot', style: 'transform-origin: center;' });

      g.appendChild(svgEl('circle', {
        cx: p.cx, cy: p.cy, r: 6,
        fill: '#ffffff', opacity: '.95',
        stroke: '#b8a4d9', 'stroke-width': '2.5'
      }));

      
      hitGroup.appendChild(svgEl('circle', {
        cx: p.cx, cy: p.cy, r: 18,
        fill: 'transparent',
        class: 'chart-hit',
        tabindex: '0',
        role: 'button',
        'aria-label': `${p.data.label}: ${o.formatValue(p.data.value)}`
      }));

      dotsGroup.appendChild(g);
    });

    svg.appendChild(dotsGroup);
    svg.appendChild(hitGroup);
    container.appendChild(svg);

    
    requestAnimationFrame(() => {
      const len = line.getTotalLength ? line.getTotalLength() : 1400;
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len);
      line.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.65,0,.35,1)';
      line.getBoundingClientRect();               
      line.style.strokeDashoffset = '0';

      area.style.transition = 'opacity .7s ease .25s';
      area.style.opacity = '1';
    });

    
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    container.appendChild(tip);

    const hits = Array.from(hitGroup.querySelectorAll('.chart-hit'));
    hits.forEach((hit, i) => {
      const p = points[i];
      if (!p) return;

      const show = () => {
        
        tip.textContent = `${p.data.label} · ${o.formatValue(p.data.value)}`;
        tip.style.left = `${(p.cx / W) * 100}%`;
        tip.style.top = `${(p.cy / H) * 100}%`;
        tip.classList.add('is-visible');

        
        const dot = dotsGroup.children[i];
        if (dot) {
          dot.style.transition = 'transform .16s ease';
          dot.style.transformBox = 'fill-box';
          dot.style.transformOrigin = 'center';
          dot.style.transform = 'scale(1.45)';
        }
      };

      const hide = () => {
        tip.classList.remove('is-visible');
        const dot = dotsGroup.children[i];
        if (dot) dot.style.transform = 'scale(1)';
      };

      hit.addEventListener('mouseenter', show);
      hit.addEventListener('mouseleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
    });
  }

  
  function niceCeil(n) {
    if (!isFinite(n) || n <= 0) return 1;
    const exp = Math.floor(Math.log10(n));
    const base = Math.pow(10, exp);
    const norm = n / base;
    const step =
      norm <= 1   ? 1   :
      norm <= 2   ? 2   :
      norm <= 2.5 ? 2.5 :
      norm <= 3.5 ? 3.5 :
      norm <= 5   ? 5   : 10;
    return step * base;
  }

  
  function donutChart(container, data, options = {}) {
    const o = {
      size: 190,
      radius: 64,
      thickness: 22,
      centerValue: '100%',
      centerLabel: 'Total',
      ...options
    };

    container.textContent = '';

    const cx = o.size / 2;
    const cy = o.size / 2;
    const r = o.radius;
    const circumference = 2 * Math.PI * r;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${o.size} ${o.size}`,
      role: 'img',
      'aria-label': o.ariaLabel || 'Gráfico de ventas por categoría'
    });

    
    
    const gap = 3;
    let offset = 0;

    
    
    
    const pctOf = (slice) => Number(slice.value ?? slice.percent) || 0;

    const total = data.reduce((acc, d) => acc + pctOf(d), 0) || 100;

    data.forEach((slice, i) => {
      const pct = pctOf(slice) / total;   
      const len = Math.max(pct * circumference - gap, 0.5);

      const seg = svgEl('circle', {
        cx: cx, cy: cy, r: r,
        fill: 'none',
        stroke: slice.color || '#b8a4d9',
        'stroke-width': o.thickness,
        
        transform: `rotate(-90 ${cx} ${cy})`,
        'stroke-dasharray': `${len} ${circumference - len}`,
        'stroke-dashoffset': String(-offset),
        'stroke-linecap': 'round',
        class: 'donut-seg',
        style: `transform-origin: ${cx}px ${cy}px; animation: donut-in .5s cubic-bezier(.34,1.4,.64,1) both; animation-delay: ${i * 110}ms;`
      });
      seg.setAttribute('aria-label', `${slice.label}: ${pctOf(slice)}%`);

      offset += pct * circumference;
      svg.appendChild(seg);
    });

    
    const center = svgEl('g', { class: 'donut-center', style: 'pointer-events:none;' });
    const value = svgEl('text', {
      x: cx, y: cy - 1,
      'text-anchor': 'middle',
      class: 'donut-center__value'
    });
    value.textContent = o.centerValue;

    const label = svgEl('text', {
      x: cx, y: cy + 19,
      'text-anchor': 'middle',
      class: 'donut-center__label'
    });
    label.textContent = o.centerLabel;

    center.appendChild(value);
    center.appendChild(label);
    svg.appendChild(center);

    
    const layout = document.createElement('div');
    layout.className = 'donut-layout';

    const chartBox = document.createElement('div');
    chartBox.appendChild(svg);

    const list = document.createElement('ul');
    list.className = 'legend';

    data.forEach((slice) => {
      const li = document.createElement('li');
      li.className = 'legend__item';

      const dot = document.createElement('span');
      dot.className = 'legend__dot';
      dot.style.background = slice.color || '#b8a4d9';

      const name = document.createElement('span');
      name.className = 'legend__label';
      name.textContent = slice.label;

      const pct = document.createElement('span');
      pct.className = 'legend__value';
      pct.textContent = `${pctOf(slice)}%`;

      li.append(dot, name, pct);
      list.appendChild(li);
    });

    layout.append(chartBox, list);
    container.appendChild(layout);

    return circumference;
  }

  
  global.AnimeStockCharts = {
    areaChart,
    donutChart,
    
    helpers: { svgEl, smoothPath, shortMoney, niceCeil }
  };

})(typeof window !== 'undefined' ? window : globalThis);
