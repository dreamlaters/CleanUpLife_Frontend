const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { findChartPoint, drawChartTooltip } = require('../utils/chartTooltip');

function createCanvas() {
  const texts = [];
  const boxes = [];
  const arcs = [];
  const ctx = {
    clearRect() { texts.length = 0; boxes.length = 0; arcs.length = 0; },
    fillRect() {},
    strokeRect(x, y, width, height) { boxes.push({ x, y, width, height }); },
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    setLineDash() {},
    arc(x, y, radius) { arcs.push({ x, y, radius }); },
    measureText(text) { return { width: text.length * 7 }; },
    fillText(text, x, y, maxWidth) { texts.push({ text, x, y, maxWidth }); }
  };
  return { ctx, texts, boxes, arcs };
}

function createSavingsChart(points = [], get = () => Promise.resolve({ points: [] })) {
  const filename = path.join(__dirname, '..', 'components', 'retirement-savings', 'retirement-savings.js');
  const requireFromComponent = createRequire(filename);
  let definition;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require(name) {
      return name === '../../utils/api' ? { get } : requireFromComponent(name);
    },
    Component(value) { definition = value; }
  }, { filename });
  const canvas = createCanvas();
  const component = {
    ...definition.methods,
    data: structuredClone(definition.data),
    ctx: canvas.ctx,
    canvasWidth: 345,
    canvasHeight: 240,
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    _initCanvas() { this._drawChart(); }
  };
  Object.assign(component.data, { trendLoading: false, trendPoints: points });
  return { component, ...canvas };
}

test('hit testing uses canvas-local logical pixels and the nearest point within 24 pixels', () => {
  const first = { x: 0, y: 0 };
  const second = { x: 60, y: 90 };
  const points = [first, second, { x: 65, y: 90 }];
  assert.equal(findChartPoint(points, { touches: [{ x: 0, y: 0 }] }), first);
  assert.equal(findChartPoint(points, { touches: [{ x: 60, y: 90, clientX: 500, clientY: 800 }] }), second);
  assert.equal(findChartPoint(points, { touches: [{ x: 24, y: 0 }] }), first);
  assert.equal(findChartPoint(points, { touches: [{ x: 25, y: 0 }] }), null);
  assert.equal(findChartPoint(points, { changedTouches: [second] }), second);
  assert.equal(findChartPoint([], { touches: [second] }), null);
  assert.equal(findChartPoint(points, { touches: [] }), null);
  assert.equal(findChartPoint(points, { touches: [{ x: NaN, y: 0 }] }), null);
});

test('tooltip boxes and their text remain inside the chart at every edge', () => {
  for (const width of [100, 345]) {
    for (const point of [
      { x: 0, y: 0 }, { x: width, y: 0 },
      { x: 0, y: 240 }, { x: width, y: 240 }
    ]) {
      const h = createCanvas();
      const lines = ['2026-10-20', 'First cat: 8.125 jin', 'Second cat: 9.1 jin'];
      drawChartTooltip(h.ctx, point, lines, width, 240);
      const box = h.boxes[0];
      assert.ok(box.x >= 8 && box.x + box.width <= width - 8);
      assert.ok(box.y >= 8 && box.y + box.height <= 240 - 8);
      assert.deepEqual(h.texts.map(item => item.text), lines);
      for (const text of h.texts) {
        assert.ok(text.x >= box.x && text.x + text.maxWidth <= box.x + box.width);
        assert.ok(text.y >= box.y && text.y + 12 <= box.y + box.height);
      }
    }
  }
});

test('savings canvas binds native long-tap and clears on a new touch or cancellation', () => {
  const filename = path.join(__dirname, '..', 'components', 'retirement-savings', 'retirement-savings.wxml');
  const template = fs.readFileSync(filename, 'utf8');
  const canvas = template.match(/<canvas\b[^>]*id="retirement-trend-canvas"[^>]*>/)[0];
  const h = createSavingsChart([{ month: '2026-09', amount: 1543273.31 }]);
  const handler = canvas.match(/bindlongtap="([^"]+)"/)[1];
  h.component._drawChart();
  assert.doesNotMatch(canvas, /(?:catchtouchmove|disable-scroll|bindtouchend)=/);
  for (const event of ['touchstart', 'touchcancel']) {
    h.component[handler]({ touches: [h.component._trendChartPoints[0]] });
    assert.ok(h.texts.some(item => item.text === '\u00a5 1,543,273.31'));
    const clear = canvas.match(new RegExp(`bind${event}="([^"]+)"`))[1];
    h.component[clear]();
    assert.equal(h.boxes.length, 0);
  }
});

test('savings long-tap displays the selected month, full amount, and provisional status', () => {
  const h = createSavingsChart([
    { month: '2026-09', amount: 1543273.31, isProvisional: false },
    { month: '2026-10', amount: 1653813, isProvisional: true }
  ]);
  h.component._drawChart();
  for (const [index, title, amount] of [
    [0, '2026-09', '\u00a5 1,543,273.31'],
    [1, '2026-10 \u00b7 \u6682\u8ba1', '\u00a5 1,653,813.00']
  ]) {
    h.component.onTrendChartLongPress({ touches: [h.component._trendChartPoints[index]] });
    assert.deepEqual(h.texts.slice(-2).map(item => item.text), [title, amount]);
    assert.equal(h.boxes.length, 1);
  }
});

test('savings single-point tooltips preserve zero and negative amounts', () => {
  for (const [amount, expected] of [[0, '\u00a5 0.00'], [-12345.67, '\u00a5 -12,345.67']]) {
    const h = createSavingsChart([{ month: '2026-10', amount }]);
    h.component._drawChart();
    const point = h.component._trendChartPoints[0];
    assert.equal(point.x, 55 + (345 - 55 - 14) / 2);
    h.component.onTrendChartLongPress({ touches: [point] });
    assert.equal(h.texts.at(-1).text, expected);
  }
});

test('savings blank, empty, loading, and error states do not expose stale tooltips', () => {
  const h = createSavingsChart([{ month: '2026-10', amount: 10 }]);
  h.component._drawChart();
  h.component.onTrendChartLongPress({ touches: [h.component._trendChartPoints[0]] });
  h.component.onTrendChartLongPress({ touches: [{ x: 0, y: 240 }] });
  assert.equal(h.boxes.length, 0);
  for (const state of [
    { trendLoading: true },
    { trendLoading: false, trendError: 'error' },
    { trendError: '', trendPoints: [] }
  ]) {
    Object.assign(h.component.data, state);
    h.component._drawChart();
    h.component.onTrendChartLongPress({ touches: [{ x: 193, y: 110 }] });
    assert.equal(h.component._trendChartPoints.length, 0);
    assert.equal(h.boxes.length, 0);
  }
});

test('savings filters clear the old tooltip and use freshly loaded amounts', async () => {
  let resolve;
  const h = createSavingsChart(
    [{ month: '2026-09', amount: 1543273.31 }],
    () => new Promise(done => { resolve = done; })
  );
  h.component._drawChart();
  h.component.onTrendChartLongPress({ touches: [h.component._trendChartPoints[0]] });
  h.component.onTrendFilter({ currentTarget: { dataset: { group: 'trendCategory', value: 'Stock' } } });
  assert.equal(h.component.data.trendCategory, 'Stock');
  assert.equal(h.component.data.trendLoading, true);
  assert.equal(h.component._trendChartPoints.length, 0);
  assert.equal(h.boxes.length, 0);
  resolve({ points: [{ month: '2026-10', amount: 123456.78 }] });
  await new Promise(setImmediate);
  assert.equal(h.component.data.trendLoading, false);
  h.component.onTrendChartLongPress({ touches: [h.component._trendChartPoints[0]] });
  assert.equal(h.texts.at(-1).text, '\u00a5 123,456.78');
});

test('savings overview refresh clears old tooltips before loading replacement points', async () => {
  let resolve;
  const h = createSavingsChart(
    [{ month: '2026-09', amount: 1543273.31 }],
    () => new Promise(done => { resolve = done; })
  );
  h.component._getCurrentOwner = () => 'Pig';
  h.component.triggerEvent = () => {};
  h.component._drawChart();
  h.component.onTrendChartLongPress({ touches: [h.component._trendChartPoints[0]] });
  assert.equal(h.boxes.length, 1);

  const loading = h.component.refresh();
  assert.equal(h.component.data.trendLoading, true);
  assert.equal(h.component._trendChartPoints.length, 0);
  assert.equal(h.boxes.length, 0);
  resolve({
    dashboard: { accounts: [] },
    trends: { points: [{ month: '2026-10', amount: 1200 }] }
  });
  await loading;

  assert.equal(h.component.data.error, '');
  assert.equal(h.component.data.trendLoading, false);
  h.component.onTrendChartLongPress({ touches: [h.component._trendChartPoints[0]] });
  assert.equal(h.texts.at(-1).text, '\u00a5 1,200.00');
});
