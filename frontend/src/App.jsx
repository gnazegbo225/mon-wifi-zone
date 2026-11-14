import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import AccountPage from './pages/AccountPage';
import BuyPage from './pages/BuyPage';
import EmployeesPage from './pages/EmployeesPage';
import DashboardHome from './pages/DashboardHome';
import FinancesPage from './pages/FinancesPage';
import ForfaitsPage from './pages/ForfaitsPage';
import LoginPage from './pages/LoginPage';
import MerciPage from './pages/MerciPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PortalPage from './pages/PortalPage';
import RegisterPage from './pages/RegisterPage';
import TicketsPage from './pages/TicketsPage';
import ZonesPage from './pages/ZonesPage';

// Page d'accueil chargée à part : framer-motion n'alourdit pas les pages d'achat ouvertes sur le hotspot.
const LandingPage = lazy(() => import('./pages/LandingPage'));
// Espace super admin : chargé à part, indépendant de l'espace promoteur.
const AdminApp = lazy(() => import('./admin/AdminApp'));

const blank = <div className="min-h-dvh bg-page" />;

// Anciennes adresses (/dashboard/...) : on garde la suite du chemin et la recherche.
function DashboardRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/dashboard/, '/espace') + search} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={blank}>
            <LandingPage />
          </Suspense>
        }
      />
      {/* Espace promoteur */}
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route path="/login" element={<Navigate to="/connexion" replace />} />
      <Route path="/dashboard/*" element={<DashboardRedirect />} />

      {/* Parcours client, sans connexion */}
      <Route path="/buy/:zoneId" element={<BuyPage />} />
      <Route path="/merci" element={<MerciPage />} />
      <Route path="/paiement/succes" element={<PaymentSuccessPage />} />
      <Route path="/paiement/echec" element={<PaymentFailedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/espace" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="forfaits" element={<ForfaitsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="portail" element={<PortalPage />} />
          <Route path="compte" element={<AccountPage />} />
          <Route path="finances" element={<FinancesPage />} />
          <Route path="employes" element={<EmployeesPage />} />
        </Route>
      </Route>

      {/* Espace super admin */}
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={blank}>
            <AdminApp />
          </Suspense>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
