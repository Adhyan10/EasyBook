import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../lib/routes.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'diner' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      navigate(homeFor(await register(form)), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h1>Create an account</h1>
      <ErrorBanner error={error} />
      <label>Name<input value={form.name} onChange={update('name')} required minLength={2} /></label>
      <label>Email<input type="email" value={form.email} onChange={update('email')} required autoComplete="email" /></label>
      <label>Password (min 8 characters)<input type="password" value={form.password} onChange={update('password')} required minLength={8} autoComplete="new-password" /></label>
      <label>I am a
        <select value={form.role} onChange={update('role')}>
          <option value="diner">Diner (I book tables)</option>
          <option value="owner">Restaurant owner</option>
        </select>
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
    </form>
  );
}
