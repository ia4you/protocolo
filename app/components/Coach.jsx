"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "./Shell";

const STORAGE_KEY = "protocolo:coach";
const TOTAL_QUESTIONS = 20;
const MAX_CHARS = 2000;
const UNAVAILABLE = "El experto no está disponible ahora mismo.";

function restoreChat() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    const valid =
      Array.isArray(saved?.messages) &&
      saved.messages.every(
        (m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string"
      );
    if (valid) return { messages: saved.messages, finished: Boolean(saved.finished) };
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
  const [chat, setChat] = useState(null); // { messages, finished }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
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
      // Se recargó mientras se esperaba respuesta: se ofrece reintentar
      if (!saved.finished && saved.messages.at(-1).role === "user") {
        setError("La última respuesta del experto no llegó.");
      }
    } else {
      setChat({ messages: [], finished: false });
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
    setChat({ messages: [], finished: false });
    request([]);
  }

  const messages = chat?.messages ?? [];
  const finished = Boolean(chat?.finished);
  // Cada mensaje del experto plantea la pregunta siguiente
  const asked = messages.filter((m) => m.role === "assistant").length;
  const current = Math.min(Math.max(asked, 1), TOTAL_QUESTIONS);
  const progress = finished ? 100 : (Math.max(asked - 1, 0) / TOTAL_QUESTIONS) * 100;
  const inputDisabled = !chat || pending || finished || Boolean(error);

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
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="max-w-[88%] self-start">
              <div className="mb-1 text-[0.7rem] tracking-[0.03em] text-accent-soft">El experto</div>
              <div className="whitespace-pre-wrap rounded-[10px] rounded-tl-[3px] border border-line bg-bg-2 px-4 py-3 text-[0.95rem] leading-[1.5] text-ink">
                {renderText(m.content)}
              </div>
            </div>
          ) : (
            <div
              key={i}
              className="max-w-[85%] self-end whitespace-pre-wrap rounded-[10px] rounded-tr-[3px] border border-accent/60 bg-accent/[0.16] px-4 py-3 text-[0.95rem] leading-[1.5] text-ink"
            >
              {m.content}
            </div>
          )
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
