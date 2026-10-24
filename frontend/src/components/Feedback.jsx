export function Spinner() {
  return <p className="loading" role="status">Loading…</p>;
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <p className="banner banner-error" role="alert">{error.message ?? String(error)}</p>;
}

export function EmptyState({ children }) {
  return <p className="empty muted">{children}</p>;
}
