// Espace développeur (/dev/*), chargé à part et indépendant des espaces promoteur et super admin :
// santé de l'API, relectures des paiements chez Moneroo, paiements bloqués et resynchronisation.
import { Navigate, Route, Routes } from 'react-router-dom';
import DevAuthProvider from './DevAuthProvider';
import DevEventsPage from './DevEventsPage';
import DevHealthPage from './DevHealthPage';
import DevLayout from './DevLayout';
import DevLoginPage from './DevLoginPage';
import DevPaymentPage from './DevPaymentPage';
import DevPaymentsPage from './DevPaymentsPage';

export default function DevApp() {
  return (
    <DevAuthProvider>
      <Routes>
        <Route path="connexion" element={<DevLoginPage />} />
        <Route element={<DevLayout />}>
          <Route index element={<DevHealthPage />} />
          <Route path="paiements" element={<DevPaymentsPage />} />
          <Route path="paiements/:id" element={<DevPaymentPage />} />
          <Route path="relectures" element={<DevEventsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dev" replace />} />
      </Routes>
    </DevAuthProvider>
  );
}
