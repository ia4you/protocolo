"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "./Shell";

const STORAGE_KEY = "protocolo:coach";
const TOTAL_QUESTIONS = 20;
const MAX_CHARS = 2000;
const UNAVAILABLE = "El experto no está disponible ahora mismo.";
// "Autodestrucción" del turno anterior: se quema (BURN_MS) y deja un rescoldo (EMBER_MS)
const BURN_MS = 700;
const EMBER_MS = 300;

// Índice donde empieza el turno actual: el último mensaje del experto (su
// evaluación + la pregunta vigente), seguido de la respuesta del usuario si la hay
function currentTurnStart(messages) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
  return 0;
}

function restoreChat() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    const valid =
      Array.isArray(saved?.messages) &&
      saved.messages.every(
        (m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string"
      );
    if (valid) {
      const score = Number.isInteger(saved.score) && saved.score >= 1 && saved.score <= 10 ? saved.score : null;
      return { messages: saved.messages, finished: Boolean(saved.finished), score };
    }
  } catch {}
  return null;
}

// **negrita** del modelo → <strong>, sin interpretar HTML
function renderText(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-accent-soft">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

export default function Coach() {
  const [chat, setChat] = useState(null); // { messages, finished, score }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  // Solo se pintan los mensajes desde shownFrom; el historial completo sigue
  // guardándose (el modelo lo necesita y sobrevive a recargas)
  const [shownFrom, setShownFrom] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | burning | ember
  const endRef = useRef(null);
  const started = useRef(false);

  // history: mensajes ya confirmados; message: respuesta nueva del usuario
  // (ya añadida a la pantalla). Sin message = apertura de la conversación.
  const request = useCallback(async (history, message) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || UNAVAILABLE);
      setChat((c) => ({
        messages: [...c.messages, { role: "assistant", content: data.reply }],
        finished: data.finished,
        score: data.score ?? null,
      }));
    } catch (err) {
      setError(err.name === "TypeError" ? UNAVAILABLE : err.message);
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = restoreChat();
    if (saved?.messages.length) {
      setChat(saved);
      setShownFrom(currentTurnStart(saved.messages));
      // Se recargó mientras se esperaba respuesta: se ofrece reintentar
      if (!saved.finished && saved.messages.at(-1).role === "user") {
        setError("La última respuesta del experto no llegó.");
      }
    } else {
      setChat({ messages: [], finished: false, score: null });
      request([]);
    }
  }, [request]);

  useEffect(() => {
    if (!chat) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    } catch {}
  }, [chat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chat?.messages.length, pending, error]);

  // Al llegar la siguiente respuesta del experto, el turno anterior se quema,
  // queda un rescoldo y después aparece el nuevo
  const liveFrom = currentTurnStart(chat?.messages ?? []);
  useEffect(() => {
    if (liveFrom <= shownFrom) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setShownFrom(liveFrom);
      return;
    }
    setPhase("burning");
    const toEmber = setTimeout(() => setPhase("ember"), BURN_MS);
    const done = setTimeout(() => {
      setShownFrom(liveFrom);
      setPhase("idle");
    }, BURN_MS + EMBER_MS);
    return () => {
      clearTimeout(toEmber);
      clearTimeout(done);
    };
  }, [liveFrom, shownFrom]);

  function send(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || pending || !chat || chat.finished || error) return;
    const history = chat.messages;
    setChat((c) => ({ ...c, messages: [...c.messages, { role: "user", content: text }] }));
    setDraft("");
    request(history, text);
  }

  function retry() {
    const msgs = chat.messages;
    if (msgs.length === 0) request([]);
    else if (msgs.at(-1).role === "user") request(msgs.slice(0, -1), msgs.at(-1).content);
    else setError(null);
  }

  function restart() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    setDraft("");
    setShownFrom(0);
    setPhase("idle");
    setChat({ messages: [], finished: false, score: null });
    request([]);
  }

  const messages = chat?.messages ?? [];
  const finished = Boolean(chat?.finished);
  // Cada mensaje del experto plantea la pregunta siguiente
  const asked = messages.filter((m) => m.role === "assistant").length;
  const current = Math.min(Math.max(asked, 1), TOTAL_QUESTIONS);
  const progress = finished ? 100 : (Math.max(asked - 1, 0) / TOTAL_QUESTIONS) * 100;
  const transitioning = liveFrom > shownFrom;
  const inputDisabled = !chat || pending || finished || Boolean(error) || transitioning;

  return (
    <Shell
      subtitle="Coach"
      headerRight={
        <span className="text-[0.8rem] tabular-nums text-ink-dim">
          {current} / {TOTAL_QUESTIONS}
        </span>
      }
      progress={progress}
      below={
        <Link
          href="/"
          className="mx-auto mt-5 block w-fit text-[0.8rem] text-ink-dim underline-offset-4 hover:text-ink hover:underline"
        >
          Volver al quiz
        </Link>
      }
    >
      <div className="flex flex-col gap-3" aria-live="polite">
        {transitioning ? (
          phase === "ember" ? (
            <div
              aria-hidden="true"
              className="my-8 h-0.5 animate-ember rounded-full bg-gradient-to-r from-transparent via-accent-soft to-transparent shadow-[0_0_14px_2px_rgba(201,106,84,0.45)]"
            />
          ) : (
            <div aria-hidden="true" className="flex animate-burn flex-col gap-3">
              {messages.slice(shownFrom, liveFrom).map((m, i) => (
                <Bubble key={shownFrom + i} message={m} />
              ))}
            </div>
          )
        ) : (
          messages.slice(shownFrom).map((m, i) => (
            <Bubble key={shownFrom + i} message={m} animate={m.role === "assistant"} />
          ))
        )}
        {!transitioning && finished && chat.score !== null && (
          <div className="mt-2 animate-rise rounded-md border border-accent/60 bg-accent/[0.08] px-5 py-6 text-center">
            <div className="text-[0.72rem] uppercase tracking-[0.08em] text-accent-soft">
              Puntuación final
            </div>
            <div className="mt-2 font-serif text-[3.2rem] font-medium leading-none tabular-nums text-ink">
              {chat.score}
              <span className="text-[1.5rem] text-ink-dim">/10</span>
            </div>
          </div>
        )}
        {pending && (
          <div className="self-start text-[0.85rem] italic text-ink-dim">
            El experto está escribiendo…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-[5px] border border-accent/50 px-3 py-2 text-[0.85rem] text-accent-soft">
            <span>{error}</span>
            <button type="button" onClick={retry} className="shrink-0 underline underline-offset-4 hover:text-ink">
              Reintentar
            </button>
          </div>
        )}
        {/* El margen evita que la barra de escritura fija tape el último mensaje */}
        <div ref={endRef} className="scroll-mb-28" />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 -mx-[1.6rem] mt-5 border-t border-line bg-paper px-[1.6rem] pb-[calc(0.5rem_+_env(safe-area-inset-bottom,0px))] pt-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            disabled={inputDisabled}
            maxLength={MAX_CHARS}
            rows={2}
            aria-label="Tu respuesta"
            placeholder={finished ? "Terminada" : "Escribe tu respuesta…"}
            className="min-h-[2.9rem] flex-1 resize-none rounded-[5px] border border-line bg-bg-2 px-3 py-2 text-[0.95rem] text-ink placeholder:text-ink-dim focus:border-accent-soft focus:outline-none disabled:opacity-50"
          />
          {finished ? (
            <button
              type="button"
              onClick={restart}
              className="whitespace-nowrap rounded-[5px] border border-line bg-bg-2 px-4 py-[0.7rem] text-[0.9rem] text-ink hover:border-accent-soft"
            >
              Empezar de nuevo
            </button>
          ) : (
            <button
              type="submit"
              disabled={inputDisabled || !draft.trim()}
              className="rounded-[5px] bg-accent px-4 py-[0.7rem] text-[0.9rem] font-medium text-[#f4ede6] hover:bg-accent-hover disabled:cursor-default disabled:opacity-40 disabled:hover:bg-accent"
            >
              Enviar
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

function Bubble({ message, animate = false }) {
  if (message.role === "assistant") {
    return (
      <div className={`max-w-[88%] self-start ${animate ? "animate-rise" : ""}`}>
        <div className="mb-1 text-[0.7rem] tracking-[0.03em] text-accent-soft">El experto</div>
        <div className="whitespace-pre-wrap rounded-[10px] rounded-tl-[3px] border border-line bg-bg-2 px-4 py-3 text-[0.95rem] leading-[1.5] text-ink">
          {renderText(message.content)}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-[10px] rounded-tr-[3px] border border-accent/60 bg-accent/[0.16] px-4 py-3 text-[0.95rem] leading-[1.5] text-ink">
      {message.content}
    </div>
  );
}
