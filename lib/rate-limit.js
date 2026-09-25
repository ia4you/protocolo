// Límite de uso en memoria con ventana deslizante. Suficiente para una sola
// instancia de la app; los contadores se reinician con cada despliegue.
const hits = new Map(); // clave -> marcas de tiempo (ms) dentro de la ventana

// Registra un uso de `key` si no supera `limit` en los últimos `windowMs`.
// Devuelve { ok: true } o { ok: false, retryAfter } (segundos hasta el próximo hueco).
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, ts] of hits) if (now - ts[ts.length - 1] >= windowMs) hits.delete(k);
  }
  return { ok: true };
}

// IP del visitante tras el proxy (Traefik rellena X-Real-Ip con la IP real)
export function clientIp(request) {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1).trim();
  return "desconocida";
}
