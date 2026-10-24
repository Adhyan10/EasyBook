export function Spinner() {
  return <p className="muted" role="status">Loading…</p>;
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <p className="banner banner-error" role="alert">{error.message ?? String(error)}</p>;
}

export function EmptyState({ children }) {
  return <p className="muted empty">{children}</p>;
}
