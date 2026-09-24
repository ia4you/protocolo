import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { DEFAULT_LEVEL, LEVELS } from "@/lib/levels";

// Consulta la BD en cada petición (no se genera en el build)
export const dynamic = "force-dynamic";

// Categorías con preguntas del nivel pedido, con sus preguntas y opciones
// anidadas, todo ordenado por position. Las categorías sin preguntas en ese
// nivel no aparecen.
// A propósito NO incluye is_correct ni explanation: se revelan en /api/answer.
const QUERY = `
  SELECT c.id, c.slug, c.name, c.icon,
    (
      SELECT json_agg(json_build_object(
        'id', q.id,
        'text', q.text,
        'options', (
          SELECT json_agg(json_build_object('id', o.id, 'text', o.text) ORDER BY o.position)
          FROM options o WHERE o.question_id = q.id
        )
      ) ORDER BY q.position)
      FROM questions q WHERE q.category_id = c.id AND q.level = $1
    ) AS questions
  FROM categories c
  WHERE EXISTS (SELECT 1 FROM questions q WHERE q.category_id = c.id AND q.level = $1)
  ORDER BY c.position
`;

// GET /api/questions?level=amateur|medio|master (amateur si no se indica)
export async function GET(request) {
  const level = request.nextUrl.searchParams.get("level") ?? DEFAULT_LEVEL;
  if (!LEVELS.includes(level)) {
    return NextResponse.json(
      { error: `level debe ser uno de: ${LEVELS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(QUERY, [level]);
    return NextResponse.json({ level, categories: rows });
  } catch (err) {
    console.error("GET /api/questions:", err);
    return NextResponse.json({ error: "No se pudieron cargar las preguntas" }, { status: 500 });
  }
}
