import { useCallback, useEffect, useMemo, useState } from 'react';
import * as adminApi from './adminApi';
import { AdminAuthContext } from './AdminAuthContext';

// Session du super admin, séparée de celle des promoteurs.
export default function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState(() => (adminApi.getAdminToken() ? 'loading' : 'ready'));

  useEffect(() => {
    // Jeton expiré (1 h) ou refusé : retour à la connexion.
    adminApi.setAdminUnauthorizedHandler(() => setAdmin(null));
    return () => adminApi.setAdminUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (status !== 'loading') return;
    adminApi
      .getAdminMe()
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setStatus('ready'));
  }, [status]);

  // Appelé après la double authentification réussie.
  const completeLogin = useCallback((user) => setAdmin(user), []);

  const signOut = useCallback(() => {
    adminApi.adminLogout();
    setAdmin(null);
  }, []);

  const value = useMemo(() => ({ admin, status, completeLogin, signOut }), [admin, status, completeLogin, signOut]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
