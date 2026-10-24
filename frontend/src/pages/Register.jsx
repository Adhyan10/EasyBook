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
    <div className="auth">
      <h1>Create your account</h1>
      <p className="auth__sub">Diners book tables. Owners list their restaurant and manage reservations.</p>
      <form className="card form" onSubmit={submit}>
        <ErrorBanner error={error} />
        <label>Full name<input value={form.name} onChange={update('name')} required minLength={2} autoComplete="name" /></label>
        <label>Email<input type="email" value={form.email} onChange={update('email')} required autoComplete="email" /></label>
        <label>Password<input type="password" value={form.password} onChange={update('password')} required minLength={8} autoComplete="new-password" aria-describedby="pw-hint" />
          <span id="pw-hint" className="small muted" style={{ fontWeight: 400 }}>At least 8 characters.</span>
        </label>
        <label>I want to
          <select value={form.role} onChange={update('role')}>
            <option value="diner">Book tables as a diner</option>
            <option value="owner">List my restaurant as an owner</option>
          </select>
        </label>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="muted small">Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}
