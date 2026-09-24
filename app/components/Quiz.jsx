"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LEVEL_LABELS } from "@/lib/levels";
import ProtocolIcon from "./ProtocolIcon";
import ExplanationSheet from "./ExplanationSheet";
import Shell, { SecondaryButton } from "./Shell";

const ADVANCE_DELAY_MS = 700;

// Progreso separado por nivel, para que cambiar de nivel no lo mezcle
const storageKey = (level) => `protocolo:quiz:${level}`;
// Clave de antes de existir niveles (todas eran amateur)
const LEGACY_KEY = "protocolo:quiz";

// Categorías anidadas → lista plana de preguntas
function flatten(categories) {
  return categories.flatMap((c) =>
    c.questions.map((q) => ({ ...q, category: c.name, icon: c.icon }))
  );
}

// Fisher–Yates
function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// El orden se baraja una vez por sesión (pestaña): solo cuando no hay ninguno
// guardado. Recargar o "Empezar de nuevo" reutilizan el mismo orden.
function freshState(questions) {
  return { order: shuffle(questions.map((q) => q.id)), index: 0, answers: {} };
}

// Progreso guardado en esta pestaña, solo si sigue encajando con las preguntas
function restoreState(level, questions) {
  try {
    const raw =
      sessionStorage.getItem(storageKey(level)) ??
      (level === "amateur" ? sessionStorage.getItem(LEGACY_KEY) : null);
    const saved = JSON.parse(raw);
    const ids = new Set(questions.map((q) => q.id));
    const valid =
      saved?.order?.length === ids.size &&
      saved.order.every((id) => ids.has(id)) &&
      Number.isInteger(saved.index) &&
      saved.index >= 0 &&
      saved.index <= saved.order.length &&
      saved.answers &&
      typeof saved.answers === "object";
    if (valid) return saved;
  } catch {}
  return null;
}

export default function Quiz({ level, onChangeLevel }) {
  const [questions, setQuestions] = useState(null);
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [pendingOption, setPendingOption] = useState(null);
  const [answerError, setAnswerError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/questions?level=${encodeURIComponent(level)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = flatten((await res.json()).categories);
      setQuestions(list);
      setState(restoreState(level, list) ?? freshState(list));
    } catch {
      setLoadError(true);
    }
  }, [level]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!state || state.order.length === 0) return;
    try {
      sessionStorage.setItem(storageKey(level), JSON.stringify(state));
    } catch {}
  }, [level, state]);

  const byId = useMemo(
    () => Object.fromEntries((questions ?? []).map((q) => [q.id, q])),
    [questions]
  );

  const total = state?.order.length ?? 0;
  const index = state?.index ?? 0;
  const finished = state !== null && index >= total;
  const current = state && !finished ? byId[state.order[index]] : null;
  const answer = current ? state.answers[current.id] : null;

  // Solo avanza si seguimos en la pregunta indicada (evita dobles saltos)
  const advanceFrom = useCallback((from) => {
    setState((s) => (s.index === from ? { ...s, index: s.index + 1 } : s));
  }, []);
  const closeSheet = useCallback(() => advanceFrom(index), [advanceFrom, index]);

  // Acierto: pasa sola a la siguiente tras un momento
  useEffect(() => {
    if (!answer?.correct) return;
    const t = setTimeout(() => advanceFrom(index), ADVANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [answer, index, advanceFrom]);

  async function choose(optionId) {
    if (answer || pendingOption) return;
    const questionId = current.id;
    setPendingOption(optionId);
    setAnswerError(false);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: optionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState((s) => ({
        ...s,
        answers: {
          ...s.answers,
          [questionId]: {
            optionId,
            correct: data.correct,
            correctOptionId: data.correct_option_id,
            explanation: data.explanation,
          },
        },
      }));
    } catch {
      setAnswerError(true);
    } finally {
      setPendingOption(null);
    }
  }

  function restart() {
    setAnswerError(false);
    setState((s) => ({ order: s.order, index: 0, answers: {} }));
  }

  // Cada pregunta solo admite una respuesta, así que esto cuenta aciertos al
  // primer intento. Sale de answers, que ya se guarda en sessionStorage.
  const score = state
    ? Object.values(state.answers).filter((a) => a.correct).length
    : 0;
  const scorePct = total ? Math.round((score / total) * 100) : 0;
  const empty = state !== null && total === 0;
  const progressPct = empty ? 0 : finished ? 100 : total ? (index / total) * 100 : 0;

  let body;
  if (loadError) {
    body = (
      <div className="py-6 text-center">
        <p className="mb-6 text-ink-dim">No se pudieron cargar las preguntas.</p>
        <SecondaryButton onClick={load}>Reintentar</SecondaryButton>
      </div>
    );
  } else if (!state) {
    body = <p className="py-10 text-center text-sm text-ink-dim">Cargando…</p>;
  } else if (empty) {
    body = (
      <div className="pt-4 text-center">
        <ProtocolIcon name="ladder" className="mx-auto mb-6 h-[88px] w-[88px] text-ink" />
        <h2 className="mb-2 font-serif text-[1.6rem] font-medium">Próximamente</h2>
        <p className="mb-[1.6rem] text-ink-dim">
          Todavía no hay preguntas de nivel {LEVEL_LABELS[level]}.
        </p>
        <SecondaryButton onClick={onChangeLevel}>Elegir otro nivel</SecondaryButton>
      </div>
    );
  } else if (finished) {
    body = (
      <div className="pt-4 text-center">
        <ProtocolIcon name="shield" className="mx-auto mb-6 h-[88px] w-[88px] text-ink" />
        <h2 className="mb-2 font-serif text-[1.6rem] font-medium">Bloque completado</h2>
        <p className="mb-2 font-serif text-[1.25rem] leading-snug text-accent-soft">
          Has acertado el {scorePct}% del protocolo
        </p>
        <p className="mb-[1.6rem] text-[0.9rem] text-ink-dim">
          {score} de {total} respuestas correctas al primer intento.
        </p>
        <SecondaryButton onClick={restart}>Empezar de nuevo</SecondaryButton>
      </div>
    );
  } else {
    body = (
      <>
        <span className="mb-6 inline-block rounded-full border border-accent px-3 py-[0.3rem] text-[0.72rem] tracking-[0.03em] text-accent-soft">
          {current.category}
        </span>
        <div className="mb-[1.6rem] flex justify-center">
          <ProtocolIcon name={current.icon} className="h-[88px] w-[88px] text-ink" />
        </div>
        <h1 className="mb-[1.7rem] font-serif text-[1.35rem] font-medium leading-[1.35]">
          {current.text}
        </h1>
        <div className="flex flex-col gap-[0.65rem]">
          {current.options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={Boolean(answer || pendingOption)}
              onClick={() => choose(o.id)}
              className={`rounded-[5px] border px-4 py-[0.85rem] text-left text-[0.98rem] text-ink transition-[border-color,background-color,transform] duration-150 ease-in-out ${optionClass(o.id, answer, pendingOption)}`}
            >
              {o.text}
            </button>
          ))}
        </div>
        <div className="mt-[1.6rem] min-h-[1.4rem] text-[0.88rem]" aria-live="polite">
          {answer?.correct && <span className="text-ok-soft">Correcto — siguiente pregunta…</span>}
          {answerError && (
            <span className="text-accent-soft">
              No se pudo comprobar la respuesta. Inténtalo de nuevo.
            </span>
          )}
        </div>
      </>
    );
  }

  const counter = state && !empty && (
    <span className="text-[0.8rem] tabular-nums text-ink-dim">
      <span className="text-ok-soft" aria-live="polite">
        {score} {score === 1 ? "acierto" : "aciertos"}
      </span>
      <span className="mx-2 text-line" aria-hidden="true">·</span>
      <span>
        {finished ? total : index + 1} / {total}
      </span>
    </span>
  );

  const changeLevelLink = !empty && (
    <button
      type="button"
      onClick={onChangeLevel}
      className="mx-auto mt-5 block text-[0.8rem] text-ink-dim underline-offset-4 hover:text-ink hover:underline"
    >
      Cambiar nivel
    </button>
  );

  return (
    <>
      <Shell
        subtitle={LEVEL_LABELS[level]}
        headerRight={counter}
        progress={progressPct}
        below={changeLevelLink}
      >
        {body}
      </Shell>
      <ExplanationSheet
        open={Boolean(answer && !answer.correct)}
        explanation={answer?.explanation}
        onClose={closeSheet}
      />
    </>
  );
}

function optionClass(optionId, answer, pendingOption) {
  if (answer) {
    if (optionId === answer.correctOptionId) return "cursor-default border-ok-soft bg-ok/[0.18]";
    if (optionId === answer.optionId) return "cursor-default border-accent bg-accent/[0.16]";
    return "cursor-default border-line bg-bg-2";
  }
  if (optionId === pendingOption) return "cursor-default border-accent-soft bg-bg-2";
  return "cursor-pointer border-line bg-bg-2 hover:border-accent-soft active:scale-[0.995]";
}
