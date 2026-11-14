// Connexion de l'espace développeur, en deux étapes : mot de passe, puis code de l'application d'authentification.
import { Navigate, useNavigate } from 'react-router-dom';
import TwoStepLogin from '../components/TwoStepLogin';
import { useDevAuth } from './DevAuthContext';
import { devLogin, devVerifyCode } from './devApi';

export default function DevLoginPage() {
  const { developer, completeLogin } = useDevAuth();
  const navigate = useNavigate();

  if (developer) return <Navigate to="/dev" replace />;

  return (
    <TwoStepLogin
      dark
      title="Espace développeur"
      notConfigured="L’espace développeur n’est pas encore configuré sur le serveur."
      login={devLogin}
      verify={devVerifyCode}
      onSignedIn={(user) => {
        completeLogin(user);
        navigate('/dev', { replace: true });
      }}
    />
  );
}
