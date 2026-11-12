// Vue d'ensemble de la plateforme. Les indicateurs (promoteurs, ventes, soldes, retraits)
// arrivent avec les routes /api/admin des étapes suivantes.
import { useAdminAuth } from './useAdminAuth';

export default function AdminHomePage() {
  const { admin } = useAdminAuth();
  const firstName = admin?.full_name?.trim().split(/\s+/)[0] || '';

  return (
    <div>
      <p className="text-sm font-bold text-muted">Vue d’ensemble</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand lg:text-4xl">Bonjour {firstName}.</h1>
      <p className="mt-4 max-w-xl text-muted">
        Ton espace d’administration est prêt. Les promoteurs, les ventes et les retraits s’afficheront ici.
      </p>
    </div>
  );
}
