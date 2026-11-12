import { createContext } from 'react';

// Contient { admin, status, completeLogin, signOut }. Rempli par AdminAuthProvider.
// Indépendant de AuthContext (espace promoteur).
export const AdminAuthContext = createContext(null);
