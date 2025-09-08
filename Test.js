/** KorMapChart v2.1 — hover & click interactions added (vanilla JS) */
class KorMapChart {
  // ---------- 유틸 ----------
  static async #loadSVG(url) {
    const res = await fetch(url);
    const txt = await res.text();
    return new DOMParser().parseFromString(txt, 'image/svg+xml').documentElement;
  }
  static #setCss(el, prop, v) {
    if (!el || !prop) return;
    if (v == null) el.style.removeProperty(prop);
    else el.style.setProperty(prop, v);
  }
  static #fmtPct(x) { return (x == null || Number.isNaN(x)) ? '-' : Math.round(x * 100) + '%'; }
  static #fmtInt(n) { return (n == null || Number.isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR'); }
  static #clamp01(v) { const n = Number(v); if (!Number.isFinite(n)) return null; return Math.min(1, Math.max(0, n)); }
  static #makeColorForRate(thresholds, colors) {
    const th = Array.isArray(thresholds) && thresholds.length ? thresholds : [0.8, 0.6, 0.4, 0.2];
    const cs = Array.isArray(colors) && colors.length ? colors : ['#00085A', '#1F48FF', '#79a1ee', '#99d9f2', '#D7D7D7'];
    const fallback = cs.at(-1) ?? '#D7D7D7';
    return (rRaw) => {
      const r = this.#clamp01(rRaw);
      if (r == null) return fallback;
      for (let i = 0; i < th.length; i++) if (r >= th[i]) return cs[i] ?? fallback;
      return fallback;
    };
  }
  static #clearSvgFillStyles(svg) {
    svg.querySelectorAll('style').forEach((s) => { s.textContent = s.textContent.replace(/fill\s*:[^;]+;?/g, ''); });
    svg.querySelectorAll('[fill]').forEach((e) => e.removeAttribute('fill'));
  }
  static #ensureMount(mount) { return (typeof mount === 'string') ? document.querySelector(mount) : mount; }
  static #computeBBox(svg) {
    const paths = svg.querySelectorAll('path');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach((p) => { const b = p.getBBox(); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height); });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2 };
  }
  static #placeRegionLabels(svg, codeMap, labelOpts = {}) {
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(layer);
    const minW = labelOpts.minWidth ?? 16;
    const minH = labelOpts.minHeight ?? 12;
    for (const [name, code] of Object.entries(codeMap || {})) {
      const path = svg.getElementById(code);
      if (!path) continue;
      const b = path.getBBox();
      if (b.width < minW || b.height < minH) continue;
      let cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const off = (labelOpts.offsets && labelOpts.offsets[name]) || [0, 0];
      cx += off[0]; cy += off[1];
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', cx); t.setAttribute('y', cy);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('font-size', labelOpts.fontSize ?? 12);
      t.setAttribute('font-weight', labelOpts.fontWeight ?? 400);
      t.setAttribute('fill', labelOpts.color ?? '#111827');
      t.setAttribute('style', [
        'pointer-events:none', 'paint-order:stroke', 'stroke:#FFFFFF', `stroke-width:${labelOpts.strokeWidth ?? 2.5}px`
      ].join(';'));
      t.textContent = name;
      layer.appendChild(t);
    }
  }
  static #paintRegions(svg, codeMap, dataGetter, colorForRate) {
    for (const [name, code] of Object.entries(codeMap || {})) {
      const path = svg.getElementById(code);
      if (!path) continue;
      const rate = dataGetter(name);
      path.style.setProperty('fill', colorForRate(rate), 'important');
    }
  }

  // ---------- NEW: 인터랙션 바인딩 ----------
  static #enableInteractions(svg, codeMap, data, getRate, interactions = {}) {
    const {
      hoverStroke = '#111827',
      hoverStrokeWidth = 2,
      hoverOpacity = 0.95,
      cursor = 'pointer',
      raiseOnHover = true,
      onRegionEnter,
      onRegionLeave,
      onRegionClick,
    } = interactions || {};

    for (const [name, code] of Object.entries(codeMap || {})) {
      const path = svg.getElementById(code);
      if (!path) continue;

      // 접근성 & 커서
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', name);
      path.style.cursor = cursor;
      path.style.transition = 'stroke 120ms ease, stroke-width 120ms ease, opacity 120ms ease';

      // 원복용 기존 스타일 저장
      if (!path.dataset.baseStroke) path.dataset.baseStroke = path.style.stroke || '';
      if (!path.dataset.baseStrokeWidth) path.dataset.baseStrokeWidth = path.style.strokeWidth || '';
      if (!path.dataset.baseOpacity) path.dataset.baseOpacity = path.style.opacity || '';

      const datum = data?.[name];
      const ctx = (ev) => ({
        name, code, el: path, event: ev,
        data: datum,
        rate: (typeof datum === 'number') ? datum : datum?.rate,
        bbox: path.getBBox(),
      });

      const enter = (ev) => {
        // 시각 효과
        path.style.stroke = hoverStroke;
        path.style.strokeWidth = String(hoverStrokeWidth);
        if (hoverOpacity != null) path.style.opacity = String(hoverOpacity);
        if (raiseOnHover && path.parentNode) path.parentNode.appendChild(path); // z-raise
        // 콜백
        onRegionEnter && onRegionEnter(ctx(ev));
      };
      const leave = (ev) => {
        // 원복
        path.style.stroke = path.dataset.baseStroke;
        path.style.strokeWidth = path.dataset.baseStrokeWidth;
        path.style.opacity = path.dataset.baseOpacity;
        onRegionLeave && onRegionLeave(ctx(ev));
      };
      const click = (ev) => {
        onRegionClick && onRegionClick(ctx(ev));
      };
      const key = (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onRegionClick && onRegionClick(ctx(ev));
        }
      };

      path.addEventListener('mouseenter', enter);
      path.addEventListener('mouseleave', leave);
      path.addEventListener('focus', enter);
      path.addEventListener('blur', leave);
      path.addEventListener('click', click);
      path.addEventListener('keydown', key);
    }
  }

  // ---------- 우측 막대 ----------
  static #buildBars(wrap, dataMap, colorForRate, barOpts = {}) {
    const list = document.createElement('div');
    list.style.display = 'flex'; list.style.flexDirection = 'column';
    list.style.gap = (barOpts.gap != null) ? `${barOpts.gap}px` : '20px';
    this.#setCss(list, 'padding-top', (barOpts.paddingTop != null) ? `${barOpts.paddingTop}px` : null);

    const entries = Object.entries(dataMap || {}).map(([name, v]) => {
      const rate = (typeof v === 'number') ? v : v?.rate;
      return [name, (rate == null ? -Infinity : rate)];
    }).sort((a, b) => b[1] - a[1]);

    for (const [name, rRaw] of entries) {
      const r = this.#clamp01(rRaw) ?? 0;
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.alignItems = 'center';
      row.style.gap = (barOpts.rowGap != null) ? `${barOpts.rowGap}px` : '8px';
      row.style.height = (barOpts.height != null) ? `${barOpts.height}px` : '20px';

      const label = document.createElement('span');
      label.style.display = 'inline-block'; label.style.flexShrink = '0';
      label.style.width = (barOpts.labelWidth != null) ? `${barOpts.labelWidth}px` : '56px';
      label.style.fontSize = (barOpts.labelSize != null) ? `${barOpts.labelSize}px` : '12px';
      label.style.fontWeight = (barOpts.labelWeight != null) ? `${barOpts.labelWeight}` : '600';
      label.style.color = barOpts.labelColor ?? '#111827';
      label.style.textAlign = barOpts.labelAlign ?? 'right';
      label.textContent = name;
      row.appendChild(label);

      const bar = document.createElement('div');
      bar.style.height = '100%';
      bar.style.borderRadius = (barOpts.rounded != null) ? `${barOpts.rounded}px` : '4px';
      bar.style.background = colorForRate(r);
      bar.style.width = `${(barOpts.width ?? 100) * r}px`;
      row.appendChild(bar);

      const val = document.createElement('span');
      val.style.display = 'inline-block'; val.style.flexShrink = '0';
      val.style.fontSize = (barOpts.valueSize != null) ? `${barOpts.valueSize}px` : '12px';
      val.style.fontWeight = (barOpts.valueWeight != null) ? `${barOpts.valueWeight}` : '600';
      val.style.color = barOpts.valueColor ?? '#111827';
      val.style.textAlign = 'left';
      val.textContent = this.#fmtPct(r);
      row.appendChild(val);

      list.appendChild(row);
    }
    wrap.appendChild(list);
  }

  // ---------- 콜아웃 ----------
  static #buildCallouts(svg, codeMap, dataMap, bbox, calloutOpts = {}) {
    const vbStr = svg.getAttribute('viewBox');
    let vx, vy, vw, vh;
    if (vbStr) [vx, vy, vw, vh] = vbStr.split(/\s+/).map(Number);
    else { vx = bbox.x; vy = bbox.y; vw = bbox.w; vh = bbox.h; svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`); }
    const pad = (calloutOpts.padding ?? 0), extra = (calloutOpts.margin ?? 0), padding = pad + extra;
    svg.setAttribute('viewBox', `${vx - padding} ${vy} ${vw + (padding * 2)} ${vh}`);

    const leftX = bbox.x - pad, rightX = bbox.x + bbox.w + pad;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(group);

    for (const [name, code] of Object.entries(codeMap || {})) {
      const path = svg.getElementById(code); if (!path) continue;
      const b = path.getBBox();
      let cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const off = (calloutOpts.offsets && calloutOpts.offsets[name]) || [0, 0];
      const bypass = (calloutOpts.bypass && calloutOpts.bypass[name]);
      cx += off[0]; cy += off[1];

      const leftSide = cx < bbox.cx;
      const startX = cx, endX = leftSide ? leftX : rightX;
      const bend = bypass ? `L${startX + bypass[0]},${cy + bypass[1]}` : '';
      const textDx = (calloutOpts.textOffset ?? 0) * (leftSide ? -1 : +1);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M${cx},${cy} L${startX},${cy} ${bend} L${endX + textDx},${cy + (bypass?.[1] || 0)}`;
      line.setAttribute('d', d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', calloutOpts.lineColor ?? '#9CA3AF');
      line.setAttribute('stroke-width', calloutOpts.lineWidth ?? 1);
      line.setAttribute('stroke-dasharray', calloutOpts.lineDash ?? '0');
      group.appendChild(line);

      const pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pin.setAttribute('cx', cx); pin.setAttribute('cy', cy);
      pin.setAttribute('r', calloutOpts.pinSize ?? '2');
      pin.setAttribute('fill', calloutOpts.pinColor ?? '#1B4EFF');
      group.appendChild(pin);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', endX);
      label.setAttribute('y', cy + (bypass?.[1] || 0));
      label.setAttribute('text-anchor', leftSide ? 'end' : 'start');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', calloutOpts.textSize ?? 12);
      label.setAttribute('font-weight', calloutOpts.textWeight ?? 400);
      label.setAttribute('fill', calloutOpts.textColor ?? '#6B7280');

      const dv = dataMap?.[name];
      const count = (typeof dv === 'number') ? null : dv?.count;
      label.textContent = calloutOpts.formatter
        ? calloutOpts.formatter(name, count)
        : `${name} : ${this.#fmtInt(count)}`;
      group.appendChild(label);
    }
  }

  // ---------- 메인 ----------
  static async render(codeMap, mount, opts) {
    const el = this.#ensureMount(mount);
    if (!el) throw new Error('KorMapChart.render: mount 요소를 찾을 수 없음');
    el.innerHTML = '';
    this.#setCss(el, 'position', 'relative'); this.#setCss(el, 'display', 'flex'); this.#setCss(el, 'flex-shrink', '0');
    this.#setCss(el, 'align-items', opts?.mode === 'count+callouts' ? 'center' : null);
    this.#setCss(el, 'justify-content', opts?.mode === 'count+callouts' ? 'center' : null);
    this.#setCss(el, 'gap', (opts?.gap != null) ? `${opts.gap}px` : null);

    const svg = await this.#loadSVG(opts.svgUrl);
    this.#setCss(svg, 'width', (opts?.map?.width != null) ? `${opts.map.width}px` : null);
    this.#setCss(svg, 'height', (opts?.map?.height != null) ? `${opts.map.height}px` : null);
    el.appendChild(svg);

    this.#clearSvgFillStyles(svg);

    const colorForRate = this.#makeColorForRate(opts?.rates, opts?.colors);
    const mode = opts?.mode ?? (opts?.bar ? 'rate+bars' : (opts?.callouts ? 'count+callouts' : 'rate+bars'));
    const getRate = (name) => { const v = opts?.data?.[name]; return (typeof v === 'number') ? v : v?.rate; };

    this.#paintRegions(svg, codeMap, getRate.bind(this), colorForRate);
    this.#placeRegionLabels(svg, codeMap, opts?.labels);

    // NEW: 인터랙션 바인딩
    this.#enableInteractions(svg, codeMap, opts?.data, getRate.bind(this), opts?.interactions);

    if (mode === 'rate+bars') {
      this.#buildBars(el, opts?.data, colorForRate, opts?.bar);
    } else {
      const bbox = this.#computeBBox(svg);
      this.#buildCallouts(svg, codeMap, opts?.data, bbox, opts?.callouts);
    }
  }
}
