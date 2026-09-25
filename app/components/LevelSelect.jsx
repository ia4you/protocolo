"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProtocolIcon from "./ProtocolIcon";
import Shell, { SecondaryButton } from "./Shell";

export default function LevelSelect({ onSelect }) {
  const [levels, setLevels] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/levels");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLevels((await res.json()).levels);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  let list;
  if (loadError) {
    list = (
      <div className="text-center">
        <p className="mb-6 text-ink-dim">No se pudieron cargar los niveles.</p>
        <SecondaryButton onClick={load}>Reintentar</SecondaryButton>
      </div>
    );
  } else if (!levels) {
    list = <p className="py-6 text-center text-sm text-ink-dim">Cargando…</p>;
  } else {
    list = (
      <div className="flex flex-col gap-[0.65rem]">
        {levels.map(({ level, label, count }) => {
          const available = count > 0;
          return (
            <button
              key={level}
              type="button"
              disabled={!available}
              onClick={() => onSelect(level)}
              className={`flex items-center justify-between rounded-[5px] border border-line bg-bg-2 px-4 py-[0.95rem] text-left text-ink transition-[border-color,transform] duration-150 ease-in-out ${
                available
                  ? "cursor-pointer hover:border-accent-soft active:scale-[0.995]"
                  : "cursor-default opacity-60"
              }`}
            >
              <span className="font-serif text-[1.15rem] font-medium">{label}</span>
              {available ? (
                <span className="text-[0.8rem] tabular-nums text-ink-dim">
                  {count} {count === 1 ? "pregunta" : "preguntas"}
                </span>
              ) : (
                <span className="rounded-full border border-line px-2.5 py-[0.2rem] text-[0.7rem] tracking-[0.03em] text-ink-dim">
                  Próximamente
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <ProtocolIcon name="ladder" className="mx-auto mb-6 h-[88px] w-[88px] text-ink" />
        <h1 className="mb-2 font-serif text-[1.6rem] font-medium">Elige tu nivel</h1>
        <p className="mb-[1.7rem] text-[0.9rem] text-ink-dim">
          Cada nivel tiene sus propias preguntas.
        </p>
      </div>
      {list}

      <div className="mt-[1.6rem] border-t border-line pt-[1.4rem]">
        <Link
          href="/coach"
          className="flex items-center justify-between gap-3 rounded-[5px] border border-accent/60 bg-accent/[0.08] px-4 py-[0.95rem] text-ink transition-[border-color,transform] duration-150 ease-in-out hover:border-accent-soft active:scale-[0.995]"
        >
          <span>
            <span className="block font-serif text-[1.15rem] font-medium">Modo coach</span>
            <span className="block text-[0.8rem] text-ink-dim">
              Un experto te examina en una conversación de 20 preguntas
            </span>
          </span>
          <span aria-hidden="true" className="text-accent-soft">→</span>
        </Link>
      </div>
    </Shell>
  );
}
