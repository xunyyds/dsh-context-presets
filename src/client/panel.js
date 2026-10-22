import { formatCapacity, parseCapacity, shortLabel } from '../core/capacity.js';

import {
  customizationCount, declaredCapacity, knownModels, providerCustomizationCount,
  providerDefault, providersOf, upstreamCapacity,
} from '../core/document.js';

import { planBulk, planCapacity } from '../core/plan.js';
import { h, messageOf, reloadUi } from './dom.js';

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

export function SettingsPanel({ service }) {
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
