const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createSavings({ delayCanvas = false } = {}) {
  const filename = path.join(__dirname, '..', 'components', 'retirement-savings', 'retirement-savings.js');
  const requireFromComponent = createRequire(filename);
  const calls = [];
  const events = [];
  const updates = [];
  const canvasCallbacks = [];
  const api = Object.fromEntries(['get', 'post', 'put', 'del'].map(method => [method, (url, ...args) => {
    const request = deferred();
    calls.push({ method, url, args, ...request });
    return request.promise;
  }]));
  const app = { globalData: { player: 'Pig' } };
  const wx = {
    showToast() {},
    setStorageSync() {},
    nextTick(callback) { callback(); },
    createSelectorQuery() {
      return {
        in() { return this; },
        select() { return this; },
        fields() { return this; },
        exec(callback) {
          if (delayCanvas) canvasCallbacks.push(callback);
          else callback([]);
        }
      };
    }
  };
  let definition;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require(name) {
      return name === '../../utils/api' ? api : requireFromComponent(name);
    },
    getApp: () => app,
    wx,
    Component(value) { definition = value; }
  }, { filename });
  const component = {
    ...definition.methods,
    data: structuredClone(definition.data),
    setData(patch, callback) {
      updates.push(patch);
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    triggerEvent(name, detail) { events.push({ name, detail }); }
  };
  return {
    component, calls, events, updates, canvasCallbacks, wx,
    attach: () => definition.lifetimes.attached.call(component),
    detach: () => definition.lifetimes.detached.call(component),
    show: () => definition.pageLifetimes.show.call(component),
    hide: () => definition.pageLifetimes.hide.call(component),
    parentShow(targetTab) {
      const pageFilename = path.join(__dirname, '..', 'pages', 'plan', 'plan.js');
      const requireFromPage = createRequire(pageFilename);
      let page;
      vm.runInNewContext(fs.readFileSync(pageFilename, 'utf8'), {
        require(name) { return name === '../../utils/api' ? api : requireFromPage(name); },
        wx, getApp: () => app,
        Page(value) { page = value; }
      }, { filename: pageFilename });
      page.data = structuredClone(page.data);
      page.data.currentTab = 'savings';
      page.setData = patch => Object.assign(page.data, patch);
      page.selectComponent = () => component;
      app.globalData.targetTab = targetTab;
      page.onShow();
    }
  };
}

function overview(amount = 1200, trendAmount = amount) {
  return {
    dashboard: {
      accounts: [{
        id: 'pig-card', name: 'test card', owner: 'Pig', category: 'BankCard', currentAmount: amount
      }],
      netAssets: amount, grossAssets: amount, pigAssets: amount, donkeyAssets: 0,
      goal: { targetAmount: 10000 }, progressPercent: amount / 100,
      remainingToGoal: 10000 - amount,
      currentMonthStatus: { month: '2026-10', pigConfirmed: false, missingOwners: ['Pig', 'Donkey'] }
    },
    trends: trends(trendAmount)
  };
}

function trends(amount = 1200) {
  return { points: [{ month: '2026-10', amount, isProvisional: true }], owner: 'all', category: 'all' };
}

const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('formats zero, integer trailing zeros, signs, decimals and existing unit boundaries', () => {
  const { component: c } = createSavings();
  for (const [amount, expected] of [
    [0, '¥ 0'], [10, '¥ 10'], [1000, '¥ 1,000'], [1200, '¥ 1,200'],
    [-10, '-¥ 10'], [-1200, '-¥ 1,200'], [1200.1, '¥ 1,200.1'],
    [1200.25, '¥ 1,200.25'], [-1200.25, '-¥ 1,200.25'], [12.345, '¥ 12.35'],
    [9999.99, '¥ 9,999.99'], [9999.999, '¥ 10,000'], [10000, '¥ 1 万'],
    [10001, '¥ 1 万'], [12000, '¥ 1.2 万'], [100000, '¥ 10 万'],
    [-100000, '-¥ 10 万'], [10000000, '¥ 1000 万']
  ]) assert.equal(c._formatRmb(amount), expected, String(amount));
  for (const value of [0, 10, 1000, 1200, -1200]) {
    assert.equal(c._trimNumber(value, 0), String(value));
    assert.equal(c._trimNumber(value, 2), String(value));
  }
  assert.equal(c._trimNumber(12.3, 2), '12.3');
  assert.equal(c._trimNumber(99.96), '100');
  for (const [amount, expected] of [[0, '0'], [1000, '1k'], [1200, '1.2k'], [10000, '1万'], [100000, '10万'], [-100000, '-10万']]) {
    assert.equal(c._formatAxis(amount), expected);
  }
});

test('attached, page show and real parent onShow issue exactly one initial overview', async () => {
  const h = createSavings();
  const loading = h.attach();
  h.show();
  h.parentShow();
  h.parentShow('savings');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].method, 'get');
  assert.equal(h.calls[0].url, '/RetirementSavings/overview?range=6m&owner=all&category=all');
  assert.equal(h.calls[0].args[0].showLoading, false);
  const response = overview();
  h.calls[0].resolve(response);
  await loading;
  h.show();
  assert.equal(h.calls.length, 1);
  assert.equal(h.component.data.dashboard, response.dashboard);
  assert.equal(h.component.data.accounts, response.dashboard.accounts);
  assert.equal(h.component.data.dashboardView.netAssetsText, '¥ 1,200');
  assert.equal(h.component.data.accountGroups[0].categories[0].accounts[0].amountText, '¥ 1,200');
  assert.equal(h.component.data.trendPoints[0].amount, 1200);
  assert.equal(h.component.data.loading, false);
  assert.equal(h.component.data.trendLoading, false);
  assert.equal(h.events.length, 1);
});

test('page return and explicit full refresh each fetch one overview, never legacy inputs', async () => {
  const h = createSavings();
  const initial = h.attach();
  h.calls[0].resolve(overview());
  await initial;
  h.hide();
  const returned = h.show();
  h.parentShow();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve(overview(2000));
  await returned;
  const refreshed = h.component.refresh();
  assert.equal(h.calls.length, 3);
  h.calls[2].resolve(overview(3000));
  await refreshed;
  assert.equal(h.component.data.dashboard.netAssets, 3000);
  assert.ok(h.calls.every(call => call.url.startsWith('/RetirementSavings/overview?')));
});

test('filter changes only request trends, preserving the existing dashboard and accounts', async () => {
  const h = createSavings();
  const initial = h.attach();
  h.calls[0].resolve(overview());
  await initial;
  const dashboard = h.component.data.dashboard;
  const accounts = h.component.data.accounts;
  for (const [group, value, query] of [
    ['trendOwner', 'Pig', 'range=6m&owner=Pig&category=all'],
    ['trendCategory', 'Stock', 'range=6m&owner=Pig&category=Stock'],
    ['trendRange', 'all', 'range=all&owner=Pig&category=Stock']
  ]) {
    h.component.onTrendFilter({ currentTarget: { dataset: { group, value } } });
    const call = h.calls.at(-1);
    assert.equal(call.url, `/RetirementSavings/trends?${query}`);
    call.resolve(trends(88));
    await flush();
    assert.equal(h.component.data.dashboard, dashboard);
    assert.equal(h.component.data.accounts, accounts);
    assert.equal(h.component.data.trendPoints[0].amount, 88);
  }
  assert.equal(h.calls.length, 4);
  assert.match(h.component.data.trendDescription, /股票基金.*全部/);
  const refreshing = h.component.refresh();
  assert.equal(h.calls[4].url, '/RetirementSavings/overview?range=all&owner=Pig&category=Stock');
  h.calls[4].resolve(overview(1500, 99));
  await refreshing;
  assert.equal(h.component.data.trendPoints[0].amount, 99);
});

test('failed and incomplete overview responses are errors, with no fallback fan-out', async () => {
  for (const response of [undefined, {}, { dashboard: { accounts: [] } }, { dashboard: { accounts: [] }, trends: {} }]) {
    const h = createSavings();
    const loading = h.attach();
    h.calls[0].resolve(response);
    await loading;
    assert.ok(h.component.data.error);
    assert.equal(h.component.data.dashboard, null);
    assert.equal(h.component.data.loading, false);
    assert.equal(h.component.data.trendLoading, false);
    assert.equal(h.calls.length, 1);
    assert.equal(h.events.length, 0);
  }
  const h = createSavings();
  const failed = h.attach();
  h.calls[0].reject(new Error('认证失败，请重新打开小程序'));
  await failed;
  assert.equal(h.component.data.error, '认证失败，请重新打开小程序');
  assert.equal(h.calls.length, 1);
  h.component.retryLoad();
  h.calls[1].resolve(overview());
  await flush();
  assert.equal(h.component.data.error, '');
  assert.equal(h.component.data.dashboard.netAssets, 1200);
});

test('a valid zero-amount overview remains distinguishable from failed data', async () => {
  const h = createSavings();
  const initial = h.attach();
  const response = overview(0);
  response.dashboard.accounts = [];
  response.dashboard.goal = null;
  response.trends.points = [];
  h.calls[0].resolve(response);
  await initial;
  assert.equal(h.component.data.error, '');
  assert.equal(h.component.data.dashboardView.netAssetsText, '¥ 0');
  assert.equal(h.component.data.dashboardView.hasGoal, false);
  assert.equal(h.component.data.accounts.length, 0);
  assert.equal(h.component.data.trendPoints.length, 0);
});

test('standalone trend failure retains a healthy dashboard and can be retried', async () => {
  const h = createSavings();
  const initial = h.attach();
  h.calls[0].resolve(overview());
  await initial;
  const dashboard = h.component.data.dashboard;
  const oldPoints = h.component.data.trendPoints;
  const loading = h.component.loadTrends();
  h.calls[1].reject(new Error('offline'));
  await loading;
  assert.equal(h.component.data.dashboard, dashboard);
  assert.equal(h.component.data.trendPoints, oldPoints);
  assert.equal(h.component.data.error, '');
  assert.ok(h.component.data.trendError);
  h.component.retryTrends();
  h.calls[2].resolve(trends(2000));
  await flush();
  assert.equal(h.calls.length, 3);
  assert.equal(h.component.data.trendError, '');
  assert.equal(h.component.data.trendPoints[0].amount, 2000);
});

test('old overview does not overwrite newer filter data or clear its pending state', async () => {
  for (const filterFirst of [true, false]) {
    const h = createSavings();
    const initial = h.attach();
    h.component.onTrendFilter({ currentTarget: { dataset: { group: 'trendOwner', value: 'Pig' } } });
    if (filterFirst) {
      h.calls[1].resolve(trends(42));
      await flush();
    }
    h.calls[0].resolve(overview(1200, 999));
    await initial;
    assert.equal(h.component.data.dashboard.netAssets, 1200);
    if (!filterFirst) {
      assert.equal(h.component.data.trendLoading, true);
      h.calls[1].resolve(trends(42));
      await flush();
    }
    assert.equal(h.component.data.trendPoints[0].amount, 42);
    assert.match(h.component.data.trendDescription, /猪/);
  }
});

test('old overview failure does not damage newer successful filtered trends', async () => {
  const h = createSavings();
  const initial = h.attach();
  const filtered = h.component.loadTrends();
  h.calls[1].resolve(trends(25));
  await filtered;
  h.calls[0].reject(new Error('overview failed'));
  await initial;
  assert.ok(h.component.data.error);
  assert.equal(h.component.data.trendError, '');
  assert.equal(h.component.data.trendLoading, false);
  assert.equal(h.component.data.trendPoints[0].amount, 25);
});

test('overlapping full refreshes keep the newest result, including old failures', async () => {
  for (const oldFails of [false, true]) {
    const h = createSavings();
    const old = h.attach();
    const latest = h.component.refresh();
    assert.equal(h.calls.length, 2);
    h.calls[1].resolve(overview(3000));
    await latest;
    if (oldFails) h.calls[0].reject(new Error('stale failure'));
    else h.calls[0].resolve(overview(1000));
    await old;
    assert.equal(h.component.data.dashboard.netAssets, 3000);
    assert.equal(h.component.data.trendPoints[0].amount, 3000);
    assert.equal(h.component.data.error, '');
    assert.equal(h.events.length, 1);
  }
});

test('an older full refresh completing first cannot finish a newer pending load', async () => {
  const h = createSavings();
  const old = h.attach();
  const latest = h.component.refresh();
  h.calls[0].resolve(overview(1));
  await old;
  assert.equal(h.component.data.dashboard, null);
  assert.equal(h.component.data.loading, true);
  assert.equal(h.component.data.trendLoading, true);
  h.calls[1].resolve(overview(3000));
  await latest;
  assert.equal(h.component.data.dashboard.netAssets, 3000);
});

test('a successful write always starts a fresh overview while an older read is in flight', async () => {
  const h = createSavings();
  const initial = h.attach();
  h.component.setData({ canEditShared: true, goalInput: '20000' });
  h.component.saveGoal();
  assert.equal(h.calls[1].method, 'put');
  assert.equal(h.calls[1].url, '/RetirementSavings/goal');
  h.calls[1].resolve({ targetAmount: 20000 });
  await flush();
  assert.equal(h.calls.length, 3);
  assert.ok(h.calls[2].url.startsWith('/RetirementSavings/overview?'));
  h.calls[2].resolve(overview(4000));
  await flush();
  h.calls[0].resolve(overview(1000));
  await initial;
  assert.equal(h.component.data.dashboard.netAssets, 4000);
});

test('filter responses cannot overwrite newer filters or a newer full refresh', async () => {
  for (const newerIsOverview of [false, true]) {
    const h = createSavings();
    const old = h.component.loadTrends();
    h.component.setData({ trendOwner: 'Donkey' });
    const latest = newerIsOverview ? h.component.refresh() : h.component.loadTrends();
    h.calls[1].resolve(newerIsOverview ? overview(4500, 75) : trends(75));
    await latest;
    h.calls[0].resolve(trends(1));
    await old;
    assert.equal(h.component.data.trendPoints[0].amount, 75);
    assert.match(h.component.data.trendDescription, /驴/);
  }
});

test('late successes and failures cannot clear a newer filter error or success', async () => {
  const h = createSavings();
  const initial = h.attach();
  const filtered = h.component.loadTrends();
  h.calls[1].reject(new Error('latest filter failed'));
  await filtered;
  const error = h.component.data.trendError;
  h.calls[0].resolve(overview());
  await initial;
  assert.equal(h.component.data.trendError, error);
  assert.equal(h.component.data.trendPoints.length, 0);
  const old = h.component.loadTrends();
  const latest = h.component.loadTrends();
  h.calls[3].resolve(trends(75));
  await latest;
  h.calls[2].reject(new Error('old filter failed'));
  await old;
  assert.equal(h.component.data.trendError, '');
  assert.equal(h.component.data.trendPoints[0].amount, 75);
});

test('detach suppresses pending successes and failures and does not allow refresh to resurrect the component', async () => {
  for (const failed of [false, true]) {
    const h = createSavings();
    const loading = h.attach();
    const filtering = h.component.loadTrends();
    h.detach();
    const count = h.updates.length;
    if (failed) {
      h.calls[0].reject(new Error('detached overview'));
      h.calls[1].reject(new Error('detached trends'));
    } else {
      h.calls[0].resolve(overview());
      h.calls[1].resolve(trends());
    }
    await Promise.all([loading, filtering, h.component.refresh(), h.component.loadTrends()]);
    assert.equal(h.updates.length, count);
    assert.equal(h.calls.length, 2);
    assert.equal(h.events.length, 0);
    assert.equal(h.component.ctx, null);
  }
});

test('reattachment invalidates old requests and deferred canvas callbacks', async () => {
  const h = createSavings({ delayCanvas: true });
  const old = h.attach();
  const oldTrend = h.component.loadTrends();
  h.calls[1].resolve(trends(50));
  await oldTrend;
  assert.equal(h.canvasCallbacks.length, 1);
  h.detach();
  const latest = h.attach();
  h.calls[2].resolve(overview(9000));
  await latest;
  h.calls[0].resolve(overview(1));
  await old;
  let touched = false;
  h.canvasCallbacks[0]([{ width: 100, height: 100, node: { getContext() { touched = true; } } }]);
  assert.equal(touched, false);
  assert.equal(h.component.data.dashboard.netAssets, 9000);
});
