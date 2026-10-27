const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createPageHarness(relativePath, api, now = Date.parse('2026-10-26T04:00:00Z')) {
  const root = path.join(__dirname, '..');
  const modules = new Map();
  const toasts = [];
  const errors = [];
  const app = { globalData: { player: 'Pig' }, getSystemInfo: () => ({ statusBarHeight: 24 }) };
  const wx = {
    showToast: value => toasts.push(value),
    getStorageSync: () => '',
    showLoading() {},
    hideLoading() {},
    navigateBack() {}
  };
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() { return now; }
  }

  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} };
    let definition;
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, wx, Date: FixedDate, getApp: () => app,
      console: { error: (...args) => errors.push(args), log() {}, warn() {} },
      setTimeout: () => 0,
      Behavior: value => value,
      Page: value => { definition = value; },
      require(name) {
        if (name.endsWith('/utils/api')) return api;
        return load(path.resolve(path.dirname(filename), name + '.js'));
      }
    }, { filename });
    const value = definition || module.exports;
    modules.set(filename, value);
    return value;
  }

  const definition = load(path.join(root, relativePath));
  const page = { data: {} };
  for (const behavior of definition.behaviors || []) {
    Object.assign(page, behavior.methods);
    Object.assign(page.data, structuredClone(behavior.data));
  }
  const data = { ...page.data, ...structuredClone(definition.data || {}) };
  Object.assign(page, definition, { data });
  page.setData = (patch, callback) => {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let current = page.data;
      for (const part of parts.slice(0, -1)) current = current[part];
      current[parts.at(-1)] = structuredClone(value);
    }
    if (callback) callback();
  };
  return { page, app, toasts, errors };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

module.exports = { createPageHarness, flush };
