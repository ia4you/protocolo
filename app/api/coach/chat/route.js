import { NextResponse } from "next/server";
import { COACH_GREETING, COACH_SYSTEM_PROMPT } from "@/lib/coach-prompt";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile ya no está disponible en Groq. qwen sigue mejor el
// guion (temas, contador, despedida) pero no admite una llamada solo con el
// system prompt, así que la apertura la genera gpt-oss. Ambos cambiables por env.
const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
const OPENING_MODEL = process.env.GROQ_OPENING_MODEL || "openai/gpt-oss-120b";
const TOTAL_QUESTIONS = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_CHARS = 8000;
const MAX_ATTEMPTS = 3;

// Límites por IP y hora para no agotar la cuota de Groq. Una conversación
// completa son 21 peticiones; el límite de peticiones cubre también a quien
// mande historiales inventados sin abrir conversación.
const HOUR_MS = 60 * 60 * 1000;
const MAX_CONVERSATIONS_PER_HOUR = 6;
const MAX_REQUESTS_PER_HOUR = 150;

const UNAVAILABLE = "El experto no está disponible ahora mismo";
const counter = (n) => `[Pregunta ${n} de ${TOTAL_QUESTIONS}]`;
const fail = (error, status) => NextResponse.json({ error }, { status });

function tooMany(what, retryAfter) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return NextResponse.json(
    {
      error: `Has alcanzado el límite de ${what} con el experto por esta hora. Vuelve en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

// En la apertura, gpt-oss con razonamiento "low" se niega a menudo con el
// tono del prompt ("I'm sorry, but I can't help with that"); con "medium" casi nunca.
function modelParams(model, opening) {
  if (model.startsWith("qwen/")) return { reasoning_effort: "none" };
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: opening ? "medium" : "low" };
  return {};
}

// Los modelos a veces repiten el contador ("**Pregunta 9 de 20**", "Pregunta 4:", "Tema 18:")
// o se inventan el siguiente turno del usuario ("[Pregunta 4 de 20] Pues…").
function cleanReply(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const invented = t.slice(1).search(/\[Pregunta \d+ de \d+\]/i);
  if (invented >= 0) t = t.slice(0, invented + 1);
  return t
    .replace(/^\s*\[Pregunta \d+ de \d+\]\s*/i, "")
    .replace(/^[ \t]*\**[ \t]*Pregunta \d+ de \d+[ \t]*\**[ \t]*:?[ \t]*$\n?/gim, "")
    .replace(/\**\bpregunta \d+ de \d+\b\**/gi, "siguiente pregunta")
    .replace(/\**\b(?:Tema|Pregunta) \d+\b\**\s*:\**[ \t]*/gi, "")
    .replace(/\**\bTema \d+\b\**[ \t]*/g, "")
    .trim();
}

// Despedida: extrae "PUNTUACIÓN: X/10" (tolera negritas y la falta de tilde)
// y la quita del texto, que se muestra aparte como número destacado.
const SCORE_LINE = /^[ \t]*\**[ \t]*PUNTUACI[OÓ]N[ \t]*:?[ \t]*\**[ \t]*(\d{1,2})[ \t]*\/[ \t]*10[ \t]*\**[ \t]*$/im;

// La escala se presenta "/10" pero el tope real es 7 (también lo pide el
// prompt); si el modelo pone más, se rebaja aquí.
const MAX_SCORE = 7;

function extractScore(reply) {
  const match = reply.match(SCORE_LINE);
  const raw = match ? Number(match[1]) : NaN;
  if (!(raw >= 1 && raw <= 10)) return { reply, score: null };
  if (raw > MAX_SCORE) console.warn(`POST /api/coach/chat: puntuación ${raw}/10 rebajada a ${MAX_SCORE}`);
  return { reply: reply.replace(SCORE_LINE, "").trim(), score: Math.min(raw, MAX_SCORE) };
}

async function callGroq(model, messages, opening) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      ...modelParams(model, opening),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  const reply = cleanReply(choice?.message?.content ?? "");
  if (!reply) {
    console.warn(
      `POST /api/coach/chat: respuesta vacía de ${model} (finish_reason=${choice?.finish_reason})`,
      JSON.stringify(choice?.message ?? null).slice(0, 400)
    );
  }
  return reply;
}

// Cuerpo: { history: [{ role: "user" | "assistant", content }], message? }
// El historial llega sin contadores; se reconstruyen aquí para que el cliente
// no pueda alterarlos. Historial vacío = apertura de la conversación.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("JSON no válido", 400);
  }

  const history = body?.history ?? [];
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  const validHistory =
    Array.isArray(history) &&
    history.length <= TOTAL_QUESTIONS * 2 + 1 &&
    history.every(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length <= (m.role === "user" ? MAX_MESSAGE_CHARS : MAX_HISTORY_CHARS)
    );
  if (!validHistory) return fail("Historial no válido", 400);
  if (message.length > MAX_MESSAGE_CHARS) {
    return fail(`El mensaje no puede superar ${MAX_MESSAGE_CHARS} caracteres`, 400);
  }

  const opening = history.length === 0;
  if (opening && message) return fail("La conversación la abre el experto", 400);
  if (!opening && !message) return fail("Falta el mensaje", 400);

  const turn = history.filter((m) => m.role === "user").length + 1;
  if (!opening && turn > TOTAL_QUESTIONS) return fail("La conversación ya ha terminado", 409);
  const finished = !opening && turn >= TOTAL_QUESTIONS;

  const messages = [{ role: "system", content: COACH_SYSTEM_PROMPT }];
  let n = 0;
  for (const m of history) {
    messages.push(
      m.role === "user"
        ? { role: "user", content: `${counter(++n)} ${m.content}` }
        : { role: "assistant", content: m.content }
    );
  }
  if (!opening) messages.push({ role: "user", content: `${counter(turn)} ${message}` });

  // Tras validar y antes de llamar a Groq: solo cuentan peticiones válidas
  const ip = clientIp(request);
  if (opening) {
    const conv = rateLimit(`coach:conv:${ip}`, MAX_CONVERSATIONS_PER_HOUR, HOUR_MS);
    if (!conv.ok) return tooMany("conversaciones", conv.retryAfter);
  }
  const req = rateLimit(`coach:req:${ip}`, MAX_REQUESTS_PER_HOUR, HOUR_MS);
  if (!req.ok) return tooMany("mensajes", req.retryAfter);

  if (!process.env.GROQ_API_KEY) {
    console.error("POST /api/coach/chat: falta GROQ_API_KEY");
    return fail(UNAVAILABLE, 503);
  }

  try {
    const model = opening ? OPENING_MODEL : MODEL;
    let reply = "";
    let score = null;
    let valid = false;
    // La apertura debe empezar por el saludo exacto (si no, suele ser una
    // negativa del modelo), cada respuesta debe plantear una pregunta y la
    // despedida traer la puntuación; si no, se regenera (MAX_ATTEMPTS).
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !valid; attempt++) {
      // qwen a veces devuelve contenido vacío de forma persistente para un
      // historial concreto: el último intento se hace con el modelo de apertura
      const attemptModel = attempt === MAX_ATTEMPTS ? OPENING_MODEL : model;
      reply = await callGroq(attemptModel, messages, opening);
      if (finished) {
        ({ reply, score } = extractScore(reply));
        valid = Boolean(reply) && score !== null;
      } else {
        valid = reply.includes("?") && (!opening || reply.startsWith(COACH_GREETING));
      }
      if (!valid) console.warn(`POST /api/coach/chat: respuesta no válida en turno ${opening ? 0 : turn} (intento ${attempt})`);
    }
    // Una apertura sin saludo es una negativa: mejor error con "Reintentar" que mostrarla
    if (!reply || (opening && !valid)) {
      return fail("El experto se ha quedado sin palabras. Inténtalo de nuevo", 502);
    }
    return NextResponse.json({ reply, turn: opening ? 0 : turn, finished, score });
  } catch (err) {
    console.error("POST /api/coach/chat:", err);
    return fail(UNAVAILABLE, 502);
  }
}
