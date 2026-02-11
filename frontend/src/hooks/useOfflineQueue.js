export function useOfflineQueue(key) {
  function save(data) {
    const q = JSON.parse(localStorage.getItem(key) || "[]");
    q.push({ ...data, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(q));
  }

  function read() {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }

  function clear() {
    localStorage.removeItem(key);
  }

  return { save, read, clear };
}
