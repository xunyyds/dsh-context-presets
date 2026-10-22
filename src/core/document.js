export const MODEL_NS = 'llm-pi-ai';

export function modelNamespace(described) {
  const namespaces = Array.isArray(described?.namespaces) ? described.namespaces : [];
  return namespaces.find((entry) => entry?.ns === MODEL_NS) ?? null;
}

export function profileOf(view, provider) {
  const providers = view?.value?.providers;
  if (!providers || typeof providers !== 'object') return undefined;
  return providers[provider];
}

export function baseProfileOf(view, provider) {
  const providers = view?.base?.providers;
  if (!providers || typeof providers !== 'object') return undefined;
  return providers[provider];
}

export function currentCapacity(view, provider, model) {
  const profile = profileOf(view, provider);
  if (!profile) return undefined;
  if (Array.isArray(profile.models) && profile.models.length > 0) {
    return profile.models.find((entry) => entry?.id === model)?.contextWindow;
  }
  return profile.modelOverrides?.[model]?.contextWindow;
}

export function declaredCapacity(view, provider, model) {
  const models = baseProfileOf(view, provider)?.models;
  if (!Array.isArray(models)) return undefined;
  const hit = models.find((entry) => entry?.id === model);
  return Number.isInteger(hit?.contextWindow) && hit.contextWindow > 0 ? hit.contextWindow : undefined;
}

export function providerDefault(view, provider) {
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

export function followCapacity(view, provider, model) {
  const declared = declaredCapacity(view, provider, model);
  if (declared !== undefined) return declared;
  return providerDefault(view, provider);
}

export function upstreamCapacity(view, provider, model, discovered) {
  const known = discovered instanceof Map ? discovered.get(model) : undefined;
  if (Number.isInteger(known) && known > 0) return known;
  return declaredCapacity(view, provider, model);
}

export function effectiveCapacity(view, provider, model) {
  const own = currentCapacity(view, provider, model);
  if (own !== undefined) return own;
  return followCapacity(view, provider, model);
}

export function modelsOf(view, provider) {
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

export function knownModels(view, provider, discovered) {
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

export function providersOf(view) {
  const providers = view?.value?.providers;
  if (!providers || typeof providers !== 'object') return [];
  return Object.keys(providers).map((id) => ({ id, models: modelsOf(view, id) }));
}

export function customizationCount(view) {
  let count = 0;
  for (const provider of providersOf(view)) {
    for (const model of provider.models) {
      if (model.capacity === undefined) continue;
      if (model.capacity !== declaredCapacity(view, provider.id, model.id)) count += 1;
    }
  }
  return count;
}

export function providerCustomizationCount(view, provider) {
  let count = 0;
  for (const model of modelsOf(view, provider)) {
    if (model.capacity === undefined) continue;
    if (model.capacity !== declaredCapacity(view, provider, model.id)) count += 1;
  }
  return count;
}
