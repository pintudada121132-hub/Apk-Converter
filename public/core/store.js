// Tiny shared state container. Components read with get(), change with set(), and react with subscribe().
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((fn) => fn(state));
    },
    setFeature(key, value) {
      this.set({ features: { ...state.features, [key]: value } });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
