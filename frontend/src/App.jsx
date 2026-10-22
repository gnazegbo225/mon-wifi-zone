import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import ForfaitsPage from './pages/ForfaitsPage';
import LoginPage from './pages/LoginPage';
import TicketsPage from './pages/TicketsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="forfaits" element={<ForfaitsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
