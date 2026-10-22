import { createContext } from 'react';

// Contient { user, status, signIn, signOut }. Rempli par AuthProvider.
export const AuthContext = createContext(null);
