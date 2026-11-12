// Espace super admin (/admin/*), chargé à part et indépendant de l'espace promoteur :
// son propre fournisseur de session, sa connexion, sa mise en page.
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminAuthProvider from './AdminAuthProvider';
import AdminHomePage from './AdminHomePage';
import AdminLayout from './AdminLayout';
import AdminLoginPage from './AdminLoginPage';
import AdminVendorReviewPage from './AdminVendorReviewPage';
import AdminVerificationsPage from './AdminVerificationsPage';

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="connexion" element={<AdminLoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminHomePage />} />
          <Route path="verifications" element={<AdminVerificationsPage />} />
          <Route path="verifications/:id" element={<AdminVendorReviewPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
