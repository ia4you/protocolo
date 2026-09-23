// Iconos de línea de las categorías. Usan currentColor, así que toman el
// color del texto del contenedor (ej. className="text-rose-300").

const ICONS = {
  diamond: (
    <>
      <rect x="17" y="17" width="30" height="30" stroke="currentColor" strokeWidth="1.6" transform="rotate(45 32 32)" />
      <circle cx="32" cy="32" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  rings: (
    <>
      <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 6" transform="rotate(20 32 32)" opacity="0.5" />
      <circle cx="32" cy="32" r="2.2" fill="currentColor" />
    </>
  ),
  threshold: (
    <>
      <path d="M14 44 Q32 12 50 44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="14" y1="44" x2="50" y2="44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="26" y1="44" x2="26" y2="52" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="38" y1="44" x2="38" y2="52" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  route: (
    <>
      <line x1="32" y1="10" x2="32" y2="54" stroke="currentColor" strokeWidth="1.6" />
      <line x1="14" y1="22" x2="50" y2="22" stroke="currentColor" strokeWidth="1.6" />
      <line x1="14" y1="22" x2="14" y2="30" stroke="currentColor" strokeWidth="1.6" />
      <line x1="50" y1="22" x2="50" y2="44" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="10" r="2" fill="currentColor" />
      <circle cx="14" cy="30" r="2" fill="currentColor" />
      <circle cx="50" cy="44" r="2" fill="currentColor" />
    </>
  ),
  ladder: (
    <>
      <path d="M20 14 V50" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M44 14 V50" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 26 H44" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 38 H44" stroke="currentColor" strokeWidth="1.6" opacity="0.4" />
    </>
  ),
  thread: (
    <path
      d="M16 46 V26 C16 18 24 14 32 18 C40 22 40 30 32 32 C24 34 24 42 32 44 C40 46 48 42 48 34 V20"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  ),
  // Pantalla final del bloque (y categoría "apariencia")
  shield: (
    <>
      <path d="M32 12 L44 24 L44 40 L32 52 L20 40 L20 24 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M32 22 L32 42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
};

// Para nombres desconocidos: un círculo simple, así el hueco no se descuadra
const FALLBACK = <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1.6" />;

export default function ProtocolIcon({ name, className = "h-8 w-8", ...props }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" {...props}>
      {ICONS[name] ?? FALLBACK}
    </svg>
  );
}
