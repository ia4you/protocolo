import { NextResponse } from "next/server";
import { COACH_SYSTEM_PROMPT } from "@/lib/coach-prompt";
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

function modelParams(model) {
  if (model.startsWith("qwen/")) return { reasoning_effort: "none" };
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low" };
  return {};
}

// Los modelos a veces repiten el contador ("**Pregunta 9 de 20**", "Tema 18:")
// o se inventan el siguiente turno del usuario ("[Pregunta 4 de 20] Pues…").
function cleanReply(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const invented = t.slice(1).search(/\[Pregunta \d+ de \d+\]/i);
  if (invented >= 0) t = t.slice(0, invented + 1);
  return t
    .replace(/^\s*\[Pregunta \d+ de \d+\]\s*/i, "")
    .replace(/^[ \t]*\**[ \t]*Pregunta \d+ de \d+[ \t]*\**[ \t]*:?[ \t]*$\n?/gim, "")
    .replace(/\**\bpregunta \d+ de \d+\b\**/gi, "siguiente pregunta")
    .replace(/\**\bTema \d+\b\**\s*:?[ \t]*/g, "")
    .trim();
}

async function callGroq(model, messages) {
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
      ...modelParams(model),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  const data = await res.json();
  return cleanReply(data.choices?.[0]?.message?.content ?? "");
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
    // Salvo en la despedida, cada respuesta debe plantear una pregunta; si
    // llega cortada o se despide antes de tiempo, se regenera (MAX_ATTEMPTS).
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      reply = await callGroq(model, messages);
      if (reply && (finished || reply.includes("?"))) break;
      console.warn(`POST /api/coach/chat: respuesta sin pregunta en turno ${turn} (intento ${attempt})`);
    }
    if (!reply) return fail("El experto se ha quedado sin palabras. Inténtalo de nuevo", 502);
    return NextResponse.json({ reply, turn: opening ? 0 : turn, finished });
  } catch (err) {
    console.error("POST /api/coach/chat:", err);
    return fail(UNAVAILABLE, 502);
  }
}
