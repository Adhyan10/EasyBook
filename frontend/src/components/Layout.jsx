import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">EasyBook</Link>
        <nav>
          <Link to="/">Restaurants</Link>
          {user?.role === 'diner' && <Link to="/my-bookings">My bookings</Link>}
          {user?.role === 'owner' && <Link to="/owner">My restaurants</Link>}
          {user ? (
            <>
              <span className="muted">{user.name}</span>
              <button type="button" className="link" onClick={signOut}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
