// Espace super admin (/admin/*), chargé à part et indépendant de l'espace promoteur :
// son propre fournisseur de session, sa connexion, sa mise en page.
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminAuthProvider from './AdminAuthProvider';
import AdminHomePage from './AdminHomePage';
import AdminLayout from './AdminLayout';
import AdminJournalPage from './AdminJournalPage';
import AdminLoginPage from './AdminLoginPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminTransactionsPage from './AdminTransactionsPage';
import AdminVendorPage from './AdminVendorPage';
import AdminVendorsPage from './AdminVendorsPage';
import AdminZonesPage from './AdminZonesPage';
import AdminVendorReviewPage from './AdminVendorReviewPage';
import AdminVerificationsPage from './AdminVerificationsPage';
import AdminWithdrawalPage from './AdminWithdrawalPage';
import AdminWithdrawalsPage from './AdminWithdrawalsPage';

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="connexion" element={<AdminLoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminHomePage />} />
          <Route path="promoteurs" element={<AdminVendorsPage />} />
          <Route path="promoteurs/:id" element={<AdminVendorPage />} />
          <Route path="transactions" element={<AdminTransactionsPage />} />
          <Route path="zones" element={<AdminZonesPage />} />
          <Route path="journal" element={<AdminJournalPage />} />
          <Route path="parametres" element={<AdminSettingsPage />} />
          <Route path="verifications" element={<AdminVerificationsPage />} />
          <Route path="verifications/:id" element={<AdminVendorReviewPage />} />
          <Route path="retraits" element={<AdminWithdrawalsPage />} />
          <Route path="retraits/:id" element={<AdminWithdrawalPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
