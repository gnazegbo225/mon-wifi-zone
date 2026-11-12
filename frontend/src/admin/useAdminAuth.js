import { useContext } from 'react';
import { AdminAuthContext } from './AdminAuthContext';

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth doit être utilisé dans <AdminAuthProvider>');
  return context;
}
