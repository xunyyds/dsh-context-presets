import {
  FOLLOW_ID, PRESETS, formatCapacity, presetId, shortLabel,
} from '../core/capacity.js';

import { h } from './dom.js';

export function ChipPanel(props) {
  const {
    provider, model, current, defaultText, liveWindow, ceiling, busy, draft, error, managed,
    onPick, onDraft, onApply, onSettings, onReload, onClose,
  } = props;

  const locked = Boolean(busy) || !managed;
  const currentText = current === undefined ? '跟随上游' : formatCapacity(current);
  const fallbackText = defaultText === undefined ? '未知' : formatCapacity(defaultText);
  const liveText = Number.isInteger(liveWindow) ? formatCapacity(liveWindow) : null;

  const presets = [h('button', {
    key: 'follow',
    type: 'button',
    className: 'cp-btn',
    disabled: locked,
    'aria-pressed': current === undefined ? 'true' : 'false',
    onClick: () => onPick(FOLLOW_ID),
  }, '跟随上游')];

  for (const preset of PRESETS) {
    const beyond = Number.isInteger(ceiling) && preset > ceiling;
    presets.push(h('button', {
      key: preset,
      type: 'button',
      className: 'cp-btn',
      disabled: locked || beyond,
      'aria-pressed': current === preset ? 'true' : 'false',
      title: beyond ? '超过上游声明的上限' : undefined,
      onClick: () => onPick(presetId(preset)),
    }, shortLabel(preset)));
  }

  return h('div', { className: 'cp-pop', role: 'dialog', 'aria-label': '上下文窗口' },
    h('div', { className: 'cp-pop-head' },
      h('div', { className: 'cp-pop-route' }, `${provider} / ${model}`),
      liveText !== null && h('div', { className: 'cp-status' },
        h('span', null, '生效中 ', h('b', null, liveText))),
      h('div', { className: 'cp-status' },
        h('span', null, '当前设定 ', h('b', null, currentText)),
        h('span', null, '默认（上游） ', h('b', null, fallbackText)),
      ),
      Number.isInteger(ceiling) && h('div', { className: 'cp-hint' }, `上游上限 ${formatCapacity(ceiling)}`),
      !managed && h('div', { className: 'cp-hint' }, '该提供方不由 llm-pi-ai 管理，仅显示生效值。'),
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
