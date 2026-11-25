// En-tête de la page d'accueil.
// Tout en haut : pleine largeur, posé sur la page. Dès qu'on défile : il se décolle, rétrécit et flotte
// (coins arrondis, flou, ombre) sur grand écran. Une fine barre bleu → orange montre où on en est dans la page.
// Sur téléphone : menu déroulant sous l'en-tête, la page derrière ne défile plus tant qu'il est ouvert.
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { useAuth } from '../auth/useAuth';
import { initials } from '../utils/format';
import FlipLabel from './hero/FlipLabel';
import { CloseIcon, HomeIcon, LogoutIcon, MenuIcon } from './icons';

const LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#fonctionnement', label: 'Fonctionnement' },
  { href: '#a-propos', label: 'À propos' },
];

// Vrai dès que la page a défilé de plus de `threshold` pixels (vérifié aussi à l'ouverture,
// au cas où le navigateur restaure une position plus bas).
function useScrolled(threshold) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);
  return scrolled;
}

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  // Si l'appareil demande moins de mouvement, la barre suit le défilement sans ressort.
  const scaleX = useReducedMotion() ? scrollYProgress : smooth;
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-linear-to-r from-brand to-accent"
      style={{ scaleX }}
    />
  );
}

function Avatar({ name, className = 'size-9' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white ring-2 ring-accent ring-offset-2 ${className}`}
    >
      {initials(name)}
    </span>
  );
}

// Pastille du compte (grand écran) : ouvre un petit menu avec le tableau de bord et la déconnexion.
function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Mon compte : ${user.full_name}`}
        className="rounded-full p-0.5"
      >
        <Avatar name={user.full_name} />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 mt-3 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl shadow-brand/10"
        >
          <div className="border-b border-line px-3 pt-2 pb-3">
            <p className="truncate font-bold text-ink">{user.full_name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <Link
            to="/espace"
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-brand transition hover:bg-page"
          >
            <HomeIcon className="size-5" />
            Mon tableau de bord
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-danger transition hover:bg-danger-soft"
          >
            <LogoutIcon className="size-5" />
            Me déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export default function LandingHeader() {
  const { user, status, signOut } = useAuth();
  const scrolled = useScrolled(10);
  const [open, setOpen] = useState(false);
  const mobileMenuId = useId();
  const floating = scrolled && !open;

  // Menu téléphone ouvert : la page derrière ne défile plus. Échap le ferme.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Si l'écran s'agrandit avec le menu ouvert (rotation, fenêtre élargie), on le referme.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 48rem)');
    const onChange = (e) => e.matches && setOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  const close = () => setOpen(false);
  const handleSignOut = () => {
    close();
    signOut();
  };

  // Tant qu'on vérifie la session, la zone de droite reste vide pour ne pas clignoter.
  const ready = status === 'ready';

  return (
    <>
      <ScrollProgressBar />
      <header
        className={`sticky z-40 mx-auto w-full border-b transition-all duration-300 ease-out motion-reduce:transition-none md:border ${
          floating
            ? 'top-0 border-line/70 bg-white/85 backdrop-blur-xl md:top-4 md:max-w-4xl md:rounded-2xl md:shadow-lg md:shadow-brand/10'
            : open
              ? 'top-0 border-line bg-white md:max-w-7xl'
              : // Tout en haut : transparent, le fond du hero passe dessous.
                'top-0 border-transparent bg-transparent md:max-w-7xl'
        }`}
      >
        <div
          className={`mx-auto flex h-14 items-center justify-between gap-6 transition-all duration-300 ease-out motion-reduce:transition-none ${
            floating ? 'px-5 md:pr-3 md:pl-5' : 'px-5 lg:px-10'
          }`}
        >
          <Link to="/" aria-label="monwifizone, accueil" className="shrink-0" onClick={close}>
            <img src={logo} alt="monwifizone" className="h-7 w-auto" />
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted md:flex lg:gap-10">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="whitespace-nowrap transition hover:text-ink">
                {l.label}
              </a>
            ))}
          </nav>

          {/* Droite, grand écran */}
          <div className="hidden min-w-9 items-center justify-end gap-4 md:flex">
            {ready &&
              (user ? (
                <>
                  <Link
                    to="/espace"
                    className="mw-flip hidden h-10 items-center rounded-full bg-brand px-5 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-brand-hover lg:inline-flex"
                  >
                    <FlipLabel>Mon tableau de bord</FlipLabel>
                  </Link>
                  <AccountMenu user={user} onSignOut={handleSignOut} />
                </>
              ) : (
                <>
                  <Link
                    to="/connexion"
                    className="hidden text-sm font-bold whitespace-nowrap text-brand transition hover:text-brand-hover lg:inline"
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/inscription"
                    className="mw-flip inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-brand-hover"
                  >
                    <FlipLabel>Devenir promoteur</FlipLabel>
                  </Link>
                </>
              ))}
          </div>

          {/* Bouton menu, téléphone */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={mobileMenuId}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="-mr-2 rounded-full p-2 text-brand md:hidden"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Menu déroulant, téléphone */}
        {open && (
          <div id={mobileMenuId} className="border-t border-line bg-white px-5 pt-2 pb-6 md:hidden">
            <nav className="flex flex-col">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="border-b border-line/60 py-3.5 text-base font-bold text-ink transition hover:text-brand"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            {ready && (
              <div className="mt-6">
                {user ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.full_name} className="size-10" />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">{user.full_name}</p>
                        <p className="truncate text-sm text-muted">{user.email}</p>
                      </div>
                    </div>
                    <Link
                      to="/espace"
                      onClick={close}
                      className="mt-5 block rounded-full bg-brand px-6 py-3 text-center font-bold text-white transition hover:bg-brand-hover"
                    >
                      Mon tableau de bord
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-danger"
                    >
                      <LogoutIcon className="size-5" />
                      Me déconnecter
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/inscription"
                      onClick={close}
                      className="block rounded-full bg-brand px-6 py-3 text-center font-bold text-white transition hover:bg-brand-hover"
                    >
                      Devenir promoteur
                    </Link>
                    <Link
                      to="/connexion"
                      onClick={close}
                      className="block rounded-full border border-line px-6 py-3 text-center font-bold text-brand transition hover:bg-page"
                    >
                      Se connecter
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
