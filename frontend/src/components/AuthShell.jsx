// Cadre des pages publiques du compte (mot de passe oublié, nouveau mot de passe, confirmation d'adresse),
// dans le même style que la page de connexion.
import logoMark from '../assets/logo-mark.svg';
import logo from '../assets/logo.svg';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-[#eef2f8] to-page">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 size-64 rounded-full bg-brand-soft ring-[18px] ring-white/60" />
        <div className="absolute -right-20 -bottom-24 size-72 rounded-full bg-gradient-to-tl from-brand-soft to-white ring-1 ring-white" />
        <div className="absolute top-28 left-8 size-3 rounded-full bg-accent" />
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10 sm:max-w-md sm:px-8">
        <div className="mx-auto mb-7 grid size-24 place-items-center rounded-[28px] border border-white bg-white/70 shadow-[0_18px_40px_-14px_rgba(15,42,92,0.35)] backdrop-blur-md">
          <img src={logoMark} alt="" className="size-14" />
        </div>
        <h1 className="text-center text-2xl font-bold text-brand">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>

      <footer className="flex flex-col items-center gap-2 px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <img src={logo} alt="monwifizone" className="h-7 w-auto" />
      </footer>
    </div>
  );
}
