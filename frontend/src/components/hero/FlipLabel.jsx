// Libellé de bouton dessiné comme deux faces d'un petit cube : mettre `mw-flip` sur le bouton,
// et le survol fait tourner le cube (le bouton lui-même ne bouge pas). La face jumelle est cachée
// aux lecteurs d'écran. Styles dans hero.css.
export default function FlipLabel({ children, className = '' }) {
  return (
    <span className="mw-flip-box">
      <span className={`mw-flip-face ${className}`}>{children}</span>
      <span aria-hidden="true" className={`mw-flip-face mw-flip-back ${className}`}>
        {children}
      </span>
    </span>
  );
}
