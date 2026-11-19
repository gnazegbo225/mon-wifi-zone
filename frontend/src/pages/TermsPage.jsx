// Conditions générales des promoteurs (/conditions-promoteurs). Page publique, lisible sans compte.
// Texte de base à faire relire par un juriste ivoirien. Toute modification du texte = nouvelle version
// (voir src/legal/company.js) : les promoteurs devront l'accepter de nouveau.
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { COMPANY, RULES, TERMS_DATE_LABEL } from '../legal/company';

const SECTIONS = [
  {
    id: 'objet',
    title: 'Objet',
    body: [
      `Les présentes conditions générales encadrent l’utilisation de la plateforme ${COMPANY.website} (la « Plateforme ») par les personnes qui y vendent des tickets d’accès à Internet par WiFi (les « Promoteurs »).`,
      `La Plateforme est éditée par ${COMPANY.name}, ${COMPANY.legalForm}, immatriculée au RCCM sous le numéro ${COMPANY.rccm}, dont le siège est situé ${COMPANY.address} (l’« Éditeur »).`,
      'En créant un compte, le Promoteur déclare avoir lu et accepté ces conditions. Il les accepte de nouveau à chaque nouvelle version.',
    ],
  },
  {
    id: 'definitions',
    title: 'Définitions',
    list: [
      'Zone : un lieu où le Promoteur exploite un réseau WiFi (routeur MikroTik) et vend des tickets.',
      'Ticket : un identifiant et un mot de passe qui donnent accès au réseau WiFi d’une Zone pour une durée ou un volume fixé.',
      'Forfait : l’offre (prix, durée) que le Promoteur propose dans une Zone.',
      'Client : la personne qui achète un Ticket sur la Plateforme.',
      'Solde : les sommes dues au Promoteur au titre de ses ventes, après commission.',
    ],
  },
  {
    id: 'inscription',
    title: 'Inscription et vérification',
    body: [
      'Le Promoteur doit être majeur, avoir la capacité de contracter et exercer en Côte d’Ivoire. Il fournit des informations exactes et à jour, et les corrige dès qu’elles changent.',
      'Pour retirer son argent, le Promoteur fait vérifier son compte : il transmet le recto et le verso de sa carte nationale d’identité, un selfie et le compte qui recevra ses retraits, ouvert à son nom. Il confirme aussi son adresse email.',
      'Tant que son compte n’est pas vérifié, le Promoteur peut configurer ses Zones et vendre, mais ne peut pas retirer. L’Éditeur peut refuser un dossier en indiquant le motif ; le Promoteur peut alors le corriger.',
      'Le Promoteur garde ses identifiants secrets. Toute action faite avec son compte, ou avec le compte d’un de ses employés, est réputée faite par lui.',
    ],
  },
  {
    id: 'role',
    title: 'Rôle de la Plateforme et du Promoteur',
    body: [
      'La Plateforme fournit au Promoteur des outils : pages d’achat, encaissement des paiements par un prestataire agréé, délivrance automatique des Tickets, suivi des ventes et retraits.',
      'Le Promoteur est seul responsable de son réseau WiFi : installation, fonctionnement, qualité et continuité du service, respect de la réglementation des télécommunications et des autorisations qui s’y appliquent, et assistance à ses Clients. Il fixe librement le prix de ses Forfaits.',
      'Le Promoteur importe dans la Plateforme des Tickets valides, qui correspondent aux Forfaits annoncés. Il veille à garder du stock : si un Client paie alors qu’aucun Ticket n’est disponible, le Promoteur lui fournit un Ticket ou le rembourse.',
    ],
  },
  {
    id: 'paiements',
    title: 'Paiements des Clients et commission',
    body: [
      'Les Clients paient par Mobile Money ou par carte, par l’intermédiaire d’un prestataire de paiement. L’Éditeur encaisse ces sommes pour le compte du Promoteur.',
      `Pour chaque vente réussie, l’Éditeur retient une commission de ${RULES.commission} du prix payé par le Client, frais du prestataire de paiement inclus. Le taux en vigueur est affiché dans l’espace promoteur. Toute modification du taux est annoncée au moins 30 jours à l’avance ; elle ne s’applique qu’aux ventes suivantes.`,
      'Une vente compte au moment où le prestataire de paiement la confirme. Une vente non confirmée, échouée ou annulée ne crée aucun Solde.',
    ],
  },
  {
    id: 'retraits',
    title: 'Solde et retraits',
    body: [
      `Le montant d’une vente, commission déduite, est d’abord « en attente » pendant ${RULES.holdHours} heures, puis devient « disponible ». Ce délai permet de traiter les erreurs et les contestations.`,
      `Le Promoteur dont le compte est vérifié peut demander le retrait de son solde disponible, à partir de ${RULES.minWithdrawal}, sans frais : il reçoit exactement le montant demandé. Le retrait est versé uniquement sur le compte vérifié du Promoteur (virement bancaire, Wave, MTN MoMo ou Orange Money).`,
      `L’Éditeur traite chaque demande et verse le montant dans un délai de ${RULES.payoutDelay} après son approbation, sauf vérification nécessaire (incohérence, soupçon de fraude, compte de retrait qui n’est pas au nom du Promoteur). Un refus est motivé ; le montant revient alors dans le solde disponible.`,
      'L’Éditeur peut corriger le Solde en cas d’erreur, de vente contestée, de remboursement d’un Client ou de somme due par le Promoteur. Chaque correction est motivée et visible dans l’espace promoteur.',
    ],
  },
  {
    id: 'employes',
    title: 'Employés',
    body: [
      'Le Promoteur peut créer des comptes pour ses employés et leur confier des Zones. Il reste responsable de leurs actions sur la Plateforme et désactive leur compte dès qu’ils ne travaillent plus pour lui.',
    ],
  },
  {
    id: 'obligations',
    title: 'Engagements du Promoteur',
    list: [
      'utiliser la Plateforme de bonne foi, pour son activité réelle de vente d’accès WiFi ;',
      'ne pas créer de ventes fictives, ne pas utiliser la Plateforme pour transférer de l’argent d’origine douteuse et ne pas contourner les vérifications ;',
      'ne pas tenter d’accéder aux comptes ou aux données d’autres utilisateurs, ni de perturber la Plateforme ;',
      'informer ses Clients de façon claire (prix, durée, conditions d’accès) et répondre à leurs réclamations ;',
      'respecter les lois en vigueur en Côte d’Ivoire, notamment sur les télécommunications, le commerce et la protection des données personnelles.',
    ],
  },
  {
    id: 'suspension',
    title: 'Suspension et fermeture du compte',
    body: [
      'L’Éditeur peut suspendre un compte, avec effet immédiat et en indiquant le motif, en cas de manquement à ces conditions, de soupçon de fraude ou de demande d’une autorité. Les comptes des employés sont suspendus en même temps.',
      `Le Promoteur peut demander la fermeture de son compte à tout moment en écrivant à ${COMPANY.email}. L’Éditeur peut aussi fermer un compte après un manquement grave ou répété.`,
      'Avant la fermeture, le Solde est réglé : le Promoteur retire ce qui lui reste dû, ou l’Éditeur le lui verse, déduction faite des sommes dues. À la fermeture, les Zones cessent de vendre et les accès du Promoteur et de ses employés sont coupés. Un compte fermé ne peut pas être rouvert.',
    ],
  },
  {
    id: 'donnees',
    title: 'Données personnelles',
    body: [
      'L’Éditeur traite les données personnelles nécessaires au service, conformément à la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.',
    ],
    list: [
      'Données du Promoteur : nom, email, téléphone, ville, informations de la pièce d’identité, photos de la CNI et selfie, compte de retrait, connexions et actions sur la Plateforme.',
      'Données des Clients : numéro de téléphone utilisé pour le paiement, montant, date et Ticket délivré. Le Promoteur ne voit pas le numéro complet de ses Clients.',
      'Finalités : créer et sécuriser le compte, vérifier l’identité du Promoteur avant tout retrait, prévenir la fraude, encaisser les ventes, verser les retraits, tenir la comptabilité et répondre aux obligations légales.',
      'Accès : seules les personnes habilitées de l’Éditeur consultent les pièces d’identité, par des liens temporaires. Les données sont hébergées chez des prestataires techniques (hébergement, base de données, envoi d’emails, paiement), qui peuvent être situés hors de Côte d’Ivoire et sont tenus à la confidentialité.',
      `Conservation : les photos de la pièce d’identité et le selfie, ainsi que le numéro de la pièce, sont supprimés ${RULES.kycRetention} après la fermeture du compte. Les données des ventes, des retraits et des corrections de solde sont conservées ${RULES.accountingRetention}, comme l’exige la loi comptable.`,
      `Droits : le Promoteur peut accéder à ses données, les faire rectifier et, dans les limites de la loi, s’opposer à leur traitement ou en demander la suppression, en écrivant à ${COMPANY.email}. Il peut aussi saisir l’Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire (ARTCI).`,
    ],
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    body: [
      'L’Éditeur fait le nécessaire pour que la Plateforme fonctionne en continu, sans pouvoir le garantir : maintenance, panne d’un prestataire (paiement, hébergement, opérateur) ou d’Internet peuvent l’interrompre.',
      'L’Éditeur ne répond pas du fonctionnement du réseau WiFi du Promoteur, ni des litiges entre le Promoteur et ses Clients ou ses employés. Sa responsabilité envers le Promoteur, quelle qu’en soit la cause, est limitée au montant des commissions perçues sur ses ventes des trois (3) derniers mois.',
    ],
  },
  {
    id: 'modification',
    title: 'Modification des conditions',
    body: [
      'L’Éditeur peut modifier ces conditions. La nouvelle version est datée et présentée au Promoteur à sa connexion suivante ; il doit l’accepter pour continuer à utiliser son espace. S’il la refuse, il peut demander la fermeture de son compte.',
    ],
  },
  {
    id: 'droit',
    title: 'Droit applicable et litiges',
    body: [
      'Ces conditions sont soumises au droit ivoirien. En cas de désaccord, le Promoteur et l’Éditeur cherchent d’abord une solution amiable. À défaut, le litige est porté devant les juridictions compétentes d’Abidjan.',
      `Contact : ${COMPANY.email}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/">
            <img src={logo} alt="monwifizone" className="h-7 w-auto" />
          </Link>
          <Link to="/connexion" className="text-sm font-bold text-brand">
            Espace promoteur
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <p className="text-sm font-bold text-muted">Version du {TERMS_DATE_LABEL}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand sm:text-4xl">Conditions générales des promoteurs</h1>

        <nav aria-label="Sommaire" className="mt-8 rounded-3xl border border-line bg-white p-6">
          <h2 className="font-bold text-brand">Sommaire</h2>
          <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink underline-offset-2 hover:text-brand hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="text-xl font-bold text-brand">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink">
                {(s.body || []).map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
                {s.list && (
                  <ul className="list-disc space-y-2 pl-5 marker:text-muted">
                    {s.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-3xl px-5 py-8 text-sm text-muted">
          © {new Date().getFullYear()} monwifizone · {COMPANY.name}
        </p>
      </footer>
    </div>
  );
}
