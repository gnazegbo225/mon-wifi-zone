import { createContext } from 'react';

// Contient { user, status, signIn, signUp, refreshUser, signOut }. Rempli par AuthProvider.
export const AuthContext = createContext(null);
