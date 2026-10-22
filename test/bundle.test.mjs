import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

function createReact() {
  const states = [];
  const refs = [];
  const effects = [];
  const memo = [];
  const depsOf = (index) => memo[index];
  const same = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  let cursor = 0;
  const useState = (initial) => {
    const at = cursor++;
    if (!(at in states)) states[at] = typeof initial === 'function' ? initial() : initial;
    const set = (next) => {
      states[at] = typeof next === 'function' ? next(states[at]) : next;
    };
    return [states[at], set];
  };
  const useRef = (initial) => {
    const at = cursor++;
    if (!(at in refs)) refs[at] = { current: initial };
    return refs[at];
  };
  const useCallback = (fn, deps) => {
    const at = cursor++;
    const previous = depsOf(at);
    if (previous !== undefined && same(previous.deps, deps)) return previous.fn;
    memo[at] = { deps, fn };
    return fn;
  };
  const useMemo = (factory, deps) => {
    const at = cursor++;
    const previous = depsOf(at);
    if (previous !== undefined && same(previous.deps, deps)) return previous.value;
    const value = factory();
    memo[at] = { deps, value };
    return value;
  };
  const useEffect = (fn, deps) => {
    const at = cursor++;
    const previous = depsOf(at);
    const changed = previous === undefined || !same(previous.deps, deps);
    memo[at] = { deps };
    if (changed) effects.push(fn);
  };
  const useSyncExternalStore = (subscribe, snapshot) => {
    cursor += 1;
    return snapshot();
  };
  const createElement = (type, props, ...children) => ({
    type,
    props: {
      ...(props ?? {}),
      children: children.length === 0 ? props?.children : children.length === 1 ? children[0] : children,
    },
  });
  return {
    useState,
    useRef,
    useCallback,
    useMemo,
    useEffect,
    useSyncExternalStore,
    createElement,
    Fragment: 'fragment',
    effects,
    resetCursor() { cursor = 0; },
  };
}

function render(node, React) {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return { text: String(node) };
  if (Array.isArray(node)) return node.map((child) => render(child, React));
  if (node.type === React.Fragment || node.type === 'fragment') return render(node.props.children, React);
  if (typeof node.type === 'function') return render(node.type(node.props ?? {}), React);
  return {
    tag: typeof node.type === 'string' ? node.type : String(node.type),
    props: node.props ?? {},
    children: render(node.props?.children, React),
  };
}

function textOf(tree) {
  if (tree === null || tree === undefined) return '';
  if (Array.isArray(tree)) return tree.map(textOf).join(' ');
  if (tree.text !== undefined) return tree.text;
  return textOf(tree.children);
}

function findAll(tree, tag, out = []) {
  if (tree === null || tree === undefined) return out;
  if (Array.isArray(tree)) {
    for (const child of tree) findAll(child, tag, out);
    return out;
  }
  if (tree.tag === tag) out.push(tree);
  findAll(tree.children, tag, out);
  return out;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function settle(React, element) {
  const pass = async () => {
    React.resetCursor();
    React.effects.length = 0;
    const tree = render(element, React);
    for (const effect of React.effects.splice(0)) {
      try { effect(); } catch (ignored) { void ignored; }
    }
    await tick();
    return tree;
  };
  await pass();
  await pass();
  await pass();
  React.resetCursor();
  React.effects.length = 0;
  return render(element, React);
}

async function act(React, fn, element) {
  fn();
  return settle(React, element);
}

function makePrimitives(React) {
  const Menu = (props) => {
    const children = [props.anchor ?? null];
    if (props.open) {
      children.push(React.createElement('div', { key: 'menu', 'data-menu': 'open' },
        props.items.map((item) => React.createElement('button', {
          key: item.id,
          'data-item': item.id,
          disabled: item.disabled === true,
          onClick: () => props.onSelect?.(item.id),
        }, item.label ?? item.text ?? ''))));
    }
    return React.createElement('div', { ...props, className: 'fake-menu' }, children);
  };
  const Modal = (props) => {
    if (!props.open) return null;
    return React.createElement('div', { role: 'dialog' },
      [React.createElement('h2', { key: 'title' }, props.title), props.children]);
  };
  return { Menu, Modal };
}

function loadBundle(React, modules = {}) {
  let registered = null;
  const sandboxWindow = {
    __ModuleLoader__: {
      load({ id, factory }) {
        registered = { id, factory };
      },
    },
  };
  const require = (spec) => {
    if (spec === 'react') return React;
    if (spec in modules) return modules[spec];
    throw new Error(`unexpected require: ${spec}`);
  };
  const fakeDocument = {
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '', remove() {} }),
    head: { append() {} },
  };
  const fn = new Function('window', 'document', source);
  fn(sandboxWindow, fakeDocument);
  assert.ok(registered !== null, 'bundle did not register with the module loader');
  assert.equal(registered.id, 'dsh-context-presets');
  return registered.factory(require);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyOp(view, op) {
  const { path } = op;
  if (op.op === 'set' && path.length === 3 && path[2] === 'models') {
    view.value.providers[path[1]].models = clone(op.value);
    return;
  }
  if (op.op === 'set' && path.length === 5 && path[2] === 'modelOverrides') {
    const [, provider, , model, field] = path;
    view.value.providers[provider].modelOverrides ??= {};
    view.value.providers[provider].modelOverrides[model] ??= {};
    view.value.providers[provider].modelOverrides[model][field] = op.value;
    return;
  }
  if (op.op === 'unset' && path.length === 5 && path[2] === 'modelOverrides') {
    const [, provider, , model, field] = path;
    const target = view.value.providers[provider].modelOverrides?.[model];
    if (target) delete target[field];
  }
}

const DOC = {
  value: {
    providers: {
      deepseek: { modelOverrides: {} },
      custom: { models: [{ id: 'alpha', contextWindow: 32000, maxTokens: 4096 }, { id: 'beta' }] },
    },
  },
  base: {
    providers: {
      deepseek: {
        defaultContextWindow: 262144,
        models: [{ id: 'deepseek-chat', contextWindow: 128000 }],
      },
      custom: { models: [{ id: 'alpha', contextWindow: 32000 }, { id: 'beta', contextWindow: 64000 }] },
    },
  },
};

function makeSettings(doc) {
  const calls = { describe: 0, mutate: [] };
  const state = { view: clone(doc), writable: true, revision: 7 };
  return {
    calls,
    state,
    async describe() {
      calls.describe += 1;
      return {
        ok: true,
        value: {
          writable: state.writable,
          namespaces: [{
            ns: 'llm-pi-ai',
            revision: state.revision,
            value: state.view.value,
            base: state.view.base,
          }],
        },
      };
    },
    async mutate(ns, ops, revision) {
      calls.mutate.push({ ns, ops, revision });
      for (const op of ops) applyOp(state.view, op);
      state.revision += 1;
      return { ok: true, value: { revision: state.revision } };
    },
  };
}

function makeCtx(settings, discovered = {}) {
  const slots = [];
  const services = {
    remote: {
      settings,
      llm: {
        async discoverModels(ns, request) {
          const list = discovered[request.provider] ?? [];
          return { ok: true, value: list };
        },
      },
    },
    modelDirectories: {
      directoryFor: () => ({
        store: {
          getSnapshot: () => ({ current: { provider: 'deepseek', model: 'deepseek-chat' } }),
          subscribe: () => () => {},
        },
        load: async () => {},
      }),
    },
  };
  const ctx = {
    slots: {
      inject(name, register) { slots.push({ name, register }); },
      register(options, component) { return { options, component }; },
    },
    effect(fn) {
      fn();
      return () => {};
    },
    get(name) { return services[name]; },
    ...services,
  };
  return { ctx, slots };
}

function registrations(api, settings, discovered) {
  const { ctx, slots } = makeCtx(settings, discovered);
  api.apply(ctx);
  return slots.map((entry) => ({ name: entry.name, value: entry.register() }));
}

function chipOf(list) {
  return list.find((entry) => entry.name === 'conversation.composer.dock');
}

function pageOf(list) {
  return list.find((entry) => entry.name === 'plugins.bundle.config');
}

function findChip(tree) {
  return findAll(tree, 'button').find((node) => node.props?.className === 'cp-chip') ?? null;
}

function findItem(tree, id) {
  return findAll(tree, 'button').find((node) => node.props?.['data-item'] === id) ?? null;
}

function menuProps(tree) {
  const nodes = findAll(tree, 'div');
  return nodes.find((node) => node.props?.className === 'fake-menu')?.props ?? null;
}

test('bundle exports the host contract and requires only baseline modules', () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  assert.equal(api.name, 'context-presets');
  assert.deepEqual(api.inject, ['slots', 'modelDirectories', 'remote', 'remote.llm', 'remote.settings']);
  assert.equal(typeof api.apply, 'function');
});

test('apply registers the composer chip and the plugin page', () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const list = registrations(api, makeSettings(DOC));
  assert.deepEqual(list.map((entry) => entry.name), ['conversation.composer.dock', 'plugins.bundle.config']);
  assert.equal(chipOf(list).value.options.id, 'context-presets-chip');
  assert.equal(pageOf(list).value.options.key, 'dsh-context-presets');
});

test('the chip shows the upstream window while following', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const chip = chipOf(registrations(api, makeSettings(DOC)));
  const props = chip.value.options.inject('session-1');
  const element = React.createElement(chip.value.component, props);
  const tree = await settle(React, element);
  const button = findChip(tree);
  assert.ok(button, 'chip button missing');
  assert.equal(textOf(button).trim(), '128K');
  assert.equal(button.props['data-custom'], 'false');
  assert.equal(button.props['data-open'], 'false');
});

test('right click opens the tier menu and marks the current tier', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const chip = chipOf(registrations(api, makeSettings(DOC)));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  const tree = await settle(React, element);
  const opened = await act(React, () => {
    findChip(tree).props.onContextMenu({ preventDefault() {}, clientX: 40, clientY: 80 });
  }, element);
  assert.ok(findItem(opened, 'follow'), 'follow tier missing');
  assert.ok(findItem(opened, 'preset:128000'), 'preset tier missing');
  assert.ok(findItem(opened, 'settings'), 'settings action missing');
  assert.ok(findItem(opened, 'reload'), 'refresh action missing');
  const props = menuProps(opened);
  assert.equal(props.selectedId, 'follow');
  assert.equal(props.portal, true);
});

test('picking a tier writes the model override', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  const chip = chipOf(registrations(api, settings));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findChip(tree).props.onContextMenu({ preventDefault() {}, clientX: 1, clientY: 1 });
  }, element);
  tree = await act(React, () => {
    findItem(tree, 'preset:64000').props.onClick();
  }, element);
  assert.equal(settings.calls.mutate.length, 1);
  const [call] = settings.calls.mutate;
  assert.equal(call.ns, 'llm-pi-ai');
  assert.deepEqual(call.ops[0].path, ['providers', 'deepseek', 'modelOverrides', 'deepseek-chat', 'contextWindow']);
  assert.equal(call.ops[0].value, 64000);
  const button = findChip(tree);
  assert.equal(textOf(button).trim(), '64K');
  assert.equal(button.props['data-custom'], 'true');
});

test('the settings entry opens the dialog with every provider', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const chip = chipOf(registrations(api, makeSettings(DOC)));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findChip(tree).props.onClick();
  }, element);
  tree = await act(React, () => {
    findAll(tree, 'button').find((node) => node.props?.className === 'cp-btn' && textOf(node).trim() === '设置…').props.onClick();
  }, element);
  const dialog = findAll(tree, 'div').find((node) => node.props?.role === 'dialog');
  assert.ok(dialog, 'dialog did not open');
  const text = textOf(dialog);
  assert.match(text, /deepseek-chat/);
  assert.match(text, /alpha/);
  assert.match(text, /上游/);
});

test('custom values above the discovered upstream window are refused', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  const chip = chipOf(registrations(api, settings, {
    deepseek: [{ id: 'deepseek-chat', contextWindow: 100000 }],
  }));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findChip(tree).props.onContextMenu({ preventDefault() {}, clientX: 1, clientY: 1 });
  }, element);
  const above = findItem(tree, 'preset:128000');
  assert.equal(above.props.disabled, true);
  tree = await act(React, () => {
    menuProps(tree).onSelect('preset:128000');
  }, element);
  assert.match(textOf(tree), /不能超过上游/);
  assert.equal(settings.calls.mutate.length, 0);
});

test('a read-only profile surfaces the failure instead of writing', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  settings.state.writable = false;
  const chip = chipOf(registrations(api, settings));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    menuProps(tree).onSelect('preset:32000');
  }, element);
  assert.match(textOf(tree), /不可写/);
  assert.equal(settings.calls.mutate.length, 0);
});

test('the plugin page renders providers and the auto-follow hint', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const page = pageOf(registrations(api, makeSettings(DOC)));
  assert.equal(page.value.component({ view: 'summary' }), null);
  const tree = await settle(React, page.value.component({ view: 'page' }));
  const text = textOf(tree);
  assert.match(text, /已自定义/);
  assert.match(text, /custom/);
  assert.match(text, /跟随/);
});

test('the surfaces survive a document without llm-pi-ai', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  settings.describe = async () => ({ ok: true, value: { writable: true, namespaces: [] } });
  const list = registrations(api, settings);
  const pageTree = await settle(React, pageOf(list).value.component({ view: 'page' }));
  assert.match(textOf(pageTree), /未发现/);
  const chipTree = await settle(React, React.createElement(
    chipOf(list).value.component,
    chipOf(list).value.options.inject('session-1'),
  ));
  assert.match(textOf(chipTree), /跟随/);
});

test('the chip tolerates a missing model selection', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const chip = chipOf(registrations(api, makeSettings(DOC)));
  const props = chip.value.options.inject('session-1');
  const emptyStore = { getSnapshot: () => ({ current: null }), subscribe: () => () => {} };
  const tree = await settle(React, React.createElement(chip.value.component, { ...props, directory: emptyStore }));
  assert.equal(tree, null);
});

test('a failing describe becomes an error, never a crash', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  settings.describe = async () => ({ ok: false, error: { message: 'boom' } });
  const chip = chipOf(registrations(api, settings));
  const tree = await settle(React, React.createElement(chip.value.component, chip.value.options.inject('session-1')));
  assert.match(textOf(tree), /boom/);
});

test('the chip prefers the live session window over the configured value', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const chip = chipOf(registrations(api, makeSettings(DOC)));
  const props = chip.value.options.inject('session-1');
  const useProjection = (key) => (key === 'contextPressure' ? { contextWindow: 1000000 } : undefined);
  const element = React.createElement(chip.value.component, { ...props, useProjection });
  const tree = await settle(React, element);
  const button = findChip(tree);
  assert.equal(textOf(button).trim(), '1M');
  const opened = await act(React, () => {
    findChip(tree).props.onClick();
  }, element);
  assert.match(textOf(opened), /生效中\s*1M/);
  assert.match(textOf(opened), /默认（上游）\s*128K/);
});

test('without ui primitives the plugin falls back to its own menu', async () => {
  const React = createReact();
  const api = loadBundle(React);
  const chip = chipOf(registrations(api, makeSettings(DOC)));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findChip(tree).props.onContextMenu({ preventDefault() {}, clientX: 2, clientY: 3 });
  }, element);
  const text = textOf(tree);
  assert.match(text, /跟随上游/);
  assert.match(text, /界面刷新/);
});

test('left click opens the status popover with current and default values', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  const chip = chipOf(registrations(api, settings));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findChip(tree).props.onClick();
  }, element);
  const pop = findAll(tree, 'div').find((node) => node.props?.className === 'cp-pop');
  assert.ok(pop, 'popover did not open');
  const text = textOf(pop);
  assert.match(text, /当前设定\s*跟随上游/);
  assert.match(text, /默认（上游）\s*128K/);
  const presets = findAll(pop, 'button').filter((node) => node.props?.className === 'cp-btn');
  assert.equal(presets[0] ? textOf(presets[0]).trim() : '', '跟随上游');
  assert.ok(presets.some((node) => textOf(node).trim() === '1M'));
  assert.ok(findAll(pop, 'input').length >= 1, 'custom input missing');
});

test('the popover applies a typed custom value', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  const chip = chipOf(registrations(api, settings));
  const element = React.createElement(chip.value.component, chip.value.options.inject('session-1'));
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findChip(tree).props.onClick();
  }, element);
  const input = findAll(tree, 'input').find((node) => /自定义/.test(node.props?.placeholder ?? ''));
  assert.ok(input, 'custom input missing');
  tree = await act(React, () => {
    input.props.onChange({ target: { value: '96k' } });
  }, element);
  const apply = findAll(tree, 'button').find((node) => textOf(node).trim() === '应用');
  tree = await act(React, () => {
    apply.props.onClick();
  }, element);
  assert.equal(settings.calls.mutate.length, 1);
  assert.equal(settings.calls.mutate[0].ops[0].value, 96000);
});

test('the settings page can show only customized models', async () => {
  const React = createReact();
  const api = loadBundle(React, { '@deepseek-ai/dsh-client-ui-primitives': makePrimitives(React) });
  const settings = makeSettings(DOC);
  settings.state.view.value.providers.custom.models[0].contextWindow = 48000;
  const page = pageOf(registrations(api, settings));
  const element = page.value.component({ view: 'page' });
  let tree = await settle(React, element);
  tree = await act(React, () => {
    findAll(tree, 'button').find((node) => textOf(node).trim() === '只看已自定义').props.onClick();
  }, element);
  const text = textOf(tree);
  assert.match(text, /已调整 1/);
  assert.match(text, /alpha/);
});
