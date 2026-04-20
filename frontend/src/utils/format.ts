export function nid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function fmt$(n: number) {
  return `$${n.toLocaleString()}`;
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
