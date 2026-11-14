import { createContext, useContext } from 'react';

// Contient { developer, status, completeLogin, signOut }. Rempli par DevAuthProvider.
// Indépendant des sessions promoteur et super admin.
export const DevAuthContext = createContext(null);

export function useDevAuth() {
  const context = useContext(DevAuthContext);
  if (!context) throw new Error('useDevAuth doit être utilisé dans <DevAuthProvider>');
  return context;
}
