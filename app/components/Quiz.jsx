"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProtocolIcon from "./ProtocolIcon";
import ExplanationSheet from "./ExplanationSheet";

const STORAGE_KEY = "protocolo:quiz";
const ADVANCE_DELAY_MS = 700;

// Categorías anidadas → lista plana de preguntas, en el orden de la BD
function flatten(categories) {
  return categories.flatMap((c) =>
    c.questions.map((q) => ({ ...q, category: c.name, icon: c.icon }))
  );
}

function freshState(questions) {
  return { order: questions.map((q) => q.id), index: 0, answers: {} };
}

// Progreso guardado en esta pestaña, solo si sigue encajando con las preguntas
function restoreState(questions) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
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

export default function Quiz() {
  const [questions, setQuestions] = useState(null);
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [pendingOption, setPendingOption] = useState(null);
  const [answerError, setAnswerError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/questions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = flatten((await res.json()).categories);
      setQuestions(list);
      setState(restoreState(list) ?? freshState(list));
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!state) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

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
    setState(freshState(questions));
  }

  const score = state
    ? Object.values(state.answers).filter((a) => a.correct).length
    : 0;
  const progressPct = finished ? 100 : total ? (index / total) * 100 : 0;

  let body;
  if (loadError) {
    body = (
      <div className="py-6 text-center">
        <p className="mb-6 text-ink-dim">No se pudieron cargar las preguntas.</p>
        <RestartButton onClick={load}>Reintentar</RestartButton>
      </div>
    );
  } else if (!state) {
    body = <p className="py-10 text-center text-sm text-ink-dim">Cargando…</p>;
  } else if (finished) {
    body = (
      <div className="pt-4 text-center">
        <ProtocolIcon name="shield" className="mx-auto mb-6 h-[88px] w-[88px] text-ink" />
        <h2 className="mb-2 font-serif text-[1.6rem] font-medium">Bloque completado</h2>
        <p className="mb-[1.6rem] text-ink-dim">
          {score} de {total} respuestas correctas al primer intento.
        </p>
        <RestartButton onClick={restart}>Empezar de nuevo</RestartButton>
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

  return (
    <main className="flex min-h-dvh justify-center">
      <div className="w-full max-w-[460px] px-5 pb-12 pt-10">
        <div className="mb-[1.4rem] flex items-baseline justify-between">
          <span className="font-serif text-[1.05rem] tracking-[0.02em] text-ink-dim">Protocolo</span>
          {state && (
            <span className="text-[0.8rem] tabular-nums text-ink-dim">
              {finished ? total : index + 1} / {total}
            </span>
          )}
        </div>
        <div className="mb-8 h-0.5 overflow-hidden rounded-sm bg-line">
          <div
            className="h-full bg-accent-soft transition-[width] duration-[400ms] ease-in-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="rounded-md border border-line bg-paper px-[1.6rem] pb-[1.8rem] pt-8">
          {body}
          <div className="mt-[1.8rem] border-t border-line pt-[1.1rem] text-center text-[0.72rem] tracking-[0.03em] text-ink-dim">
            Desarrollado por @Turel-SM
          </div>
        </div>
      </div>

      <ExplanationSheet
        open={Boolean(answer && !answer.correct)}
        explanation={answer?.explanation}
        onClose={closeSheet}
      />
    </main>
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

function RestartButton({ onClick, children }) {
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
