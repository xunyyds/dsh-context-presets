window.__ModuleLoader__.load({id:'dsh-context-presets',factory:(require)=>{
const React = require('react');
const PRESETS = Object.freeze([32000, 64000, 100000, 128000, 200000, 256000, 512000, 1000000, 2000000]);

const MIN_CAPACITY = 1;

const FOLLOW_ID = 'follow';

function parseCapacity(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).replace(/[\s,_]/g, '').toLowerCase();
  if (text === '') return null;
  const match = /^(\d+(?:\.\d+)?)([km])?$/.exec(text);
  if (match === null) return null;
  const scale = match[2] === 'k' ? 1000 : match[2] === 'm' ? 1000000 : 1;
  const value = Math.round(Number(match[1]) * scale);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_CAPACITY) return null;
  return value;
}

function isValidCapacity(value) {
  return Number.isInteger(value) && value >= MIN_CAPACITY;
}

function formatCapacity(value) {
  if (value === null || value === undefined) return '跟随上游';
  if (!isValidCapacity(value)) return String(value);
  const digits = value.toLocaleString('en-US');
  if (value >= 1000000 && value % 100000 === 0) return `${digits} (${value / 1000000}M)`;
  if (value >= 1000 && value % 1000 === 0) return `${digits} (${value / 1000}K)`;
  return digits;
}

function shortLabel(value) {
  if (value === null || value === undefined) return '跟随上游';
  if (value >= 1000000 && value % 100000 === 0) {
    const millions = value / 1000000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  return String(value);
}

function presetId(value) {
  return `preset:${value}`;
}

function parsePresetId(id) {
  const match = /^preset:(\d+)$/.exec(String(id));
  return match === null ? null : Number(match[1]);
}

const MODEL_NS = 'llm-pi-ai';

function modelNamespace(described) {
  const namespaces = Array.isArray(described?.namespaces) ? described.namespaces : [];
  return namespaces.find((entry) => entry?.ns === MODEL_NS) ?? null;
}

function profileOf(view, provider) {
  const providers = view?.value?.providers;
  if (!providers || typeof providers !== 'object') return undefined;
  return providers[provider];
}

function baseProfileOf(view, provider) {
  const providers = view?.base?.providers;
  if (!providers || typeof providers !== 'object') return undefined;
  return providers[provider];
}

function currentCapacity(view, provider, model) {
  const profile = profileOf(view, provider);
  if (!profile) return undefined;
  if (Array.isArray(profile.models) && profile.models.length > 0) {
    return profile.models.find((entry) => entry?.id === model)?.contextWindow;
  }
  return profile.modelOverrides?.[model]?.contextWindow;
}

function declaredCapacity(view, provider, model) {
  const models = baseProfileOf(view, provider)?.models;
  if (!Array.isArray(models)) return undefined;
  const hit = models.find((entry) => entry?.id === model);
  return Number.isInteger(hit?.contextWindow) && hit.contextWindow > 0 ? hit.contextWindow : undefined;
}

function providerDefault(view, provider) {
  const base = baseProfileOf(view, provider);
  if (Number.isInteger(base?.defaultContextWindow) && base.defaultContextWindow > 0) {
    return base.defaultContextWindow;
  }
  const value = profileOf(view, provider);
  if (Number.isInteger(value?.defaultContextWindow) && value.defaultContextWindow > 0) {
    return value.defaultContextWindow;
  }
  return undefined;
}

function followCapacity(view, provider, model) {
  const declared = declaredCapacity(view, provider, model);
  if (declared !== undefined) return declared;
  return providerDefault(view, provider);
}

function upstreamCapacity(view, provider, model, discovered) {
  const known = discovered instanceof Map ? discovered.get(model) : undefined;
  if (Number.isInteger(known) && known > 0) return known;
  return declaredCapacity(view, provider, model);
}

function effectiveCapacity(view, provider, model) {
  const own = currentCapacity(view, provider, model);
  if (own !== undefined) return own;
  return followCapacity(view, provider, model);
}

function modelsOf(view, provider) {
  const profile = profileOf(view, provider);
  if (!profile) return [];
  if (Array.isArray(profile.models) && profile.models.length > 0) {
    return profile.models
      .filter((entry) => typeof entry?.id === 'string')
      .map((entry) => ({ id: entry.id, capacity: entry.contextWindow }));
  }
  const overrides = profile.modelOverrides;
  if (overrides && typeof overrides === 'object') {
    return Object.keys(overrides).map((id) => ({ id, capacity: overrides[id]?.contextWindow }));
  }
  return [];
}

function knownModels(view, provider, discovered) {
  const ids = [];
  const push = (id) => {
    if (typeof id === 'string' && id !== '' && !ids.includes(id)) ids.push(id);
  };
  const declared = baseProfileOf(view, provider)?.models;
  if (Array.isArray(declared)) {
    for (const entry of declared) push(entry?.id);
  }
  if (discovered instanceof Map) {
    for (const id of discovered.keys()) push(id);
  }
  for (const model of modelsOf(view, provider)) push(model.id);
  return ids.map((id) => ({ id, capacity: currentCapacity(view, provider, id) }));
}

function providersOf(view) {
  const providers = view?.value?.providers;
  if (!providers || typeof providers !== 'object') return [];
  return Object.keys(providers).map((id) => ({ id, models: modelsOf(view, id) }));
}

function customizationCount(view) {
  let count = 0;
  for (const provider of providersOf(view)) {
    for (const model of provider.models) {
      if (model.capacity === undefined) continue;
      if (model.capacity !== declaredCapacity(view, provider.id, model.id)) count += 1;
    }
  }
  return count;
}

function providerCustomizationCount(view, provider) {
  let count = 0;
  for (const model of modelsOf(view, provider)) {
    if (model.capacity === undefined) continue;
    if (model.capacity !== declaredCapacity(view, provider, model.id)) count += 1;
  }
  return count;
}

function checkCapacity(capacity, ceiling) {
  if (!isValidCapacity(capacity)) {
    throw new Error('请输入大于 0 的整数，可写 128k / 1.5m');
  }
  if (Number.isInteger(ceiling) && capacity > ceiling) {
    throw new Error(`不能超过上游声明的 ${formatCapacity(ceiling)}`);
  }
  return capacity;
}

function planBulk(view, provider, capacity, ceilings, ids) {
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

function planCapacity(view, provider, model, capacity, ceiling) {
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

function followLabel(ceiling) {
  return Number.isInteger(ceiling) ? `跟随上游 · ${shortLabel(ceiling)}` : '跟随上游';
}

function menuHead(provider, model, current, effective) {
  const route = [provider, model].filter(Boolean).join(' / ');
  const now = current === undefined ? `跟随 ${shortLabel(effective)}` : formatCapacity(current);
  return `${route} · ${now}`;
}

function buildMenuItems(state) {
  const {
    provider, model, current, effective, ceiling, busy,
  } = state;
  const items = [];
  items.push({ id: 'head', type: 'label', text: menuHead(provider, model, current, effective) });
  items.push({ id: 'sep-top', type: 'separator' });
  items.push({ id: FOLLOW_ID, label: followLabel(ceiling), disabled: Boolean(busy) });
  for (const preset of PRESETS) {
    const beyond = Number.isInteger(ceiling) && preset > ceiling;
    items.push({
      id: presetId(preset),
      label: beyond ? `${shortLabel(preset)}（超出上游）` : shortLabel(preset),
      disabled: Boolean(busy) || beyond,
    });
  }
  items.push({ id: 'sep-actions', type: 'separator' });
  items.push({ id: 'settings', label: '设置…' });
  items.push({ id: 'sep-reload', type: 'separator' });
  items.push({ id: 'reload', label: '界面刷新' });
  return items;
}

function selectedItemId(current) {
  if (current === undefined) return FOLLOW_ID;
  return PRESETS.includes(current) ? presetId(current) : null;
}

const CSS = `
.cp-wrap{order:1;position:relative;display:inline-flex;align-items:center;flex:none}
.cp-root{position:relative;display:inline-flex;align-items:center;flex:none}
.cp-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:7px;font-family:inherit;font-size:12px;line-height:1;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));cursor:pointer;user-select:none;white-space:nowrap;transition:color .12s,border-color .12s,background .12s}
.cp-chip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3,rgba(128,128,128,.55))}
.cp-chip[data-open=true]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary,#3469db)}
.cp-dot{width:5px;height:5px;border-radius:50%;flex:none;background:var(--dsw-alias-brand-primary,#3469db)}
.cp-chip[data-custom=false] .cp-dot{background:var(--dsw-alias-label-tertiary,#999)}
.cp-error-pop{position:absolute;bottom:calc(100% + 8px);right:0;z-index:60;width:max-content;max-width:min(92vw,320px);box-sizing:border-box;padding:6px 9px;border-radius:8px;font-size:11px;line-height:1.5;text-align:left;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#d93025);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));box-shadow:0 8px 24px rgba(0,0,0,.18)}
.cp-pop{position:absolute;bottom:calc(100% + 8px);right:0;z-index:60;width:344px;max-width:min(92vw,344px);box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;font-size:12px;line-height:1.5;text-align:left;color:var(--dsw-alias-label-primary,#222);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));box-shadow:0 10px 32px rgba(0,0,0,.22)}
.cp-pop-head{display:flex;flex-direction:column;gap:3px}
.cp-pop-route{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;opacity:.72;overflow-wrap:anywhere}
.cp-status{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;font-variant-numeric:tabular-nums}
.cp-status b{font-weight:600}
.cp-grid{display:flex;flex-wrap:wrap;gap:5px}
.cp-row{display:flex;gap:6px;align-items:center}
.cp-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cp-fb-menu{position:absolute;bottom:calc(100% + 6px);right:0;z-index:1100;min-width:184px;max-width:min(92vw,300px);box-sizing:border-box;display:flex;flex-direction:column;padding:4px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.24));box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.24));color:var(--dsw-alias-label-primary)}
.cp-fb-item{display:block;width:100%;box-sizing:border-box;text-align:left;font:inherit;font-size:13px;color:inherit;background:transparent;border:0;border-radius:var(--dsw-radius-sm,6px);padding:6px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-fb-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.cp-fb-item:disabled{opacity:.45;cursor:not-allowed}
.cp-fb-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2,rgba(128,128,128,.24))}
.cp-fb-label{padding:5px 10px 3px;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-fb-mask{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32))}
.cp-fb-dialog{width:min(600px,94vw);max-height:86vh;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:var(--dsw-radius-panel,14px);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent,0 20px 60px rgba(0,0,0,.35))}
.cp-fb-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cp-fb-head h2{margin:0;font-size:15px;font-weight:600}
.cp-fb-close{font:inherit;font-size:16px;line-height:1;color:inherit;background:transparent;border:0;cursor:pointer;opacity:.6;padding:2px 6px}
.cp-fb-close:hover{opacity:1}
.cp-dialog{width:min(600px,94vw)}
.cp-panel{display:flex;flex-direction:column;gap:10px;min-width:0;font-size:12px;line-height:1.5}
.cp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}
.cp-title{margin:0;font-size:13px;font-weight:600}
.cp-sub{font-size:11px;opacity:.62;overflow-wrap:anywhere}
.cp-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cp-scroll{display:flex;flex-direction:column;gap:8px;max-height:min(58vh,460px);overflow:auto;padding-right:2px}
.cp-provider{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.24));border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.cp-provider-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cp-provider-name{font-weight:600;font-size:12px;font-family:var(--dsw-font-mono,ui-monospace,monospace);overflow-wrap:anywhere}
.cp-spacer{flex:1}
.cp-model{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:7px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.07));flex-wrap:wrap}
.cp-model-id{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;overflow-wrap:anywhere;flex:1 1 150px;min-width:0}
.cp-model-value{font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.78}
.cp-badge{font-size:10px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-brand-primary,#3469db);color:var(--dsw-alias-label-primary-foreground,#fff)}
.cp-badge-soft{font-size:10px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:inherit;opacity:.75}
.cp-input{font:inherit;font-size:11px;font-variant-numeric:tabular-nums;color:inherit;background:transparent;box-sizing:border-box;min-width:0;width:96px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.34));border-radius:6px;padding:3px 6px}
.cp-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3469db)}
.cp-input-grow{flex:1 1 120px;width:auto}
.cp-btn{font:inherit;font-size:11px;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.34));border-radius:6px;padding:3px 8px;cursor:pointer;white-space:nowrap;transition:background .1s,border-color .1s}
.cp-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary,#3469db)}
.cp-btn:disabled{opacity:.45;cursor:not-allowed}
.cp-btn-primary{background:var(--dsw-alias-brand-primary,#3469db);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.cp-btn-primary:hover:not(:disabled){opacity:.9}
.cp-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:2px}
.cp-error{color:var(--dsw-alias-state-error-primary,#d93025);font-size:11px;overflow-wrap:anywhere}
.cp-notice{color:var(--dsw-alias-state-success-primary,#1a7f37);font-size:11px;overflow-wrap:anywhere}
.cp-hint{font-size:11px;opacity:.6;overflow-wrap:anywhere}
.cp-empty{font-size:11px;opacity:.6;padding:6px 2px}
`;

let cache = null;

function primitives() {
  if (cache !== null) return cache;
  try {
    cache = require('@deepseek-ai/dsh-client-ui-primitives') ?? {};
  } catch {
    cache = {};
  }
  return cache;
}

function menuComponent() {
  return primitives().Menu ?? null;
}

function modalComponent() {
  return primitives().Modal ?? null;
}

const h = React.createElement;

function installStyles(id, css) {
  if (document.getElementById(id) !== null) return () => {};
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

function reloadUi() {
  if (typeof globalThis.location?.reload === 'function') globalThis.location.reload();
}

function messageOf(error) {
  return String(error?.message ?? error ?? '未知错误');
}

function useStore(store) {
  const subscribe = React.useCallback(
    (fn) => (typeof store?.subscribe === 'function' ? store.subscribe(fn) : () => {}),
    [store],
  );
  const snapshot = React.useCallback(
    () => (typeof store?.getSnapshot === 'function' ? store.getSnapshot() : undefined),
    [store],
  );
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}

function FallbackMenu({ open, items, onSelect }) {
  if (!open) return null;
  const rows = [];
  for (const item of items) {
    if (item.type === 'separator') {
      rows.push(h('div', { key: item.id, className: 'cp-fb-sep', role: 'separator' }));
      continue;
    }
    if (item.type === 'label') {
      rows.push(h('div', { key: item.id, className: 'cp-fb-label' }, item.text));
      continue;
    }
    rows.push(h('button', {
      key: item.id,
      type: 'button',
      role: 'menuitem',
      className: 'cp-fb-item',
      disabled: item.disabled === true,
      onClick: () => onSelect?.(item.id),
    }, item.label));
  }
  return h('div', { className: 'cp-fb-menu', role: 'menu' }, rows);
}

function FallbackModal({
  open, title, onClose, children,
}) {
  if (!open) return null;
  return h('div', { className: 'cp-fb-mask', onClick: onClose },
    h('div', {
      className: 'cp-fb-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title,
      onClick: (event) => event.stopPropagation(),
    },
      h('div', { className: 'cp-fb-head' },
        h('h2', null, title),
        h('button', { type: 'button', className: 'cp-fb-close', 'aria-label': '关闭', onClick: onClose }, '×'),
      ),
      children,
    ));
}

function ChipPanel(props) {
  const {
    provider, model, current, upstreamValue, ceiling, busy, draft, error,
    onPick, onDraft, onApply, onSettings, onReload, onClose,
  } = props;

  const currentText = current === undefined ? '跟随上游' : formatCapacity(current);
  const defaultText = upstreamValue === undefined ? '未知' : formatCapacity(upstreamValue);

  const presets = [h('button', {
    key: 'follow',
    type: 'button',
    className: 'cp-btn',
    disabled: busy,
    'aria-pressed': current === undefined ? 'true' : 'false',
    onClick: () => onPick(FOLLOW_ID),
  }, '跟随上游')];

  for (const preset of PRESETS) {
    const beyond = Number.isInteger(ceiling) && preset > ceiling;
    presets.push(h('button', {
      key: preset,
      type: 'button',
      className: 'cp-btn',
      disabled: busy || beyond,
      'aria-pressed': current === preset ? 'true' : 'false',
      title: beyond ? '超过上游声明的上限' : undefined,
      onClick: () => onPick(presetId(preset)),
    }, shortLabel(preset)));
  }

  return h('div', { className: 'cp-pop', role: 'dialog', 'aria-label': '上下文窗口' },
    h('div', { className: 'cp-pop-head' },
      h('div', { className: 'cp-pop-route' }, `${provider} / ${model}`),
      h('div', { className: 'cp-status' },
        h('span', null, '当前 ', h('b', null, currentText)),
        h('span', null, '默认（上游） ', h('b', null, defaultText)),
      ),
      Number.isInteger(ceiling) && h('div', { className: 'cp-hint' }, `上游上限 ${formatCapacity(ceiling)}`),
    ),
    h('div', { className: 'cp-grid' }, presets),
    h('div', { className: 'cp-row' },
      h('input', {
        className: 'cp-input cp-input-grow',
        value: draft,
        placeholder: '自定义：150000 / 1.5m',
        disabled: busy,
        onChange: (event) => onDraft(event.target.value),
        onKeyDown: (event) => { if (event.key === 'Enter') onApply(); },
      }),
      h('button', {
        type: 'button',
        className: 'cp-btn cp-btn-primary',
        disabled: busy || draft.trim() === '',
        onClick: onApply,
      }, '应用'),
    ),
    error !== '' && h('div', { className: 'cp-error', role: 'alert' }, error),
    busy && h('div', { className: 'cp-hint' }, '正在保存…'),
    h('div', { className: 'cp-actions' },
      h('button', { type: 'button', className: 'cp-btn', onClick: onSettings }, '设置…'),
      h('button', { type: 'button', className: 'cp-btn', onClick: onReload }, '界面刷新'),
      h('div', { className: 'cp-spacer' }),
      h('button', { type: 'button', className: 'cp-btn', onClick: onClose }, '关闭'),
    ),
    h('div', { className: 'cp-hint' }, '只调整 DSH 的预算判断，不扩大服务商真实上限。'),
  );
}

function unwrap(result) {
  if (!result?.ok) {
    throw new Error(result?.error?.message || result?.error?.code || '设置服务请求失败');
  }
  return result.value;
}

function createService(ctx) {
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

  async function fetchUpstream(provider) {
    const call = llm?.discoverModels;
    if (typeof call !== 'function') return new Map();
    try {
      const result = await call.call(llm, MODEL_NS, { provider });
      if (!result?.ok) return new Map();
      const entries = Array.isArray(result.value) ? result.value : [];
      const map = new Map();
      for (const entry of entries) {
        if (typeof entry?.id !== 'string') continue;
        if (!Number.isInteger(entry.contextWindow) || entry.contextWindow <= 0) continue;
        map.set(entry.id, entry.contextWindow);
      }
      return map;
    } catch {
      return new Map();
    }
  }

  function upstream(provider) {
    if (typeof provider !== 'string' || provider === '') return Promise.resolve(new Map());
    const cached = discovery.get(provider);
    if (cached !== undefined) return cached;
    const pending = fetchUpstream(provider);
    discovery.set(provider, pending);
    return pending;
  }

  function forget(provider) {
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

function keyOf(provider, model) {
  return `${provider}\u0000${model}`;
}

function matches(text, filter) {
  return text.toLowerCase().includes(filter.toLowerCase());
}

function modelState(current, declared) {
  if (current === undefined) return { text: '跟随', custom: false };
  if (current === declared) return { text: formatCapacity(current), custom: false };
  return { text: formatCapacity(current), custom: true };
}

function SettingsPanel({ service }) {
  const [view, setView] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [writable, setWritable] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [drafts, setDrafts] = React.useState({});
  const [bulk, setBulk] = React.useState({});
  const [upstreams, setUpstreams] = React.useState({});
  const [probing, setProbing] = React.useState({});
  const [filter, setFilter] = React.useState('');
  const [onlyCustom, setOnlyCustom] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState({});
  const epoch = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const request = ++epoch.current;
    try {
      const { described, view: fresh } = await service.describe();
      if (request !== epoch.current) return;
      setView(fresh);
      setWritable(Boolean(described.writable));
      setLoaded(true);
      if (!described.writable) setError('当前设置不可写（远程 Web 不支持持久化设置）');
    } catch (cause) {
      if (request === epoch.current) {
        setLoaded(true);
        setError(messageOf(cause));
      }
    }
  }, [service]);

  React.useEffect(() => {
    void refresh();
    return () => { epoch.current += 1; };
  }, [refresh]);

  const loadUpstream = React.useCallback(async (provider, force) => {
    if (force) service.forget(provider);
    setProbing((prev) => ({ ...prev, [provider]: true }));
    try {
      const map = await service.upstream(provider);
      setUpstreams((prev) => ({ ...prev, [provider]: map }));
    } finally {
      setProbing((prev) => ({ ...prev, [provider]: false }));
    }
  }, [service]);

  React.useEffect(() => {
    if (view === null) return;
    for (const provider of providersOf(view)) {
      if (upstreams[provider.id] !== undefined) continue;
      void loadUpstream(provider.id, false);
    }
  }, [view, upstreams, loadUpstream]);

  const save = React.useCallback(async (build) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      return await service.apply(build);
    } catch (cause) {
      setError(messageOf(cause));
      return 0;
    } finally {
      setBusy(false);
    }
  }, [service]);

  const setModel = async (provider, model, capacity) => {
    const map = upstreams[provider];
    const ceiling = view === null ? undefined : upstreamCapacity(view, provider, model, map);
    const changed = await save((ns) => [planCapacity(ns, provider, model, capacity, ceiling)]);
    if (changed > 0) {
      await refresh();
      setNotice(capacity === null
        ? `${model} 已改为跟随上游`
        : `${model} 已设为 ${shortLabel(capacity)}`);
    }
  };

  const setProvider = async (provider, capacity) => {
    const map = upstreams[provider];
    const ids = view === null ? [] : knownModels(view, provider, map).map((model) => model.id);
    const ceilings = new Map();
    if (view !== null) {
      for (const id of ids) {
        const ceiling = upstreamCapacity(view, provider, id, map);
        if (Number.isInteger(ceiling)) ceilings.set(id, ceiling);
      }
    }
    let skipped = 0;
    const changed = await save((ns) => {
      const result = planBulk(ns, provider, capacity, ceilings, ids);
      skipped = result.skipped.length;
      return result.ops;
    });
    if (changed > 0) {
      await refresh();
      const base = capacity === null
        ? `${provider} 已全部跟随上游`
        : `${provider} 已全部应用 ${shortLabel(capacity)}`;
      setNotice(skipped > 0 ? `${base}，跳过 ${skipped} 个超出上游的模型` : base);
    } else if (skipped > 0) {
      setNotice(`全部 ${skipped} 个模型都超过上游上限，未写入`);
    } else {
      setNotice('没有需要写入的变更');
    }
  };

  const commitRow = (provider, model) => {
    const key = keyOf(provider, model);
    const parsed = parseCapacity(drafts[key] ?? '');
    if (parsed === null) {
      setNotice('');
      setError('请输入大于 0 的整数，可写 128k / 1.5m');
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    void setModel(provider, model, parsed);
  };

  const commitBulk = (provider) => {
    const parsed = parseCapacity(bulk[provider] ?? '');
    if (parsed === null) {
      setNotice('');
      setError('请输入大于 0 的整数，可写 128k / 1.5m');
      return;
    }
    setBulk((prev) => ({ ...prev, [provider]: '' }));
    void setProvider(provider, parsed);
  };

  const total = view === null ? 0 : customizationCount(view);
  const activeFilter = filter.trim();
  const filterOn = activeFilter !== '';
  const hiding = filterOn || onlyCustom;

  let providers = view === null ? [] : providersOf(view).map((provider) => ({
    ...provider,
    models: knownModels(view, provider.id, upstreams[provider.id]),
  }));

  if (hiding) {
    providers = providers
      .map((provider) => {
        const kept = provider.models.filter((model) => {
          if (onlyCustom) {
            const declared = declaredCapacity(view, provider.id, model.id);
            if (model.capacity === undefined || model.capacity === declared) return false;
          }
          if (!filterOn) return true;
          if (matches(provider.id, activeFilter)) return true;
          return matches(`${provider.id} ${model.id}`, activeFilter);
        });
        return { ...provider, models: kept };
      })
      .filter((provider) => provider.models.length > 0);
  }

  const rows = [];
  rows.push(h('div', { className: 'cp-head', key: 'head' },
    h('div', null,
      h('div', { className: 'cp-title' }, '上下文窗口'),
      h('div', { className: 'cp-sub' }, '按提供方 / 模型列出；跟随表示不写死数值，DSH 使用上游默认窗口。'),
    ),
    h('span', { className: 'cp-badge-soft' }, `已自定义 ${total}`),
  ));
  if (error !== '') rows.push(h('div', { className: 'cp-error', role: 'alert', key: 'error' }, error));
  if (notice !== '') rows.push(h('div', { className: 'cp-notice', role: 'status', key: 'notice' }, notice));
  rows.push(h('div', { className: 'cp-toolbar', key: 'toolbar' },
    h('input', {
      className: 'cp-input cp-input-grow',
      value: filter,
      placeholder: '筛选提供方或模型…',
      onChange: (event) => setFilter(event.target.value),
    }),
    h('button', {
      type: 'button',
      className: 'cp-btn',
      'aria-pressed': onlyCustom ? 'true' : 'false',
      onClick: () => setOnlyCustom((prev) => !prev),
    }, '只看已自定义'),
    h('button', {
      type: 'button', className: 'cp-btn', disabled: busy, onClick: () => void refresh(),
    }, '刷新设置'),
    h('button', {
      type: 'button', className: 'cp-btn', onClick: () => reloadUi(),
    }, '界面刷新'),
  ));

  if (!loaded) {
    rows.push(h('div', { className: 'cp-empty', key: 'loading' }, '正在读取设置…'));
  } else if (view === null) {
    rows.push(h('div', { className: 'cp-empty', key: 'empty' }, '未发现由 llm-pi-ai 管理的提供方'));
  } else if (providers.length === 0) {
    const empty = onlyCustom && !filterOn ? '还没有自定义过的模型' : '没有匹配的模型';
    rows.push(h('div', { className: 'cp-empty', key: 'empty' }, empty));
  }

  const list = providers.map((provider) => {
    const open = hiding || collapsed[provider.id] !== true;
    const map = upstreams[provider.id];
    const customCount = view === null ? 0 : providerCustomizationCount(view, provider.id);
    const head = h('div', { className: 'cp-provider-head', key: 'head' },
      h('button', {
        type: 'button',
        className: 'cp-btn',
        'aria-expanded': open,
        onClick: () => setCollapsed((prev) => ({ ...prev, [provider.id]: open })),
      }, `${open ? '▾' : '▸'} ${provider.id}`),
      h('span', { className: 'cp-badge-soft' }, `${provider.models.length} 个模型`),
      customCount > 0 && h('span', { className: 'cp-badge' }, `已调整 ${customCount}`),
      h('div', { className: 'cp-spacer' }),
      h('input', {
        className: 'cp-input',
        value: bulk[provider.id] ?? '',
        placeholder: '批量值',
        disabled: busy || !writable,
        onChange: (event) => setBulk((prev) => ({ ...prev, [provider.id]: event.target.value })),
        onKeyDown: (event) => { if (event.key === 'Enter') commitBulk(provider.id); },
      }),
      h('button', {
        type: 'button',
        className: 'cp-btn cp-btn-primary',
        disabled: busy || !writable || (bulk[provider.id] ?? '').trim() === '',
        onClick: () => commitBulk(provider.id),
      }, '全部应用'),
      h('button', {
        type: 'button',
        className: 'cp-btn',
        disabled: busy || !writable,
        onClick: () => void setProvider(provider.id, null),
      }, '全部跟随'),
      h('button', {
        type: 'button',
        className: 'cp-btn',
        disabled: busy || probing[provider.id] === true,
        title: '向上游查询每个模型声明的上下文窗口',
        onClick: () => void loadUpstream(provider.id, true),
      }, probing[provider.id] === true ? '探测中…' : '探测上游'),
    );

    const routeDefault = view === null ? undefined : providerDefault(view, provider.id);
    const bodies = provider.models.map((model) => {
      const key = keyOf(provider.id, model.id);
      const declared = declaredCapacity(view, provider.id, model.id);
      const upstreamKnown = map instanceof Map ? map.get(model.id) : undefined;
      const follow = upstreamKnown ?? declared ?? routeDefault;
      const ceiling = upstreamCapacity(view, provider.id, model.id, map);
      const current = model.capacity;
      const state = modelState(current, declared);
      return h('div', { className: 'cp-model', key },
        h('span', { className: 'cp-model-id' }, model.id),
        state.custom && h('span', { className: 'cp-badge' }, '自定义'),
        h('span', { className: 'cp-model-value' }, `当前 ${state.text}`),
        h('span', { className: 'cp-model-value' }, `默认 ${follow === undefined ? '未知' : shortLabel(follow)}`),
        Number.isInteger(ceiling) && h('span', { className: 'cp-badge-soft' }, `上游 ${shortLabel(ceiling)}`),
        h('input', {
          className: 'cp-input',
          value: drafts[key] ?? '',
          placeholder: Number.isInteger(ceiling) ? String(ceiling) : '任意正整数',
          disabled: busy || !writable,
          onChange: (event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value })),
          onKeyDown: (event) => { if (event.key === 'Enter') commitRow(provider.id, model.id); },
        }),
        h('button', {
          type: 'button',
          className: 'cp-btn cp-btn-primary',
          disabled: busy || !writable || (drafts[key] ?? '').trim() === '',
          onClick: () => commitRow(provider.id, model.id),
        }, '设定'),
        h('button', {
          type: 'button',
          className: 'cp-btn',
          disabled: busy || !writable || current === undefined,
          onClick: () => void setModel(provider.id, model.id, null),
        }, '跟随'),
      );
    });

    return h('div', { className: 'cp-provider', key: provider.id },
      head,
      open ? bodies : null,
    );
  });

  rows.push(h('div', { className: 'cp-scroll', key: 'list' }, list));
  rows.push(h('div', { className: 'cp-hint', key: 'hint' },
    '默认值取自上游声明的上下文窗口，自定义值不得超过它；未探测到上游上限时不受限制。'));

  return h('div', { className: 'cp-panel' }, rows);
}

function SettingsDialog({ service, open, onClose }) {
  const Modal = modalComponent() ?? FallbackModal;
  return h(Modal, {
    open,
    onClose,
    title: '上下文窗口设置',
    closeLabel: '关闭',
    className: 'cp-dialog',
    description: '改动即时生效，无需重启；跟随上游表示不写死数值。',
  }, open ? h(SettingsPanel, { service }) : null);
}

const ZERO_RECT = {
  left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0,
};

function ComposerChip({ directory, load, service }) {
  const state = useStore(directory);
  const provider = state?.current?.provider;
  const model = state?.current?.model;
  const [view, setView] = React.useState(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [upstream, setUpstream] = React.useState(null);
  const pointer = React.useRef(null);
  const rootRef = React.useRef(null);
  const epoch = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const request = ++epoch.current;
    try {
      const { view: fresh } = await service.describe();
      if (request !== epoch.current) return;
      setView(fresh);
    } catch (cause) {
      if (request === epoch.current) setError(messageOf(cause));
    }
  }, [service]);

  React.useEffect(() => {
    setView(null);
    setError('');
    void refresh();
    return () => { epoch.current += 1; };
  }, [provider, model, refresh]);

  React.useEffect(() => {
    let live = true;
    setUpstream(null);
    if (typeof provider !== 'string' || provider === '') return undefined;
    void service.upstream(provider).then((map) => {
      if (live) setUpstream(map);
    });
    return () => { live = false; };
  }, [provider, service]);

  React.useEffect(() => {
    if (!panelOpen) return undefined;
    const onDown = (event) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target)) setPanelOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [panelOpen]);

  const save = React.useCallback(async (capacity) => {
    if (typeof provider !== 'string' || typeof model !== 'string') return;
    setBusy(true);
    setError('');
    try {
      const ceiling = view === null ? undefined : upstreamCapacity(view, provider, model, upstream);
      await service.apply((ns) => [planCapacity(ns, provider, model, capacity, ceiling)]);
      if (typeof load === 'function') await load();
      await refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [provider, model, view, upstream, service, load, refresh]);

  const applyDraft = () => {
    const parsed = parseCapacity(draft);
    if (parsed === null) {
      setError('请输入大于 0 的整数，可写 128k / 1.5m');
      return;
    }
    setDraft('');
    void save(parsed);
  };

  const pick = (id, fromMenu) => {
    if (fromMenu) setMenuOpen(false);
    if (id === FOLLOW_ID) {
      void save(null);
      return;
    }
    const preset = parsePresetId(id);
    if (preset !== null) {
      void save(preset);
      return;
    }
    if (id === 'settings') {
      setPanelOpen(false);
      setDialog(true);
      return;
    }
    if (id === 'reload') reloadUi();
  };

  if (typeof model !== 'string' || model === '') return null;

  const current = currentCapacity(view, provider, model);
  const declared = followCapacity(view, provider, model);
  const known = upstream instanceof Map ? upstream.get(model) : undefined;
  const upstreamValue = known ?? declared;
  const ceiling = upstreamCapacity(view, provider, model, upstream);
  const custom = current !== undefined;
  const items = buildMenuItems({
    provider, model, current, effective: upstreamValue, ceiling, busy,
  });
  const selectedId = selectedItemId(current);
  const label = current === undefined
    ? (upstreamValue === undefined ? '跟随' : shortLabel(upstreamValue))
    : shortLabel(current);

  const chip = h('button', {
    key: 'chip',
    type: 'button',
    className: 'cp-chip',
    'data-open': panelOpen || menuOpen ? 'true' : 'false',
    'data-custom': custom ? 'true' : 'false',
    'aria-haspopup': 'dialog',
    'aria-expanded': panelOpen,
    title: `上下文窗口：${current === undefined ? '跟随上游' : shortLabel(current)}（左键档位，右键菜单）`,
    onClick: () => {
      setMenuOpen(false);
      setPanelOpen((prev) => !prev);
    },
    onContextMenu: (event) => {
      event.preventDefault();
      pointer.current = {
        left: event.clientX,
        right: event.clientX + 1,
        top: event.clientY,
        bottom: event.clientY + 1,
        width: 0,
        height: 0,
      };
      setPanelOpen(false);
      setMenuOpen(true);
    },
  },
    h('span', { className: 'cp-dot' }),
    h('span', null, label),
  );

  const anchorRect = () => pointer.current ?? ZERO_RECT;

  const Menu = menuComponent();
  const surface = Menu
    ? h(Menu, {
      open: menuOpen,
      onClose: () => setMenuOpen(false),
      items,
      selectedId: selectedId ?? undefined,
      onSelect: (id) => pick(id, true),
      align: 'start',
      side: 'bottom',
      portal: true,
      getAnchorRect: anchorRect,
      className: 'cp-root',
    })
    : h('span', { className: 'cp-root' },
      h(FallbackMenu, {
        open: menuOpen,
        items,
        onSelect: (id) => pick(id, true),
      }),
    );

  const panel = panelOpen
    ? h(ChipPanel, {
      provider,
      model,
      current,
      upstreamValue,
      ceiling,
      busy,
      draft,
      error,
      onPick: (id) => pick(id, false),
      onDraft: setDraft,
      onApply: applyDraft,
      onSettings: () => {
        setPanelOpen(false);
        setDialog(true);
      },
      onReload: () => reloadUi(),
      onClose: () => setPanelOpen(false),
    })
    : null;

  return h(React.Fragment, null,
    h('span', { className: 'cp-wrap', ref: rootRef },
      chip,
      surface,
      panel,
      error !== '' && !panelOpen && h('div', { className: 'cp-error-pop', role: 'alert' }, error),
    ),
    h(SettingsDialog, { service, open: dialog, onClose: () => setDialog(false) }),
  );
}

function registerSlots(ctx, service) {
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'context-presets-chip',
    order: 5,
    inject: (sessionId) => {
      const directories = ctx.modelDirectories ?? ctx.get?.('modelDirectories');
      const directory = directories.directoryFor(sessionId);
      return { directory: directory.store, load: () => directory.load(), service };
    },
  }, ComposerChip));

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: 'dsh-context-presets',
    inject: () => ({ service }),
  }, (props = {}) => (props.view === 'summary' ? null : h(SettingsPanel, { service }))));
}

const name = 'context-presets';
const inject = ['slots', 'modelDirectories', 'remote', 'remote.llm', 'remote.settings'];

const STYLE_ID = 'dsh-context-presets-style';

function apply(ctx) {
  ctx.effect(() => installStyles(STYLE_ID, CSS));
  const service = createService(ctx);
  if (!service.available) return;
  registerSlots(ctx, service);
}
return { name, inject, apply };
}});
