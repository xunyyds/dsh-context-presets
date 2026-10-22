export const PRESETS = Object.freeze([32000, 64000, 100000, 128000, 200000, 256000, 512000, 1000000, 2000000]);

export const MIN_CAPACITY = 1;

export const FOLLOW_ID = 'follow';

export function parseCapacity(raw) {
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

export function isValidCapacity(value) {
  return Number.isInteger(value) && value >= MIN_CAPACITY;
}

function scaled(value, unit, suffix) {
  return `${Math.floor(value / unit)}${suffix}`;
}

export function formatCapacity(value) {
  return shortLabel(value);
}

export function shortLabel(value) {
  if (value === null || value === undefined) return '跟随上游';
  if (!isValidCapacity(value)) return String(value);
  if (value >= 1000000 && value % 1000000 === 0) return scaled(value, 1000000, 'M');
  if (value >= 1000) return scaled(value, 1000, 'K');
  return '<1K';
}

export function presetId(value) {
  return `preset:${value}`;
}

export function parsePresetId(id) {
  const match = /^preset:(\d+)$/.exec(String(id));
  return match === null ? null : Number(match[1]);
}
