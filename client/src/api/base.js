// Normalize API base URL with sensible defaults for dev and prod.
// When running locally (served from localhost), prefer the backend on localhost:3001
// so API calls don't accidentally go to the Vite dev server (which serves HTML).
let DEFAULT_BASE = 'http://localhost:3001';
try {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    // Consider localhost-like hosts as development environment
    const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    if (!isLocal) {
      // In non-local environments, use same-origin so API calls target the current origin
      DEFAULT_BASE = window.location.origin;
    }
  }
} catch {}

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE;
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

export function apiUrl(path) {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export default apiUrl;
