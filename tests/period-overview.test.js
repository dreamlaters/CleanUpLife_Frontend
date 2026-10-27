const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { createPageHarness } = require('./page-harness');
const { createHarness, flush } = require('./mini-program-harness');

function overview(records = [], status = 'none') {
  return {
    records,
    stats: {
      status,
      totalRecords: records.length,
      averageCycleDays: records.length ? 27.6 : 28,
      averagePeriodDays: 6,
      lastRecord: records[0] || null,
      daysUntilNextPeriod: null,
      predictedPeriods: []
    }
  };
}

function health(api) {
  const h = createPageHarness(path.join('pages', 'health', 'health.js'), {
    getPeriodList() { assert.fail('The page must not call the legacy list endpoint'); },
    getPeriodStats() { assert.fail('The page must not call the legacy stats endpoint'); },
    ...api
  });
  h.page.onLoad({});
  return h;
}

test('API overview wrapper makes one authenticated request and retains caller options', async () => {
  const h = createHarness();
  const body = overview();
  const pending = h.api.getPeriodOverview({ showErrorToast: false });
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(new URL(h.requests[0].url).pathname, '/Period/overview');
  assert.equal(h.requests[0].header['X-Auth-Token'], 'initial-token');
  assert.deepEqual(h.loading, []);
  h.respond(0, 200, body);
  assert.equal(await pending, body);
});

test('overview failure remains an error and never fans out to the legacy endpoints', async () => {
  const h = createHarness();
  const rejected = assert.rejects(h.api.getPeriodOverview(), error => error.statusCode === 503);
  await flush();
  h.respond(0, 503, { message: 'Unavailable' });
  await rejected;
  assert.equal(h.requests.length, 1);
  assert.equal(h.toasts.length, 1);
});

test('the page loads records and stats together and keeps the calendar and ongoing-day display', async () => {
  const calls = [];
  const records = [
    { id: 'latest', startDate: '2026-10-24T00:00:00', endDate: null, cycleDays: 17, periodDays: null },
    { id: 'older', startDate: '2026-09-26T00:00:00', endDate: '2026-10-01T00:00:00', cycleDays: 28, periodDays: 6 }
  ];
  const h = health({
    getPeriodOverview(options) {
      calls.push(options);
      return Promise.resolve(overview(records, 'in-period'));
    }
  });
  await h.page.fetchPeriodData();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].showErrorToast, false);
  assert.equal(h.page.data.periodRecords.length, 2);
  assert.equal(h.page.data.latestPeriodRecord.id, 'latest');
  assert.equal(h.page.data.periodRecords[0].startDateDisplay, '2026-10-24');
  assert.equal(h.page.data.periodRecords[0].cycleDays, 17);
  assert.equal(h.page.data.periodStats.averageCycleDays, 28);
  assert.equal(h.page.data.periodDays, 3);
  assert.equal(h.page.data.calendarDays.length, 42);
  assert.equal(h.page.data.loadingPeriod, false);
  assert.deepEqual(h.errors, []);
});

test('empty history remains a successful empty state with the existing default statistics', async () => {
  const h = health({ getPeriodOverview: () => Promise.resolve(overview()) });
  await h.page.fetchPeriodData();
  assert.deepEqual(h.page.data.periodRecords, []);
  assert.equal(h.page.data.latestPeriodRecord, null);
  assert.equal(h.page.data.periodStats.status, 'none');
  assert.equal(h.page.data.periodStats.averageCycleDays, 28);
  assert.equal(h.page.data.periodDays, 1);
  assert.deepEqual(h.toasts, []);
});

test('a load failure is visible and does not erase previously loaded records', async () => {
  const h = health({ getPeriodOverview: () => Promise.reject(new Error('Unavailable')) });
  h.page.data.periodRecords = [{ id: 'existing' }];
  await h.page.fetchPeriodData();
  assert.equal(h.page.data.periodRecords[0].id, 'existing');
  assert.equal(h.page.data.loadingPeriod, false);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.errors.length, 1);
});

for (const response of [null, {}, { records: [], stats: null }, { records: [], stats: {} }]) {
  test(`malformed overview ${JSON.stringify(response)} cannot become empty success`, async () => {
    const h = health({ getPeriodOverview: () => Promise.resolve(response) });
    await h.page.fetchPeriodData();
    assert.equal(h.page.data.periodStats, null);
    assert.equal(h.page.data.loadingPeriod, false);
    assert.equal(h.toasts.length, 1);
    assert.equal(h.errors.length, 1);
  });
}
