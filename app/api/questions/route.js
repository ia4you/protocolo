import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Consulta la BD en cada petición (no se genera en el build)
export const dynamic = "force-dynamic";

// Categorías con sus preguntas y opciones anidadas, todo ordenado por position.
// A propósito NO incluye is_correct ni explanation: se revelan en /api/answer.
const QUERY = `
  SELECT c.id, c.slug, c.name, c.icon,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', q.id,
        'text', q.text,
        'options', (
          SELECT json_agg(json_build_object('id', o.id, 'text', o.text) ORDER BY o.position)
          FROM options o WHERE o.question_id = q.id
        )
      ) ORDER BY q.position)
      FROM questions q WHERE q.category_id = c.id
    ), '[]') AS questions
  FROM categories c
  ORDER BY c.position
`;

export async function GET() {
  try {
    const { rows } = await pool.query(QUERY);
    return NextResponse.json({ categories: rows });
  } catch (err) {
    console.error("GET /api/questions:", err);
    return NextResponse.json({ error: "No se pudieron cargar las preguntas" }, { status: 500 });
  }
}
