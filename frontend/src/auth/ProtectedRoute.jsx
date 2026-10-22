import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { useAuth } from './useAuth';

// Laisse passer seulement un utilisateur connecté. Sinon, renvoie vers /login
// en gardant la page demandée pour y revenir après la connexion.
export default function ProtectedRoute() {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
        <Spinner className="size-6 text-brand" />
        <p className="text-sm">Un instant, on ouvre ton espace…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
