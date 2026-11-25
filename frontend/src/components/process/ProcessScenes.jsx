// Les quatre petites scènes animées de la section « Fonctionnement » : chacune montre ce que le
// promoteur voit à cette étape, en accéléré. Elles se rejouent à chaque fois qu'on revient sur l'étape.
// `animated` à false (moins de mouvement demandé) : la scène s'affiche directement dans son état final.
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import logoMark from '../../assets/logo-mark.svg';
import { CheckIcon, CoinsIcon, DownloadIcon, MapPinIcon, RouterIcon, TagIcon } from '../icons';
import { EASE } from '../hero/layout';

// Apparition d'un élément après `delay` secondes.
const appear = (animated, delay, from = { opacity: 0, y: 10 }) => ({
  initial: animated ? from : false,
  animate: { opacity: 1, x: 0, y: 0, scale: 1 },
  transition: { delay, duration: 0.5, ease: EASE },
});

// Texte tapé lettre par lettre, à partir de `delay` ms.
function useTyped(text, delay, animated, speed = 45) {
  const [count, setCount] = useState(animated ? 0 : text.length);
  useEffect(() => {
    if (!animated) return;
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        setCount((c) => {
          if (c + 1 >= text.length) clearInterval(timer);
          return Math.min(c + 1, text.length);
        });
      }, speed);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [text, delay, animated, speed]);
  return text.slice(0, count);
}

// Les étapes d'une scène qui change d'état (ex : payer → vérifier → reçu), aux instants donnés en ms.
function useStage(times, animated) {
  const [stage, setStage] = useState(animated ? 0 : times.length);
  useEffect(() => {
    if (!animated) return;
    const timers = times.map((t, i) => setTimeout(() => setStage(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [times, animated]);
  return stage;
}

const formatF = (n) => `${Math.round(n).toLocaleString('fr-FR')} F`;

// Nombre qui défile jusqu'à sa valeur.
function Counter({ from, to, delay, duration = 1.2, format = (n) => String(Math.round(n)), animated }) {
  const value = useMotionValue(animated ? from : to);
  const text = useTransform(value, format);
  useEffect(() => {
    if (!animated) return;
    const controls = animate(value, to, { delay, duration, ease: EASE });
    return () => controls.stop();
  }, [animated, delay, duration, to, value]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

function Card({ className = '', children, ...props }) {
  return (
    <motion.div className={`rounded-2xl border border-line bg-white shadow-xl shadow-brand/5 ${className}`} {...props}>
      {children}
    </motion.div>
  );
}

// Petite pastille de réussite (vert de la charte, toujours avec une coche).
function SuccessToast({ children, className = '', ...props }) {
  return (
    <motion.div
      className={`flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-sm font-bold whitespace-nowrap text-success shadow-lg shadow-brand/5 ${className}`}
      {...props}
    >
      <CheckIcon className="size-4" />
      {children}
    </motion.div>
  );
}

function Field({ label, value, full }) {
  const typing = value.length > 0 && value.length < full.length;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-1 flex h-10 items-center rounded-xl border border-line bg-page px-3 text-sm text-ink">
        {value}
        {typing && <span aria-hidden="true" className="proc-caret ml-px h-4 w-px bg-brand" />}
      </div>
    </div>
  );
}

// Un téléphone simple : cadre bleu nuit, écran clair.
function Phone({ children, className = '' }) {
  return (
    <div className={`relative h-[19rem] w-48 rounded-[2rem] border-[5px] border-brand bg-brand shadow-2xl shadow-brand/20 ${className}`}>
      <div className="absolute top-1.5 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/25" />
      <div className="flex h-full flex-col overflow-hidden rounded-[1.6rem] bg-page px-3 pt-6 pb-3">{children}</div>
    </div>
  );
}

// 1. Ajoute ta zone : le formulaire se remplit, la zone est enregistrée, son repère tombe sur la carte.
function ZoneScene({ animated }) {
  const NAME = 'Maquis du Plateau';
  const CITY = 'Abidjan';
  const ROUTER = '192.168.88.1';
  const name = useTyped(NAME, 300, animated);
  const city = useTyped(CITY, 1300, animated);
  const router = useTyped(ROUTER, 1800, animated);

  return (
    <div className="relative w-full max-w-[19rem]">
      <Card className="space-y-3 p-5" {...appear(animated, 0)}>
        <p className="font-bold text-brand">Nouvelle zone</p>
        <Field label="Nom" value={name} full={NAME} />
        <Field label="Ville" value={city} full={CITY} />
        <Field label="Adresse du routeur" value={router} full={ROUTER} />
        <motion.div
          className="mt-1 flex h-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
          initial={false}
          animate={animated ? { scale: [1, 1, 0.95, 1] } : {}}
          transition={{ delay: 2.5, duration: 0.45, times: [0, 0.2, 0.5, 1] }}
        >
          Enregistrer
        </motion.div>
      </Card>

      <SuccessToast className="absolute -bottom-5 left-1/2 -translate-x-1/2" {...appear(animated, 2.9, { opacity: 0, y: 12 })}>
        Zone ajoutée
      </SuccessToast>

      {/* Le repère de la zone qui tombe, avec une onde au point d'impact. */}
      <motion.div
        className="absolute -top-6 -right-4 grid size-14 place-items-center rounded-2xl bg-brand text-accent shadow-xl shadow-brand/20 sm:-right-10"
        {...appear(animated, 3.0, { opacity: 0, y: -40, scale: 0.8 })}
      >
        <MapPinIcon className="size-7" />
        {animated && <span aria-hidden="true" className="proc-ripple absolute inset-0 rounded-2xl border-2 border-accent" />}
      </motion.div>
    </div>
  );
}

const PLANS = [
  ['24 heures', '200 F'],
  ['3 jours', '500 F'],
  ['1 semaine', '1 500 F'],
];

// 2. Crée tes forfaits : les forfaits arrivent un par un, puis le fichier de tickets s'importe.
function PlansScene({ animated }) {
  return (
    <div className="relative w-full max-w-[19rem]">
      <Card className="p-5" {...appear(animated, 0)}>
        <p className="font-bold text-brand">Tes forfaits</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {PLANS.map(([d, p], i) => (
            <motion.li key={d} className="flex items-center gap-3 py-3 text-sm" {...appear(animated, 0.3 + i * 0.3, { opacity: 0, x: -16 })}>
              <TagIcon className="size-5 text-accent" />
              <span className="flex-1 text-ink">{d}</span>
              <span className="font-bold text-ink">{p}</span>
            </motion.li>
          ))}
        </ul>
      </Card>

      <Card className="relative z-10 mx-4 -mt-3 p-4 sm:mx-6" {...appear(animated, 1.4, { opacity: 0, y: 16 })}>
        <div className="flex items-center gap-3 text-sm">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
            <DownloadIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">tickets.csv</p>
            <p className="text-muted">
              <Counter from={0} to={150} delay={1.7} duration={1.4} animated={animated} /> tickets importés
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/70">
          <motion.div
            className="h-full origin-left rounded-full bg-accent"
            initial={animated ? { scaleX: 0 } : false}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.7, duration: 1.4, ease: EASE }}
          />
        </div>
      </Card>

      <SuccessToast className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2" {...appear(animated, 3.2, { opacity: 0, y: 12 })}>
        Stock prêt à vendre
      </SuccessToast>
    </div>
  );
}

// 3. Installe ton portail : le routeur émet, le téléphone du client affiche ta page de connexion.
function PortalScene({ animated }) {
  return (
    <div className="relative flex w-full max-w-[22rem] items-center justify-center">
      {/* Le routeur et ses ondes. */}
      <motion.div className="absolute top-6 -left-1 z-10 sm:left-0" {...appear(animated, 0, { opacity: 0, x: -16 })}>
        <div className="relative grid size-16 place-items-center rounded-2xl bg-brand text-white shadow-xl shadow-brand/20">
          <RouterIcon className="size-8" />
          {animated && (
            <>
              <span aria-hidden="true" className="proc-wave absolute inset-0 rounded-2xl border-2 border-accent" />
              <span aria-hidden="true" className="proc-wave proc-wave-2 absolute inset-0 rounded-2xl border-2 border-accent" />
            </>
          )}
        </div>
        <p className="mt-2 text-center text-sm font-bold text-brand">Ton routeur</p>
      </motion.div>

      <Phone className="ml-14 sm:ml-16">
        <motion.div className="flex flex-col items-center" {...appear(animated, 0.6)}>
          <img src={logoMark} alt="" className="h-8 w-auto" />
          <p className="mt-2 text-center text-sm font-bold text-brand">Maquis du Plateau</p>
          <p className="text-sm text-muted">Choisis ton forfait</p>
        </motion.div>
        <div className="mt-3 space-y-2">
          {PLANS.map(([d, p], i) => (
            <motion.div
              key={d}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                i === 1 ? 'border-brand bg-white font-bold text-brand' : 'border-line bg-white text-ink'
              }`}
              {...appear(animated, 1.0 + i * 0.2)}
            >
              <span>{d}</span>
              <span className="font-bold">{p}</span>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-auto flex h-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-brand"
          {...appear(animated, 1.8)}
        >
          Acheter
        </motion.div>
      </Phone>

      <SuccessToast className="absolute -bottom-5 left-0 z-20 sm:-left-2" {...appear(animated, 2.6, { opacity: 0, y: 12 })}>
        Portail installé
      </SuccessToast>
    </div>
  );
}

// Instants (ms) où la scène du paiement passe à « vérification » puis à « payé ».
const CASH_TIMES = [1300, 2500];

// 4. Encaisse : le client paie, on vérifie, le code arrive ; ton solde monte (commission déduite).
function CashScene({ animated }) {
  // 0 : choisir · 1 : vérification · 2 : payé
  const stage = useStage(CASH_TIMES, animated);

  return (
    <div className="relative flex w-full max-w-[24rem] items-center justify-center">
      <Phone className="mr-24 sm:mr-20">
        <p className="text-center text-sm font-bold text-brand">Paiement</p>
        <div className="mt-3 flex-1">
          {stage === 0 && (
            <motion.div className="space-y-2" {...appear(animated, 0.2)}>
              <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <p className="text-muted">Forfait</p>
                <p className="font-bold text-ink">3 jours · 500 F</p>
              </div>
              {['Wave', 'Orange Money', 'MTN MoMo'].map((m, i) => (
                <div
                  key={m}
                  className={`rounded-xl border px-3 py-2 text-sm ${i === 0 ? 'border-brand bg-white font-bold text-brand' : 'border-line bg-white text-ink'}`}
                >
                  {m}
                </div>
              ))}
            </motion.div>
          )}
          {stage === 1 && (
            <motion.div className="flex h-full flex-col items-center justify-center gap-3 text-center" {...appear(animated, 0)}>
              <span aria-hidden="true" className="size-8 animate-spin motion-reduce:animate-none rounded-full border-[3px] border-line border-t-brand" />
              <p className="text-sm text-muted">Un instant, on vérifie ton paiement…</p>
            </motion.div>
          )}
          {stage === 2 && (
            <motion.div className="flex h-full flex-col items-center justify-center text-center" {...appear(animated, 0, { opacity: 0, scale: 0.9 })}>
              <span className="grid size-10 place-items-center rounded-full bg-success text-white">
                <CheckIcon className="size-5" />
              </span>
              <p className="mt-2 text-sm font-bold text-success">Paiement reçu</p>
              <div className="mt-3 w-full rounded-xl border border-dashed border-brand/40 bg-white px-2 py-2">
                <p className="text-sm text-muted">Ton code</p>
                <p className="text-lg font-bold tracking-wider text-brand">4821-7730</p>
              </div>
            </motion.div>
          )}
        </div>
        {stage === 0 && (
          <motion.div
            className="flex h-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-brand"
            initial={false}
            animate={animated ? { scale: [1, 1, 0.94, 1] } : {}}
            transition={{ delay: 0.6, duration: 0.5, times: [0, 0.3, 0.6, 1] }}
          >
            Payer 500 F
          </motion.div>
        )}
      </Phone>

      {/* Ton solde : 500 F payés, 8 % de commission, 460 F pour toi. */}
      <Card className="absolute top-6 -right-2 z-10 w-36 p-4 sm:-right-12 sm:w-40" {...appear(animated, 0.3, { opacity: 0, x: 16 })}>
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
          <CoinsIcon className="size-5" />
        </span>
        <p className="mt-2 text-sm text-muted">Ton solde</p>
        <p className="text-xl font-bold text-ink">
          <Counter from={12500} to={12960} delay={2.7} duration={1} format={formatF} animated={animated} />
        </p>
        <motion.p className="mt-1 text-sm font-bold text-success" {...appear(animated, 2.8)}>
          +460 F
        </motion.p>
      </Card>
    </div>
  );
}

export { CashScene, PlansScene, PortalScene, ZoneScene };
