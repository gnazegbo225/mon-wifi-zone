// Paramètres (/admin/parametres) : le compte du super admin.
// L'adresse de connexion se change avec le mot de passe actuel et un code de l'application d'authentification.
import EmailChangeForm from '../components/EmailChangeForm';
import { PageHeader } from './AdminUI';
import { updateAdminEmail } from './adminApi';
import { useAdminAuth } from './useAdminAuth';

export default function AdminSettingsPage() {
  const { admin, completeLogin } = useAdminAuth();

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader eyebrow="Paramètres" title="Ton compte" />

      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-bold text-brand">Connexion</h2>
        <p className="mt-1 text-sm text-muted">
          Pour changer d’adresse, il faut ton mot de passe actuel et un code de ton application d’authentification.
        </p>
        <div className="mt-6">
          <EmailChangeForm
            withCode
            currentEmail={admin?.email}
            onSubmit={async (values) => {
              const updated = await updateAdminEmail(values);
              completeLogin(updated);
            }}
          />
        </div>
      </section>
    </div>
  );
}
