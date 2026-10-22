import { formatCapacity, isValidCapacity } from './capacity.js';

import {
  declaredCapacity, modelsOf, profileOf,
} from './document.js';

export function checkCapacity(capacity, ceiling) {
  if (!isValidCapacity(capacity)) {
    throw new Error('请输入大于 0 的整数，可写 128k / 1.5m');
  }
  if (Number.isInteger(ceiling) && capacity > ceiling) {
    throw new Error(`不能超过上游声明的 ${formatCapacity(ceiling)}`);
  }
  return capacity;
}

export function planBulk(view, provider, capacity, ceilings, ids) {
  if (capacity !== null) checkCapacity(capacity);
  const profile = profileOf(view, provider);
  if (!profile) return { ops: [], skipped: [] };
  const models = modelsOf(view, provider);
  const current = new Map(models.map((model) => [model.id, model.capacity]));
  const listed = Array.isArray(profile.models) && profile.models.length > 0
    ? new Set(profile.models.map((entry) => entry?.id))
    : null;
  const candidates = Array.isArray(ids) && ids.length > 0 ? ids : models.map((model) => model.id);
  const skipped = [];
  const targets = [];
  for (const id of candidates) {
    if (listed !== null && !listed.has(id)) continue;
    const ceiling = capacity === null ? undefined : (ceilings instanceof Map ? ceilings.get(id) : undefined);
    if (capacity !== null && Number.isInteger(ceiling) && capacity > ceiling) {
      skipped.push(id);
      continue;
    }
    const now = current.get(id);
    if (capacity === null ? now !== undefined : now !== capacity) targets.push(id);
  }
  if (targets.length === 0) return { ops: [], skipped };

  if (listed !== null) {
    const wanted = new Set(targets);
    const value = profile.models.map((entry) => {
      if (!wanted.has(entry.id)) return { ...entry };
      const copy = { ...entry };
      if (capacity === null) {
        const declared = declaredCapacity(view, provider, entry.id);
        if (declared === undefined) delete copy.contextWindow;
        else copy.contextWindow = declared;
      } else {
        copy.contextWindow = capacity;
      }
      return copy;
    });
    return { ops: [{ op: 'set', path: ['providers', provider, 'models'], value }], skipped };
  }

  const ops = targets.map((id) => planCapacity(view, provider, id, capacity, undefined));
  return { ops, skipped };
}

export function planCapacity(view, provider, model, capacity, ceiling) {
  if (capacity !== null) checkCapacity(capacity, ceiling);
  if (typeof provider !== 'string' || provider === '') throw new Error('缺少提供方');
  if (typeof model !== 'string' || model === '') throw new Error('缺少模型');

  const profile = profileOf(view, provider);
  if (!profile) throw new Error('此提供方不由 llm-pi-ai 管理，暂不支持');

  if (Array.isArray(profile.models) && profile.models.length > 0) {
    const index = profile.models.findIndex((entry) => entry?.id === model);
    if (index < 0) throw new Error('当前模型不在提供方目录中');
    const declared = declaredCapacity(view, provider, model);
    const models = profile.models.map((entry, at) => {
      const copy = { ...entry };
      if (at !== index) return copy;
      if (capacity === null) {
        if (declared === undefined) delete copy.contextWindow;
        else copy.contextWindow = declared;
      } else {
        copy.contextWindow = capacity;
      }
      return copy;
    });
    return { op: 'set', path: ['providers', provider, 'models'], value: models };
  }

  const path = ['providers', provider, 'modelOverrides', model, 'contextWindow'];
  return capacity === null ? { op: 'unset', path } : { op: 'set', path, value: capacity };
}
