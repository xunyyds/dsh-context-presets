export const h = React.createElement;

export function installStyles(id, css) {
  if (document.getElementById(id) !== null) return () => {};
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

export function reloadUi() {
  if (typeof globalThis.location?.reload === 'function') globalThis.location.reload();
}

export function messageOf(error) {
  return String(error?.message ?? error ?? '未知错误');
}

export function useStore(store) {
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
