const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const event = id => ({ currentTarget: { dataset: { id } } });

function harness(pagePath) {
  let page;
  const requests = [];
  const timers = [];
  const app = {
    globalData: { token: 'edit-test-token', player: 'Pig' },
    _loginPromise: Promise.resolve(),
    getSystemInfo: () => ({ statusBarHeight: 24 })
  };
  const wx = {
    request: request => requests.push(request),
    showLoading() {}, hideLoading() {}, showToast() {}, navigateBack() {},
    getStorageSync() {}, setStorageSync() {},
    showModal: options => options.success({ confirm: true })
  };
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, exports: module.exports, wx, getApp: () => app, console,
      require: request => load(path.resolve(path.dirname(filename), `${request}.js`)),
      Page: definition => { page = definition; },
      setTimeout: callback => timers.push(callback),
      clearTimeout() {}
    }, { filename });
    return module.exports;
  }
  load(path.join(root, ...pagePath));
  page.data = plain(page.data);
  page.setData = (updates, callback) => {
    for (const [key, value] of Object.entries(updates)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = page.data;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)] = value;
    }
    if (callback) callback();
  };
  return {
    page, app, requests, timers,
    respond(index, data, statusCode = 200) {
      const request = requests[index];
      request.success({ statusCode, data });
      if (request.complete) request.complete();
    }
  };
}

function assertRequest(request, method, endpoint, data) {
  assert.equal(request.method, method);
  assert.equal(new URL(request.url).pathname, endpoint);
  assert.equal(request.header['X-Auth-Token'], 'edit-test-token');
  if (data) assert.deepEqual(plain(request.data), data);
}

test('yearly goal edit sends only title/year, while creation retains owner and default priority', async () => {
  const h = harness(['pages', 'plan', 'plan.js']);
  const original = {
    id: 'goal', title: '原目标', year: 2026, owner: 'Pig', priority: 2,
    completed: true, completedAt: '2026-01-02T00:00:00Z',
    subGoals: [{ id: 'sub', title: '子目标', completed: true }], ttl: -1
  };
  h.page.setData({ goalsPig: [original], goalCurrentYear: 2026 });
  h.page.fetchYearlyGoals = () => {};
  h.page.showEditGoalForm('goal');
  h.page.setData({ goalFormTitle: ' 新目标 ', goalFormYear: 2027 });
  const edit = h.page.submitGoalForm();
  await flush();
  assertRequest(h.requests[0], 'PUT', '/YearlyGoal/goal', { title: '新目标', year: 2027 });
  h.respond(0, {});
  await edit;
  assert.equal(original.completed, true);
  assert.equal(original.priority, 2);
  assert.equal(original.subGoals.length, 1);

  h.page.showAddGoalForm({ currentTarget: { dataset: { owner: 'Pig' } } });
  h.page.setData({ goalFormTitle: '新增', goalFormYear: 2026 });
  const create = h.page.submitGoalForm();
  await flush();
  assertRequest(h.requests[1], 'POST', '/YearlyGoal', {
    title: '新增', year: 2026, owner: 'Pig', priority: 10
  });
  h.respond(1, {});
  await create;
});

test('visited travel edit omits history and status; location switching and Pending creation stay explicit', async () => {
  const h = harness(['pages', 'plan', 'plan.js']);
  h.page.fetchTravelList = () => {};
  h.page.setData({
    countryList: ['日本'],
    travelList: [{
      id: 'travel', name: '备注', type: 'Domestic', priority: 0, status: 'Visited',
      domesticLocation: { province: '四川省', city: '成都市' },
      visitedDate: '2025-03-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z'
    }]
  });
  h.page.showEditTravelForm('travel');
  assert.equal(h.page.data.travelFormPriority, 0);
  const edit = h.page.submitTravelForm();
  await flush();
  assertRequest(h.requests[0], 'PUT', '/Travel/travel', {
    name: '备注', type: 'Domestic', priority: 0,
    domesticLocation: { province: '四川省', city: '成都市' }
  });
  h.respond(0, {});
  await edit;

  h.page.showEditTravelForm('travel');
  h.page.onTravelTypeChange({ detail: { value: '1' } });
  const switchType = h.page.submitTravelForm();
  await flush();
  assertRequest(h.requests[1], 'PUT', '/Travel/travel', {
    name: '备注', type: 'International', priority: 0, country: '日本'
  });
  h.respond(1, {});
  await switchType;

  h.page.showAddTravelForm();
  const create = h.page.submitTravelForm();
  await flush();
  assertRequest(h.requests[2], 'POST', '/Travel', {
    name: '', type: 'Domestic', priority: 1, status: 'Pending',
    domesticLocation: { province: '', city: '' }
  });
  h.respond(2, {});
  await create;
});

for (const tab of ['pending', 'visited']) {
  test(`travel ${tab} refresh makes exactly two reads, reusing lists for counts and preserving server order`, async () => {
    const h = harness(['pages', 'plan', 'plan.js']);
    h.page.setData({ travelTab: tab });
    const pending = h.page.fetchTravelList();
    await flush();
    assert.equal(h.requests.length, 2);
    assertRequest(h.requests[0], 'GET', '/Travel/status/Pending');
    assertRequest(h.requests[1], 'GET', '/Travel/status/Visited');
    const pendingList = [
      { id: 'p1', priority: 0, name: '首选', type: 'International', country: '日本' },
      { id: 'p2', priority: 4, name: '备选' }
    ];
    const visitedList = [
      { id: 'v1', visitedDate: '2026-03-01T00:00:00Z', name: '新记录' },
      { id: 'v2', visitedDate: '2025-01-01T00:00:00Z', name: '旧记录' },
      { id: 'v3', visitedDate: null, name: '未知日期' }
    ];
    h.respond(1, visitedList);
    h.respond(0, pendingList);
    await pending;
    assert.equal(h.page.data.pendingCount, 2);
    assert.equal(h.page.data.visitedCount, 3);
    assert.equal(h.page.data.loadingTravel, false);
    const expected = tab === 'pending' ? pendingList : visitedList;
    assert.deepEqual(plain(h.page.data.travelList.map(item => item.id)), expected.map(item => item.id));
    if (tab === 'pending') {
      assert.equal(h.page.data.travelList[0].displayName, '日本(首选)');
    } else {
      assert.equal(h.page.data.travelList[0].visitedDateFormatted, '2026-03');
      assert.equal(h.page.data.travelList[2].visitedDateFormatted, '');
    }
    assert.equal(h.requests.length, 2);
  });
}

test('travel uses the current tab after both responses arrive, and empty results reset counts', async () => {
  const h = harness(['pages', 'plan', 'plan.js']);
  const pending = h.page.fetchTravelList();
  await flush();
  h.page.setData({ travelTab: 'visited' });
  h.respond(0, [{ id: 'pending' }]);
  h.respond(1, [{ id: 'visited' }]);
  await pending;
  assert.equal(h.page.data.travelList[0].id, 'visited');

  const empty = h.page.fetchTravelList();
  await flush();
  h.respond(2, []);
  h.respond(3, []);
  await empty;
  assert.equal(h.requests.length, 4);
  assert.equal(h.page.data.travelList.length, 0);
  assert.equal(h.page.data.pendingCount, 0);
  assert.equal(h.page.data.visitedCount, 0);
});

test('travel mark-visited still uses its dedicated action, not the edit endpoint', async () => {
  const h = harness(['pages', 'plan', 'plan.js']);
  h.page.fetchTravelList = () => {};
  h.page.onMarkVisited(event('travel'));
  await flush();
  assert.equal(h.requests.length, 1);
  assertRequest(h.requests[0], 'POST', '/Travel/travel/visited', {});
  h.respond(0, {});
  await flush();
});

for (const completed of [true, false]) {
  test(`to-buy modal edit preserves completion by omission (stored ${completed})`, async () => {
    const h = harness(['pages', 'items', 'items.js']);
    h.page.fetchToBuyProducts = () => {};
    h.page.setData({ toBuyProducts: [{ id: 'item', name: '原名', priority: 0, description: '描述', completed }] });
    h.page.showEditToBuyForm(event('item'));
    h.page.onToBuyNameInput({ detail: { value: ' 新名 ' } });
    assert.equal(h.page.data.toBuyFormPriority, 0);
    const pending = h.page.submitToBuyForm();
    await flush();
    assertRequest(h.requests[0], 'PUT', '/ToBuy/item', { name: '新名', priority: 0, description: '描述' });
    h.respond(0, {});
    await pending;
    assert.equal(h.page.data.toBuyProducts[0].completed, completed);
  });

  test(`legacy to-buy edit omits completion after reading stored ${completed}`, async () => {
    const h = harness(['pages', 'tobuy', 'update.js']);
    h.page.setData({ id: 'item' });
    const read = h.page._fetchToBuy('item');
    await flush();
    h.respond(0, { id: 'item', Name: '原名', Priority: 0, Description: '描述', Completed: completed });
    await read;
    h.page.onNameInput({ detail: { value: '新名' } });
    const edit = h.page.submitForm();
    await flush();
    assertRequest(h.requests[1], 'PUT', '/ToBuy/item', { name: '新名', priority: 0, description: '描述' });
    h.respond(1, {});
    await edit;
  });

  test(`checkbox PUT explicitly changes completion from ${completed} to ${!completed}`, async () => {
    const h = harness(['pages', 'items', 'items.js']);
    h.page.setData({ toBuyProducts: [{ id: 'item', name: '原名', priority: 3, description: '', completed }] });
    h.page.toggleToBuyComplete(event('item'));
    await flush();
    assertRequest(h.requests[0], 'PUT', '/ToBuy/item', {
      name: '原名', priority: 3, description: '', completed: !completed
    });
    assert.equal(h.page.data.toBuyProducts[0].completed, !completed);
    h.respond(0, {});
    await flush();
  });
}

test('savings lifecycle is owned by the component rather than duplicated by plan onShow', () => {
  const h = harness(['pages', 'plan', 'plan.js']);
  h.page.selectComponent = () => { throw new Error('Parent must not refresh savings'); };
  h.page.setData({ currentTab: 'savings' });
  h.page.onShow();
  h.app.globalData.targetTab = 'savings';
  h.page.onShow();
  assert.equal(h.app.globalData.targetTab, null);
  assert.equal(h.page.data.currentTab, 'savings');
  assert.equal(h.requests.length, 0);
});
