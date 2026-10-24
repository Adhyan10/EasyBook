import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../lib/routes.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password);
      navigate(location.state?.from?.pathname ?? homeFor(user), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>Welcome back</h1>
      <p className="auth__sub">Log in to see your bookings or manage your restaurant.</p>
      <form className="card form" onSubmit={submit}>
        <ErrorBanner error={error} />
        <label>Email<input type="email" value={form.email} onChange={update('email')} required autoComplete="email" /></label>
        <label>Password<input type="password" value={form.password} onChange={update('password')} required autoComplete="current-password" /></label>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted small">New to EasyBook? <Link to="/register">Create an account</Link></p>
    </div>
  );
}
