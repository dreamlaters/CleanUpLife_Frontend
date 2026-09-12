const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  createHarness, dashboard, deferred, flush, HOME_SECTIONS
} = require(path.join(__dirname, 'mini-program-harness.js'));

test('dashboard wrapper encodes selectors, returns the envelope and supports explicit options', async () => {
  const h = createHarness();
  const pending = h.api.getHomeDashboard(2026, ['products', 'toBuy']);
  await flush();
  const url = new URL(h.requests[0].url);
  assert.equal(url.pathname, '/Home/dashboard');
  assert.equal(url.searchParams.get('year'), '2026');
  assert.equal(url.searchParams.get('sections'), 'products,toBuy');
  assert.equal(h.requests[0].method, 'GET');
  assert.deepEqual(h.loading, []);
  const body = dashboard({}, [], ['products', 'toBuy']);
  h.respond(0, 200, body);
  assert.equal(await pending, body);

  const rejected = assert.rejects(h.api.getHomeDashboard(2026, null, {
    showLoading: true,
    showErrorToast: true,
    loadingText: '重试中'
  }), error => error.statusCode === 500 && error.message === 'Server failed');
  await flush();
  assert.equal(new URL(h.requests[1].url).searchParams.has('sections'), false);
  h.respond(1, 500, { message: 'Server failed' });
  await rejected;
  assert.equal(h.loading[0].title, '重试中');
  assert.equal(h.loading[1], 'hidden');
  assert.equal(h.toasts[0].title, 'Server failed');
});

test('dashboard 503 rejects with HTTP status and the unchanged envelope, without a generic toast', async () => {
  const h = createHarness();
  const body = dashboard({}, HOME_SECTIONS);
  const rejected = assert.rejects(h.api.getHomeDashboard(2026), error => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.data, body);
    return true;
  });
  await flush();
  h.respond(0, 503, body);
  await rejected;
  assert.deepEqual(h.toasts, []);
  assert.equal(h.requests.length, 1);
  assert.equal(h.timers.length, 0);
});

test('ordinary API calls retain default HTTP toasts and conflict metadata', async () => {
  const h = createHarness();
  const body = { message: 'Server failed' };
  const rejected = assert.rejects(h.api.get('/Products'), error => {
    assert.equal(error.message, 'Server failed');
    assert.equal(error.statusCode, 500);
    assert.equal(error.data, body);
    return true;
  });
  await flush();
  h.respond(0, 500, body);
  await rejected;
  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].title, 'Server failed');
  assert.equal(h.toasts[0].icon, 'error');
  assert.equal(h.loading[0].title, '加载中...');
  assert.equal(h.loading[1], 'hidden');

  const conflict = { message: '发现重复记录', existingId: 'existing' };
  const conflictRejected = assert.rejects(h.api.post('/ToBuy', { name: 'item' }), error => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.data, conflict);
    return true;
  });
  await flush();
  h.respond(1, 409, conflict);
  await conflictRejected;
  assert.equal(h.toasts.length, 1);
  assert.equal(h.timers.length, 0);
});

test('GET network failures retain the 600/1500ms bounded retry schedule and one loading indicator', async () => {
  const h = createHarness();
  const pending = h.api.get('/Products');
  await flush();
  h.fail(0);
  await h.runTimer(600);
  assert.equal(h.requests.length, 2);
  h.app.globalData.token = 'new-token';
  h.fail(1);
  await h.runTimer(1500);
  assert.equal(h.requests.length, 3);
  h.respond(2, 200, { result: 'recovered' });
  assert.deepEqual(await pending, { result: 'recovered' });
  assert.ok(h.requests.every(request => request.url === h.requests[0].url));
  assert.ok(h.requests.every(request => request.method === 'GET'));
  assert.equal(h.requests[2].header['X-Auth-Token'], 'new-token');
  assert.equal(h.loginCalls, 0);
  assert.equal(h.timers.length, 0);
  assert.deepEqual(h.loading.map(value => typeof value === 'string' ? value : value.title), ['加载中...', 'hidden']);
  assert.deepEqual(h.toasts, []);
});

test('dashboard toast suppression survives every GET network retry', async () => {
  const h = createHarness();
  const networkError = { errMsg: 'request:fail connection reset' };
  const rejected = assert.rejects(
    h.api.getHomeDashboard(2026, ['savings']),
    error => error === networkError
  );
  await flush();
  h.fail(0, networkError);
  await h.runTimer(600);
  h.fail(1, networkError);
  await h.runTimer(1500);
  h.fail(2, networkError);
  await rejected;
  assert.equal(h.requests.length, 3);
  assert.ok(h.requests.every(request => new URL(request.url).searchParams.get('sections') === 'savings'));
  assert.deepEqual(h.toasts, []);
  assert.deepEqual(h.loading, []);
  assert.equal(h.timers.length, 0);
});

test('ordinary exhausted GETs still share the throttled network-error toast', async () => {
  const h = createHarness();
  const rejected = [
    assert.rejects(h.api.get('/Products'), error => Boolean(error.errMsg)),
    assert.rejects(h.api.get('/ToBuy'), error => Boolean(error.errMsg))
  ];
  await flush();
  h.fail(0);
  h.fail(1);
  await h.runTimer(600);
  await h.runTimer(600);
  h.fail(2);
  h.fail(3);
  await h.runTimer(1500);
  await h.runTimer(1500);
  h.fail(4);
  h.fail(5);
  await Promise.all(rejected);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].title, '网络不稳定，请稍后重试');
  assert.equal(h.timers.length, 0);
});

test('POST, PUT and DELETE are never replayed on network failure', async () => {
  const h = createHarness();
  const rejected = [
    assert.rejects(h.api.post('/Play/end', {}), error => Boolean(error.errMsg)),
    assert.rejects(h.api.put('/ToBuy/item', { completed: true }), error => Boolean(error.errMsg)),
    assert.rejects(h.api.del('/Products/item'), error => Boolean(error.errMsg))
  ];
  await flush();
  h.fail(0);
  h.fail(1);
  h.fail(2);
  await Promise.all(rejected);
  assert.deepEqual(h.requests.map(request => request.method), ['POST', 'PUT', 'DELETE']);
  assert.equal(h.requests.length, 3);
  assert.equal(h.timers.length, 0);
  assert.equal(h.loginCalls, 0);
  assert.equal(h.toasts.length, 1);
});

test('concurrent 401 GETs single-flight login and retry with the refreshed token', async () => {
  const login = deferred();
  const h = createHarness({
    login: app => login.promise.then(() => {
      app.globalData.token = 'refreshed-token';
    })
  });
  const home = h.api.getHomeDashboard(2026, ['goals']);
  const products = h.api.get('/Products', { showLoading: false });
  await flush();
  h.respond(0, 401, {});
  h.respond(1, 401, {});
  await flush();
  assert.equal(h.loginCalls, 1);
  assert.equal(h.requests.length, 2);
  login.resolve();
  await flush();
  assert.equal(h.requests.length, 4);
  assert.equal(h.requests[2].header['X-Auth-Token'], 'refreshed-token');
  assert.equal(h.requests[3].header['X-Auth-Token'], 'refreshed-token');
  assert.equal(new URL(h.requests[2].url).searchParams.get('sections'), 'goals');
  h.respond(2, 200, dashboard({}, [], ['goals']));
  h.respond(3, 200, []);
  await Promise.all([home, products]);
  assert.equal(h.loginCalls, 1);
  assert.deepEqual(h.toasts, []);
});

test('POST, PUT and DELETE refresh 401 login but still require manual replay', async () => {
  const login = deferred();
  const h = createHarness({ login: () => login.promise });
  const rejected = [
    assert.rejects(h.api.post('/Play/end', {}), /登录状态已刷新，请重新操作/),
    assert.rejects(h.api.put('/ToBuy/item', {}), /登录状态已刷新，请重新操作/),
    assert.rejects(h.api.del('/Products/item'), /登录状态已刷新，请重新操作/)
  ];
  await flush();
  h.respond(0, 401, {});
  h.respond(1, 401, {});
  h.respond(2, 401, {});
  assert.equal(h.loginCalls, 1);
  login.resolve();
  await Promise.all(rejected);
  assert.equal(h.requests.length, 3);
  assert.equal(h.timers.length, 0);
  assert.equal(h.toasts.length, 3);
  assert.ok(h.toasts.every(toast => toast.title === '登录已刷新，请重新操作'));
});

test('401 retries remain bounded at three login refreshes', async () => {
  const h = createHarness();
  const rejected = assert.rejects(h.api.getHomeDashboard(2026), /认证失败，请重新打开小程序/);
  await flush();
  for (let index = 0; index < 4; index += 1) {
    h.respond(index, 401, {});
    await flush();
  }
  await rejected;
  assert.equal(h.requests.length, 4);
  assert.equal(h.loginCalls, 3);
  assert.equal(h.timers.length, 0);
  assert.deepEqual(h.toasts, []);
});

test('failed shared login rejects both requests and does not replay either', async () => {
  const login = deferred();
  const h = createHarness({ login: () => login.promise });
  const rejected = [
    assert.rejects(h.api.getHomeDashboard(2026), /Login failed/),
    assert.rejects(h.api.get('/Products'), /Login failed/)
  ];
  await flush();
  h.respond(0, 401, {});
  h.respond(1, 401, {});
  login.reject(new Error('Login failed'));
  await Promise.all(rejected);
  assert.equal(h.loginCalls, 1);
  assert.equal(h.requests.length, 2);
});

test('403 remains a whole-request redirect with no automatic retries', async () => {
  const h = createHarness();
  const rejected = assert.rejects(h.api.getHomeDashboard(2026), /无权限访问/);
  await flush();
  h.respond(0, 403, { message: 'Forbidden' });
  await rejected;
  assert.equal(h.redirects.length, 1);
  assert.equal(h.redirects[0].url, '/pages/blocked/blocked');
  assert.equal(h.requests.length, 1);
  assert.equal(h.loginCalls, 0);
  assert.equal(h.timers.length, 0);
});

test('login gates business requests, while the login endpoint bypasses that gate without write replay', async () => {
  const h = createHarness();
  const login = deferred();
  h.app._loginPromise = login.promise;
  const home = h.api.getHomeDashboard(2026);
  const auth = h.api.post('/OpenId/wechat', { code: 'test-code' }, { showLoading: false });
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(new URL(h.requests[0].url).pathname, '/OpenId/wechat');
  h.respond(0, 200, { token: 'test-token' });
  await auth;
  h.app.globalData.token = 'test-token';
  login.resolve();
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].header['X-Auth-Token'], 'test-token');
  h.respond(1, 200, dashboard());
  await home;
  assert.equal(h.loginCalls, 0);
});
