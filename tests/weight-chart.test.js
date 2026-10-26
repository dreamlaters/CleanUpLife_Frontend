const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const NOW = Date.parse('2026-10-25T12:00:00Z');
const LEFT = 35;
const WIDTH = 300;
const LABEL_Y = 213;

function createChart(pageName, records = [], width = 345) {
  const filename = path.join(__dirname, '..', 'pages', pageName, `${pageName}.js`);
  const requireFromPage = createRequire(filename);
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [NOW]));
    }
  }
  let definition;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Date: FixedDate,
    require(name) {
      return name === '../../utils/api' ? {} : requireFromPage(name);
    },
    Page(value) { definition = value; }
  }, { filename });

  const arcs = [];
  const texts = [];
  const segments = [];
  const ctx = {
    clearRect() {
      arcs.length = 0;
      texts.length = 0;
      segments.length = 0;
    },
    fillRect() {},
    strokeRect() {},
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo(x, y) { segments.push({ x, y }); },
    stroke() {},
    fill() {},
    arc(x, y, radius) { arcs.push({ x, y, radius, color: this.fillStyle }); },
    measureText(text) { return { width: text.length * 7 }; },
    fillText(text, x, y) {
      texts.push({ text, x, y, width: this.measureText(text).width, align: this.textAlign });
    }
  };
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    ctx,
    canvasWidth: width,
    canvasHeight: 240,
    setData(patch) { Object.assign(this.data, patch); }
  };
  page.data.groupedRecords = Object.fromEntries(page.data.personList.map((person, index) => [
    person,
    (records[index] || []).map((date, recordIndex) => ({
      recordDate: `${date}T08:00:00`,
      weight: 8 + index + recordIndex / 10
    }))
  ]));
  return {
    page,
    arcs,
    texts,
    segments,
    points(index = 0) {
      const person = page.data.personList[index];
      return arcs.filter(arc => arc.radius === 4 && arc.color === page.data.personConfig[person].lineColor);
    },
    labels() { return texts.filter(text => text.y === LABEL_Y); }
  };
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `Expected ${actual} to equal ${expected}`);
}

for (const pageName of ['cat', 'pet']) {
  test(`${pageName}: weight filters offer month, three months and all, defaulting to all`, () => {
    const filename = path.join(__dirname, '..', 'pages', pageName, `${pageName}.wxml`);
    const template = fs.readFileSync(filename, 'utf8');
    const ranges = Array.from(
      template.matchAll(/bindtap="onTimeRangeChange"\s+data-range="([^"]+)"/g),
      match => match[1]
    );
    assert.deepEqual(ranges, ['month', '3month', 'all']);
    assert.equal(createChart(pageName).page.data.timeRange, 'all');
  });

  test(`${pageName}: native canvas long-tap shows both cats' exact weights for that date`, () => {
    const h = createChart(pageName, [['2026-10-20'], ['2026-10-20']]);
    const [first, second] = h.page.data.personList;
    h.page.data.groupedRecords[first][0].weight = 8.125;
    h.page.drawChart();
    const point = h.points()[0];
    const template = fs.readFileSync(path.join(__dirname, '..', 'pages', pageName, `${pageName}.wxml`), 'utf8');
    const canvas = template.match(/<canvas\b[^>]*id="weight-canvas"[^>]*>/)[0];
    const handler = canvas.match(/bindlongtap="([^"]+)"/)[1];
    h.page[handler]({ touches: [{ x: point.x + 8, y: point.y + 8 }] });
    const texts = h.texts.map(item => item.text);
    assert.ok(texts.includes('2026-10-20'));
    assert.ok(texts.includes(`${first}\uff1a8.125 \u65a4`));
    assert.ok(texts.includes(`${second}\uff1a9 \u65a4`));
    assert.equal(h.points().length, 1);
    assert.equal(h.points(1).length, 1);
    assert.doesNotMatch(canvas, /(?:catchtouchmove|disable-scroll|bindtouchend)=/);

    for (const event of ['touchstart', 'touchcancel']) {
      h.page[handler]({ touches: [point] });
      const clear = canvas.match(new RegExp(`bind${event}="([^"]+)"`))[1];
      h.page[clear]();
      assert.ok(!h.texts.some(item => item.text === '2026-10-20'));
    }
  });

  test(`${pageName}: a tooltip does not invent a missing cat's weight`, () => {
    const h = createChart(pageName, [['2026-10-01'], ['2026-10-20']]);
    h.page.drawChart();
    h.page.onWeightChartLongPress({ touches: [h.points()[0]] });
    assert.ok(h.texts.some(item => item.text === '2026-10-01'));
    assert.ok(!h.texts.some(item => item.text.startsWith(h.page.data.personList[1])));
  });

  test(`${pageName}: blank presses and range changes clear tooltips and stale hit targets`, () => {
    const h = createChart(pageName, [['2026-06-01', '2026-10-20']]);
    h.page.drawChart();
    h.page.onWeightChartLongPress({ touches: [h.points()[0]] });
    assert.ok(h.texts.some(item => item.text === '2026-06-01'));
    h.page.onWeightChartLongPress({ touches: [{ x: 0, y: 240 }] });
    assert.ok(!h.texts.some(item => item.text === '2026-06-01'));
    h.page.onTimeRangeChange({ currentTarget: { dataset: { range: 'month' } } });
    assert.equal(h.page._weightChartPoints.length, 1);
    assert.equal(h.page._weightChartPoints[0].date, '2026-10-20');
    h.page.onWeightChartLongPress({ touches: [h.points()[0]] });
    assert.ok(h.texts.some(item => item.text === '2026-10-20'));
    h.page.data.groupedRecords = {};
    h.page.drawChart();
    h.page.onWeightChartLongPress({ touches: [{ x: LEFT, y: 20 }] });
    assert.equal(h.page._weightChartPoints.length, 0);
    assert.equal(h.texts.length, 1);
    assert.equal(h.texts[0].text, '\u6682\u65e0\u6570\u636e');
  });

  test(`${pageName}: irregular dates use elapsed days, not record indexes`, () => {
    const h = createChart(pageName, [['2026-10-01', '2026-10-02', '2026-10-20']]);
    h.page.drawChart();
    const points = h.points();
    assert.equal(points.length, 3);
    closeTo(points[0].x, LEFT);
    closeTo(points[1].x, LEFT + WIDTH / 19);
    closeTo(points[2].x, LEFT + WIDTH);
    closeTo((points[2].x - points[1].x) / (points[1].x - points[0].x), 18);
    assert.ok(points[0].y > points[1].y && points[1].y > points[2].y);
    points.slice(1).forEach(point => {
      assert.ok(h.segments.some(segment => segment.x === point.x && segment.y === point.y));
    });
  });

  test(`${pageName}: both cats share one chronological axis with missing days`, () => {
    const h = createChart(pageName, [
      ['2026-10-20', '2026-10-01'],
      ['2026-10-25', '2026-10-01', '2026-10-10']
    ]);
    h.page.drawChart();
    const first = h.points(0);
    const second = h.points(1);
    assert.equal(first.length, 2);
    assert.equal(second.length, 3);
    closeTo(first[0].x, second[0].x);
    closeTo(first[1].x, LEFT + WIDTH * 19 / 24);
    closeTo(second[1].x, LEFT + WIDTH * 9 / 24);
    closeTo(second[2].x, LEFT + WIDTH);
  });

  for (const [description, dates, fraction] of [
    ['leap day', ['2024-02-28', '2024-02-29', '2024-03-01'], 1 / 2],
    ['year boundary', ['2025-12-31', '2026-01-01', '2026-01-03'], 1 / 3],
    ['daylight-saving boundary', ['2026-03-07', '2026-03-08', '2026-03-09'], 1 / 2]
  ]) {
    test(`${pageName}: calendar spacing survives ${description}`, () => {
      const h = createChart(pageName, [dates]);
      h.page.drawChart();
      closeTo(h.points()[1].x, LEFT + WIDTH * fraction);
      assert.equal(h.labels()[0].text, `${Number(dates[0].slice(5, 7))}/${Number(dates[0].slice(8))}`);
      assert.equal(h.labels().at(-1).text, `${Number(dates[2].slice(5, 7))}/${Number(dates[2].slice(8))}`);
    });
  }

  test(`${pageName}: dense labels do not overlap or hide data points`, () => {
    const dates = [1, 2, 3, 10, 11, 18, 19, 20].map(day => `2026-10-${String(day).padStart(2, '0')}`);
    const h = createChart(pageName, [dates]);
    h.page.drawChart();
    const labels = h.labels();
    assert.equal(h.points().length, dates.length);
    assert.ok(labels.length < dates.length);
    assert.equal(labels[0].text, '10/1');
    assert.equal(labels.at(-1).text, '10/20');
    labels.forEach((label, index) => {
      assert.equal(label.align, 'center');
      assert.ok(label.x - label.width / 2 >= LEFT);
      assert.ok(label.x + label.width / 2 <= LEFT + WIDTH);
      if (index > 0) {
        const previous = labels[index - 1];
        assert.ok(label.x - label.width / 2 >= previous.x + previous.width / 2 + 8);
      }
    });
  });

  test(`${pageName}: a single recorded day is centered for both cats`, () => {
    const h = createChart(pageName, [['2026-10-20'], ['2026-10-20']]);
    h.page.drawChart();
    closeTo(h.points(0)[0].x, LEFT + WIDTH / 2);
    closeTo(h.points(1)[0].x, LEFT + WIDTH / 2);
    assert.equal(h.labels().length, 1);
    assert.equal(h.labels()[0].text, '10/20');
    closeTo(h.labels()[0].x, LEFT + WIDTH / 2);
  });

  test(`${pageName}: a narrow chart still has a finite axis and readable label`, () => {
    const h = createChart(pageName, [['2026-10-01', '2026-10-02', '2026-10-20']], 100);
    h.page.drawChart();
    assert.equal(h.points().length, 3);
    assert.equal(h.labels().length, 1);
    h.arcs.forEach(point => assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y)));
  });

  test(`${pageName}: range changes filter records before rescaling the time axis`, () => {
    const dates = ['2026-06-01', '2026-08-01', '2026-10-10', '2026-10-20', '2026-10-24'];
    const h = createChart(pageName, [dates]);
    for (const [range, startIndex] of [['month', 2], ['3month', 1], ['all', 0]]) {
      h.page.onTimeRangeChange({ currentTarget: { dataset: { range } } });
      const points = h.points();
      const included = dates.slice(startIndex);
      assert.equal(points.length, included.length);
      const first = Date.parse(`${included[0]}T00:00:00Z`);
      const last = Date.parse(`${included.at(-1)}T00:00:00Z`);
      points.forEach((point, index) => {
        const time = Date.parse(`${included[index]}T00:00:00Z`);
        closeTo(point.x, LEFT + WIDTH * (time - first) / (last - first));
      });
    }
  });

  test(`${pageName}: empty records and an empty time range keep the no-data state`, () => {
    for (const records of [[], [['2020-01-01']]]) {
      const h = createChart(pageName, records);
      h.page.onTimeRangeChange({ currentTarget: { dataset: { range: 'month' } } });
      assert.equal(h.arcs.length, 0);
      assert.equal(h.texts.length, 1);
      assert.equal(h.texts[0].text, '\u6682\u65e0\u6570\u636e');
    }
  });
}

test('cat: play statistics retain the weekly filter', () => {
  const filename = path.join(__dirname, '..', 'pages', 'cat', 'cat.wxml');
  const template = fs.readFileSync(filename, 'utf8');
  assert.match(template, /bindtap="onPlayStatsRangeChange"\s+data-range="week"/);
  assert.equal(createChart('cat').page.data.playStatsRange, 'week');
});
