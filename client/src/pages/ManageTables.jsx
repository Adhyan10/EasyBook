import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';

export default function ManageTables() {
  const { id } = useParams();
  const { call } = useAuth();
  const { data, error, loading, reload } = useLoad(() => call(`/restaurants/${id}/tables`), [id]);
  const [form, setForm] = useState({ label: '', seats: 2 });
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const addTable = (event) => {
    event.preventDefault();
    return run(async () => {
      await call(`/restaurants/${id}/tables`, { method: 'POST', body: { label: form.label, seats: Number(form.seats) } });
      setForm({ label: '', seats: 2 });
    });
  };
  const toggle = (table) =>
    run(() => call(`/tables/${table._id}`, { method: 'PATCH', body: { isActive: !table.isActive } }));
  const remove = (table) => {
    if (!window.confirm(`Delete table ${table.label}?`)) return undefined;
    return run(() => call(`/tables/${table._id}`, { method: 'DELETE' }));
  };

  return (
    <>
      <p><Link to="/owner">← My restaurants</Link></p>
      <h1>Tables</h1>
      <ErrorBanner error={error ?? actionError} />
      {loading && <Spinner />}
      {data?.length === 0 && <EmptyState>No tables yet. Diners cannot book until you add at least one.</EmptyState>}
      {data?.length > 0 && (
        <table>
          <thead><tr><th>Label</th><th>Seats</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.map((table) => (
              <tr key={table._id}>
                <td>{table.label}</td>
                <td>{table.seats}</td>
                <td>{table.isActive ? 'Active' : 'Disabled'}</td>
                <td className="row">
                  <button type="button" className="secondary" disabled={busy} onClick={() => toggle(table)}>
                    {table.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" className="danger" disabled={busy} onClick={() => remove(table)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="card row" onSubmit={addTable}>
        <label>Label<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required maxLength={30} /></label>
        <label>Seats<input type="number" min={1} max={50} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required /></label>
        <button type="submit" disabled={busy}>Add table</button>
      </form>
    </>
  );
}
