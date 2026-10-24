import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navClass = ({ isActive }) => `navlink${isActive ? ' active' : ''}`;

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
        <div className="topbar__inner">
          <Link to="/" className="wordmark">EasyBook</Link>
          <nav aria-label="Main">
            <NavLink to="/" end className={navClass}>Restaurants</NavLink>
            {user?.role === 'diner' && <NavLink to="/my-bookings" className={navClass}>My bookings</NavLink>}
            {user?.role === 'owner' && <NavLink to="/owner" className={navClass}>My restaurants</NavLink>}
            {user ? (
              <>
                <span className="nav-user">{user.name}</span>
                <button type="button" className="secondary" onClick={signOut}>Log out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>Log in</NavLink>
                <Link to="/register" className="btn">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="container"><Outlet /></main>
      <footer className="footer">
        Restaurant data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL).
        Seeded menus, tables and hours are sample data.
      </footer>
    </>
  );
}
