import test from 'node:test';
import assert from 'node:assert/strict';

import { FOLLOW_ID, PRESETS, presetId } from '../src/core/capacity.js';
import {
  buildMenuItems, followLabel, menuHead, selectedItemId,
} from '../src/core/menu-items.js';

const base = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  current: undefined,
  effective: 128000,
  ceiling: 200000,
  busy: false,
};

test('menuHead summarizes route and current state', () => {
  assert.equal(menuHead('deepseek', 'chat', undefined, 128000), 'deepseek / chat · 跟随 128K');
  assert.equal(menuHead('deepseek', 'chat', 150000, 128000), 'deepseek / chat · 150,000 (150K)');
});

test('followLabel shows the upstream value when known', () => {
  assert.equal(followLabel(200000), '跟随上游 · 200K');
  assert.equal(followLabel(undefined), '跟随上游');
});

test('buildMenuItems offers follow, every preset and the actions', () => {
  const items = buildMenuItems(base);
  const ids = items.map((item) => item.id);
  assert.ok(ids.includes(FOLLOW_ID));
  for (const preset of PRESETS) assert.ok(ids.includes(presetId(preset)));
  assert.ok(ids.includes('settings'));
  assert.ok(ids.includes('reload'));
});

test('buildMenuItems disables presets above the upstream ceiling', () => {
  const items = buildMenuItems(base);
  const above = items.find((item) => item.id === presetId(256000));
  const below = items.find((item) => item.id === presetId(128000));
  assert.equal(above.disabled, true);
  assert.match(above.label, /超出上游/);
  assert.equal(below.disabled, false);
});

test('buildMenuItems keeps presets enabled when the ceiling is unknown', () => {
  const items = buildMenuItems({ ...base, ceiling: undefined });
  const top = items.find((item) => item.id === presetId(2000000));
  assert.equal(top.disabled, false);
  assert.equal(items.find((item) => item.id === FOLLOW_ID).label, '跟随上游');
});

test('the menu leaves custom input and settings to their own surfaces', () => {
  const items = buildMenuItems({ ...base, current: 150000 });
  assert.equal(items.some((item) => item.id === 'custom'), false);
  assert.ok(items.find((item) => item.id === 'settings'));
});

test('buildMenuItems honours the busy flag', () => {
  const items = buildMenuItems({ ...base, busy: true });
  assert.equal(items.find((item) => item.id === FOLLOW_ID).disabled, true);
  assert.equal(items.find((item) => item.id === 'settings').disabled, undefined);
});

test('selectedItemId maps follow and presets, but not custom values', () => {
  assert.equal(selectedItemId(undefined), FOLLOW_ID);
  assert.equal(selectedItemId(128000), presetId(128000));
  assert.equal(selectedItemId(150000), null);
});
