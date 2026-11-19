// Écran d'acceptation des conditions générales : affiché au promoteur à la place de son espace
// tant qu'il n'a pas accepté la version en vigueur (promoteurs inscrits avant, ou nouvelle version).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { RULES, TERMS_DATE_LABEL } from '../legal/company';
import { acceptTerms } from '../services/api';
import AuthShell from './AuthShell';
import { authButtonClass } from './authStyles';
import Spinner from './Spinner';
import { AlertIcon } from './icons';

export default function TermsGate() {
  const { user, setCurrentUser, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function accept() {
    if (!checked) return setError('Coche la case pour accepter les conditions.');
    setError(null);
    setSaving(true);
    try {
      setCurrentUser(await acceptTerms(user.terms_version));
    } catch (err) {
      setError(err.status === 0 ? 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.' : err.message);
      setSaving(false);
    }
  }

  return (
    <AuthShell title="Nos conditions générales" subtitle={`Version du ${TERMS_DATE_LABEL}. Accepte-les pour continuer à utiliser ton espace.`}>
      <div className="space-y-5">
        <ul className="space-y-2 rounded-3xl border border-line bg-white p-5 text-sm text-ink">
          <li>· Commission de {RULES.commission} sur chaque vente, frais de paiement inclus.</li>
          <li>· Ventes disponibles {RULES.holdHours} h après le paiement ; retrait dès {RULES.minWithdrawal}, sans frais, sous {RULES.payoutDelay}.</li>
          <li>· Tu es responsable de ton réseau WiFi, de ton stock de tickets et de tes employés.</li>
          <li>· Tes pièces d’identité sont supprimées {RULES.kycRetention} après la fermeture de ton compte.</li>
        </ul>
        <Link to="/conditions-promoteurs" target="_blank" className="block text-center font-bold text-brand underline underline-offset-2">
          Lire les conditions complètes
        </Link>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertIcon className="mt-px size-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked);
              setError(null);
            }}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-brand"
          />
          J’ai lu et j’accepte les conditions générales des promoteurs.
        </label>

        <button type="button" onClick={accept} disabled={saving} className={authButtonClass}>
          {saving && <Spinner className="size-5" />}
          Accepter et continuer
        </button>
        <button type="button" onClick={signOut} className="w-full text-center text-sm font-bold text-muted transition hover:text-brand">
          Me déconnecter
        </button>
      </div>
    </AuthShell>
  );
}
