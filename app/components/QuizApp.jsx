"use client";

import { useEffect, useState } from "react";
import { LEVELS } from "@/lib/levels";
import LevelSelect from "./LevelSelect";
import Quiz from "./Quiz";
import Shell from "./Shell";

// Nivel que se está jugando en esta pestaña. El progreso de cada nivel se
// guarda por separado (ver Quiz), así que cambiar de nivel no los mezcla.
const LEVEL_KEY = "protocolo:level";

export default function QuizApp() {
  // undefined: aún no se ha leído sessionStorage; null: sin nivel elegido
  const [level, setLevel] = useState(undefined);

  useEffect(() => {
    let saved = null;
    try {
      saved = sessionStorage.getItem(LEVEL_KEY);
    } catch {}
    setLevel(LEVELS.includes(saved) ? saved : null);
  }, []);

  function choose(next) {
    try {
      sessionStorage.setItem(LEVEL_KEY, next);
    } catch {}
    setLevel(next);
  }

  function changeLevel() {
    try {
      sessionStorage.removeItem(LEVEL_KEY);
    } catch {}
    setLevel(null);
  }

  if (level === undefined) {
    return (
      <Shell>
        <p className="py-10 text-center text-sm text-ink-dim">Cargando…</p>
      </Shell>
    );
  }
  if (level === null) return <LevelSelect onSelect={choose} />;
  return <Quiz key={level} level={level} onChangeLevel={changeLevel} />;
}
