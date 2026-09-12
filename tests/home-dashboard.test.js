const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {
  createHarness, dashboard, emptyData, flush, HOME_SECTIONS, NOW, ok, template, unavailable
} = require(path.join(__dirname, 'mini-program-harness.js'));

const sectionEvent = section => ({ currentTarget: { dataset: { section } } });
const selector = request => new URL(request.url).searchParams.get('sections');
const BACKEND_DETAIL = 'InternalBackendException: synthetic diagnostic detail';

async function load(harness, body = dashboard(), status = 200) {
  const pending = harness.page.fetchData();
  await flush();
  harness.respond(harness.requests.length - 1, status, body);
  await pending;
}

function visible(className, data) {
  const match = template.match(new RegExp(`<view class="${className}"[^\\n]*?wx:(?:if|elif)="{{(.*?)}}"`));
  assert.ok(match, `The ${className} template must have an explicit condition`);
  return Boolean(vm.runInNewContext(match[1], { ...data }));
}

function product(id, days) {
  return {
    id, name: `物品 ${id}`, category: 'Food',
    bestBy: new Date(NOW + days * 86400000).toISOString()
  };
}

function populatedData() {
  const savings = emptyData().savings;
  return {
    products: {
      expiredItems: Array.from({ length: 9 }, (_, index) => product(`expired-${index}`, -index - 1)),
      expiringSoonItems: [product('today', 0), product('soon', 2)]
    },
    toBuy: { count: 6 },
    goals: { pig: { total: 3, completed: 2 }, donkey: { total: 4, completed: 1 } },
    weights: [
      { personName: '豌豆黄', weight: 10.2, recordDate: new Date(NOW - 86400000).toISOString() },
      { personName: '小立夏', weight: 8.1, recordDate: new Date(NOW - 4 * 86400000).toISOString() }
    ],
    period: { status: 'waiting', averageCycleDays: 28.6, daysUntilNextPeriod: -2 },
    play: { ongoing: true },
    savings: {
      ...savings,
      hasSetup: true,
      netAssets: 123456.78,
      targetAmount: 200000,
      progressPercent: 61.72839,
      remainingToGoal: 76543.22,
      currentMonthStatus: { ...savings.currentMonthStatus, pigConfirmed: true, missingOwners: ['Donkey'] }
    }
  };
}

test('onShow uses one authenticated dashboard request and preserves summaries, dates and all reminders', async () => {
  const h = createHarness();
  h.page.onLoad();
  const pending = h.page.onShow();
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(new URL(h.requests[0].url).pathname, '/Home/dashboard');
  assert.equal(new URL(h.requests[0].url).search, '?year=2026');
  assert.equal(h.requests[0].method, 'GET');
  assert.equal(h.requests[0].header['X-Auth-Token'], 'initial-token');
  assert.equal(h.page.data.loading, true);
  assert.equal(h.page.data.allClear, false);
  assert.deepEqual(h.loading, []);

  const source = populatedData();
  h.respond(0, 200, dashboard(source));
  await pending;
  const data = h.page.data;
  assert.equal(data.loading, false);
  assert.equal(data.refreshing, false);
  assert.equal(data.navbarHeight, 78);
  assert.equal(data.toBuyCount, 6);
  assert.equal(data.pigTotal, 3);
  assert.equal(data.pigCompleted, 2);
  assert.equal(data.pigProgress, 67);
  assert.equal(data.donkeyTotal, 4);
  assert.equal(data.donkeyCompleted, 1);
  assert.equal(data.donkeyProgress, 25);
  assert.equal(data.periodStats.averageCycleDays, 29);
  assert.equal(data.periodStats.daysUntilNextPeriod, -2);
  assert.equal(source.period.averageCycleDays, 28.6);
  assert.deepEqual(data.catWeights, [
    { personName: '豌豆黄', weight: 10.2, dateText: '昨天' },
    { personName: '小立夏', weight: 8.1, dateText: '4天前' }
  ]);
  assert.deepEqual(data.expiredItems.map(item => item.id), source.products.expiredItems.map(item => item.id));
  assert.equal(data.expiredItems[0].daysText, '1天');
  assert.equal(data.expiredItems[8].daysText, '9天');
  assert.deepEqual(data.expiringSoonItems.map(item => item.daysText), ['今天', '2天']);
  assert.equal(data.savingsSummary.netAssetsText, '¥12.3万');
  assert.equal(data.savingsSummary.targetText, '¥20万');
  assert.equal(data.savingsSummary.remainingText, '¥7.7万');
  assert.equal(data.savingsSummary.progress, 61.7);
  assert.equal(data.savingsSummary.progressWidth, 61.72839);
  assert.equal(data.savingsSummary.checkInText, '猪猪已更新，等待毛驴');
  assert.equal(data.attentionCount, 13);
  assert.equal(data.attentionComplete, true);
  assert.equal(visible('all-clear-card', data), false);
  assert.deepEqual(data.failedSections, []);
  HOME_SECTIONS.forEach(section => assert.equal(data.sectionStates[section].status, 'ok'));
  ['totalItems', 'travelCount', 'goalsPig', 'goalsDonkey'].forEach(key => assert.ok(!(key in data)));
});

test('successful empty modules are distinct from unavailable modules in state and template', async () => {
  const h = createHarness();
  await load(h);
  const data = h.page.data;
  assert.equal(data.toBuyCount, 0);
  assert.equal(data.pigTotal, 0);
  assert.equal(data.donkeyTotal, 0);
  assert.equal(data.pigProgress, 0);
  assert.equal(data.periodStats.status, 'none');
  assert.deepEqual(data.catWeights, []);
  assert.equal(data.savingsSummary.hasSetup, false);
  assert.equal(data.savingsSummary.netAssetsText, '¥0');
  assert.equal(data.attentionCount, 0);
  assert.equal(visible('all-clear-card', data), true);
  assert.equal(visible('attention-incomplete', data), false);
  assert.equal(visible('life-card cat-card', data), true);
  assert.equal(visible('goals-note', data), true);
  assert.match(template, /还没有记录猫猫体重/);
  assert.match(template, /今年还没有年度目标/);
  assert.match(template, /wx:if="{{sectionStates\.toBuy\.status === 'ok'}}">{{toBuyCount}} 件待完成/);
  assert.match(template, /待买数量未加载/);
  HOME_SECTIONS.forEach(section => {
    assert.match(template, new RegExp(`sectionStates\\.${section}\\.status === 'error'`));
    assert.match(template, new RegExp(`data-section="${section}"`));
  });
  assert.doesNotMatch(template, /goalsPig|goalsDonkey|class="all-clear-card" wx:else/);
});

for (const section of ['products', 'play', 'savings']) {
  test(`${section} unavailable cannot produce an all-clear or an exact reminder total`, async () => {
    const h = createHarness();
    await load(h, dashboard({}, [section]));
    assert.equal(h.page.data.sectionStates[section].status, 'error');
    assert.equal(h.page.data.attentionCount, 0);
    assert.equal(h.page.data.attentionComplete, false);
    assert.equal(visible('all-clear-card', h.page.data), false);
    assert.equal(visible('attention-incomplete', h.page.data), true);
    assert.match(template, /{{attentionComplete \? '' : '已知 '}}{{attentionCount}} 件/);
    assert.deepEqual(h.page.data.failedSections, [section]);
  });
}

test('section-only retries retain healthy modules and ignore unrequested response keys', async () => {
  const h = createHarness();
  await load(h, dashboard(populatedData(), ['products', 'toBuy', 'weights']));
  const healthySavings = structuredClone(h.page.data.savingsSummary);
  const healthyPeriod = structuredClone(h.page.data.periodStats);
  assert.equal(h.page.data.toBuyCount, null);
  assert.equal(h.page.data.attentionCount, 2);
  assert.equal(h.page.data.attentionComplete, false);

  const retry = h.page.retryFailedSections(sectionEvent('weights'));
  assert.equal(h.page.retryFailedSections(sectionEvent('weights')), retry);
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(selector(h.requests[1]), 'weights');
  assert.equal(h.page.data.loading, false);
  assert.equal(h.page.data.refreshing, true);
  assert.equal(h.page.data.sectionStates.weights.loading, true);
  assert.equal(h.page.data.sectionStates.savings.loading, false);
  assert.deepEqual(h.page.data.savingsSummary, healthySavings);
  assert.deepEqual(h.page.data.periodStats, healthyPeriod);
  assert.equal(visible('savings-note', h.page.data), true);

  const response = dashboard({ weights: populatedData().weights }, [], ['weights']);
  response.sections.play = ok({ ongoing: false });
  response.sections.goals = null;
  h.respond(1, 200, response);
  await retry;
  assert.equal(h.page.data.catWeights.length, 2);
  assert.equal(h.page.data.playStatus.ongoing, true);
  assert.deepEqual(h.page.data.failedSections, ['products', 'toBuy']);
  await h.page.retryFailedSections(sectionEvent('savings'));
  await h.page.retryFailedSections(sectionEvent('unknown'));
  assert.equal(h.requests.length, 2);

  const retryRemaining = h.page.retryFailedSections();
  await flush();
  assert.equal(selector(h.requests[2]), 'products,toBuy');
  h.respond(2, 503, dashboard({}, ['products', 'toBuy'], ['products', 'toBuy']));
  await retryRemaining;
  assert.deepEqual(h.page.data.failedSections, ['products', 'toBuy']);
  assert.deepEqual(h.page.data.savingsSummary, healthySavings);
  assert.equal(h.page.data.catWeights.length, 2);
  assert.equal(h.page.data.toBuyCount, null);

  const recover = h.page.retryFailedSections();
  await flush();
  assert.equal(selector(h.requests[3]), 'products,toBuy');
  h.respond(3, 200, dashboard({}, [], ['products', 'toBuy']));
  await recover;
  assert.deepEqual(h.page.data.failedSections, []);
  assert.equal(h.page.data.toBuyCount, 0);
  assert.equal(h.page.data.attentionComplete, true);
  assert.equal(h.page.data.attentionCount, 2);
  assert.equal(h.maxActiveRequests, 1);
});

test('all-failed 503 preserves the section envelope rather than reporting successful zeros', async () => {
  const h = createHarness();
  const response = dashboard({}, HOME_SECTIONS);
  response.sections.play = unavailable('dependency_unavailable');
  await load(h, response, 503);
  assert.equal(h.requests.length, 1);
  assert.equal(h.page.data.requestId, response.requestId);
  assert.deepEqual(h.page.data.failedSections, HOME_SECTIONS);
  assert.equal(h.page.data.toBuyCount, null);
  assert.equal(h.page.data.pigTotal, null);
  assert.equal(h.page.data.periodStats, null);
  assert.equal(h.page.data.playStatus, null);
  assert.equal(h.page.data.savingsSummary, null);
  assert.equal(h.page.data.sectionStates.play.error, '模块暂不可用，请重试');
  assert.equal(h.page.data.sectionStates.weights.error, '模块加载超时，请重试');
  assert.equal(visible('all-clear-card', h.page.data), false);
  assert.deepEqual(h.toasts, []);
});

for (const status of [200, 503]) {
  test(`HTTP ${status} section errors use local messages without exposing backend details`, async () => {
    const h = createHarness();
    const failed = status === 503 ? HOME_SECTIONS : ['products', 'play'];
    const response = dashboard({}, failed);
    failed.forEach((section, index) => {
      response.sections[section] = unavailable(index % 2 ? 'dependency_unavailable' : 'timeout');
      response.sections[section].error.message = `${BACKEND_DETAIL} (${section})`;
    });
    await load(h, response, status);
    failed.forEach((section, index) => {
      assert.equal(
        h.page.data.sectionStates[section].error,
        index % 2 ? '模块暂不可用，请重试' : '模块加载超时，请重试'
      );
    });
    assert.ok(!JSON.stringify(h.page.data).includes(BACKEND_DETAIL));
    assert.ok(!JSON.stringify(h.updates).includes(BACKEND_DETAIL));
    assert.deepEqual(h.toasts, []);
  });
}

test('unknown section error codes use a safe fallback instead of backend details', async () => {
  const h = createHarness();
  const response = dashboard({}, ['products']);
  response.sections.products.error = {
    code: 'backend_exception', message: BACKEND_DETAIL, retryable: true
  };
  await load(h, response);
  assert.equal(h.page.data.sectionStates.products.error, '返回数据不完整，请重试');
  assert.ok(!JSON.stringify(h.updates).includes(BACKEND_DETAIL));
  assert.equal(h.page.data.allClear, false);
  assert.deepEqual(h.toasts, []);
});

test('network exhaustion is explicit after the existing two GET retries, with no legacy fallback', async () => {
  const h = createHarness();
  const pending = h.page.fetchData();
  await flush();
  h.fail(0);
  await h.runTimer(600);
  h.fail(1);
  await h.runTimer(1500);
  h.fail(2);
  await pending;
  assert.equal(h.requests.length, 3);
  assert.ok(h.requests.every(request => request.url === h.requests[0].url));
  assert.equal(h.timers.length, 0);
  assert.match(h.page.data.dashboardError, /网络连接失败/);
  assert.deepEqual(h.page.data.failedSections, HOME_SECTIONS);
  assert.equal(h.page.data.toBuyCount, null);
  assert.equal(h.page.data.allClear, false);
  assert.deepEqual(h.toasts, []);
});

for (const status of [400, 404, 500, 503]) {
  test(`global HTTP ${status} errors remain visible without fallback requests`, async () => {
    const h = createHarness();
    await load(h, { message: BACKEND_DETAIL }, status);
    assert.equal(h.requests.length, 1);
    assert.ok(h.page.data.dashboardError);
    assert.deepEqual(h.page.data.failedSections, HOME_SECTIONS);
    assert.equal(h.page.data.toBuyCount, null);
    assert.equal(h.page.data.allClear, false);
    assert.ok(!JSON.stringify(h.updates).includes(BACKEND_DETAIL));
    assert.deepEqual(h.toasts, []);
  });
}

test('a global failure on a section retry does not erase healthy modules', async () => {
  const h = createHarness();
  await load(h, dashboard(populatedData(), ['period']));
  const before = structuredClone(h.page.data.savingsSummary);
  const retry = h.page.retryFailedSections(sectionEvent('period'));
  await flush();
  h.respond(1, 500, { message: 'Unexpected failure' });
  await retry;
  assert.equal(selector(h.requests[1]), 'period');
  assert.deepEqual(h.page.data.failedSections, ['period']);
  assert.deepEqual(h.page.data.savingsSummary, before);
  assert.equal(h.page.data.toBuyCount, 6);
  assert.equal(h.page.data.expiredItems.length, 9);
  assert.ok(h.page.data.dashboardError);
});

for (const [section, value] of Object.entries({
  products: { expiredItems: [], expiringSoonItems: [{ id: 'bad', name: 'bad', category: 'Food', bestBy: null }] },
  toBuy: { count: '0' },
  goals: { pig: { total: 1, completed: 2 }, donkey: { total: 0, completed: 0 } },
  weights: { records: [] },
  period: { status: 'waiting', averageCycleDays: 28, daysUntilNextPeriod: 'unknown' },
  play: { ongoing: 'false' },
  savings: { ...emptyData().savings, currentMonthStatus: null }
})) {
  test(`malformed ${section} data is unavailable, not a successful empty module`, async () => {
    const h = createHarness();
    await load(h, dashboard({ [section]: value }));
    assert.equal(h.page.data.sectionStates[section].status, 'error');
    assert.match(h.page.data.sectionStates[section].error, /数据不完整/);
    assert.deepEqual(h.page.data.failedSections, [section]);
    HOME_SECTIONS.filter(key => key !== section).forEach(key => {
      assert.equal(h.page.data.sectionStates[key].status, 'ok');
    });
  });
}

test('missing requested sections and invalid envelopes cannot silently succeed', async () => {
  const h = createHarness();
  const response = dashboard();
  delete response.sections.products;
  response.sections.toBuy = null;
  response.sections.play = { status: 'error', data: null, error: null };
  await load(h, response);
  assert.deepEqual(h.page.data.failedSections, ['products', 'toBuy', 'play']);
  assert.equal(h.page.data.toBuyCount, null);
  assert.equal(h.page.data.allClear, false);
  assert.equal(h.page.data.sectionStates.savings.status, 'ok');

  for (const body of [null, {}, { sections: {} }, { requestId: 'invalid', partial: false, sections: [] }]) {
    await load(h, body);
    assert.deepEqual(h.page.data.failedSections, HOME_SECTIONS);
    assert.match(h.page.data.dashboardError, /数据不完整/);
  }
});

test('503 cannot introduce successful data even if its body contains ok sections', async () => {
  const h = createHarness();
  await load(h, dashboard({ toBuy: { count: 100 } }), 503);
  assert.equal(h.page.data.toBuyCount, null);
  assert.deepEqual(h.page.data.failedSections, HOME_SECTIONS);
  assert.ok(h.page.data.dashboardError);
});

test('normal refreshes are serialized, coalesced and render only the newest onShow result', async () => {
  const h = createHarness();
  const first = h.page.onShow();
  await flush();
  const afterWrite = h.page.onShow();
  const newest = h.page.onShow();
  assert.equal(first, afterWrite);
  assert.equal(first, newest);
  assert.equal(h.requests.length, 1);
  h.respond(0, 200, dashboard({ toBuy: { count: 99 } }));
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(selector(h.requests[1]), null);
  assert.equal(h.page.data.toBuyCount, null);
  assert.equal(h.page.data.loading, true);
  assert.ok(!h.updates.some(update => update.toBuyCount === 99));
  h.respond(1, 200, dashboard({ toBuy: { count: 7 } }));
  await Promise.all([first, afterWrite, newest]);
  assert.equal(h.page.data.toBuyCount, 7);
  assert.equal(h.page.data.loading, false);
  assert.equal(h.maxActiveRequests, 1);
});

test('returning from a write supersedes an in-flight retry without hiding healthy data', async () => {
  const h = createHarness();
  await load(h, dashboard(populatedData(), ['weights']));
  const previousSavings = structuredClone(h.page.data.savingsSummary);
  const retry = h.page.retryFailedSections(sectionEvent('weights'));
  await flush();
  const afterWrite = h.page.onShow();
  h.respond(1, 200, dashboard({ weights: [] }, [], ['weights']));
  await flush();
  assert.equal(h.requests.length, 3);
  assert.equal(selector(h.requests[2]), null);
  assert.equal(h.page.data.sectionStates.weights.status, 'error');
  assert.equal(h.page.data.loading, false);
  assert.equal(h.page.data.refreshing, true);
  assert.deepEqual(h.page.data.savingsSummary, previousSavings);
  h.respond(2, 200, dashboard({ ...populatedData(), toBuy: { count: 15 } }));
  await Promise.all([retry, afterWrite]);
  assert.equal(h.page.data.toBuyCount, 15);
  assert.equal(h.page.data.catWeights.length, 2);
  assert.equal(h.page.data.refreshing, false);
  assert.equal(h.maxActiveRequests, 1);
});

test('an old failure cannot overwrite a newer refresh, and a newer failure cannot show old zeros', async () => {
  const h = createHarness();
  const first = h.page.fetchData();
  await flush();
  h.page.fetchData();
  h.respond(0, 500, { message: 'Old failure' });
  await flush();
  assert.equal(h.page.data.dashboardError, '');
  h.respond(1, 200, dashboard({ toBuy: { count: 5 } }));
  await first;
  assert.equal(h.page.data.toBuyCount, 5);

  const next = h.page.fetchData();
  await flush();
  h.page.fetchData();
  h.respond(2, 200, dashboard());
  await flush();
  assert.equal(h.page.data.toBuyCount, 5);
  assert.equal(visible('all-clear-card', h.page.data), false);
  h.respond(3, 503, dashboard({}, HOME_SECTIONS));
  await next;
  assert.equal(h.page.data.toBuyCount, null);
  assert.equal(h.page.data.allClear, false);
});

test('a refresh arriving during promise finalization is not dropped', async () => {
  const h = createHarness();
  const setData = h.page.setData;
  let queued = false;
  h.page.setData = patch => {
    setData(patch);
    if (!queued && patch.loading === false && patch.refreshing === false) {
      queued = true;
      queueMicrotask(() => h.page.onShow());
    }
  };
  const first = h.page.fetchData();
  await flush();
  h.respond(0, 200, dashboard({ toBuy: { count: 1 } }));
  await flush();
  assert.equal(h.requests.length, 2);
  h.respond(1, 200, dashboard({ toBuy: { count: 2 } }));
  await first;
  assert.equal(h.page.data.toBuyCount, 2);
  assert.equal(h.maxActiveRequests, 1);
});

test('unloaded pages ignore in-flight replies and do not run a queued refresh', async () => {
  const h = createHarness();
  const pending = h.page.fetchData();
  await flush();
  h.page.fetchData();
  h.page.onUnload();
  const updatesBefore = h.updates.length;
  h.respond(0, 200, dashboard({ toBuy: { count: 99 } }));
  await pending;
  await h.page.fetchData();
  assert.equal(h.updates.length, updatesBefore);
  assert.equal(h.requests.length, 1);
});

test('savings formatting retains negative amounts, rounding, capped bars and check-in wording', async () => {
  const cases = [
    [false, false, '本月还未盘点'],
    [true, false, '猪猪已更新，等待毛驴'],
    [false, true, '毛驴已更新，等待猪猪'],
    [true, true, '本月双人盘点已完成']
  ];
  const h = createHarness();
  for (const [pigConfirmed, donkeyConfirmed, text] of cases) {
    const savings = emptyData().savings;
    savings.hasSetup = true;
    savings.netAssets = -15000;
    savings.progressPercent = 125.678;
    savings.remainingToGoal = -20;
    Object.assign(savings.currentMonthStatus, { pigConfirmed, donkeyConfirmed });
    await load(h, dashboard({ savings }));
    assert.equal(h.page.data.savingsSummary.netAssetsText, '-¥1.5万');
    assert.equal(h.page.data.savingsSummary.progress, 125.7);
    assert.equal(h.page.data.savingsSummary.progressWidth, 100);
    assert.equal(h.page.data.savingsSummary.remainingText, '¥0');
    assert.equal(h.page.data.savingsSummary.checkInText, text);
    assert.equal(h.page.data.attentionCount, 1);
  }
  const savings = { ...emptyData().savings, netAssets: 9999.4, progressPercent: -10 };
  await load(h, dashboard({ savings }));
  assert.equal(h.page.data.savingsSummary.netAssetsText, '¥9,999');
  assert.equal(h.page.data.savingsSummary.progress, 0);
  assert.equal(h.page.data.savingsSummary.progressWidth, 0);
  assert.equal(h.page.data.attentionCount, 0);
});

test('period none/in-period semantics and missing-cat behavior survive compact summaries', async () => {
  const h = createHarness();
  await load(h, dashboard({
    period: { status: 'in-period', averageCycleDays: null, daysUntilNextPeriod: null },
    weights: [{ personName: '小立夏', weight: 8, recordDate: new Date(NOW).toISOString() }]
  }));
  assert.equal(h.page.data.periodStats.status, 'in-period');
  assert.equal(h.page.data.periodStats.averageCycleDays, null);
  assert.deepEqual(h.page.data.catWeights, [{ personName: '小立夏', weight: 8, dateText: '今天' }]);
  assert.deepEqual(h.page.data.failedSections, []);
});

test('a valid waiting period without a prediction remains available, not overdue or failed', async () => {
  const h = createHarness();
  await load(h, dashboard({
    period: { status: 'waiting', averageCycleDays: 28, daysUntilNextPeriod: null }
  }));
  assert.equal(h.page.data.sectionStates.period.status, 'ok');
  assert.equal(h.page.data.periodStats.daysUntilNextPeriod, null);
  assert.deepEqual(h.page.data.failedSections, []);
  assert.match(template, /wx:elif="{{periodStats\.daysUntilNextPeriod === null}}">暂无预测日期/);

  await load(h, dashboard({
    period: { status: 'unknown', averageCycleDays: 28, daysUntilNextPeriod: 3 }
  }));
  assert.equal(h.page.data.sectionStates.period.status, 'error');
});
