import { h } from './dom.js';

export function FallbackMenu({ open, items, onSelect }) {
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

export function FallbackModal({
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
