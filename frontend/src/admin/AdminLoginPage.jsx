// Connexion de l'espace super admin, en deux étapes : mot de passe, puis code de l'application d'authentification.
import { Navigate, useNavigate } from 'react-router-dom';
import TwoStepLogin from '../components/TwoStepLogin';
import { adminLogin, adminVerifyCode } from './adminApi';
import { useAdminAuth } from './useAdminAuth';

export default function AdminLoginPage() {
  const { admin, completeLogin } = useAdminAuth();
  const navigate = useNavigate();

  if (admin) return <Navigate to="/admin" replace />;

  return (
    <TwoStepLogin
      title="Administration"
      notConfigured="L’administration n’est pas encore configurée sur le serveur."
      login={adminLogin}
      verify={adminVerifyCode}
      onSignedIn={(user) => {
        completeLogin(user);
        navigate('/admin', { replace: true });
      }}
    />
  );
}
