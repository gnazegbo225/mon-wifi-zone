import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { AuthContext } from './AuthContext';

// Garde l'utilisateur connecté en mémoire et le recharge au démarrage si un token existe.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' : on vérifie le token au démarrage. 'ready' : on sait si quelqu'un est connecté.
  const [status, setStatus] = useState(() => (api.getToken() ? 'loading' : 'ready'));

  useEffect(() => {
    // Si le backend refuse le token plus tard (expiré), on déconnecte.
    api.setUnauthorizedHandler(() => setUser(null));
    return () => api.setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (status !== 'loading') return;
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'));
  }, [status]);

  const signIn = useCallback(async (email, password, remember) => {
    const loggedUser = await api.login(email, password, remember);
    setUser(loggedUser);
    return loggedUser;
  }, []);

  const signOut = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, status, signIn, signOut }), [user, status, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
