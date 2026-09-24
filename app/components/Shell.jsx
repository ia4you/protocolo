// Marco común de las pantallas: cabecera, barra de progreso, tarjeta y pie
export default function Shell({ subtitle, headerRight, progress = 0, below, children }) {
  return (
    <main className="flex min-h-dvh justify-center">
      <div className="w-full max-w-[460px] px-5 pb-12 pt-10">
        <div className="mb-[1.4rem] flex items-baseline justify-between">
          <span className="font-serif text-[1.05rem] tracking-[0.02em] text-ink-dim">
            Protocolo
            {subtitle && <span className="font-sans text-[0.8rem] tracking-normal"> · {subtitle}</span>}
          </span>
          {headerRight}
        </div>
        <div className="mb-8 h-0.5 overflow-hidden rounded-sm bg-line">
          <div
            className="h-full bg-accent-soft transition-[width] duration-[400ms] ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="rounded-md border border-line bg-paper px-[1.6rem] pb-[1.8rem] pt-8">
          {children}
          <div className="mt-[1.8rem] border-t border-line pt-[1.1rem] text-center text-[0.72rem] tracking-[0.03em] text-ink-dim">
            Desarrollado por @Turel-SM
          </div>
        </div>

        {below}
      </div>
    </main>
  );
}

export function SecondaryButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[5px] border border-line bg-bg-2 px-[1.4rem] py-3 text-ink hover:border-accent-soft"
    >
      {children}
    </button>
  );
}
