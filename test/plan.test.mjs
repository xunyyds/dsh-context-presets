import test from 'node:test';
import assert from 'node:assert/strict';

import { checkCapacity, planBulk, planCapacity } from '../src/core/plan.js';

const doc = {
  value: {
    providers: {
      catalog: { modelOverrides: { a: { contextWindow: 65536 } } },
      list: {
        models: [
          { id: 'x', contextWindow: 32000, maxTokens: 8192 },
          { id: 'y' },
        ],
      },
    },
  },
  base: {
    providers: {
      catalog: {
        defaultContextWindow: 262144,
        models: [{ id: 'a', contextWindow: 128000 }],
      },
      list: { models: [{ id: 'x', contextWindow: 32000 }, { id: 'y', contextWindow: 64000 }] },
    },
  },
};

test('checkCapacity rejects junk and enforces the upstream ceiling', () => {
  assert.equal(checkCapacity(128000, undefined), 128000);
  assert.equal(checkCapacity(128000, 128000), 128000);
  assert.throws(() => checkCapacity(0), /整数/);
  assert.throws(() => checkCapacity(1.5), /整数/);
  assert.throws(() => checkCapacity(200000, 128000), /不能超过上游/);
});

test('planCapacity sets an override for catalog-driven providers', () => {
  const op = planCapacity(doc, 'catalog', 'a', 200000);
  assert.deepEqual(op, {
    op: 'set',
    path: ['providers', 'catalog', 'modelOverrides', 'a', 'contextWindow'],
    value: 200000,
  });
});

test('planCapacity unsets the override to follow the upstream value', () => {
  assert.deepEqual(planCapacity(doc, 'catalog', 'a', null), {
    op: 'unset',
    path: ['providers', 'catalog', 'modelOverrides', 'a', 'contextWindow'],
  });
});

test('planCapacity rewrites a model list and keeps siblings intact', () => {
  const op = planCapacity(doc, 'list', 'x', 999000);
  assert.equal(op.op, 'set');
  assert.deepEqual(op.path, ['providers', 'list', 'models']);
  assert.deepEqual(op.value, [
    { id: 'x', contextWindow: 999000, maxTokens: 8192 },
    { id: 'y' },
  ]);
});

test('planCapacity restores a list entry to its declared window', () => {
  const op = planCapacity(doc, 'list', 'x', null);
  assert.deepEqual(op.value[0], { id: 'x', contextWindow: 32000, maxTokens: 8192 });
});

test('planCapacity drops the field when nothing is declared', () => {
  const view = { value: { providers: { p: { models: [{ id: 'm', contextWindow: 5000 }] } } }, base: {} };
  const op = planCapacity(view, 'p', 'm', null);
  assert.equal('contextWindow' in op.value[0], false);
});

test('planCapacity refuses unknown provider, model and capacity', () => {
  assert.throws(() => planCapacity(doc, 'list', 'zzz', 1000), /不在提供方目录/);
  assert.throws(() => planCapacity(doc, 'ghost', 'x', 1000), /暂不支持/);
  assert.throws(() => planCapacity(doc, '', 'x', 1000), /提供方/);
  assert.throws(() => planCapacity(doc, 'catalog', '', 1000), /模型/);
  assert.throws(() => planCapacity(doc, 'catalog', 'a', 200000, 128000), /不能超过上游/);
});

test('planCapacity never mutates the input document', () => {
  const before = JSON.stringify(doc);
  planCapacity(doc, 'list', 'x', 123456);
  assert.equal(JSON.stringify(doc), before);
});

test('planBulk skips models already at the requested value', () => {
  const { ops } = planBulk(doc, 'list', 32000);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].value.find((entry) => entry.id === 'y').contextWindow, 32000);
});

test('planBulk collapses a model list into one atomic op', () => {
  const { ops } = planBulk(doc, 'list', null);
  assert.equal(ops.length, 1);
  const value = ops[0].value;
  assert.equal(value.find((entry) => entry.id === 'x').contextWindow, 32000);
  assert.equal('contextWindow' in value.find((entry) => entry.id === 'y'), false);
});

test('planBulk applies one capacity to every model of a list', () => {
  const { ops } = planBulk(doc, 'list', 777000);
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].value.map((entry) => entry.contextWindow), [777000, 777000]);
  assert.equal(ops[0].value[0].maxTokens, 8192);
});

test('planBulk keeps per-model ops for catalog-driven providers', () => {
  const { ops } = planBulk(doc, 'catalog', 200000);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].op, 'set');
  assert.deepEqual(ops[0].path.slice(0, 3), ['providers', 'catalog', 'modelOverrides']);
});

test('planBulk skips models above the upstream ceiling', () => {
  const ceilings = new Map([['a', 131072]]);
  const { ops, skipped } = planBulk(doc, 'catalog', 200000, ceilings);
  assert.deepEqual(ops, []);
  assert.deepEqual(skipped, ['a']);
});

test('planBulk reports an unknown provider as a no-op', () => {
  assert.deepEqual(planBulk(doc, 'ghost', 1000), { ops: [], skipped: [] });
});

test('planBulk is idempotent when nothing needs changing', () => {
  const view = {
    value: { providers: { p: { models: [{ id: 'a', contextWindow: 1000 }] } } },
    base: { providers: { p: { models: [{ id: 'a', contextWindow: 1000 }] } } },
  };
  assert.deepEqual(planBulk(view, 'p', 1000), { ops: [], skipped: [] });
});
