const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HOME_SECTIONS = ['products', 'toBuy', 'goals', 'weights', 'period', 'play', 'savings'];
const NOW = Date.parse('2026-09-12T04:00:00.000Z');
const apiPath = path.join(__dirname, '..', 'utils', 'api.js');
const homePath = path.join(__dirname, '..', 'pages', 'home', 'home.js');
const template = fs.readFileSync(path.join(__dirname, '..', 'pages', 'home', 'home.wxml'), 'utf8');

const flush = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function emptyData() {
  return {
    products: { expiredItems: [], expiringSoonItems: [] },
    toBuy: { count: 0 },
    goals: { pig: { total: 0, completed: 0 }, donkey: { total: 0, completed: 0 } },
    weights: [],
    period: { status: 'none', averageCycleDays: 28, daysUntilNextPeriod: null },
    play: { ongoing: false },
    savings: {
      hasSetup: false,
      netAssets: 0,
      targetAmount: 0,
      progressPercent: 0,
      remainingToGoal: 0,
      currentMonthStatus: {
        month: '2026-09',
        pigConfirmed: false,
        donkeyConfirmed: false,
        mortgageConfirmed: false,
        isProvisional: true,
        missingOwners: ['Pig', 'Donkey']
      }
    }
  };
}

const ok = data => ({ status: 'ok', data, error: null });
const unavailable = (code = 'timeout') => ({
  status: 'error',
  data: null,
  error: { code, message: code === 'timeout' ? 'Section timed out.' : 'A dependency is unavailable.', retryable: true }
});

function dashboard(overrides = {}, failed = [], requested = HOME_SECTIONS) {
  const data = { ...emptyData(), ...overrides };
  return {
    requestId: 'test-request',
    partial: failed.length > 0,
    sections: Object.fromEntries(requested.map(section => [
      section, failed.includes(section) ? unavailable() : ok(data[section])
    ]))
  };
}

function createHarness(options = {}) {
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [NOW]));
    }

    static now() {
      return NOW;
    }
  }

  const requests = [];
  const completed = new Set();
  const timers = [];
  const toasts = [];
  const redirects = [];
  const loading = [];
  const updates = [];
  let loginCalls = 0;
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const app = {
    globalData: { token: 'initial-token' },
    _loginPromise: Promise.resolve(),
    getSystemInfo: () => ({ statusBarHeight: 24 }),
    login() {
      loginCalls += 1;
      this._loginPromise = options.login ? options.login(this) : Promise.resolve();
      return this._loginPromise;
    }
  };
  const wx = {
    request(request) {
      requests.push(request);
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    },
    showToast: value => toasts.push(value),
    showLoading: value => loading.push(value),
    hideLoading: () => loading.push('hidden'),
    redirectTo: value => redirects.push(value),
    getStorageSync: () => false,
    navigateTo: () => {},
    switchTab: () => {}
  };
  const globals = {
    wx,
    getApp: () => app,
    Date: FixedDate,
    console: { warn() {}, error() {}, log() {} },
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    }
  };
  const apiModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(apiPath, 'utf8'), { ...globals, module: apiModule }, { filename: apiPath });
  const api = apiModule.exports;
  let definition;
  vm.runInNewContext(fs.readFileSync(homePath, 'utf8'), {
    ...globals,
    require(name) {
      assert.equal(name, '../../utils/api');
      return api;
    },
    Page(value) {
      definition = value;
    }
  }, { filename: homePath });
  const page = { ...definition, data: structuredClone(definition.data) };
  page.setData = patch => {
    const copy = structuredClone(patch);
    Object.assign(page.data, copy);
    updates.push(copy);
  };

  function complete(index, callback) {
    assert.ok(requests[index], `Request ${index} must exist`);
    assert.ok(!completed.has(index), `Request ${index} must finish only once`);
    completed.add(index);
    activeRequests -= 1;
    try {
      callback(requests[index]);
    } finally {
      requests[index].complete();
    }
  }

  return {
    api,
    app,
    page,
    requests,
    timers,
    toasts,
    redirects,
    loading,
    updates,
    get loginCalls() { return loginCalls; },
    get maxActiveRequests() { return maxActiveRequests; },
    respond(index, statusCode, data) {
      complete(index, request => request.success({ statusCode, data }));
    },
    fail(index, error = { errMsg: 'request:fail timeout' }) {
      complete(index, request => request.fail(error));
      return error;
    },
    async runTimer(delay) {
      const timer = timers.shift();
      assert.ok(timer, 'A retry timer must exist');
      assert.equal(timer.delay, delay);
      timer.callback();
      await flush();
    }
  };
}

module.exports = { createHarness, dashboard, deferred, emptyData, flush, HOME_SECTIONS, NOW, ok, template, unavailable };
