import { FOLLOW_ID, parseCapacity, parsePresetId, shortLabel } from '../core/capacity.js';

import { currentCapacity, defaultCapacity, upstreamCapacity } from '../core/document.js';

import { buildMenuItems, selectedItemId } from '../core/menu-items.js';
import { planCapacity } from '../core/plan.js';
import { SettingsDialog } from './dialog.js';
import {
  h, messageOf, reloadUi, useStore,
} from './dom.js';
import { FallbackMenu } from './fallback.js';
import { ChipPanel } from './popover.js';
import { menuComponent } from './primitives.js';

const ZERO_RECT = {
  left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0,
};

export function ComposerChip({
  directory, load, service, useProjection,
}) {
  const state = useStore(directory);
  const provider = state?.current?.provider;
  const model = state?.current?.model;
  const pressure = typeof useProjection === 'function' ? useProjection('contextPressure') : undefined;
  const liveWindow = Number.isInteger(pressure?.contextWindow) && pressure.contextWindow > 0
    ? pressure.contextWindow
    : undefined;
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
    if (typeof provider !== 'string' || provider === '' || view === null) return undefined;
    void service.upstream(provider, view).then((map) => {
      if (live) setUpstream(map);
    });
    return () => { live = false; };
  }, [provider, view, service]);

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
  const known = upstream instanceof Map ? upstream.get(model) : undefined;
  const defaultText = defaultCapacity(view, provider, model, upstream);
  const ceiling = upstreamCapacity(view, provider, model, upstream);
  const custom = current !== undefined;
  const items = buildMenuItems({
    provider, model, current, effective: defaultText, ceiling, busy,
  });
  const selectedId = selectedItemId(current);
  const label = shortLabel(liveWindow ?? (current === undefined ? defaultText : current));

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
      defaultText,
      liveWindow,
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
