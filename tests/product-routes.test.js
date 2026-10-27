const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { createPageHarness, flush } = require('./page-harness');

const routes = [
  ['Food', 'Food'],
  ['CatFood', 'CatFood'],
  ['Medicine', 'Medicine'],
  ['Product', 'Products']
];
const record = category => ({
  id: 'product-id',
  name: 'Example',
  category,
  description: 'Preserved description',
  bestBy: '2030-01-01T00:00:00Z',
  location: { roomPlacement: '\u53a8\u623f', site: '\u67dc\u5b50' },
  storeOption: '\u5e38\u6e29',
  proteinPercentage: '35',
  weight: '2',
  weightUnit: 'kg',
  flavor: 'Chicken',
  effect: 'Example effect'
});

for (const [category, endpoint] of routes) {
  test(`${category}: create uses /${endpoint} without changing the stored category`, async () => {
    const writes = [];
    const h = createPageHarness(path.join('pages', 'add', 'add.js'), {
      post(url, data) {
        writes.push({ url, data: structuredClone(data) });
        return Promise.resolve(data);
      }
    });
    h.page.onLoad();
    h.page._fillFormData(record(category));
    h.page.submitForm();
    await flush();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, `/${endpoint}`);
    assert.equal(writes[0].data.category, category);
    assert.equal(Object.hasOwn(writes[0].data, 'id'), false);
    assert.equal(writes[0].data.bestBy, '2030-01-01T00:00:00Z');
    if (category === 'Food') assert.equal(writes[0].data.storeOption, '\u5e38\u6e29');
    if (category === 'CatFood') assert.equal(writes[0].data.weightUnit, 'kg');
    if (category === 'Medicine') assert.equal(writes[0].data.effect, 'Example effect');
    assert.deepEqual(h.errors, []);
  });

  test(`${category}: read and update use the same endpoint mapping`, async () => {
    const calls = [];
    const h = createPageHarness(path.join('pages', 'update', 'update.js'), {
      get(url) {
        calls.push({ method: 'GET', url });
        return Promise.resolve(record(category));
      },
      put(url, data) {
        calls.push({ method: 'PUT', url, data: structuredClone(data) });
        return Promise.resolve(data);
      }
    });
    h.page.onLoad({ id: 'product-id', category });
    await flush();
    h.page.data.formData.name = 'Edited';
    h.page.updateForm();
    await flush();

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, `/${endpoint}/product-id`);
    assert.equal(calls[1].url, calls[0].url);
    assert.equal(calls[1].data.id, 'product-id');
    assert.equal(calls[1].data.category, category);
    assert.equal(calls[1].data.name, 'Edited');
    assert.deepEqual(h.errors, []);
  });
}

test('legacy edit links without a category still read Products', async () => {
  const calls = [];
  const h = createPageHarness(path.join('pages', 'update', 'update.js'), {
    get(url) { calls.push(url); return Promise.resolve(record('Product')); }
  });
  h.page.onLoad({ id: 'product-id' });
  await flush();
  assert.deepEqual(calls, ['/Products/product-id']);
});

test('changing an item category to Other uses Products for the update', async () => {
  const calls = [];
  const h = createPageHarness(path.join('pages', 'update', 'update.js'), {
    get: () => Promise.resolve(record('Food')),
    put(url, data) { calls.push({ url, data }); return Promise.resolve(data); }
  });
  h.page.onLoad({ id: 'product-id', category: 'Food' });
  await flush();
  h.page.onCategoryChange({ detail: { value: '3' } });
  h.page.updateForm();
  await flush();
  assert.equal(calls[0].url, '/Products/product-id');
  assert.equal(calls[0].data.category, 'Product');
  assert.equal(Object.hasOwn(calls[0].data, 'storeOption'), false);
});

test('unsupported categories report an error instead of requesting an undefined path', () => {
  const h = createPageHarness(path.join('pages', 'update', 'update.js'), {
    get() { assert.fail('Unsupported categories must not issue a request'); }
  });
  h.page.onLoad({ id: 'product-id', category: 'Unsupported' });
  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].icon, 'error');
});
