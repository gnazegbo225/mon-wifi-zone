import { useCallback, useEffect, useMemo, useState } from 'react';
import * as devApi from './devApi';
import { DevAuthContext } from './DevAuthContext';

// Session du développeur, séparée de celles des promoteurs et du super admin.
export default function DevAuthProvider({ children }) {
  const [developer, setDeveloper] = useState(null);
  const [status, setStatus] = useState(() => (devApi.getDevToken() ? 'loading' : 'ready'));

  useEffect(() => {
    // Jeton expiré (1 h) ou refusé : retour à la connexion.
    devApi.setDevUnauthorizedHandler(() => setDeveloper(null));
    return () => devApi.setDevUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (status !== 'loading') return;
    devApi
      .getDevMe()
      .then(setDeveloper)
      .catch(() => setDeveloper(null))
      .finally(() => setStatus('ready'));
  }, [status]);

  const completeLogin = useCallback((user) => setDeveloper(user), []);

  const signOut = useCallback(() => {
    devApi.devLogout();
    setDeveloper(null);
  }, []);

  const value = useMemo(() => ({ developer, status, completeLogin, signOut }), [developer, status, completeLogin, signOut]);

  return <DevAuthContext.Provider value={value}>{children}</DevAuthContext.Provider>;
}
