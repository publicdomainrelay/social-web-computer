/* ── Structured JSON logger ── */
export function log(level, component, event, data = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, component, event, ...data });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

/* ── HTML-escape helper ── */
export function escapeHtml(s) {
  const el = document.createElement('span');
  el.textContent = String(s);
  return el.innerHTML;
}

/* ── Debounce ── */
export function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
