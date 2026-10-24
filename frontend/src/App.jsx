import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import ForfaitsPage from './pages/ForfaitsPage';
import LoginPage from './pages/LoginPage';
import PortalPage from './pages/PortalPage';
import TicketsPage from './pages/TicketsPage';
import ZonesPage from './pages/ZonesPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="forfaits" element={<ForfaitsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="portail" element={<PortalPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
