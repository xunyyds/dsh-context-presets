import { MODEL_NS, modelNamespace } from '../core/document.js';

export function unwrap(result) {
  if (!result?.ok) {
    throw new Error(result?.error?.message || result?.error?.code || '设置服务请求失败');
  }
  return result.value;
}

function pickEntries(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (typeof entry?.id !== 'string') continue;
    if (!Number.isInteger(entry.contextWindow) || entry.contextWindow <= 0) continue;
    map.set(entry.id, entry.contextWindow);
  }
  return map;
}

export function createService(ctx) {
  const settings = ctx.remote?.settings;
  const llm = ctx.remote?.llm;
  const discovery = new Map();

  async function describe() {
    const described = unwrap(await settings.describe());
    return { described, view: modelNamespace(described) };
  }

  async function apply(plan) {
    if (!settings) throw new Error('设置服务不可用');
    let failure = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { described, view } = await describe();
      if (!described.writable) throw new Error('当前设置不可写，远程 Web 不支持持久化设置');
      if (view === null) throw new Error('llm-pi-ai 尚未加载');
      const ops = plan(view);
      if (!Array.isArray(ops) || ops.length === 0) return 0;
      const result = await settings.mutate(MODEL_NS, ops, view.revision);
      if (result?.ok) return ops.length;
      const code = result?.error?.code;
      failure = new Error(result?.error?.message || code || '设置写入失败');
      if (code !== 'settings/conflict') throw failure;
    }
    throw failure ?? new Error('设置写入失败');
  }

  function probeOf(view, provider) {
    const profile = view?.value?.providers?.[provider];
    if (!profile || typeof profile !== 'object') return {};
    const probe = { provider };
    if (typeof profile.baseURL === 'string' && profile.baseURL !== '') probe.baseURL = profile.baseURL;
    if (typeof profile.api === 'string' && profile.api !== '') probe.api = profile.api;
    return probe;
  }

  async function fetchUpstream(view, provider) {
    const call = llm?.discoverModels;
    if (typeof call !== 'function') return new Map();
    try {
      const request = probeOf(view, provider);
      const result = await call.call(llm, MODEL_NS, request);
      if (!result?.ok) return new Map();
      return pickEntries(Array.isArray(result.value) ? result.value : []);
    } catch {
      return new Map();
    }
  }

  function upstream(provider, view) {
    if (typeof provider !== 'string' || provider === '') return Promise.resolve(new Map());
    const cached = discovery.get(provider);
    if (cached !== undefined) return cached;
    const pending = fetchUpstream(view, provider)
      .then((map) => map)
      .catch(() => new Map());
    discovery.set(provider, pending);
    return pending;
  }

  function forget(provider) {
    if (typeof provider !== 'string' || provider === '') {
      discovery.clear();
      return;
    }
    discovery.delete(provider);
  }

  return {
    get available() {
      return Boolean(settings);
    },
    describe,
    apply,
    upstream,
    forget,
  };
}
