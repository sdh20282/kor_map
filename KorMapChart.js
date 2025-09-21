
/**
 * KorMapChart v2 (vanilla JS)
 * - 하나의 클래스 + 하나의 entry 메서드(render)
 * - mode: 'normal' | 'rate+bars' | 'count+callouts' (필수)
 * - 공통 개선:
 *   - SVG 원본 fill/styles 제거 일관화
 *   - 안전한 CSS setter(setCss)
 *   - color scale/fallback/클램프 처리
 *   - 결측치 표시 일관화('-')
 *   - 옵션 옵셔널 체이닝/기본값 정리
 *
 * @example
 * // normal 모드 - 지도만 표시
 * KorMapChart.render(codeMap, '#mount', {
 *   mode: 'normal',  // 필수
 *   svgUrl: '/maps/kr_sido.svg',
 *   data: { 서울: 0.87, 경기: 0.63, 인천: 0.80 },
 *   rates: [0.8, 0.6, 0.4, 0.2],
 *   colors: ['#00085A', '#1F48FF', '#79a1ee', '#99d9f2', '#D7D7D7'],
 *   map: { width: 420, height: 620 },
 *   labels: { fontSize: 12, strokeWidth: 2.5, offsets: { '서울': [2, -2] } },
 *   events: {
 *     shadow: true,  // 기본 그림자 사용
 *     // 또는 커스텀 그림자:
 *     // shadow: { dx: 0, dy: 8, blur: 6, color: '#0000FF', opacity: 0.4 },
 *     hoverStyle: { opacity: 0.9, cursor: 'pointer' },
 *     // 지역별 커스텀 hover 스타일 (배경색 변경 가능):
 *     regionHoverStyles: {
 *       '서울': { opacity: 0.95, stroke: '#ff0000', strokeWidth: 2, fill: '#ffcccc' },
 *       '제주': { opacity: 0.85, stroke: '#00ff00', strokeWidth: 3, fill: '#ccffcc' }
 *     }
 *   }
 * });
 *
 * // rate+bars 모드 - bar 옵션 필수
 * KorMapChart.render(codeMap, '#mount', {
 *   mode: 'rate+bars',  // 필수
 *   svgUrl: '/maps/kr_sido.svg',
 *   data: { 서울: 0.87, 경기: 0.63, 인천: 0.80 },
 *   rates: [0.8, 0.6, 0.4, 0.2],
 *   colors: ['#00085A', '#1F48FF', '#79a1ee', '#99d9f2', '#D7D7D7'],
 *   gap: 24,
 *   map: { width: 420, height: 620 },
 *   labels: { fontSize: 12, strokeWidth: 2.5, offsets: { '서울': [2, -2] } },
 *   bar: { width: 180, height: 18, gap: 12, labelWidth: 56, rounded: 4 },  // 필수
 *   events: {
 *     shadow: { dy: 10, blur: 5, opacity: 0.35 },  // 커스텀 하단 그림자
 *     hoverStyle: { opacity: 0.9, cursor: 'pointer' }
 *   }
 * });
 *
 * // count+callouts 모드 - callouts 옵션 필수
 * KorMapChart.render(codeMap, document.getElementById('mount2'), {
 *   mode: 'count+callouts',  // 필수
 *   svgUrl: '/maps/kr_sido.svg',
 *   data: { 서울: { count: 4339, rate: 0.93 }, 경기: { count: 5331, rate: 0.63 } },
 *   callouts: {  // 필수
 *     padding: 32, margin: 12, textOffset: 8,
 *     lineColor: '#9CA3AF', lineWidth: 1, pinColor: '#1B4EFF', textColor: '#6B7280',
 *     offsets: { '서울': [2, -2] }, bypass: { '부산': [12, -10] },
 *     formatter: (name, count) => `${name} : ${count?.toLocaleString('ko-KR') ?? '-'}`
 *   },
 *   events: {
 *     shadow: { dy: 8, blur: 4, color: '#1B4EFF', opacity: 0.2 },  // 파란색 하단 그림자
 *     hoverStyle: { opacity: 0.9, cursor: 'pointer' }
 *   }
 * });
 */
class KorMapChart {
  static async #loadSVG(url) {
    const res = await fetch(url);
    const txt = await res.text();
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
    return doc.documentElement;
  }

  static #setCss(el, prop, v) {
    if (!el || !prop) return;
    if (v == null) el.style.removeProperty(prop);
    else el.style.setProperty(prop, v);
  }

  static #fmtPct(x) {
    return (x == null || Number.isNaN(x)) ? '-' : Math.round(x * 100) + '%';
  }

  static #fmtInt(n) {
    return (n == null || Number.isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR');
  }

  static #clamp01(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(1, Math.max(0, n));
  }

  static #makeColorForRate(thresholds, colors) {
    const th = Array.isArray(thresholds) && thresholds.length ? thresholds : [0.8, 0.6, 0.4, 0.2];
    const cs = Array.isArray(colors) && colors.length ? colors : ['#00085A', '#1F48FF', '#79a1ee', '#99d9f2', '#D7D7D7'];
    const fallback = cs.at(-1) ?? '#D7D7D7';
    return (rRaw) => {
      const r = this.#clamp01(rRaw);
      if (r == null) return fallback;
      for (let i = 0; i < th.length; i++) {
        if (r >= th[i]) return cs[i] ?? fallback;
      }
      return fallback;
    };
  }

  static #clearSvgFillStyles(svg) {
    svg.querySelectorAll('style').forEach((s) => {
      s.textContent = s.textContent.replace(/fill\s*:[^;]+;?/g, '');
    });
    svg.querySelectorAll('[fill]').forEach((e) => e.removeAttribute('fill'));
  }

  static #ensureMount(mount) {
    return (typeof mount === 'string') ? document.querySelector(mount) : mount;
  }

  static #computeBBox(svg) {
    const paths = svg.querySelectorAll('path');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach((p) => {
      const b = p.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
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

      let cx = b.x + b.width / 2;
      let cy = b.y + b.height / 2;

      const off = (labelOpts.offsets && labelOpts.offsets[name]) || [0, 0];
      cx += off[0]; cy += off[1];

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', cx);
      label.setAttribute('y', cy);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.setAttribute('font-size', labelOpts.fontSize ?? 12);
      label.setAttribute('font-weight', labelOpts.fontWeight ?? 400);
      label.setAttribute('fill', labelOpts.color ?? '#111827');
      label.setAttribute('style', [
        'pointer-events:none',
        'paint-order:stroke',
        'stroke:#FFFFFF',
        `stroke-width:${labelOpts.strokeWidth ?? 2.5}px`
      ].join(';'));
      label.textContent = name;
      layer.appendChild(label);
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

  static #buildBars(wrap, dataMap, colorForRate, barOpts = {}) {
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = (barOpts.gap != null) ? `${barOpts.gap}px` : '20px';
    this.#setCss(list, 'padding-top', (barOpts.paddingTop != null) ? `${barOpts.paddingTop}px` : null);

    const entries = Object.entries(dataMap || {}).map(([name, v]) => {
      const rate = (typeof v === 'number') ? v : v?.rate;
      return [name, (rate == null ? -Infinity : rate)];
    }).sort((a, b) => b[1] - a[1]);

    for (const [name, rRaw] of entries) {
      const r = this.#clamp01(rRaw) ?? 0;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = (barOpts.rowGap != null) ? `${barOpts.rowGap}px` : '8px';
      row.style.height = (barOpts.height != null) ? `${barOpts.height}px` : '20px';

      const label = document.createElement('span');
      label.style.display = 'inline-block';
      label.style.flexShrink = '0';
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
      const bw = ((barOpts.width ?? 100) * r);
      bar.style.width = `${bw}px`;
      row.appendChild(bar);

      const val = document.createElement('span');
      val.style.display = 'inline-block';
      val.style.flexShrink = '0';
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

  static #buildCallouts(svg, codeMap, dataMap, bbox, calloutOpts = {}) {
    const vbStr = svg.getAttribute('viewBox');
    let vx, vy, vw, vh;
    if (vbStr) {
      [vx, vy, vw, vh] = vbStr.split(/\s+/).map(Number);
    } else {
      vx = bbox.x; vy = bbox.y; vw = bbox.w; vh = bbox.h;
      svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    }

    const pad = (calloutOpts.padding ?? 0);
    const extra = (calloutOpts.margin ?? 0);
    const padding = pad + extra;

    svg.setAttribute('viewBox', `${vx - padding} ${vy} ${vw + (padding * 2)} ${vh}`);

    const leftX = bbox.x - pad;
    const rightX = bbox.x + bbox.w + pad;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(group);

    for (const [name, code] of Object.entries(codeMap || {})) {
      const path = svg.getElementById(code);
      if (!path) continue;

      const b = path.getBBox();
      let cx = b.x + b.width / 2;
      let cy = b.y + b.height / 2;

      const off = (calloutOpts.offsets && calloutOpts.offsets[name]) || [0, 0];
      const bypass = (calloutOpts.bypass && calloutOpts.bypass[name]);
      cx += off[0]; cy += off[1];

      const leftSide = cx < bbox.cx;
      const startX = cx;
      const endX = leftSide ? leftX : rightX;
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
      pin.setAttribute('cx', cx);
      pin.setAttribute('cy', cy);
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

  static #createShadowFilter(svg, shadowOpts = {}) {
    const defs = svg.querySelector('defs') || (() => {
      const d = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.prepend(d);
      return d;
    })();

    const filterId = 'drop-shadow-' + Math.random().toString(36).substr(2, 9);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    feDropShadow.setAttribute('dx', String(shadowOpts.dx ?? 0));
    feDropShadow.setAttribute('dy', String(shadowOpts.dy ?? 6));  // 하단 그림자를 위해 기본값 증가
    feDropShadow.setAttribute('stdDeviation', String(shadowOpts.blur ?? 4));
    feDropShadow.setAttribute('flood-color', shadowOpts.color ?? '#000000');
    feDropShadow.setAttribute('flood-opacity', String(shadowOpts.opacity ?? 0.3));

    filter.appendChild(feDropShadow);
    defs.appendChild(filter);

    return filterId;
  }

  static #bindRegionEvents(svg, codeMap, opts, getDatum) {
    const ev = opts?.events || {};
    const hoverStyle = ev.hoverStyle || { opacity: 0.8, cursor: 'pointer' };
    const regionHoverStyles = ev.regionHoverStyles || {};  // 지역별 커스텀 hover 스타일
    const shadow = ev.shadow;  // boolean 또는 object

    let shadowFilterId = null;
    if (shadow) {
      const shadowOpts = (typeof shadow === 'object') ? shadow : {};
      shadowFilterId = this.#createShadowFilter(svg, shadowOpts);
    }

    const apply = (el, styleObj) => {
      Object.entries(styleObj).forEach(([k, v]) => {
        if (v == null) el.style.removeProperty(k);
        else {
          const prop = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
          // fill의 경우 important로 설정하여 기존 스타일 오버라이드
          if (prop === 'fill') {
            el.style.setProperty(prop, String(v), 'important');
          } else {
            el.style.setProperty(prop, String(v));
          }
        }
      });
    };

    for (const [name, code] of Object.entries(codeMap || {})) {
      const p = svg.getElementById(code);
      if (!p) continue;

      const orig = {
        stroke: p.style.stroke,
        strokeWidth: p.style.strokeWidth,
        opacity: p.style.opacity,
        cursor: p.style.cursor,
        filter: p.style.filter,
        fill: p.style.fill  // 배경색 저장
      };

      p.style.pointerEvents = 'auto';

      p.addEventListener('mouseenter', (e) => {
        // SVG에서 요소를 맨 위로 올리기 (z-index 효과)
        p.parentNode.appendChild(p);

        // 지역별 커스텀 스타일 또는 전역 스타일 적용
        const styleToApply = regionHoverStyles[name] || hoverStyle;
        apply(p, styleToApply);

        if (shadow && shadowFilterId) {
          p.style.filter = `url(#${shadowFilterId})`;
        }
        ev.onRegionEnter?.(name, p, getDatum(name), e);
      });

      p.addEventListener('mouseleave', (e) => {
        apply(p, orig);
        // fill은 별도로 important로 복원
        if (orig.fill !== undefined) {
          p.style.setProperty('fill', orig.fill || '', 'important');
        }
        if (shadow) {
          p.style.filter = orig.filter || '';
        }
        ev.onRegionLeave?.(name, p, getDatum(name), e);
      });

      p.addEventListener('click', (e) => {
        ev.onRegionClick?.(name, p, getDatum(name), e);
      });
    }
  }


  /** ---------- 메인 엔트리 ---------- */
  /**
   * @param {Object.<string,string>} codeMap - 지역명 → SVG id (예: { '서울':'KR-11', ... })
   * @param {string|HTMLElement|SVGElement} mount - 렌더링 대상(셀렉터/DOM)
   * @param {Object} opts - 옵션(아래 참조)
   *   - mode: 'normal' | 'rate+bars' | 'count+callouts' (필수)
   *   - svgUrl: string
   *   - data: Record<string, number | { count?:number, rate?:number }>
   *   - rates?: number[]
   *   - colors?: string[]
   *   - gap?: number
   *   - map?: { width?:number, height?:number }
   *   - labels?: { ... see original ... }
   *   - bar?: { ... see original ... }    // mode가 'rate+bars'일 때
   *   - callouts?: { ... see original ... } // mode가 'count+callouts'일 때
   */
  static async render(codeMap, mount, opts) {
    const el = this.#ensureMount(mount);

    if (!el) throw new Error('KorMapChart.render: mount 요소를 찾을 수 없음');

    el.innerHTML = '';
    this.#setCss(el, 'position', 'relative');
    this.#setCss(el, 'display', 'flex');
    this.#setCss(el, 'align-items', opts?.mode === 'count+callouts' ? 'center' : null);
    this.#setCss(el, 'justify-content', opts?.mode === 'count+callouts' ? 'center' : null);
    this.#setCss(el, 'flex-shrink', '0');
    this.#setCss(el, 'gap', (opts?.gap != null) ? `${opts.gap}px` : null);

    const svg = await this.#loadSVG(opts.svgUrl);
    this.#setCss(svg, 'width', (opts?.map?.width != null) ? `${opts.map.width}px` : null);
    this.#setCss(svg, 'height', (opts?.map?.height != null) ? `${opts.map.height}px` : null);
    el.appendChild(svg);

    this.#clearSvgFillStyles(svg);

    const colorForRate = this.#makeColorForRate(opts?.rates, opts?.colors);

    // mode는 필수
    if (!opts?.mode) {
      throw new Error('KorMapChart.render: mode는 필수입니다. ("normal" | "rate+bars" | "count+callouts")');
    }

    const mode = opts.mode;

    // mode별 필수 옵션 검증
    if (mode === 'rate+bars' && !opts?.bar) {
      throw new Error('KorMapChart.render: "rate+bars" 모드에서는 bar 옵션이 필수입니다.');
    }

    if (mode === 'count+callouts' && !opts?.callouts) {
      throw new Error('KorMapChart.render: "count+callouts" 모드에서는 callouts 옵션이 필수입니다.');
    }

    const getRate = (name) => {
      const v = opts?.data?.[name];
      if (v == null) return null;
      return (typeof v === 'number') ? v : v.rate;
    };

    this.#paintRegions(svg, codeMap, getRate.bind(this), colorForRate);
    this.#placeRegionLabels(svg, codeMap, opts?.labels);

    this.#bindRegionEvents(svg, codeMap, opts, (n) => opts?.data?.[n]);

    if (mode === 'rate+bars') {
      this.#buildBars(el, opts?.data, colorForRate, opts?.bar);
    } else if (mode === 'count+callouts') {
      const bbox = this.#computeBBox(svg);

      this.#buildCallouts(svg, codeMap, opts?.data, bbox, opts?.callouts);
    }
    // mode === 'normal'일 때는 지도만 표시하고 추가 요소 없음
  }
}
