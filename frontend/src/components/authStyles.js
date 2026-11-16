// Styles des pages publiques du compte (même rendu que la page de connexion).
// Champ : icône à gauche, même style que la connexion.
export const authFieldClass = (invalid) =>
  `flex h-14 items-center gap-3 rounded-2xl border bg-white/80 px-4 shadow-[0_2px_12px_-4px_rgba(15,42,92,0.12)] backdrop-blur transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 ${
    invalid ? 'border-danger' : 'border-white'
  }`;

export const authInputClass = 'h-full w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-muted';

export const authButtonClass =
  'flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand to-[#1d4489] px-6 text-base font-bold text-white shadow-[0_14px_30px_-10px_rgba(15,42,92,0.6)] transition hover:to-brand active:scale-[0.99] disabled:cursor-wait disabled:opacity-90';
