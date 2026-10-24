import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Browse from './pages/Browse.jsx';
import DayReservations from './pages/DayReservations.jsx';
import Deposits from './pages/Deposits.jsx';
import Login from './pages/Login.jsx';
import ManageTables from './pages/ManageTables.jsx';
import ManageMenu from './pages/ManageMenu.jsx';
import MyBookings from './pages/MyBookings.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';
import Register from './pages/Register.jsx';
import RestaurantDetail from './pages/RestaurantDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Browse />} />
        <Route path="/restaurants/:id" element={<RestaurantDetail />} />
        <Route path="/my-bookings" element={<ProtectedRoute role="diner"><MyBookings /></ProtectedRoute>} />
        <Route path="/owner" element={<ProtectedRoute role="owner"><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/owner/restaurants/:id/tables" element={<ProtectedRoute role="owner"><ManageTables /></ProtectedRoute>} />
        <Route path="/owner/restaurants/:id/reservations" element={<ProtectedRoute role="owner"><DayReservations /></ProtectedRoute>} />
        <Route path="/owner/restaurants/:id/deposits" element={<ProtectedRoute role="owner"><Deposits /></ProtectedRoute>} />
        <Route path="/owner/restaurants/:id/menu" element={<ProtectedRoute role="owner"><ManageMenu /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<p className="muted">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
