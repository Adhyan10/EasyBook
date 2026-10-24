import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { rupees } from '../lib/format.js';

const EMPTY_FORM = { category: '', name: '', price: '', isVeg: true };

function ItemRow({ item, busy, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: item.name, price: item.price });

  if (!editing) {
    return (
      <tr>
        <td>{item.name}</td>
        <td>{rupees(item.price)}</td>
        <td>{item.isVeg ? 'Veg' : 'Non-veg'}</td>
        <td className="row">
          <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="danger" disabled={busy} onClick={() => onDelete(item)}>Delete</button>
        </td>
      </tr>
    );
  }
  const save = async () => {
    await onSave(item, { name: draft.name, price: Number(draft.price) });
    setEditing(false);
  };
  return (
    <tr>
      <td><input value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
      <td><input type="number" min={1} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></td>
      <td />
      <td className="row">
        <button type="button" disabled={busy} onClick={save}>Save</button>
        <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
      </td>
    </tr>
  );
}

export default function ManageMenu() {
  const { id } = useParams();
  const { call } = useAuth();
  const { data, error, loading, reload } = useLoad(() => call(`/restaurants/${id}/menu`), [id]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

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

  const addItem = (event) => {
    event.preventDefault();
    return run(async () => {
      await call(`/restaurants/${id}/menu`, {
        method: 'POST',
        body: { category: form.category, name: form.name, price: Number(form.price), isVeg: form.isVeg },
      });
      setForm(EMPTY_FORM);
    });
  };
  const saveItem = (item, changes) => run(() => call(`/menu-items/${item._id}`, { method: 'PATCH', body: changes }));
  const deleteItem = (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return undefined;
    return run(() => call(`/menu-items/${item._id}`, { method: 'DELETE' }));
  };

  return (
    <>
      <p><Link to="/owner">← My restaurants</Link></p>
      <h1>Menu</h1>
      <ErrorBanner error={error ?? actionError} />
      {loading && <Spinner />}
      {data?.isSample && (
        <p className="banner banner-warn">This menu still includes sample dishes. Editing a dish turns it into your own.</p>
      )}
      {data?.categories.length === 0 && <EmptyState>No menu yet. Add your first dish below.</EmptyState>}
      {data?.categories.map((category) => (
        <div key={category.name}>
          <h2>{category.name}</h2>
          <table>
            <thead><tr><th>Dish</th><th>Price</th><th>Type</th><th /></tr></thead>
            <tbody>
              {category.items.map((item) => (
                <ItemRow key={item._id} item={item} busy={busy} onSave={saveItem} onDelete={deleteItem} />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <form className="card row" onSubmit={addItem}>
        <label>Category<input value={form.category} maxLength={40} required onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
        <label>Dish<input value={form.name} maxLength={80} required onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Price (₹)<input type="number" min={1} max={100000} required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label className="inline-check">
          <input type="checkbox" checked={form.isVeg} onChange={(e) => setForm({ ...form, isVeg: e.target.checked })} /> Veg
        </label>
        <button type="submit" disabled={busy}>Add dish</button>
      </form>
    </>
  );
}
