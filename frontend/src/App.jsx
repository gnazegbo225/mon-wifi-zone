import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import BuyPage from './pages/BuyPage';
import DashboardHome from './pages/DashboardHome';
import ForfaitsPage from './pages/ForfaitsPage';
import LoginPage from './pages/LoginPage';
import MerciPage from './pages/MerciPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PortalPage from './pages/PortalPage';
import TicketsPage from './pages/TicketsPage';
import ZonesPage from './pages/ZonesPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Parcours client, sans connexion */}
      <Route path="/buy/:zoneId" element={<BuyPage />} />
      <Route path="/merci" element={<MerciPage />} />
      <Route path="/paiement/succes" element={<PaymentSuccessPage />} />
      <Route path="/paiement/echec" element={<PaymentFailedPage />} />

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
