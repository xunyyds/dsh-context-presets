import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODEL_NS, customizationCount, currentCapacity, declaredCapacity,
  effectiveCapacity, followCapacity, modelNamespace, modelsOf, providerDefault,
  providersOf, upstreamCapacity,
} from '../src/core/document.js';

const doc = {
  value: {
    providers: {
      catalog: { modelOverrides: { a: { contextWindow: 65536 } } },
      list: { models: [{ id: 'x', contextWindow: 32000 }, { id: 'y' }] },
    },
  },
  base: {
    providers: {
      catalog: {
        defaultContextWindow: 262144,
        models: [{ id: 'a', contextWindow: 128000 }, { id: 'b', contextWindow: 64000 }],
      },
      list: { models: [{ id: 'x', contextWindow: 32000 }, { id: 'y', contextWindow: 64000 }] },
    },
  },
};

test('modelNamespace finds the llm-pi-ai entry', () => {
  const described = { namespaces: [{ ns: 'other' }, { ns: MODEL_NS, revision: 3 }] };
  assert.equal(modelNamespace(described).revision, 3);
  assert.equal(modelNamespace({ namespaces: [] }), null);
  assert.equal(modelNamespace({}), null);
});

test('currentCapacity reads overrides and model lists', () => {
  assert.equal(currentCapacity(doc, 'catalog', 'a'), 65536);
  assert.equal(currentCapacity(doc, 'catalog', 'b'), undefined);
  assert.equal(currentCapacity(doc, 'list', 'x'), 32000);
  assert.equal(currentCapacity(doc, 'list', 'y'), undefined);
  assert.equal(currentCapacity(doc, 'ghost', 'a'), undefined);
});

test('declaredCapacity reads only the inherited catalog layer', () => {
  assert.equal(declaredCapacity(doc, 'catalog', 'a'), 128000);
  assert.equal(declaredCapacity(doc, 'catalog', 'zzz'), undefined);
  assert.equal(declaredCapacity({ base: {} }, 'catalog', 'a'), undefined);
});

test('providerDefault falls back to the route default', () => {
  assert.equal(providerDefault(doc, 'catalog'), 262144);
  assert.equal(providerDefault(doc, 'list'), undefined);
});

test('followCapacity prefers the declared window over the route default', () => {
  assert.equal(followCapacity(doc, 'catalog', 'a'), 128000);
  assert.equal(followCapacity(doc, 'catalog', 'b'), 64000);
  assert.equal(followCapacity(doc, 'catalog', 'zzz'), 262144);
  assert.equal(followCapacity(doc, 'list', 'zzz'), undefined);
});

test('upstreamCapacity prefers discovered values and never invents one', () => {
  assert.equal(upstreamCapacity(doc, 'catalog', 'a', new Map()), 128000);
  assert.equal(upstreamCapacity(doc, 'catalog', 'a', new Map([['a', 200000]])), 200000);
  assert.equal(upstreamCapacity(doc, 'catalog', 'zzz', new Map()), undefined);
  assert.equal(upstreamCapacity(doc, 'ghost', 'a', new Map()), undefined);
});

test('effectiveCapacity resolves override, then catalog, then default', () => {
  assert.equal(effectiveCapacity(doc, 'catalog', 'a'), 65536);
  assert.equal(effectiveCapacity(doc, 'catalog', 'b'), 64000);
  assert.equal(effectiveCapacity(doc, 'catalog', 'zzz'), 262144);
  assert.equal(effectiveCapacity(doc, 'list', 'y'), 64000);
});

test('modelsOf handles both document shapes', () => {
  assert.deepEqual(modelsOf(doc, 'catalog'), [{ id: 'a', capacity: 65536 }]);
  assert.deepEqual(modelsOf(doc, 'list'), [{ id: 'x', capacity: 32000 }, { id: 'y', capacity: undefined }]);
  assert.deepEqual(modelsOf(doc, 'missing'), []);
});

test('providersOf enumerates providers with models', () => {
  const ids = providersOf(doc).map((entry) => entry.id);
  assert.deepEqual(ids, ['catalog', 'list']);
  assert.deepEqual(providersOf({}), []);
});

test('customizationCount counts deviations from the catalog window', () => {
  assert.equal(customizationCount(doc), 1);
  const clean = {
    value: { providers: { p: { models: [{ id: 'a', contextWindow: 1000 }] } } },
    base: { providers: { p: { models: [{ id: 'a', contextWindow: 1000 }] } } },
  };
  assert.equal(customizationCount(clean), 0);
  assert.equal(customizationCount({}), 0);
});
