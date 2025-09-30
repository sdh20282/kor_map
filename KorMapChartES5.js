/**
 * KorMapChart v2 ES5 Version
 * - ES5로 다운그레이드된 버전
 * - 모든 ES6+ 기능을 ES5 호환 코드로 변환
 * - mode: 'normal' | 'rate+bars' | 'count+callouts' (필수)
 *
 * @example
 * // normal 모드 - 지도만 표시 + 파이 차트
 * KorMapChartES5.render(codeMap, '#mount', {
 *   mode: 'normal',  // 필수
 *   svgUrl: '/maps/kr_sido.svg',
 *   data: { 서울: 0.87, 경기: 0.63, 인천: 0.80 },
 *   pieChartData: {
 *     '서울': [
 *       { label: '카테고리1', data: 30, color: '#ff6384' },
 *       { label: '카테고리2', data: 50, color: '#36a2eb' },
 *       { label: '카테고리3', data: 20, color: '#ffce56' }
 *     ]
 *   }
 * });
 */
function KorMapChartES5() { }

// 정적 메서드들을 생성자 함수에 직접 할당
KorMapChartES5._loadSVG = function (url) {
  return fetch(url)
    .then(function (res) {
      return res.text();
    })
    .then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      return doc.documentElement;
    });
};

KorMapChartES5._setCss = function (el, prop, v) {
  if (!el || !prop) return;
  if (v == null) el.style.removeProperty(prop);
  else el.style.setProperty(prop, v);
};

KorMapChartES5._fmtPct = function (x) {
  return (x == null || Number.isNaN(x)) ? '-' : Math.round(x * 100) + '%';
};

KorMapChartES5._fmtInt = function (n) {
  return (n == null || Number.isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR');
};

KorMapChartES5._clamp01 = function (v) {
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
};

KorMapChartES5._makeColorForRate = function (thresholds, colors) {
  var th = Array.isArray(thresholds) && thresholds.length ? thresholds : [0.8, 0.6, 0.4, 0.2];
  var cs = Array.isArray(colors) && colors.length ? colors : ['#00085A', '#1F48FF', '#79a1ee', '#99d9f2', '#D7D7D7'];
  var lastIndex = cs.length - 1;
  var fallback = lastIndex >= 0 && cs[lastIndex] != null ? cs[lastIndex] : '#D7D7D7';

  return function (rRaw) {
    var r = KorMapChartES5._clamp01(rRaw);
    if (r == null) return fallback;
    for (var i = 0; i < th.length; i++) {
      if (r >= th[i]) {
        var candidate = cs[i];
        return candidate != null ? candidate : fallback;
      }
    }
    return fallback;
  };
};

KorMapChartES5._clearSvgFillStyles = function (svg) {
  var styles = svg.querySelectorAll('style');
  for (var i = 0; i < styles.length; i++) {
    var s = styles[i];
    s.textContent = s.textContent.replace(/fill\s*:[^;]+;?/g, '');
  }

  var elementsWithFill = svg.querySelectorAll('[fill]');
  for (var j = 0; j < elementsWithFill.length; j++) {
    elementsWithFill[j].removeAttribute('fill');
  }
};

KorMapChartES5._ensureMount = function (mount) {
  return (typeof mount === 'string') ? document.querySelector(mount) : mount;
};

KorMapChartES5._computeBBox = function (svg) {
  var paths = svg.querySelectorAll('path');
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (var i = 0; i < paths.length; i++) {
    var b = paths[i].getBBox();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2
  };
};

KorMapChartES5._createPieChart = function (cx, cy, data, opts) {
  opts = opts || {};
  var radius = opts.radius != null ? opts.radius : 20;
  var innerRadius = opts.innerRadius != null ? opts.innerRadius : 0;
  var strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : 1;
  var strokeColor = opts.strokeColor != null ? opts.strokeColor : '#ffffff';

  var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  // 데이터 합계 계산
  var total = 0;
  for (var i = 0; i < data.length; i++) {
    total += (data[i].data || 0);
  }
  if (total === 0) return g;

  var currentAngle = -90;  // 12시 방향에서 시작

  for (var j = 0; j < data.length; j++) {
    var item = data[j];
    var value = item.data || 0;
    var percentage = value / total;
    var angle = percentage * 360;

    if (angle === 0) continue;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    var startAngleRad = (currentAngle * Math.PI) / 180;
    var endAngleRad = ((currentAngle + angle) * Math.PI) / 180;

    var x1 = cx + radius * Math.cos(startAngleRad);
    var y1 = cy + radius * Math.sin(startAngleRad);
    var x2 = cx + radius * Math.cos(endAngleRad);
    var y2 = cy + radius * Math.sin(endAngleRad);

    var d;

    if (innerRadius > 0) {
      var ix1 = cx + innerRadius * Math.cos(startAngleRad);
      var iy1 = cy + innerRadius * Math.sin(startAngleRad);
      var ix2 = cx + innerRadius * Math.cos(endAngleRad);
      var iy2 = cy + innerRadius * Math.sin(endAngleRad);

      var largeArcFlag = angle > 180 ? 1 : 0;
      d = [
        'M ' + x1 + ' ' + y1,
        'A ' + radius + ' ' + radius + ' 0 ' + largeArcFlag + ' 1 ' + x2 + ' ' + y2,
        'L ' + ix2 + ' ' + iy2,
        'A ' + innerRadius + ' ' + innerRadius + ' 0 ' + largeArcFlag + ' 0 ' + ix1 + ' ' + iy1,
        'Z'
      ].join(' ');
    } else {
      var largeArcFlag = angle > 180 ? 1 : 0;
      d = [
        'M ' + cx + ' ' + cy,
        'L ' + x1 + ' ' + y1,
        'A ' + radius + ' ' + radius + ' 0 ' + largeArcFlag + ' 1 ' + x2 + ' ' + y2,
        'Z'
      ].join(' ');
    }

    path.setAttribute('d', d);
    path.setAttribute('fill', item.color || '#cccccc');
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeWidth);

    if (item.label) {
      var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = item.label + ': ' + Math.round(percentage * 100) + '%';
      path.appendChild(title);
    }

    g.appendChild(path);
    currentAngle += angle;
  }

  return g;
};

KorMapChartES5._placeRegionLabels = function (svg, codeMap, labelOpts, pieChartData) {
  labelOpts = labelOpts || {};
  pieChartData = pieChartData || {};

  var layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(layer);

  var minW = labelOpts.minWidth != null ? labelOpts.minWidth : 16;
  var minH = labelOpts.minHeight != null ? labelOpts.minHeight : 12;

  for (var name in codeMap) {
    if (!codeMap.hasOwnProperty(name)) continue;

    var code = codeMap[name];
    var path = svg.getElementById(code);
    if (!path) continue;

    var b = path.getBBox();
    if (b.width < minW || b.height < minH) continue;

    var cx = b.x + b.width / 2;
    var cy = b.y + b.height / 2;

    var off = (labelOpts.offsets && labelOpts.offsets[name]) || [0, 0];
    cx += off[0];
    cy += off[1];

    var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('font-size', labelOpts.fontSize != null ? labelOpts.fontSize : 12);
    label.setAttribute('font-weight', labelOpts.fontWeight != null ? labelOpts.fontWeight : 400);
    label.setAttribute('fill', labelOpts.color || '#111827');
    label.setAttribute('style', [
      'pointer-events:none',
      'paint-order:stroke',
      'stroke:#FFFFFF',
      'stroke-width:' + (labelOpts.strokeWidth != null ? labelOpts.strokeWidth : 2.5) + 'px'
    ].join(';'));
    label.textContent = name;
    layer.appendChild(label);

    if (pieChartData && pieChartData[name]) {
      var pieOpts = labelOpts.pieChart || {};
      var position = (pieOpts.positions && pieOpts.positions[name]) || pieOpts.position || 'right';
      var gap = pieOpts.gap != null ? pieOpts.gap : 15;
      var radius = pieOpts.radius != null ? pieOpts.radius : 15;

      var pieX = cx;
      var pieY = cy;

      switch (position) {
        case 'top':
          pieY -= (gap + radius);
          break;
        case 'bottom':
          pieY += (gap + radius);
          break;
        case 'left':
          pieX -= (gap + radius);
          break;
        case 'right':
          pieX += (gap + radius);
          break;
      }

      var pieOffset = (pieOpts.offsets && pieOpts.offsets[name]) || [0, 0];
      pieX += pieOffset[0];
      pieY += pieOffset[1];

      var pie = KorMapChartES5._createPieChart(pieX, pieY, pieChartData[name], {
        radius: radius,
        innerRadius: pieOpts.innerRadius != null ? pieOpts.innerRadius : 0,
        strokeWidth: pieOpts.strokeWidth != null ? pieOpts.strokeWidth : 0.5,
        strokeColor: pieOpts.strokeColor || '#ffffff'
      });

      layer.appendChild(pie);
    }
  }
};

KorMapChartES5._paintRegions = function (svg, codeMap, dataGetter, colorForRate) {
  for (var name in codeMap) {
    if (!codeMap.hasOwnProperty(name)) continue;

    var code = codeMap[name];
    var path = svg.getElementById(code);
    if (!path) continue;

    var rate = dataGetter(name);
    path.style.setProperty('fill', colorForRate(rate), 'important');
  }
};

KorMapChartES5._buildBars = function (wrap, dataMap, colorForRate, barOpts) {
  barOpts = barOpts || {};
  dataMap = dataMap || {};

  var list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = (barOpts.gap != null) ? barOpts.gap + 'px' : '20px';
  KorMapChartES5._setCss(list, 'padding-top', (barOpts.paddingTop != null) ? barOpts.paddingTop + 'px' : null);

  var entries = [];
  for (var name in dataMap) {
    if (!dataMap.hasOwnProperty(name)) continue;

    var v = dataMap[name];
    var rate = (typeof v === 'number') ? v : (v && v.rate);
    entries.push([name, (rate == null ? -Infinity : rate)]);
  }

  entries.sort(function (a, b) { return b[1] - a[1]; });

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var name = entry[0];
    var rRaw = entry[1];
    var r = KorMapChartES5._clamp01(rRaw) || 0;

    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = (barOpts.rowGap != null) ? barOpts.rowGap + 'px' : '8px';
    row.style.height = (barOpts.height != null) ? barOpts.height + 'px' : '20px';

    var label = document.createElement('span');
    label.style.display = 'inline-block';
    label.style.flexShrink = '0';
    label.style.width = (barOpts.labelWidth != null) ? barOpts.labelWidth + 'px' : '56px';
    label.style.fontSize = (barOpts.labelSize != null) ? barOpts.labelSize + 'px' : '12px';
    label.style.fontWeight = (barOpts.labelWeight != null) ? String(barOpts.labelWeight) : '600';
    label.style.color = barOpts.labelColor != null ? barOpts.labelColor : '#111827';
    label.style.textAlign = barOpts.labelAlign != null ? barOpts.labelAlign : 'right';
    label.textContent = name;
    row.appendChild(label);

    var bar = document.createElement('div');
    bar.style.height = '100%';
    bar.style.borderRadius = (barOpts.rounded != null) ? barOpts.rounded + 'px' : '4px';
    bar.style.background = colorForRate(r);
    var bwBase = (barOpts.width != null ? barOpts.width : 100);
    var bw = (bwBase * r);
    bar.style.width = bw + 'px';
    row.appendChild(bar);

    var val = document.createElement('span');
    val.style.display = 'inline-block';
    val.style.flexShrink = '0';
    val.style.fontSize = (barOpts.valueSize != null) ? barOpts.valueSize + 'px' : '12px';
    val.style.fontWeight = (barOpts.valueWeight != null) ? String(barOpts.valueWeight) : '600';
    val.style.color = barOpts.valueColor != null ? barOpts.valueColor : '#111827';
    val.style.textAlign = 'left';
    val.textContent = KorMapChartES5._fmtPct(r);
    row.appendChild(val);

    list.appendChild(row);
  }

  wrap.appendChild(list);
};

KorMapChartES5._buildCallouts = function (svg, codeMap, dataMap, bbox, calloutOpts) {
  calloutOpts = calloutOpts || {};
  dataMap = dataMap || {};

  var vbStr = svg.getAttribute('viewBox');
  var vx, vy, vw, vh;
  if (vbStr) {
    var vbParts = vbStr.split(/\s+/).map(Number);
    vx = vbParts[0]; vy = vbParts[1]; vw = vbParts[2]; vh = vbParts[3];
  } else {
    vx = bbox.x; vy = bbox.y; vw = bbox.w; vh = bbox.h;
    svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
  }

  var pad = (calloutOpts.padding || 0);
  var extra = (calloutOpts.margin || 0);
  var padding = pad + extra;

  svg.setAttribute('viewBox', (vx - padding) + ' ' + vy + ' ' + (vw + (padding * 2)) + ' ' + vh);

  var leftX = bbox.x - pad;
  var rightX = bbox.x + bbox.w + pad;

  var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(group);

  for (var name in codeMap) {
    if (!codeMap.hasOwnProperty(name)) continue;

    var code = codeMap[name];
    var path = svg.getElementById(code);
    if (!path) continue;

    var b = path.getBBox();
    var cx = b.x + b.width / 2;
    var cy = b.y + b.height / 2;

    var off = (calloutOpts.offsets && calloutOpts.offsets[name]) || [0, 0];
    var bypass = (calloutOpts.bypass && calloutOpts.bypass[name]);
    cx += off[0];
    cy += off[1];

    var leftSide = cx < bbox.cx;
    var startX = cx;
    var endX = leftSide ? leftX : rightX;
    var bend = bypass ? ('L' + (startX + bypass[0]) + ',' + (cy + bypass[1])) : '';
    var textDx = (calloutOpts.textOffset || 0) * (leftSide ? -1 : +1);

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    var d = 'M' + cx + ',' + cy + ' L' + startX + ',' + cy + ' ' + bend + ' L' + (endX + textDx) + ',' + (cy + (bypass && bypass[1] || 0));
    line.setAttribute('d', d);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', calloutOpts.lineColor != null ? calloutOpts.lineColor : '#9CA3AF');
    line.setAttribute('stroke-width', calloutOpts.lineWidth != null ? calloutOpts.lineWidth : 1);
    line.setAttribute('stroke-dasharray', calloutOpts.lineDash != null ? calloutOpts.lineDash : '0');
    group.appendChild(line);

    var pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pin.setAttribute('cx', cx);
    pin.setAttribute('cy', cy);
    pin.setAttribute('r', calloutOpts.pinSize != null ? calloutOpts.pinSize : '2');
    pin.setAttribute('fill', calloutOpts.pinColor != null ? calloutOpts.pinColor : '#1B4EFF');
    group.appendChild(pin);

    var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', endX);
    label.setAttribute('y', cy + (bypass && bypass[1] || 0));
    label.setAttribute('text-anchor', leftSide ? 'end' : 'start');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-size', calloutOpts.textSize != null ? calloutOpts.textSize : 12);
    label.setAttribute('font-weight', calloutOpts.textWeight != null ? calloutOpts.textWeight : 400);
    label.setAttribute('fill', calloutOpts.textColor != null ? calloutOpts.textColor : '#6B7280');

    var dv = dataMap && dataMap[name];
    var count = (typeof dv === 'number') ? null : (dv && dv.count);
    label.textContent = calloutOpts.formatter
      ? calloutOpts.formatter(name, count)
      : name + ' : ' + KorMapChartES5._fmtInt(count);

    group.appendChild(label);
  }
};

KorMapChartES5._createShadowFilter = function (svg, shadowOpts) {
  shadowOpts = shadowOpts || {};

  var defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    var firstChild = svg.firstChild;
    if (firstChild) svg.insertBefore(defs, firstChild);
    else svg.appendChild(defs);
  }

  var filterId = 'drop-shadow-' + Math.random().toString(36).substr(2, 9);

  var filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', filterId);
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '200%');

  var feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
  feDropShadow.setAttribute('dx', String(shadowOpts.dx != null ? shadowOpts.dx : 0));
  feDropShadow.setAttribute('dy', String(shadowOpts.dy != null ? shadowOpts.dy : 6));
  feDropShadow.setAttribute('stdDeviation', String(shadowOpts.blur != null ? shadowOpts.blur : 4));
  feDropShadow.setAttribute('flood-color', shadowOpts.color != null ? shadowOpts.color : '#000000');
  feDropShadow.setAttribute('flood-opacity', String(shadowOpts.opacity != null ? shadowOpts.opacity : 0.3));

  filter.appendChild(feDropShadow);
  defs.appendChild(filter);

  return filterId;
};

KorMapChartES5._bindRegionEvents = function (svg, codeMap, opts, getDatum) {
  opts = opts || {};
  var ev = opts.events || {};
  var hoverStyle = ev.hoverStyle || { opacity: 0.8, cursor: 'pointer' };
  var regionHoverStyles = ev.regionHoverStyles || {};
  var shadow = ev.shadow;
  var innerCities = opts.innerCities || [];

  var shadowFilterId = null;
  if (shadow) {
    var shadowOpts = (typeof shadow === 'object') ? shadow : {};
    shadowFilterId = KorMapChartES5._createShadowFilter(svg, shadowOpts);
  }

  var selectedPath = null;

  var apply = function (el, styleObj) {
    for (var k in styleObj) {
      if (!styleObj.hasOwnProperty(k)) continue;

      var v = styleObj[k];
      if (v == null) {
        el.style.removeProperty(k);
      } else {
        var prop = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
        if (prop === 'fill') {
          el.style.setProperty(prop, String(v), 'important');
        } else {
          el.style.setProperty(prop, String(v));
        }
      }
    }
  };

  var selectRegion = function (path, name) {
    if (!path) return;
    selectedPath = path;

    var styleToApply = regionHoverStyles[name] || hoverStyle;
    apply(path, styleToApply);

    if (shadow && shadowFilterId) {
      path.style.filter = 'url(#' + shadowFilterId + ')';
    }
  };

  var deselectRegion = function () {
    if (!selectedPath) return;

    apply(selectedPath, selectedPath._originalStyles);

    if (selectedPath._originalStyles.fill !== undefined) {
      selectedPath.style.setProperty('fill', selectedPath._originalStyles.fill || '', 'important');
    }

    if (shadow) {
      selectedPath.style.filter = selectedPath._originalStyles.filter || '';
    }

    selectedPath = null;
  };

  var createEventHandler = function (name, code) {
    return {
      mouseenter: function (e) {
        var p = svg.getElementById(code);
        if (!p) return;

        // 내륙 도시가 아닐 때만 z-index 재배치
        var isInnerCity = innerCities.indexOf(name) !== -1;

        if (!isInnerCity) {
          // SVG에서 요소를 맨 위로 올리기
          p.parentNode.appendChild(p);

          // 선택된 요소를 그 위에 유지
          if (selectedPath && selectedPath.parentNode) {
            selectedPath.parentNode.appendChild(selectedPath);
          }

          // 내륙 도시들을 항상 최상위에 유지
          for (var innerName in codeMap) {
            if (!codeMap.hasOwnProperty(innerName)) continue;

            var innerCode = codeMap[innerName];
            if (innerCities.indexOf(innerName) !== -1) {
              var innerPath = svg.getElementById(innerCode);
              if (innerPath && innerPath.parentNode) {
                innerPath.parentNode.appendChild(innerPath);
              }
            }
          }
        }

        // 지역별 커스텀 스타일 또는 전역 스타일 적용
        var styleToApply = regionHoverStyles[name] || hoverStyle;
        apply(p, styleToApply);

        if (shadow && shadowFilterId) {
          p.style.filter = 'url(#' + shadowFilterId + ')';
        }

        if (ev.onRegionEnter) {
          ev.onRegionEnter(name, p, getDatum(name), e);
        }
      },

      mouseleave: function (e) {
        var p = svg.getElementById(code);
        if (!p) return;

        // If this region is selected, don't remove hover styles
        if (p === selectedPath) {
          if (ev.onRegionLeave) {
            ev.onRegionLeave(name, p, getDatum(name), e);
          }
          return;
        }

        apply(p, p._originalStyles);

        if (p._originalStyles.fill !== undefined) {
          p.style.setProperty('fill', p._originalStyles.fill || '', 'important');
        }

        if (shadow) {
          p.style.filter = p._originalStyles.filter || '';
        }

        if (ev.onRegionLeave) {
          ev.onRegionLeave(name, p, getDatum(name), e);
        }
      },

      click: function (e) {
        var p = svg.getElementById(code);
        if (!p) return;

        // Handle selection
        if (selectedPath && selectedPath !== p) {
          // Deselect previous region
          deselectRegion();
        }

        // Select this region (or keep it selected if already selected)
        if (selectedPath !== p) {
          selectRegion(p, name);
          // 선택된 요소를 맨 위로 올리기
          if (p.parentNode) {
            p.parentNode.appendChild(p);
          }

          // 내륙 도시들을 항상 최상위에 유지
          for (var innerName in codeMap) {
            if (!codeMap.hasOwnProperty(innerName)) continue;

            var innerCode = codeMap[innerName];
            if (innerCities.indexOf(innerName) !== -1) {
              var innerPath = svg.getElementById(innerCode);
              if (innerPath && innerPath.parentNode) {
                innerPath.parentNode.appendChild(innerPath);
              }
            }
          }
        }

        if (ev.onRegionClick) {
          ev.onRegionClick(name, p, getDatum(name), e);
        }
      }
    };
  };

  for (var name in codeMap) {
    if (!codeMap.hasOwnProperty(name)) continue;

    var code = codeMap[name];
    var p = svg.getElementById(code);
    if (!p) continue;

    // 원래 스타일 저장
    p._originalStyles = {
      stroke: p.style.stroke,
      strokeWidth: p.style.strokeWidth,
      opacity: p.style.opacity,
      cursor: p.style.cursor,
      filter: p.style.filter,
      fill: p.style.fill
    };

    p.style.pointerEvents = 'auto';

    var handlers = createEventHandler(name, code);
    p.addEventListener('mouseenter', handlers.mouseenter);
    p.addEventListener('mouseleave', handlers.mouseleave);
    p.addEventListener('click', handlers.click);
  }

  // Add window click handler for deselecting when clicking on empty areas
  window.addEventListener('click', function (e) {
    // Check if the click target is the SVG itself (not a path or other element)
    if (e.target === svg || e.target.tagName === 'svg') {
      deselectRegion();
    }
  });
};

// 메인 렌더 메서드
KorMapChartES5.render = function (codeMap, mount, opts) {
  opts = opts || {};

  var el = KorMapChartES5._ensureMount(mount);

  if (!el) throw new Error('KorMapChartES5.render: mount 요소를 찾을 수 없음');

  el.innerHTML = '';
  KorMapChartES5._setCss(el, 'position', 'relative');
  KorMapChartES5._setCss(el, 'display', 'flex');
  KorMapChartES5._setCss(el, 'align-items', opts.mode === 'count+callouts' ? 'center' : null);
  KorMapChartES5._setCss(el, 'justify-content', opts.mode === 'count+callouts' ? 'center' : null);
  KorMapChartES5._setCss(el, 'flex-shrink', '0');
  KorMapChartES5._setCss(el, 'gap', (opts.gap != null) ? opts.gap + 'px' : null);

  return KorMapChartES5._loadSVG(opts.svgUrl).then(function (svg) {
    KorMapChartES5._setCss(svg, 'width', (opts.map && opts.map.width != null) ? opts.map.width + 'px' : null);
    KorMapChartES5._setCss(svg, 'height', (opts.map && opts.map.height != null) ? opts.map.height + 'px' : null);
    el.appendChild(svg);

    KorMapChartES5._clearSvgFillStyles(svg);

    var colorForRate = KorMapChartES5._makeColorForRate(opts.rates, opts.colors);

    // mode는 필수
    if (!opts.mode) {
      throw new Error('KorMapChartES5.render: mode는 필수입니다. ("normal" | "rate+bars" | "count+callouts")');
    }

    var mode = opts.mode;

    // mode별 필수 옵션 검증
    if (mode === 'rate+bars' && !opts.bar) {
      throw new Error('KorMapChartES5.render: "rate+bars" 모드에서는 bar 옵션이 필수입니다.');
    }

    if (mode === 'count+callouts' && !opts.callouts) {
      throw new Error('KorMapChartES5.render: "count+callouts" 모드에서는 callouts 옵션이 필수입니다.');
    }

    var getRate = function (name) {
      var v = opts.data && opts.data[name];
      if (v == null) return null;
      return (typeof v === 'number') ? v : v.rate;
    };

    KorMapChartES5._paintRegions(svg, codeMap, getRate, colorForRate);
    KorMapChartES5._placeRegionLabels(svg, codeMap, opts.labels, opts.pieChartData);

    KorMapChartES5._bindRegionEvents(svg, codeMap, opts, function (n) { return opts.data && opts.data[n]; });

    if (mode === 'rate+bars') {
      KorMapChartES5._buildBars(el, opts.data, colorForRate, opts.bar);
    } else if (mode === 'count+callouts') {
      var bbox = KorMapChartES5._computeBBox(svg);
      KorMapChartES5._buildCallouts(svg, codeMap, opts.data, bbox, opts.callouts);
    }
    // mode === 'normal'일 때는 지도만 표시하고 추가 요소 없음
  });
};

// ES5에서 Array.at() 폴리필
if (!Array.prototype.at) {
  Array.prototype.at = function (index) {
    if (index < 0) {
      index = this.length + index;
    }
    return this[index];
  };
}

// ES5에서 Number.isNaN 폴리필
if (!Number.isNaN) {
  Number.isNaN = function (value) {
    return typeof value === 'number' && isNaN(value);
  };
}

// ES5에서 Number.isFinite 폴리필
if (!Number.isFinite) {
  Number.isFinite = function (value) {
    return typeof value === 'number' && isFinite(value);
  };
}
