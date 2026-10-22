import {
  FOLLOW_ID, PRESETS, presetId, shortLabel,
} from './capacity.js';

export function followLabel(ceiling) {
  return Number.isInteger(ceiling) ? `跟随上游 · ${shortLabel(ceiling)}` : '跟随上游';
}

export function menuHead(provider, model, current, effective) {
  const route = [provider, model].filter(Boolean).join(' / ');
  const now = current === undefined
    ? `跟随 ${shortLabel(effective)}`
    : shortLabel(current);
  return `${route} · ${now}`;
}

export function buildMenuItems(state) {
  const {
    provider, model, current, effective, ceiling, busy, managed = true,
  } = state;
  const locked = Boolean(busy) || !managed;
  const items = [];
  items.push({ id: 'head', type: 'label', text: menuHead(provider, model, current, effective) });
  items.push({ id: 'sep-top', type: 'separator' });
  items.push({ id: FOLLOW_ID, label: followLabel(ceiling), disabled: locked });
  for (const preset of PRESETS) {
    const beyond = Number.isInteger(ceiling) && preset > ceiling;
    items.push({
      id: presetId(preset),
      label: beyond ? `${shortLabel(preset)}（超出上游）` : shortLabel(preset),
      disabled: locked || beyond,
    });
  }
  items.push({ id: 'sep-actions', type: 'separator' });
  if (!managed) items.push({ id: 'notice', type: 'label', text: '该提供方不由 llm-pi-ai 管理' });
  items.push({ id: 'settings', label: '设置…' });
  items.push({ id: 'sep-reload', type: 'separator' });
  items.push({ id: 'reload', label: '界面刷新' });
  return items;
}

export function selectedItemId(current) {
  if (current === undefined) return FOLLOW_ID;
  return PRESETS.includes(current) ? presetId(current) : null;
}
