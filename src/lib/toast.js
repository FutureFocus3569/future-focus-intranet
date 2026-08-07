const listeners = new Set()

export function showToast(message, type = 'success') {
  const toast = { id: Math.random().toString(36).slice(2), message, type }
  listeners.forEach((fn) => fn(toast))
}

export function subscribeToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
