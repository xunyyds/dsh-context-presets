let cache = null;

export function primitives() {
  if (cache !== null) return cache;
  try {
    cache = require('@deepseek-ai/dsh-client-ui-primitives') ?? {};
  } catch {
    cache = {};
  }
  return cache;
}

export function menuComponent() {
  return primitives().Menu ?? null;
}

export function modalComponent() {
  return primitives().Modal ?? null;
}
