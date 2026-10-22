import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOLLOW_ID, MIN_CAPACITY, PRESETS, formatCapacity, isValidCapacity,
  parseCapacity, parsePresetId, presetId, shortLabel,
} from '../src/core/capacity.js';

test('parseCapacity accepts bare integers', () => {
  assert.equal(parseCapacity('128000'), 128000);
  assert.equal(parseCapacity('1'), MIN_CAPACITY);
  assert.equal(parseCapacity(200000), 200000);
  assert.equal(parseCapacity('2000000'), 2000000);
});

test('parseCapacity accepts k and m suffixes in any case', () => {
  assert.equal(parseCapacity('128k'), 128000);
  assert.equal(parseCapacity('128K'), 128000);
  assert.equal(parseCapacity('1M'), 1000000);
  assert.equal(parseCapacity('1.5m'), 1500000);
  assert.equal(parseCapacity('2.5K'), 2500);
});

test('parseCapacity tolerates separators and whitespace', () => {
  assert.equal(parseCapacity(' 128 000 '), 128000);
  assert.equal(parseCapacity('128,000'), 128000);
  assert.equal(parseCapacity('128_000'), 128000);
});

test('parseCapacity rejects junk and non-positive values', () => {
  for (const bad of ['', '   ', 'abc', '12px', '-5', '0', '0.4', null, undefined, 'x1k']) {
    assert.equal(parseCapacity(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('isValidCapacity mirrors the pi-ai schema', () => {
  assert.equal(isValidCapacity(1), true);
  assert.equal(isValidCapacity(128000), true);
  assert.equal(isValidCapacity(0), false);
  assert.equal(isValidCapacity(-1), false);
  assert.equal(isValidCapacity(1.5), false);
  assert.equal(isValidCapacity('128000'), false);
});

test('shortLabel always renders a k or m unit', () => {
  assert.equal(shortLabel(128000), '128K');
  assert.equal(shortLabel(1000000), '1M');
  assert.equal(shortLabel(1500000), '1.5M');
  assert.equal(shortLabel(1234), '1.23K');
  assert.equal(shortLabel(96000), '96K');
  assert.equal(shortLabel(704512), '704.51K');
  assert.equal(shortLabel(3), '<1K');
  assert.equal(shortLabel(undefined), '跟随上游');
});

test('formatCapacity shares the short label', () => {
  assert.equal(formatCapacity(undefined), '跟随上游');
  assert.equal(formatCapacity(128000), '128K');
  assert.equal(formatCapacity(1500000), '1.5M');
  assert.equal(formatCapacity(262144), '262.14K');
});

test('preset ids round-trip', () => {
  assert.equal(presetId(128000), 'preset:128000');
  assert.equal(parsePresetId('preset:128000'), 128000);
  assert.equal(parsePresetId('follow'), null);
  assert.equal(parsePresetId('preset:abc'), null);
});

test('preset grid and follow id stay stable', () => {
  assert.deepEqual([...PRESETS], [32000, 64000, 100000, 128000, 200000, 256000, 512000, 1000000, 2000000]);
  assert.equal(FOLLOW_ID, 'follow');
});
