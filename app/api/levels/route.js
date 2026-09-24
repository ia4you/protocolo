import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { LEVEL_LABELS, LEVELS } from "@/lib/levels";

export const dynamic = "force-dynamic";

// Los tres niveles con su número de preguntas (0 si aún no tiene ninguna)
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT level, count(*)::int AS count FROM questions GROUP BY level"
    );
    const counts = Object.fromEntries(rows.map((r) => [r.level, r.count]));
    return NextResponse.json({
      levels: LEVELS.map((level) => ({
        level,
        label: LEVEL_LABELS[level],
        count: counts[level] ?? 0,
      })),
    });
  } catch (err) {
    console.error("GET /api/levels:", err);
    return NextResponse.json({ error: "No se pudieron cargar los niveles" }, { status: 500 });
  }
}
